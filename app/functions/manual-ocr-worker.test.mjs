import assert from 'node:assert/strict';
import { completePendingManualOcrJobs } from './lib/manual-ocr-worker.js';
import {
  documentAiBatchStartFailureCategory,
  manualOcrBatchOperationState,
  nextManualOcrOutputWaitAttempt,
  storedManualOcrBatchJobs,
} from './src/manual-ocr-worker-state.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test('leaves an unfinished batch job alone for a later scheduled check', () => {
  assert.deepEqual(manualOcrBatchOperationState({ latestResponse: { done: false } }), {
    done: false,
    failed: false,
  });
});

test('recognizes a completed successful batch job', () => {
  assert.deepEqual(manualOcrBatchOperationState({ latestResponse: { done: true } }), {
    done: true,
    failed: false,
  });
});

test('recognizes a completed failed batch job before it can activate a manual index', () => {
  assert.deepEqual(manualOcrBatchOperationState({ latestResponse: { done: true, error: { code: 13 } } }), {
    done: true,
    failed: true,
  });
});

test('orders stored batch jobs and accepts an old single-operation record during rollout', () => {
  assert.deepEqual(storedManualOcrBatchJobs([
    { partIndex: 1, operationName: 'second', outputPrefix: 'output/second/' },
    { partIndex: 0, operationName: 'first', outputPrefix: 'output/first/' },
  ], { operationName: null, outputPrefix: null }), [
    { partIndex: 0, operationName: 'first', outputPrefix: 'output/first/', completed: false },
    { partIndex: 1, operationName: 'second', outputPrefix: 'output/second/', completed: false },
  ]);
  assert.deepEqual(storedManualOcrBatchJobs(undefined, {
    operationName: 'legacy-operation',
    outputPrefix: 'legacy-output/',
  }), [{ partIndex: 0, operationName: 'legacy-operation', outputPrefix: 'legacy-output/', completed: false }]);
});

test('limits incomplete OCR output checks before resolving the manual as failed', () => {
  assert.equal(nextManualOcrOutputWaitAttempt(undefined), 1);
  assert.equal(nextManualOcrOutputWaitAttempt(4), 5);
});

function makePendingManual(data) {
  const writes = [];
  const ref = {
    parent: { parent: { id: 'org-1' } },
    set: async (value) => { writes.push(value); },
  };
  return {
    id: 'manual-1',
    ref,
    data: () => data,
    writes,
  };
}

function fakeDb(manualSnap) {
  return {
    collectionGroup: () => ({
      where: (field, _operator, expected) => ({
        limit: () => ({
          get: async () => ({
            docs: manualSnap.data()[field] === expected ? [manualSnap] : [],
          }),
        }),
      }),
    }),
    runTransaction: async (callback) => callback({
      get: async () => manualSnap,
      set: (_ref, value) => {
        Object.assign(manualSnap.data(), value);
        manualSnap.writes.push(value);
      },
    }),
  };
}

test('scheduled worker activates an OCR result only after its batch is complete', async () => {
  const manualSnap = makePendingManual({
    ocrStatus: 'batch_processing',
    ocrBatchJobs: [{ partIndex: 0, operationName: 'operation-1', outputPrefix: 'output/' }],
    ocrPageCount: 42,
  });
  let deleted = false;
  let finalized = null;
  const outputFile = {
    name: 'output/result.json',
    download: async () => [Buffer.from(JSON.stringify({ text: 'E DR - door release' }))],
    delete: async () => { deleted = true; },
  };

  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({
      checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: true } }),
    }),
    projectId: 'project',
    location: 'us',
    processorId: 'processor',
    bucket: { getFiles: async () => [[outputFile]] },
    finalize: async (value) => { finalized = value; },
  });

  assert.deepEqual(finalized, {
    organizationId: 'org-1',
    manualId: 'manual-1',
    text: 'E DR - door release',
    pageCount: 42,
    requestCount: 1,
  });
  assert.equal(deleted, true);
  assert.equal(manualSnap.writes.length, 0);
});

