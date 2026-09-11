/**
 * Authorize.net Integration for Debt Manager Pro
 * 
 * This module handles ONLY organization subscription billing for Debt Manager Pro service.
 * It is NOT used for processing debt collection payments from debtors.
 * 
 * Subscription Plans:
 * - Starter: $200/month (4 seats)
 * - Growth: $400/month (15 seats)
 * - Agency: $750/month (40 seats)
 */

import authorizenet from 'authorizenet';
import { classifyAuthorizeNetDisposition } from "./payment-gateway-result";

const APIContracts = authorizenet.APIContracts;
const APIControllers = authorizenet.APIControllers;
const Constants = authorizenet.Constants;

const ANET_API_LOGIN_ID = process.env.AUTHORIZENET_API_LOGIN_ID;
const ANET_TRANSACTION_KEY = process.env.AUTHORIZENET_TRANSACTION_KEY;

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  errorMessage?: string;
  responseCode?: string;
  ambiguous?: boolean;
}

export interface SubscriptionCardData {
  cardNumber: string;
  expirationDate: string; // MMYY format
  cardCode: string; // CVV
}

export interface SubscriptionDetails {
  organizationId: string;
  organizationName: string;
  plan: 'starter' | 'growth' | 'agency';
  email: string;
}

function getMerchantAuth(): any {
  const merchantAuth = new APIContracts.MerchantAuthenticationType();
  merchantAuth.setName(ANET_API_LOGIN_ID || '');
  merchantAuth.setTransactionKey(ANET_TRANSACTION_KEY || '');
  return merchantAuth;
}

function getPlanAmount(plan: 'starter' | 'growth' | 'agency'): number {
  const prices: Record<string, number> = {
    starter: 200,
    growth: 400,
    agency: 750,
  };
  return prices[plan] || 200;
}

/**
 * Process subscription payment for organization
 * Used for monthly billing of Debt Manager Pro service
 */
export async function chargeSubscription(
  cardData: SubscriptionCardData,
  subscription: SubscriptionDetails
): Promise<ChargeResult> {
  return new Promise((resolve) => {
    if (!ANET_API_LOGIN_ID || !ANET_TRANSACTION_KEY) {
      resolve({
        success: false,
        errorMessage: 'Authorize.net credentials not configured',
      });
      return;
    }

    const amount = getPlanAmount(subscription.plan);
    const merchantAuth = getMerchantAuth();

    const creditCard = new APIContracts.CreditCardType();
    creditCard.setCardNumber(cardData.cardNumber.replace(/\s/g, ''));
    creditCard.setExpirationDate(cardData.expirationDate);
    creditCard.setCardCode(cardData.cardCode);

    const paymentType = new APIContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    const invoiceNumber = `DMP-${subscription.organizationId.substring(0, 8)}-${Date.now()}`;
    const orderDetails = new APIContracts.OrderType();
    orderDetails.setInvoiceNumber(invoiceNumber);
    orderDetails.setDescription(`Debt Manager Pro - ${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan`);

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(amount);
    transactionRequest.setOrder(orderDetails);

    if (subscription.email) {
      const customer = new APIContracts.CustomerDataType();
      customer.setEmail(subscription.email);
      transactionRequest.setCustomer(customer);
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    
    // Use sandbox for testing, production for live
    const isProduction = process.env.NODE_ENV === 'production';
    ctrl.setEnvironment(isProduction ? Constants.endpoint.production : Constants.endpoint.sandbox);

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
        const transResponse = response.getTransactionResponse();
        if (transResponse && transResponse.getMessages()) {
          resolve({
            success: true,
            transactionId: transResponse.getTransId(),
            authCode: transResponse.getAuthCode(),
            responseCode: transResponse.getResponseCode(),
          });
        } else {
          const errors = transResponse?.getErrors()?.getError();
          resolve({
            success: false,
            errorMessage: errors?.[0]?.getErrorText() || 'Transaction failed',
            responseCode: transResponse?.getResponseCode(),
          });
        }
      } else {
        const transResponse = response.getTransactionResponse();
        const errors = transResponse?.getErrors()?.getError();
        const messages = response.getMessages()?.getMessage();
        resolve({
          success: false,
          errorMessage: errors?.[0]?.getErrorText() || messages?.[0]?.getText() || 'API Error',
          responseCode: transResponse?.getResponseCode(),
        });
      }
    });
  });
}

/**
 * Legacy chargeCard function - kept for compatibility
 * Used only for organization subscription billing
 */
