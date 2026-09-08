import { storage } from "./storage";
import { processPayment } from "./payment-processor";
import { sendOrgNotificationEmail } from "./email";
import type { Payment } from "@shared/schema";
import {
  claimPaymentForProcessing,
  markPaymentNeedsReviewIfProcessing,
  markStaleProcessingPaymentsNeedsReview,
} from "./payment-safety";
import { getPaymentBusinessDate } from "./payment-date";

export interface RunResult {
  runTime: string;
  totalProcessed: number;
  totalSuccess: number;
  totalDeclined: number;
  totalNeedsReview: number;
  totalSkipped: number;
  alreadyRunning?: boolean;
  orgResults: Record<string, {
    orgName: string;
    processed: number;
    success: number;
    declined: number;
    needsReview?: number;
    skipped: boolean;
    skipReason?: string;
  }>;
}

export class AutoPaymentRunRegistry {
  private readonly lastResultsByOrg = new Map<string, RunResult>();
  private readonly lastTimestampsByOrg = new Map<string, string>();
  private readonly runningOrgIds = new Set<string>();
  private isGlobalRunRunning = false;

  tryStart(organizationId?: string): boolean {
    const alreadyRunning = organizationId
      ? this.isGlobalRunRunning || this.runningOrgIds.has(organizationId)
      : this.isGlobalRunRunning || this.runningOrgIds.size > 0;
    if (alreadyRunning) return false;
    if (organizationId) this.runningOrgIds.add(organizationId);
    else this.isGlobalRunRunning = true;
    return true;
  }

  finish(organizationId: string | undefined, result: RunResult, timestamp: string) {
    if (organizationId) {
      this.runningOrgIds.delete(organizationId);
      this.lastResultsByOrg.set(organizationId, result);
      this.lastTimestampsByOrg.set(organizationId, timestamp);
    } else {
      this.isGlobalRunRunning = false;
    }
  }

  getStatus(organizationId: string) {
    return {
      isRunning: this.isGlobalRunRunning || this.runningOrgIds.has(organizationId),
      lastRunTimestamp: this.lastTimestampsByOrg.get(organizationId) ?? null,
      lastRunResult: this.lastResultsByOrg.get(organizationId) ?? null,
    };
  }
}

const runRegistry = new AutoPaymentRunRegistry();

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
  return getPaymentBusinessDate();
}