test('scheduled worker preserves the previous index and marks a failed batch as failed', async () => {
  const manualSnap = makePendingManual({
    status: 'indexed',
    ocrStatus: 'batch_processing',
    ocrBatchJobs: [{ partIndex: 0, operationName: 'operation-1', outputPrefix: 'output/' }],
  });
  let finalized = false;

  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({
      checkBatchProcessDocumentsProgress: async () => ({
        latestResponse: { done: true, error: { code: 13 } },
      }),
    }),
    projectId: 'project',
    location: 'us',
    processorId: 'processor',
    bucket: { getFiles: async () => [[]] },
    finalize: async () => { finalized = true; },
  });

  assert.equal(finalized, false);
  assert.equal(manualSnap.writes[0].status, 'indexed');
  assert.equal(manualSnap.writes[0].ocrStatus, 'failed');
});

test('scheduled worker combines completed split-manual jobs in original part order', async () => {
  const manualSnap = makePendingManual({
    ocrStatus: 'batch_processing',
    ocrBatchJobs: [
      { partIndex: 1, operationName: 'operation-2', outputPrefix: 'output/part-2/' },
      { partIndex: 0, operationName: 'operation-1', outputPrefix: 'output/part-1/', completed: true },
    ],
    ocrPageCount: 501,
    ocrCurrentPartIndex: 1,
  });
  let finalized = null;
  const makeFile = (name, text) => ({
    name,
    download: async () => [Buffer.from(JSON.stringify({ text }))],
    delete: async () => {},
  });
  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({
      checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: true } }),
    }),
    projectId: 'project',
    location: 'us',
    processorId: 'processor',
    bucket: {
      getFiles: async ({ prefix }) => [[
        prefix.includes('part-1')
          ? makeFile('output/part-1/result.json', 'first 500 pages')
          : makeFile('output/part-2/result.json', 'final page'),
      ]],
    },
    finalize: async (value) => { finalized = value; },
  });

  assert.equal(finalized.text, 'first 500 pages\n\nfinal page');
  assert.equal(finalized.pageCount, 501);
  assert.equal(finalized.requestCount, 2);
});

test('scheduled worker retries a transient failure before marking a manual failed', async () => {
  const manualSnap = makePendingManual({
    ocrStatus: 'batch_processing',
    ocrBatchJobs: [{ partIndex: 0, operationName: 'operation-1', outputPrefix: 'output/' }],
  });
  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({
      checkBatchProcessDocumentsProgress: async () => { throw new Error('temporary network failure'); },
    }),
    projectId: 'project',
    location: 'us',
    processorId: 'processor',
    bucket: { getFiles: async () => [[]] },
    finalize: async () => { throw new Error('should not finalize'); },
  });

  assert.equal(manualSnap.writes.length, 1);
  assert.equal(manualSnap.writes[0].ocrWorkerFailureAttempts, 1);
  assert.equal(manualSnap.writes[0].ocrStatus, undefined);
});

test('scheduler starts only one queued Document AI batch and leaves later PDF parts queued', async () => {
  const manualSnap = makePendingManual({
    ocrStatus: 'batch_queued',
    ocrBatchJobs: [
      { partIndex: 0, sourceGcsUri: 'gs://bucket/input/part-1.pdf', outputPrefix: 'output/part-1/' },
      { partIndex: 1, sourceGcsUri: 'gs://bucket/input/part-2.pdf', outputPrefix: 'output/part-2/' },
    ],
  });
  let batchStarts = 0;
  let batchOutputUri = null;
  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({
      processorPath: () => 'processor',
      batchProcessDocuments: async (request) => {
        batchStarts += 1;
        batchOutputUri = request.documentOutputConfig.gcsOutputConfig.gcsUri;
        return [{ name: 'operations/one' }];
      },
      checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: false } }),
    }),
    projectId: 'project',
    location: 'us',
    processorId: 'processor',
    bucket: { getFiles: async () => [[]] },
    finalize: async () => { throw new Error('should not finalize'); },
  });

  assert.equal(batchStarts, 1);
  assert.equal(batchOutputUri, 'gs://bucket/output/part-1/');
  const completionWrite = manualSnap.writes.at(-1);
  assert.equal(completionWrite.ocrStatus, 'batch_processing');
  assert.equal(completionWrite.ocrBatchJobs[0].outputPrefix, 'output/part-1/');
  assert.equal(completionWrite.ocrBatchJobs[0].operationName, 'operations/one');
  assert.equal(completionWrite.ocrBatchJobs[1].operationName, undefined);
});

test('classifies batch-start failures without logging provider messages or request data', () => {
  assert.equal(documentAiBatchStartFailureCategory(7), 'permission_denied');
  assert.equal(documentAiBatchStartFailureCategory(13), 'provider_internal_error');
  assert.equal(documentAiBatchStartFailureCategory('INVALID_ARGUMENT'), 'invalid_request');
});

