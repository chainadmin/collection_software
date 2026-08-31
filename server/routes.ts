import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerExternalApiRoutes } from "./external-api";
import { buildInternalPaymentInsert, rejectRawCardData } from "./payment-input";
import { redactPayment, redactPayments } from "./payment-presenter";
import crypto from "crypto";
import { canonicalizeIp, canonicalizeWhitelistEntry } from "./ip-address";
import { isActiveGlobalAdminSession } from "./access-control";
import bcrypt from "bcrypt";
import { 
  processDebtorCardPayment,
  processDebtorAchPayment,
  voidDebtorTransaction,
  type MerchantCredentials
} from "./authorizenet";
import {
  createCheckoutSession,
  verifyCheckoutSession,
  isStripeConfigured,
  getSubscriptionPrices,
  handleWebhookEvent,
} from "./stripe";
import { processPayment } from "./payment-processor";
import { getAutoRunnerStatus, runAutoPayments } from "./auto-payment-runner";
import { getSuperAdminEmailSettings, getOrgEmailSettings, sendNewOrgNotificationEmail } from "./email";
import { getPaymentMessageAutomationSettings, mergePaymentMessageAutomationSettings } from "./payment-message-automation";
import { db } from "./db";
import {
  emailSettings,
  enrichmentAuditLog,
  enrichmentBatches,
  enrichmentBatchMembers,
  enrichmentBatchResults,
  recallItems,
  workQueueItems,
  debtors as debtorsTable,
  payments as paymentsTable,
  type CampaignIntegration,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  claimDeclinedPaymentForRerun,
  claimPaymentForProcessing,
  postPaymentAtomically,
} from "./payment-safety";
import {
  applyReturn,
  createEnrichmentBatch,
  exportBatch,
  previewReturn,
} from "./enrichment-batches";
import { detectCardNetwork, normalizeCardNumber, passesLuhn } from "@shared/card-validation";
import { CardVaultError, vaultCard } from "./card-vault";
import { redactPaymentCard } from "./payment-card-presenter";
import { getPaymentBusinessDate } from "./payment-date";

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support both bcrypt hashes (start with $2) and legacy SHA-256 hashes (64 hex chars)
  if (hash.startsWith("$2")) {
    return bcrypt.compare(password, hash);
  }
  // Legacy SHA-256 fallback for existing passwords
  const sha256Hash = crypto.createHash("sha256").update(password).digest("hex");
  return sha256Hash === hash;
}

// Generate URL-friendly slug from company name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

// Default organization ID for unauthenticated requests (public pages only)
const DEFAULT_ORG_ID = "default-org";

// Get organization ID from authenticated session
// For authenticated routes, always use session data for security
function getOrgId(req: any): string {
  // Session-based authentication - primary and most secure method
  if (req.session?.collector?.organizationId) {
    return req.session.collector.organizationId;
  }
  // Fallback for public routes or unauthenticated contexts
  return DEFAULT_ORG_ID;
}

// Check if user is authenticated
function isAuthenticated(req: any): boolean {
  return !!(req.session?.collector || req.session?.globalAdmin);
}

// Authentication middleware - requires valid session
function requireAuth(req: any, res: any, next: any) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Require collector role authentication
function requireCollectorAuth(req: any, res: any, next: any) {
  if (!req.session?.collector) {
    return res.status(401).json({ error: "Collector authentication required" });
  }
  next();
}

// Require global admin authentication
async function requireGlobalAdminAuth(req: any, res: any, next: any) {
  const sessionAdminId = req.session?.globalAdmin?.id;
  if (!sessionAdminId) {
    return res.status(401).json({ error: "Super admin authentication required" });
  }
  try {
    const liveAdmin = await storage.getGlobalAdmin(sessionAdminId);
    if (!isActiveGlobalAdminSession(sessionAdminId, liveAdmin)) {
      return res.status(401).json({ error: "Super admin session is no longer authorized" });
    }
    return next();
  } catch (error) {
    console.error("Global admin session validation failed:", error);
    return res.status(503).json({ error: "Unable to validate super admin session" });
  }
}

// Verify the session's collector is still a live, active admin/manager of the
// given organization by re-loading the record — a stale session (demoted or
// disabled collector) must not retain privileged access for its lifetime.
async function isActiveAdminOrManager(req: any, orgId: string): Promise<boolean> {
  const sessionCollector = req.session?.collector;
  if (!sessionCollector?.id) return false;
  const live = await storage.getCollector(sessionCollector.id);
  return !!(
    live &&
    live.status === "active" &&
    live.organizationId === orgId &&
    (live.role === "admin" || live.role === "manager")
  );
}

// Validate that a resource belongs to the authenticated user's organization
// Returns true if valid, false if the resource doesn't belong to the org
function validateOrgOwnership(resourceOrgId: string | null | undefined, sessionOrgId: string): boolean {
  if (!resourceOrgId) return false;
  return resourceOrgId === sessionOrgId;
}