export async function chargeCard(
  cardData: SubscriptionCardData,
  amount: number,
  invoiceNumber?: string,
  customerEmail?: string
): Promise<ChargeResult> {
  return new Promise((resolve) => {
    if (!ANET_API_LOGIN_ID || !ANET_TRANSACTION_KEY) {
      resolve({
        success: false,
        errorMessage: 'Authorize.net credentials not configured',
      });
      return;
    }

    const merchantAuth = getMerchantAuth();

    const creditCard = new APIContracts.CreditCardType();
    creditCard.setCardNumber(cardData.cardNumber.replace(/\s/g, ''));
    creditCard.setExpirationDate(cardData.expirationDate);
    creditCard.setCardCode(cardData.cardCode);

    const paymentType = new APIContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    const orderDetails = new APIContracts.OrderType();
    orderDetails.setInvoiceNumber(invoiceNumber || `DMP-SUB-${Date.now()}`);
    orderDetails.setDescription('Debt Manager Pro Subscription');

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(amount);
    transactionRequest.setOrder(orderDetails);

    if (customerEmail) {
      const customer = new APIContracts.CustomerDataType();
      customer.setEmail(customerEmail);
      transactionRequest.setCustomer(customer);
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    
    const isProduction = process.env.NODE_ENV === 'production';
    ctrl.setEnvironment(isProduction ? Constants.endpoint.production : Constants.endpoint.sandbox);

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
        const transResponse = response.getTransactionResponse();
        if (transResponse && transResponse.getMessages()) {
          resolve({
            success: true,
            transactionId: transResponse.getTransId(),
            authCode: transResponse.getAuthCode(),
            responseCode: transResponse.getResponseCode(),
          });
        } else {
          const errors = transResponse?.getErrors()?.getError();
          resolve({
            success: false,
            errorMessage: errors?.[0]?.getErrorText() || 'Transaction failed',
            responseCode: transResponse?.getResponseCode(),
          });
        }
      } else {
        const transResponse = response.getTransactionResponse();
        const errors = transResponse?.getErrors()?.getError();
        const messages = response.getMessages()?.getMessage();
        resolve({
          success: false,
          errorMessage: errors?.[0]?.getErrorText() || messages?.[0]?.getText() || 'API Error',
          responseCode: transResponse?.getResponseCode(),
        });
      }
    });
  });
}

export function isConfigured(): boolean {
  return !!(ANET_API_LOGIN_ID && ANET_TRANSACTION_KEY);
}

export function getSubscriptionPrices() {
  return {
    starter: { price: 200, seats: 4 },
    growth: { price: 400, seats: 15 },
    agency: { price: 750, seats: 40 },
  };
}

// ============================================================================
// ORGANIZATION MERCHANT PAYMENT PROCESSING
// These functions process debtor payments using the organization's own merchant account
// ============================================================================

export interface MerchantCredentials {
  apiLoginId: string;
  transactionKey: string;
}

export interface DebtorPaymentData {
  cardNumber: string;
  expirationDate: string; // MMYY format
  cardCode: string;
}

export interface AchPaymentData {
  accountType: 'checking' | 'savings';
  routingNumber: string;
  accountNumber: string;
  nameOnAccount: string;
}

function addDuplicateWindow(transactionRequest: any) {
  const duplicateWindow = new APIContracts.SettingType();
  duplicateWindow.setSettingName("duplicateWindow");
  duplicateWindow.setSettingValue("300");
  const transactionSettings = new APIContracts.ArrayOfSetting();
  transactionSettings.setSetting([duplicateWindow]);
  transactionRequest.setTransactionSettings(transactionSettings);
}

