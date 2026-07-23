import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, Timestamp, getFirestore, type CollectionReference, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { onRequest, type Request } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import Stripe from 'stripe';
import {
  buildManualErrorCodeIndex,
  chunkManualText,
  errorCodeAliases,
  manualModelMatchesMachine,
  processManualPages,
  type ManualChunkText,
  type ManualErrorCodeIndexEntry,
} from './manual-indexing.js';
import {
  assertOrganizationAccess,
  bearerTokenFromHeader,
  consumeRateLimit,
  OrganizationAccessError,
  RateLimitExceededError,
  type OrganizationAccessState,
  type RateLimitRecord,
  type RequestRateLimitOperation,
  RequestAuthenticationError,
  REQUEST_RATE_LIMIT_POLICIES,
} from './request-protection.js';
import {
  assertBillingAllowed,
  buildCheckoutSubscriptionData,
  evaluateTrialAccess,
  timestampToMilliseconds,
} from './trial.js';
import {
  buildStripeBillingEventState,
  decideStripeBillingEvent,
  shouldUpdateOrganizationBillingState,
  type StoredStripeBillingState,
  type StripeBillingEventState,
  type StripeBillingEventType,
  type StripeSubscriptionSnapshot,
} from './stripe-webhook-state.js';

setGlobalOptions({ region: 'us-central1', maxInstances: 20 });

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const openAiApiKey = defineSecret('OPENAI_API_KEY');

const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] = '2025-08-27.basil';
const DEFAULT_MONTHLY_PRICE_ID = 'price_1TaMpBJkHhybNz7F4VtKJ5Na';
const DEFAULT_ANNUAL_PRICE_ID = 'price_1TaMprJkHhybNz7FHvsmgQdh';
const DEFAULT_APP_URL = 'https://laundryops-maintenance-app.web.app';
const PRODUCTION_CORS_ORIGINS = [
  DEFAULT_APP_URL,
  'https://laundryops-maintenance-app.firebaseapp.com',
];
const LOCAL_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const ALLOWED_CORS_ORIGINS = process.env.FUNCTIONS_EMULATOR === 'true'
  ? [...PRODUCTION_CORS_ORIGINS, ...LOCAL_CORS_ORIGINS]
  : PRODUCTION_CORS_ORIGINS;
const DEFAULT_MANUAL_MODEL = 'gpt-5.5';
const MAX_REPAIR_ASSIST_CHUNKS = 8;
const MAX_CODE_ALIAS_PARTS = 5;
const MAX_CODE_ALIAS_PATTERN_LENGTH = 200;
const MAX_DOCUMENT_ID_LENGTH = 200;
const MAX_STORAGE_PATH_LENGTH = 1024;
const MAX_MACHINE_MODEL_LENGTH = 500;
const MANUAL_REINDEX_PAGE_SIZE = 100;
const FIRESTORE_BATCH_WRITE_LIMIT = 450;
const LEGACY_MANUAL_CHUNK_COLLECTION = 'chunks';
const MANUAL_CHUNK_VERSION_PREFIX = 'chunks_v';
const LEGACY_MANUAL_ERROR_CODE_COLLECTION = 'errorCodes';
const MANUAL_ERROR_CODE_VERSION_PREFIX = 'errorCodes_v';
type BillingPlanKey = 'monthly' | 'annual';
type ManualStatus = 'indexed' | 'processing' | 'missing';

interface MachineContext {
  id: string;
  machineNumber: string;
  type: string;
  make?: string;
  modelNumber?: string;
  model: string;
}

interface ManualIndexResult {
  manualId: string;
  chunkCount: number;
  errorCodeIndexCount: number;
  pageCount: number | null;
}

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

function requireStringWithMaxLength(value: unknown, fieldName: string, maxLength: number): string {
  const str = requireString(value, fieldName);
  if (str.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters.`);
  }
  return str;
}

function optionalStringWithMaxLength(value: unknown, fieldName: string, maxLength: number): string | undefined {
  const str = optionalString(value);
  if (str && str.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters.`);
  }
  return str;
}

function isPathSafeDocumentId(value: string): boolean {
  return !value.includes('/') && value !== '.' && value !== '..';
}

function requirePathSafeDocumentId(value: unknown, fieldName: string): string {
  const str = requireStringWithMaxLength(value, fieldName, MAX_DOCUMENT_ID_LENGTH);
  if (!isPathSafeDocumentId(str)) {
    throw new Error(`${fieldName} is invalid.`);
  }
  return str;
}

function optionalPathSafeDocumentId(value: unknown, fieldName: string): string | undefined {
  const str = optionalStringWithMaxLength(value, fieldName, MAX_DOCUMENT_ID_LENGTH);
  if (str && !isPathSafeDocumentId(str)) {
    throw new Error(`${fieldName} is invalid.`);
  }
  return str;
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

function billingPlanFromRequest(value: unknown): BillingPlanKey {
  return value === 'monthly' ? 'monthly' : 'annual';
}

function priceIdForBillingPlan(plan: BillingPlanKey): string {
  if (plan === 'monthly') {
    return getEnv('STRIPE_MONTHLY_PRICE_ID', getEnv('STRIPE_PRICE_ID', DEFAULT_MONTHLY_PRICE_ID));
  }

  return getEnv('STRIPE_ANNUAL_PRICE_ID', DEFAULT_ANNUAL_PRICE_ID);
}

async function requireVerifiedCaller(request: Request): Promise<{ uid: string; email: string | null }> {
  ensureFirebaseAdmin();
  const idToken = bearerTokenFromHeader(request.headers.authorization);
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    throw new RequestAuthenticationError('Invalid auth token.');
  }
  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
  };
}

function organizationAccessState(
  orgSnap: FirebaseFirestore.DocumentSnapshot,
  membershipSnap: FirebaseFirestore.DocumentSnapshot,
): OrganizationAccessState {
  const orgData = orgSnap.data();
  const membershipData = membershipSnap.data();
  return {
    organizationExists: orgSnap.exists,
    ownerUserId: optionalString(orgData?.ownerUserId),
    membershipExists: membershipSnap.exists,
    membershipRole: membershipData?.role,
    membershipStatus: membershipData?.status,
  };
}

function assertActiveOrganizationTrial(orgSnap: FirebaseFirestore.DocumentSnapshot): void {
  const orgData = orgSnap.data() ?? {};
  const trial = evaluateTrialAccess(
    {
      accessEntitlement: optionalString(orgData.accessEntitlement),
      subscriptionStatus: optionalString(orgData.subscriptionStatus),
      trialStartedAtMs: timestampToMilliseconds(orgData.trialStartedAt),
      trialEndsAtMs: timestampToMilliseconds(orgData.trialEndsAt),
    },
    Date.now(),
  );
  if (trial.status !== 'active') {
    throw new Error('Your 14-day trial has ended. Choose a paid plan to continue.');
  }
}