test('scheduler does not double-prefix a legacy full batch output URI', async () => {
  const manualSnap = makePendingManual({
    ocrStatus: 'batch_queued',
    ocrBatchJobs: [{
      partIndex: 0,
      sourceGcsUri: 'gs://bucket/input.pdf',
      outputPrefix: 'gs://bucket/output/part-1/',
    }],
  });
  let batchOutputUri = null;
  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({
      processorPath: () => 'processor',
      batchProcessDocuments: async (request) => {
        batchOutputUri = request.documentOutputConfig.gcsOutputConfig.gcsUri;
        return [{ name: 'operations/one' }];
      },
      checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: false } }),
    }),
    projectId: 'project', location: 'us', processorId: 'processor',
    bucket: { getFiles: async () => [[]] },
    finalize: async () => { throw new Error('should not finalize'); },
  });

  assert.equal(batchOutputUri, 'gs://bucket/output/part-1/');
});

test('an uncertain batch start is claimed and never started a second time', async () => {
  const data = {
    ocrStatus: 'batch_queued',
    ocrBatchJobs: [{ partIndex: 0, sourceGcsUri: 'gs://bucket/input.pdf', outputPrefix: 'output/' }],
  };
  const manualSnap = makePendingManual(data);
  const originalSet = manualSnap.ref.set;
  manualSnap.ref.set = async (value) => {
    if (value.ocrStatus === 'batch_processing') throw new Error('Firestore write failed after batch start');
    return originalSet(value);
  };
  let batchStarts = 0;
  const params = {
    db: fakeDb(manualSnap),
    createClient: () => ({
      processorPath: () => 'processor',
      batchProcessDocuments: async () => {
        batchStarts += 1;
        return [{ name: 'operations/one' }];
      },
      checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: false } }),
    }),
    projectId: 'project', location: 'us', processorId: 'processor',
    bucket: { getFiles: async () => [[]] },
    finalize: async () => { throw new Error('should not finalize'); },
  };

  await completePendingManualOcrJobs(params);
  await completePendingManualOcrJobs(params);
  assert.equal(batchStarts, 1);
  assert.equal(data.ocrStatus, 'batch_starting');
});

test('scheduler fails an OCR operation that stays unfinished beyond the recovery window', async () => {
  const manualSnap = makePendingManual({
    status: 'indexed',
    ocrStatus: 'batch_processing',
    ocrCurrentPartIndex: 0,
    ocrCurrentJobStartedAt: { toMillis: () => Date.now() - (3 * 60 * 60 * 1000) },
    ocrBatchJobs: [{ partIndex: 0, operationName: 'operation-1', outputPrefix: 'output/' }],
  });
  await completePendingManualOcrJobs({
    db: fakeDb(manualSnap),
    createClient: () => ({ checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: false } }) }),
    projectId: 'project', location: 'us', processorId: 'processor',
    bucket: { getFiles: async () => [[]] },
    finalize: async () => { throw new Error('should not finalize'); },
  });

  assert.equal(manualSnap.writes[0].ocrStatus, 'failed');
  assert.equal(manualSnap.writes[0].status, 'indexed');
});

test('scheduler retries recorded temporary-file cleanup on its next run', async () => {
  const data = { ocrCleanupPending: true, ocrCleanupPrefixes: ['temporary/'] };
  const manualSnap = makePendingManual(data);
  let cleanupAttempt = 0;
  const file = {
    name: 'temporary/part.pdf',
    download: async () => [Buffer.alloc(0)],
    delete: async () => {
      cleanupAttempt += 1;
      if (cleanupAttempt === 1) throw new Error('temporary storage failure');
    },
  };
  const params = {
    db: fakeDb(manualSnap),
    createClient: () => ({ checkBatchProcessDocumentsProgress: async () => ({ latestResponse: { done: false } }) }),
    projectId: 'project', location: 'us', processorId: 'processor',
    bucket: { getFiles: async () => [[file]] },
    finalize: async () => { throw new Error('should not finalize'); },
  };

  await completePendingManualOcrJobs(params);
  assert.equal(manualSnap.writes.length, 0);
  await completePendingManualOcrJobs(params);
  assert.equal(typeof manualSnap.writes[0].ocrCleanupPending, 'object');
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`${passed}/${tests.length} manual OCR worker tests passed`);