export async function runAutoPayments(singleOrgId?: string, options?: { manualTrigger?: boolean }): Promise<RunResult> {
  const manualTrigger = options?.manualTrigger === true;
  if (!runRegistry.tryStart(singleOrgId)) {
    console.log(`[Auto Runner] Already running${singleOrgId ? ` for org ${singleOrgId}` : ""}, skipping`);
    return {
      runTime: new Date().toISOString(),
      totalProcessed: 0,
      totalSuccess: 0,
      totalDeclined: 0,
      totalNeedsReview: 0,
      totalSkipped: 0,
      alreadyRunning: true,
      orgResults: {},
    };
  }

  const startTime = new Date();
  console.log(`[Auto Runner] Starting auto payment run at ${startTime.toISOString()}${singleOrgId ? ` (scoped to org: ${singleOrgId})` : " (all orgs)"}`);

  const result: RunResult = {
    runTime: startTime.toISOString(),
    totalProcessed: 0,
    totalSuccess: 0,
    totalDeclined: 0,
    totalNeedsReview: 0,
    totalSkipped: 0,
    orgResults: {},
  };

  try {
    const today = getEasternDateString();
    const staleCount = await markStaleProcessingPaymentsNeedsReview(singleOrgId);
    if (staleCount > 0) {
      console.warn(`[Auto Runner] Moved ${staleCount} incomplete processing attempt(s) to needs_review`);
    }
    const pendingPayments = await storage.getPendingPaymentsDueByDate(today);

    if (pendingPayments.length === 0) {
      console.log("[Auto Runner] No pending payments due today or earlier");
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

      // For scheduled runs, require the org's auto-runner to be enabled.
      // For manual triggers (admin clicked "Run Now"), bypass this gate —
      // the explicit click is the authorization.
      if (!manualTrigger && !org.autoRunnerEnabled) {
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
        needsReview: 0,
        skipped: false,
      };

      for (const payment of payments) {
        try {
          // Claim immediately before the provider call. A simultaneous manual
          // run or runner instance sees zero rows returned and must not charge.
          const claimed = await claimPaymentForProcessing(payment.id, orgId, today);
          if (!claimed) {
            result.totalSkipped++;
            continue;
          }
          // Reload after the atomic claim so a schedule update that committed
          // immediately before the claim cannot be charged with stale terms.
          const claimedPayment = await storage.getPayment(payment.id);
          if (!claimedPayment || claimedPayment.status !== "processing") {
            result.totalSkipped++;
            continue;
          }
          const r = await processPayment(claimedPayment, storage, orgId);
          orgResult.processed++;
          if (r.success) {
            orgResult.success++;
          } else if (r.ambiguous) {
            orgResult.needsReview++;
          } else {
            orgResult.declined++;
          }
        } catch (err) {
          console.error(`[Auto Runner] Error processing payment ${payment.id} for org ${orgName}:`, err);
          orgResult.processed++;
          try {
            const marked = await markPaymentNeedsReviewIfProcessing(payment.id, orgId);
            if (marked) {
              orgResult.needsReview++;
            } else {
              // Another worker may have persisted a conclusive result first.
              const current = await storage.getPayment(payment.id);
              if (current?.status === "processed" || current?.status === "posted") {
                orgResult.success++;
              } else if (current?.status === "needs_review" || current?.status === "processing") {
                orgResult.needsReview++;
              } else {
                orgResult.declined++;
              }
            }
          } catch (recoveryError) {
            console.error(`[Auto Runner] Failed to preserve uncertain payment ${payment.id} for review:`, recoveryError);
            orgResult.needsReview++;
          }
        }
      }

      result.orgResults[orgId] = orgResult;
      result.totalProcessed += orgResult.processed;
      result.totalSuccess += orgResult.success;
      result.totalDeclined += orgResult.declined;
      result.totalNeedsReview += orgResult.needsReview;

      console.log(`[Auto Runner] Org "${orgName}": ${orgResult.processed} processed, ${orgResult.success} success, ${orgResult.declined} declined, ${orgResult.needsReview} needs review`);

      if (orgResult.processed > 0) {
        const subject = `Payment Runner Report — ${orgResult.processed} processed (${orgResult.success} approved, ${orgResult.declined} declined, ${orgResult.needsReview} needs review)`;
        const html = `<h2>Automatic Payment Runner Report</h2>
<p><strong>${orgName}</strong></p>
<p>Run time: ${startTime.toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
<ul>
  <li>Payments processed: <strong>${orgResult.processed}</strong></li>
  <li>Approved: <strong>${orgResult.success}</strong></li>
  <li>Declined: <strong>${orgResult.declined}</strong></li>
  <li>Needs review: <strong>${orgResult.needsReview}</strong></li>
</ul>`;
        const text = `Automatic Payment Runner Report — ${orgName}\nRun time: ${startTime.toISOString()}\nProcessed: ${orgResult.processed}\nApproved: ${orgResult.success}\nDeclined: ${orgResult.declined}\nNeeds review: ${orgResult.needsReview}`;
        sendOrgNotificationEmail(orgId, subject, html, text).catch((err) => {
          console.error(`[Auto Runner] Failed to send report email for org ${orgName}:`, err);
        });
      }
    }

    console.log(`[Auto Runner] Run complete: ${result.totalProcessed} processed, ${result.totalSuccess} success, ${result.totalDeclined} declined, ${result.totalSkipped} skipped`);
  } catch (err) {
    console.error("[Auto Runner] Fatal error during auto run:", err);
  } finally {
    runRegistry.finish(singleOrgId, result, startTime.toISOString());
  }

  return result;
}

export function getAutoRunnerStatus(organizationId: string) {
  return runRegistry.getStatus(organizationId);
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
        // Run organizations sequentially. Starting all of them concurrently causes
        // the global overlap guard to skip every organization after the first.
        try {
          await runAutoPayments(org.id);
        } catch (err) {
          console.error(`[Auto Runner] Scheduled run error for org ${org.id}:`, err);
        }
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
