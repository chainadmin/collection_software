import type { Payment, Merchant } from "@shared/schema";
import type { IStorage } from "./storage";
import {
  processDebtorCardPayment,
  processDebtorAchPayment,
  type MerchantCredentials,
} from "./authorizenet";
import { sendPaymentOutcomeAutomation } from "./payment-message-automation";
import Stripe from "stripe";

export interface ProcessPaymentResult {
  success: boolean;
  transactionId: string | null;
  declineReason: string | null;
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

async function processStripeCard(
  secretKey: string,
  cardData: { cardNumber: string; expirationDate: string; cardCode: string },
  amount: number,
  invoiceNumber?: string,
  customerEmail?: string,
): Promise<ProcessPaymentResult> {
  try {
    const stripe = new Stripe(secretKey);
    const exp = cardData.expirationDate.replace(/\D/g, "");
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cardData.cardNumber.replace(/\s/g, ""),
        exp_month: Number(exp.slice(0, 2)),
        exp_year: Number(`20${exp.slice(-2)}`),
        cvc: cardData.cardCode,
      },
      billing_details: customerEmail ? { email: customerEmail } : undefined,
    });
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      payment_method: paymentMethod.id,
      confirm: true,
      description: invoiceNumber ? `Debt payment ${invoiceNumber}` : "Debt payment",
      metadata: invoiceNumber ? { invoiceNumber } : undefined,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    });
    if (intent.status === "succeeded") {
      return { success: true, transactionId: intent.id, declineReason: null };
    }
    return { success: false, transactionId: intent.id, declineReason: `Stripe payment status: ${intent.status}` };
  } catch (error: any) {
    return { success: false, transactionId: null, declineReason: `Stripe error: ${error.message}` };
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
    const text = await res.text();
    const result = new URLSearchParams(text);

    const responseCode = result.get("response") || "";
    const transactionId = result.get("transactionid") || null;
    const responseText = result.get("responsetext") || "Unknown error";

    if (responseCode === "1") {
      return { success: true, transactionId, declineReason: null };
    }
    return { success: false, transactionId: null, declineReason: responseText };
  } catch (error: any) {
    return {
      success: false,
      transactionId: null,
      declineReason: `NMI error: ${error.message}`,
    };
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
    const text = await res.text();
    const result = new URLSearchParams(text);

    const responseCode = result.get("response") || "";
    const transactionId = result.get("transactionid") || null;
    const responseText = result.get("responsetext") || "Unknown error";

    if (responseCode === "1") {
      return { success: true, transactionId, declineReason: null };
    }
    return { success: false, transactionId: null, declineReason: responseText };
  } catch (error: any) {
    return {
      success: false,
      transactionId: null,
      declineReason: `NMI ACH error: ${error.message}`,
    };
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
    const data = await res.json();

    if (data.result_code === "A" || data.result === "Approved") {
      return {
        success: true,
        transactionId: data.refnum || data.key || null,
        declineReason: null,
      };
    }
    return {
      success: false,
      transactionId: null,
      declineReason: data.error || data.result || "Transaction declined",
    };
  } catch (error: any) {
    return {
      success: false,
      transactionId: null,
      declineReason: `USAePay error: ${error.message}`,
    };
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
    const data = await res.json();

    if (data.result_code === "A" || data.result === "Approved") {
      return {
        success: true,
        transactionId: data.refnum || data.key || null,
        declineReason: null,
      };
    }
    return {
      success: false,
      transactionId: null,
      declineReason: data.error || data.result || "ACH transaction declined",
    };
  } catch (error: any) {
    return {
      success: false,
      transactionId: null,
      declineReason: `USAePay ACH error: ${error.message}`,
    };
  }
}

async function processViaGateway(
  merchant: Merchant,
  paymentMethod: string,
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
  customerEmail?: string
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
    if (paymentMethod !== "card" || !cardData) {
      return { success: false, transactionId: null, declineReason: "Stripe merchant processing currently supports card payments only" };
    }
    return processStripeCard(
      merchant.stripeSecretKey!,
      cardData,
      amount,
      invoiceNumber,
      customerEmail,
    );
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
      if (card && card.cardNumber) {
        cardData = {
          cardNumber: card.cardNumber,
          expirationDate: `${card.expiryMonth}${card.expiryYear.slice(-2)}`,
          cardCode: card.cvv || "999",
        };
      } else {
        result = {
          success: false,
          transactionId: null,
          declineReason: "Card not found or missing card details",
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

    result = await processViaGateway(
      activeMerchant,
      payment.paymentMethod,
      cardData,
      achData,
      payment.amount / 100,
      payment.referenceNumber || undefined,
      debtor?.email || undefined
    );
  }

  const updatedPayment = await storage.updatePayment(payment.id, {
    status: result.success ? "processed" : "declined",
    notes: result.success
      ? result.transactionId
        ? `${payment.notes || ""} [TXN: ${result.transactionId}]`.trim()
        : payment.notes
      : `DECLINED: ${result.declineReason}`,
  });

  if (debtor) {
    await storage.updateDebtor(payment.debtorId, { status: result.success ? "processed" : "decline" });
  }

  if (!result.success && debtor) {
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
    success: result.success,
    transactionId: result.transactionId,
    declineReason: result.declineReason,
  });

  return { ...result, updatedPayment };
}