async function assertOwnerOrAdmin(organizationId: string, uid: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const orgRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`organizations/${organizationId}/memberships/${uid}`);
  const [orgSnap, membershipSnap] = await Promise.all([orgRef.get(), membershipRef.get()]);
  assertOrganizationAccess({
    uid,
    mode: 'ownerOrAdmin',
    state: organizationAccessState(orgSnap, membershipSnap),
  });
}

async function assertManualManager(organizationId: string, uid: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const orgRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`organizations/${organizationId}/memberships/${uid}`);
  const [orgSnap, membershipSnap] = await Promise.all([orgRef.get(), membershipRef.get()]);
  assertOrganizationAccess({
    uid,
    mode: 'manualManager',
    state: organizationAccessState(orgSnap, membershipSnap),
  });
  assertActiveOrganizationTrial(orgSnap);
}

async function assertOrganizationMember(organizationId: string, uid: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const orgRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`organizations/${organizationId}/memberships/${uid}`);
  const [orgSnap, membershipSnap] = await Promise.all([orgRef.get(), membershipRef.get()]);
  assertOrganizationAccess({
    uid,
    mode: 'member',
    state: organizationAccessState(orgSnap, membershipSnap),
  });
  assertActiveOrganizationTrial(orgSnap);
}

function normalizeMachineModelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function machineModelFromParts(parts: { make?: string; modelNumber?: string; model?: string; type?: string; machineNumber?: string }): string {
  const makeModel = [parts.make, parts.modelNumber].filter(Boolean).join(' ').trim();
  return makeModel || parts.model?.trim() || parts.type?.trim() || parts.machineNumber?.trim() || 'Machine';
}

function isSpecificMachineModel(value: string): boolean {
  const normalized = normalizeMachineModelKey(value);
  if (normalized === 'machine' || normalized === 'washer' || normalized === 'dryer') {
    return false;
  }
  return compactKey(value).length >= 5 && /\d/.test(value);
}

function machineContextFromDoc(id: string, data: Record<string, unknown>): MachineContext {
  const machineNumber = optionalString(data.machineNumber) ?? optionalString(data.label) ?? id.toUpperCase();
  const type = optionalString(data.type) ?? optionalString(data.category) ?? 'Machine';
  const make = optionalString(data.make);
  const modelNumber = optionalString(data.modelNumber);
  const model = machineModelFromParts({
    make,
    modelNumber,
    model: optionalString(data.model),
    type,
    machineNumber,
  });

  return {
    id,
    machineNumber,
    type,
    make,
    modelNumber,
    model,
  };
}

function machineMatchesText(machine: MachineContext, text: string, explicitMachineNumber?: string): boolean {
  const machineNumber = machine.machineNumber.trim();
  if (!machineNumber) {
    return false;
  }

  const compactMachineNumber = compactKey(machineNumber);
  const compactExplicit = explicitMachineNumber ? compactKey(explicitMachineNumber) : '';
  if (compactExplicit && compactExplicit === compactMachineNumber) {
    return true;
  }

  const type = machine.type.toLowerCase().trim();
  const typeInitial = type[0] ?? '';
  const compactTokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(compactKey)
    .filter((token) => token.length > 0);
  const aliases = uniqueStrings([
    `${type}${compactMachineNumber}`,
    typeInitial ? `${typeInitial}${compactMachineNumber}` : '',
  ]).filter((alias) => alias.length >= 2);

  if (compactMachineNumber.length >= 2 && compactTokens.includes(compactMachineNumber)) {
    return true;
  }

  if (aliases.some((alias) => compactTokens.includes(alias))) {
    return true;
  }

  const escapedMachineNumber = machineNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const typePattern = type ? `|${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` : '';
  return new RegExp(`\\b(?:machine|washer|dryer|unit${typePattern})\\s*#?\\s*${escapedMachineNumber}\\b`, 'i').test(text);
}

async function resolveMachineContext(params: {
  db: Firestore;
  organizationId: string;
  machineId?: string;
  machineNumber?: string;
  machineModel: string;
  symptoms: string;
  errorCode: string | null;
}): Promise<MachineContext | null> {
  if (params.machineId) {
    const machineSnap = await params.db.doc(`organizations/${params.organizationId}/machines/${params.machineId}`).get();
    if (machineSnap.exists) {
      return machineContextFromDoc(machineSnap.id, machineSnap.data() ?? {});
    }
  }

  const lookupText = [
    params.machineNumber ?? '',
    params.machineModel,
    params.symptoms,
    params.errorCode ?? '',
  ].join(' ');
  const machinesSnap = await params.db.collection(`organizations/${params.organizationId}/machines`).limit(500).get();
  const machines = machinesSnap.docs.map((docSnap) => machineContextFromDoc(docSnap.id, docSnap.data()));
  return machines.find((machine) => machineMatchesText(machine, lookupText, params.machineNumber)) ?? null;
}

