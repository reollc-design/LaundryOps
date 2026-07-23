import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  buildOcrPageBatches,
  collectManualOcrShards,
  extractManualOcrText,
  manualPdfPageCount,
  normalizeOcrText,
  splitManualPdfForBatchOcr,
  startManualOcrBatch,
} from './src/manual-ocr.ts';
import { buildManualErrorCodeIndex, chunkManualText } from './src/manual-indexing.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test('splits a 26-page scanned manual into safe OCR requests', () => {
  assert.deepEqual(buildOcrPageBatches(26), [
    Array.from({ length: 15 }, (_, index) => index + 1),
    Array.from({ length: 11 }, (_, index) => index + 16),
  ]);
});

test('fails clearly rather than indexing only the first page when page count is unavailable', () => {
  assert.throws(() => buildOcrPageBatches(null), /Unable to determine the PDF page count/);
  assert.throws(() => buildOcrPageBatches(0), /Unable to determine the PDF page count/);
});

test('keeps every page when a large manual needs more than one OCR group', () => {
  const batches = buildOcrPageBatches(501);
  assert.equal(batches.length, 34);
  assert.deepEqual(batches[0], Array.from({ length: 15 }, (_, index) => index + 1));
  assert.deepEqual(batches.at(-1), [496, 497, 498, 499, 500, 501]);
});

test('splits an oversized batch PDF into ordered bounded documents', async () => {
  const source = await PDFDocument.create();
  source.addPage();
  source.addPage();
  source.addPage();
  const parts = await splitManualPdfForBatchOcr({
    pdfBytes: Buffer.from(await source.save()),
    maxPagesPerDocument: 2,
  });

  assert.equal(parts.length, 2);
  assert.equal(await manualPdfPageCount(Buffer.from(await source.save())), 3);
  assert.equal((await PDFDocument.load(parts[0])).getPageCount(), 2);
  assert.equal((await PDFDocument.load(parts[1])).getPageCount(), 1);
});

test('keeps only readable OCR text', () => {
  assert.equal(normalizeOcrText('  E DR door release  '), 'E DR door release');
  assert.equal(normalizeOcrText(undefined), '');
});

test('extracts all requested OCR page groups without exposing document bytes', async () => {
  const requests = [];
  const client = {
    processorPath: (projectId, location, processorId) => `${projectId}/${location}/${processorId}`,
    processDocument: async (request) => {
      requests.push(request);
      return [{ document: { text: request.processOptions.individualPageSelector.pages.join(',') } }];
    },
  };

  const result = await extractManualOcrText({
    client,
    config: { projectId: 'project', location: 'us', processorId: 'processor' },
    pdfBytes: Buffer.from('not-a-real-pdf'),
    pageCount: 26,
  });

  assert.equal(result.text, '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15\n\n16,17,18,19,20,21,22,23,24,25,26');
  assert.equal(result.processedPageCount, 26);
  assert.equal(result.requestCount, 2);
  assert.equal(requests.every((request) => request.fieldMask === 'text,pages.pageNumber'), true);
  assert.equal(requests.every((request) => request.rawDocument.mimeType === 'application/pdf'), true);
});

test('keeps OCR concurrency bounded while preserving every page group', async () => {
  let activeRequests = 0;
  let peakRequests = 0;
  const client = {
    processorPath: () => 'processor',
    processDocument: async (request) => {
      activeRequests += 1;
      peakRequests = Math.max(peakRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeRequests -= 1;
      return [{ document: { text: request.processOptions.individualPageSelector.pages.join(',') } }];
    },
  };

  const result = await extractManualOcrText({
    client,
    config: { projectId: 'project', location: 'us', processorId: 'processor' },
    pdfBytes: Buffer.from('not-a-real-pdf'),
    pageCount: 46,
  });

  assert.equal(result.processedPageCount, 46);
  assert.equal(result.requestCount, 4);
  assert.equal(peakRequests <= 2, true);
});

test('makes an OCR-extracted E DR table searchable by the manual error-code index', async () => {
  const client = {
    processorPath: () => 'processor',
    processDocument: async () => [{
      document: { text: 'ERROR CODES\nE DR - Door release fault\nInspect lock wiring.' },
    }],
  };
  const result = await extractManualOcrText({
    client,
    config: { projectId: 'project', location: 'us', processorId: 'processor' },
    pdfBytes: Buffer.from('not-a-real-pdf'),
    pageCount: 1,
  });
  const entries = buildManualErrorCodeIndex(
    chunkManualText(result.text).map((text, index) => ({ chunkId: `chunk-${index + 1}`, text })),
  );

  assert.equal(entries.some((entry) => entry.normalizedCode === 'edr'), true);
});

test('starts one storage-backed batch job for a large manual', async () => {
  const requests = [];
  const client = {
    processorPath: () => 'processor',
    processDocument: async () => [{ document: {} }],
    batchProcessDocuments: async (request) => {
      requests.push(request);
      return [{ name: 'operations/manual-ocr' }];
    },
    checkBatchProcessDocumentsProgress: async () => ({}),
  };
  const result = await startManualOcrBatch({
    client,
    config: { projectId: 'project', location: 'us', processorId: 'processor' },
    sourceGcsUri: 'gs://bucket/manual.pdf',
    outputPrefix: 'gs://bucket/internal/manual-ocr/job/',
  });

  assert.equal(result.operationName, 'operations/manual-ocr');
  assert.equal(requests[0].inputDocuments.gcsDocuments.documents[0].gcsUri, 'gs://bucket/manual.pdf');
  assert.equal(requests[0].documentOutputConfig.gcsOutputConfig.fieldMask, 'text,shardInfo');
});

test('waits until all OCR output shards are present, then joins them in order', () => {
  const incomplete = collectManualOcrShards([
    { text: 'second', shardInfo: { shardIndex: 1, shardCount: 2 } },
  ]);
  assert.equal(incomplete.ready, false);

  const complete = collectManualOcrShards([
    { text: 'second', shardInfo: { shardIndex: 1, shardCount: 2 } },
    { text: 'first', shardInfo: { shardIndex: 0, shardCount: 2 } },
  ]);
  assert.equal(complete.ready, true);
  assert.equal(complete.text, 'first\n\nsecond');
});

test('allows a blank OCR page shard without treating the rest of the manual as incomplete', () => {
  const result = collectManualOcrShards([
    { text: 'E DR - door release', shardInfo: { shardIndex: 0, shardCount: 2 } },
    { text: '', shardInfo: { shardIndex: 1, shardCount: 2 } },
  ]);

  assert.equal(result.ready, true);
  assert.equal(result.text, 'E DR - door release');
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`${passed}/${tests.length} manual OCR tests passed`);
