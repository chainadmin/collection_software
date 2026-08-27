import authorizenet from "authorizenet";
import type { Debtor, Merchant } from "@shared/schema";

const { APIContracts, APIControllers, Constants } = authorizenet;

export interface RawCardInput {
  pan: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
  billingZip: string;
}

export interface VaultedCard {
  processorType: string;
  processorToken: string;
  processorCustomerId: string | null;
  vaultStatus: "vaulted";
}

export class CardVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardVaultError";
  }
}

function authorizeEnvironment(merchant: Merchant) {
  return !merchant.testMode && process.env.NODE_ENV === "production"
    ? Constants.endpoint.production
    : Constants.endpoint.sandbox;
}

function authorizeAuth(merchant: Merchant) {
  const auth = new APIContracts.MerchantAuthenticationType();
  auth.setName(merchant.authorizeNetApiLoginId!);
  auth.setTransactionKey(merchant.authorizeNetTransactionKey!);
  return auth;
}

function authorizeResponseError(response: any): CardVaultError {
  const code = response?.getMessages?.()?.getMessage?.()?.[0]?.getCode?.();
  return new CardVaultError(code ? `Authorize.Net vault request failed (${code})` : "Authorize.Net vault request failed");
}

function duplicateAuthorizeCustomerId(response: any): string | null {
  const messages = response?.getMessages?.()?.getMessage?.() || [];
  const text = messages.map((message: any) => message?.getText?.() || "").join(" ");
  // Authorize.Net E00039 duplicate responses include the existing numeric
  // customer-profile ID. Recover it to permit additional payment profiles.
  if (!/duplicate/i.test(text)) return null;
  return text.match(/\b\d{4,}\b/)?.[0] || null;
}

async function createAuthorizeCustomer(merchant: Merchant, debtor: Debtor): Promise<string> {
  return new Promise((resolve, reject) => {
    const profile = new APIContracts.CustomerProfileType();
    profile.setMerchantCustomerId(debtor.id.slice(0, 20));
    if (debtor.email) profile.setEmail(debtor.email);
    profile.setDescription(`Debtor ${debtor.accountNumber}`.slice(0, 255));
    const request = new APIContracts.CreateCustomerProfileRequest();
    request.setMerchantAuthentication(authorizeAuth(merchant));
    request.setProfile(profile);
    const controller = new APIControllers.CreateCustomerProfileController(request.getJSON());
    controller.setEnvironment(authorizeEnvironment(merchant));
    controller.execute(() => {
      const response = new APIContracts.CreateCustomerProfileResponse(controller.getResponse());
      if (response.getMessages()?.getResultCode() === APIContracts.MessageTypeEnum.OK && response.getCustomerProfileId()) {
        resolve(String(response.getCustomerProfileId()));
      } else {
        const existingId = duplicateAuthorizeCustomerId(response);
        if (existingId) resolve(existingId);
        else reject(authorizeResponseError(response));
      }
    });
  });
}

async function createAuthorizePaymentProfile(
  merchant: Merchant,
  customerId: string,
  card: RawCardInput,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const creditCard = new APIContracts.CreditCardType();
    creditCard.setCardNumber(card.pan);
    creditCard.setExpirationDate(`${card.expiryYear}-${card.expiryMonth}`);
    creditCard.setCardCode(card.cvv);
    const payment = new APIContracts.PaymentType();
    payment.setCreditCard(creditCard);
    const billTo = new APIContracts.CustomerAddressType();
    billTo.setFirstName(card.cardholderName.slice(0, 50));
    if (card.billingZip) billTo.setZip(card.billingZip);
    const profile = new APIContracts.CustomerPaymentProfileType();
    profile.setCustomerType(APIContracts.CustomerTypeEnum.INDIVIDUAL);
    profile.setBillTo(billTo);
    profile.setPayment(payment);
    const request = new APIContracts.CreateCustomerPaymentProfileRequest();
    request.setMerchantAuthentication(authorizeAuth(merchant));
    request.setCustomerProfileId(customerId);
    request.setPaymentProfile(profile);
    // Profile creation only: do not authorize or capture any debt payment.
    request.setValidationMode(APIContracts.ValidationModeEnum.NONE);
    const controller = new APIControllers.CreateCustomerPaymentProfileController(request.getJSON());
    controller.setEnvironment(authorizeEnvironment(merchant));
    controller.execute(() => {
      const response = new APIContracts.CreateCustomerPaymentProfileResponse(controller.getResponse());
      if (response.getMessages()?.getResultCode() === APIContracts.MessageTypeEnum.OK && response.getCustomerPaymentProfileId()) {
        resolve(String(response.getCustomerPaymentProfileId()));
      } else {
        reject(authorizeResponseError(response));
      }
    });
  });
}

async function vaultAuthorizeNet(
  merchant: Merchant,
  debtor: Debtor,
  card: RawCardInput,
  existingCustomerId?: string,
): Promise<VaultedCard> {
  const customerId = existingCustomerId || await createAuthorizeCustomer(merchant, debtor);
  const paymentProfileId = await createAuthorizePaymentProfile(merchant, customerId, card);
  return {
    processorType: "authorize_net",
    processorToken: paymentProfileId,
    processorCustomerId: customerId,
    vaultStatus: "vaulted",
  };
}

async function vaultStripe(
  _merchant: Merchant,
  _debtor: Debtor,
  _card: RawCardInput,
  _existingCustomerId?: string,
): Promise<VaultedCard> {
  // Stripe requires Elements/Checkout or another hosted client-side collection
  // flow. This application has no tenant publishable-key flow, so never send
  // PAN/CVV through the server-side PaymentMethod API.
  throw new CardVaultError("Stripe saved-card vaulting is unavailable until a hosted Stripe setup flow is configured");
}

async function vaultNmi(merchant: Merchant, card: RawCardInput): Promise<VaultedCard> {
  const params = new URLSearchParams({
    security_key: merchant.nmiSecurityKey!,
    customer_vault: "add_customer",
    ccnumber: card.pan,
    ccexp: `${card.expiryMonth}${card.expiryYear.slice(-2)}`,
    cvv: card.cvv,
    first_name: card.cardholderName,
    zip: card.billingZip,
  });
  const response = await fetch("https://secure.nmi.com/api/transact.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const result = new URLSearchParams(await response.text());
  const token = result.get("customer_vault_id");
  if (result.get("response") !== "1" || !token) throw new CardVaultError("NMI card vaulting failed");
  return {
    processorType: "nmi",
    processorToken: token,
    processorCustomerId: token,
    vaultStatus: "vaulted",
  };
}

export async function vaultCard(
  merchant: Merchant,
  debtor: Debtor,
  card: RawCardInput,
  existingCustomerId?: string,
): Promise<VaultedCard> {
  if (merchant.processorType === "authorize_net") {
    return vaultAuthorizeNet(merchant, debtor, card, existingCustomerId);
  }
  if (merchant.processorType === "stripe") {
    return vaultStripe(merchant, debtor, card, existingCustomerId);
  }
  if (merchant.processorType === "nmi") return vaultNmi(merchant, card);
  if (merchant.processorType === "usaepay") {
    throw new CardVaultError("USAePay no-charge card vaulting is not available in this integration");
  }
  throw new CardVaultError("The active processor does not support card vaulting");
}