async function findIndexedManualForModel(params: {
  db: Firestore;
  organizationId: string;
  machineModel: string;
  machine?: MachineContext | null;
}) {
  const modelValues = uniqueStrings([
    params.machineModel,
    params.machine?.model ?? '',
    machineModelFromParts({
      make: params.machine?.make,
      modelNumber: params.machine?.modelNumber,
      model: params.machine?.model,
      type: params.machine?.type,
      machineNumber: params.machine?.machineNumber,
    }),
    params.machine?.modelNumber ?? '',
  ]);
  const modelKeys = uniqueStrings(modelValues.map(normalizeMachineModelKey));
  const compactModelKeys = uniqueStrings(modelKeys.map(compactKey));

  for (const modelKey of modelKeys) {
    if (!modelKey) {
      continue;
    }
    const exactSnap = await params.db.collection(`organizations/${params.organizationId}/manuals`)
      .where('machineModelKey', '==', modelKey)
      .where('status', '==', 'indexed')
      .limit(1)
      .get();
    if (!exactSnap.empty) {
      return exactSnap.docs[0];
    }
  }

  for (const compactModelKey of compactModelKeys) {
    if (!compactModelKey) {
      continue;
    }
    const compactSnap = await params.db.collection(`organizations/${params.organizationId}/manuals`)
      .where('machineModelCompactKey', '==', compactModelKey)
      .where('status', '==', 'indexed')
      .limit(1)
      .get();
    if (!compactSnap.empty) {
      return compactSnap.docs[0];
    }
  }

  const indexedDocs = [];
  let indexedCursor: string | undefined;
  while (true) {
    let indexedQuery = params.db.collection(`organizations/${params.organizationId}/manuals`)
      .orderBy(FieldPath.documentId())
      .limit(MANUAL_REINDEX_PAGE_SIZE);
    if (indexedCursor) {
      indexedQuery = indexedQuery.startAfter(indexedCursor);
    }

    const indexedPage = await indexedQuery.get();
    indexedDocs.push(...indexedPage.docs.filter((docSnap) => docSnap.data().status === 'indexed'));
    const nextCursor = indexedPage.docs[indexedPage.docs.length - 1]?.id;
    if (indexedPage.empty || indexedPage.size < MANUAL_REINDEX_PAGE_SIZE || !nextCursor || nextCursor === indexedCursor) {
      break;
    }
    indexedCursor = nextCursor;
  }

  const makeKey = compactKey(params.machine?.make ?? '');
  const modelNumberKey = compactKey(params.machine?.modelNumber ?? '');
  const strongModelKeys = uniqueStrings(modelKeys.map(compactKey).filter((value) => value.length >= 4));
  const hasMakeAndModelNumber = makeKey.length >= 3 && modelNumberKey.length >= 4;
  const compactModelNumberKey = compactKey(params.machine?.modelNumber ?? '');
  const candidates = indexedDocs
    .map((docSnap) => {
      const data = docSnap.data();
      const manualModel = optionalString(data.machineModel) ?? optionalString(data.title) ?? docSnap.id;
      const manualKey = compactKey([
        manualModel,
        optionalString(data.title) ?? '',
        optionalString(data.machineModelKey) ?? '',
        optionalString(data.machineModelCompactKey) ?? '',
      ].join(' '));
      const hasModelNumber = params.machine
        ? manualModelMatchesMachine(manualModel, {
          make: params.machine.make,
          modelNumber: params.machine.modelNumber,
          model: params.machine.model,
        })
        : compactModelNumberKey.length >= 4 && manualKey.includes(compactModelNumberKey);
      const hasMake = makeKey.length >= 3 && manualKey.includes(makeKey);
      const hasStrongModel = strongModelKeys.some((modelKey) => manualKey.includes(modelKey) || modelKey.includes(manualKey));
      let score = 0;
      if (hasModelNumber) {
        score += 10;
      }
      if (hasMake) {
        score += 3;
      }
      if (hasStrongModel) {
        score += 5;
      }
      const compactHasStrongModel = compactModelKeys.some((compactModelKey) => compactModelKey.length >= 5
        && (manualKey.includes(compactModelKey) || compactModelKey.includes(manualKey)));
      const accepted = hasMakeAndModelNumber
        ? hasModelNumber
        : hasModelNumber && (hasStrongModel || compactHasStrongModel);
      return { docSnap, score, accepted };
    })
    .filter((candidate) => candidate.accepted)
    .sort((a, b) => b.score - a.score || a.docSnap.id.localeCompare(b.docSnap.id));

  return candidates[0]?.docSnap ?? null;
}

function manualStatusFromValue(value: unknown): ManualStatus {
  if (value === 'indexed' || value === 'processing' || value === 'missing') {
    return value;
  }
  return 'processing';
}

function newManualChunkCollectionName(): string {
  return `${MANUAL_CHUNK_VERSION_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newManualErrorCodeCollectionName(): string {
  return `${MANUAL_ERROR_CODE_VERSION_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function activeManualChunkCollection(manualData: Record<string, unknown>): string {
  return optionalString(manualData.activeChunkCollection) ?? LEGACY_MANUAL_CHUNK_COLLECTION;
}

function activeManualErrorCodeCollection(manualData: Record<string, unknown>): string {
  return optionalString(manualData.activeErrorCodeCollection) ?? LEGACY_MANUAL_ERROR_CODE_COLLECTION;
}

function manualChunkId(index: number): string {
  return `chunk-${(index + 1).toString().padStart(3, '0')}`;
}

async function writeManualChunksInBatches(params: {
  db: Firestore;
  manualRef: DocumentReference;
  collectionName: string;
  chunks: string[];
  uid: string;
}): Promise<ManualChunkText[]> {
  let batch = params.db.batch();
  let writes = 0;
  const storedChunks: ManualChunkText[] = [];

  for (const [index, chunk] of params.chunks.entries()) {
    const chunkId = manualChunkId(index);
    const chunkRef = params.manualRef.collection(params.collectionName).doc(chunkId);
    batch.set(chunkRef, {
      text: chunk,
      position: index + 1,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: params.uid,
    });
    storedChunks.push({ chunkId, text: chunk });
    writes += 1;

    if (writes >= FIRESTORE_BATCH_WRITE_LIMIT) {
      await batch.commit();
      batch = params.db.batch();
      writes = 0;
    }
  }

  if (writes > 0) {
    await batch.commit();
  }

  return storedChunks;
}

async function readManualChunks(params: {
  manualRef: DocumentReference;
  manualData: Record<string, unknown>;
}): Promise<Array<{ chunkId: string; text: string }>> {
  const collectionName = activeManualChunkCollection(params.manualData);
  const readCollection = async (name: string): Promise<Array<{ chunkId: string; text: string }>> => {
    const snapshot = await params.manualRef.collection(name).orderBy('position', 'asc').get();
    return snapshot.docs
      .map((docSnap) => ({
        chunkId: docSnap.id,
        text: optionalString(docSnap.data().text) ?? '',
      }))
      .filter((chunk) => chunk.text.length > 0);
  };

  return readCollection(collectionName);
}

async function deleteCollectionDocumentsInBatches(db: Firestore, collectionRef: CollectionReference): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snapshot = await collectionRef.limit(FIRESTORE_BATCH_WRITE_LIMIT).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deletedCount += snapshot.size;

    if (snapshot.size < FIRESTORE_BATCH_WRITE_LIMIT) {
      break;
    }
  }

  return deletedCount;
}

async function deleteManualIndexCollections(params: {
  db: Firestore;
  manualRef: DocumentReference;
  manualData: Record<string, unknown>;
}): Promise<number> {
  const collectionNames = new Set<string>([
    LEGACY_MANUAL_CHUNK_COLLECTION,
    activeManualChunkCollection(params.manualData),
    LEGACY_MANUAL_ERROR_CODE_COLLECTION,
    activeManualErrorCodeCollection(params.manualData),
  ]);
  const collections = await params.manualRef.listCollections();
  collections.forEach((collectionRef) => {
    if (
      collectionRef.id === LEGACY_MANUAL_CHUNK_COLLECTION
      || collectionRef.id.startsWith(MANUAL_CHUNK_VERSION_PREFIX)
      || collectionRef.id === LEGACY_MANUAL_ERROR_CODE_COLLECTION
      || collectionRef.id.startsWith(MANUAL_ERROR_CODE_VERSION_PREFIX)
    ) {
      collectionNames.add(collectionRef.id);
    }
  });

  let deletedCount = 0;
  for (const collectionName of collectionNames) {
    deletedCount += await deleteCollectionDocumentsInBatches(params.db, params.manualRef.collection(collectionName));
  }

  return deletedCount;
}

