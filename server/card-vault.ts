import authorizenet from "authorizenet";
import Stripe from "stripe";
import type { Debtor, Merchant } from "@shared/schema";

const APIContracts = authorizenet.APIContracts;
const APIControllers = authorizenet.APIControllers;
const Constants = authorizenet.Constants;

export interface VaultCardInput {
  cardNumber: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
  billingZip?: string;
}

export interface VaultedCard {
  processorType: string;
  processorToken: string;
  processorCustomerId: string | null;
}

function safeGatewayMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  // Gateway errors sometimes echo request values. Never propagate digit runs
  // that could contain account data.
  return message.replace(/(?:\d[ -]?){6,}/g, "[redacted]");
}

async function vaultAuthorizeNet(
  merchant: Merchant,
  debtor: Debtor,
  input: VaultCardInput,
): Promise<VaultedCard> {
  return new Promise((resolve, reject) => {
    const auth = new APIContracts.MerchantAuthenticationType();
    auth.setName(merchant.authorizeNetApiLoginId!);
    auth.setTransactionKey(merchant.authorizeNetTransactionKey!);

    const creditCard = new APIContracts.CreditCardType();
    creditCard.setCardNumber(input.cardNumber);
    creditCard.setExpirationDate(`${input.expiryYear}-${input.expiryMonth}`);
    creditCard.setCardCode(input.cvv);
    const payment = new APIContracts.PaymentType();
    payment.setCreditCard(creditCard);

    const billTo = new APIContracts.CustomerAddressType();
    billTo.setFirstName(debtor.firstName);
    billTo.setLastName(debtor.lastName);
    if (input.billingZip) billTo.setZip(input.billingZip);

    const paymentProfile = new APIContracts.CustomerPaymentProfileType();
    paymentProfile.setCustomerType(APIContracts.CustomerTypeEnum.INDIVIDUAL);
    paymentProfile.setBillTo(billTo);
    paymentProfile.setPayment(payment);

    const profile = new APIContracts.CustomerProfileType();
    profile.setMerchantCustomerId(debtor.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20));
    if (debtor.email) profile.setEmail(debtor.email);
    profile.setPaymentProfiles([paymentProfile]);

    const request = new APIContracts.CreateCustomerProfileRequest();
    request.setMerchantAuthentication(auth);
    request.setProfile(profile);
    request.setValidationMode(
      merchant.testMode
        ? APIContracts.ValidationModeEnum.TESTMODE
        : APIContracts.ValidationModeEnum.LIVEMODE,
    );
    const controller = new APIControllers.CreateCustomerProfileController(request.getJSON());
    controller.setEnvironment(
      !merchant.testMode && process.env.NODE_ENV === "production"
        ? Constants.endpoint.production
        : Constants.endpoint.sandbox,
    );
    controller.execute(() => {
      try {
        const response = new APIContracts.CreateCustomerProfileResponse(controller.getResponse());
        if (response.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
          const text = response.getMessages()?.getMessage()?.[0]?.getText();
          reject(new Error(text || "Authorize.Net rejected the customer payment profile"));
          return;
        }
        const customerId = String(response.getCustomerProfileId());
        const ids = response.getCustomerPaymentProfileIdList()?.getNumericString?.() || [];
        const paymentProfileId = ids[0] && String(ids[0]);
        if (!customerId || !paymentProfileId) {
          reject(new Error("Authorize.Net did not return a reusable CIM payment profile"));
          return;
        }
        resolve({
          processorType: "authorize_net",
          processorCustomerId: customerId,
          processorToken: paymentProfileId,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function vaultStripe(
  merchant: Merchant,
  debtor: Debtor,
  input: VaultCardInput,
): Promise<VaultedCard> {
  const stripe = new Stripe(merchant.stripeSecretKey!);
  const customer = await stripe.customers.create({
    name: input.cardholderName,
    email: debtor.email || undefined,
    metadata: { debtorId: debtor.id },
  });
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      number: input.cardNumber,
      exp_month: Number(input.expiryMonth),
      exp_year: Number(input.expiryYear),
      cvc: input.cvv,
    },
    billing_details: {
      name: input.cardholderName,
      address: input.billingZip ? { postal_code: input.billingZip } : undefined,
    },
  });
  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
  const setup = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method: paymentMethod.id,
    confirm: true,
    usage: "off_session",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  });
  if (setup.status !== "succeeded") {
    throw new Error(`Stripe card setup status: ${setup.status}`);
  }
  return {
    processorType: "stripe",
    processorCustomerId: customer.id,
    processorToken: paymentMethod.id,
  };
}

export async function vaultCard(
  merchant: Merchant,
  debtor: Debtor,
  input: VaultCardInput,
): Promise<VaultedCard> {
  try {
    if (merchant.processorType === "authorize_net") {
      return await vaultAuthorizeNet(merchant, debtor, input);
    }
    if (merchant.processorType === "stripe") {
      return await vaultStripe(merchant, debtor, input);
    }
    throw new Error(
      `${merchant.processorType} does not support secure no-charge card vaulting in this application configuration`,
    );
  } catch (error) {
    throw new Error(safeGatewayMessage(error, "Card vaulting failed"));
  }
}