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

export interface CardPaymentData {
  cardNumber: string;
  expirationDate: string; // MMYY format
  cardCode: string; // CVV
}

export interface AchPaymentData {
  accountType: 'checking' | 'savings';
  routingNumber: string;
  accountNumber: string;
  nameOnAccount: string;
}

function getMerchantAuth(): APIContracts.MerchantAuthenticationType {
  const merchantAuth = new APIContracts.MerchantAuthenticationType();
  merchantAuth.setName(ANET_API_LOGIN_ID || '');
  merchantAuth.setTransactionKey(ANET_TRANSACTION_KEY || '');
  return merchantAuth;
}

export async function chargeCard(
  cardData: CardPaymentData,
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
    orderDetails.setInvoiceNumber(invoiceNumber || `INV-${Date.now()}`);
    orderDetails.setDescription('Debt Payment');

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

export async function chargeAch(
  achData: AchPaymentData,
  amount: number,
  invoiceNumber?: string
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
    orderDetails.setInvoiceNumber(invoiceNumber || `INV-${Date.now()}`);
    orderDetails.setDescription('ACH Debt Payment');

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(amount);
    transactionRequest.setOrder(orderDetails);

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

export async function voidTransaction(transactionId: string): Promise<ChargeResult> {
  return new Promise((resolve) => {
    if (!ANET_API_LOGIN_ID || !ANET_TRANSACTION_KEY) {
      resolve({
        success: false,
        errorMessage: 'Authorize.net credentials not configured',
      });
      return;
    }

    const merchantAuth = getMerchantAuth();

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.VOIDTRANSACTION);
    transactionRequest.setRefTransId(transactionId);

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

export async function refundTransaction(
  transactionId: string,
  amount: number,
  lastFourDigits: string
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
    creditCard.setCardNumber(lastFourDigits);
    creditCard.setExpirationDate('XXXX');

    const paymentType = new APIContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    const transactionRequest = new APIContracts.TransactionRequestType();
    transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.REFUNDTRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(amount);
    transactionRequest.setRefTransId(transactionId);

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
        resolve({
          success: true,
          transactionId: transResponse?.getTransId(),
        });
      } else {
        const messages = response.getMessages()?.getMessage();
        resolve({
          success: false,
          errorMessage: messages?.[0]?.getText() || 'Refund failed',
        });
      }
    });
  });
}

export function isConfigured(): boolean {
  return !!(ANET_API_LOGIN_ID && ANET_TRANSACTION_KEY);
}