async function deleteStaleManualIndexCollections(params: {
  db: Firestore;
  manualRef: DocumentReference;
  manualData: Record<string, unknown>;
}): Promise<number> {
  const activeChunkCollection = activeManualChunkCollection(params.manualData);
  const activeErrorCodeCollection = activeManualErrorCodeCollection(params.manualData);
  const collections = await params.manualRef.listCollections();
  let deletedCount = 0;

  for (const collectionRef of collections) {
    const isChunkIndex = collectionRef.id === LEGACY_MANUAL_CHUNK_COLLECTION
      || collectionRef.id.startsWith(MANUAL_CHUNK_VERSION_PREFIX);
    const isErrorCodeIndex = collectionRef.id === LEGACY_MANUAL_ERROR_CODE_COLLECTION
      || collectionRef.id.startsWith(MANUAL_ERROR_CODE_VERSION_PREFIX);
    if (!isChunkIndex && !isErrorCodeIndex) {
      continue;
    }
    if (collectionRef.id === activeChunkCollection || collectionRef.id === activeErrorCodeCollection) {
      continue;
    }
    deletedCount += await deleteCollectionDocumentsInBatches(params.db, collectionRef);
  }

  return deletedCount;
}

async function writeManualErrorCodeIndexInBatches(params: {
  db: Firestore;
  manualRef: DocumentReference;
  chunks: ManualChunkText[];
  uid: string;
  collectionName: string;
}): Promise<number> {
  const errorCodeRef = params.manualRef.collection(params.collectionName);
  const entries = buildManualErrorCodeIndex(params.chunks);
  let batch = params.db.batch();
  let writes = 0;

  for (const entry of entries) {
    batch.set(errorCodeRef.doc(entry.normalizedCode), {
      code: entry.displayCode,
      normalizedCode: entry.normalizedCode,
      aliases: entry.aliases,
      chunkIds: entry.chunkIds,
      previews: entry.previews,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: params.uid,
    });
    writes += 1;

    if (writes >= FIRESTORE_BATCH_WRITE_LIMIT) {
      await batch.commit();
      batch = params.db.batch();
      writes = 0;
    }
  }

  if (writes > 0) {
    await batch.commit();
  }

  return entries.length;
}

async function readManualErrorCodeChunkIds(params: {
  manualRef: DocumentReference;
  manualData: Record<string, unknown>;
  codeAliases: string[];
}): Promise<string[]> {
  const normalizedCodes = uniqueStrings(params.codeAliases.map(compactKey))
    .filter((code) => code.length >= 2 && code.length <= 12);
  if (normalizedCodes.length === 0) {
    return [];
  }

  const collectionName = activeManualErrorCodeCollection(params.manualData);
  const docs = await Promise.all(
    normalizedCodes.map((code) => params.manualRef.collection(collectionName).doc(code).get()),
  );
  const chunkIds: string[] = [];
  for (const docSnap of docs) {
    if (!docSnap.exists) {
      continue;
    }
    const storedChunkIds = docSnap.data()?.chunkIds;
    if (!Array.isArray(storedChunkIds)) {
      continue;
    }
    storedChunkIds.forEach((chunkId) => {
      if (typeof chunkId === 'string' && chunkId.trim().length > 0) {
        chunkIds.push(chunkId.trim());
      }
    });
  }

  return uniqueStrings(chunkIds);
}

function queryTerms(value: string): string[] {
  const stopWords = new Set(['and', 'the', 'for', 'with', 'has', 'had', 'code', 'error', 'machine', 'washer', 'dryer']);
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2 && !stopWords.has(term)),
    ),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectedManualStoragePathPattern(organizationId: string, manualId: string): RegExp {
  return new RegExp(`^orgs/${escapeRegExp(organizationId)}/manuals/[^/]+/${escapeRegExp(manualId)}/[^/]+\\.pdf$`, 'i');
}

function requireManualStoragePath(value: unknown, organizationId: string, manualId: string): string {
  const storagePath = requireStringWithMaxLength(value, 'storagePath', MAX_STORAGE_PATH_LENGTH);
  if (!expectedManualStoragePathPattern(organizationId, manualId).test(storagePath)) {
    throw new Error('Manual storage path is outside this organization.');
  }
  return storagePath;
}

function optionalManualStoragePath(value: unknown, organizationId: string, manualId: string): string | undefined {
  const storagePath = optionalStringWithMaxLength(value, 'storagePath', MAX_STORAGE_PATH_LENGTH);
  if (storagePath && !expectedManualStoragePathPattern(organizationId, manualId).test(storagePath)) {
    throw new Error('Manual storage path is outside this organization.');
  }
  return storagePath;
}

function codeAliasMatches(text: string, alias: string): boolean {
  const parts = alias
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }
  if (parts.length > MAX_CODE_ALIAS_PARTS) {
    return false;
  }

  const pattern = parts.length > 1
    ? parts.map(escapeRegExp).join('[\\s:-]*')
    : escapeRegExp(parts[0]);
  if (pattern.length > MAX_CODE_ALIAS_PATTERN_LENGTH) {
    return false;
  }
  return new RegExp(`\\b${pattern}\\b`, 'i').test(text);
}

function chunkHasCodeAlias(text: string, codeAliases: string[]): boolean {
  return codeAliases.some((alias) => codeAliasMatches(text, alias));
}

function scoreChunk(text: string, terms: string[], codeAliases: string[]): number {
  if (terms.length === 0 && codeAliases.length === 0) {
    return 0;
  }
  const lowered = text.toLowerCase();
  let score = 0;
  for (const alias of codeAliases) {
    if (codeAliasMatches(text, alias)) {
      score += 30;
    }
  }
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
  const symptomsLine = params.symptoms ? `Symptoms: ${params.symptoms}.` : 'Symptoms: not provided.';
  return [
    `Machine model: ${params.machineModel}.`,
    codeLine,
    symptomsLine,
    'Manual source text selected. OpenAI did not return a usable answer, so here is the most relevant manual text:',
    snippet || 'No matching manual chunk was found. Upload and index a manual first.',
  ].filter(Boolean).join('\n');
}

