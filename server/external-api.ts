import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import crypto from "crypto";

interface AuthenticatedRequest extends Request {
  apiToken?: {
    id: string;
    name: string;
    permissions: string[] | null;
    organizationId: string | null;
  };
}

async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Bearer token required" });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const apiToken = await storage.getApiTokenByToken(token);
    
    if (!apiToken) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }
    
    if (!apiToken.isActive) {
      return res.status(401).json({ error: "Unauthorized", message: "Token is inactive" });
    }
    
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Unauthorized", message: "Token has expired" });
    }
    
    await storage.updateApiTokenLastUsed(apiToken.id);
    
    req.apiToken = {
      id: apiToken.id,
      name: apiToken.name,
      permissions: apiToken.permissions,
      organizationId: apiToken.organizationId,
    };
    
    // Require organizationId for secure multi-tenant access
    // Legacy tokens without orgId are rejected for security
    if (!apiToken.organizationId) {
      return res.status(403).json({ 
        error: "Token requires organization context", 
        message: "Please re-authenticate to obtain a token with organization access" 
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}

export function registerExternalApiRoutes(app: Express) {
  
  // POST /api/v2/login - Generate or validate token
  app.post("/api/v2/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      const collector = await storage.getCollectorByUsername(username);
      
      if (!collector || collector.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = crypto.randomBytes(32).toString("hex");
      
      const apiToken = await storage.createApiToken({
        organizationId: collector.organizationId,
        name: `Session token for ${username}`,
        token,
        isActive: true,
        permissions: ["all"],
        createdDate: new Date().toISOString().split("T")[0],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      res.json({
        success: true,
        token,
        expiresAt: apiToken.expiresAt,
        user: {
          id: collector.id,
          name: collector.name,
          role: collector.role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // GET /api/v2/getportfoliolist - Get all portfolios
  app.get("/api/v2/getportfoliolist", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.apiToken?.organizationId;
      let portfolios = await storage.getPortfolios();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        portfolios = portfolios.filter((p) => p.organizationId === orgId);
      }
      
      res.json({
        success: true,
        data: portfolios.map((p) => ({
          portfolioId: p.id,
          name: p.name,
          clientId: p.clientId,
          purchaseDate: p.purchaseDate,
          totalAccounts: p.totalAccounts,
          totalFaceValue: p.totalFaceValue,
          status: p.status,
          creditorName: p.creditorName,
          debtType: p.debtType,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  // GET /api/v2/getaccountbysocial/:ssn - Get account by SSN
  app.get("/api/v2/getaccountbysocial/:ssn", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { ssn } = req.params;
      const orgId = req.apiToken?.organizationId;
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      const matches = debtors.filter((d) => d.ssn === ssn || d.ssnLast4 === ssn);
      
      if (matches.length === 0) {
        return res.status(404).json({ error: "No account found for SSN" });
      }
      
      res.json({
        success: true,
        data: matches.map((d) => formatDebtorForApi(d)),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // POST /api/v2/get_accounts_in_portfolio - Get accounts in a portfolio
  app.post("/api/v2/get_accounts_in_portfolio", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { portfolioId, limit, offset } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!portfolioId) {
        return res.status(400).json({ error: "portfolioId is required" });
      }
      
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      let filtered = debtors.filter((d) => d.portfolioId === portfolioId);
      
      const total = filtered.length;
      
      if (offset) {
        filtered = filtered.slice(offset);
      }
      if (limit) {
        filtered = filtered.slice(0, limit);
      }
      
      res.json({
        success: true,
        total,
        data: filtered.map((d) => formatDebtorForApi(d)),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  // GET /api/v2/getaccount/:filenumber - Get single account by file number
  app.get("/api/v2/getaccount/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      res.json({
        success: true,
        data: formatDebtorForApi(debtor),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // GET /api/v2/getphones/:filenumber - Get phone numbers for account
  app.get("/api/v2/getphones/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const phones = contacts.filter((c) => c.type === "phone");
      
      res.json({
        success: true,
        data: phones.map((p) => ({
          id: p.id,
          phoneNumber: p.value,
          label: p.label,
          isPrimary: p.isPrimary,
          isValid: p.isValid,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch phones" });
    }
  });

  // GET /api/v2/getemails/:filenumber - Get emails for account
  app.get("/api/v2/getemails/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const emails = contacts.filter((c) => c.type === "email");
      
      res.json({
        success: true,
        data: emails.map((e) => ({
          id: e.id,
          emailAddress: e.value,
          label: e.label,
          isPrimary: e.isPrimary,
          isValid: e.isValid,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // GET /api/v2/getnotes/:filenumber - Get notes for account
  app.get("/api/v2/getnotes/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const notes = await storage.getNotes(debtor.id);
      
      res.json({
        success: true,
        data: notes.map((n: any) => ({
          id: n.id,
          content: n.content,
          noteType: n.noteType,
          collectorId: n.collectorId,
          createdDate: n.createdDate,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // GET /api/v2/getpayments/:filenumber - Get payments for account
  app.get("/api/v2/getpayments/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const payments = await storage.getPayments(debtor.id);
      
      res.json({
        success: true,
        data: payments.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          status: p.status,
          referenceNumber: p.referenceNumber,
          notes: p.notes,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // GET /api/v2/getattempts/:filenumber - Get communication attempts for account
  app.get("/api/v2/getattempts/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      
      res.json({
        success: true,
        data: attempts.map((a) => ({
          id: a.id,
          attemptType: a.attemptType,
          direction: a.direction,
          phoneNumber: a.phoneNumber,
          emailAddress: a.emailAddress,
          outcome: a.outcome,
          duration: a.duration,
          notes: a.notes,
          createdDate: a.createdDate,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attempts" });
    }
  });

  // POST /api/v2/insertphone - Add phone to account
  app.post("/api/v2/insertphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, label, isPrimary, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !phoneNumber) {
        return res.status(400).json({ error: "fileNumber and phoneNumber are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contact = await storage.createDebtorContact({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        type: "phone",
        value: phoneNumber,
        label: label || null,
        isPrimary: isPrimary || false,
      });
      
      res.json({
        success: true,
        data: {
          id: contact.id,
          phoneNumber: contact.value,
          label: contact.label,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert phone" });
    }
  });

  // PUT /api/v2/updatephone - Update phone
  app.put("/api/v2/updatephone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneId, phoneNumber, label, isPrimary, isBad, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneId) {
        return res.status(400).json({ error: "phoneId is required" });
      }
      
      // Verify organization ownership by checking if contact belongs to org
      const existingContact = await storage.getDebtorContact(phoneId);
      if (!existingContact) {
        return res.status(404).json({ error: "Phone not found" });
      }
      
      if (orgId && existingContact.organizationId !== orgId) {
        return res.status(404).json({ error: "Phone not found" });
      }
      
      const contact = await storage.updateDebtorContact(phoneId, {
        value: phoneNumber,
        label,
        isPrimary,
        isValid: isBad === undefined ? undefined : !isBad,
      });
      
      res.json({
        success: true,
        data: contact,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update phone" });
    }
  });

  // POST /api/v2/insertattempt - Insert communication attempt
  app.post("/api/v2/insertattempt", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, attemptType, direction, phoneNumber, emailAddress, outcome, duration, notes, externalId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !attemptType) {
        return res.status(400).json({ error: "fileNumber and attemptType are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType,
        direction: direction || "outbound",
        phoneNumber: phoneNumber || null,
        emailAddress: emailAddress || null,
        outcome: outcome || null,
        duration: duration || null,
        notes: notes || null,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      res.json({
        success: true,
        data: attempt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert attempt" });
    }
  });

  // POST /api/v2/InsertNoteline - Insert note
  app.post("/api/v2/InsertNoteline", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, content, noteType } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !content) {
        return res.status(400).json({ error: "fileNumber and content are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const note = await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert note" });
    }
  });

  // PUT /api/v2/updatedbase - Update debtor fields
  app.put("/api/v2/updatedbase", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, ...updates } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber) {
        return res.status(400).json({ error: "fileNumber is required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const allowedFields = ["email", "address", "city", "state", "zipCode", "status", "lastContactDate", "nextFollowUpDate"];
      const filteredUpdates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }
      
      const updated = await storage.updateDebtor(debtor.id, filteredUpdates);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // PUT /api/v2/updatepermissions - Update contact permissions (consent)
  app.put("/api/v2/updatepermissions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, canCall, canText, canEmail } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber) {
        return res.status(400).json({ error: "fileNumber is required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      
      for (const contact of contacts) {
        if (contact.type === "phone" && canCall !== undefined) {
          await storage.updateDebtorContact(contact.id, { isValid: canCall });
        }
        if (contact.type === "email" && canEmail !== undefined) {
          await storage.updateDebtorContact(contact.id, { isValid: canEmail });
        }
      }
      
      res.json({
        success: true,
        message: "Permissions updated",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // POST /api/v2/searchbyphone - Search accounts by phone number
  app.post("/api/v2/searchbyphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneNumber } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      const results: any[] = [];
      
      for (const debtor of debtors) {
        const contacts = await storage.getDebtorContacts(debtor.id);
        const phoneMatch = contacts.find((c) => c.type === "phone" && c.value.replace(/\D/g, "").includes(cleanPhone));
        
        if (phoneMatch) {
          results.push({
            ...formatDebtorForApi(debtor),
            matchedPhone: phoneMatch.value,
          });
        }
      }
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to search by phone" });
    }
  });

  // POST /api/v2/send_text - Record outbound text (webhook endpoint for SMS software)
  app.post("/api/v2/send_text", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, message, externalId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !phoneNumber || !message) {
        return res.status(400).json({ error: "fileNumber, phoneNumber, and message are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "text",
        direction: "outbound",
        phoneNumber,
        outcome: "sent",
        notes: message,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content: `SMS sent to ${phoneNumber}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          status: "sent",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record text" });
    }
  });

  // POST /api/v2/send_email_c2c - Record outbound email
  app.post("/api/v2/send_email_c2c", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, emailAddress, subject, body, externalId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !emailAddress) {
        return res.status(400).json({ error: "fileNumber and emailAddress are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "email",
        direction: "outbound",
        emailAddress,
        outcome: "sent",
        notes: subject || null,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content: `Email sent to ${emailAddress}: ${subject || "(no subject)"}`,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          status: "sent",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record email" });
    }
  });

  // POST /api/v2/insert_payments_external - Insert payment from external system
  app.post("/api/v2/insert_payments_external", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, amount, paymentMethod, paymentDate, referenceNumber, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !amount) {
        return res.status(400).json({ error: "fileNumber and amount are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const payment = await storage.createPayment({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        amount: Math.round(amount * 100),
        paymentDate: paymentDate || new Date().toISOString().split("T")[0],
        paymentMethod: paymentMethod || "external",
        status: "pending",
        notes: notes || null,
      });
      
      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert payment" });
    }
  });

  // POST /api/v2/createCallback - Create a callback/follow-up
  app.post("/api/v2/createCallback", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, callbackDate, callbackTime, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !callbackDate) {
        return res.status(400).json({ error: "fileNumber and callbackDate are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await storage.updateDebtor(debtor.id, {
        nextFollowUpDate: callbackDate,
      });
      
      if (notes) {
        await storage.createNote({
          organizationId: debtor.organizationId,
          debtorId: debtor.id,
          collectorId: "system",
          content: `Callback scheduled for ${callbackDate}${callbackTime ? " at " + callbackTime : ""}: ${notes}`,
          createdDate: new Date().toISOString().split("T")[0],
        });
      }
      
      res.json({
        success: true,
        message: "Callback created",
        callbackDate,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create callback" });
    }
  });

  // GET /api/v2/getemailstats/:filenumber - Get email stats for account
  app.get("/api/v2/getemailstats/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      const emailAttempts = attempts.filter((a) => a.attemptType === "email");
      
      res.json({
        success: true,
        data: {
          totalSent: emailAttempts.filter((a) => a.outcome === "sent").length,
          totalDelivered: emailAttempts.filter((a) => a.outcome === "delivered").length,
          totalOpened: emailAttempts.filter((a) => a.outcome === "opened").length,
          totalClicked: emailAttempts.filter((a) => a.outcome === "clicked").length,
          totalBounced: emailAttempts.filter((a) => a.outcome === "bounced").length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email stats" });
    }
  });

  // ============================================
  // SOFT PHONE / DIALER INTEGRATION ENDPOINTS
  // ============================================

  // GET /api/v2/softphone/queue - Get call queue/worklist for dialer
  app.get("/api/v2/softphone/queue", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { collectorId, status, limit, portfolioId } = req.query;
      const orgId = req.apiToken?.organizationId;
      
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      if (portfolioId) {
        debtors = debtors.filter((d) => d.portfolioId === portfolioId);
      }
      
      if (collectorId) {
        debtors = debtors.filter((d) => d.assignedCollectorId === collectorId);
      }
      
      if (status) {
        debtors = debtors.filter((d) => d.status === status);
      }
      
      debtors = debtors.filter((d) => d.status !== "paid" && d.status !== "closed" && d.status !== "bankrupt");
      
      if (limit) {
        debtors = debtors.slice(0, parseInt(limit as string, 10));
      }
      
      const queueItems = await Promise.all(
        debtors.map(async (debtor) => {
          const contacts = await storage.getDebtorContacts(debtor.id);
          const phones = contacts.filter((c) => c.type === "phone" && c.isValid !== false);
          
          return {
            fileNumber: debtor.fileNumber,
            accountNumber: debtor.accountNumber,
            firstName: debtor.firstName,
            lastName: debtor.lastName,
            fullName: `${debtor.firstName} ${debtor.lastName}`,
            currentBalance: debtor.currentBalance,
            status: debtor.status,
            priority: (debtor as any).priority || "normal",
            lastContactDate: debtor.lastContactDate,
            nextFollowUpDate: debtor.nextFollowUpDate,
            assignedCollectorId: debtor.assignedCollectorId,
            phones: phones.map((p) => ({
              id: p.id,
              number: p.value,
              label: p.label,
              isPrimary: p.isPrimary,
            })),
          };
        })
      );
      
      res.json({
        success: true,
        total: queueItems.length,
        data: queueItems,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch call queue" });
    }
  });

  // POST /api/v2/softphone/initiate - Initiate/log an outbound call
  app.post("/api/v2/softphone/initiate", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, collectorId, callerId, externalCallId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !phoneNumber) {
        return res.status(400).json({ error: "fileNumber and phoneNumber are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization access
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "call",
        direction: "outbound",
        phoneNumber,
        outcome: "initiated",
        notes: externalCallId ? `Call ID: ${externalCallId}` : null,
        externalId: externalCallId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.updateDebtor(debtor.id, {
        lastContactDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          fileNumber: debtor.fileNumber,
          debtorName: `${debtor.firstName} ${debtor.lastName}`,
          currentBalance: debtor.currentBalance,
          status: "call_initiated",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate call" });
    }
  });

  // POST /api/v2/softphone/result - Log call result/outcome
  app.post("/api/v2/softphone/result", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { 
        fileNumber, 
        attemptId, 
        externalCallId,
        outcome, 
        duration, 
        disposition, 
        notes,
        phoneNumber,
        recordingUrl 
      } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber && !attemptId && !externalCallId) {
        return res.status(400).json({ error: "fileNumber, attemptId, or externalCallId is required" });
      }
      
      if (!outcome) {
        return res.status(400).json({ error: "outcome is required" });
      }
      
      let debtor;
      if (fileNumber) {
        debtor = await storage.getDebtorByFileNumber(fileNumber);
        if (!debtor) {
          return res.status(404).json({ error: "Account not found" });
        }
        // Verify organization access
        if (orgId && debtor.organizationId !== orgId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      if (debtor) {
        await storage.createCommunicationAttempt({
          debtorId: debtor.id,
          attemptType: "call",
          direction: "outbound",
          phoneNumber: phoneNumber || null,
          outcome,
          duration: duration || null,
          notes: notes || null,
          externalId: externalCallId || null,
          createdDate: new Date().toISOString(),
        });
        
        if (disposition) {
          const dispositionNotes = [
            `Call Result: ${outcome}`,
            disposition ? `Disposition: ${disposition}` : null,
            duration ? `Duration: ${duration}s` : null,
            recordingUrl ? `Recording: ${recordingUrl}` : null,
            notes ? `Notes: ${notes}` : null,
          ].filter(Boolean).join(" | ");
          
          await storage.createNote({
            organizationId: debtor.organizationId,
            debtorId: debtor.id,
            collectorId: "system",
            content: dispositionNotes,
            createdDate: new Date().toISOString().split("T")[0],
          });
          
          const statusMap: Record<string, string> = {
            "connected": "1st_message",
            "promise_to_pay": "promise",
            "payment_made": "promise",
            "wrong_number": "newbiz",
            "disconnected": "bad_number",
            "no_answer": "newbiz",
            "voicemail": "1st_message",
            "busy": "newbiz",
            "callback": "callback",
          };
          
          if (statusMap[disposition]) {
            await storage.updateDebtor(debtor.id, {
              status: statusMap[disposition],
            });
          }
        }
      }
      
      res.json({
        success: true,
        message: "Call result recorded",
        data: {
          outcome,
          disposition,
          duration,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record call result" });
    }
  });

  // POST /api/v2/softphone/disposition - Set call disposition
  app.post("/api/v2/softphone/disposition", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { 
        fileNumber, 
        disposition, 
        promiseAmount, 
        promiseDate, 
        callbackDate, 
        callbackTime,
        notes 
      } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !disposition) {
        return res.status(400).json({ error: "fileNumber and disposition are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization access
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const dispositionMap: Record<string, string> = {
        "connected": "1st_message",
        "left_message": "1st_message",
        "promise": "promise",
        "promise_to_pay": "promise",
        "payment": "promise",
        "no_answer": "newbiz",
        "voicemail": "1st_message",
        "busy": "newbiz",
        "wrong_number": "bad_number",
        "disconnected": "bad_number",
        "callback": "callback",
        "refused": "final",
        "dispute": "dispute",
        "cease_desist": "cease_desist",
        "attorney": "attorney",
        "deceased": "deceased",
        "bankrupt": "bankrupt",
      };
      
      const updates: Record<string, any> = {
        lastContactDate: new Date().toISOString().split("T")[0],
      };
      
      if (dispositionMap[disposition]) {
        updates.status = dispositionMap[disposition];
      }
      
      if (callbackDate) {
        updates.nextFollowUpDate = callbackDate;
      }
      
      await storage.updateDebtor(debtor.id, updates);
      
      let noteContent = `Disposition: ${disposition}`;
      if (promiseAmount) noteContent += ` | Promise Amount: $${promiseAmount}`;
      if (promiseDate) noteContent += ` | Promise Date: ${promiseDate}`;
      if (callbackDate) noteContent += ` | Callback: ${callbackDate}${callbackTime ? " at " + callbackTime : ""}`;
      if (notes) noteContent += ` | ${notes}`;
      
      await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content: noteContent,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      if (promiseAmount && promiseDate) {
        await storage.createPayment({
          organizationId: debtor.organizationId,
          debtorId: debtor.id,
          amount: Math.round(parseFloat(promiseAmount) * 100),
          paymentDate: promiseDate,
          paymentMethod: "pending",
          status: "scheduled",
          notes: `Promise from call disposition`,
        });
      }
      
      res.json({
        success: true,
        message: "Disposition recorded",
        data: {
          fileNumber: debtor.fileNumber,
          disposition,
          newStatus: updates.status || debtor.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record disposition" });
    }
  });

  // GET /api/v2/softphone/dispositions - Get available disposition codes
  app.get("/api/v2/softphone/dispositions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const dispositions = [
        { code: "connected", label: "Connected - Spoke with Debtor", category: "contact" },
        { code: "left_message", label: "Left Voicemail", category: "contact" },
        { code: "promise", label: "Promise to Pay", category: "positive" },
        { code: "payment", label: "Payment Made", category: "positive" },
        { code: "callback", label: "Callback Requested", category: "contact" },
        { code: "no_answer", label: "No Answer", category: "no_contact" },
        { code: "voicemail", label: "Voicemail (No Message)", category: "no_contact" },
        { code: "busy", label: "Busy Signal", category: "no_contact" },
        { code: "wrong_number", label: "Wrong Number", category: "bad_contact" },
        { code: "disconnected", label: "Disconnected/Not in Service", category: "bad_contact" },
        { code: "refused", label: "Refused to Pay", category: "negative" },
        { code: "dispute", label: "Disputes Debt", category: "compliance" },
        { code: "cease_desist", label: "Cease & Desist Request", category: "compliance" },
        { code: "attorney", label: "Has Attorney", category: "compliance" },
        { code: "deceased", label: "Deceased", category: "compliance" },
        { code: "bankrupt", label: "Bankruptcy", category: "compliance" },
      ];
      
      res.json({
        success: true,
        data: dispositions,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dispositions" });
    }
  });

  // GET /api/v2/softphone/account/:filenumber - Get account details for softphone screen pop
  app.get("/api/v2/softphone/account/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization access
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const notes = await storage.getNotes(debtor.id);
      const payments = await storage.getPayments(debtor.id);
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      
      const recentCalls = attempts
        .filter((a) => a.attemptType === "call")
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
        .slice(0, 10);
      
      const phones = contacts.filter((c) => c.type === "phone");
      const emails = contacts.filter((c) => c.type === "email");
      
      const totalPaid = payments
        .filter((p: any) => p.status === "completed" || p.status === "processed")
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      
      res.json({
        success: true,
        data: {
          account: {
            fileNumber: debtor.fileNumber,
            accountNumber: debtor.accountNumber,
            firstName: debtor.firstName,
            lastName: debtor.lastName,
            fullName: `${debtor.firstName} ${debtor.lastName}`,
            dateOfBirth: debtor.dateOfBirth,
            ssnLast4: debtor.ssnLast4,
            address: debtor.address,
            city: debtor.city,
            state: debtor.state,
            zipCode: debtor.zipCode,
            originalCreditor: debtor.originalCreditor,
            originalBalance: debtor.originalBalance,
            currentBalance: debtor.currentBalance,
            totalPaid,
            status: debtor.status,
            priority: (debtor as any).priority || "normal",
            lastContactDate: debtor.lastContactDate,
            nextFollowUpDate: debtor.nextFollowUpDate,
            assignedCollectorId: debtor.assignedCollectorId,
          },
          phones: phones.map((p) => ({
            id: p.id,
            number: p.value,
            label: p.label,
            isPrimary: p.isPrimary,
            isValid: p.isValid,
          })),
          emails: emails.map((e) => ({
            id: e.id,
            address: e.value,
            label: e.label,
            isPrimary: e.isPrimary,
          })),
          recentNotes: notes.slice(0, 5).map((n: any) => ({
            id: n.id,
            content: n.content,
            noteType: n.noteType,
            createdDate: n.createdDate,
          })),
          recentCalls: recentCalls.map((c) => ({
            id: c.id,
            phoneNumber: c.phoneNumber,
            outcome: c.outcome,
            duration: c.duration,
            createdDate: c.createdDate,
          })),
          paymentHistory: payments.slice(0, 5).map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paymentDate: p.paymentDate,
            status: p.status,
            paymentMethod: p.paymentMethod,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account for screen pop" });
    }
  });

  // POST /api/v2/softphone/inbound - Handle inbound call lookup (ANI/caller ID)
  app.post("/api/v2/softphone/inbound", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneNumber, externalCallId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      const matches: any[] = [];
      
      for (const debtor of debtors) {
        const contacts = await storage.getDebtorContacts(debtor.id);
        const phoneMatch = contacts.find(
          (c) => c.type === "phone" && c.value.replace(/\D/g, "").includes(cleanPhone)
        );
        
        if (phoneMatch) {
          matches.push({
            fileNumber: debtor.fileNumber,
            accountNumber: debtor.accountNumber,
            firstName: debtor.firstName,
            lastName: debtor.lastName,
            fullName: `${debtor.firstName} ${debtor.lastName}`,
            currentBalance: debtor.currentBalance,
            status: debtor.status,
            matchedPhone: phoneMatch.value,
            phoneLabel: phoneMatch.label,
          });
        }
      }
      
      if (matches.length > 0) {
        const primaryMatch = matches[0];
        const debtor = await storage.getDebtorByFileNumber(primaryMatch.fileNumber);
        
        if (debtor) {
          await storage.createCommunicationAttempt({
            debtorId: debtor.id,
            attemptType: "call",
            direction: "inbound",
            phoneNumber,
            outcome: "received",
            externalId: externalCallId || null,
            createdDate: new Date().toISOString(),
          });
        }
      }
      
      res.json({
        success: true,
        matchCount: matches.length,
        data: matches,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup inbound caller" });
    }
  });

  // PUT /api/v2/softphone/markphone - Mark phone as good/bad/primary
  app.put("/api/v2/softphone/markphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneId, fileNumber, phoneNumber, isBad, isPrimary, label, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneId && (!fileNumber || !phoneNumber)) {
        return res.status(400).json({ error: "phoneId or (fileNumber + phoneNumber) is required" });
      }
      
      let contactId = phoneId;
      
      if (!contactId && fileNumber && phoneNumber) {
        const debtor = await storage.getDebtorByFileNumber(fileNumber);
        if (!debtor) {
          return res.status(404).json({ error: "Account not found" });
        }
        
        // Verify organization access
        if (orgId && debtor.organizationId !== orgId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        const contacts = await storage.getDebtorContacts(debtor.id);
        const cleanPhone = phoneNumber.replace(/\D/g, "");
        const phone = contacts.find(
          (c) => c.type === "phone" && c.value.replace(/\D/g, "") === cleanPhone
        );
        
        if (!phone) {
          return res.status(404).json({ error: "Phone not found for account" });
        }
        
        contactId = phone.id;
      }
      
      const updates: Record<string, any> = {};
      if (isBad !== undefined) updates.isValid = !isBad;
      if (isPrimary !== undefined) updates.isPrimary = isPrimary;
      if (label !== undefined) updates.label = label;
      
      const contact = await storage.updateDebtorContact(contactId, updates);
      
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      res.json({
        success: true,
        data: {
          id: contact.id,
          phoneNumber: contact.value,
          isValid: contact.isValid,
          isPrimary: contact.isPrimary,
          label: contact.label,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update phone status" });
    }
  });
}

function formatDebtorForApi(debtor: any) {
  return {
    fileNumber: debtor.fileNumber,
    accountNumber: debtor.accountNumber,
    firstName: debtor.firstName,
    lastName: debtor.lastName,
    fullName: `${debtor.firstName} ${debtor.lastName}`,
    dateOfBirth: debtor.dateOfBirth,
    ssnLast4: debtor.ssnLast4,
    email: debtor.email,
    address: debtor.address,
    city: debtor.city,
    state: debtor.state,
    zipCode: debtor.zipCode,
    originalCreditor: debtor.originalCreditor,
    clientName: debtor.clientName,
    originalBalance: debtor.originalBalance,
    currentBalance: debtor.currentBalance,
    status: debtor.status,
    lastContactDate: debtor.lastContactDate,
    nextFollowUpDate: debtor.nextFollowUpDate,
    portfolioId: debtor.portfolioId,
    assignedCollectorId: debtor.assignedCollectorId,
  };
}
