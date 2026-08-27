import type { Payment, Merchant } from "@shared/schema";
import type { IStorage } from "./storage";
import {
  processDebtorCardPayment,
  processDebtorTokenPayment,
  processDebtorAchPayment,
  type MerchantCredentials,
} from "./authorizenet";
import { sendPaymentOutcomeAutomation } from "./payment-message-automation";
import Stripe from "stripe";
import { nextRecurringOccurrence } from "./recurring-payments";

export interface ProcessPaymentResult {
  success: boolean;
  transactionId: string | null;
  declineReason: string | null;
  ambiguous?: boolean;
}

export function gatewayReferences(payment: Pick<Payment, "id" | "idempotencyKey">) {
  const stable = payment.idempotencyKey || payment.id;
  const compact = stable.replace(/[^A-Za-z0-9]/g, "");
  return {
    orderReference: `PMT-${compact.slice(0, 16)}`,
    idempotencyKey: `debt-payment:${stable}`,
  };
}

export function ambiguousGatewayResult(message: string, transactionId: string | null = null): ProcessPaymentResult {
  return { success: false, transactionId, declineReason: message, ambiguous: true };
}

async function createNextRecurringOccurrence(payment: Payment, storage: IStorage): Promise<void> {
  const occurrenceDate = nextRecurringOccurrence(payment);
  if (!occurrenceDate) return;
  const occurrenceKey = `recurrence:${payment.id}:${occurrenceDate}`;
  const existing = await storage.getPaymentsForDebtor(payment.debtorId);
  if (existing.some(item => item.organizationId === payment.organizationId && item.idempotencyKey === occurrenceKey)) {
    return;
  }
  const child = {
    ...payment,
    paymentDate: occurrenceDate,
    nextPaymentDate: nextRecurringOccurrence({ ...payment, paymentDate: occurrenceDate }),
    status: "pending",
    idempotencyKey: occurrenceKey,
    providerTransactionId: null,
    processingStartedAt: null,
    completedAt: null,
    paymentToken: null,
  };
  try {
    await storage.createPayment(child);
    // Keep the completed arrangement pointing at its next occurrence for UI
    // visibility; it is not reopened and therefore cannot replay a charge.
    await storage.updatePayment(payment.id, { nextPaymentDate: occurrenceDate });
  } catch (error: any) {
    // The database uniqueness constraint makes concurrent scheduling harmless.
    if (error?.code !== "23505") throw error;
  }
}

interface NmiCredentials {
  securityKey: string;
  testMode: boolean;
}

interface UsaepayCredentials {
  sourceKey: string;
  pin: string;
  testMode: boolean;
}

function getActiveMerchant(merchants: Merchant[]): Merchant | undefined {
  return merchants.find(
    (m) =>
      m.isActive &&
      ((m.processorType === "authorize_net" &&
        m.authorizeNetApiLoginId &&
        m.authorizeNetTransactionKey) ||
        (m.processorType === "nmi" && m.nmiSecurityKey) ||
        (m.processorType === "usaepay" && m.usaepaySourceKey) ||
        (m.processorType === "stripe" && m.stripeSecretKey))
  );
}

async function processStripeToken(
  secretKey: string,
  paymentToken: string,
  customerId: string,
  amount: number,
  invoiceNumber?: string,
  idempotencyKey?: string,
): Promise<ProcessPaymentResult> {
  try {
    const stripe = new Stripe(secretKey);
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      payment_method: paymentToken,
      customer: customerId,
      off_session: true,
      confirm: true,
      description: invoiceNumber ? `Debt payment ${invoiceNumber}` : "Debt payment",
      metadata: invoiceNumber ? { invoiceNumber } : undefined,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    }, { idempotencyKey });
    if (intent.status === "processing") {
      return ambiguousGatewayResult("Stripe payment outcome is still processing", intent.id);
    }
    return intent.status === "succeeded"
      ? { success: true, transactionId: intent.id, declineReason: null }
      : { success: false, transactionId: intent.id, declineReason: `Stripe payment status: ${intent.status}` };
  } catch (error: any) {
    if (error?.type === "StripeCardError") {
      return { success: false, transactionId: error?.payment_intent?.id || null, declineReason: error.message || "Stripe card declined" };
    }
    return ambiguousGatewayResult("Stripe did not return a conclusive payment outcome", error?.payment_intent?.id || null);
  }
}