async function buildGroundedManualAnswer(params: {
  machineModel: string;
  symptoms: string;
  errorCode: string | null;
  topChunks: Array<{ chunkId: string; text: string }>;
}): Promise<string> {
  const apiKey = optionalString(openAiApiKey.value());
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured for Repair Assist. Set Firebase secret OPENAI_API_KEY.');
  }

  const client = new OpenAI({ apiKey });
  const excerpts = params.topChunks.map((chunk, index) => {
    const compact = chunk.text.replace(/\s+/g, ' ').trim();
    return `[Chunk ${index + 1} | ${chunk.chunkId}] ${compact}`;
  }).join('\n\n');

  const errorCodeLine = params.errorCode ? `Error code: ${params.errorCode}` : 'Error code: none';
  const symptomsLine = params.symptoms ? `Symptoms: ${params.symptoms}` : 'Symptoms: not provided';
  const response = await client.responses.create({
    model: getEnv('OPENAI_MANUAL_MODEL', DEFAULT_MANUAL_MODEL),
    input: [
      {
        role: 'system',
        content: [
          'You are a professional commercial laundry repair technician.',
          'The uploaded technical manual excerpts are the source of truth.',
          'First and foremost, base repair guidance explicitly on the provided manual excerpts.',
          'If the excerpts do not contain the requested error code or repair procedure, say that clearly before adding any general repair knowledge.',
          'Do not pretend a part number, voltage, resistance value, or procedure came from the manual unless it appears in the excerpts.',
          'Use practical technician language and include safety warnings before electrical or panel-access steps.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Machine model: ${params.machineModel}`,
          symptomsLine,
          errorCodeLine,
          '',
          'Manual excerpts:',
          excerpts || 'No excerpts available.',
          '',
          'Return the answer in this exact structure:',
          '### 1. Likely Causes',
          '### 2. Step-by-Step Repair Instructions',
          '### 3. Required Parts',
          '### 4. Difficulty Level',
          '### 5. Safety Precautions',
          '',
          'Cite chunk IDs where useful, for example [chunk-003].',
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
  subscriptionStatus: string | null;
  trialStartedAtMs: number | null;
  trialEndsAtMs: number | null;
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
  assertBillingAllowed({ accessEntitlement: optionalString(orgData.accessEntitlement) });
  const organizationName = optionalString(orgData.name) ?? 'LaundryOps Account';
  const billingIdentity = {
    subscriptionStatus: optionalString(orgData.subscriptionStatus) ?? null,
    trialStartedAtMs: timestampToMilliseconds(orgData.trialStartedAt),
    trialEndsAtMs: timestampToMilliseconds(orgData.trialEndsAt),
  };
  const existingCustomerId = optionalString(orgData.providerCustomerId);
  if (existingCustomerId) {
    return { stripeCustomerId: existingCustomerId, organizationName, ...billingIdentity };
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
    ...billingIdentity,
  };
}

function billingRecordPath(organizationId: string, subscriptionId: string): string {
  const safeSubscriptionId = requirePathSafeDocumentId(subscriptionId, 'subscriptionId');
  return `organizations/${organizationId}/subscriptions/${safeSubscriptionId}`;
}

function stripeWebhookOrganizationId(value: unknown): string | undefined {
  try {
    return optionalPathSafeDocumentId(value, 'organizationId');
  } catch (error) {
    console.warn('Stripe webhook skipped invalid organization metadata.', error);
    return undefined;
  }
}

function stripeResourceId(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === 'string' ? value : optionalString(value?.id);
}

function stripeSubscriptionSnapshot(subscription: Stripe.Subscription): StripeSubscriptionSnapshot {
  return {
    id: subscription.id,
    customerId: stripeResourceId(subscription.customer) ?? null,
    status: subscription.status,
    trialEndSeconds: subscription.trial_end ?? null,
  };
}

function storedBillingState(data: FirebaseFirestore.DocumentData | undefined, organization: boolean): StoredStripeBillingState {
  if (!data) {
    return {};
  }
  return organization
    ? {
        eventId: data.lastStripeBillingEventId,
        eventCreated: data.lastStripeBillingEventCreated,
        eventType: data.lastStripeBillingEventType,
        subscriptionId: data.providerSubscriptionId,
        status: data.subscriptionStatus,
      }
    : {
        eventId: data.lastEventId,
        eventCreated: data.lastEventCreated,
        eventType: data.lastEventType,
        subscriptionId: data.providerSubscriptionId,
        status: data.status,
      };
}

async function applyStripeBillingEvent(
  db: Firestore,
  eventState: StripeBillingEventState,
): Promise<'applied' | 'ignored' | 'missing-organization'> {
  const orgRef = db.doc(`organizations/${eventState.organizationId}`);
  const subscriptionRef = db.doc(billingRecordPath(eventState.organizationId, eventState.id));

  return db.runTransaction(async (transaction) => {
    const orgSnap = await transaction.get(orgRef);
    const subscriptionSnap = await transaction.get(subscriptionRef);
    if (!orgSnap.exists) {
      return 'missing-organization';
    }

    const subscriptionDecision = decideStripeBillingEvent(
      eventState,
      storedBillingState(subscriptionSnap.data(), false),
    );
    if (subscriptionDecision !== 'apply') {
      return 'ignored';
    }

    const eventTimestamp = FieldValue.serverTimestamp();
    transaction.set(
      subscriptionRef,
      {
        provider: 'stripe',
        providerSubscriptionId: eventState.id,
        providerCustomerId: eventState.customerId,
        status: eventState.status,
        trialEndsAt: eventState.trialEndSeconds === null
          ? null
          : Timestamp.fromMillis(eventState.trialEndSeconds * 1000),
        lastEventType: eventState.eventType,
        lastEventId: eventState.eventId,
        lastEventCreated: eventState.eventCreated,
        updatedAt: eventTimestamp,
      },
      { merge: true },
    );

    const organizationState = storedBillingState(orgSnap.data(), true);
    if (shouldUpdateOrganizationBillingState(eventState, organizationState)) {
      transaction.set(
        orgRef,
        {
          providerCustomerId: eventState.customerId,
          providerSubscriptionId: eventState.id,
          subscriptionStatus: eventState.status,
          billingStatus: eventState.status,
          billingProvider: 'stripe',
          lastStripeBillingEventType: eventState.eventType,
          lastStripeBillingEventId: eventState.eventId,
          lastStripeBillingEventCreated: eventState.eventCreated,
          updatedAt: eventTimestamp,
          updatedBy: 'stripe-webhook',
        },
        { merge: true },
      );
    }

    return 'applied';
  });
}

const CLIENT_SAFE_ERROR_PREFIXES = [
  'Missing required field:',
  'organizationId exceeds maximum length',
  'manualId exceeds maximum length',
  'machineModel exceeds maximum length',
  'symptoms exceeds maximum length',
  'errorCode exceeds maximum length',
  'machineId exceeds maximum length',
  'machineNumber exceeds maximum length',
];

const CLIENT_SAFE_ERROR_MESSAGES = new Set([
  'Missing auth token.',
  'Invalid auth token.',
  'Too many requests. Please try again shortly.',
  'Organization access not found.',
  'Owner or admin access is required.',
  'Owner, admin, or manager access is required.',
  'An active organization membership is required.',
  'Organization not found.',
  'Billing is not available for developer workspaces.',
  'Manual record not found.',
  'Manual PDF is missing from Storage.',
  'Unable to extract text from the provided PDF. Please ensure the PDF contains readable text.',
  'Manual storage path is outside this organization.',
  'Enter symptoms or an error code before using Repair Assist.',
  'Machine make and model number are required before Repair Assist can select the correct manufacturer manual.',
  'No indexed manual matches this machine model number. Upload and index the manufacturer repair manual using the exact model number first.',
  'Manual is indexed but has no readable stored chunks.',
  'The selected manual does not contain that error code. Confirm the manual is the correct manufacturer repair manual, then try again.',
  'The selected manual does not contain enough source text for this repair request.',
  'organizationId is invalid.',
  'manualId is invalid.',
  'machineId is invalid.',
  'subscriptionId is invalid.',
]);

function clientSafeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (
    message &&
    (CLIENT_SAFE_ERROR_MESSAGES.has(message) ||
      CLIENT_SAFE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix)))
  ) {
    return message;
  }

  if (message) {
    console.error(fallback, error);
  }
  return fallback;
}

interface RateLimitHeaderState {
  limit: number;
  windowSeconds: number;
  remaining: number;
  retryAfterSeconds?: number;
}

function rateLimitRecordFromData(data: Record<string, unknown> | undefined): RateLimitRecord | null {
  const windowStartedAt = data?.windowStartedAt;
  const windowStartedAtMs = windowStartedAt instanceof Timestamp
    ? windowStartedAt.toMillis()
    : typeof windowStartedAt === 'number'
      ? windowStartedAt
      : null;
  const count = data?.count;
  if (windowStartedAtMs === null || typeof count !== 'number') {
    return null;
  }
  return { windowStartedAtMs, count };
}

function rateLimitDocumentId(operation: RequestRateLimitOperation, uid: string): string {
  return createHash('sha256').update(`${operation}:${uid}`).digest('hex');
}

function addRateLimitHeaders(response: Response, state?: RateLimitHeaderState): void {
  if (!response.get('X-RateLimit-Limit')) {
    response.set('X-RateLimit-Limit', String(state?.limit ?? 10));
    response.set('X-RateLimit-Window', String(state?.windowSeconds ?? 60));
    response.set('X-RateLimit-Remaining', String(state?.remaining ?? state?.limit ?? 10));
  }
  if (state) {
    response.set('X-RateLimit-Limit', String(state.limit));
    response.set('X-RateLimit-Window', String(state.windowSeconds));
    response.set('X-RateLimit-Remaining', String(state.remaining));
    if (state.retryAfterSeconds !== undefined) {
      response.set('Retry-After', String(state.retryAfterSeconds));
    }
  }
}

async function enforceRequestRateLimit(params: {
  operation: RequestRateLimitOperation;
  uid: string;
  response: Response;
}): Promise<RateLimitHeaderState> {
  ensureFirebaseAdmin();
  const policy = REQUEST_RATE_LIMIT_POLICIES[params.operation];
  const db = getFirestore();
  const rateLimitRef = db.doc(`functionRateLimits/${rateLimitDocumentId(params.operation, params.uid)}`);
  const nowMs = Date.now();
  let decision: ReturnType<typeof consumeRateLimit> | undefined;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    decision = consumeRateLimit(rateLimitRecordFromData(snapshot.data()), nowMs, policy);
    if (decision.allowed) {
      transaction.set(rateLimitRef, {
        windowStartedAt: Timestamp.fromMillis(decision.record.windowStartedAtMs),
        count: decision.record.count,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

  if (!decision) {
    throw new Error('Could not evaluate request rate limit.');
  }

  const state: RateLimitHeaderState = {
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
    remaining: decision.remaining,
    retryAfterSeconds: decision.retryAfterSeconds,
  };
  addRateLimitHeaders(params.response, state);
  if (!decision.allowed) {
    throw new RateLimitExceededError(decision.retryAfterSeconds ?? policy.windowSeconds);
  }
  return state;
}

function httpStatusForError(error: unknown, fallbackStatus: number): number {
  if (error instanceof RateLimitExceededError) {
    return 429;
  }
  if (error instanceof RequestAuthenticationError) {
    return 401;
  }
  if (error instanceof OrganizationAccessError) {
    return 403;
  }
  return fallbackStatus;
}

function writeError(response: Response, status: number, code: string, message: string): void {
  addRateLimitHeaders(response);
  response.status(status).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

async function indexManualRecord(params: {
  db: Firestore;
  organizationId: string;
  manualId: string;
  uid: string;
}): Promise<ManualIndexResult> {
  const manualRef = params.db.doc(`organizations/${params.organizationId}/manuals/${params.manualId}`);
  let previousStatusForFailure: ManualStatus | null = null;
  let canMarkFailure = false;
  let newChunkCollectionName: string | null = null;
  let newErrorCodeCollectionName: string | null = null;
  let committedNewIndex = false;

  try {
    const manualSnap = await manualRef.get();
    if (!manualSnap.exists) {
      throw new Error('Manual record not found.');
    }

    canMarkFailure = true;
    const manualData = manualSnap.data() ?? {};
    const storagePath = requireManualStoragePath(manualData.storagePath, params.organizationId, params.manualId);
    const machineModel = requireStringWithMaxLength(manualData.machineModel, 'machineModel', MAX_MACHINE_MODEL_LENGTH);
    const title = optionalString(manualData.title) ?? storagePath.split('/').slice(-1)[0] ?? 'Manual PDF';
    const previousStatus = manualStatusFromValue(manualData.status);
    previousStatusForFailure = previousStatus;

    await manualRef.set(
      {
        status: previousStatus === 'indexed' ? 'indexed' : 'processing',
        indexingStatus: 'processing',
        indexError: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: params.uid,
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
      throw new Error('Unable to extract text from the provided PDF. Please ensure the PDF contains readable text.');
    }

    const machineModelKey = normalizeMachineModelKey(machineModel);
    const machineModelCompactKey = compactKey(machineModelKey);
    const machinesSnap = await params.db.collection(`organizations/${params.organizationId}/machines`).get();
    const linkedMachineCount = machinesSnap.docs.reduce((count, docSnap) => {
      const machine = docSnap.data();
      return manualModelMatchesMachine(machineModel, {
        make: optionalString(machine.make),
        modelNumber: optionalString(machine.modelNumber),
        model: optionalString(machine.model),
      }) ? count + 1 : count;
    }, 0);

    const chunkCollectionName = newManualChunkCollectionName();
    const errorCodeCollectionName = newManualErrorCodeCollectionName();
    newChunkCollectionName = chunkCollectionName;
    newErrorCodeCollectionName = errorCodeCollectionName;
    const storedChunks = await writeManualChunksInBatches({
      db: params.db,
      manualRef,
      collectionName: chunkCollectionName,
      chunks,
      uid: params.uid,
    });
    const errorCodeIndexCount = await writeManualErrorCodeIndexInBatches({
      db: params.db,
      manualRef,
      chunks: storedChunks,
      uid: params.uid,
      collectionName: errorCodeCollectionName,
    });
    const pageCount = Number.isFinite(parsed.total) ? parsed.total : null;

    await manualRef.set(
      {
        title,
        machineModel,
        machineModelKey,
        machineModelCompactKey,
        status: 'indexed',
        indexingStatus: 'idle',
        activeChunkCollection: chunkCollectionName,
        activeErrorCodeCollection: errorCodeCollectionName,
        pageCount,
        chunkCount: chunks.length,
        errorCodeIndexCount,
        linkedMachineCount,
        indexError: null,
        indexedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: params.uid,
      },
      { merge: true },
    );
    committedNewIndex = true;
    await deleteStaleManualIndexCollections({
      db: params.db,
      manualRef,
      manualData: {
        ...manualData,
        activeChunkCollection: chunkCollectionName,
        activeErrorCodeCollection: errorCodeCollectionName,
      },
    }).catch((cleanupError) => {
      console.warn('Manual re-index succeeded but stale index cleanup failed.', cleanupError);
    });

    return {
      manualId: params.manualId,
      chunkCount: chunks.length,
      errorCodeIndexCount,
      pageCount,
    };
  } catch (error) {
    const message = clientSafeErrorMessage(error, 'Manual indexing failed.');
    if (!committedNewIndex) {
      for (const collectionName of [newChunkCollectionName, newErrorCodeCollectionName]) {
        if (!collectionName) {
          continue;
        }
        await deleteCollectionDocumentsInBatches(params.db, manualRef.collection(collectionName)).catch((cleanupError) => {
          console.warn('Failed to clean up an incomplete manual index collection.', cleanupError);
        });
      }
    }
    if (canMarkFailure) {
      await manualRef.set(
        {
          status: previousStatusForFailure === 'indexed' ? 'indexed' : 'missing',
          indexingStatus: 'failed',
          indexError: message,
          indexingFailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: params.uid,
        },
        { merge: true },
      ).catch(() => undefined);
    }
    throw new Error(message);
  }
}

export const createStripeCheckoutSession = onRequest(
  { cors: ALLOWED_CORS_ORIGINS, secrets: [stripeSecretKey] },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      await enforceRequestRateLimit({ operation: 'stripeCheckout', uid: caller.uid, response });
      const organizationId = requirePathSafeDocumentId(request.body?.organizationId, 'organizationId');
      const billingPlan = billingPlanFromRequest(request.body?.billingPlan);
      await assertOwnerOrAdmin(organizationId, caller.uid);

      const customerIdentity = await getOrCreateStripeCustomer({
        organizationId,
        uid: caller.uid,
        email: caller.email,
      });

      const stripe = getStripeClient();
      const priceId = priceIdForBillingPlan(billingPlan);
      const successUrl = getEnv('STRIPE_SUCCESS_URL', `${DEFAULT_APP_URL}/account?billing=success`);
      const cancelUrl = getEnv('STRIPE_CANCEL_URL', `${DEFAULT_APP_URL}/account?billing=cancel`);
      const subscriptionData = buildCheckoutSubscriptionData({
        organizationId,
        billingPlan,
        trial: customerIdentity,
        nowMs: Date.now(),
      });

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
        subscription_data: subscriptionData,
      });

      addRateLimitHeaders(response);
      response.status(200).json({
        ok: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        trialEndUnixSeconds: subscriptionData.trial_end ?? null,
        billingPlan,
      });
    } catch (error) {
      const message = clientSafeErrorMessage(error, 'Could not start subscription checkout.');
      writeError(response, httpStatusForError(error, 400), 'checkout_failed', message);
    }
  },
);

export const createStripeBillingPortalSession = onRequest(
  { cors: ALLOWED_CORS_ORIGINS, secrets: [stripeSecretKey] },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      await enforceRequestRateLimit({ operation: 'billingPortal', uid: caller.uid, response });
      const organizationId = requirePathSafeDocumentId(request.body?.organizationId, 'organizationId');
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

      addRateLimitHeaders(response);
      response.status(200).json({
        ok: true,
        portalUrl: portalSession.url,
      });
    } catch (error) {
      const message = clientSafeErrorMessage(error, 'Could not open billing portal.');
      writeError(response, httpStatusForError(error, 400), 'portal_failed', message);
    }
  },
);

