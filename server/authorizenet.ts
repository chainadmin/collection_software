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