async function processNmiCard(
  creds: NmiCredentials,
  cardNumber: string,
  expDate: string,
  cvv: string,
  amount: number,
  invoiceNumber?: string
): Promise<ProcessPaymentResult> {
  try {
    const baseUrl = creds.testMode
      ? "https://secure.nmi.com/api/transact.php"
      : "https://secure.nmi.com/api/transact.php";

    const params = new URLSearchParams({
      security_key: creds.securityKey,
      type: "sale",
      amount: amount.toFixed(2),
      ccnumber: cardNumber.replace(/\s/g, ""),
      ccexp: expDate,
      cvv: cvv,
    });
    if (invoiceNumber) params.set("orderid", invoiceNumber);

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return ambiguousGatewayResult("NMI transport returned an inconclusive response");
    const text = await res.text();
    const result = new URLSearchParams(text);

    const responseCode = result.get("response") || "";
    const transactionId = result.get("transactionid") || null;
    const responseText = result.get("responsetext") || "Unknown error";

    if (responseCode === "1") {
      return { success: true, transactionId, declineReason: null };
    }
    if (responseCode === "2" || responseCode === "3") {
      return { success: false, transactionId, declineReason: responseText };
    }
    return ambiguousGatewayResult("NMI returned an inconclusive payment response", transactionId);
  } catch (error: any) {
    return ambiguousGatewayResult("NMI transport failed before a conclusive outcome");
  }
}

async function processNmiAch(
  creds: NmiCredentials,
  routingNumber: string,
  accountNumber: string,
  accountType: string,
  nameOnAccount: string,
  amount: number,
  invoiceNumber?: string
): Promise<ProcessPaymentResult> {
  try {
    const baseUrl = "https://secure.nmi.com/api/transact.php";

    const params = new URLSearchParams({
      security_key: creds.securityKey,
      type: "sale",
      payment: "check",
      amount: amount.toFixed(2),
      checkaba: routingNumber,
      checkaccount: accountNumber,
      account_type: accountType,
      checkname: nameOnAccount,
      sec_code: "WEB",
    });
    if (invoiceNumber) params.set("orderid", invoiceNumber);

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return ambiguousGatewayResult("NMI transport returned an inconclusive ACH response");
    const text = await res.text();
    const result = new URLSearchParams(text);

    const responseCode = result.get("response") || "";
    const transactionId = result.get("transactionid") || null;
    const responseText = result.get("responsetext") || "Unknown error";

    if (responseCode === "1") {
      return { success: true, transactionId, declineReason: null };
    }
    if (responseCode === "2" || responseCode === "3") {
      return { success: false, transactionId, declineReason: responseText };
    }
    return ambiguousGatewayResult("NMI returned an inconclusive ACH response", transactionId);
  } catch (error: any) {
    return ambiguousGatewayResult("NMI transport failed before a conclusive ACH outcome");
  }
}

async function processUsaepayCard(
  creds: UsaepayCredentials,
  cardNumber: string,
  expDate: string,
  cvv: string,
  amount: number,
  invoiceNumber?: string
): Promise<ProcessPaymentResult> {
  try {
    const baseUrl = creds.testMode
      ? "https://sandbox.usaepay.com/api/v2/transactions"
      : "https://usaepay.com/api/v2/transactions";

    const body: any = {
      command: "cc:sale",
      amount: amount.toFixed(2),
      creditcard: {
        number: cardNumber.replace(/\s/g, ""),
        expiration: expDate,
        cvc: cvv,
      },
    };
    if (invoiceNumber) body.invoice = invoiceNumber;

    const authString = Buffer.from(`${creds.sourceKey}:${creds.pin}`).toString(
      "base64"
    );
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return ambiguousGatewayResult("USAePay transport returned an inconclusive response");
    const data = await res.json();

    if (data.result_code === "A" || data.result === "Approved") {
      return {
        success: true,
        transactionId: data.refnum || data.key || null,
        declineReason: null,
      };
    }
    if (data.result_code || data.result || data.error) {
      return {
        success: false,
        transactionId: data.refnum || data.key || null,
        declineReason: data.error || data.result || "Transaction declined",
      };
    }
    return ambiguousGatewayResult("USAePay returned an inconclusive payment response", data.refnum || data.key || null);
  } catch (error: any) {
    return ambiguousGatewayResult("USAePay transport failed before a conclusive outcome");
  }
}

