import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { onRequest, type Request } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import Stripe from 'stripe';

setGlobalOptions({ region: 'us-central1', maxInstances: 20 });

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] = '2025-08-27.basil';
const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_MONTHLY_PRICE_ID = 'price_1TaMpBJkHhybNz7F4VtKJ5Na';
const DEFAULT_ANNUAL_PRICE_ID = 'price_1TaMprJkHhybNz7FHvsmgQdh';
const DEFAULT_APP_URL = 'https://laundryops-maintenance-app.web.app';
const DEFAULT_MANUAL_MODEL = 'gpt-4.1-mini';
const MAX_MANUAL_CHUNK_LENGTH = 1400;
type BillingPlanKey = 'monthly' | 'annual';
type ManualStatus = 'indexed' | 'processing' | 'missing';

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

async function assertManualManager(organizationId: string, uid: string): Promise<void> {
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
  const canManageManuals = role === 'owner' || role === 'admin' || role === 'manager';
  if (!canManageManuals || status !== 'active') {
    throw new Error('Owner, admin, or manager access is required.');
  }
}

async function assertOrganizationMember(organizationId: string, uid: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const membershipRef = db.doc(`organizations/${organizationId}/memberships/${uid}`);
  const membershipSnap = await membershipRef.get();
  if (!membershipSnap.exists) {
    throw new Error('Organization access not found.');
  }
  const membershipData = membershipSnap.data();
  if (membershipData?.status !== 'active') {
    throw new Error('An active organization membership is required.');
  }
}

function normalizeMachineModelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function manualStatusFromValue(value: unknown): ManualStatus {
  if (value === 'indexed' || value === 'processing' || value === 'missing') {
    return value;
  }
  return 'processing';
}

function chunkManualText(text: string, maxLength: number = MAX_MANUAL_CHUNK_LENGTH): string[] {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u0000/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n+/g, ' ').trim())
    .filter((part) => part.length > 0);

  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if ((current.length + 2 + paragraph.length) <= maxLength) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }
    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function queryTerms(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    ),
  );
}

function scoreChunk(text: string, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }
  const lowered = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lowered.includes(term)) {
      score += 1;
    }
  }
  return score;
}

function fallbackManualAnswer(params: {
  machineModel: string;
  symptoms: string;
  errorCode: string | null;
  topChunks: Array<{ chunkId: string; text: string }>;
}): string {
  const preview = params.topChunks[0]?.text ?? '';
  const snippet = preview.length > 420 ? `${preview.slice(0, 420)}...` : preview;
  const codeLine = params.errorCode ? `Error code reported: ${params.errorCode}.\n` : '';
  return [
    `Machine model: ${params.machineModel}.`,
    codeLine,
    `Symptoms: ${params.symptoms}.`,
    'Manual-grounded guidance (fallback mode):',
    snippet || 'No matching manual chunk was found. Upload and index a manual first.',
  ].filter(Boolean).join('\n');
}