/** Charge a reusable CIM customer/payment profile. */
export async function processDebtorTokenPayment(
  merchantCredentials: MerchantCredentials,
  customerProfileId: string,
  paymentProfileId: string,
  amount: number,
  invoiceNumber?: string,
  customerEmail?: string
): Promise<ChargeResult> {
  return new Promise((resolve) => {
    const merchantAuth = new APIContracts.MerchantAuthenticationType();
    merchantAuth.setName(merchantCredentials.apiLoginId);
    merchantAuth.setTransactionKey(merchantCredentials.transactionKey);

    const paymentProfile = new APIContracts.PaymentProfile();
    paymentProfile.setPaymentProfileId(paymentProfileId);
    const profile = new APIContracts.CustomerProfilePaymentType();
    profile.setCustomerProfileId(customerProfileId);
    profile.setPaymentProfile(paymentProfile);

    const orderDetails = new APIContracts.OrderType();
    orderDetails.setInvoiceNumber(invoiceNumber || `PMT-${Date.now()}`);
    orderDetails.setDescription("Debt Payment");

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setProfile(profile);
    transactionRequest.setAmount(amount);
    transactionRequest.setOrder(orderDetails);
    addDuplicateWindow(transactionRequest);

    if (customerEmail) {
      const customer = new APIContracts.CustomerDataType();
      customer.setEmail(customerEmail);
      transactionRequest.setCustomer(customer);
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    ctrl.setEnvironment(Constants.endpoint.production);
    const complete = () => {
      try {
        const response = new APIContracts.CreateTransactionResponse(ctrl.getResponse());
        const transResponse = response.getTransactionResponse();
        const responseCode = transResponse?.getResponseCode();
        const hasApprovalMessage =
          response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK &&
          Boolean(transResponse?.getMessages());
        const explicitError = transResponse?.getErrors()?.getError()?.[0]?.getErrorText()
          || response.getMessages()?.getMessage()?.[0]?.getText();
        const disposition = classifyAuthorizeNetDisposition(responseCode, hasApprovalMessage, explicitError);
        if (disposition === "approved") {
          resolve({
            success: true,
            transactionId: transResponse.getTransId(),
            authCode: transResponse.getAuthCode(),
            responseCode,
          });
          return;
        }
        resolve({
          success: false,
          errorMessage: explicitError || "Authorize.Net returned no conclusive response",
          responseCode,
          transactionId: transResponse?.getTransId(),
          ambiguous: disposition === "ambiguous",
        });
      } catch {
        resolve({ success: false, ambiguous: true, errorMessage: "Authorize.Net returned a malformed response" });
      }
    };
    try {
      ctrl.execute(complete);
    } catch {
      resolve({ success: false, ambiguous: true, errorMessage: "Authorize.Net transport failed before a conclusive outcome" });
    }
  });
}

/**
 * Process a debtor card payment using the organization's merchant account
 */
export async function processDebtorCardPayment(
  merchantCredentials: MerchantCredentials,
  paymentData: DebtorPaymentData,
  amount: number,
  invoiceNumber?: string,
  customerEmail?: string
): Promise<ChargeResult> {
  return new Promise((resolve) => {
    if (!merchantCredentials.apiLoginId || !merchantCredentials.transactionKey) {
      resolve({
        success: false,
        errorMessage: 'Merchant credentials not configured',
      });
      return;
    }

    const merchantAuth = new APIContracts.MerchantAuthenticationType();
    merchantAuth.setName(merchantCredentials.apiLoginId);
    merchantAuth.setTransactionKey(merchantCredentials.transactionKey);

    const creditCard = new APIContracts.CreditCardType();
    creditCard.setCardNumber(paymentData.cardNumber.replace(/\s/g, ''));
    creditCard.setExpirationDate(paymentData.expirationDate);
    creditCard.setCardCode(paymentData.cardCode);

    const paymentType = new APIContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    const orderDetails = new APIContracts.OrderType();
    orderDetails.setInvoiceNumber(invoiceNumber || `PMT-${Date.now()}`);
    orderDetails.setDescription('Debt Payment');

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(amount);
    transactionRequest.setOrder(orderDetails);
    addDuplicateWindow(transactionRequest);

    if (customerEmail) {
      const customer = new APIContracts.CustomerDataType();
      customer.setEmail(customerEmail);
      transactionRequest.setCustomer(customer);
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    
    // Debtor payment gateways are live-only.
    ctrl.setEnvironment(Constants.endpoint.production);

    const complete = () => {
      try {
        const response = new APIContracts.CreateTransactionResponse(ctrl.getResponse());
        const transResponse = response.getTransactionResponse();
        const responseCode = transResponse?.getResponseCode();
        const hasApprovalMessage =
          response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK &&
          Boolean(transResponse?.getMessages());
        const explicitError = transResponse?.getErrors()?.getError()?.[0]?.getErrorText()
          || response.getMessages()?.getMessage()?.[0]?.getText();
        const disposition = classifyAuthorizeNetDisposition(responseCode, hasApprovalMessage, explicitError);
        if (disposition === "approved") {
          resolve({
            success: true,
            transactionId: transResponse.getTransId(),
            authCode: transResponse.getAuthCode(),
            responseCode,
          });
          return;
        }
        resolve({
          success: false,
          errorMessage: explicitError || "Authorize.Net returned no conclusive response",
          responseCode,
          transactionId: transResponse?.getTransId(),
          ambiguous: disposition === "ambiguous",
        });
      } catch {
        resolve({ success: false, ambiguous: true, errorMessage: "Authorize.Net returned a malformed response" });
      }
    };
    try {
      ctrl.execute(complete);
    } catch {
      resolve({ success: false, ambiguous: true, errorMessage: "Authorize.Net transport failed before a conclusive outcome" });
    }
  });
}

/**
 * Process a debtor ACH payment using the organization's merchant account
 */
export async function processDebtorAchPayment(
  merchantCredentials: MerchantCredentials,
  achData: AchPaymentData,
  amount: number,
  invoiceNumber?: string
): Promise<ChargeResult> {
  return new Promise((resolve) => {
    if (!merchantCredentials.apiLoginId || !merchantCredentials.transactionKey) {
      resolve({
        success: false,
        errorMessage: 'Merchant credentials not configured',
      });
      return;
    }

    const merchantAuth = new APIContracts.MerchantAuthenticationType();
    merchantAuth.setName(merchantCredentials.apiLoginId);
    merchantAuth.setTransactionKey(merchantCredentials.transactionKey);

    const bankAccount = new APIContracts.BankAccountType();
    bankAccount.setAccountType(
      achData.accountType === 'checking' 
        ? APIContracts.BankAccountTypeEnum.CHECKING 
        : APIContracts.BankAccountTypeEnum.SAVINGS
    );
    bankAccount.setRoutingNumber(achData.routingNumber);
    bankAccount.setAccountNumber(achData.accountNumber);
    bankAccount.setNameOnAccount(achData.nameOnAccount);
    bankAccount.setEcheckType(APIContracts.EcheckTypeEnum.WEB);

    const paymentType = new APIContracts.PaymentType();
    paymentType.setBankAccount(bankAccount);

    const orderDetails = new APIContracts.OrderType();
    orderDetails.setInvoiceNumber(invoiceNumber || `ACH-${Date.now()}`);
    orderDetails.setDescription('ACH Debt Payment');

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(amount);
    transactionRequest.setOrder(orderDetails);
    addDuplicateWindow(transactionRequest);

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    
    ctrl.setEnvironment(Constants.endpoint.production);

    const complete = () => {
      try {
        const response = new APIContracts.CreateTransactionResponse(ctrl.getResponse());
        const transResponse = response.getTransactionResponse();
        const responseCode = transResponse?.getResponseCode();
        const hasApprovalMessage =
          response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK &&
          Boolean(transResponse?.getMessages());
        const explicitError = transResponse?.getErrors()?.getError()?.[0]?.getErrorText()
          || response.getMessages()?.getMessage()?.[0]?.getText();
        const disposition = classifyAuthorizeNetDisposition(responseCode, hasApprovalMessage, explicitError);
        if (disposition === "approved") {
          resolve({
            success: true,
            transactionId: transResponse.getTransId(),
            authCode: transResponse.getAuthCode(),
            responseCode,
          });
          return;
        }
        resolve({
          success: false,
          errorMessage: explicitError || "Authorize.Net returned no conclusive ACH response",
          responseCode,
          transactionId: transResponse?.getTransId(),
          ambiguous: disposition === "ambiguous",
        });
      } catch {
        resolve({ success: false, ambiguous: true, errorMessage: "Authorize.Net returned a malformed ACH response" });
      }
    };
    try {
      ctrl.execute(complete);
    } catch {
      resolve({ success: false, ambiguous: true, errorMessage: "Authorize.Net ACH transport failed before a conclusive outcome" });
    }
  });
}

/**
 * Void a transaction using the organization's merchant account
 */
export async function voidDebtorTransaction(
  merchantCredentials: MerchantCredentials,
  transactionId: string
): Promise<ChargeResult> {
  return new Promise((resolve) => {
    if (!merchantCredentials.apiLoginId || !merchantCredentials.transactionKey) {
      resolve({
        success: false,
        errorMessage: 'Merchant credentials not configured',
      });
      return;
    }

    const merchantAuth = new APIContracts.MerchantAuthenticationType();
    merchantAuth.setName(merchantCredentials.apiLoginId);
    merchantAuth.setTransactionKey(merchantCredentials.transactionKey);

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.VOIDTRANSACTION);
    transactionRequest.setRefTransId(transactionId);

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
    
    ctrl.setEnvironment(Constants.endpoint.production);

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
        const transResponse = response.getTransactionResponse();
        resolve({
          success: true,
          transactionId: transResponse?.getTransId(),
        });
      } else {
        const messages = response.getMessages()?.getMessage();
        resolve({
          success: false,
          errorMessage: messages?.[0]?.getText() || 'Void failed',
        });
      }
    });
  });
}