async function processUsaepayAch(
  creds: UsaepayCredentials,
  routingNumber: string,
  accountNumber: string,
  accountType: string,
  nameOnAccount: string,
  amount: number,
  invoiceNumber?: string
): Promise<ProcessPaymentResult> {
  try {
    const baseUrl = creds.testMode
      ? "https://sandbox.usaepay.com/api/v2/transactions"
      : "https://usaepay.com/api/v2/transactions";

    const body: any = {
      command: "check:sale",
      amount: amount.toFixed(2),
      check: {
        routing: routingNumber,
        account: accountNumber,
        account_type: accountType,
        name: nameOnAccount,
      },
    };
    if (invoiceNumber) body.invoice = invoiceNumber;

    const authString = Buffer.from(`${creds.sourceKey}:${creds.pin}`).toString(
      "base64"
    );
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return ambiguousGatewayResult("USAePay transport returned an inconclusive ACH response");
    const data = await res.json();

    if (data.result_code === "A" || data.result === "Approved") {
      return {
        success: true,
        transactionId: data.refnum || data.key || null,
        declineReason: null,
      };
    }
    if (data.result_code || data.result || data.error) {
      return {
        success: false,
        transactionId: data.refnum || data.key || null,
        declineReason: data.error || data.result || "ACH transaction declined",
      };
    }
    return ambiguousGatewayResult("USAePay returned an inconclusive ACH response", data.refnum || data.key || null);
  } catch (error: any) {
    return ambiguousGatewayResult("USAePay transport failed before a conclusive ACH outcome");
  }
}

async function processViaGateway(
  merchant: Merchant,
  paymentMethod: string,
  paymentToken: string | null,
  customerToken: string | null,
  cardData: {
    cardNumber: string;
    expirationDate: string;
    cardCode: string;
  } | null,
  achData: {
    accountType: string;
    routingNumber: string;
    accountNumber: string;
    nameOnAccount: string;
  } | null,
  amount: number,
  invoiceNumber?: string,
  customerEmail?: string,
  stripeIdempotencyKey?: string,
): Promise<ProcessPaymentResult> {
  if (paymentMethod === "check") {
    return { success: true, transactionId: null, declineReason: null };
  }

  if (merchant.processorType === "authorize_net") {
    const creds: MerchantCredentials = {
      apiLoginId: merchant.authorizeNetApiLoginId!,
      transactionKey: merchant.authorizeNetTransactionKey!,
      testMode: merchant.testMode ?? true,
    };
    if (paymentMethod === "card" && paymentToken) {
      if (!customerToken) {
        return { success: false, transactionId: null, declineReason: "Authorize.Net CIM customer profile is missing" };
      }
      const result = await processDebtorTokenPayment(creds, customerToken, paymentToken, amount, invoiceNumber, customerEmail);
      return {
        success: result.success,
        transactionId: result.transactionId || null,
        declineReason: result.errorMessage || null,
        ambiguous: result.ambiguous,
      };
    }
    if (paymentMethod === "card" && cardData) {
      const result = await processDebtorCardPayment(
        creds,
        cardData,
        amount,
        invoiceNumber,
        customerEmail
      );
      return {
        success: result.success,
        transactionId: result.transactionId || null,
        declineReason: result.errorMessage || null,
      };
    }
    if (paymentMethod === "ach" && achData) {
      const result = await processDebtorAchPayment(
        creds,
        {
          accountType: achData.accountType as "checking" | "savings",
          routingNumber: achData.routingNumber,
          accountNumber: achData.accountNumber,
          nameOnAccount: achData.nameOnAccount,
        },
        amount,
        invoiceNumber
      );
      return {
        success: result.success,
        transactionId: result.transactionId || null,
        declineReason: result.errorMessage || null,
      };
    }
  }

  if (merchant.processorType === "nmi") {
    const creds: NmiCredentials = {
      securityKey: merchant.nmiSecurityKey!,
      testMode: merchant.testMode ?? true,
    };
    if (paymentMethod === "card" && paymentToken) {
      try {
        const params = new URLSearchParams({
          security_key: creds.securityKey,
          type: "sale",
          amount: amount.toFixed(2),
          customer_vault_id: paymentToken,
          dup_seconds: "300",
        });
        if (invoiceNumber) params.set("orderid", invoiceNumber);
        const response = await fetch("https://secure.nmi.com/api/transact.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        if (!response.ok) return ambiguousGatewayResult("NMI transport returned an inconclusive response");
        const result = new URLSearchParams(await response.text());
        const responseCode = result.get("response");
        const transactionId = result.get("transactionid");
        if (responseCode === "1") return { success: true, transactionId, declineReason: null };
        if (responseCode === "2" || responseCode === "3") {
          return { success: false, transactionId, declineReason: result.get("responsetext") || "NMI transaction declined" };
        }
        return ambiguousGatewayResult("NMI returned an inconclusive payment response", transactionId);
      } catch (error: any) {
        return ambiguousGatewayResult("NMI transport failed before a conclusive outcome");
      }
    }
    if (paymentMethod === "card" && cardData) {
      return processNmiCard(
        creds,
        cardData.cardNumber,
        cardData.expirationDate,
        cardData.cardCode,
        amount,
        invoiceNumber
      );
    }
    if (paymentMethod === "ach" && achData) {
      return processNmiAch(
        creds,
        achData.routingNumber,
        achData.accountNumber,
        achData.accountType,
        achData.nameOnAccount,
        amount,
        invoiceNumber
      );
    }
  }

  if (merchant.processorType === "usaepay") {
    const creds: UsaepayCredentials = {
      sourceKey: merchant.usaepaySourceKey!,
      pin: merchant.usaepayPin || "",
      testMode: merchant.testMode ?? true,
    };
    if (paymentMethod === "card" && paymentToken) {
      try {
        const baseUrl = creds.testMode ? "https://sandbox.usaepay.com/api/v2/transactions" : "https://usaepay.com/api/v2/transactions";
        const response = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${creds.sourceKey}:${creds.pin}`).toString("base64")}`,
          },
          body: JSON.stringify({
            command: "cc:sale",
            amount: amount.toFixed(2),
            creditcard: { cardref: paymentToken },
            ...(invoiceNumber ? { invoice: invoiceNumber } : {}),
          }),
        });
        if (!response.ok) return ambiguousGatewayResult("USAePay transport returned an inconclusive response");
        const data = await response.json();
        const transactionId = data.refnum || data.key || null;
        if (data.result_code === "A" || data.result === "Approved") {
          return { success: true, transactionId, declineReason: null };
        }
        if (data.result_code || data.result || data.error) {
          return { success: false, transactionId, declineReason: data.error || data.result || "USAePay transaction declined" };
        }
        return ambiguousGatewayResult("USAePay returned an inconclusive payment response", transactionId);
      } catch (error: any) {
        return ambiguousGatewayResult("USAePay transport failed before a conclusive outcome");
      }
    }
    if (paymentMethod === "card" && cardData) {
      return processUsaepayCard(
        creds,
        cardData.cardNumber,
        cardData.expirationDate,
        cardData.cardCode,
        amount,
        invoiceNumber
      );
    }
    if (paymentMethod === "ach" && achData) {
      return processUsaepayAch(
        creds,
        achData.routingNumber,
        achData.accountNumber,
        achData.accountType,
        achData.nameOnAccount,
        amount,
        invoiceNumber
      );
    }
  }

  if (merchant.processorType === "stripe") {
    if (paymentMethod === "card" && paymentToken) {
      if (!customerToken) {
        return { success: false, transactionId: null, declineReason: "Stripe Customer is missing for saved card" };
      }
      return processStripeToken(merchant.stripeSecretKey!, paymentToken, customerToken, amount, invoiceNumber, stripeIdempotencyKey);
    }
    if (paymentMethod !== "card" || !cardData) {
      return { success: false, transactionId: null, declineReason: "Stripe merchant processing currently supports card payments only" };
    }
    return {
      success: false,
      transactionId: null,
      declineReason: "Stripe requires a saved PaymentMethod created by a hosted setup flow",
    };
  }

  return {
    success: false,
    transactionId: null,
    declineReason: `Unsupported processor type: ${merchant.processorType}`,
  };
}

