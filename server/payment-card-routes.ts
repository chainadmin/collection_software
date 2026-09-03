import type { Express } from "express";
import type { IStorage } from "./storage";
import { detectCardNetwork, normalizeCardNumber, passesLuhn } from "@shared/card-validation";
import { CardVaultError, vaultCard, type RawCardInput, type VaultedCard } from "./card-vault";
import { chainCredentialFingerprint } from "./chain-payment";
import { redactPaymentCard } from "./payment-card-presenter";
import type { Debtor, Merchant } from "@shared/schema";

type VaultCard = (merchant: Merchant, debtor: Debtor, card: RawCardInput, customerId?: string) => Promise<VaultedCard>;

export function registerPaymentCardRoutes(
  app: Express,
  storage: IStorage,
  dependencies: { vaultCard?: VaultCard } = {},
): void {
  const vault = dependencies.vaultCard ?? vaultCard;

  app.get("/api/debtors/:id/cards", async (req: any, res) => {
    try {
      const orgId = req.session?.collector?.organizationId;
      if (!orgId) return res.status(401).json({ error: "Authentication required" });
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (debtor.organizationId !== orgId) return res.status(403).json({ error: "Access denied" });
      const cards = await storage.getPaymentCards(req.params.id);
      res.json(cards.filter(card => card.organizationId === orgId).map(redactPaymentCard));
    } catch {
      res.status(500).json({ error: "Failed to fetch payment cards" });
    }
  });

  app.post("/api/debtors/:id/cards", async (req: any, res) => {
    let reservationId: string | undefined;
    try {
      const orgId = req.session?.collector?.organizationId;
      if (!orgId) return res.status(401).json({ error: "Authentication required" });
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (debtor.organizationId !== orgId) return res.status(403).json({ error: "Access denied" });
      const { digits: pan, malformed } = normalizeCardNumber(typeof req.body.cardNumber === "string" ? req.body.cardNumber : "");
      const network = detectCardNetwork(pan);
      const networkType: Record<string, string> = { Visa: "visa", Mastercard: "mastercard", "American Express": "amex", Discover: "discover" };
      const lengths: Record<string, number[]> = { Visa: [13, 16, 19], Mastercard: [16], "American Express": [15], Discover: [16, 19] };
      if (malformed || network === "Unknown" || !lengths[network]?.includes(pan.length) || !passesLuhn(pan)) return res.status(400).json({ error: "Invalid card number" });
      if (req.body.cardType && req.body.cardType !== networkType[network]) return res.status(400).json({ error: "Card network does not match card number" });
      const cvv = typeof req.body.cvv === "string" ? req.body.cvv : "";
      if (!new RegExp(network === "American Express" ? "^\\d{4}$" : "^\\d{3}$").test(cvv)) return res.status(400).json({ error: "Invalid security code" });
      const expiryMonth = String(req.body.expiryMonth || "").padStart(2, "0");
      let expiryYear = String(req.body.expiryYear || "");
      if (/^\d{2}$/.test(expiryYear)) expiryYear = `20${expiryYear}`;
      if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth) || !/^\d{4}$/.test(expiryYear) ||
          new Date(Number(expiryYear), Number(expiryMonth), 0, 23, 59, 59) < new Date()) {
        return res.status(400).json({ error: "Invalid expiration date" });
      }
      const cardholderName = typeof req.body.cardholderName === "string" ? req.body.cardholderName.trim() : "";
      if (cardholderName.length < 2 || cardholderName.length > 100 || !/^[A-Za-z][A-Za-z .,'-]+$/.test(cardholderName)) return res.status(400).json({ error: "Invalid cardholder name" });
      const billingZip = typeof req.body.billingZip === "string" ? req.body.billingZip.trim() : "";
      if (!/^\d{5}(?:-\d{4})?$/.test(billingZip)) return res.status(400).json({ error: "A valid billing ZIP is required" });
      const merchant = (await storage.getMerchants(orgId)).find(item => item.isActive && (
        (item.processorType === "authorize_net" && item.authorizeNetApiLoginId && item.authorizeNetTransactionKey) ||
        (item.processorType === "stripe" && item.stripeSecretKey) ||
        (item.processorType === "nmi" && item.nmiSecurityKey) ||
        (item.processorType === "usaepay" && item.usaepaySourceKey && item.usaepayPin)
      ));
      if (!merchant) return res.status(409).json({ error: "No active card processor is configured" });
      const key = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "");
      if (key && !/^[A-Za-z0-9._:-]{8,180}$/.test(key)) return res.status(400).json({ error: "Invalid idempotency key" });
      const externalKey = key ? `ui-card:${key}` : null;
      const fingerprint = key ? chainCredentialFingerprint(orgId, externalKey!, pan) : null;
      let reservation = externalKey ? await storage.getPaymentCardByExternalIdempotencyKey(orgId, externalKey) : undefined;
      const matches = (card: NonNullable<typeof reservation>) =>
        card.debtorId === debtor.id && card.merchantId === merchant.id &&
        card.externalCredentialFingerprint === fingerprint && card.cardNumberLast4 === pan.slice(-4) &&
        card.expiryMonth === expiryMonth && card.expiryYear === expiryYear &&
        card.cardholderName === cardholderName && card.billingZip === billingZip;
      if (reservation) {
        if (!matches(reservation)) return res.status(409).json({ error: "Card idempotency key conflicts with a different request" });
        if (reservation.vaultStatus === "vaulted") return res.status(200).json(redactPaymentCard(reservation));
        return res.status(409).json({ error: "Card vaulting is in progress or requires review" });
      }
      const existingCards = (await storage.getPaymentCards(debtor.id)).filter(card => card.organizationId === orgId);
      const customer = existingCards.find(card =>
        card.merchantId === merchant.id &&
        card.processorType === merchant.processorType &&
        card.vaultStatus === "vaulted" &&
        card.processorCustomerId
      )?.processorCustomerId || undefined;
      const makeDefault = req.body.isDefault === true || !existingCards.some(card => card.vaultStatus === "vaulted");
      try {
        reservation = await storage.createPaymentCard({
          organizationId: orgId, debtorId: debtor.id, cardType: networkType[network], cardholderName,
          cardNumberLast4: pan.slice(-4), expiryMonth, expiryYear, billingZip, processorType: merchant.processorType,
          merchantId: merchant.id, vaultStatus: "vaulting", externalIdempotencyKey: externalKey,
          externalCredentialFingerprint: fingerprint, isDefault: false,
          addedDate: new Date().toISOString().split("T")[0], addedBy: req.session.collector.id,
        });
        reservationId = reservation.id;
      } catch (error: any) {
        if (error?.code !== "23505" || !externalKey) throw error;
        reservation = await storage.getPaymentCardByExternalIdempotencyKey(orgId, externalKey);
        if (reservation?.vaultStatus === "vaulted" && matches(reservation)) return res.status(200).json(redactPaymentCard(reservation));
        return res.status(409).json({ error: "Card vaulting is in progress or requires review" });
      }
      let vaulted: VaultedCard;
      try {
        vaulted = await vault(merchant, debtor, { pan, cvv, expiryMonth, expiryYear, cardholderName, billingZip }, customer);
      } catch (error) {
        await storage.updatePaymentCard(reservation.id, { vaultStatus: "vault_failed" });
        throw error;
      }
      if (makeDefault) await Promise.all(existingCards.filter(card => card.isDefault).map(card => storage.updatePaymentCard(card.id, { isDefault: false })));
      const card = await storage.updatePaymentCard(reservation.id, { ...vaulted, merchantId: merchant.id, isDefault: makeDefault });
      if (!card) throw new Error("Card vault reservation disappeared");
      res.status(201).json(redactPaymentCard(card));
    } catch (error) {
      if (error instanceof CardVaultError) return res.status(422).json({ error: error.message });
      if (reservationId) await storage.updatePaymentCard(reservationId, { vaultStatus: "vault_failed", isDefault: false });
      res.status(500).json({ error: "Failed to vault payment card" });
    }
  });

  app.delete("/api/cards/:id", async (req: any, res) => {
    try {
      const orgId = req.session?.collector?.organizationId;
      if (!orgId) return res.status(401).json({ error: "Authentication required" });
      const existing = await storage.getPaymentCard(req.params.id);
      if (!existing) return res.status(404).json({ error: "Payment card not found" });
      if (existing.organizationId !== orgId) return res.status(403).json({ error: "Access denied" });
      await storage.deletePaymentCard(existing.id);
      if (existing.isDefault) {
        const replacement = (await storage.getPaymentCards(existing.debtorId)).find(card => card.organizationId === orgId && card.vaultStatus === "vaulted");
        if (replacement) await storage.updatePaymentCard(replacement.id, { isDefault: true });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete payment card" });
    }
  });
}