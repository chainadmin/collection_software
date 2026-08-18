import Stripe from 'stripe';

// Platform-level Stripe account used only to bill organizations for their DMP
// subscription. Tenant debtor-payment Stripe keys live on Merchant records and
// are never used by this module.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

const PLAN_CONFIG: Record<string, { price: number; seats: number; name: string }> = {
  starter: { price: 200, seats: 4, name: 'Starter' },
  growth: { price: 400, seats: 15, name: 'Growth' },
  agency: { price: 750, seats: 40, name: 'Agency' },
};

export function getSubscriptionPrices() {
  return {
    starter: { price: PLAN_CONFIG.starter.price, seats: PLAN_CONFIG.starter.seats },
    growth: { price: PLAN_CONFIG.growth.price, seats: PLAN_CONFIG.growth.seats },
    agency: { price: PLAN_CONFIG.agency.price, seats: PLAN_CONFIG.agency.seats },
  };
}

export async function createCheckoutSession(
  organizationId: string,
  plan: 'starter' | 'growth' | 'agency',
  successUrl: string,
  cancelUrl: string,
  customerEmail?: string | null,
): Promise<string> {
  const stripe = getStripe();
  const planConfig = PLAN_CONFIG[plan];

  if (!planConfig) {
    throw new Error(`Invalid plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Debt Manager Pro - ${planConfig.name} Plan`,
            description: `${planConfig.seats} collector seats, monthly subscription`,
          },
          unit_amount: planConfig.price * 100,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      organizationId,
      plan,
    },
    subscription_data: { metadata: { organizationId, plan } },
    customer_email: customerEmail || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return session.url;
}

export async function verifyCheckoutSession(sessionId: string): Promise<{
  success: boolean;
  organizationId?: string;
  plan?: string;
  paymentStatus?: string;
}> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === 'paid') {
    return {
      success: true,
      organizationId: session.metadata?.organizationId,
      plan: session.metadata?.plan,
      paymentStatus: session.payment_status,
    };
  }

  return {
    success: false,
    paymentStatus: session.payment_status,
  };
}

export async function handleWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Promise<{
  type: string;
  organizationId?: string;
  plan?: string;
  success: boolean;
  subscriptionStatus?: 'active' | 'past_due' | 'cancelled';
}> {
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid') {
      return {
        type: event.type,
        organizationId: session.metadata?.organizationId,
        plan: session.metadata?.plan,
        success: true,
      };
    }
  }

  const object = event.data.object as any;
  // Invoice metadata is commonly an empty object. Prefer it only when it
  // actually contains the organization identifier; otherwise use the metadata
  // copied onto the Stripe subscription by createCheckoutSession.
  const objectMetadata = object.metadata || {};
  const subscriptionMetadata = object.parent?.subscription_details?.metadata || {};
  const metadata = objectMetadata.organizationId ? objectMetadata : subscriptionMetadata;
  if (event.type === 'invoice.paid') {
    return { type: event.type, organizationId: metadata.organizationId, plan: metadata.plan, success: true, subscriptionStatus: 'active' };
  }
  if (event.type === 'invoice.payment_failed') {
    return { type: event.type, organizationId: metadata.organizationId, plan: metadata.plan, success: false, subscriptionStatus: 'past_due' };
  }
  if (event.type === 'customer.subscription.deleted') {
    return { type: event.type, organizationId: metadata.organizationId, plan: metadata.plan, success: false, subscriptionStatus: 'cancelled' };
  }

  return {
    type: event.type,
    success: false,
  };
}