function formatMoney(cents: number | null | undefined): string {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatMessageDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function buildPaymentArrangementTable(payments: Array<{ paymentDate: string; amount: number; status?: string | null }>, html: boolean): string {
  const arrangementPayments = payments
    .filter((p) => ["pending", "scheduled", "queued"].includes((p.status || "pending").toLowerCase()))
    .sort((a, b) => String(a.paymentDate).localeCompare(String(b.paymentDate)));

  if (arrangementPayments.length === 0) {
    return html ? "<p>No payment arrangement on file.</p>" : "No payment arrangement on file.";
  }

  if (!html) {
    return [
      "Payment Date | Amount",
      "-------------|-------",
      ...arrangementPayments.map((p) => `${formatMessageDate(p.paymentDate)} | ${formatMoney(p.amount)}`),
    ].join("\n");
  }

  const rows = arrangementPayments
    .map((p) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${formatMessageDate(p.paymentDate)}</td><td style="padding:6px 10px;border:1px solid #ddd;">${formatMoney(p.amount)}</td></tr>`)
    .join("");
  return `<table style="border-collapse:collapse;"><thead><tr><th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Payment Date</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function renderTemplateForDebtor(templateText: string, debtor: any, html: boolean): Promise<string> {
  const contacts = await storage.getDebtorContacts(debtor.id);
  const payments = await storage.getPaymentsForDebtor(debtor.id);
  const primaryPhone = contacts.find((c) => c.type === "phone" && c.isPrimary)?.value || contacts.find((c) => c.type === "phone")?.value || "";
  const primaryEmail = debtor.email || contacts.find((c) => c.type === "email" && c.isPrimary)?.value || contacts.find((c) => c.type === "email")?.value || "";
  const customFields = (() => {
    try { return debtor.customFields ? JSON.parse(debtor.customFields) : {}; } catch { return {}; }
  })();
  const fullAddress = [debtor.address, debtor.city, debtor.state, debtor.zipCode].filter(Boolean).join(", ");
  const values: Record<string, string> = {
    firstName: debtor.firstName || "",
    lastName: debtor.lastName || "",
    fullName: `${debtor.firstName || ""} ${debtor.lastName || ""}`.trim(),
    consumerName: `${debtor.firstName || ""} ${debtor.lastName || ""}`.trim(),
    email: primaryEmail,
    phone: primaryPhone,
    consumerId: debtor.fileNumber || debtor.accountNumber || "",
    address: debtor.address || "",
    consumerAddress: debtor.address || "",
    city: debtor.city || "",
    consumerCity: debtor.city || "",
    state: debtor.state || "",
    consumerState: debtor.state || "",
    zip: debtor.zipCode || "",
    zipCode: debtor.zipCode || "",
    fullAddress,
    consumerFullAddress: fullAddress,
    ssnLast4: debtor.ssnLast4 || "",
    accountId: debtor.accountNumber || "",
    accountNumber: debtor.accountNumber || "",
    fileNumber: debtor.fileNumber || "",
    filenumber: debtor.fileNumber || "",
    creditor: debtor.originalCreditor || "",
    balance: formatMoney(debtor.currentBalance),
    balence: formatMoney(debtor.currentBalance),
    balanceCents: String(debtor.currentBalance ?? 0),
    dueDate: debtor.nextFollowUpDate ? formatMessageDate(debtor.nextFollowUpDate) : "",
    dueDateIso: debtor.nextFollowUpDate || "",
    "todays date": formatMessageDate(new Date().toISOString()),
    "Payment arrangement on file": buildPaymentArrangementTable(payments, html),
  };
  for (const pct of [50, 60, 70, 80, 90, 100]) values[`balance${pct}%`] = formatMoney(Math.round((debtor.currentBalance ?? 0) * pct / 100));
  for (const [key, value] of Object.entries(customFields || {})) values[key] = String(value ?? "");
  return (templateText || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawName) => {
    const name = String(rawName).trim();
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match;
  });
}

// Normalize an agency code that the user may have entered as a slug, a URL
// (https://app.example.com/login/acme), or a path (/login/acme). Falls back
// to the raw input, trimmed and lowercased.
function normalizeAgencyCode(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input.trim();
  if (!s) return "";

  // Pull a slug out of any /login/<slug> fragment if one is present.
  const loginMatch = s.match(/\/login\/([^\/?#\s]+)/i);
  if (loginMatch) {
    s = loginMatch[1];
  } else if (/[\/?:#]/.test(s)) {
    // Looks like a URL or path but has no /login/ — take the last non-empty
    // path segment so pasting "example.com/acme/" still works.
    const parts = s.split(/[\/?#]/).filter(Boolean);
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      // Skip the protocol piece (e.g. "https:") if that's all that remains.
      if (last && !/^[a-z]+:$/i.test(last)) {
        s = last;
      }
    }
  }

  return s.trim().toLowerCase();
}

function getClientIp(req: any): string | null {
  // Express derives req.ip from the socket and the configured trust-proxy hop.
  // Never parse X-Forwarded-For directly: that would trust attacker-supplied hops.
  return canonicalizeIp(req.ip);
}

// Check if organization has active subscription or is in trial period
async function checkSubscriptionActive(orgId: string): Promise<{ active: boolean; reason?: string }> {
  const org = await storage.getOrganization(orgId);
  if (!org) {
    return { active: false, reason: "Organization not found" };
  }
  
  // If organization is not active, block access
  if (!org.isActive) {
    return { active: false, reason: "Organization is inactive" };
  }
  
  // If subscription is active, allow access
  if (org.subscriptionStatus === "active") {
    return { active: true };
  }
  
  // If in trial, check if trial has expired
  if (org.subscriptionStatus === "trial") {
    const today = new Date();
    const trialEnd = org.trialEndDate ? new Date(org.trialEndDate) : null;
    const billingStart = org.billingStartDate ? new Date(org.billingStartDate) : null;

    // Some organizations have a free month configured after creation.
    // In that case, keep trial access until the later of trial end or billing start date.
    const accessEndDate = trialEnd && billingStart
      ? (trialEnd > billingStart ? trialEnd : billingStart)
      : (billingStart || trialEnd);

    if (!accessEndDate) {
      return { active: true };
    }

    if (today <= accessEndDate) {
      return { active: true };
    } else {
      return { active: false, reason: "Trial has expired. Please subscribe to continue." };
    }
  }
  
  // Default: allow access for legacy orgs without subscription status
  return { active: true };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Public routes that don't require authentication (paths relative to /api)
  // Note: These should be minimal - only what's needed before login
  const publicPaths = [
    "/auth/login",
    "/auth/collector-login",
    "/auth/logout",
    "/auth/session",
    "/auth/signup",
    "/auth/status",
    "/super-admin/login",
    "/billing/status",
    "/billing/prices",
    "/billing/webhook",
    "/v2/", // External API uses bearer token auth
  ];
  
  // Semi-public routes that allow read-only access but should be limited
  // These are needed for initial page load before user completes login
  const semiPublicPaths = [
    "/organizations/", // Allow org lookup by ID/slug for initial page load
  ];

  // Global authentication middleware for /api routes (except public paths)
  app.use("/api", async (req: any, res: any, next: any) => {
    const path = req.path;

    // A global administrator is outside company tenancy and is never subject to
    // an organization's whitelist.
    const globalAdminId = req.session?.globalAdmin?.id;
    let isGlobalAdminSession = false;
    if (globalAdminId) {
      try {
        const liveAdmin = await storage.getGlobalAdmin(globalAdminId);
        isGlobalAdminSession = isActiveGlobalAdminSession(globalAdminId, liveAdmin);
      } catch (error) {
        console.error("Global admin session validation failed:", error);
        return res.status(503).json({ error: "Unable to validate super admin session" });
      }
    }

    // Existing collector sessions are checked on every request, including
    // otherwise-public session routes. Only whitelist administration remains
    // available to a blocked, live admin/manager as a narrow recovery path.
    if (!isGlobalAdminSession && req.session?.collector?.id) {
      try {
        const collector = await storage.getCollector(req.session.collector.id);
        if (!collector || collector.status !== "active" ||
            collector.organizationId !== req.session.collector.organizationId) {
          return res.status(401).json({ error: "Collector session is no longer authorized" });
        }
        const organization = await storage.getOrganization(collector.organizationId);
        if (!organization || !organization.isActive) {
          return res.status(403).json({ error: "Organization is not active" });
        }
        if (organization.ipRestrictionEnabled) {
          const clientIp = getClientIp(req);
          const allowed = !!clientIp &&
            await storage.isIpWhitelisted(organization.id, clientIp);
          if (!allowed) {
            const recoveryPath = path === "/ip-whitelist" ||
              path.startsWith("/ip-whitelist/") ||
              path === "/organization/ip-restriction";
            const privileged = collector.role === "admin" || collector.role === "manager";
            if (!(recoveryPath && privileged)) {
              return res.status(403).json({
                code: "ip_blocked",
                error: "Access denied. Your current IP address is not authorized for this organization.",
              });
            }
          }
        }
      } catch (error) {
        console.error("IP access validation failed:", error);
        return res.status(503).json({ error: "Unable to validate IP access" });
      }
    }
    
    // Skip auth for public paths
    if (publicPaths.some(p => path === p || path.startsWith(p))) {
      return next();
    }
    
    // Allow semi-public paths (read-only, for initial page load)
    if (semiPublicPaths.some(p => path.startsWith(p)) && req.method === "GET") {
      return next();
    }
    
    // For super-admin routes, require global admin auth
    if (path.startsWith("/super-admin/")) {
      if (!isGlobalAdminSession) {
        return res.status(401).json({ error: "Super admin authentication required" });
      }
      return next();
    }
    
    // For all other /api routes, require collector auth (session-based)
    if (req.session?.collector?.id) {
      const collector = await storage.getCollector(req.session.collector.id);
      if (!collector) {
        return res.status(401).json({ error: "Collector session is no longer authorized" });
      }
      // Organization selectors in a request never override session tenancy.
      const requestedOrg = req.body?.organizationId ?? req.body?.tenantId ?? req.body?.companyId;
      if (requestedOrg && requestedOrg !== collector.organizationId) {
        return res.status(403).json({ error: "Organization access denied" });
      }
      return next();
    }
    
    return res.status(401).json({ error: "Authentication required" });
  });
  
  app.get("/api/dashboard/stats", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const dateRange = (req.query.dateRange as string) || "this_month";
      const stats = await storage.getDashboardStats(dateRange, orgId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Organization routes
  // Note: Getting all organizations is restricted to super admin only
  // Regular collectors can only access their own organization via /api/organizations/:id
  app.get("/api/organizations", requireGlobalAdminAuth, async (req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Organization lookup - returns limited public info for login page, full info for authenticated users
  app.get("/api/organizations/:id", async (req: any, res) => {
    try {
      const organization = await storage.getOrganization(req.params.id);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // For authenticated users, verify they're accessing their own org or are global admin
      if (req.session?.collector) {
        if (!validateOrgOwnership(organization.id, req.session.collector.organizationId) && !req.session?.globalAdmin) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      // For unauthenticated requests (login page), return limited info
      if (!req.session?.collector && !req.session?.globalAdmin) {
        return res.json({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          isActive: organization.isActive,
        });
      }
      
      res.json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/organizations/slug/:slug", async (req: any, res) => {
    try {
      const organization = await storage.getOrganizationBySlug(req.params.slug);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // For authenticated users, verify they're accessing their own org or are global admin
      if (req.session?.collector) {
        if (!validateOrgOwnership(organization.id, req.session.collector.organizationId) && !req.session?.globalAdmin) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      // For unauthenticated requests (login page), return limited info
      if (!req.session?.collector && !req.session?.globalAdmin) {
        return res.json({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          isActive: organization.isActive,
        });
      }
      
      res.json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations", requireGlobalAdminAuth, async (req, res) => {
    try {
      const organization = await storage.createOrganization({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Organization update - only allowed for own org or by global admin
  app.patch("/api/organizations/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const isGlobalAdmin = !!req.session?.globalAdmin;
      
      // Only allow updating own organization or if global admin
      if (!isGlobalAdmin && req.params.id !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const organization = await storage.updateOrganization(req.params.id, req.body);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  // Organization delete - restricted to global admin only
  app.delete("/api/organizations/:id", requireGlobalAdminAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteOrganization(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });

  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { companyName, name, email, password, phone, plan } = req.body;
      
      if (!companyName || !name || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Check if email already exists
      const existingCollector = await storage.getCollectorByEmail(email);
      if (existingCollector) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      // Validate plan
      const validPlans = ["starter", "growth", "agency"];
      const selectedPlan = validPlans.includes(plan) ? plan : "starter";
      const seatLimits: Record<string, number> = { starter: 4, growth: 15, agency: 40 };

      // Calculate trial end date (2 weeks from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // Create organization with 2-week trial (active immediately)
      const slug = generateSlug(companyName) + "-" + Date.now().toString(36);
      const organization = await storage.createOrganization({
        name: companyName,
        slug,
        phone: phone || null,
        email: email,
        isActive: true, // Active during trial period
        createdDate: new Date().toISOString().split("T")[0],
        subscriptionPlan: selectedPlan,
        subscriptionStatus: "trial",
        trialEndDate: trialEndDate.toISOString().split("T")[0],
        seatLimit: seatLimits[selectedPlan],
      });

      // Create admin collector for this organization
      const collector = await storage.createCollector({
        organizationId: organization.id,
        name,
        email,
        username: email.split("@")[0],
        password: await hashPassword(password),
        role: "admin",
        status: "active",
        avatarInitials: name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2),
        canViewDashboard: true,
        canViewEmail: true,
        canViewPaymentRunner: true,
      });

      // Create admin notification for new organization registration
      await storage.createAdminNotification({
        type: "new_org",
        title: "New Organization Registered",
        message: `${companyName} has registered. Contact: ${name} (${email}, ${phone || "no phone"})`,
        organizationId: organization.id,
        organizationName: companyName,
        metadata: JSON.stringify({ email, phone, name }),
        createdDate: new Date().toISOString(),
      });

      // Send email notification to super admin
      sendNewOrgNotificationEmail(companyName, name, email, phone || "").catch((err) => {
        console.error("Failed to send new org email notification:", err);
      });

      // Return success with user info for auto-login
      res.status(201).json({
        message: "Account created successfully",
        collector: {
          id: collector.id,
          name: collector.name,
          email: collector.email,
          role: collector.role,
        },
        organizationId: organization.id,
        organizationName: organization.name,
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Find collector by email
      const collector = await storage.getCollectorByEmail(email);
      if (!collector) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      if (!await verifyPassword(password, collector.password)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if collector is active
      if (collector.status !== "active") {
        return res.status(403).json({ error: "Your account is not active" });
      }

      // Get organization
      const organization = await storage.getOrganization(collector.organizationId);
      if (!organization || !organization.isActive) {
        return res.status(403).json({ error: "Your organization is not active" });
      }

      // Check IP whitelist if enabled for this organization
      if (organization.ipRestrictionEnabled) {
        const clientIp = getClientIp(req);

        if (!clientIp) {
          return res.status(403).json({
            error: "Access denied. Could not validate your IP address.",
          });
        }

        const isWhitelisted = await storage.isIpWhitelisted(organization.id, clientIp);
        if (!isWhitelisted) {
          console.log(`IP ${clientIp} blocked for org ${organization.id}`);
          return res.status(403).json({ 
            error: "Access denied. Your IP address is not authorized to login to this organization." 
          });
        }
      }

      // Store collector info in session
      req.session.collector = {
        id: collector.id,
        organizationId: organization.id,
        role: collector.role,
        name: collector.name,
        email: collector.email || "",
      };

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        res.json({
          message: "Login successful",
          collector: {
            id: collector.id,
            name: collector.name,
            email: collector.email,
            role: collector.role,
          },
          organizationId: organization.id,
          organizationName: organization.name,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/collector-login", async (req, res) => {
    try {
      const { username, password, agencyCode } = req.body ?? {};

      if (!username || !password || !agencyCode) {
        return res.status(400).json({
          code: "missing_fields",
          error: "Agency code, username, and password are all required.",
        });
      }

      const normalizedCode = normalizeAgencyCode(agencyCode);
      if (!normalizedCode) {
        return res.status(400).json({
          code: "missing_fields",
          error: "Agency code, username, and password are all required.",
        });
      }

      const organization = await storage.getOrganizationBySlug(normalizedCode);
      if (!organization) {
        return res.status(404).json({
          code: "org_not_found",
          error: "We couldn't find an organization with that company code. Double-check the code or ask your administrator.",
        });
      }

      if (!organization.isActive) {
        return res.status(403).json({
          code: "org_inactive",
          error: "This organization is currently inactive. Please contact your administrator.",
        });
      }

      if (organization.ipRestrictionEnabled) {
        const clientIp = getClientIp(req);

        if (!clientIp) {
          return res.status(403).json({
            code: "ip_invalid",
            error: "We couldn't validate your IP address. Please try again or contact your administrator.",
          });
        }

        const isWhitelisted = await storage.isIpWhitelisted(organization.id, clientIp);
        if (!isWhitelisted) {
          console.log(`[Collector Login] IP ${clientIp} blocked for org ${organization.id}`);
          return res.status(403).json({
            code: "ip_blocked",
            error: "Your IP address isn't authorized to access this organization. Ask an admin to whitelist it under Security settings.",
          });
        }
      }

      const trimmedUsername = String(username).trim();
      const collector = await storage.getCollectorByOrgAndUsername(organization.id, trimmedUsername);
      if (!collector) {
        return res.status(401).json({
          code: "invalid_credentials",
          error: "That username and password don't match. Please try again.",
        });
      }

      if (!await verifyPassword(password, collector.password)) {
        return res.status(401).json({
          code: "invalid_credentials",
          error: "That username and password don't match. Please try again.",
        });
      }

      if (collector.status !== "active") {
        return res.status(403).json({
          code: "collector_inactive",
          error: "Your account has been disabled. Please contact your administrator.",
        });
      }

      req.session.collector = {
        id: collector.id,
        organizationId: organization.id,
        role: collector.role,
        name: collector.name,
        email: collector.email || "",
      };

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        res.json({
          message: "Login successful",
          collector: {
            id: collector.id,
            name: collector.name,
            email: collector.email,
            role: collector.role,
          },
          organizationId: organization.id,
          organizationName: organization.name,
        });
      });
    } catch (error) {
      console.error("Collector login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Super Admin Login
  app.post("/api/super-admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const admin = await storage.getGlobalAdminByUsername(username);
      if (!admin) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (!await verifyPassword(password, admin.password)) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (!admin.isActive) {
        return res.status(403).json({ error: "Your admin account is not active" });
      }

      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error("[Super Admin] Session regenerate error:", regenErr);
          return res.status(500).json({ error: "Failed to establish session" });
        }

        req.session.globalAdmin = {
          id: admin.id,
          username: admin.username,
          name: admin.name,
        };

        req.session.save((err) => {
          if (err) {
            console.error("[Super Admin] Session save error:", err);
            return res.status(500).json({ error: "Failed to establish session" });
          }
          console.log(`[Super Admin] Session saved successfully for ${admin.username}, sid: ${req.sessionID}`);
          res.json({
            message: "Super admin login successful",
            admin: {
              id: admin.id,
              username: admin.username,
              name: admin.name,
            },
          });
        });
      });
    } catch (error) {
      console.error("Super admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout - destroy session
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current session info
  app.get("/api/auth/session", (req, res) => {
    if (req.session?.collector) {
      return res.json({ 
        type: "collector", 
        collector: req.session.collector 
      });
    }
    if (req.session?.globalAdmin) {
      return res.json({ 
        type: "globalAdmin", 
        admin: req.session.globalAdmin 
      });
    }
    return res.json({ type: null });
  });

  // Super Admin - Get all organizations
  app.get("/api/super-admin/organizations", requireGlobalAdminAuth, async (req, res) => {
    try {
      console.log("[Super Admin] Fetching organizations...");
      const organizations = await storage.getOrganizations();
      console.log(`[Super Admin] Found ${organizations.length} organizations`);
      res.json(organizations);
    } catch (error: any) {
      console.error("[Super Admin] Failed to fetch organizations:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Super-admin IP recovery endpoints. Every operation is scoped to the
  // organization named in the URL so a locked-out company can be repaired.
  app.get("/api/super-admin/organizations/:organizationId/ip-whitelist", requireGlobalAdminAuth, async (req, res) => {
    const organization = await storage.getOrganization(req.params.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    const entries = await storage.getIpWhitelist(organization.id);
    res.json({ organizationId: organization.id, ipRestrictionEnabled: !!organization.ipRestrictionEnabled, entries });
  });

  app.post("/api/super-admin/organizations/:organizationId/ip-whitelist", requireGlobalAdminAuth, async (req, res) => {
    const organization = await storage.getOrganization(req.params.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    const canonicalAddress = canonicalizeWhitelistEntry(req.body?.ipAddress);
    if (!canonicalAddress) return res.status(400).json({ error: "Invalid IP address or CIDR range" });
    const entry = await storage.createIpWhitelistEntry({
      organizationId: organization.id,
      ipAddress: canonicalAddress,
      description: req.body?.description || null,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : true,
      createdDate: new Date().toISOString(),
      createdBy: req.session.globalAdmin!.id,
    });
    res.status(201).json(entry);
  });

  app.patch("/api/super-admin/organizations/:organizationId/ip-whitelist/:entryId", requireGlobalAdminAuth, async (req, res) => {
    const organization = await storage.getOrganization(req.params.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    const existing = await storage.getIpWhitelistEntry(req.params.entryId);
    if (!existing || existing.organizationId !== organization.id) {
      return res.status(404).json({ error: "IP whitelist entry not found" });
    }
    const updates: any = {};
    if (typeof req.body?.isActive === "boolean") updates.isActive = req.body.isActive;
    if (req.body?.description !== undefined) updates.description = req.body.description || null;
    if (req.body?.ipAddress !== undefined) {
      const canonicalAddress = canonicalizeWhitelistEntry(req.body.ipAddress);
      if (!canonicalAddress) return res.status(400).json({ error: "Invalid IP address or CIDR range" });
      updates.ipAddress = canonicalAddress;
    }
    if (organization.ipRestrictionEnabled && existing.isActive &&
        canonicalizeWhitelistEntry(existing.ipAddress) && updates.isActive === false) {
      const active = (await storage.getIpWhitelist(organization.id))
        .filter((item) => item.isActive && canonicalizeWhitelistEntry(item.ipAddress));
      if (active.length <= 1) {
        return res.status(409).json({ error: "Cannot disable the final active whitelist entry while IP restriction is enabled" });
      }
    }
    res.json(await storage.updateIpWhitelistEntry(existing.id, updates));
  });

  app.delete("/api/super-admin/organizations/:organizationId/ip-whitelist/:entryId", requireGlobalAdminAuth, async (req, res) => {
    const organization = await storage.getOrganization(req.params.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    const existing = await storage.getIpWhitelistEntry(req.params.entryId);
    if (!existing || existing.organizationId !== organization.id) {
      return res.status(404).json({ error: "IP whitelist entry not found" });
    }
    if (organization.ipRestrictionEnabled && existing.isActive &&
        canonicalizeWhitelistEntry(existing.ipAddress)) {
      const active = (await storage.getIpWhitelist(organization.id))
        .filter((item) => item.isActive && canonicalizeWhitelistEntry(item.ipAddress));
      if (active.length <= 1) {
        return res.status(409).json({ error: "Cannot delete the final active whitelist entry while IP restriction is enabled" });
      }
    }
    await storage.deleteIpWhitelistEntry(existing.id);
    res.json({ success: true });
  });

  app.patch("/api/super-admin/organizations/:organizationId/ip-restriction", requireGlobalAdminAuth, async (req, res) => {
    const organization = await storage.getOrganization(req.params.organizationId);
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }
    if (req.body.enabled) {
      const active = (await storage.getIpWhitelist(organization.id))
        .filter((entry) => entry.isActive && canonicalizeWhitelistEntry(entry.ipAddress));
      if (active.length === 0) {
        return res.status(409).json({ error: "Add at least one active valid whitelist entry before enabling restriction" });
      }
    }
    const updated = await storage.updateOrganization(organization.id, { ipRestrictionEnabled: req.body.enabled });
    res.json({ organizationId: organization.id, ipRestrictionEnabled: !!updated?.ipRestrictionEnabled });
  });

  // Super Admin - Toggle organization active status
  app.patch("/api/super-admin/organizations/:id/toggle", requireGlobalAdminAuth, async (req, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      const updated = await storage.updateOrganization(req.params.id, { isActive: !org.isActive });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle organization status" });
    }
  });

  app.patch("/api/super-admin/organizations/:id/set-subscription", requireGlobalAdminAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["active", "trial", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid subscription status" });
      }
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      const updated = await storage.updateOrganization(req.params.id, {
        subscriptionStatus: status,
        isActive: true,
      });
      console.log(`[Super Admin] Set org ${req.params.id} subscription to: ${status}`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update subscription status" });
    }
  });

  // Super Admin - Grant one free month and ensure the organization remains connected
  app.patch("/api/super-admin/organizations/:id/grant-free-month", requireGlobalAdminAuth, async (req, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const today = new Date();
      const extensionBase = org.billingStartDate ? new Date(org.billingStartDate) : today;
      const extensionStart = extensionBase > today ? extensionBase : today;
      const nextBillingStart = new Date(extensionStart);
      nextBillingStart.setMonth(nextBillingStart.getMonth() + 1);

      const updated = await storage.updateOrganization(req.params.id, {
        isActive: true,
        firstMonthFree: true,
        subscriptionStatus: "trial",
        trialEndDate: nextBillingStart.toISOString().split("T")[0],
        billingStartDate: nextBillingStart.toISOString().split("T")[0],
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to grant free month" });
    }
  });

  // Super Admin - Create new organization with admin
  app.post("/api/super-admin/organizations", requireGlobalAdminAuth, async (req, res) => {
    try {
      const { name, slug, email, phone, plan, firstMonthFree, adminName, adminEmail, adminPassword } = req.body;
      
      if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate plan is one of the allowed values
      const validPlans = ["starter", "growth", "agency"];
      const selectedPlan = validPlans.includes(plan) ? plan : "starter";

      // Check if slug already exists
      const existingOrgs = await storage.getOrganizations();
      if (existingOrgs.some(o => o.slug === slug)) {
        return res.status(400).json({ error: "Organization slug already exists" });
      }

      // Calculate seat limit based on plan
      const seatLimits: Record<string, number> = { starter: 4, growth: 15, agency: 40 };
      const seatLimit = seatLimits[selectedPlan] || 4;

      // Calculate trial end date (2 weeks from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // Calculate billing start date
      const billingStartDate = new Date();
      if (firstMonthFree) {
        billingStartDate.setMonth(billingStartDate.getMonth() + 1);
      }

      // Create organization
      const org = await storage.createOrganization({
        name,
        slug,
        email: email || null,
        phone: phone || null,
        createdDate: new Date().toISOString().split('T')[0],
        isActive: true,
        subscriptionPlan: selectedPlan,
        subscriptionStatus: "trial",
        trialEndDate: trialEndDate.toISOString().split('T')[0],
        billingStartDate: billingStartDate.toISOString().split('T')[0],
        firstMonthFree: firstMonthFree || false,
        seatLimit,
      });

      // Create admin collector for this organization
      await storage.createCollector({
        organizationId: org.id,
        name: adminName,
        email: adminEmail,
        username: adminEmail,
        password: await hashPassword(adminPassword),
        role: "admin",
        status: "active",
        avatarInitials: adminName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        goal: 0,
        hourlyWage: 0,
        canViewDashboard: true,
        canViewEmail: true,
        canViewPaymentRunner: true,
      });

      res.json(org);
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      res.status(500).json({ error: error.message || "Failed to create organization" });
    }
  });

  // Super Admin - Create new super admin
  app.post("/api/super-admin/admins", requireGlobalAdminAuth, async (req, res) => {
    try {
      const { username, email, password, name } = req.body;
      
      if (!username || !password || !name) {
        return res.status(400).json({ error: "Username, password, and name are required" });
      }

      const existingAdmin = await storage.getGlobalAdminByUsername(username);
      if (existingAdmin) {
        return res.status(400).json({ error: "Admin with this username already exists" });
      }

      const admin = await storage.createGlobalAdmin({
        username,
        email: email || null,
        password: await hashPassword(password),
        name,
        createdDate: new Date().toISOString().split("T")[0],
        isActive: true,
      });

      res.status(201).json({
        id: admin.id,
        username: admin.username,
        name: admin.name,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create super admin" });
    }
  });

  // Admin Notifications API (for super admins)
  app.get("/api/super-admin/notifications", requireGlobalAdminAuth, async (_req, res) => {
    try {
      const notifications = await storage.getAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/super-admin/notifications/unread", requireGlobalAdminAuth, async (_req, res) => {
    try {
      const notifications = await storage.getUnreadAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.patch("/api/super-admin/notifications/:id/read", requireGlobalAdminAuth, async (req, res) => {
    try {
      const notification = await storage.markAdminNotificationRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/super-admin/notifications/mark-all-read", requireGlobalAdminAuth, async (_req, res) => {
    try {
      await storage.markAllAdminNotificationsRead();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Super Admin Email Settings API
  const SUPER_ADMIN_ORG_ID = "system-super-admin";

  app.get("/api/super-admin/email-settings", requireGlobalAdminAuth, async (_req, res) => {
    try {
      const settings = await getSuperAdminEmailSettings();
      if (settings) {
        const { smtpPassword, postmarkServerToken, ...safeSettings } = settings;
        res.json({
          ...safeSettings,
          hasPassword: !!smtpPassword,
          hasPostmarkToken: !!postmarkServerToken || !!process.env.POSTMARK_SERVER_TOKEN,
        });
      } else {
        res.json({ hasPostmarkToken: !!process.env.POSTMARK_SERVER_TOKEN });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email settings" });
    }
  });

  app.post("/api/super-admin/email-settings", requireGlobalAdminAuth, async (req, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, postmarkServerToken, fromEmail, fromName, notificationEmail, isActive } = req.body;

      const existing = await getSuperAdminEmailSettings();

      if (existing) {
        const updateData: any = {
          smtpHost,
          smtpPort: smtpPort ? parseInt(smtpPort) : 587,
          smtpUser,
          smtpSecure: smtpSecure ?? false,
          fromEmail,
          fromName,
          notificationEmail,
          isActive: isActive ?? false,
        };
        if (smtpPassword) {
          updateData.smtpPassword = smtpPassword;
        }
        if (postmarkServerToken) {
          updateData.postmarkServerToken = postmarkServerToken;
        }

        await db.update(emailSettings)
          .set(updateData)
          .where(eq(emailSettings.organizationId, SUPER_ADMIN_ORG_ID));
      } else {
        await db.insert(emailSettings).values({
          organizationId: SUPER_ADMIN_ORG_ID,
          smtpHost,
          smtpPort: smtpPort ? parseInt(smtpPort) : 587,
          smtpUser,
          smtpPassword: smtpPassword || "",
          smtpSecure: smtpSecure ?? false,
          postmarkServerToken: postmarkServerToken || "",
          fromEmail,
          fromName,
          notificationEmail,
          isActive: isActive ?? false,
        });
      }

      res.json({ success: true, message: "Email settings saved" });
    } catch (error) {
      console.error("Failed to save email settings:", error);
      res.status(500).json({ error: "Failed to save email settings" });
    }
  });

  app.post("/api/super-admin/email-settings/test", requireGlobalAdminAuth, async (req, res) => {
    try {
      const { sendNewOrgNotificationEmail } = await import("./email");
      const result = await sendNewOrgNotificationEmail(
        "Test Company",
        "Test User",
        "test@example.com",
        "(555) 000-0000"
      );
      if (result.success) {
        res.json({ success: true, message: "Test email sent successfully" });
      } else {
        res.json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


  app.get("/api/payment-message-automation", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage payment message automation" });
      }
      const orgId = getOrgId(req);
      const organization = await storage.getOrganization(orgId);
      if (!organization) return res.status(404).json({ error: "Organization not found" });
      res.json(getPaymentMessageAutomationSettings(organization));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment message automation settings" });
    }
  });

  app.post("/api/payment-message-automation", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage payment message automation" });
      }
      const orgId = getOrgId(req);
      const organization = await storage.getOrganization(orgId);
      if (!organization) return res.status(404).json({ error: "Organization not found" });

      const clean = {
        enabled: Boolean(req.body.enabled),
        sendDeclineEmail: Boolean(req.body.sendDeclineEmail),
        sendDeclineSms: Boolean(req.body.sendDeclineSms),
        sendReceiptEmail: Boolean(req.body.sendReceiptEmail),
        sendReceiptSms: Boolean(req.body.sendReceiptSms),
        callbackPhone: String(req.body.callbackPhone || "").trim(),
        callbackEmail: String(req.body.callbackEmail || "").trim(),
        logoUrl: String(req.body.logoUrl || "").trim(),
      };

      const updated = await storage.updateOrganization(orgId, {
        settings: mergePaymentMessageAutomationSettings(organization, clean),
      });
      res.json(getPaymentMessageAutomationSettings(updated || organization));
    } catch (error) {
      res.status(500).json({ error: "Failed to save payment message automation settings" });
    }
  });

  // Per-organization email settings (recipient addresses for this org's
  // notifications/reports). Tenant isolated by organizationId. The system
  // Postmark transport handles delivery; orgs only choose where mail is sent.
  app.get("/api/email-settings", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage email settings" });
      }
      const orgId = getOrgId(req);
      const settings = await getOrgEmailSettings(orgId);
      res.json({
        notificationEmail: settings?.notificationEmail || "",
        isActive: settings?.isActive ?? false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email settings" });
    }
  });

  app.post("/api/email-settings", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage email settings" });
      }
      const orgId = getOrgId(req);
      const { notificationEmail, isActive } = req.body;

      const [existing] = await db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.organizationId, orgId))
        .limit(1);

      if (existing) {
        await db.update(emailSettings)
          .set({ notificationEmail: notificationEmail ?? "", isActive: isActive ?? false })
          .where(eq(emailSettings.organizationId, orgId));
      } else {
        await db.insert(emailSettings).values({
          organizationId: orgId,
          notificationEmail: notificationEmail ?? "",
          isActive: isActive ?? false,
        });
      }

      res.json({ success: true, message: "Email settings saved" });
    } catch (error) {
      console.error("Failed to save org email settings:", error);
      res.status(500).json({ error: "Failed to save email settings" });
    }
  });

  // Organization Billing API (Stripe for Debt Manager Pro subscriptions)
  app.post("/api/billing/webhook", async (req: any, res) => {
    try {
      const signature = req.headers["stripe-signature"];
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!signature || typeof signature !== "string" || !secret) {
        return res.status(400).json({ error: "Stripe webhook is not configured" });
      }
      const event = await handleWebhookEvent(req.rawBody as Buffer, signature, secret);
      if (event.organizationId && event.subscriptionStatus) {
        await storage.updateOrganization(event.organizationId, {
          subscriptionStatus: event.subscriptionStatus,
          isActive: event.subscriptionStatus !== "cancelled",
        });
      }
      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: "Invalid Stripe webhook" });
    }
  });

  app.get("/api/billing/plans", async (_req, res) => {
    try {
      const prices = getSubscriptionPrices();
      res.json({
        plans: [
          { id: "starter", name: "Starter", price: prices.starter.price, seats: prices.starter.seats },
          { id: "growth", name: "Growth", price: prices.growth.price, seats: prices.growth.seats },
          { id: "agency", name: "Agency", price: prices.agency.price, seats: prices.agency.seats },
        ],
        configured: isStripeConfigured(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch billing plans" });
    }
  });

  app.post("/api/billing/subscribe", async (req, res) => {
    try {
      const { plan } = req.body;
      const orgId = getOrgId(req);

      if (!orgId || !plan) {
        return res.status(400).json({ error: "Missing required billing information" });
      }

      if (!["starter", "growth", "agency"].includes(plan)) {
        return res.status(400).json({ error: "Invalid subscription plan" });
      }

      const organization = await storage.getOrganization(orgId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const seatLimits: Record<string, number> = { starter: 4, growth: 15, agency: 40 };

      if (!isStripeConfigured()) {
        if (process.env.NODE_ENV === "production") {
          return res.status(503).json({
            error: "Platform billing is unavailable because the global Stripe account is not configured",
          });
        }
        await storage.updateOrganization(orgId, { 
          isActive: true,
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          billingStartDate: new Date().toISOString().split("T")[0],
          seatLimit: seatLimits[plan] || 4,
        });
        return res.json({
          success: true,
          message: "Subscription activated (development demo mode)",
          plan,
          transactionId: `DEMO-${Date.now()}`,
        });
      }

      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.headers.host}`;

      const checkoutUrl = await createCheckoutSession(
        orgId,
        plan as 'starter' | 'growth' | 'agency',
        `${baseUrl}/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/subscribe?canceled=true`,
        organization.email,
      );

      res.json({
        success: true,
        checkoutUrl,
      });
    } catch (error) {
      console.error("Subscription billing error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/billing/checkout-success", async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ error: "Missing session_id" });
      }

      const callerOrgId = getOrgId(req);
      const result = await verifyCheckoutSession(sessionId);
      if (!result.success || !result.organizationId || !result.plan) {
        return res.status(400).json({ error: "Payment not completed" });
      }

      if (result.organizationId !== callerOrgId) {
        return res.status(403).json({ error: "Organization mismatch" });
      }

      const seatLimits: Record<string, number> = { starter: 4, growth: 15, agency: 40 };

      await storage.updateOrganization(result.organizationId, {
        isActive: true,
        subscriptionPlan: result.plan,
        subscriptionStatus: "active",
        billingStartDate: new Date().toISOString().split("T")[0],
        seatLimit: seatLimits[result.plan] || 4,
      });

      res.json({
        success: true,
        plan: result.plan,
        message: "Subscription activated successfully",
      });
    } catch (error) {
      console.error("Checkout verification error:", error);
      res.status(500).json({ error: "Failed to verify checkout session" });
    }
  });

  app.get("/api/billing/status", async (req, res) => {
    try {
      res.json({
        configured: isStripeConfigured(),
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch billing status" });
    }
  });

  // API Token Management (org-scoped)
  app.get("/api/settings/tokens", requireAuth, async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const tokens = await storage.getApiTokensByOrg(orgId);
      // Only user-created integration keys belong in the settings list. Older
      // versions created an expiring session-token row on every Chain login;
      // hiding those internal credentials prevents them from looking like API
      // keys that are being replaced each day.
      const integrationKeys = tokens.filter((t) => t.token.startsWith("dmv2_"));
      // Return masked tokens — full value only revealed at creation
      res.json(integrationKeys.map((t) => ({
        id: t.id,
        name: t.name,
        tokenMasked: `${t.token.slice(0, 10)}${"*".repeat(20)}`,
        isActive: t.isActive,
        createdDate: t.createdDate,
        lastUsedDate: t.lastUsedDate,
        expiresAt: t.expiresAt,
        organizationId: t.organizationId,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API tokens" });
    }
  });

  app.post("/api/settings/tokens", requireAuth, async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { name, expiresAt } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Token name is required" });
      }
      const { randomBytes } = await import("crypto");
      const rawToken = `dmv2_${randomBytes(32).toString("hex")}`;
      const token = await storage.createApiToken({
        name: name.trim(),
        token: rawToken,
        organizationId: orgId,
        isActive: true,
        createdDate: new Date().toISOString(),
        lastUsedDate: null,
        expiresAt: expiresAt && typeof expiresAt === "string" ? expiresAt : null,
        permissions: null,
      });
      // Return full token only on creation — this is the one-time reveal
      res.json({
        id: token.id,
        name: token.name,
        token: rawToken,
        isActive: token.isActive,
        createdDate: token.createdDate,
        lastUsedDate: token.lastUsedDate,
        expiresAt: token.expiresAt,
        organizationId: token.organizationId,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create API token" });
    }
  });

  app.delete("/api/settings/tokens/:id", requireAuth, async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { id } = req.params;
      const deleted = await storage.deleteApiTokenByOrg(id, orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Token not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete API token" });
    }
  });

  // Get organization subscription status
  app.get("/api/billing/subscription", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const org = await storage.getOrganization(orgId);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const today = new Date();
      const trialEndDate = org.trialEndDate ? new Date(org.trialEndDate) : null;
      const billingStartDate = org.billingStartDate ? new Date(org.billingStartDate) : null;
      const accessEndDate = trialEndDate && billingStartDate
        ? (trialEndDate > billingStartDate ? trialEndDate : billingStartDate)
        : (billingStartDate || trialEndDate);
      const isTrialExpired = org.subscriptionStatus === "trial" && accessEndDate ? today > accessEndDate : false;
      const daysRemaining = accessEndDate
        ? Math.max(0, Math.ceil((accessEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      res.json({
        plan: org.subscriptionPlan || "starter",
        status: org.subscriptionStatus || "trial",
        trialEndDate: org.trialEndDate,
        billingStartDate: org.billingStartDate,
        isTrialExpired,
        daysRemaining,
        seatLimit: org.seatLimit || 4,
        firstMonthFree: org.firstMonthFree || false,
        isActive: org.isActive,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const clients = await storage.getClients(orgId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      // Validate org ownership
      if (!validateOrgOwnership(client.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const client = await storage.createClient({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getClient(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Client not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const client = await storage.updateClient(req.params.id, req.body);
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getClient(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Client not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteClient(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Fee Schedule routes
  app.get("/api/fee-schedules", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const feeSchedules = await storage.getFeeSchedules(orgId);
      res.json(feeSchedules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fee schedules" });
    }
  });

  app.get("/api/fee-schedules/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const feeSchedule = await storage.getFeeSchedule(req.params.id);
      if (!feeSchedule) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      if (!validateOrgOwnership(feeSchedule.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fee schedule" });
    }
  });

  app.post("/api/fee-schedules", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const feeSchedule = await storage.createFeeSchedule({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to create fee schedule" });
    }
  });

  app.patch("/api/fee-schedules/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getFeeSchedule(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      const feeSchedule = await storage.updateFeeSchedule(req.params.id, body);
      if (!feeSchedule) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update fee schedule" });
    }
  });

  app.delete("/api/fee-schedules/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getFeeSchedule(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteFeeSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete fee schedule" });
    }
  });

  app.get("/api/collectors", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const allCollectors = await storage.getCollectors();
      // Filter to only return collectors from the authenticated user's organization
      const orgCollectors = allCollectors.filter(c => c.organizationId === orgId);
      res.json(orgCollectors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collectors" });
    }
  });

  // Collector performance stats for dashboard - must be before :id route
  app.get("/api/collectors/performance", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const allCollectors = await storage.getCollectors();
      const allPayments = await storage.getPayments();
      
      // Filter by organization
      const collectors = allCollectors.filter(c => c.organizationId === orgId);
      const orgPayments = allPayments.filter(p => p.organizationId === orgId);
      
      // Get current month and next month date ranges
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
      
      const performanceData = collectors.map((collector) => {
        // Get payments processed by this collector
        const collectorPayments = orgPayments.filter(p => p.processedBy === collector.id);
        
        // Payments before start of current month (start of month baseline)
        const beforeMonthPayments = collectorPayments.filter(p => {
          if (!p.paymentDate) return false;
          const paymentDate = p.paymentDate.split('T')[0];
          return paymentDate < currentMonthStart;
        });
        
        // All payments up to today (current totals)
        const allTimePayments = collectorPayments.filter(p => {
          if (!p.paymentDate) return false;
          const paymentDate = p.paymentDate.split('T')[0];
          return paymentDate <= today;
        });
        
        // Next month scheduled payments from post dates
        const nextMonthPending = orgPayments.filter(p => {
          if (p.nextPaymentDate && p.processedBy === collector.id) {
            const nextDate = p.nextPaymentDate.split('T')[0];
            return nextDate >= nextMonthStart && nextDate <= nextMonthEnd;
          }
          return false;
        });
        
        // Start of month baseline (posted + pending combined)
        const somPending = beforeMonthPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
        const somPosted = beforeMonthPayments.filter(p => p.status === 'posted' || p.status === 'processed').reduce((sum, p) => sum + p.amount, 0);
        const somTotal = somPosted + somPending;
        
        // Current totals (posted + pending combined)
        const currentPending = allTimePayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
        const currentPosted = allTimePayments.filter(p => p.status === 'posted' || p.status === 'processed').reduce((sum, p) => sum + p.amount, 0);
        const currentTotal = currentPosted + currentPending;
        
        // Declined and reversed (payments removed from pending/posted)
        const totalDeclined = allTimePayments.filter(p => p.status === 'declined').reduce((sum, p) => sum + p.amount, 0);
        const totalReversed = allTimePayments.filter(p => p.status === 'reversed').reduce((sum, p) => sum + p.amount, 0);
        
        // New money = difference between current total and start of month total
        const newMoney = currentTotal - somTotal;
        
        // Next month pending total
        const nextMonthPendingTotal = nextMonthPending.reduce((sum, p) => sum + p.amount, 0);
        
        return {
          id: collector.id,
          name: collector.name,
          role: collector.role,
          // Start of month (posted + pending)
          somTotal,
          // Current (posted + pending)
          currentTotal,
          currentPending,
          currentPosted,
          // New money this month
          newMoney,
          // Declined and reversed
          totalDeclined,
          totalReversed,
          // Next month
          nextMonthPending: nextMonthPendingTotal,
          // Goals
          currentMonthGoal: collector.goal || 0,
          goalProgress: collector.goal ? Math.round((newMoney / collector.goal) * 100) : 0,
        };
      });
      
      res.json(performanceData);
    } catch (error) {
      console.error("Failed to fetch collector performance:", error);
      res.status(500).json({ error: "Failed to fetch collector performance" });
    }
  });

  app.get("/api/collectors/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const collector = await storage.getCollector(req.params.id);
      if (!collector) {
        return res.status(404).json({ error: "Collector not found" });
      }
      if (!validateOrgOwnership(collector.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collector" });
    }
  });

  app.post("/api/collectors", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const body = { ...req.body };
      if (!body.username || !String(body.username).trim()) {
        return res.status(400).json({ error: "Username is required" });
      }
      body.username = String(body.username).trim();
      const existing = await storage.getCollectorByOrgAndUsername(orgId, body.username);
      if (existing) {
        return res.status(409).json({ error: "A collector with that username already exists in your organization" });
      }
      if (body.password && !body.password.startsWith("$2")) {
        body.password = await hashPassword(body.password);
      }
      const collector = await storage.createCollector({
        ...body,
        organizationId: orgId,
      });
      res.status(201).json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to create collector" });
    }
  });

  app.patch("/api/collectors/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getCollector(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Collector not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      if (body.username !== undefined) {
        body.username = String(body.username).trim();
        if (!body.username) {
          return res.status(400).json({ error: "Username cannot be empty" });
        }
        if (body.username !== existing.username) {
          const dup = await storage.getCollectorByOrgAndUsername(existing.organizationId, body.username);
          if (dup && dup.id !== existing.id) {
            return res.status(409).json({ error: "A collector with that username already exists in your organization" });
          }
        }
      }
      if (body.password && !body.password.startsWith("$2")) {
        body.password = await hashPassword(body.password);
      }
      delete body.organizationId;
      const collector = await storage.updateCollector(req.params.id, body);
      if (!collector) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to update collector" });
    }
  });

  app.delete("/api/collectors/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getCollector(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Collector not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteCollector(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete collector" });
    }
  });

  app.get("/api/portfolios", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const allPortfolios = await storage.getPortfolios();
      // Filter to only return portfolios from the authenticated user's organization
      const orgPortfolios = allPortfolios.filter(p => p.organizationId === orgId);
      res.json(orgPortfolios);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  app.get("/api/portfolios/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      if (!validateOrgOwnership(portfolio.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolios", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const portfolio = await storage.createPortfolio({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to create portfolio" });
    }
  });

  app.patch("/api/portfolios/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getPortfolio(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      const portfolio = await storage.updatePortfolio(req.params.id, body);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to update portfolio" });
    }
  });

  app.delete("/api/portfolios/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getPortfolio(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deletePortfolio(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete portfolio" });
    }
  });

  app.get("/api/debtors", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { portfolioId, collectorId } = req.query;
      const allDebtors = await storage.getDebtors(
        portfolioId as string | undefined,
        collectorId as string | undefined
      );
      // Filter to only return debtors from the authenticated user's organization
      const orgDebtors = allDebtors.filter(d => d.organizationId === orgId);
      res.json(orgDebtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debtors" });
    }
  });

  app.get("/api/debtors/recent", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const limit = parseInt(req.query.limit as string) || 10;
      const debtors = await storage.getRecentDebtors(limit, orgId);
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent debtors" });
    }
  });

  app.get("/api/debtors/search", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const query = (req.query.q as string) || "";
      if (!query.trim()) {
        return res.json([]);
      }
      const debtors = await storage.searchDebtors(query, orgId);
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to search debtors" });
    }
  });

  app.get("/api/debtors/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debtor" });
    }
  });

  app.post("/api/debtors", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      if (req.body.assignedCollectorId) {
        const target = await storage.getCollector(req.body.assignedCollectorId);
        if (!target || !validateOrgOwnership(target.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid collector" });
        }
        if (target.role === "auditor") {
          return res.status(400).json({ error: "Auditors cannot be assigned accounts" });
        }
      }
      const debtor = await storage.createDebtor({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to create debtor" });
    }
  });

  app.patch("/api/debtors/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getDebtor(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (req.body.assignedCollectorId) {
        const target = await storage.getCollector(req.body.assignedCollectorId);
        if (!target || !validateOrgOwnership(target.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid collector" });
        }
        if (target.role === "auditor") {
          return res.status(400).json({ error: "Auditors cannot be assigned accounts" });
        }
      }
      const debtor = await storage.updateDebtor(req.params.id, req.body);
      res.json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to update debtor" });
    }
  });

  app.delete("/api/debtors/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getDebtor(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteDebtor(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete debtor" });
    }
  });

  app.get("/api/debtors/:id/contacts", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      const contacts = await storage.getDebtorContacts(req.params.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/debtors/:id/contacts", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      const contact = await storage.createDebtorContact({
        ...req.body,
        debtorId: req.params.id,
        organizationId: orgId,
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getDebtorContact(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Contact not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      const contact = await storage.updateDebtorContact(req.params.id, body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.get("/api/debtors/:id/employment", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      const records = await storage.getEmploymentRecords(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employment records" });
    }
  });

  app.post("/api/debtors/:id/employment", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      const record = await storage.createEmploymentRecord({
        ...req.body,
        debtorId: req.params.id,
        organizationId: orgId,
      });
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create employment record" });
    }
  });

  app.patch("/api/employment/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getEmploymentRecord(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      const record = await storage.updateEmploymentRecord(req.params.id, body);
      if (!record) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employment record" });
    }
  });

  app.get("/api/debtors/:id/references", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      const references = await storage.getDebtorReferences(req.params.id);
      res.json(references);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch references" });
    }
  });

  app.post("/api/debtors/:id/references", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      const reference = await storage.createDebtorReference({
        ...req.body,
        debtorId: req.params.id,
        addedDate: new Date().toISOString().split("T")[0],
        organizationId: orgId,
      });
      res.status(201).json(reference);
    } catch (error) {
      res.status(500).json({ error: "Failed to create reference" });
    }
  });

  app.patch("/api/references/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getDebtorReference(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Reference not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      const reference = await storage.updateDebtorReference(req.params.id, body);
      if (!reference) {
        return res.status(404).json({ error: "Reference not found" });
      }
      res.json(reference);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reference" });
    }
  });

  app.delete("/api/references/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getDebtorReference(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Reference not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteDebtorReference(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Reference not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reference" });
    }
  });

  app.get("/api/debtors/:id/bank-accounts", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const accounts = await storage.getBankAccounts(req.params.id);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank accounts" });
    }
  });

  app.post("/api/debtors/:id/bank-accounts", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const account = await storage.createBankAccount({
        ...req.body,
        debtorId: req.params.id,
        organizationId: orgId,
      });
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to create bank account" });
    }
  });

  app.get("/api/debtors/:id/cards", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const cards = await storage.getPaymentCards(req.params.id);
      res.json(cards.filter(card => card.organizationId === orgId).map(redactPaymentCard));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment cards" });
    }
  });

  app.post("/api/debtors/:id/cards", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const panValue = typeof req.body.cardNumber === "string" ? req.body.cardNumber : "";
      const { digits: pan, malformed } = normalizeCardNumber(panValue);
      const network = detectCardNetwork(pan);
      const networkType: Record<string, string> = {
        Visa: "visa",
        Mastercard: "mastercard",
        "American Express": "amex",
        Discover: "discover",
      };
      const expectedLengths: Record<string, number[]> = {
        Visa: [13, 16, 19],
        Mastercard: [16],
        "American Express": [15],
        Discover: [16, 19],
      };
      if (malformed || network === "Unknown" || !expectedLengths[network].includes(pan.length) || !passesLuhn(pan)) {
        return res.status(400).json({ error: "Invalid card number" });
      }
      if (req.body.cardType && req.body.cardType !== networkType[network]) {
        return res.status(400).json({ error: "Card network does not match card number" });
      }
      const cvv = typeof req.body.cvv === "string" ? req.body.cvv : "";
      const cvvLength = network === "American Express" ? 4 : 3;
      if (!new RegExp(`^\\d{${cvvLength}}$`).test(cvv)) {
        return res.status(400).json({ error: "Invalid security code" });
      }
      const expiryMonth = String(req.body.expiryMonth || "").padStart(2, "0");
      let expiryYear = String(req.body.expiryYear || "");
      if (/^\d{2}$/.test(expiryYear)) expiryYear = `20${expiryYear}`;
      if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth) || !/^\d{4}$/.test(expiryYear)) {
        return res.status(400).json({ error: "Invalid expiration date" });
      }
      const expiration = new Date(Number(expiryYear), Number(expiryMonth), 0, 23, 59, 59);
      if (expiration < new Date()) return res.status(400).json({ error: "Card is expired" });
      const cardholderName = typeof req.body.cardholderName === "string" ? req.body.cardholderName.trim() : "";
      if (cardholderName.length < 2 || cardholderName.length > 100 || !/^[A-Za-z][A-Za-z .,'-]+$/.test(cardholderName)) {
        return res.status(400).json({ error: "Invalid cardholder name" });
      }
      const billingZip = typeof req.body.billingZip === "string" ? req.body.billingZip.trim() : "";
      if (!/^\d{5}(?:-\d{4})?$/.test(billingZip)) {
        return res.status(400).json({ error: "A valid billing ZIP is required" });
      }
      const merchants = await storage.getMerchants(orgId);
      const merchant = merchants.find(item => item.isActive && (
        (item.processorType === "authorize_net" && item.authorizeNetApiLoginId && item.authorizeNetTransactionKey) ||
        (item.processorType === "stripe" && item.stripeSecretKey) ||
        (item.processorType === "nmi" && item.nmiSecurityKey) ||
        (item.processorType === "usaepay" && item.usaepaySourceKey)
      ));
      if (!merchant) return res.status(409).json({ error: "No active card processor is configured" });
      const existingCards = (await storage.getPaymentCards(req.params.id))
        .filter(card => card.organizationId === orgId);
      const existingCustomerId = existingCards.find(card =>
        card.processorType === merchant.processorType &&
        card.vaultStatus === "vaulted" &&
        card.processorCustomerId
      )?.processorCustomerId || undefined;
      const vaulted = await vaultCard(merchant, debtor, {
        pan,
        cvv,
        expiryMonth,
        expiryYear,
        cardholderName,
        billingZip,
      }, existingCustomerId);
      const vaultedCards = existingCards.filter(card => card.vaultStatus === "vaulted");
      const makeDefault = req.body.isDefault === true || vaultedCards.length === 0;
      if (makeDefault) {
        await Promise.all(existingCards.filter(card => card.isDefault)
          .map(card => storage.updatePaymentCard(card.id, { isDefault: false })));
      }
      const card = await storage.createPaymentCard({
        cardType: networkType[network],
        cardholderName,
        cardNumberLast4: pan.slice(-4),
        expiryMonth,
        expiryYear,
        billingZip,
        isDefault: makeDefault,
        ...vaulted,
        debtorId: req.params.id,
        addedDate: new Date().toISOString().split("T")[0],
        addedBy: req.session?.collector?.id || null,
        organizationId: orgId,
      });
      res.status(201).json(redactPaymentCard(card));
    } catch (error) {
      if (error instanceof CardVaultError) return res.status(422).json({ error: error.message });
      res.status(500).json({ error: "Failed to vault payment card" });
    }
  });

  app.delete("/api/cards/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getPaymentCard(req.params.id);
      if (!existing) return res.status(404).json({ error: "Payment card not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const success = await storage.deletePaymentCard(req.params.id);
      if (success) {
        // Preserve a usable default where possible. Legacy/unvaulted rows are
        // intentionally never promoted because the runner must refuse them.
        if (existing.isDefault) {
          const replacement = (await storage.getPaymentCards(existing.debtorId))
            .find(card => card.organizationId === orgId && card.vaultStatus === "vaulted");
          if (replacement) await storage.updatePaymentCard(replacement.id, { isDefault: true });
        }
        res.status(204).send();
      } else {
        res.status(404).json({ error: "Payment card not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payment card" });
    }
  });

  app.get("/api/debtors/:id/payments", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const payments = await storage.getPayments(req.params.id);
      res.json(redactPayments(payments));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/debtors/:id/payments", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const amount = Number(req.body.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: "Payment amount must be a positive whole number of cents" });
      }
      if (amount > debtor.currentBalance) {
        return res.status(400).json({ error: "Payment amount cannot exceed the current balance" });
      }
      try {
        rejectRawCardData(req.body);
      } catch {
        return res.status(400).json({ error: "Raw card data is not accepted by this endpoint" });
      }
      if (req.body.paymentMethod === "card") {
        if (typeof req.body.cardId !== "string" || !req.body.cardId) {
          return res.status(400).json({ error: "A saved vaulted card is required" });
        }
        const card = await storage.getPaymentCard(req.body.cardId);
        if (!card || card.organizationId !== orgId || card.debtorId !== debtor.id) {
          return res.status(400).json({ error: "Payment card does not belong to this debtor" });
        }
        if (card.vaultStatus !== "vaulted" || !card.processorToken || !card.processorType) {
          return res.status(409).json({ error: "Payment card is not vaulted and cannot be scheduled" });
        }
        const activeProcessor = (await storage.getMerchants(orgId)).find(item => item.isActive)?.processorType;
        if (activeProcessor !== card.processorType) {
          return res.status(409).json({ error: "Payment card is not vaulted with the active processor" });
        }
      }
      const idempotencyKey = String(req.get("Idempotency-Key") || req.body.idempotencyKey || crypto.randomUUID());
      if (idempotencyKey.length > 200) return res.status(400).json({ error: "Invalid idempotency key" });
      const existing = (await storage.getPaymentsForDebtor(req.params.id)).find(
        p => p.organizationId === orgId && p.idempotencyKey === idempotencyKey,
      );
      if (existing) return res.status(200).json(existing);
      let payment;
      try {
        const paymentBody = req.body.processNow === true
          ? { ...req.body, paymentDate: getPaymentBusinessDate() }
          : req.body;
        payment = await storage.createPayment(buildInternalPaymentInsert(paymentBody, {
          amount,
          debtorId: req.params.id,
          organizationId: orgId,
          idempotencyKey,
          processedBy: req.session?.collectorId ?? null,
        }));
      } catch (error: any) {
        // A concurrent request may win the unique-key race. Return that same
        // logical payment rather than surfacing an error or creating another.
        if (error?.code !== "23505") throw error;
        [payment] = await db.select().from(paymentsTable).where(and(
          eq(paymentsTable.organizationId, orgId),
          eq(paymentsTable.idempotencyKey, idempotencyKey),
        ));
        if (!payment) throw error;
      }

      if (req.body.processNow === true) {
        const today = getPaymentBusinessDate();
        if (payment.paymentMethod !== "card" || payment.paymentDate !== today) {
          return res.status(400).json({ error: "Pay Now requires a card payment dated today" });
        }
        const claimed = await claimPaymentForProcessing(payment.id, orgId, today);
        if (!claimed) return res.status(409).json({ error: "Payment is already being processed" });
        const result = await processPayment({ ...payment, status: "processing" }, storage, orgId);
        const responsePayment = result.updatedPayment ?? await storage.getPayment(payment.id);
        if (!responsePayment) return res.status(500).json({ error: "Processed payment could not be reloaded" });
        return res.status(201).json({
          ...redactPayment(responsePayment),
          declineReason: result.declineReason,
          transactionId: result.transactionId,
        });
      }

      // Scheduling a pending payment must not change the account balance.
      // The balance is applied exactly once when the processed payment posts.
      res.status(201).json(redactPayment(payment));
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.get("/api/debtors/:id/notes", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const notes = await storage.getNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/debtors/:id/notes", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (!validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const note = await storage.createNote({
        ...req.body,
        debtorId: req.params.id,
        organizationId: orgId,
      });
      res.status(201).json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.get("/api/payments/recent", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const limit = parseInt(req.query.limit as string) || 10;
      const payments = await storage.getRecentPayments(limit, orgId);
      res.json(redactPayments(payments));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent payments" });
    }
  });

  app.get("/api/payments/pending", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const payments = await storage.getPendingPayments(orgId);
      res.json(redactPayments(payments));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  });

  app.get("/api/payment-batches", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const batches = await storage.getPaymentBatches(orgId);
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment batches" });
    }
  });

  app.get("/api/payment-batches/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.getPaymentBatch(req.params.id);
      if (!batch || !validateOrgOwnership(batch.organizationId, orgId)) {
        return res.status(404).json({ error: "Payment batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment batch" });
    }
  });

  app.post("/api/payment-batches", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.createPaymentBatch({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment batch" });
    }
  });

  app.post("/api/payment-batches/:id/run", async (req, res) => {
    try {
      const orgId = getOrgId(req as any);
      const existing = await storage.getPaymentBatch(req.params.id);
      if (!existing) return res.status(404).json({ error: "Payment batch not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const batch = await storage.updatePaymentBatch(req.params.id, {
        status: "processing",
        scheduledDate: new Date().toISOString(),
      });
      if (!batch) {
        return res.status(404).json({ error: "Payment batch not found" });
      }
      
      setTimeout(async () => {
        await storage.updatePaymentBatch(req.params.id, {
          status: "completed",
          processedDate: new Date().toISOString(),
          successCount: batch.totalPayments ? Math.floor(batch.totalPayments * 0.9) : 0,
          failedCount: batch.totalPayments ? Math.ceil(batch.totalPayments * 0.1) : 0,
        });
      }, 5000);
      
      res.json(batch);
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to run payment batch" });
    }
  });

  app.get("/api/payment-batches/:id/payments", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.getPaymentBatch(req.params.id);
      if (!batch || !validateOrgOwnership(batch.organizationId, orgId)) {
        return res.status(404).json({ error: "Payment batch not found" });
      }
      const payments = await storage.getPayments(undefined, req.params.id);
      res.json(redactPayments(payments));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch batch payments" });
    }
  });

  app.post("/api/payment-batches/:id/add-payments", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { paymentIds } = req.body;
      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: "Payment IDs required" });
      }
      const existingBatch = await storage.getPaymentBatch(req.params.id);
      if (!existingBatch) return res.status(404).json({ error: "Payment batch not found" });
      if (!validateOrgOwnership(existingBatch.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      for (const pid of paymentIds) {
        const p = await storage.getPayment(pid);
        if (!p) return res.status(404).json({ error: `Payment ${pid} not found` });
        if (!validateOrgOwnership(p.organizationId, orgId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const batch = await storage.addPaymentsToBatch(req.params.id, paymentIds);
      res.json(batch);
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to add payments to batch" });
    }
  });

  app.get("/api/payment-runner/auto-status", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const org = await storage.getOrganization(orgId);
      const status = getAutoRunnerStatus();
      res.json({
        autoRunnerEnabled: org?.autoRunnerEnabled ?? false,
        autoRunnerHours: org?.autoRunnerHours ?? "7,18",
        isRunning: status.isRunning,
        lastRunTimestamp: status.lastRunTimestamp,
        lastRunResult: status.lastRunResult,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get auto-runner status" });
    }
  });

  app.post("/api/payment-runner/auto-trigger", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const collector = req.session.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can trigger auto-runner" });
      }
      console.log(`[Auto Runner] Manual trigger by ${collector.name} (org: ${orgId})`);
      // Manual trigger bypasses the org's autoRunnerEnabled toggle — the
      // explicit click by an authorized admin/manager is the authorization.
      const result = await runAutoPayments(orgId, { manualTrigger: true });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger auto-runner" });
    }
  });

  app.get("/api/liquidation/snapshots", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { portfolioId } = req.query;
      const snapshots = await storage.getLiquidationSnapshots(portfolioId as string | undefined, orgId);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch liquidation snapshots" });
    }
  });

  app.post("/api/liquidation/snapshots", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const snapshot = await storage.createLiquidationSnapshot({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(snapshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to create liquidation snapshot" });
    }
  });

  // Merchants API
  app.get("/api/merchants", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const merchants = await storage.getMerchants(orgId);
      res.json(merchants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch merchants" });
    }
  });

  app.get("/api/merchants/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      if (!validateOrgOwnership(merchant.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch merchant" });
    }
  });

  app.post("/api/merchants", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const processorType = String(req.body.processorType || "");
      const validProcessors = ["nmi", "usaepay", "authorize_net", "stripe"];
      if (!validProcessors.includes(processorType)) {
        return res.status(400).json({ error: "Unsupported payment processor" });
      }
      const configured =
        (processorType === "nmi" && req.body.nmiSecurityKey) ||
        (processorType === "usaepay" && req.body.usaepaySourceKey) ||
        (processorType === "authorize_net" && req.body.authorizeNetApiLoginId && req.body.authorizeNetTransactionKey) ||
        (processorType === "stripe" && req.body.stripeSecretKey);
      if (!configured) {
        return res.status(400).json({ error: `Required ${processorType} credentials are missing` });
      }
      if (req.body.isActive !== false) {
        const existingMerchants = await storage.getMerchants(orgId);
        await Promise.all(existingMerchants.filter((m) => m.isActive).map((m) => storage.updateMerchant(m.id, { isActive: false })));
      }
      const merchant = await storage.createMerchant({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to create merchant" });
    }
  });

  app.patch("/api/merchants/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getMerchant(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      if (body.isActive === true) {
        const merchants = await storage.getMerchants(orgId);
        await Promise.all(merchants.filter((m) => m.id !== existing.id && m.isActive).map((m) => storage.updateMerchant(m.id, { isActive: false })));
      }
      const merchant = await storage.updateMerchant(req.params.id, body);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to update merchant" });
    }
  });

  app.delete("/api/merchants/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getMerchant(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteMerchant(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete merchant" });
    }
  });

  // IP Whitelist API (organization-scoped)
  app.get("/api/ip-whitelist", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      if (!await isActiveAdminOrManager(req, orgId)) {
        return res.status(403).json({ error: "Active admin or manager access required" });
      }
      const whitelist = await storage.getIpWhitelist(orgId);
      res.json(whitelist);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IP whitelist" });
    }
  });

  app.post("/api/ip-whitelist", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { ipAddress, description, isActive } = req.body;
      if (!await isActiveAdminOrManager(req, orgId)) {
        return res.status(403).json({ error: "Active admin or manager access required" });
      }
      
      if (!ipAddress) {
        return res.status(400).json({ error: "IP address is required" });
      }

      const canonicalAddress = canonicalizeWhitelistEntry(ipAddress);
      if (!canonicalAddress) {
        return res.status(400).json({ error: "Invalid IP address or CIDR range" });
      }
      const creatorId = req.session.collector?.id;
      if (!creatorId) {
        return res.status(401).json({ error: "Collector authentication required" });
      }
      
      const entry = await storage.createIpWhitelistEntry({
        organizationId: orgId,
        ipAddress: canonicalAddress,
        description: description || null,
        isActive: typeof isActive === "boolean" ? isActive : true,
        createdDate: new Date().toISOString(),
        createdBy: creatorId,
      });
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Failed to add IP to whitelist:", error);
      res.status(500).json({ error: "Failed to add IP to whitelist" });
    }
  });

  app.patch("/api/ip-whitelist/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { id } = req.params;
      const { isActive, description, ipAddress } = req.body;
      if (!await isActiveAdminOrManager(req, orgId)) {
        return res.status(403).json({ error: "Active admin or manager access required" });
      }
      
      // Verify entry belongs to this organization
      const existing = await storage.getIpWhitelistEntry(id);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ error: "IP whitelist entry not found" });
      }
      
      const updates: any = {};
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (description !== undefined) updates.description = description || null;
      if (ipAddress !== undefined) {
        const canonicalAddress = canonicalizeWhitelistEntry(ipAddress);
        if (!canonicalAddress) {
          return res.status(400).json({ error: "Invalid IP address or CIDR range" });
        }
        updates.ipAddress = canonicalAddress;
      }
      const org = await storage.getOrganization(orgId);
      if (org?.ipRestrictionEnabled && existing.isActive &&
          canonicalizeWhitelistEntry(existing.ipAddress) && isActive === false) {
        const active = (await storage.getIpWhitelist(orgId))
          .filter((item) => item.isActive && canonicalizeWhitelistEntry(item.ipAddress));
        if (active.length <= 1) {
          return res.status(409).json({ error: "Cannot disable the final active whitelist entry while IP restriction is enabled" });
        }
      }
      const entry = await storage.updateIpWhitelistEntry(id, updates);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update IP whitelist entry" });
    }
  });

  app.delete("/api/ip-whitelist/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { id } = req.params;
      if (!await isActiveAdminOrManager(req, orgId)) {
        return res.status(403).json({ error: "Active admin or manager access required" });
      }
      
      // Verify entry belongs to this organization
      const existing = await storage.getIpWhitelistEntry(id);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ error: "IP whitelist entry not found" });
      }
      
      const org = await storage.getOrganization(orgId);
      if (org?.ipRestrictionEnabled && existing.isActive &&
          canonicalizeWhitelistEntry(existing.ipAddress)) {
        const active = (await storage.getIpWhitelist(orgId))
          .filter((item) => item.isActive && canonicalizeWhitelistEntry(item.ipAddress));
        if (active.length <= 1) {
          return res.status(409).json({ error: "Cannot delete the final active whitelist entry while IP restriction is enabled" });
        }
      }
      await storage.deleteIpWhitelistEntry(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete IP whitelist entry" });
    }
  });

  // Update organization IP restriction setting
  app.patch("/api/organization/ip-restriction", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { enabled } = req.body;
      if (!await isActiveAdminOrManager(req, orgId)) {
        return res.status(403).json({ error: "Active admin or manager access required" });
      }
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      if (enabled) {
        const active = (await storage.getIpWhitelist(orgId))
          .filter((entry) => entry.isActive && canonicalizeWhitelistEntry(entry.ipAddress));
        if (active.length === 0) {
          return res.status(409).json({ error: "Add at least one active valid IP address or CIDR range before enabling restriction" });
        }
      }
      
      const org = await storage.updateOrganization(orgId, { 
        ipRestrictionEnabled: enabled 
      });
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({ ipRestrictionEnabled: org.ipRestrictionEnabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to update IP restriction setting" });
    }
  });

  // Get organization IP restriction status
  app.get("/api/organization/ip-restriction", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      if (!await isActiveAdminOrManager(req, orgId)) {
        return res.status(403).json({ error: "Active admin or manager access required" });
      }
      const org = await storage.getOrganization(orgId);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({ ipRestrictionEnabled: org.ipRestrictionEnabled ?? false });
    } catch (error) {
      res.status(500).json({ error: "Failed to get IP restriction status" });
    }
  });

  app.patch("/api/organization/auto-runner", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { enabled, hours } = req.body;
      const updates: any = {};
      if (typeof enabled === "boolean") updates.autoRunnerEnabled = enabled;
      if (hours !== undefined) {
        // Accept array of numbers or comma-separated string; normalize to "h1,h2"
        const arr = Array.isArray(hours)
          ? hours
          : String(hours).split(",");
        const cleaned = arr
          .map((h: any) => parseInt(String(h).trim(), 10))
          .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 23);
        const unique = Array.from(new Set(cleaned)).sort((a, b) => a - b);
        updates.autoRunnerHours = unique.join(",");
      }
      const org = await storage.updateOrganization(orgId, updates);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      console.log(`[Auto Runner] Org ${orgId} updated:`, updates);
      res.json({
        autoRunnerEnabled: org.autoRunnerEnabled ?? false,
        autoRunnerHours: org.autoRunnerHours ?? "7,18",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update auto-runner setting" });
    }
  });

  app.get("/api/organization/auto-runner", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json({
        autoRunnerEnabled: org.autoRunnerEnabled ?? false,
        autoRunnerHours: org.autoRunnerHours ?? "7,18",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get auto-runner status" });
    }
  });

  // Time Clock API
  app.get("/api/time-clock", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { collectorId, date } = req.query;
      const entries = await storage.getTimeClockEntries(
        collectorId as string | undefined,
        date as string | undefined,
        orgId
      );
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time clock entries" });
    }
  });

  app.get("/api/time-clock/active/:collectorId", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const collector = await storage.getCollector(req.params.collectorId);
      if (!collector || !validateOrgOwnership(collector.organizationId, orgId)) {
        return res.status(404).json({ error: "Collector not found" });
      }
      const entry = await storage.getActiveTimeClockEntry(req.params.collectorId);
      res.json(entry || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active time clock entry" });
    }
  });

  app.post("/api/time-clock/clock-in", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { collectorId } = req.body;
      const collector = await storage.getCollector(collectorId);
      if (!collector || !validateOrgOwnership(collector.organizationId, orgId)) {
        return res.status(404).json({ error: "Collector not found" });
      }
      const existing = await storage.getActiveTimeClockEntry(collectorId);
      if (existing) {
        return res.status(400).json({ error: "Already clocked in" });
      }
      const entry = await storage.createTimeClockEntry({
        collectorId,
        clockIn: new Date().toISOString(),
        organizationId: orgId,
      });
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to clock in" });
    }
  });

  app.post("/api/time-clock/clock-out", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { collectorId } = req.body;
      const entry = await storage.getActiveTimeClockEntry(collectorId);
      if (!entry) {
        return res.status(400).json({ error: "Not clocked in" });
      }
      if (!validateOrgOwnership(entry.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const clockOut = new Date();
      const clockIn = new Date(entry.clockIn);
      const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const updated = await storage.updateTimeClockEntry(entry.id, {
        clockOut: clockOut.toISOString(),
        totalMinutes,
      });
      res.json(updated);
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  // Payments by date (for Payment Runner)
  app.get("/api/payments/by-date", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ error: "Date parameter required" });
      }
      const payments = await storage.getPaymentsByDate(date as string, orgId);
      res.json(redactPayments(payments));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments by date" });
    }
  });

  // Get all payments
  app.get("/api/payments", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const allPayments = await storage.getAllPayments();
      // Filter to only return payments from the authenticated user's organization
      const orgPayments = allPayments.filter(p => p.organizationId === orgId);
      res.json(redactPayments(orgPayments));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Process a single payment
  app.post("/api/payments/:id/process", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.organizationId !== orgId) {
        return res.status(403).json({ error: "Payment does not belong to this organization" });
      }

      if (["processed", "posted"].includes(payment.status)) {
        return res.json(redactPayment(payment));
      }
      const claimed = await claimPaymentForProcessing(payment.id, orgId, getPaymentBusinessDate());
      if (!claimed) return res.status(409).json({ error: "Payment is not due or is already being processed" });
      const result = await processPayment({ ...payment, status: "processing" }, storage, orgId);
      const responsePayment = result.updatedPayment ?? await storage.getPayment(payment.id);
      if (!responsePayment) return res.status(500).json({ error: "Processed payment could not be reloaded" });
      res.json({ ...redactPayment(responsePayment), declineReason: result.declineReason, transactionId: result.transactionId });
    } catch (error) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  app.post("/api/payments/:id/rerun", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.organizationId !== orgId) {
        return res.status(403).json({ error: "Payment does not belong to this organization" });
      }

      if (payment.status !== "declined") {
        return res.status(409).json({ error: "Only declined payments can be re-run" });
      }
      const claimed = await claimDeclinedPaymentForRerun(payment.id, orgId);
      if (!claimed) {
        return res.status(409).json({ error: "Payment is already being processed or is no longer declined" });
      }
      const result = await processPayment({ ...payment, status: "processing" }, storage, orgId);
      const responsePayment = result.updatedPayment ?? await storage.getPayment(payment.id);
      if (!responsePayment) return res.status(500).json({ error: "Processed payment could not be reloaded" });
      res.json({ ...redactPayment(responsePayment), declineReason: result.declineReason, transactionId: result.transactionId });
    } catch (error) {
      console.error("Payment rerun error:", error);
      res.status(500).json({ error: "Failed to re-run payment" });
    }
  });

  // Reverse a processed payment (admin/manager only)
  app.post("/api/payments/:id/reverse", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { reason } = req.body;

      // Authorization is derived from the live session collector record,
      // never the request body — stale/demoted/disabled sessions are rejected.
      if (!(await isActiveAdminOrManager(req, orgId))) {
        return res.status(403).json({ error: "Only admins and managers can reverse payments" });
      }

      const payment = await storage.getPayment(req.params.id);
      if (!payment || !validateOrgOwnership(payment.organizationId, orgId)) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Try to void the transaction with the organization's merchant if we have a transaction ID
      let voidedWithGateway = false;
      if (payment.notes) {
        const txnMatch = payment.notes.match(/\[TXN:\s*(\d+)\]/);
        if (txnMatch && txnMatch[1]) {
          const merchants = await storage.getMerchants(orgId);
          const activeMerchant = merchants.find(
            m => m.isActive && m.processorType === 'authorize_net' && m.authorizeNetApiLoginId && m.authorizeNetTransactionKey
          );
          if (activeMerchant) {
            const voidResult = await voidDebtorTransaction(
              {
                apiLoginId: activeMerchant.authorizeNetApiLoginId!,
                transactionKey: activeMerchant.authorizeNetTransactionKey!,
                testMode: activeMerchant.testMode ?? true,
              },
              txnMatch[1]
            );
            voidedWithGateway = voidResult.success;
          }
        }
      }

      // Reverse the payment
      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: "reversed",
        notes: `REVERSED: ${reason || "No reason provided"}${voidedWithGateway ? " (Voided with gateway)" : ""}`,
      });

      // Cancel all future scheduled payments for this debtor
      const allPayments = await storage.getPaymentsForDebtor(payment.debtorId);
      const futurePayments = allPayments.filter(
        (p) =>
          validateOrgOwnership(p.organizationId, orgId) &&
          p.status === "pending" &&
          new Date(p.paymentDate) > new Date()
      );
      
      for (const futurePayment of futurePayments) {
        await storage.updatePayment(futurePayment.id, {
          status: "cancelled",
          notes: `Cancelled due to payment reversal on ${new Date().toISOString().split("T")[0]}`,
        });
      }

      // Add note to debtor account
      await storage.createNote({
        debtorId: payment.debtorId,
        collectorId: payment.processedBy || "system",
        content: `Payment of $${(payment.amount / 100).toFixed(2)} REVERSED. Reason: ${reason || "No reason provided"}. ${futurePayments.length} future payment(s) cancelled.`,
        noteType: "payment",
        createdDate: new Date().toISOString().split("T")[0],
        organizationId: orgId,
      });

      if (!updatedPayment) return res.status(404).json({ error: "Payment not found" });
      res.json({ ...redactPayment(updatedPayment), cancelledPayments: futurePayments.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to reverse payment" });
    }
  });

  // Post a single processed payment (admin/manager only)
  app.post("/api/payments/:id/post", async (req, res) => {
    try {
      const orgId = getOrgId(req);

      // Authorization is derived from the live session collector record,
      // never the request body — stale/demoted/disabled sessions are rejected.
      if (!(await isActiveAdminOrManager(req, orgId))) {
        return res.status(403).json({ error: "Only admins and managers can post payments" });
      }

      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.organizationId !== orgId) {
        return res.status(403).json({ error: "Payment does not belong to this organization" });
      }

      const result = await postPaymentAtomically(payment.id, orgId);
      const postedPayment = await storage.getPayment(payment.id);
      if (!postedPayment) return res.status(404).json({ error: "Payment not found" });
      res.json({ ...redactPayment(postedPayment), alreadyPosted: result.alreadyPosted });
    } catch (error) {
      const status = (error as any)?.statusCode || 500;
      res.status(status).json({ error: status === 500 ? "Failed to post payment" : (error as Error).message });
    }
  });

  // Post all processed payments in bulk (admin/manager only)
  app.post("/api/payments/post-all-processed", async (req, res) => {
    try {
      const orgId = getOrgId(req);

      // Authorization is derived from the live session collector record,
      // never the request body — stale/demoted/disabled sessions are rejected.
      if (!(await isActiveAdminOrManager(req, orgId))) {
        return res.status(403).json({ error: "Only admins and managers can post payments" });
      }

      const payments = await storage.getPayments();
      const processedPayments = payments.filter((p) => p.organizationId === orgId && p.status === "processed");
      
      let count = 0;
      for (const payment of processedPayments) {
        const result = await postPaymentAtomically(payment.id, orgId);
        if (!result.alreadyPosted) count++;
      }

      res.json({ count, message: `${count} payments posted successfully` });
    } catch (error) {
      res.status(500).json({ error: "Failed to post payments" });
    }
  });



  // Reverse declined payments for one debtor and mark the account NSF
  app.post("/api/payments/:id/reverse-declined-account", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { reason } = req.body;
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.organizationId !== orgId) return res.status(403).json({ error: "Payment does not belong to this organization" });
      if (!["declined", "failed"].includes(payment.status)) return res.status(400).json({ error: "Only declined payments can be reversed this way" });

      const debtorPayments = (await storage.getPaymentsForDebtor(payment.debtorId)).filter((p) =>
        p.organizationId === orgId && ["pending", "declined", "failed"].includes(p.status)
      );
      for (const p of debtorPayments) {
        await storage.updatePayment(p.id, {
          status: "reversed",
          notes: `NSF REVERSED: ${reason || "Declined payment reversed from payment dashboard"}`,
        });
      }
      await storage.updateDebtor(payment.debtorId, { status: "nsf" });
      await storage.createNote({
        debtorId: payment.debtorId,
        collectorId: payment.processedBy || "system",
        content: `NSF reversal completed after declined payment. ${debtorPayments.length} pending/declined payment(s) reversed. Reason: ${reason || "No reason provided"}.`,
        noteType: "payment",
        createdDate: new Date().toISOString().split("T")[0],
        organizationId: orgId,
      });
      res.json({ reversedPayments: debtorPayments.length, debtorStatus: "nsf" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reverse declined account payments" });
    }
  });

  // Bulk reverse declined accounts older than a specified number of days
  app.post("/api/payments/reverse-declines", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const days = Math.max(0, Number(req.body.days ?? 0));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffDate = cutoff.toISOString().split("T")[0];
      const allPayments = (await storage.getAllPayments()).filter((p) => p.organizationId === orgId);
      const declined = allPayments.filter((p) => ["declined", "failed"].includes(p.status) && p.paymentDate <= cutoffDate);
      const debtorIds = Array.from(new Set(declined.map((p) => p.debtorId)));
      let reversedPayments = 0;
      for (const debtorId of debtorIds) {
        const debtorPayments = allPayments.filter((p) => p.debtorId === debtorId && ["pending", "declined", "failed"].includes(p.status));
        for (const p of debtorPayments) {
          await storage.updatePayment(p.id, { status: "reversed", notes: `NSF BULK REVERSED after ${days} day(s) in decline` });
          reversedPayments++;
        }
        await storage.updateDebtor(debtorId, { status: "nsf" });
        await storage.createNote({
          debtorId,
          collectorId: "system",
          content: `Bulk NSF reversal completed after ${days} day(s) in decline. ${debtorPayments.length} payment(s) reversed.`,
          noteType: "payment",
          createdDate: new Date().toISOString().split("T")[0],
          organizationId: orgId,
        });
      }
      res.json({ accountsReversed: debtorIds.length, reversedPayments, cutoffDate });
    } catch (error) {
      res.status(500).json({ error: "Failed to bulk reverse declined payments" });
    }
  });

  // Existing-account enrichment batches. Kept separate from normal account imports.
  app.post("/api/enrichment-batches", requireCollectorAuth, async (req: any, res) => {
    try { const org = getOrgId(req); if (!await isActiveAdminOrManager(req, org)) return res.status(403).json({ error: "Admin or manager permission required" }); res.status(201).json(await createEnrichmentBatch(org, req.session.collector.id, req.body)); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/enrichment-batches", requireCollectorAuth, async (req: any, res) => {
    const org = getOrgId(req); res.json(await db.select().from(enrichmentBatches).where(eq(enrichmentBatches.organizationId, org)).orderBy(desc(enrichmentBatches.createdAt)));
  });
  app.get("/api/enrichment-batches/:id/export", requireCollectorAuth, async (req: any, res) => {
    try { const org = getOrgId(req); if (!await isActiveAdminOrManager(req, org)) return res.status(403).json({ error: "Admin or manager permission required" }); res.json({ batchId: req.params.id, accounts: await exportBatch(org, req.params.id) }); }
    catch (e: any) { res.status(404).json({ error: e.message }); }
  });
  app.post("/api/enrichment-batches/:id/returns/preview", requireCollectorAuth, async (req: any, res) => {
    try { const org = getOrgId(req); if (!await isActiveAdminOrManager(req, org)) return res.status(403).json({ error: "Admin or manager permission required" }); if (!Array.isArray(req.body.rows)) return res.status(400).json({ error: "rows must be an array" }); res.json(await previewReturn(org, req.session.collector.id, req.params.id, req.body.rows, req.body.fileHash)); }
    catch (e: any) { res.status(409).json({ error: e.message }); }
  });
  app.post("/api/enrichment-batches/:id/returns/apply", requireCollectorAuth, async (req: any, res) => {
    try { const org = getOrgId(req); if (!await isActiveAdminOrManager(req, org)) return res.status(403).json({ error: "Admin or manager permission required" }); res.json(await applyReturn(org, req.session.collector.id, req.params.id)); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/enrichment-batches/:id/review", requireCollectorAuth, async (req: any, res) => {
    const org = getOrgId(req); res.json(await db.select().from(enrichmentBatchResults).where(and(eq(enrichmentBatchResults.organizationId, org), eq(enrichmentBatchResults.batchId, req.params.id))));
  });
  app.post("/api/enrichment-batches/:id/review/:resultId/link", requireCollectorAuth, async (req: any, res) => {
    const org = getOrgId(req); if (!await isActiveAdminOrManager(req, org)) return res.status(403).json({ error: "Admin or manager permission required" });
    const [member] = await db.select().from(enrichmentBatchMembers).where(and(eq(enrichmentBatchMembers.organizationId, org), eq(enrichmentBatchMembers.batchId, req.params.id), eq(enrichmentBatchMembers.debtorId, req.body.debtorId)));
    if (!member) return res.status(400).json({ error: "Account must be an existing member of this tenant's batch" });
    const [updated] = await db.update(enrichmentBatchResults).set({ debtorId: member.debtorId, status: "MATCHED", matchMethod: "MANUAL", manualOverride: true, processedBy: req.session.collector.id }).where(and(eq(enrichmentBatchResults.id, req.params.resultId), eq(enrichmentBatchResults.batchId, req.params.id), eq(enrichmentBatchResults.organizationId, org))).returning(); res.json(updated);
  });
  app.get("/api/debtors/:id/enrichment-history", requireCollectorAuth, async (req: any, res) => {
    const org = getOrgId(req); const debtor = await storage.getDebtor(req.params.id); if (!debtor || debtor.organizationId !== org) return res.status(404).json({ error: "Account not found" });
    res.json(await db.select({ batch: enrichmentBatches, member: enrichmentBatchMembers }).from(enrichmentBatchMembers).innerJoin(enrichmentBatches, eq(enrichmentBatches.id, enrichmentBatchMembers.batchId)).where(and(eq(enrichmentBatchMembers.organizationId, org), eq(enrichmentBatchMembers.debtorId, req.params.id))).orderBy(desc(enrichmentBatches.createdAt)));
  });
  app.get("/api/debtors/:id/enrichment-audit", requireCollectorAuth, async (req: any, res) => {
    const org = getOrgId(req); res.json(await db.select().from(enrichmentAuditLog).where(and(eq(enrichmentAuditLog.organizationId, org), eq(enrichmentAuditLog.debtorId, req.params.id))).orderBy(desc(enrichmentAuditLog.createdAt)));
  });

  // Import Batches API
  app.get("/api/import-batches", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batches = await storage.getImportBatches();
      res.json(batches.filter((batch) => batch.organizationId === orgId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import batches" });
    }
  });

  app.get("/api/import-batches/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.getImportBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Import batch not found" });
      }
      if (!validateOrgOwnership(batch.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import batch" });
    }
  });

  app.post("/api/import-batches", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.createImportBatch({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create import batch" });
    }
  });

  app.patch("/api/import-batches/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getImportBatch(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Import batch not found" });
      }
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const batch = await storage.updateImportBatch(req.params.id, req.body);
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update import batch" });
    }
  });

  // Import Mappings API
  app.get("/api/import-mappings", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { importType } = req.query;
      const mappings = await storage.getImportMappings(importType as string | undefined);
      res.json(mappings.filter((mapping) => mapping.organizationId === orgId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import mappings" });
    }
  });

  app.post("/api/import-mappings", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const mapping = await storage.createImportMapping({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(mapping);
    } catch (error) {
      res.status(500).json({ error: "Failed to create import mapping" });
    }
  });

  app.delete("/api/import-mappings/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const mapping = await storage.getImportMapping(req.params.id);
      if (!mapping) {
        return res.status(404).json({ error: "Import mapping not found" });
      }
      if (!validateOrgOwnership(mapping.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const deleted = await storage.deleteImportMapping(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Import mapping not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete import mapping" });
    }
  });

  // Get next available file number for imports
  app.get("/api/import/next-file-number", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const allDebtors = await storage.getDebtors();
      const orgDebtors = allDebtors.filter((debtor) => debtor.organizationId === orgId);
      let maxNumber = 0;
      for (const debtor of orgDebtors) {
        const match = debtor.fileNumber?.match(/^(?:FN-\d{4}-)?(\d+)$/);
        if (match) {
          const numPart = Number.parseInt(match[1], 10);
          if (numPart > maxNumber) maxNumber = numPart;
        }
      }
      
      res.json({ nextFileNumber: maxNumber + 1 });
    } catch (error) {
      res.status(500).json({ error: "Failed to get next file number" });
    }
  });

  // Import Data API - handles partial imports, upserts, and SSN-based linking
  app.post("/api/import/debtors", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { portfolioId, clientId, records, mappings, fileNumberStart } = req.body as { portfolioId: string; clientId?: string | null; records: any[]; mappings: Record<string, string>; fileNumberStart?: number };

      if (!portfolioId || !records || !mappings) {
        return res.status(400).json({ error: "Missing required fields: portfolioId, records, mappings" });
      }

      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio || !validateOrgOwnership(portfolio.organizationId, orgId)) {
        return res.status(403).json({ error: "Invalid portfolio for organization" });
      }

      // Resolve effective clientId: explicit > portfolio's existing clientId > null.
      // Validate org ownership only when a client is actually being used.
      let effectiveClientId: string | null = (clientId && clientId.trim()) ? clientId : (portfolio.clientId ?? null);
      if (effectiveClientId) {
        const client = await storage.getClient(effectiveClientId);
        if (!client || !validateOrgOwnership(client.organizationId, orgId)) {
          return res.status(403).json({ error: "Invalid client for organization" });
        }
      }
      
      const normalizeSsn = (s: any): string | null => {
        if (s === null || s === undefined) return null;
        const digits = String(s).replace(/\D/g, "");
        return digits.length > 0 ? digits : null;
      };
      const normalizeText = (s: any): string | null => {
        if (s === null || s === undefined) return null;
        const t = String(s).trim();
        return t.length > 0 ? t : null;
      };

      const results = {
        created: 0,
        updated: 0,
        linked: 0,
        skipped: 0,
        errors: [] as string[],
        skipReasons: [] as { row: number; reason: string }[],
      };

      const existingDebtors = await storage.getDebtors(portfolioId);
      const allDebtors = (await storage.getDebtors()).filter((debtor) => debtor.organizationId === orgId);

      // Compute the next short numeric file number from existing DMP-generated
      // values. Legacy FN-{YYYY}-{seq} values are included while determining
      // the next sequence so upgrades do not reuse an existing number.
      let maxFnSeq = (fileNumberStart || 1) - 1;
      for (const d of allDebtors) {
        const match = d.fileNumber?.match(/^(?:FN-\d{4}-)?(\d+)$/);
        if (!match) continue;
        const n = Number.parseInt(match[1], 10);
        if (n > maxFnSeq) maxFnSeq = n;
      }

      for (let rowIdx = 0; rowIdx < records.length; rowIdx++) {
        const record = records[rowIdx];
        const rowNumber = rowIdx + 1;
        const mappedData: any = {};
        try {
          
          for (const [csvColumn, systemField] of Object.entries(mappings)) {
            if (systemField && systemField !== "skip" && record[csvColumn] !== undefined) {
              let value = record[csvColumn];
              
              if (systemField === "originalBalance" || systemField === "currentBalance") {
                value = Math.round(parseFloat(String(value).replace(/[$,]/g, '')) * 100) || 0;
              }
              
              // For custom field slots, use the original CSV column name as the key
              if (systemField.startsWith("custom") && /^custom\d+$/.test(systemField)) {
                // Store with original column name as key (will go into customFields)
                mappedData[csvColumn] = value;
              } else {
                mappedData[systemField] = value;
              }
            }
          }

          // Normalize key matching fields so dashes/spaces don't create duplicates.
          if (mappedData.accountNumber !== undefined) {
            mappedData.accountNumber = normalizeText(mappedData.accountNumber);
          }
          if (mappedData.fileNumber !== undefined) {
            mappedData.fileNumber = normalizeText(mappedData.fileNumber);
          }
          if (mappedData.ssn !== undefined) {
            mappedData.ssn = normalizeSsn(mappedData.ssn);
            if (mappedData.ssn) mappedData.ssnLast4 = mappedData.ssn.slice(-4);
          }

          if (!mappedData.accountNumber && !mappedData.ssn && !mappedData.fileNumber) {
            const reason = "Row missing account number, SSN, and file number — skipped";
            results.skipped++;
            results.errors.push(`Row ${rowNumber}: ${reason}`);
            results.skipReasons.push({ row: rowNumber, reason });
            continue;
          }

          const existingInPortfolio = existingDebtors.find(
            (d) => (mappedData.accountNumber && d.accountNumber === mappedData.accountNumber) ||
                   (mappedData.ssn && normalizeSsn(d.ssn) === mappedData.ssn) ||
                   (mappedData.fileNumber && d.fileNumber === mappedData.fileNumber)
          );

          if (existingInPortfolio) {
            // A source file number may help identify a re-imported row, but it
            // must never replace the DMP-generated consumer file number.
            const { fileNumber: _sourceFileNumber, ...updates } = mappedData;
            await storage.updateDebtor(existingInPortfolio.id, updates);
            results.updated++;
            continue;
          }

          let linkedAccountId: string | null = null;
          if (mappedData.ssn) {
            const linkedDebtor = allDebtors.find(
              (d) => normalizeSsn(d.ssn) === mappedData.ssn && d.portfolioId !== portfolioId
            );
            if (linkedDebtor) {
              linkedAccountId = linkedDebtor.id;
              results.linked++;
            }
          }

          // DMP owns the consumer-facing file number. Always generate a short
          // numeric value rather than exposing a vendor identifier or the old
          // FN-{YYYY}-{seq} format, since consumers also use it to sign in.
          maxFnSeq++;
          const resolvedFileNumber = maxFnSeq.toString();

          // Collect unmapped columns as custom fields
          const knownFields = new Set([
            'accountNumber', 'firstName', 'lastName', 'email', 'address', 'city', 'state', 'zipCode',
            'dateOfBirth', 'ssn', 'ssnLast4', 'originalBalance', 'currentBalance', 'originalCreditor',
            'clientName', 'fileNumber', 'status', 'lastContactDate', 'nextFollowUpDate', 'chargeOffDate',
            'phone', 'phone1', 'phone2', 'phone3', 'phone4', 'phone5', 
            'phone1Label', 'phone2Label', 'phone3Label', 'phone4Label', 'phone5Label',
            'email1', 'email2', 'email3', 'email1Label', 'email2Label', 'email3Label',
            'employerName', 'employerPhone', 'employerAddress', 'position', 'salary',
            'ref1Name', 'ref1Relationship', 'ref1Phone', 'ref1Address', 'ref1Notes',
            'ref2Name', 'ref2Relationship', 'ref2Phone', 'ref2Address', 'ref2Notes',
            'ref3Name', 'ref3Relationship', 'ref3Phone', 'ref3Address', 'ref3Notes',
          ]);
          const customFields: Record<string, any> = {};
          for (const [key, value] of Object.entries(mappedData)) {
            if (!knownFields.has(key) && value !== undefined && value !== null && value !== '') {
              customFields[key] = value;
            }
          }

          const newDebtor = await storage.createDebtor({
            portfolioId,
            clientId: effectiveClientId,
            linkedAccountId,
            accountNumber: mappedData.accountNumber || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            firstName: mappedData.firstName || "Unknown",
            lastName: mappedData.lastName || "Unknown",
            email: mappedData.email || null,
            address: mappedData.address || null,
            city: mappedData.city || null,
            state: mappedData.state || null,
            zipCode: mappedData.zipCode || null,
            dateOfBirth: mappedData.dateOfBirth || null,
            ssn: mappedData.ssn || null,
            ssnLast4: mappedData.ssnLast4 || (mappedData.ssn ? mappedData.ssn.slice(-4) : null),
            originalBalance: mappedData.originalBalance || 0,
            currentBalance: mappedData.currentBalance || mappedData.originalBalance || 0,
            originalCreditor: mappedData.originalCreditor || null,
            clientName: mappedData.clientName || null,
            fileNumber: resolvedFileNumber,
            status: mappedData.status || "newbiz",
            lastContactDate: mappedData.lastContactDate || null,
            nextFollowUpDate: mappedData.nextFollowUpDate || null,
            chargeOffDate: mappedData.chargeOffDate || null,
            customFields: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
            organizationId: orgId,
          });

          // Create phone contacts - handle legacy "phone" field and phone1-5
          const phoneFields = [
            { phone: mappedData.phone1 || mappedData.phone, label: mappedData.phone1Label },
            { phone: mappedData.phone2, label: mappedData.phone2Label },
            { phone: mappedData.phone3, label: mappedData.phone3Label },
            { phone: mappedData.phone4, label: mappedData.phone4Label },
            { phone: mappedData.phone5, label: mappedData.phone5Label },
          ];
          
          let phoneCount = 0;
          for (let i = 0; i < phoneFields.length; i++) {
            const { phone, label } = phoneFields[i];
            if (phone && phone.trim()) {
              await storage.createDebtorContact({
                debtorId: newDebtor.id,
                type: "phone",
                value: phone.trim(),
                label: label || (phoneCount === 0 ? "Primary" : `Phone ${phoneCount + 1}`),
                isPrimary: phoneCount === 0,
                isValid: true,
                organizationId: orgId,
              });
              phoneCount++;
            }
          }

          // Create email contacts - handle legacy "email" field (in debtor record) and email1-3
          const emailFields = [
            { email: mappedData.email1, label: mappedData.email1Label },
            { email: mappedData.email2, label: mappedData.email2Label },
            { email: mappedData.email3, label: mappedData.email3Label },
          ];
          
          let emailCount = 0;
          for (let i = 0; i < emailFields.length; i++) {
            const { email, label } = emailFields[i];
            if (email && email.trim()) {
              await storage.createDebtorContact({
                debtorId: newDebtor.id,
                type: "email",
                value: email.trim(),
                label: label || (emailCount === 0 ? "Primary" : `Email ${emailCount + 1}`),
                isPrimary: emailCount === 0,
                isValid: true,
                organizationId: orgId,
              });
              emailCount++;
            }
          }

          // Create employment record if employer info provided
          if (mappedData.employerName && mappedData.employerName.trim()) {
            await storage.createEmploymentRecord({
              debtorId: newDebtor.id,
              employerName: mappedData.employerName.trim(),
              employerPhone: mappedData.employerPhone || null,
              employerAddress: mappedData.employerAddress || null,
              position: mappedData.position || null,
              salary: mappedData.salary ? Math.round(parseFloat(mappedData.salary.replace(/[$,]/g, '')) * 100) : null,
              isCurrent: true,
              organizationId: orgId,
            });
          }

          // Create references (up to 3)
          const refFields = [
            { name: mappedData.ref1Name, relationship: mappedData.ref1Relationship, phone: mappedData.ref1Phone, address: mappedData.ref1Address, city: mappedData.ref1City, state: mappedData.ref1State, zipCode: mappedData.ref1ZipCode, notes: mappedData.ref1Notes },
            { name: mappedData.ref2Name, relationship: mappedData.ref2Relationship, phone: mappedData.ref2Phone, address: mappedData.ref2Address, city: mappedData.ref2City, state: mappedData.ref2State, zipCode: mappedData.ref2ZipCode, notes: mappedData.ref2Notes },
            { name: mappedData.ref3Name, relationship: mappedData.ref3Relationship, phone: mappedData.ref3Phone, address: mappedData.ref3Address, city: mappedData.ref3City, state: mappedData.ref3State, zipCode: mappedData.ref3ZipCode, notes: mappedData.ref3Notes },
          ];
          
          for (const ref of refFields) {
            if (ref.name && ref.name.trim()) {
              await storage.createDebtorReference({
                debtorId: newDebtor.id,
                name: ref.name.trim(),
                relationship: ref.relationship || null,
                phone: ref.phone || null,
                address: ref.address || null,
                city: ref.city || null,
                state: ref.state || null,
                zipCode: ref.zipCode || null,
                notes: ref.notes || null,
                addedDate: new Date().toISOString().split("T")[0],
                organizationId: orgId,
              });
            }
          }

          results.created++;
        } catch (err: any) {
          let reason = err.message || "Unknown error processing record";
          // Surface the unique-(portfolio, file_number) violation as a
          // human-readable skip reason instead of leaking the raw
          // Postgres error.
          const code = err?.code || err?.cause?.code;
          const constraint = err?.constraint || err?.cause?.constraint;
          if (
            code === "23505" ||
            constraint === "debtors_portfolio_file_number_unique" ||
            /debtors_portfolio_file_number_unique/.test(reason)
          ) {
            reason = `Duplicate file number "${mappedData.fileNumber ?? ''}" already exists in this portfolio`;
          }
          results.skipped++;
          results.errors.push(`Row ${rowNumber}: ${reason}`);
          results.skipReasons.push({ row: rowNumber, reason });
        }
      }

      if (portfolio) {
        const updatedDebtors = await storage.getDebtors(portfolioId);
        const totalFaceValue = updatedDebtors.reduce((sum, d) => sum + d.originalBalance, 0);
        await storage.updatePortfolio(portfolioId, {
          totalAccounts: updatedDebtors.length,
          totalFaceValue,
        });
      }

      res.json({
        success: true,
        results,
        message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.linked} linked, ${results.skipped} skipped`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import debtors" });
    }
  });

  // Import Contacts API - adds contacts to existing debtors
  app.post("/api/import/contacts", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { portfolioId, records, mappings } = req.body as { portfolioId: string; records: any[]; mappings: Record<string, string> };
      
      if (!portfolioId || !records || !mappings) {
        return res.status(400).json({ error: "Missing required fields: portfolioId, records, mappings" });
      }

      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio || !validateOrgOwnership(portfolio.organizationId, orgId)) {
        return res.status(403).json({ error: "Invalid portfolio for organization" });
      }

      const results = {
        added: 0,
        matched: 0,
        errors: [] as string[],
      };

      const debtors = (await storage.getDebtors(portfolioId)).filter((debtor) => debtor.organizationId === orgId);

      const normalizeSsn = (s: any): string | null => {
        if (s === null || s === undefined) return null;
        const digits = String(s).replace(/\D/g, "");
        return digits.length > 0 ? digits : null;
      };

      for (const record of records) {
        try {
          const mappedData: any = {};
          
          for (const [csvColumn, systemField] of Object.entries(mappings)) {
            if (systemField && systemField !== "skip" && record[csvColumn] !== undefined) {
              mappedData[systemField] = record[csvColumn];
            }
          }

          if (mappedData.accountNumber !== undefined && mappedData.accountNumber !== null) {
            mappedData.accountNumber = String(mappedData.accountNumber).trim() || null;
          }
          if (mappedData.ssn !== undefined) {
            mappedData.ssn = normalizeSsn(mappedData.ssn);
          }

          let matchedDebtor = null;
          if (mappedData.accountNumber) {
            matchedDebtor = debtors.find((d) => d.accountNumber === mappedData.accountNumber);
          } else if (mappedData.ssn) {
            matchedDebtor = debtors.find((d) => normalizeSsn(d.ssn) === mappedData.ssn);
          }

          if (!matchedDebtor) {
            results.errors.push(`No matching debtor found for record`);
            continue;
          }

          results.matched++;

          if (mappedData.phone) {
            await storage.createDebtorContact({
              debtorId: matchedDebtor.id,
              type: "phone",
              value: mappedData.phone,
              label: mappedData.phoneLabel || null,
              isPrimary: false,
              isValid: true,
              organizationId: orgId,
            });
            results.added++;
          }

          if (mappedData.email) {
            await storage.createDebtorContact({
              debtorId: matchedDebtor.id,
              type: "email",
              value: mappedData.email,
              label: mappedData.emailLabel || null,
              isPrimary: false,
              isValid: true,
              organizationId: orgId,
            });
            results.added++;
          }
        } catch (err: any) {
          results.errors.push(err.message || "Unknown error processing record");
        }
      }

      res.json({
        success: true,
        results,
        message: `Import complete: ${results.added} contacts added to ${results.matched} debtors`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import contacts" });
    }
  });

  // Drop Batches API
  app.get("/api/drop-batches", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const batches = await storage.getDropBatches(orgId);
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop batches" });
    }
  });

  app.post("/api/drop-batches", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.createDropBatch({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create drop batch" });
    }
  });

  app.patch("/api/drop-batches/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getDropBatch(req.params.id);
      if (!existing || !validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(404).json({ error: "Drop batch not found" });
      }
      const body = { ...req.body };
      delete body.organizationId;
      const batch = await storage.updateDropBatch(req.params.id, body);
      if (!batch) {
        return res.status(404).json({ error: "Drop batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update drop batch" });
    }
  });

  // Drop Items API
  app.get("/api/drop-items", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { batchId, collectorId } = req.query;
      const items = await storage.getDropItems(
        batchId as string | undefined,
        collectorId as string | undefined
      );
      // Only return items belonging to the caller's organization.
      res.json(items.filter((item) => validateOrgOwnership(item.organizationId, orgId)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop items" });
    }
  });

  app.post("/api/drop-items", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      if (req.body.collectorId) {
        const target = await storage.getCollector(req.body.collectorId);
        if (!target || !validateOrgOwnership(target.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid collector" });
        }
        if (target.role === "auditor") {
          return res.status(400).json({ error: "Auditors cannot be assigned accounts" });
        }
      }
      // The target debtor must belong to the caller's organization.
      const dropDebtor = await storage.getDebtor(req.body.debtorId);
      if (!dropDebtor || !validateOrgOwnership(dropDebtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      // Any supplied drop batch must also belong to the caller's organization.
      if (req.body.dropBatchId) {
        const dropBatch = await storage.getDropBatch(req.body.dropBatchId);
        if (!dropBatch || !validateOrgOwnership(dropBatch.organizationId, orgId)) {
          return res.status(404).json({ error: "Drop batch not found" });
        }
      }
      const item = await storage.createDropItem({
        ...req.body,
        organizationId: orgId,
        assignedDate: new Date().toISOString().split("T")[0],
      });
      
      // Also add to work queue
      await storage.createWorkQueueItem({
        collectorId: req.body.collectorId,
        debtorId: req.body.debtorId,
        assignedDate: new Date().toISOString().split("T")[0],
        priority: 0,
      });
      
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create drop item" });
    }
  });

  // Recall Batches API
  app.get("/api/recall-batches", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const batches = await storage.getRecallBatches(orgId);
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recall batches" });
    }
  });

  app.post("/api/recall-batches", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.createRecallBatch({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create recall batch" });
    }
  });

  // Recall Items API
  app.get("/api/recall-items/:batchId", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const batch = await storage.getRecallBatch(req.params.batchId);
      if (!batch) return res.status(404).json({ error: "Recall batch not found" });
      if (!validateOrgOwnership(batch.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const items = await storage.getRecallItems(req.params.batchId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recall items" });
    }
  });

  app.post("/api/recall-items", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const item = await storage.createRecallItem({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create recall item" });
    }
  });

  // Execute a recall: clear assignment + remove work queue items, with audit trail
  app.post("/api/recall/execute", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { name, debtorIds, reason, portfolioId, clientName } = req.body || {};
      if (!Array.isArray(debtorIds) || debtorIds.length === 0) {
        return res.status(400).json({ error: "debtorIds required" });
      }
      const batch = await storage.createRecallBatch({
        organizationId: orgId,
        name: name || `Recall ${new Date().toISOString().split("T")[0]}`,
        portfolioId: portfolioId || null,
        clientName: clientName || null,
        totalAccounts: debtorIds.length,
        keeperCount: 0,
        recallCount: debtorIds.length,
        status: "completed",
        createdDate: new Date().toISOString().split("T")[0],
        processedDate: new Date().toISOString().split("T")[0],
      } as any);

      let processed = 0;
      for (const debtorId of debtorIds) {
        const d = await storage.getDebtor(debtorId);
        if (!d || !validateOrgOwnership(d.organizationId, orgId)) continue;
        await storage.createRecallItem({
          organizationId: orgId,
          recallBatchId: batch.id,
          debtorId,
          isKeeper: false,
          recallReason: reason || "recall",
          processedDate: new Date().toISOString().split("T")[0],
        } as any);
        await storage.updateDebtor(debtorId, { assignedCollectorId: null } as any);
        await db.delete(workQueueItems).where(eq(workQueueItems.debtorId, debtorId));
        processed++;
      }
      res.json({ batchId: batch.id, processed });
    } catch (error) {
      res.status(500).json({ error: "Failed to execute recall" });
    }
  });

  app.patch("/api/recall-items/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const all = await db.select().from(recallItems).where(eq(recallItems.id, req.params.id));
      const existing = all[0];
      if (!existing) return res.status(404).json({ error: "Recall item not found" });
      const parentBatch = await storage.getRecallBatch(existing.recallBatchId);
      if (!parentBatch) return res.status(404).json({ error: "Recall batch not found" });
      if (!validateOrgOwnership(parentBatch.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { organizationId: _, ...body } = req.body;
      const item = await storage.updateRecallItem(req.params.id, body);
      if (!item) {
        return res.status(404).json({ error: "Recall item not found" });
      }
      res.json(item);
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to update recall item" });
    }
  });

  // Account Statuses API (custom per-org)
  app.get("/api/account-statuses", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const rows = await storage.getAccountStatuses(orgId);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account statuses" });
    }
  });

  app.post("/api/account-statuses", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { code, label, color, sortOrder } = req.body || {};
      if (!code || !label) return res.status(400).json({ error: "code and label required" });
      const cleanCode = String(code).trim().toLowerCase().replace(/\s+/g, "_");
      if (!cleanCode) return res.status(400).json({ error: "Invalid code" });
      const RESERVED_SYSTEM_CODES = [
        "newbiz", "1st_message", "final", "promise", "payments_pending",
        "open", "in_payment", "paid", "decline", "disputed", "settled",
        "closed", "bankruptcy", "legal",
      ];
      if (RESERVED_SYSTEM_CODES.includes(cleanCode)) {
        return res.status(409).json({ error: "This is a reserved system status code" });
      }
      const existing = await storage.getAccountStatuses(orgId);
      if (existing.some(s => s.code.toLowerCase() === cleanCode)) {
        return res.status(409).json({ error: "Status code already exists" });
      }
      const created = await storage.createAccountStatus({
        organizationId: orgId,
        code: cleanCode,
        label: String(label).trim(),
        color: color || "slate",
        sortOrder: sortOrder ?? existing.length,
      } as any);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create account status" });
    }
  });

  app.patch("/api/account-statuses/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getAccountStatus(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { organizationId: _, code: __, ...body } = req.body || {};
      const updated = await storage.updateAccountStatus(req.params.id, body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update account status" });
    }
  });

  app.delete("/api/account-statuses/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getAccountStatus(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteAccountStatus(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account status" });
    }
  });

  // Consolidation Companies API
  app.get("/api/consolidation-companies", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const companies = await storage.getConsolidationCompanies(orgId);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consolidation companies" });
    }
  });

  app.post("/api/consolidation-companies", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const company = await storage.createConsolidationCompany({
        ...req.body,
        organizationId: orgId,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to create consolidation company" });
    }
  });

  app.patch("/api/consolidation-companies/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getConsolidationCompany(req.params.id);
      if (!existing) return res.status(404).json({ error: "Consolidation company not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { organizationId: _, ...body } = req.body;
      const company = await storage.updateConsolidationCompany(req.params.id, body);
      if (!company) {
        return res.status(404).json({ error: "Consolidation company not found" });
      }
      res.json(company);
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to update consolidation company" });
    }
  });

  app.delete("/api/consolidation-companies/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getConsolidationCompany(req.params.id);
      if (!existing) return res.status(404).json({ error: "Consolidation company not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const deleted = await storage.deleteConsolidationCompany(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Consolidation company not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete consolidation company" });
    }
  });

  // Consolidation Cases API
  app.get("/api/consolidation-cases", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const { debtorId, companyId } = req.query;
      const cases = await storage.getConsolidationCases(
        debtorId as string | undefined,
        companyId as string | undefined
      );
      const orgCompanies = await storage.getConsolidationCompanies(orgId);
      const orgCompanyIds = new Set(orgCompanies.map((c) => c.id));
      const scoped = cases.filter((c) => orgCompanyIds.has(c.consolidationCompanyId));
      res.json(scoped);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consolidation cases" });
    }
  });

  app.post("/api/consolidation-cases", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      if (req.body.debtorId) {
        const debtor = await storage.getDebtor(req.body.debtorId);
        if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid debtor" });
        }
      }
      if (req.body.consolidationCompanyId) {
        const company = await storage.getConsolidationCompany(req.body.consolidationCompanyId);
        if (!company || !validateOrgOwnership(company.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid consolidation company" });
        }
      }
      const caseData = await storage.createConsolidationCase({
        ...req.body,
        organizationId: orgId,
        startDate: req.body.startDate || new Date().toISOString().split("T")[0],
      });
      res.status(201).json(caseData);
    } catch (error) {
      res.status(500).json({ error: "Failed to create consolidation case" });
    }
  });

  app.patch("/api/consolidation-cases/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getConsolidationCase(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Consolidation case not found" });
      }
      const company = await storage.getConsolidationCompany(existing.consolidationCompanyId);
      if (!company || !validateOrgOwnership(company.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { id: _id, organizationId: _o, debtorId: _d, consolidationCompanyId: _c, ...allowed } = req.body || {};
      const caseData = await storage.updateConsolidationCase(req.params.id, allowed);
      if (!caseData) {
        return res.status(404).json({ error: "Consolidation case not found" });
      }
      res.json(caseData);
    } catch (error) {
      res.status(500).json({ error: "Failed to update consolidation case" });
    }
  });

  // Work Queue API
  app.get("/api/work-queue/:collectorId", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const collector = await storage.getCollector(req.params.collectorId);
      if (!collector) return res.status(404).json({ error: "Collector not found" });
      if (!validateOrgOwnership(collector.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { status } = req.query;
      const items = await storage.getWorkQueueItems(
        req.params.collectorId,
        status as string | undefined
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work queue" });
    }
  });

  app.post("/api/work-queue", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      if (req.body.collectorId) {
        const target = await storage.getCollector(req.body.collectorId);
        if (!target || !validateOrgOwnership(target.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid collector" });
        }
        if (target.role === "auditor") {
          return res.status(400).json({ error: "Auditors cannot be assigned accounts" });
        }
      }
      if (req.body.debtorId) {
        const debtor = await storage.getDebtor(req.body.debtorId);
        if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
          return res.status(400).json({ error: "Invalid debtor" });
        }
      }
      const item = await storage.createWorkQueueItem({
        ...req.body,
        assignedDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add to work queue" });
    }
  });

  app.patch("/api/work-queue/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getWorkQueueItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      const owner = await storage.getCollector(existing.collectorId);
      if (!owner || !validateOrgOwnership(owner.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { id: _id, collectorId: _c, debtorId: _d, ...allowed } = req.body || {};
      const item = await storage.updateWorkQueueItem(req.params.id, allowed);
      if (!item) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update work queue item" });
    }
  });

  app.delete("/api/work-queue/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getWorkQueueItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      const owner = await storage.getCollector(existing.collectorId);
      if (!owner || !validateOrgOwnership(owner.organizationId, orgId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteWorkQueueItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete work queue item" });
    }
  });

  // Remittances API
  app.get("/api/remittances", async (req, res) => {
    try {
      const { status, portfolioId } = req.query;
      const orgId = getOrgId(req as any);
      const remittances = await storage.getRemittances(
        status as string | undefined,
        portfolioId as string | undefined,
        orgId
      );
      res.json(remittances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remittances" });
    }
  });

  app.post("/api/remittances", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const remittance = await storage.createRemittance({
        ...req.body,
        organizationId: orgId,
        remittanceDate: req.body.remittanceDate || new Date().toISOString().split("T")[0],
      });
      res.status(201).json(remittance);
    } catch (error) {
      res.status(500).json({ error: "Failed to create remittance" });
    }
  });

  app.patch("/api/remittances/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getRemittance(req.params.id);
      if (!existing) return res.status(404).json({ error: "Remittance not found" });
      if (!validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { organizationId: _, ...body } = req.body;
      const remittance = await storage.updateRemittance(req.params.id, body);
      if (!remittance) {
        return res.status(404).json({ error: "Remittance not found" });
      }
      res.json(remittance);
    } catch (error) {
      res.status(500).json({ error: "Failed to update remittance" });
    }
  });

  // Remittance Items API
  app.get("/api/remittance-items", async (req, res) => {
    try {
      const { remittanceId, status } = req.query;
      const orgId = getOrgId(req as any);
      const items = await storage.getRemittanceItems(
        remittanceId as string | undefined,
        status as string | undefined,
        orgId
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remittance items" });
    }
  });

  app.post("/api/remittance-items", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const item = await storage.createRemittanceItem({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create remittance item" });
    }
  });

  app.patch("/api/remittance-items/:id", async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const allItems = await storage.getRemittanceItems(undefined, undefined, orgId);
      const existing = allItems.find((i) => i.id === req.params.id);
      if (!existing) return res.status(404).json({ error: "Remittance item not found" });
      const parent = await storage.getRemittance(existing.remittanceId);
      if (!parent) return res.status(404).json({ error: "Remittance not found" });
      if (!validateOrgOwnership(parent.organizationId, orgId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { organizationId: _, ...body } = req.body;
      const item = await storage.updateRemittanceItem(req.params.id, body);
      if (!item) {
        return res.status(404).json({ error: "Remittance item not found" });
      }
      res.json(item);
    } catch (error: any) {
      if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to update remittance item" });
    }
  });

  // Email/Text Templates API (admins/managers manage; enabled collectors can read active templates)
  app.get("/api/email-templates", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const currentCollector = await storage.getCollector(collector.id);
      const canManage = collector.role === "admin" || collector.role === "manager";
      if (!canManage && !currentCollector?.canViewEmail) {
        return res.status(403).json({ error: "Messaging is not enabled for this collector" });
      }
      const orgId = getOrgId(req);
      const templates = await storage.getEmailTemplates(orgId);
      res.json(canManage ? templates : templates.filter((t) => t.isActive));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/email-templates", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage templates" });
      }
      const orgId = getOrgId(req);
      const { name, subject, body, templateType, isActive } = req.body;
      if (!name || !body || !templateType) {
        return res.status(400).json({ error: "name, body, and templateType are required" });
      }
      const template = await storage.createEmailTemplate({
        organizationId: orgId,
        name,
        subject: subject ?? "",
        body,
        templateType,
        isActive: isActive ?? true,
        createdDate: new Date().toISOString(),
        updatedDate: null,
      });
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/email-templates/:id", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage templates" });
      }
      const orgId = getOrgId(req);
      const existing = await storage.getEmailTemplate(req.params.id);
      if (!existing || !validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(404).json({ error: "Template not found" });
      }
      const { name, subject, body, templateType, isActive } = req.body;
      const updated = await storage.updateEmailTemplate(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(subject !== undefined ? { subject } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(templateType !== undefined ? { templateType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        updatedDate: new Date().toISOString(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/email-templates/:id", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage templates" });
      }
      const orgId = getOrgId(req);
      const existing = await storage.getEmailTemplate(req.params.id);
      if (!existing || !validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(404).json({ error: "Template not found" });
      }
      await storage.deleteEmailTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Campaign Integrations API
  // Never expose the stored apiKey back to the client — return a boolean flag instead.
  const maskCampaignIntegration = (i: CampaignIntegration) => {
    const { apiKey, ...rest } = i;
    return { ...rest, hasApiKey: !!apiKey };
  };

  app.get("/api/campaign-integrations", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage campaign integrations" });
      }
      const orgId = getOrgId(req);
      const integrations = await storage.getCampaignIntegrations(orgId);
      res.json(integrations.map(maskCampaignIntegration));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign integrations" });
    }
  });

  app.post("/api/campaign-integrations", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage campaign integrations" });
      }
      const orgId = getOrgId(req);
      const integration = await storage.createCampaignIntegration({
        organizationId: orgId,
        name: req.body.name,
        // One provider handles both channels; "both" kept for the not-null column.
        type: req.body.type || "both",
        apiBaseUrl: req.body.apiBaseUrl,
        apiKey: req.body.apiKey,
        isActive: req.body.isActive ?? true,
        createdDate: new Date().toISOString(),
      });
      res.status(201).json(maskCampaignIntegration(integration));
    } catch (error) {
      res.status(500).json({ error: "Failed to create campaign integration" });
    }
  });

  app.patch("/api/campaign-integrations/:id", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage campaign integrations" });
      }
      const orgId = getOrgId(req);
      const existing = await storage.getCampaignIntegration(req.params.id);
      if (!existing || !validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(404).json({ error: "Campaign integration not found" });
      }
      // `type` is intentionally not accepted — one provider handles both channels.
      const { name, apiBaseUrl, apiKey, isActive } = req.body;
      const updated = await storage.updateCampaignIntegration(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(apiBaseUrl !== undefined ? { apiBaseUrl } : {}),
        // Only overwrite apiKey when a non-empty value is supplied so the masked UI can omit it.
        ...(apiKey ? { apiKey } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      });
      res.json(updated ? maskCampaignIntegration(updated) : updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update campaign integration" });
    }
  });

  app.delete("/api/campaign-integrations/:id", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can manage campaign integrations" });
      }
      const orgId = getOrgId(req);
      const existing = await storage.getCampaignIntegration(req.params.id);
      if (!existing || !validateOrgOwnership(existing.organizationId, orgId)) {
        return res.status(404).json({ error: "Campaign integration not found" });
      }
      await storage.deleteCampaignIntegration(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign integration" });
    }
  });

  app.get("/api/campaign-integrations/:id/campaigns", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can view campaigns" });
      }
      const orgId = getOrgId(req);
      const integration = await storage.getCampaignIntegration(req.params.id);
      if (!integration || !validateOrgOwnership(integration.organizationId, orgId)) {
        return res.status(404).json({ error: "Campaign integration not found" });
      }

      const response = await fetch(`${integration.apiBaseUrl.replace(/\/$/, "")}/campaigns`, {
        headers: {
          Authorization: `Bearer ${integration.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch campaigns from external system" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign list" });
    }
  });

  app.post("/api/campaigns/send", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can send campaigns" });
      }
      const orgId = getOrgId(req);
      const collectorId = req.session?.collector?.id || "unknown";
      const { integrationId, templateId, campaignName, accounts } = req.body as { integrationId: string; templateId: string; campaignName: string; accounts: Array<{ debtorId: string; contactValue: string; contactType: string }> };

      if (!integrationId || !templateId || !campaignName || !Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ error: "integrationId, templateId, campaignName, and accounts are required" });
      }

      const integration = await storage.getCampaignIntegration(integrationId);
      if (!integration || !validateOrgOwnership(integration.organizationId, orgId)) {
        return res.status(404).json({ error: "Campaign integration not found" });
      }

      const template = await storage.getEmailTemplate(templateId);
      if (!template || !validateOrgOwnership(template.organizationId, orgId)) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Channel is driven by the template, not the provider — one Chain provider can
      // send both email and text campaigns.
      const campaignChannel = template.templateType === "email" ? "email" : "sms";

      const debtors = await Promise.all(accounts.map((a) => storage.getDebtor(a.debtorId)));
      if (debtors.some((d) => !d || d.organizationId !== orgId)) {
        return res.status(403).json({ error: "One or more accounts do not belong to your organization" });
      }

      const campaignLog = await storage.createCampaignLog({
        organizationId: orgId,
        integrationId: integration.id,
        campaignName,
        campaignType: campaignChannel,
        totalAccounts: accounts.length,
        status: "pending",
        sentDate: new Date().toISOString(),
        sentBy: collectorId,
        errorMessage: null,
      });

      const items = await Promise.all(accounts.map(async (account, idx) => {
        const debtor = debtors[idx]!;
        return storage.createCampaignLogItem({
          campaignLogId: campaignLog.id,
          debtorId: debtor.id,
          fileNumber: debtor.fileNumber || debtor.accountNumber,
          contactValue: account.contactValue,
          contactType: account.contactType,
          status: "queued",
          externalId: null,
          responseText: null,
        });
      }));

      const payload = {
        organizationId: orgId,
        campaignLogId: campaignLog.id,
        campaignName,
        campaignType: campaignChannel,
        template: {
          id: template.id,
          name: template.name,
          type: template.templateType,
          subject: template.subject ?? "",
          body: template.body,
        },
        accounts: await Promise.all(items.map(async (item, idx) => {
          const debtor = debtors[idx]!;
          const isEmail = campaignChannel === "email";
          return {
            fileNumber: item.fileNumber,
            contactValue: item.contactValue,
            contactType: item.contactType,
            renderedSubject: isEmail ? await renderTemplateForDebtor(template.subject ?? "", debtor, true) : "",
            renderedBody: await renderTemplateForDebtor(template.body, debtor, isEmail),
          };
        })),
      };

      const externalResponse = await fetch(`${integration.apiBaseUrl.replace(/\/$/, "")}/campaigns/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!externalResponse.ok) {
        const errorText = await externalResponse.text();
        await storage.updateCampaignLog(campaignLog.id, { status: "failed", errorMessage: errorText || "External send failed" });
        return res.status(502).json({ error: "External campaign send failed", details: errorText });
      }

      await storage.updateCampaignLog(campaignLog.id, { status: "sent", errorMessage: null });
      await Promise.all(items.map((item) => storage.updateCampaignLogItem(item.id, { status: "sent" })));

      res.json({ success: true, campaignLogId: campaignLog.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to send campaign" });
    }
  });


  app.post("/api/collector/messages/send", async (req: any, res) => {
    try {
      const sessionCollector = req.session?.collector;
      if (!sessionCollector) {
        return res.status(401).json({ error: "Collector authentication required" });
      }
      const orgId = getOrgId(req);
      const currentCollector = await storage.getCollector(sessionCollector.id);
      if (!currentCollector || !validateOrgOwnership(currentCollector.organizationId, orgId)) {
        return res.status(401).json({ error: "Collector authentication required" });
      }
      if (currentCollector.role !== "admin" && currentCollector.role !== "manager" && !currentCollector.canViewEmail) {
        return res.status(403).json({ error: "Messaging is not enabled for this collector" });
      }

      const { debtorId, templateId, contactValue, contactType, integrationId } = req.body as {
        debtorId: string;
        templateId: string;
        contactValue: string;
        contactType: "phone" | "email";
        integrationId?: string;
      };
      if (!debtorId || !templateId || !contactValue || !contactType) {
        return res.status(400).json({ error: "debtorId, templateId, contactValue, and contactType are required" });
      }

      const debtor = await storage.getDebtor(debtorId);
      if (!debtor || !validateOrgOwnership(debtor.organizationId, orgId)) {
        return res.status(404).json({ error: "Account not found" });
      }
      const template = await storage.getEmailTemplate(templateId);
      if (!template || !template.isActive || !validateOrgOwnership(template.organizationId, orgId)) {
        return res.status(404).json({ error: "Template not found" });
      }
      const expectedContactType = template.templateType === "email" ? "email" : "phone";
      if (contactType !== expectedContactType) {
        return res.status(400).json({ error: `This template requires a ${expectedContactType} contact` });
      }
      const contacts = await storage.getDebtorContacts(debtor.id);
      const allowedValues = new Set([
        debtor.email,
        ...contacts.filter((c) => c.type === contactType && c.isValid !== false).map((c) => c.value),
      ].filter(Boolean));
      if (!allowedValues.has(contactValue)) {
        return res.status(400).json({ error: "Contact value must belong to this account" });
      }

      const integrations = await storage.getCampaignIntegrations(orgId);
      const integration = integrationId
        ? integrations.find((i) => i.id === integrationId && i.isActive)
        : integrations.find((i) => i.isActive);
      if (!integration) {
        return res.status(400).json({ error: "No active Chain provider configured" });
      }

      const channel = template.templateType === "email" ? "email" : "sms";
      const campaignLog = await storage.createCampaignLog({
        organizationId: orgId,
        integrationId: integration.id,
        campaignName: `${template.name} - ${debtor.fileNumber || debtor.accountNumber}`,
        campaignType: channel,
        totalAccounts: 1,
        status: "pending",
        sentDate: new Date().toISOString(),
        sentBy: currentCollector.id,
        errorMessage: null,
      });
      const item = await storage.createCampaignLogItem({
        campaignLogId: campaignLog.id,
        debtorId: debtor.id,
        fileNumber: debtor.fileNumber || debtor.accountNumber,
        contactValue,
        contactType,
        status: "queued",
        externalId: null,
        responseText: null,
      });

      const isEmail = channel === "email";
      const payload = {
        organizationId: orgId,
        campaignLogId: campaignLog.id,
        campaignName: campaignLog.campaignName,
        campaignType: channel,
        template: {
          id: template.id,
          name: template.name,
          type: template.templateType,
          subject: template.subject ?? "",
          body: template.body,
        },
        accounts: [{
          fileNumber: item.fileNumber,
          contactValue: item.contactValue,
          contactType: item.contactType,
          renderedSubject: isEmail ? await renderTemplateForDebtor(template.subject ?? "", debtor, true) : "",
          renderedBody: await renderTemplateForDebtor(template.body, debtor, isEmail),
        }],
      };

      const externalResponse = await fetch(`${integration.apiBaseUrl.replace(/\/$/, "")}/campaigns/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!externalResponse.ok) {
        const errorText = await externalResponse.text();
        await storage.updateCampaignLog(campaignLog.id, { status: "failed", errorMessage: errorText || "External send failed" });
        await storage.updateCampaignLogItem(item.id, { status: "failed", responseText: errorText || "External send failed" });
        return res.status(502).json({ error: "External message send failed", details: errorText });
      }

      await storage.updateCampaignLog(campaignLog.id, { status: "sent", errorMessage: null });
      await storage.updateCampaignLogItem(item.id, { status: "sent" });
      res.json({ success: true, campaignLogId: campaignLog.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/campaign-logs", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can view campaign logs" });
      }
      const orgId = getOrgId(req);
      const logs = await storage.getCampaignLogs(orgId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign logs" });
    }
  });

  app.get("/api/campaign-logs/:id", async (req: any, res) => {
    try {
      const collector = req.session?.collector;
      if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
        return res.status(403).json({ error: "Only admins and managers can view campaign logs" });
      }
      const orgId = getOrgId(req);
      const log = await storage.getCampaignLog(req.params.id);
      if (!log || !validateOrgOwnership(log.organizationId, orgId)) {
        return res.status(404).json({ error: "Campaign log not found" });
      }

      const items = await storage.getCampaignLogItems(log.id);
      res.json({ ...log, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign log" });
    }
  });

  // Register external API routes for SMS/TXT software integration
  registerExternalApiRoutes(app);

  return httpServer;
}
