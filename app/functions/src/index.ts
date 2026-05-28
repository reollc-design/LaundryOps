import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { onRequest, type Request } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import Stripe from 'stripe';

setGlobalOptions({ region: 'us-central1', maxInstances: 20 });

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] = '2025-08-27.basil';
const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_MONTHLY_PRICE_ID = 'price_1TaMpBJkHhybNz7F4VtKJ5Na';
const DEFAULT_ANNUAL_PRICE_ID = 'price_1TaMprJkHhybNz7FHvsmgQdh';
const DEFAULT_APP_URL = 'https://laundryops-maintenance-app.web.app';
type BillingPlanKey = 'monthly' | 'annual';

function ensureFirebaseAdmin(): void {
  if (getApps().length === 0) {
    initializeApp();
  }
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof fallback === 'string') {
    return fallback;
  }
  throw new Error(`Missing server environment variable ${name}.`);
}

function trialDaysFromEnv(): number {
  const raw = process.env.STRIPE_TRIAL_DAYS;
  if (!raw) {
    return DEFAULT_TRIAL_DAYS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 730) {
    return DEFAULT_TRIAL_DAYS;
  }
  return parsed;
}

function billingPlanFromRequest(value: unknown): BillingPlanKey {
  return value === 'monthly' ? 'monthly' : 'annual';
}

function priceIdForBillingPlan(plan: BillingPlanKey): string {
  if (plan === 'monthly') {
    return getEnv('STRIPE_MONTHLY_PRICE_ID', getEnv('STRIPE_PRICE_ID', DEFAULT_MONTHLY_PRICE_ID));
  }

  return getEnv('STRIPE_ANNUAL_PRICE_ID', DEFAULT_ANNUAL_PRICE_ID);
}

function toDateOrNull(epochSeconds: number | null | undefined): Date | null {
  if (!epochSeconds || !Number.isFinite(epochSeconds)) {
    return null;
  }
  return new Date(epochSeconds * 1000);
}

async function requireVerifiedCaller(request: Request): Promise<{ uid: string; email: string | null }> {
  ensureFirebaseAdmin();
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing auth token.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const decoded = await getAuth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
  };
}

async function assertOwnerOrAdmin(organizationId: string, uid: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const membershipRef = db.doc(`organizations/${organizationId}/memberships/${uid}`);
  const membershipSnap = await membershipRef.get();
  if (!membershipSnap.exists) {
    throw new Error('Organization access not found.');
  }
  const membershipData = membershipSnap.data();
  const role = membershipData?.role;
  const status = membershipData?.status;
  if ((role !== 'owner' && role !== 'admin') || status !== 'active') {
    throw new Error('Owner or admin access is required.');
  }
}

function getStripeClient(): Stripe {
  const secret = stripeSecretKey.value();
  if (!secret) {
    throw new Error('Missing STRIPE_SECRET_KEY.');
  }

  return new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
}

interface OrganizationBillingIdentity {
  stripeCustomerId: string;
  organizationName: string;
}

