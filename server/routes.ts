import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerExternalApiRoutes } from "./external-api";
import crypto from "crypto";
import { 
  chargeSubscription, 
  isConfigured as isAuthNetConfigured, 
  getSubscriptionPrices,
  processDebtorCardPayment,
  processDebtorAchPayment,
  voidDebtorTransaction,
  type MerchantCredentials
} from "./authorizenet";

// Simple password hashing (for production, use bcrypt)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Generate URL-friendly slug from company name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

// Organization ID is extracted from X-Organization-Id header or defaults to default-org
const DEFAULT_ORG_ID = "default-org";

function getOrgId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const headerValue = req.headers["x-organization-id"];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    return headerValue;
  }
  return DEFAULT_ORG_ID;
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
  if (org.subscriptionStatus === "trial" && org.trialEndDate) {
    const today = new Date();
    const trialEnd = new Date(org.trialEndDate);
    if (today <= trialEnd) {
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
  
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const dateRange = (req.query.dateRange as string) || "this_month";
      const stats = await storage.getDashboardStats(dateRange);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Organization routes
  app.get("/api/organizations", async (req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/:id", async (req, res) => {
    try {
      const organization = await storage.getOrganization(req.params.id);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/organizations/slug/:slug", async (req, res) => {
    try {
      const organization = await storage.getOrganizationBySlug(req.params.slug);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations", async (req, res) => {
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

  app.patch("/api/organizations/:id", async (req, res) => {
    try {
      const organization = await storage.updateOrganization(req.params.id, req.body);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/organizations/:id", async (req, res) => {
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
        password: hashPassword(password),
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
      if (!verifyPassword(password, collector.password)) {
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
        let clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                       req.socket.remoteAddress || 
                       '127.0.0.1';
        
        // Normalize IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
        if (clientIp.startsWith('::ffff:')) {
          clientIp = clientIp.substring(7);
        }
        
        const isWhitelisted = await storage.isIpWhitelisted(organization.id, clientIp);
        if (!isWhitelisted) {
          console.log(`IP ${clientIp} blocked for org ${organization.id}`);
          return res.status(403).json({ 
            error: "Access denied. Your IP address is not authorized to login to this organization." 
          });
        }
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
    } catch (error) {
      console.error("Login error:", error);
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

      if (!verifyPassword(password, admin.password)) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (!admin.isActive) {
        return res.status(403).json({ error: "Your admin account is not active" });
      }

      res.json({
        message: "Super admin login successful",
        admin: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
        },
      });
    } catch (error) {
      console.error("Super admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Super Admin - Get all organizations
  app.get("/api/super-admin/organizations", async (req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Super Admin - Toggle organization active status
  app.patch("/api/super-admin/organizations/:id/toggle", async (req, res) => {
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

  // Super Admin - Create new organization with admin
  app.post("/api/super-admin/organizations", async (req, res) => {
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
        password: hashPassword(adminPassword),
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
  app.post("/api/super-admin/admins", async (req, res) => {
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
        password: hashPassword(password),
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
  app.get("/api/super-admin/notifications", async (_req, res) => {
    try {
      const notifications = await storage.getAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/super-admin/notifications/unread", async (_req, res) => {
    try {
      const notifications = await storage.getUnreadAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.patch("/api/super-admin/notifications/:id/read", async (req, res) => {
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

  app.post("/api/super-admin/notifications/mark-all-read", async (_req, res) => {
    try {
      await storage.markAllAdminNotificationsRead();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Organization Billing API (Authorize.net for Debt Manager Pro subscriptions)
  app.get("/api/billing/plans", async (_req, res) => {
    try {
      const prices = getSubscriptionPrices();
      res.json({
        plans: [
          { id: "starter", name: "Starter", price: prices.starter.price, seats: prices.starter.seats },
          { id: "growth", name: "Growth", price: prices.growth.price, seats: prices.growth.seats },
          { id: "agency", name: "Agency", price: prices.agency.price, seats: prices.agency.seats },
        ],
        configured: isAuthNetConfigured(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch billing plans" });
    }
  });

  app.post("/api/billing/subscribe", async (req, res) => {
    try {
      const { organizationId, plan, cardNumber, expirationDate, cardCode, email } = req.body;

      if (!organizationId || !plan || !cardNumber || !expirationDate || !cardCode) {
        return res.status(400).json({ error: "Missing required billing information" });
      }

      if (!["starter", "growth", "agency"].includes(plan)) {
        return res.status(400).json({ error: "Invalid subscription plan" });
      }

      const organization = await storage.getOrganization(organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Calculate seat limit based on plan
      const seatLimits: Record<string, number> = { starter: 4, growth: 15, agency: 40 };

      if (!isAuthNetConfigured()) {
        // Demo mode - simulate successful subscription and activate organization
        await storage.updateOrganization(organizationId, { 
          isActive: true,
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          billingStartDate: new Date().toISOString().split("T")[0],
          seatLimit: seatLimits[plan] || 4,
        });
        return res.json({
          success: true,
          message: "Subscription activated (demo mode)",
          plan,
          transactionId: `DEMO-${Date.now()}`,
        });
      }

      const result = await chargeSubscription(
        { cardNumber, expirationDate, cardCode },
        {
          organizationId,
          organizationName: organization.name,
          plan: plan as 'starter' | 'growth' | 'agency',
          email: email || organization.email || '',
        }
      );

      if (result.success) {
        // Activate organization after successful payment
        await storage.updateOrganization(organizationId, { 
          isActive: true,
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          billingStartDate: new Date().toISOString().split("T")[0],
          seatLimit: seatLimits[plan] || 4,
        });
        
        res.json({
          success: true,
          message: "Subscription payment processed successfully",
          plan,
          transactionId: result.transactionId,
          authCode: result.authCode,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.errorMessage || "Payment failed",
        });
      }
    } catch (error) {
      console.error("Subscription billing error:", error);
      res.status(500).json({ error: "Failed to process subscription payment" });
    }
  });

  app.get("/api/billing/status", async (req, res) => {
    try {
      res.json({
        configured: isAuthNetConfigured(),
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch billing status" });
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
      const isTrialExpired = trialEndDate ? today > trialEndDate : false;
      const daysRemaining = trialEndDate 
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
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

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
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

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Fee Schedule routes
  app.get("/api/fee-schedules", async (req, res) => {
    try {
      const feeSchedules = await storage.getFeeSchedules();
      res.json(feeSchedules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fee schedules" });
    }
  });

  app.get("/api/fee-schedules/:id", async (req, res) => {
    try {
      const feeSchedule = await storage.getFeeSchedule(req.params.id);
      if (!feeSchedule) {
        return res.status(404).json({ error: "Fee schedule not found" });
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

  app.patch("/api/fee-schedules/:id", async (req, res) => {
    try {
      const feeSchedule = await storage.updateFeeSchedule(req.params.id, req.body);
      if (!feeSchedule) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update fee schedule" });
    }
  });

  app.delete("/api/fee-schedules/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFeeSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete fee schedule" });
    }
  });

  app.get("/api/collectors", async (req, res) => {
    try {
      const collectors = await storage.getCollectors();
      res.json(collectors);
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

  app.get("/api/collectors/:id", async (req, res) => {
    try {
      const collector = await storage.getCollector(req.params.id);
      if (!collector) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collector" });
    }
  });

  app.post("/api/collectors", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const collector = await storage.createCollector({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to create collector" });
    }
  });

  app.patch("/api/collectors/:id", async (req, res) => {
    try {
      const collector = await storage.updateCollector(req.params.id, req.body);
      if (!collector) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to update collector" });
    }
  });

  app.delete("/api/collectors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCollector(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete collector" });
    }
  });

  app.get("/api/portfolios", async (req, res) => {
    try {
      const portfolios = await storage.getPortfolios();
      res.json(portfolios);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
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

  app.patch("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.updatePortfolio(req.params.id, req.body);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to update portfolio" });
    }
  });

  app.delete("/api/portfolios/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePortfolio(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete portfolio" });
    }
  });

  app.get("/api/debtors", async (req, res) => {
    try {
      const { portfolioId, collectorId } = req.query;
      const debtors = await storage.getDebtors(
        portfolioId as string | undefined,
        collectorId as string | undefined
      );
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debtors" });
    }
  });

  app.get("/api/debtors/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const debtors = await storage.getRecentDebtors(limit);
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent debtors" });
    }
  });

  app.get("/api/debtors/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query.trim()) {
        return res.json([]);
      }
      const debtors = await storage.searchDebtors(query);
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to search debtors" });
    }
  });

  app.get("/api/debtors/:id", async (req, res) => {
    try {
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      res.json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debtor" });
    }
  });

  app.post("/api/debtors", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const debtor = await storage.createDebtor({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to create debtor" });
    }
  });

  app.patch("/api/debtors/:id", async (req, res) => {
    try {
      const debtor = await storage.updateDebtor(req.params.id, req.body);
      if (!debtor) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      res.json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to update debtor" });
    }
  });

  app.delete("/api/debtors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDebtor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete debtor" });
    }
  });

  app.get("/api/debtors/:id/contacts", async (req, res) => {
    try {
      const contacts = await storage.getDebtorContacts(req.params.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/debtors/:id/contacts", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateDebtorContact(req.params.id, req.body);
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
      const records = await storage.getEmploymentRecords(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employment records" });
    }
  });

  app.post("/api/debtors/:id/employment", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.patch("/api/employment/:id", async (req, res) => {
    try {
      const record = await storage.updateEmploymentRecord(req.params.id, req.body);
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
      const references = await storage.getDebtorReferences(req.params.id);
      res.json(references);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch references" });
    }
  });

  app.post("/api/debtors/:id/references", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.patch("/api/references/:id", async (req, res) => {
    try {
      const reference = await storage.updateDebtorReference(req.params.id, req.body);
      if (!reference) {
        return res.status(404).json({ error: "Reference not found" });
      }
      res.json(reference);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reference" });
    }
  });

  app.delete("/api/references/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDebtorReference(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Reference not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reference" });
    }
  });

  app.get("/api/debtors/:id/bank-accounts", async (req, res) => {
    try {
      const accounts = await storage.getBankAccounts(req.params.id);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank accounts" });
    }
  });

  app.post("/api/debtors/:id/bank-accounts", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.get("/api/debtors/:id/cards", async (req, res) => {
    try {
      const cards = await storage.getPaymentCards(req.params.id);
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment cards" });
    }
  });

  app.post("/api/debtors/:id/cards", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const card = await storage.createPaymentCard({
        ...req.body,
        debtorId: req.params.id,
        addedDate: new Date().toISOString().split("T")[0],
        organizationId: orgId,
      });
      res.status(201).json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment card" });
    }
  });

  app.delete("/api/cards/:id", async (req, res) => {
    try {
      const success = await storage.deletePaymentCard(req.params.id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: "Payment card not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payment card" });
    }
  });

  app.get("/api/debtors/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments(req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/debtors/:id/payments", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const payment = await storage.createPayment({
        ...req.body,
        debtorId: req.params.id,
        organizationId: orgId,
      });
      
      if (req.body.amount) {
        const debtor = await storage.getDebtor(req.params.id);
        if (debtor) {
          await storage.updateDebtor(req.params.id, {
            currentBalance: debtor.currentBalance - req.body.amount,
          });
        }
      }
      
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.get("/api/debtors/:id/notes", async (req, res) => {
    try {
      const notes = await storage.getNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/debtors/:id/notes", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.get("/api/payments/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const payments = await storage.getRecentPayments(limit);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent payments" });
    }
  });

  app.get("/api/payments/pending", async (req, res) => {
    try {
      const payments = await storage.getPendingPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  });

  app.get("/api/payment-batches", async (req, res) => {
    try {
      const batches = await storage.getPaymentBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment batches" });
    }
  });

  app.get("/api/payment-batches/:id", async (req, res) => {
    try {
      const batch = await storage.getPaymentBatch(req.params.id);
      if (!batch) {
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
    } catch (error) {
      res.status(500).json({ error: "Failed to run payment batch" });
    }
  });

  app.get("/api/payment-batches/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments(undefined, req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch batch payments" });
    }
  });

  app.post("/api/payment-batches/:id/add-payments", async (req, res) => {
    try {
      const { paymentIds } = req.body;
      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: "Payment IDs required" });
      }
      const batch = await storage.addPaymentsToBatch(req.params.id, paymentIds);
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to add payments to batch" });
    }
  });

  app.get("/api/liquidation/snapshots", async (req, res) => {
    try {
      const { portfolioId } = req.query;
      const snapshots = await storage.getLiquidationSnapshots(portfolioId as string | undefined);
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
  app.get("/api/merchants", async (req, res) => {
    try {
      const merchants = await storage.getMerchants();
      res.json(merchants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch merchants" });
    }
  });

  app.get("/api/merchants/:id", async (req, res) => {
    try {
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch merchant" });
    }
  });

  app.post("/api/merchants", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.patch("/api/merchants/:id", async (req, res) => {
    try {
      const merchant = await storage.updateMerchant(req.params.id, req.body);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to update merchant" });
    }
  });

  app.delete("/api/merchants/:id", async (req, res) => {
    try {
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
      
      if (!ipAddress) {
        return res.status(400).json({ error: "IP address is required" });
      }
      
      const entry = await storage.createIpWhitelistEntry({
        organizationId: orgId,
        ipAddress,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
        createdDate: new Date().toISOString(),
        createdBy: null,
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
      const { isActive, description } = req.body;
      
      // Verify entry belongs to this organization
      const existing = await storage.getIpWhitelistEntry(id);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ error: "IP whitelist entry not found" });
      }
      
      const entry = await storage.updateIpWhitelistEntry(id, { isActive, description });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update IP whitelist entry" });
    }
  });

  app.delete("/api/ip-whitelist/:id", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { id } = req.params;
      
      // Verify entry belongs to this organization
      const existing = await storage.getIpWhitelistEntry(id);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ error: "IP whitelist entry not found" });
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
      const org = await storage.getOrganization(orgId);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({ ipRestrictionEnabled: org.ipRestrictionEnabled ?? false });
    } catch (error) {
      res.status(500).json({ error: "Failed to get IP restriction status" });
    }
  });

  // Time Clock API
  app.get("/api/time-clock", async (req, res) => {
    try {
      const { collectorId, date } = req.query;
      const entries = await storage.getTimeClockEntries(
        collectorId as string | undefined,
        date as string | undefined
      );
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time clock entries" });
    }
  });

  app.get("/api/time-clock/active/:collectorId", async (req, res) => {
    try {
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

  app.post("/api/time-clock/clock-out", async (req, res) => {
    try {
      const { collectorId } = req.body;
      const entry = await storage.getActiveTimeClockEntry(collectorId);
      if (!entry) {
        return res.status(400).json({ error: "Not clocked in" });
      }
      const clockOut = new Date();
      const clockIn = new Date(entry.clockIn);
      const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const updated = await storage.updateTimeClockEntry(entry.id, {
        clockOut: clockOut.toISOString(),
        totalMinutes,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  // Payments by date (for Payment Runner)
  app.get("/api/payments/by-date", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ error: "Date parameter required" });
      }
      const payments = await storage.getPaymentsByDate(date as string);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments by date" });
    }
  });

  // Get all payments
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
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

      const debtor = await storage.getDebtor(payment.debtorId);
      let success = false;
      let declineReason: string | null = null;
      let transactionId: string | null = null;

      // Get organization's active Authorize.net merchant
      const merchants = await storage.getMerchants(orgId);
      const activeMerchant = merchants.find(
        m => m.isActive && m.processorType === 'authorize_net' && m.authorizeNetApiLoginId && m.authorizeNetTransactionKey
      );

      if (activeMerchant) {
        const merchantCredentials: MerchantCredentials = {
          apiLoginId: activeMerchant.authorizeNetApiLoginId!,
          transactionKey: activeMerchant.authorizeNetTransactionKey!,
          testMode: activeMerchant.testMode ?? true,
        };

        if (payment.paymentMethod === "card" && payment.cardId) {
          const card = await storage.getPaymentCard(payment.cardId);
          if (card && card.cardNumber) {
            const result = await processDebtorCardPayment(
              merchantCredentials,
              {
                cardNumber: card.cardNumber,
                expirationDate: `${card.expiryMonth}${card.expiryYear.slice(-2)}`,
                cardCode: card.cvv || "999",
              },
              payment.amount / 100,
              payment.referenceNumber || undefined,
              debtor?.email || undefined
            );
            success = result.success;
            declineReason = result.errorMessage || null;
            transactionId = result.transactionId || null;
          } else {
            declineReason = "Card not found or missing card details";
          }
        } else if (payment.paymentMethod === "ach") {
          const bankAccounts = await storage.getBankAccounts(payment.debtorId);
          const bankAccount = bankAccounts[0];
          if (bankAccount) {
            const result = await processDebtorAchPayment(
              merchantCredentials,
              {
                accountType: bankAccount.accountType as 'checking' | 'savings',
                routingNumber: bankAccount.routingNumber || '',
                accountNumber: bankAccount.accountNumber || '',
                nameOnAccount: debtor ? `${debtor.firstName} ${debtor.lastName}` : 'Account Holder',
              },
              payment.amount / 100,
              payment.referenceNumber || undefined
            );
            success = result.success;
            declineReason = result.errorMessage || null;
            transactionId = result.transactionId || null;
          } else {
            declineReason = "No bank account on file";
          }
        } else if (payment.paymentMethod === "check") {
          success = true;
        } else {
          declineReason = "Unsupported payment method or missing card";
        }
      } else {
        // No merchant configured - simulate for demo
        success = Math.random() > 0.2;
        declineReason = success ? null : "No merchant configured - simulated decline";
      }
      
      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: success ? "processed" : "declined",
        notes: success 
          ? (transactionId ? `${payment.notes || ''} [TXN: ${transactionId}]`.trim() : payment.notes) 
          : `DECLINED: ${declineReason}`,
      });

      // If declined, add decline reason to debtor notes
      if (!success && debtor) {
        await storage.createNote({
          debtorId: payment.debtorId,
          collectorId: payment.processedBy || "system",
          content: `Payment of $${(payment.amount / 100).toFixed(2)} DECLINED: ${declineReason}`,
          noteType: "payment",
          createdDate: new Date().toISOString().split("T")[0],
          organizationId: orgId,
        });
      }

      res.json({ ...updatedPayment, declineReason, transactionId });
    } catch (error) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // Re-run a failed payment
  app.post("/api/payments/:id/rerun", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      await storage.updatePayment(req.params.id, { status: "pending" });

      const debtor = await storage.getDebtor(payment.debtorId);
      let success = false;
      let declineReason: string | null = null;
      let transactionId: string | null = null;

      // Get organization's merchant
      const merchants = await storage.getMerchants(orgId);
      const activeMerchant = merchants.find(
        m => m.isActive && m.processorType === 'authorize_net' && m.authorizeNetApiLoginId && m.authorizeNetTransactionKey
      );

      if (activeMerchant) {
        const merchantCredentials: MerchantCredentials = {
          apiLoginId: activeMerchant.authorizeNetApiLoginId!,
          transactionKey: activeMerchant.authorizeNetTransactionKey!,
          testMode: activeMerchant.testMode ?? true,
        };

        if (payment.paymentMethod === "card" && payment.cardId) {
          const card = await storage.getPaymentCard(payment.cardId);
          if (card && card.cardNumber) {
            const result = await processDebtorCardPayment(
              merchantCredentials,
              {
                cardNumber: card.cardNumber,
                expirationDate: `${card.expiryMonth}${card.expiryYear.slice(-2)}`,
                cardCode: card.cvv || "999",
              },
              payment.amount / 100,
              payment.referenceNumber || undefined,
              debtor?.email || undefined
            );
            success = result.success;
            declineReason = result.errorMessage || null;
            transactionId = result.transactionId || null;
          } else {
            declineReason = "Card not found";
          }
        } else if (payment.paymentMethod === "ach") {
          const bankAccounts = await storage.getBankAccounts(payment.debtorId);
          const bankAccount = bankAccounts[0];
          if (bankAccount) {
            const result = await processDebtorAchPayment(
              merchantCredentials,
              {
                accountType: bankAccount.accountType as 'checking' | 'savings',
                routingNumber: bankAccount.routingNumber || '',
                accountNumber: bankAccount.accountNumber || '',
                nameOnAccount: debtor ? `${debtor.firstName} ${debtor.lastName}` : 'Account Holder',
              },
              payment.amount / 100,
              payment.referenceNumber || undefined
            );
            success = result.success;
            declineReason = result.errorMessage || null;
            transactionId = result.transactionId || null;
          } else {
            declineReason = "No bank account on file";
          }
        } else if (payment.paymentMethod === "check") {
          success = true;
        } else {
          declineReason = "Unsupported payment method";
        }
      } else {
        success = Math.random() > 0.3;
        declineReason = success ? null : "No merchant configured - simulated decline";
      }
      
      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: success ? "processed" : "declined",
        notes: success 
          ? (transactionId ? `Re-run successful [TXN: ${transactionId}]` : "Re-run successful")
          : `DECLINED: ${declineReason}`,
      });

      if (!success && debtor) {
        await storage.createNote({
          debtorId: payment.debtorId,
          collectorId: payment.processedBy || "system",
          content: `Payment re-run of $${(payment.amount / 100).toFixed(2)} DECLINED: ${declineReason}`,
          noteType: "payment",
          createdDate: new Date().toISOString().split("T")[0],
          organizationId: orgId,
        });
      }

      res.json({ ...updatedPayment, declineReason, transactionId });
    } catch (error) {
      console.error("Payment rerun error:", error);
      res.status(500).json({ error: "Failed to re-run payment" });
    }
  });

  // Reverse a processed payment (admin/manager only)
  app.post("/api/payments/:id/reverse", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { reason, collectorId } = req.body;
      
      // Check for admin/manager permission
      if (collectorId) {
        const collector = await storage.getCollector(collectorId);
        if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
          return res.status(403).json({ error: "Only admins and managers can reverse payments" });
        }
      }

      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
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
        (p) => p.status === "pending" && new Date(p.paymentDate) > new Date()
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

      res.json({ ...updatedPayment, cancelledPayments: futurePayments.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to reverse payment" });
    }
  });

  // Post a single processed payment (admin/manager only)
  app.post("/api/payments/:id/post", async (req, res) => {
    try {
      const { collectorId } = req.body;
      
      // Check for admin/manager permission
      if (collectorId) {
        const collector = await storage.getCollector(collectorId);
        if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
          return res.status(403).json({ error: "Only admins and managers can post payments" });
        }
      }

      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      if (payment.status !== "processed") {
        return res.status(400).json({ error: "Only processed payments can be posted" });
      }

      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: "posted",
      });

      // Add note to debtor account
      await storage.createNote({
        debtorId: payment.debtorId,
        collectorId: payment.processedBy || "system",
        content: `Payment of $${(payment.amount / 100).toFixed(2)} POSTED successfully.`,
        noteType: "payment",
        createdDate: new Date().toISOString().split("T")[0],
        organizationId: DEFAULT_ORG_ID,
      });

      res.json(updatedPayment);
    } catch (error) {
      res.status(500).json({ error: "Failed to post payment" });
    }
  });

  // Post all processed payments in bulk (admin/manager only)
  app.post("/api/payments/post-all-processed", async (req, res) => {
    try {
      const { collectorId } = req.body;
      
      // Check for admin/manager permission
      if (collectorId) {
        const collector = await storage.getCollector(collectorId);
        if (!collector || (collector.role !== "admin" && collector.role !== "manager")) {
          return res.status(403).json({ error: "Only admins and managers can post payments" });
        }
      }

      const payments = await storage.getPayments();
      const processedPayments = payments.filter((p) => p.status === "processed");
      
      let count = 0;
      for (const payment of processedPayments) {
        await storage.updatePayment(payment.id, {
          status: "posted",
        });
        
        // Add note to each debtor account
        await storage.createNote({
          debtorId: payment.debtorId,
          collectorId: payment.processedBy || "system",
          content: `Payment of $${(payment.amount / 100).toFixed(2)} POSTED successfully (bulk post).`,
          noteType: "payment",
          createdDate: new Date().toISOString().split("T")[0],
          organizationId: DEFAULT_ORG_ID,
        });
        count++;
      }

      res.json({ count, message: `${count} payments posted successfully` });
    } catch (error) {
      res.status(500).json({ error: "Failed to post payments" });
    }
  });

  // Import Batches API
  app.get("/api/import-batches", async (req, res) => {
    try {
      const batches = await storage.getImportBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import batches" });
    }
  });

  app.get("/api/import-batches/:id", async (req, res) => {
    try {
      const batch = await storage.getImportBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Import batch not found" });
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
      const batch = await storage.updateImportBatch(req.params.id, req.body);
      if (!batch) {
        return res.status(404).json({ error: "Import batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update import batch" });
    }
  });

  // Import Mappings API
  app.get("/api/import-mappings", async (req, res) => {
    try {
      const { importType } = req.query;
      const mappings = await storage.getImportMappings(importType as string | undefined);
      res.json(mappings);
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
      const deleted = await storage.deleteImportMapping(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Import mapping not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete import mapping" });
    }
  });

  // Import Data API - handles partial imports, upserts, and SSN-based linking
  app.post("/api/import/debtors", async (req, res) => {
    try {
      const { portfolioId, clientId, records, mappings, fileNumberStart } = req.body as { portfolioId: string; clientId: string; records: any[]; mappings: Record<string, string>; fileNumberStart?: number };
      
      if (!portfolioId || !clientId || !records || !mappings) {
        return res.status(400).json({ error: "Missing required fields: portfolioId, clientId, records, mappings" });
      }
      
      const startingFileNumber = fileNumberStart || 1;

      const results = {
        created: 0,
        updated: 0,
        linked: 0,
        errors: [] as string[],
      };

      const existingDebtors = await storage.getDebtors(portfolioId);
      const allDebtors = await storage.getDebtors();

      for (const record of records) {
        try {
          const mappedData: any = {};
          
          for (const [csvColumn, systemField] of Object.entries(mappings)) {
            if (systemField && systemField !== "skip" && record[csvColumn] !== undefined) {
              let value = record[csvColumn];
              
              if (systemField === "originalBalance" || systemField === "currentBalance") {
                value = Math.round(parseFloat(value.replace(/[$,]/g, '')) * 100) || 0;
              }
              
              mappedData[systemField] = value;
            }
          }

          if (!mappedData.accountNumber && !mappedData.ssn) {
            results.errors.push(`Row missing account number and SSN - skipped`);
            continue;
          }

          const existingInPortfolio = existingDebtors.find(
            (d) => (mappedData.accountNumber && d.accountNumber === mappedData.accountNumber) ||
                   (mappedData.ssn && d.ssn === mappedData.ssn)
          );

          if (existingInPortfolio) {
            await storage.updateDebtor(existingInPortfolio.id, mappedData);
            results.updated++;
            continue;
          }

          let linkedAccountId: string | null = null;
          if (mappedData.ssn) {
            const linkedDebtor = allDebtors.find(
              (d) => d.ssn === mappedData.ssn && d.portfolioId !== portfolioId
            );
            if (linkedDebtor) {
              linkedAccountId = linkedDebtor.id;
              results.linked++;
            }
          }

          // Always auto-generate file number: FN-{YYYY}-{sequential}
          const year = new Date().getFullYear();
          const seq = (startingFileNumber + results.created).toString().padStart(6, '0');
          const autoFileNumber = `FN-${year}-${seq}`;

          // Collect unmapped columns as custom fields
          const knownFields = new Set([
            'accountNumber', 'firstName', 'lastName', 'email', 'address', 'city', 'state', 'zipCode',
            'dateOfBirth', 'ssn', 'ssnLast4', 'originalBalance', 'currentBalance', 'originalCreditor',
            'clientName', 'fileNumber', 'status', 'lastContactDate', 'nextFollowUpDate',
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
            clientId,
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
            fileNumber: autoFileNumber,
            status: mappedData.status || "open",
            lastContactDate: mappedData.lastContactDate || null,
            nextFollowUpDate: mappedData.nextFollowUpDate || null,
            customFields: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
            organizationId: DEFAULT_ORG_ID,
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
                organizationId: DEFAULT_ORG_ID,
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
                organizationId: DEFAULT_ORG_ID,
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
              organizationId: DEFAULT_ORG_ID,
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
                organizationId: DEFAULT_ORG_ID,
              });
            }
          }

          results.created++;
        } catch (err: any) {
          results.errors.push(err.message || "Unknown error processing record");
        }
      }

      const portfolio = await storage.getPortfolio(portfolioId);
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
        message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.linked} linked across portfolios`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import debtors" });
    }
  });

  // Import Contacts API - adds contacts to existing debtors
  app.post("/api/import/contacts", async (req, res) => {
    try {
      const { portfolioId, records, mappings } = req.body as { portfolioId: string; records: any[]; mappings: Record<string, string> };
      
      if (!portfolioId || !records || !mappings) {
        return res.status(400).json({ error: "Missing required fields: portfolioId, records, mappings" });
      }

      const results = {
        added: 0,
        matched: 0,
        errors: [] as string[],
      };

      const debtors = await storage.getDebtors(portfolioId);

      for (const record of records) {
        try {
          const mappedData: any = {};
          
          for (const [csvColumn, systemField] of Object.entries(mappings)) {
            if (systemField && systemField !== "skip" && record[csvColumn] !== undefined) {
              mappedData[systemField] = record[csvColumn];
            }
          }

          let matchedDebtor = null;
          if (mappedData.accountNumber) {
            matchedDebtor = debtors.find((d) => d.accountNumber === mappedData.accountNumber);
          } else if (mappedData.ssn) {
            matchedDebtor = debtors.find((d) => d.ssn === mappedData.ssn);
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
              organizationId: DEFAULT_ORG_ID,
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
              organizationId: DEFAULT_ORG_ID,
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
  app.get("/api/drop-batches", async (req, res) => {
    try {
      const batches = await storage.getDropBatches();
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

  app.patch("/api/drop-batches/:id", async (req, res) => {
    try {
      const batch = await storage.updateDropBatch(req.params.id, req.body);
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
      const { batchId, collectorId } = req.query;
      const items = await storage.getDropItems(
        batchId as string | undefined,
        collectorId as string | undefined
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop items" });
    }
  });

  app.post("/api/drop-items", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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
  app.get("/api/recall-batches", async (req, res) => {
    try {
      const batches = await storage.getRecallBatches();
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
  app.get("/api/recall-items/:batchId", async (req, res) => {
    try {
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

  app.patch("/api/recall-items/:id", async (req, res) => {
    try {
      const item = await storage.updateRecallItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Recall item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recall item" });
    }
  });

  // Consolidation Companies API
  app.get("/api/consolidation-companies", async (req, res) => {
    try {
      const companies = await storage.getConsolidationCompanies();
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

  app.patch("/api/consolidation-companies/:id", async (req, res) => {
    try {
      const company = await storage.updateConsolidationCompany(req.params.id, req.body);
      if (!company) {
        return res.status(404).json({ error: "Consolidation company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update consolidation company" });
    }
  });

  app.delete("/api/consolidation-companies/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteConsolidationCompany(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Consolidation company not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete consolidation company" });
    }
  });

  // Consolidation Cases API
  app.get("/api/consolidation-cases", async (req, res) => {
    try {
      const { debtorId, companyId } = req.query;
      const cases = await storage.getConsolidationCases(
        debtorId as string | undefined,
        companyId as string | undefined
      );
      res.json(cases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consolidation cases" });
    }
  });

  app.post("/api/consolidation-cases", async (req, res) => {
    try {
      const orgId = getOrgId(req);
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

  app.patch("/api/consolidation-cases/:id", async (req, res) => {
    try {
      const caseData = await storage.updateConsolidationCase(req.params.id, req.body);
      if (!caseData) {
        return res.status(404).json({ error: "Consolidation case not found" });
      }
      res.json(caseData);
    } catch (error) {
      res.status(500).json({ error: "Failed to update consolidation case" });
    }
  });

  // Work Queue API
  app.get("/api/work-queue/:collectorId", async (req, res) => {
    try {
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

  app.post("/api/work-queue", async (req, res) => {
    try {
      const item = await storage.createWorkQueueItem({
        ...req.body,
        assignedDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add to work queue" });
    }
  });

  app.patch("/api/work-queue/:id", async (req, res) => {
    try {
      const item = await storage.updateWorkQueueItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update work queue item" });
    }
  });

  app.delete("/api/work-queue/:id", async (req, res) => {
    try {
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
      const remittances = await storage.getRemittances(
        status as string | undefined,
        portfolioId as string | undefined
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

  app.patch("/api/remittances/:id", async (req, res) => {
    try {
      const remittance = await storage.updateRemittance(req.params.id, req.body);
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
      const items = await storage.getRemittanceItems(
        remittanceId as string | undefined,
        status as string | undefined
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

  app.patch("/api/remittance-items/:id", async (req, res) => {
    try {
      const item = await storage.updateRemittanceItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Remittance item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update remittance item" });
    }
  });

  // Register external API routes for SMS/TXT software integration
  registerExternalApiRoutes(app);

  return httpServer;
}
