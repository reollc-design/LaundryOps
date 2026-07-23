import { getStorage } from 'firebase-admin/storage';
import { FieldValue, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import {
  collectManualOcrShards,
  createDocumentAiOcrClient,
  startManualOcrBatch,
} from './manual-ocr.js';
import { safeExternalErrorDetails } from './repair-assist.js';
import { manualOcrBatchOperationState, nextManualOcrOutputWaitAttempt, storedManualOcrBatchJobs } from './manual-ocr-worker-state.js';

const MAX_OCR_OUTPUT_WAIT_ATTEMPTS = 5;
const MAX_OCR_WORKER_FAILURE_ATTEMPTS = 3;
const MAX_OCR_PROCESSING_AGE_MS = 2 * 60 * 60 * 1000;

interface ManualOcrStorageFile {
  name: string;
  download(): Promise<[Buffer]>;
  delete(): Promise<unknown>;
}

interface ManualOcrStorageBucket {
  getFiles(options: { prefix: string }): Promise<[ManualOcrStorageFile[]]>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function organizationIdFromManualSnapshot(manualSnap: DocumentSnapshot): string | null {
  return manualSnap.ref.parent.parent?.id ?? null;
}

function timestampMs(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return null;
}

async function filesAtPrefix(bucket: ManualOcrStorageBucket, prefix: string): Promise<ManualOcrStorageFile[]> {
  const [files] = await bucket.getFiles({ prefix });
  return files;
}

async function deletePrefixArtifacts(bucket: ManualOcrStorageBucket, prefixes: string[]): Promise<string[]> {
  const failures: string[] = [];
  for (const prefix of prefixes) {
    try {
      const files = await filesAtPrefix(bucket, prefix);
      await Promise.all(files.map((file) => file.delete()));
    } catch {
      failures.push(prefix);
    }
  }
  return failures;
}

async function markBatchOcrFailure(params: {
  manualSnap: DocumentSnapshot;
  message: string;
  cleanupPrefixes?: string[];
}): Promise<void> {
  const manualData = params.manualSnap.data() ?? {};
  const cleanupPrefixes = params.cleanupPrefixes ?? [];
  await params.manualSnap.ref.set({
    status: manualData.status === 'indexed' ? 'indexed' : 'missing',
    indexingStatus: 'failed',
    ocrStatus: 'failed',
    indexError: params.message,
    ocrError: params.message,
    indexingFailedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'manual-ocr-worker',
    ocrOutputWaitAttempts: FieldValue.delete(),
    ocrWorkerFailureAttempts: FieldValue.delete(),
    ...(cleanupPrefixes.length > 0
      ? { ocrCleanupPending: true, ocrCleanupPrefixes: cleanupPrefixes }
      : {
        ocrCleanupPending: FieldValue.delete(),
        ocrCleanupPrefixes: FieldValue.delete(),
        ocrJobId: FieldValue.delete(),
        ocrBatchJobs: FieldValue.delete(),
        ocrOperationName: FieldValue.delete(),
        ocrOutputPrefix: FieldValue.delete(),
        ocrInputPrefix: FieldValue.delete(),
      }),
  }, { merge: true });
}

function artifactPrefixes(jobs: Array<{ outputPrefix: string }>, inputPrefix: string | null): string[] {
  return [...jobs.map((job) => job.outputPrefix), ...(inputPrefix ? [inputPrefix] : [])];
}

async function claimQueuedBatchStart(params: {
  db: Firestore;
  manualSnap: DocumentSnapshot;
  partIndex: number;
}): Promise<boolean> {
  return params.db.runTransaction(async (transaction) => {
    const current = await transaction.get(params.manualSnap.ref);
    const data = current.data() ?? {};
    if (data.ocrStatus !== 'batch_queued') return false;
    transaction.set(params.manualSnap.ref, {
      ocrStatus: 'batch_starting',
      ocrStartingPartIndex: params.partIndex,
      ocrBatchStartClaimedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

export async function completePendingManualOcrJobs(params: {
  db: Firestore;
  createClient: (location: string) => ReturnType<typeof createDocumentAiOcrClient>;
  projectId: string;
  location: string;
  processorId: string;
  bucket?: ManualOcrStorageBucket;
  finalize: (input: { organizationId: string; manualId: string; text: string; pageCount: number | null; requestCount: number }) => Promise<void>;
}): Promise<void> {
  const bucket = params.bucket ?? getStorage().bucket() as unknown as ManualOcrStorageBucket;

  const pendingCleanup = await params.db.collectionGroup('manuals').where('ocrCleanupPending', '==', true).limit(10).get();
  for (const manualSnap of pendingCleanup.docs) {
    const cleanupValues: unknown[] = Array.isArray(manualSnap.data().ocrCleanupPrefixes)
      ? manualSnap.data().ocrCleanupPrefixes as unknown[]
      : [];
    const prefixes = cleanupValues.length > 0
      ? cleanupValues.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];
    const failures = await deletePrefixArtifacts(bucket, prefixes);
    if (failures.length === 0) {
      await manualSnap.ref.set({
        ocrCleanupPending: FieldValue.delete(), ocrCleanupPrefixes: FieldValue.delete(), ocrJobId: FieldValue.delete(),
        ocrBatchJobs: FieldValue.delete(), ocrOperationName: FieldValue.delete(), ocrOutputPrefix: FieldValue.delete(), ocrInputPrefix: FieldValue.delete(),
      }, { merge: true });
    }
  }

  // A single scheduler worker owns one Document AI batch at a time. This stays safely below the
  // provider's five-concurrent-batch project limit while still processing every queued PDF part.
  const starting = await params.db.collectionGroup('manuals').where('ocrStatus', '==', 'batch_starting').limit(1).get();
  if (starting.docs.length > 0) {
    const manualSnap = starting.docs[0];
    const manualData = manualSnap.data();
    const claimedAt = timestampMs(manualData.ocrBatchStartClaimedAt);
    if (claimedAt !== null && Date.now() - claimedAt > MAX_OCR_PROCESSING_AGE_MS) {
      const jobs = storedManualOcrBatchJobs(manualData.ocrBatchJobs, { operationName: null, outputPrefix: null });
      const failures = await deletePrefixArtifacts(bucket, artifactPrefixes(jobs, asString(manualData.ocrInputPrefix)));
      await markBatchOcrFailure({
        manualSnap,
        message: 'Document OCR start could not be confirmed.',
        cleanupPrefixes: failures,
      });
    }
    return;
  }
  const active = await params.db.collectionGroup('manuals').where('ocrStatus', '==', 'batch_processing').limit(1).get();
  if (active.docs.length === 0) {
    const queued = await params.db.collectionGroup('manuals').where('ocrStatus', '==', 'batch_queued').limit(1).get();
    const manualSnap = queued.docs[0];
    if (!manualSnap) return;
    const manualData = manualSnap.data();
    const jobs = storedManualOcrBatchJobs(manualData.ocrBatchJobs, { operationName: null, outputPrefix: null });
    const nextJob = jobs.find((job) => !job.completed && !job.operationName && job.sourceGcsUri);
    const sourceGcsUri = nextJob?.sourceGcsUri;
    if (!nextJob || !sourceGcsUri) {
      await markBatchOcrFailure({ manualSnap, message: 'Document OCR job configuration is incomplete.' });
      return;
    }
    if (!await claimQueuedBatchStart({ db: params.db, manualSnap, partIndex: nextJob.partIndex })) {
      return;
    }
    let batchStarted = false;
    try {
      const result = await startManualOcrBatch({
        client: params.createClient(params.location),
        config: { projectId: params.projectId, location: params.location, processorId: params.processorId },
        sourceGcsUri,
        outputPrefix: nextJob.outputPrefix,
      });
      batchStarted = true;
      const updatedJobs = jobs.map((job) => job.partIndex === nextJob.partIndex
        ? { ...job, operationName: result.operationName }
        : job);
      await manualSnap.ref.set({
        ocrStatus: 'batch_processing',
        ocrBatchJobs: updatedJobs,
        ocrCurrentPartIndex: nextJob.partIndex,
        ocrCurrentJobStartedAt: FieldValue.serverTimestamp(),
        ocrStartingPartIndex: FieldValue.delete(),
        ocrBatchStartClaimedAt: FieldValue.delete(),
        ocrWorkerFailureAttempts: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      logger.error('manual_ocr_batch_start_failed', { manualId: manualSnap.id, ...safeExternalErrorDetails(error) });
      // Once the provider accepted a job, never retry it blindly. The recorded starting claim
      // blocks duplicate billable work until the worker resolves the ambiguous start safely.
      if (batchStarted) return;
      const attempt = nextManualOcrOutputWaitAttempt(manualData.ocrWorkerFailureAttempts);
      if (attempt >= MAX_OCR_WORKER_FAILURE_ATTEMPTS) {
        await markBatchOcrFailure({ manualSnap, message: 'Document OCR could not be started.' });
      } else {
        await manualSnap.ref.set({
          ocrStatus: 'batch_queued',
          ocrStartingPartIndex: FieldValue.delete(),
          ocrBatchStartClaimedAt: FieldValue.delete(),
          ocrWorkerFailureAttempts: attempt,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
    return;
  }

  const manualSnap = active.docs[0];
  const manualData = manualSnap.data();
  const organizationId = organizationIdFromManualSnapshot(manualSnap);
  const jobs = storedManualOcrBatchJobs(manualData.ocrBatchJobs, {
    operationName: asString(manualData.ocrOperationName), outputPrefix: asString(manualData.ocrOutputPrefix),
  });
  const inputPrefix = asString(manualData.ocrInputPrefix);
  const currentPartIndex = typeof manualData.ocrCurrentPartIndex === 'number' ? manualData.ocrCurrentPartIndex : 0;
  const currentJob = jobs.find((job) => job.partIndex === currentPartIndex && job.operationName && !job.completed);
  if (!organizationId || !currentJob || !currentJob.operationName) {
    await markBatchOcrFailure({ manualSnap, message: 'Document OCR job configuration is incomplete.' });
    return;
  }
  const prefixes = artifactPrefixes(jobs, inputPrefix);

  try {
    const operation = await params.createClient(params.location).checkBatchProcessDocumentsProgress(currentJob.operationName);
    const state = manualOcrBatchOperationState(operation);
    if (!state.done) {
      const startedAt = timestampMs(manualData.ocrCurrentJobStartedAt) ?? timestampMs(manualData.ocrStartedAt);
      if (startedAt !== null && Date.now() - startedAt > MAX_OCR_PROCESSING_AGE_MS) {
        const failures = await deletePrefixArtifacts(bucket, prefixes);
        await markBatchOcrFailure({ manualSnap, message: 'Document OCR timed out before completion.', cleanupPrefixes: failures });
      }
      return;
    }
    if (state.failed) {
      const failures = await deletePrefixArtifacts(bucket, prefixes);
      await markBatchOcrFailure({ manualSnap, message: 'Document OCR could not read this manual.', cleanupPrefixes: failures });
      return;
    }

    const outputFiles = (await filesAtPrefix(bucket, currentJob.outputPrefix)).filter((file) => file.name.toLowerCase().endsWith('.json'));
    const output = collectManualOcrShards(await Promise.all(outputFiles.map(async (file) => JSON.parse((await file.download())[0].toString('utf8')) as unknown)));
    if (!output.ready || !output.text) {
      const attempt = nextManualOcrOutputWaitAttempt(manualData.ocrOutputWaitAttempts);
      if (attempt >= MAX_OCR_OUTPUT_WAIT_ATTEMPTS) {
        const failures = await deletePrefixArtifacts(bucket, prefixes);
        await markBatchOcrFailure({ manualSnap, message: 'Document OCR output was incomplete.', cleanupPrefixes: failures });
      } else {
        await manualSnap.ref.set({ ocrOutputWaitAttempts: attempt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      return;
    }

    const updatedJobs = jobs.map((job) => job.partIndex === currentJob.partIndex ? { ...job, completed: true } : job);
    if (updatedJobs.some((job) => !job.completed)) {
      await manualSnap.ref.set({
        ocrStatus: 'batch_queued', ocrBatchJobs: updatedJobs, ocrCurrentPartIndex: FieldValue.delete(),
        ocrCurrentJobStartedAt: FieldValue.delete(), ocrOutputWaitAttempts: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const allText = await Promise.all(updatedJobs.map(async (job) => {
      const files = (await filesAtPrefix(bucket, job.outputPrefix)).filter((file) => file.name.toLowerCase().endsWith('.json'));
      return collectManualOcrShards(await Promise.all(files.map(async (file) => JSON.parse((await file.download())[0].toString('utf8')) as unknown))).text;
    }));
    if (allText.some((text) => !text)) throw new Error('Document OCR output was incomplete.');
    await params.finalize({ organizationId, manualId: manualSnap.id, text: allText.join('\n\n').trim(), pageCount: typeof manualData.ocrPageCount === 'number' ? manualData.ocrPageCount : null, requestCount: updatedJobs.length });
    const failures = await deletePrefixArtifacts(bucket, prefixes);
    if (failures.length > 0) await manualSnap.ref.set({ ocrCleanupPending: true, ocrCleanupPrefixes: failures }, { merge: true });
  } catch (error) {
    logger.error('manual_ocr_worker_failed', { organizationId, manualId: manualSnap.id, ...safeExternalErrorDetails(error) });
    const attempt = nextManualOcrOutputWaitAttempt(manualData.ocrWorkerFailureAttempts);
    if (attempt < MAX_OCR_WORKER_FAILURE_ATTEMPTS) {
      await manualSnap.ref.set({ ocrWorkerFailureAttempts: attempt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    const failures = await deletePrefixArtifacts(bucket, prefixes);
    await markBatchOcrFailure({ manualSnap, message: 'Document OCR could not be completed. Please upload the manual again.', cleanupPrefixes: failures });
  }
}