async function getOrCreateStripeCustomer(params: {
  organizationId: string;
  uid: string;
  email: string | null;
}): Promise<OrganizationBillingIdentity> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const orgRef = db.doc(`organizations/${params.organizationId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new Error('Organization not found.');
  }

  const orgData = orgSnap.data() ?? {};
  const organizationName = optionalString(orgData.name) ?? 'LaundryOps Account';
  const existingCustomerId = optionalString(orgData.providerCustomerId);
  if (existingCustomerId) {
    return { stripeCustomerId: existingCustomerId, organizationName };
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: params.email ?? undefined,
    name: organizationName,
    metadata: {
      organizationId: params.organizationId,
      ownerUserId: params.uid,
    },
  });

  await orgRef.set(
    {
      providerCustomerId: customer.id,
      billingStatus: optionalString(orgData.billingStatus) ?? 'trialing',
      subscriptionStatus: optionalString(orgData.subscriptionStatus) ?? 'trialing',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: params.uid,
    },
    { merge: true },
  );

  return {
    stripeCustomerId: customer.id,
    organizationName,
  };
}

function billingRecordPath(organizationId: string, subscriptionId: string): string {
  return `organizations/${organizationId}/subscriptions/${subscriptionId}`;
}

function writeError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

export const createStripeCheckoutSession = onRequest(
  { cors: true, secrets: [stripeSecretKey] },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      const organizationId = requireString(request.body?.organizationId, 'organizationId');
      const billingPlan = billingPlanFromRequest(request.body?.billingPlan);
      await assertOwnerOrAdmin(organizationId, caller.uid);

      const stripe = getStripeClient();
      const customerIdentity = await getOrCreateStripeCustomer({
        organizationId,
        uid: caller.uid,
        email: caller.email,
      });

      const priceId = priceIdForBillingPlan(billingPlan);
      const successUrl = getEnv('STRIPE_SUCCESS_URL', `${DEFAULT_APP_URL}/account?billing=success`);
      const cancelUrl = getEnv('STRIPE_CANCEL_URL', successUrl);
      const trialDays = trialDaysFromEnv();

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerIdentity.stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        client_reference_id: organizationId,
        metadata: {
          organizationId,
          ownerUserId: caller.uid,
          billingPlan,
        },
        subscription_data: {
          trial_period_days: trialDays,
          metadata: {
            organizationId,
            billingPlan,
          },
        },
      });

      response.status(200).json({
        ok: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        trialDays,
        billingPlan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start subscription checkout.';
      writeError(response, 400, 'checkout_failed', message);
    }
  },
);

export const createStripeBillingPortalSession = onRequest(
  { cors: true, secrets: [stripeSecretKey] },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      const organizationId = requireString(request.body?.organizationId, 'organizationId');
      await assertOwnerOrAdmin(organizationId, caller.uid);

      const customerIdentity = await getOrCreateStripeCustomer({
        organizationId,
        uid: caller.uid,
        email: caller.email,
      });

      const returnUrl = getEnv('STRIPE_BILLING_RETURN_URL', getEnv('STRIPE_SUCCESS_URL', `${DEFAULT_APP_URL}/account`));
      const stripe = getStripeClient();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerIdentity.stripeCustomerId,
        return_url: returnUrl,
      });

      response.status(200).json({
        ok: true,
        portalUrl: portalSession.url,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open billing portal.';
      writeError(response, 400, 'portal_failed', message);
    }
  },
);

export const stripeWebhook = onRequest(
  { cors: false, secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string' || signature.length === 0) {
      response.status(400).send('Missing Stripe signature header.');
      return;
    }

    try {
      ensureFirebaseAdmin();
      const stripe = getStripeClient();
      const webhookSecret = stripeWebhookSecret.value();
      if (!webhookSecret) {
        throw new Error('Missing STRIPE_WEBHOOK_SECRET.');
      }

      const event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
      const db = getFirestore();

      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const payloadObject = event.data.object;
        let organizationId: string | undefined;
        let subscriptionId: string | undefined;
        let customerId: string | undefined;
        let subscriptionStatus: string | undefined;
        let trialEnd: Date | null = null;

        if (event.type === 'checkout.session.completed') {
          const checkoutSession = payloadObject as Stripe.Checkout.Session;
          organizationId = optionalString(checkoutSession.metadata?.organizationId);
          customerId = typeof checkoutSession.customer === 'string' ? checkoutSession.customer : undefined;
          subscriptionId = typeof checkoutSession.subscription === 'string' ? checkoutSession.subscription : undefined;
          subscriptionStatus = 'trialing';
        } else {
          const subscription = payloadObject as Stripe.Subscription;
          organizationId = optionalString(subscription.metadata?.organizationId);
          subscriptionId = subscription.id;
          customerId = typeof subscription.customer === 'string' ? subscription.customer : undefined;
          subscriptionStatus = subscription.status;
          trialEnd = toDateOrNull(subscription.trial_end ?? null);
        }

        if (organizationId) {
          const orgRef = db.doc(`organizations/${organizationId}`);
          const billingPatch: Record<string, unknown> = {
            providerCustomerId: customerId ?? null,
            providerSubscriptionId: subscriptionId ?? null,
            subscriptionStatus: subscriptionStatus ?? 'trialing',
            billingStatus: subscriptionStatus ?? 'trialing',
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: 'stripe-webhook',
            billingProvider: 'stripe',
          };

          if (trialEnd) {
            billingPatch.trialEndsAt = Timestamp.fromDate(trialEnd);
          }
          await orgRef.set(billingPatch, { merge: true });

          if (subscriptionId) {
            await db.doc(billingRecordPath(organizationId, subscriptionId)).set(
              {
                provider: 'stripe',
                providerSubscriptionId: subscriptionId,
                providerCustomerId: customerId ?? null,
                status: subscriptionStatus ?? 'trialing',
                trialEndsAt: trialEnd ? Timestamp.fromDate(trialEnd) : null,
                lastEventType: event.type,
                lastEventId: event.id,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          }
        }
      }

      response.status(200).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook handling failed.';
      response.status(400).send(message);
    }
  },
);