export const indexOrganizationManual = onRequest(
  { cors: ALLOWED_CORS_ORIGINS },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      await enforceRequestRateLimit({ operation: 'indexManual', uid: caller.uid, response });
      const organizationId = requirePathSafeDocumentId(request.body?.organizationId, 'organizationId');
      const manualId = requirePathSafeDocumentId(request.body?.manualId, 'manualId');
      await assertManualManager(organizationId, caller.uid);

      ensureFirebaseAdmin();
      const db = getFirestore();
      const result = await indexManualRecord({
        db,
        organizationId,
        manualId,
        uid: caller.uid,
      });

      addRateLimitHeaders(response);
      response.status(200).json({
        ok: true,
        manualId: result.manualId,
        chunkCount: result.chunkCount,
        errorCodeIndexCount: result.errorCodeIndexCount,
        pageCount: result.pageCount,
      });
    } catch (error) {
      const message = clientSafeErrorMessage(error, 'Manual indexing failed.');
      writeError(response, httpStatusForError(error, 400), 'manual_index_failed', message);
    }
  },
);

export const reindexOrganizationManuals = onRequest(
  { cors: ALLOWED_CORS_ORIGINS, timeoutSeconds: 540 },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      await enforceRequestRateLimit({ operation: 'reindexManuals', uid: caller.uid, response });
      const organizationId = requirePathSafeDocumentId(request.body?.organizationId, 'organizationId');
      await assertManualManager(organizationId, caller.uid);

      ensureFirebaseAdmin();
      const db = getFirestore();
      const result = await processManualPages({
        fetchPage: async (cursor?: string) => {
          let query = db.collection(`organizations/${organizationId}/manuals`)
            .orderBy(FieldPath.documentId())
            .limit(MANUAL_REINDEX_PAGE_SIZE);
          if (cursor) {
            query = query.startAfter(cursor);
          }
          const snapshot = await query.get();
          return {
            items: snapshot.docs,
            nextCursor: snapshot.docs[snapshot.docs.length - 1]?.id,
          };
        },
        getItemId: (manualSnap) => manualSnap.id,
        shouldProcess: (manualSnap) => {
          const data = manualSnap.data();
          return Boolean(optionalString(data.storagePath) && optionalString(data.machineModel));
        },
        process: (manualSnap) => indexManualRecord({
          db,
          organizationId,
          manualId: manualSnap.id,
          uid: caller.uid,
        }),
        toErrorMessage: (error) => clientSafeErrorMessage(error, 'Manual indexing failed.'),
      });

      addRateLimitHeaders(response);
      response.status(200).json({
        ok: true,
        organizationId,
        totalManualCount: result.fetchedCount,
        uploadedManualCount: result.fetchedCount - result.skippedCount,
        reindexedCount: result.processed.length,
        failedCount: result.failures.length,
        skippedCount: result.skippedCount,
        pagesProcessed: result.pagesProcessed,
        manuals: result.processed,
        failures: result.failures.map((failure) => ({
          manualId: failure.itemId,
          message: failure.message,
        })),
        limited: false,
      });
    } catch (error) {
      const message = clientSafeErrorMessage(error, 'Manual bulk re-index failed.');
      writeError(response, httpStatusForError(error, 400), 'manual_bulk_reindex_failed', message);
    }
  },
);