export async function processPayment(
  payment: Payment,
  storage: IStorage,
  orgId: string
): Promise<ProcessPaymentResult & { updatedPayment: Payment | undefined }> {
  if (payment.organizationId !== orgId) {
    return {
      success: false,
      transactionId: null,
      declineReason: "Organization mismatch — payment does not belong to this organization",
      updatedPayment: undefined,
    };
  }

  const debtor = await storage.getDebtor(payment.debtorId);

  const merchants = await storage.getMerchants(orgId);
  const activeMerchant = getActiveMerchant(merchants);

  let result: ProcessPaymentResult;

  if (!activeMerchant) {
    result = {
      success: false,
      transactionId: null,
      declineReason: "No active merchant configured for this organization",
    };
  } else {
    let gatewayPaymentToken = payment.paymentToken;
    let gatewayCustomerToken: string | null = null;
    let cardData: {
      cardNumber: string;
      expirationDate: string;
      cardCode: string;
    } | null = null;
    let achData: {
      accountType: string;
      routingNumber: string;
      accountNumber: string;
      nameOnAccount: string;
    } | null = null;

    if (payment.paymentMethod === "card" && payment.cardId) {
      const card = await storage.getPaymentCard(payment.cardId);
      if (
        card &&
        card.organizationId === orgId &&
        card.debtorId === payment.debtorId &&
        card.vaultStatus === "vaulted" &&
        card.processorType === activeMerchant.processorType &&
        card.processorToken
      ) {
        gatewayPaymentToken = card.processorToken;
        gatewayCustomerToken = card.processorCustomerId;
      } else {
        result = {
          success: false,
          transactionId: null,
          declineReason: "Saved card is not vaulted for this debtor and active processor",
        };
        const updatedPayment = await storage.updatePayment(payment.id, {
          status: "declined",
          notes: `DECLINED: ${result.declineReason}`,
        });
        if (debtor) {
          await storage.updateDebtor(payment.debtorId, { status: "decline" });
          await storage.createNote({
            debtorId: payment.debtorId,
            collectorId: payment.processedBy || "system",
            content: `Payment of $${(payment.amount / 100).toFixed(2)} DECLINED: ${result.declineReason}`,
            noteType: "payment",
            createdDate: new Date().toISOString().split("T")[0],
            organizationId: orgId,
          });
        }
        await sendPaymentOutcomeAutomation(storage, orgId, debtor, {
          payment,
          success: false,
          transactionId: null,
          declineReason: result.declineReason,
        });
        return { ...result, updatedPayment };
      }
    } else if (payment.paymentMethod === "card") {
      result = {
        success: false,
        transactionId: null,
        declineReason: "A vaulted saved card is required",
      };
      const updatedPayment = await storage.updatePayment(payment.id, {
        status: "declined",
        notes: `DECLINED: ${result.declineReason}`,
      });
      return { ...result, updatedPayment };
    } else if (payment.paymentMethod === "ach") {
      const bankAccounts = await storage.getBankAccounts(payment.debtorId);
      const bankAccount = bankAccounts[0];
      if (bankAccount) {
        achData = {
          accountType: (bankAccount.accountType as string) || "checking",
          routingNumber: bankAccount.routingNumber || "",
          accountNumber: bankAccount.accountNumber || "",
          nameOnAccount: debtor
            ? `${debtor.firstName} ${debtor.lastName}`
            : "Account Holder",
        };
      } else {
        result = {
          success: false,
          transactionId: null,
          declineReason: "No bank account on file",
        };
        const updatedPayment = await storage.updatePayment(payment.id, {
          status: "declined",
          notes: `DECLINED: ${result.declineReason}`,
        });
        if (debtor) {
          await storage.updateDebtor(payment.debtorId, { status: "decline" });
          await storage.createNote({
            debtorId: payment.debtorId,
            collectorId: payment.processedBy || "system",
            content: `Payment of $${(payment.amount / 100).toFixed(2)} DECLINED: ${result.declineReason}`,
            noteType: "payment",
            createdDate: new Date().toISOString().split("T")[0],
            organizationId: orgId,
          });
        }
        await sendPaymentOutcomeAutomation(storage, orgId, debtor, {
          payment,
          success: false,
          transactionId: null,
          declineReason: result.declineReason,
        });
        return { ...result, updatedPayment };
      }
    }

    const references = gatewayReferences(payment);
    result = await processViaGateway(
      activeMerchant,
      payment.paymentMethod,
      gatewayPaymentToken,
      gatewayCustomerToken,
      cardData,
      achData,
      payment.amount / 100,
      references.orderReference,
      debtor?.email || undefined,
      references.idempotencyKey,
    );
  }

  const updatedPayment = await storage.updatePayment(payment.id, {
    status: result.success ? "processed" : result.ambiguous ? "needs_review" : "declined",
    providerTransactionId: result.transactionId,
    completedAt: new Date(),
    notes: result.success
      ? result.transactionId
        ? `${payment.notes || ""} [TXN: ${result.transactionId}]`.trim()
        : payment.notes
      : result.ambiguous
        ? `NEEDS REVIEW: ${result.declineReason}`
        : `DECLINED: ${result.declineReason}`,
  });

  if (result.success) {
    await createNextRecurringOccurrence(payment, storage);
  }

  if (debtor && !result.ambiguous) {
    await storage.updateDebtor(payment.debtorId, { status: result.success ? "processed" : "decline" });
  }

  if (!result.success && !result.ambiguous && debtor) {
    await storage.createNote({
      debtorId: payment.debtorId,
      collectorId: payment.processedBy || "system",
      content: `Payment of $${(payment.amount / 100).toFixed(2)} DECLINED: ${result.declineReason}`,
      noteType: "payment",
      createdDate: new Date().toISOString().split("T")[0],
      organizationId: orgId,
    });
  }

  if (!result.ambiguous) {
    await sendPaymentOutcomeAutomation(storage, orgId, debtor, {
      payment,
      success: result.success,
      transactionId: result.transactionId,
      declineReason: result.declineReason,
    });
  }

  return { ...result, updatedPayment };
}