async function buildGroundedManualAnswer(params: {
  machineModel: string;
  symptoms: string;
  errorCode: string | null;
  topChunks: Array<{ chunkId: string; text: string }>;
}): Promise<string> {
  const apiKey = optionalString(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return fallbackManualAnswer(params);
  }

  const client = new OpenAI({ apiKey });
  const excerpts = params.topChunks.map((chunk, index) => {
    const compact = chunk.text.replace(/\s+/g, ' ').trim();
    return `[Chunk ${index + 1} | ${chunk.chunkId}] ${compact}`;
  }).join('\n\n');

  const errorCodeLine = params.errorCode ? `Error code: ${params.errorCode}` : 'Error code: none';
  const response = await client.responses.create({
    model: getEnv('OPENAI_MANUAL_MODEL', DEFAULT_MANUAL_MODEL),
    input: [
      {
        role: 'system',
        content: 'You are a laundromat repair assistant. Use only the provided manual excerpts. If context is missing, say what is missing clearly.',
      },
      {
        role: 'user',
        content: [
          `Machine model: ${params.machineModel}`,
          `Symptoms: ${params.symptoms}`,
          errorCodeLine,
          '',
          'Manual excerpts:',
          excerpts || 'No excerpts available.',
          '',
          'Return: likely cause, first checks, step-by-step actions, and safety note.',
        ].join('\n'),
      },
    ],
  });

  const output = response.output_text?.trim();
  if (output && output.length > 0) {
    return output;
  }

  return fallbackManualAnswer(params);
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

export const indexOrganizationManual = onRequest(
  { cors: true },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    let manualRefPath: string | null = null;

    try {
      const caller = await requireVerifiedCaller(request);
      const organizationId = requireString(request.body?.organizationId, 'organizationId');
      const manualId = requireString(request.body?.manualId, 'manualId');
      await assertManualManager(organizationId, caller.uid);

      ensureFirebaseAdmin();
      const db = getFirestore();
      const manualRef = db.doc(`organizations/${organizationId}/manuals/${manualId}`);
      manualRefPath = manualRef.path;
      const manualSnap = await manualRef.get();
      if (!manualSnap.exists) {
        throw new Error('Manual record not found.');
      }

      const manualData = manualSnap.data() ?? {};
      const storagePath = requireString(manualData.storagePath, 'storagePath');
      const machineModel = requireString(manualData.machineModel, 'machineModel');
      const title = optionalString(manualData.title) ?? storagePath.split('/').slice(-1)[0] ?? 'Manual PDF';
      const previousStatus = manualStatusFromValue(manualData.status);

      await manualRef.set(
        {
          status: 'processing',
          indexError: null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: caller.uid,
          previousStatus,
        },
        { merge: true },
      );

      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('Manual PDF is missing from Storage.');
      }

      const [pdfBytes] = await file.download();
      const parser = new PDFParse({ data: pdfBytes });
      const parsed = await parser.getText();
      await parser.destroy();
      const text = (parsed.text ?? '').trim();
      const chunks = chunkManualText(text);
      if (chunks.length === 0) {
        throw new Error('No readable text was found in this PDF.');
      }

      const machineModelKey = normalizeMachineModelKey(machineModel);
      const machinesSnap = await db.collection(`organizations/${organizationId}/machines`).get();
      const linkedMachineCount = machinesSnap.docs.reduce((count, docSnap) => {
        const model = optionalString(docSnap.data().model) ?? '';
        return normalizeMachineModelKey(model) === machineModelKey ? count + 1 : count;
      }, 0);

      const existingChunksSnap = await manualRef.collection('chunks').get();
      const cleanupBatch = db.batch();
      existingChunksSnap.docs.forEach((docSnap) => cleanupBatch.delete(docSnap.ref));
      await cleanupBatch.commit();

      const writeBatch = db.batch();
      chunks.forEach((chunk, index) => {
        const chunkRef = manualRef.collection('chunks').doc(`chunk-${(index + 1).toString().padStart(3, '0')}`);
        writeBatch.set(chunkRef, {
          text: chunk,
          position: index + 1,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: caller.uid,
        });
      });
      await writeBatch.commit();

      await manualRef.set(
        {
          title,
          machineModel,
          machineModelKey,
          status: 'indexed',
          pageCount: Number.isFinite(parsed.total) ? parsed.total : null,
          chunkCount: chunks.length,
          linkedMachineCount,
          indexError: null,
          indexedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: caller.uid,
        },
        { merge: true },
      );

      response.status(200).json({
        ok: true,
        manualId,
        chunkCount: chunks.length,
        pageCount: Number.isFinite(parsed.total) ? parsed.total : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manual indexing failed.';
      if (manualRefPath) {
        ensureFirebaseAdmin();
        await getFirestore().doc(manualRefPath).set(
          {
            status: 'missing',
            indexError: message,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: 'manual-indexer',
          },
          { merge: true },
        ).catch(() => undefined);
      }
      writeError(response, 400, 'manual_index_failed', message);
    }
  },
);

export const generateRepairAssist = onRequest(
  { cors: true },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      const organizationId = requireString(request.body?.organizationId, 'organizationId');
      const machineModel = requireString(request.body?.machineModel, 'machineModel');
      const symptoms = requireString(request.body?.symptoms, 'symptoms');
      const errorCode = optionalString(request.body?.errorCode) ?? null;
      await assertOrganizationMember(organizationId, caller.uid);

      ensureFirebaseAdmin();
      const db = getFirestore();
      const machineModelKey = normalizeMachineModelKey(machineModel);
      let manualsSnap = await db.collection(`organizations/${organizationId}/manuals`)
        .where('machineModelKey', '==', machineModelKey)
        .where('status', '==', 'indexed')
        .limit(5)
        .get();

      if (manualsSnap.empty) {
        manualsSnap = await db.collection(`organizations/${organizationId}/manuals`)
          .where('status', '==', 'indexed')
          .limit(5)
          .get();
      }

      if (manualsSnap.empty) {
        throw new Error('No indexed manual found. Upload and index a manual first.');
      }

      const manualDoc = manualsSnap.docs[0];
      const manualData = manualDoc.data();
      const chunkDocs = await manualDoc.ref.collection('chunks').limit(50).get();
      if (chunkDocs.empty) {
        throw new Error('Manual is indexed but has no stored chunks.');
      }

      const chunks = chunkDocs.docs
        .map((docSnap) => ({
          chunkId: docSnap.id,
          text: optionalString(docSnap.data().text) ?? '',
        }))
        .filter((chunk) => chunk.text.length > 0);

      if (chunks.length === 0) {
        throw new Error('Manual chunks are empty.');
      }

      const terms = queryTerms(`${machineModel} ${symptoms} ${errorCode ?? ''}`);
      const ranked = chunks
        .map((chunk) => ({
          ...chunk,
          score: scoreChunk(chunk.text, terms),
        }))
        .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));

      const topChunks = (ranked.filter((chunk) => chunk.score > 0).slice(0, 4).length > 0
        ? ranked.filter((chunk) => chunk.score > 0).slice(0, 4)
        : ranked.slice(0, 4))
        .map(({ chunkId, text }) => ({ chunkId, text }));

      const answer = await buildGroundedManualAnswer({
        machineModel,
        symptoms,
        errorCode,
        topChunks,
      });

      response.status(200).json({
        ok: true,
        grounded: Boolean(optionalString(process.env.OPENAI_API_KEY)),
        answer,
        manual: {
          id: manualDoc.id,
          title: optionalString(manualData.title) ?? manualDoc.id,
          machineModel: optionalString(manualData.machineModel) ?? machineModel,
        },
        citations: topChunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          preview: chunk.text.slice(0, 160),
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate repair guidance.';
      writeError(response, 400, 'repair_assist_failed', message);
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