export const deleteOrganizationManual = onRequest(
  { cors: ALLOWED_CORS_ORIGINS },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      await enforceRequestRateLimit({ operation: 'deleteManual', uid: caller.uid, response });
      const organizationId = requirePathSafeDocumentId(request.body?.organizationId, 'organizationId');
      const manualId = requirePathSafeDocumentId(request.body?.manualId, 'manualId');
      await assertManualManager(organizationId, caller.uid);

      ensureFirebaseAdmin();
      const db = getFirestore();
      const manualRef = db.doc(`organizations/${organizationId}/manuals/${manualId}`);
      const manualSnap = await manualRef.get();
      if (!manualSnap.exists) {
        throw new Error('Manual record not found.');
      }

      const manualData = manualSnap.data() ?? {};
      const storagePath = optionalManualStoragePath(manualData.storagePath, organizationId, manualId);
      if (storagePath) {
        await getStorage().bucket().file(storagePath).delete().catch((error: unknown) => {
          const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
          if (code !== 404 && code !== '404') {
            throw error;
          }
        });
      }

      const deletedIndexCount = await deleteManualIndexCollections({
        db,
        manualRef,
        manualData,
      });
      await manualRef.delete();

      addRateLimitHeaders(response);
      response.status(200).json({
        ok: true,
        manualId,
        deletedIndexCount,
        storageDeleted: Boolean(storagePath),
      });
    } catch (error) {
      const message = clientSafeErrorMessage(error, 'Manual delete failed.');
      writeError(response, httpStatusForError(error, 400), 'manual_delete_failed', message);
    }
  },
);

