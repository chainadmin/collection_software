import { storage } from "./storage";
import { processPayment } from "./payment-processor";
import type { Payment } from "@shared/schema";

interface RunResult {
  runTime: string;
  totalProcessed: number;
  totalSuccess: number;
  totalDeclined: number;
  totalSkipped: number;
  orgResults: Record<string, {
    orgName: string;
    processed: number;
    success: number;
    declined: number;
    skipped: boolean;
    skipReason?: string;
  }>;
}

let lastRunResult: RunResult | null = null;
let isRunning = false;
let lastRunTimestamp: string | null = null;

const CHECK_INTERVAL_MS = 60 * 1000;
const DEFAULT_RUN_HOURS = [7, 18];

function parseRunHours(raw: string | null | undefined): number[] {
  if (!raw) return DEFAULT_RUN_HOURS;
  const parts = String(raw)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);
  return parts.length > 0 ? Array.from(new Set(parts)).sort((a, b) => a - b) : DEFAULT_RUN_HOURS;
}

function getEasternTime(): Date {
  const now = new Date();
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return eastern;
}

function getEasternDateString(): string {
  const et = getEasternTime();
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, "0");
  const d = String(et.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function runAutoPayments(singleOrgId?: string): Promise<RunResult> {
  if (isRunning) {
    console.log("[Auto Runner] Already running, skipping");
    return lastRunResult || {
      runTime: new Date().toISOString(),
      totalProcessed: 0,
      totalSuccess: 0,
      totalDeclined: 0,
      totalSkipped: 0,
      orgResults: {},
    };
  }

  isRunning = true;
  const startTime = new Date();
  console.log(`[Auto Runner] Starting auto payment run at ${startTime.toISOString()}${singleOrgId ? ` (scoped to org: ${singleOrgId})` : " (all orgs)"}`);

  const result: RunResult = {
    runTime: startTime.toISOString(),
    totalProcessed: 0,
    totalSuccess: 0,
    totalDeclined: 0,
    totalSkipped: 0,
    orgResults: {},
  };

  try {
    const today = getEasternDateString();
    const pendingPayments = await storage.getPendingPaymentsDueByDate(today);

    if (pendingPayments.length === 0) {
      console.log("[Auto Runner] No pending payments due today or earlier");
      lastRunResult = result;
      lastRunTimestamp = startTime.toISOString();
      return result;
    }

    console.log(`[Auto Runner] Found ${pendingPayments.length} pending payments due by ${today}`);

    const byOrg: Record<string, Payment[]> = {};
    for (const p of pendingPayments) {
      const oid = p.organizationId;
      if (singleOrgId && oid !== singleOrgId) continue;
      if (!byOrg[oid]) byOrg[oid] = [];
      byOrg[oid].push(p);
    }

    const orgs = await storage.getOrganizations();
    const orgMap = new Map(orgs.map(o => [o.id, o]));

    for (const [orgId, payments] of Object.entries(byOrg)) {
      const org = orgMap.get(orgId);
      const orgName = org?.name || orgId;

      if (!org) {
        result.orgResults[orgId] = {
          orgName,
          processed: 0,
          success: 0,
          declined: 0,
          skipped: true,
          skipReason: "Organization not found",
        };
        result.totalSkipped += payments.length;
        continue;
      }

      if (!org.autoRunnerEnabled) {
        result.orgResults[orgId] = {
          orgName,
          processed: 0,
          success: 0,
          declined: 0,
          skipped: true,
          skipReason: "Auto-runner disabled",
        };
        result.totalSkipped += payments.length;
        console.log(`[Auto Runner] Skipping org "${orgName}" - auto-runner disabled`);
        continue;
      }

      const merchants = await storage.getMerchants(orgId);
      const hasActiveMerchant = merchants.some(m => m.isActive);

      if (!hasActiveMerchant) {
        result.orgResults[orgId] = {
          orgName,
          processed: 0,
          success: 0,
          declined: 0,
          skipped: true,
          skipReason: "No active merchant configured",
        };
        result.totalSkipped += payments.length;
        console.log(`[Auto Runner] Skipping org "${orgName}" - no active merchant`);
        continue;
      }

      const orgResult = {
        orgName,
        processed: 0,
        success: 0,
        declined: 0,
        skipped: false,
      };

      for (const payment of payments) {
        try {
          const r = await processPayment(payment, storage, orgId);
          orgResult.processed++;
          if (r.success) {
            orgResult.success++;
          } else {
            orgResult.declined++;
          }
        } catch (err) {
          console.error(`[Auto Runner] Error processing payment ${payment.id} for org ${orgName}:`, err);
          orgResult.processed++;
          orgResult.declined++;
        }
      }

      result.orgResults[orgId] = orgResult;
      result.totalProcessed += orgResult.processed;
      result.totalSuccess += orgResult.success;
      result.totalDeclined += orgResult.declined;

      console.log(`[Auto Runner] Org "${orgName}": ${orgResult.processed} processed, ${orgResult.success} success, ${orgResult.declined} declined`);
    }

    console.log(`[Auto Runner] Run complete: ${result.totalProcessed} processed, ${result.totalSuccess} success, ${result.totalDeclined} declined, ${result.totalSkipped} skipped`);
  } catch (err) {
    console.error("[Auto Runner] Fatal error during auto run:", err);
  } finally {
    isRunning = false;
    lastRunResult = result;
    lastRunTimestamp = startTime.toISOString();
  }

  return result;
}

export function getAutoRunnerStatus() {
  return {
    isRunning,
    lastRunTimestamp,
    lastRunResult,
  };
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
const lastOrgTriggerKeys: Map<string, string> = new Map();

export function startAutoPaymentScheduler() {
  console.log("[Auto Runner] Scheduler started — checking every 60s; per-org schedule from autoRunnerHours");

  schedulerInterval = setInterval(async () => {
    const et = getEasternTime();
    const hour = et.getHours();
    const minute = et.getMinutes();

    if (minute !== 0) return;

    try {
      const orgs = await storage.getOrganizations();
      const dateStr = getEasternDateString();

      for (const org of orgs) {
        if (!org.autoRunnerEnabled) continue;
        const hours = parseRunHours(org.autoRunnerHours);
        if (!hours.includes(hour)) continue;

        const triggerKey = `${dateStr}-${hour}`;
        if (lastOrgTriggerKeys.get(org.id) === triggerKey) continue;
        lastOrgTriggerKeys.set(org.id, triggerKey);

        console.log(`[Auto Runner] Trigger fired for org "${org.name}" at ${hour}:00 Eastern`);
        runAutoPayments(org.id).catch((err) => {
          console.error(`[Auto Runner] Scheduled run error for org ${org.id}:`, err);
        });
      }
    } catch (err) {
      console.error("[Auto Runner] Scheduler tick error:", err);
    }
  }, CHECK_INTERVAL_MS);

  return schedulerInterval;
}

export function stopAutoPaymentScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Auto Runner] Scheduler stopped");
  }
}