export const generateRepairAssist = onRequest(
  { cors: ALLOWED_CORS_ORIGINS, secrets: [openAiApiKey] },
  async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for this endpoint.');
      return;
    }

    try {
      const caller = await requireVerifiedCaller(request);
      await enforceRequestRateLimit({ operation: 'repairAssist', uid: caller.uid, response });
      const organizationId = requirePathSafeDocumentId(request.body?.organizationId, 'organizationId');
      const requestedMachineModel = requireStringWithMaxLength(request.body?.machineModel, 'machineModel', MAX_MACHINE_MODEL_LENGTH);
      const symptoms = optionalStringWithMaxLength(request.body?.symptoms, 'symptoms', 2000) ?? '';
      const errorCode = optionalStringWithMaxLength(request.body?.errorCode, 'errorCode', 100) ?? null;
      const machineId = optionalPathSafeDocumentId(request.body?.machineId, 'machineId');
      const machineNumber = optionalStringWithMaxLength(request.body?.machineNumber, 'machineNumber', 100);
      if (!symptoms && !errorCode) {
        throw new Error('Enter symptoms or an error code before using Repair Assist.');
      }
      await assertOrganizationMember(organizationId, caller.uid);

      ensureFirebaseAdmin();
      const db = getFirestore();
      const machine = await resolveMachineContext({
        db,
        organizationId,
        machineId,
        machineNumber,
        machineModel: requestedMachineModel,
        symptoms,
        errorCode,
      });
      const machineModel = machine?.model ?? requestedMachineModel;
      if (!isSpecificMachineModel(machineModel)) {
        throw new Error('Machine make and model number are required before Repair Assist can select the correct manufacturer manual.');
      }
      const manualDoc = await findIndexedManualForModel({
        db,
        organizationId,
        machineModel,
        machine,
      });

      if (!manualDoc) {
        throw new Error('No indexed manual matches this machine model number. Upload and index the manufacturer repair manual using the exact model number first.');
      }

      const manualData = manualDoc.data();
      const chunks = await readManualChunks({
        manualRef: manualDoc.ref,
        manualData,
      });
      if (chunks.length === 0) {
        throw new Error('Manual is indexed but has no readable stored chunks.');
      }

      const codeAliases = errorCodeAliases(errorCode, symptoms);
      const indexedCodeChunkIds = await readManualErrorCodeChunkIds({
        manualRef: manualDoc.ref,
        manualData,
        codeAliases,
      });
      const indexedCodeChunkIdSet = new Set(indexedCodeChunkIds);
      const terms = queryTerms(`${machineModel} ${symptoms} ${errorCode ?? ''} ${codeAliases.join(' ')}`);
      const ranked = chunks
        .map((chunk) => ({
          ...chunk,
          hasIndexedCode: indexedCodeChunkIdSet.has(chunk.chunkId),
          hasCodeAlias: chunkHasCodeAlias(chunk.text, codeAliases),
          score: scoreChunk(chunk.text, terms, codeAliases) + (indexedCodeChunkIdSet.has(chunk.chunkId) ? 40 : 0),
        }))
        .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));

      const scoredChunks = ranked.filter((chunk) => chunk.score > 0);
      const codeMatchedChunks = codeAliases.length > 0
        ? ranked.filter((chunk) => chunk.hasCodeAlias || chunk.hasIndexedCode)
        : [];
      if (codeAliases.length > 0 && codeMatchedChunks.length === 0) {
        throw new Error('The selected manual does not contain that error code. Confirm the manual is the correct manufacturer repair manual, then try again.');
      }
      const candidateChunks = codeAliases.length > 0 ? codeMatchedChunks : scoredChunks;
      const topChunks = (candidateChunks.length > 0
        ? candidateChunks.slice(0, MAX_REPAIR_ASSIST_CHUNKS)
        : ranked.slice(0, MAX_REPAIR_ASSIST_CHUNKS))
        .map(({ chunkId, text }) => ({ chunkId, text }));

      if (topChunks.length === 0) {
        throw new Error('The selected manual does not contain enough source text for this repair request.');
      }

      const answer = await buildGroundedManualAnswer({
        machineModel,
        symptoms,
        errorCode,
        topChunks,
      });

      addRateLimitHeaders(response);
      response.status(200).json({
        ok: true,
        grounded: true,
        model: getEnv('OPENAI_MANUAL_MODEL', DEFAULT_MANUAL_MODEL),
        sourceMode: 'manual-source-of-truth',
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
      const message = clientSafeErrorMessage(error, 'Could not generate repair guidance.');
      writeError(response, httpStatusForError(error, 400), 'repair_assist_failed', message);
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
        let subscription: Stripe.Subscription | undefined;

        if (event.type === 'checkout.session.completed') {
          const checkoutSession = payloadObject as Stripe.Checkout.Session;
          organizationId = stripeWebhookOrganizationId(checkoutSession.metadata?.organizationId);
          const subscriptionId = stripeResourceId(checkoutSession.subscription);
          if (subscriptionId) {
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
            organizationId ??= stripeWebhookOrganizationId(subscription.metadata?.organizationId);
          }
        } else {
          subscription = payloadObject as Stripe.Subscription;
          organizationId = stripeWebhookOrganizationId(subscription.metadata?.organizationId);
        }

        if (organizationId && subscription) {
          const result = await applyStripeBillingEvent(
            db,
            buildStripeBillingEventState({
              eventId: event.id,
              eventCreated: event.created,
              eventType: event.type as StripeBillingEventType,
              organizationId,
              subscription: stripeSubscriptionSnapshot(subscription),
            }),
          );
          if (result === 'missing-organization') {
            console.warn('Stripe webhook skipped an unknown organization.', { eventType: event.type });
          }
        }
      }

      response.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook handling failed.', {
        name: error instanceof Error ? error.name : 'UnknownError',
        code: typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : undefined,
      });
      response.status(400).send('Webhook handling failed.');
    }
  },
);
