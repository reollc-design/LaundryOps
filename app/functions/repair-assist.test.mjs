import assert from 'node:assert/strict';
import {
  buildRepairAssistInputContent,
  buildManualFallbackAnswer,
  MAX_REPAIR_ASSIST_IMAGE_BYTES,
  OPENAI_REPAIR_ASSIST_TIMEOUT_MS,
  parseRepairAssistImages,
  resolveRepairAssistAnswer,
  safeExternalErrorDetails,
} from './src/repair-assist.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webpBytes = Buffer.from('RIFF0000WEBPVP8 ', 'ascii');

function imageDataUrl(contentType, bytes) {
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

test('uses a completed OpenAI answer when one is returned', async () => {
  const result = await resolveRepairAssistAnswer({
    requestAnswer: async () => '  Manual-grounded answer  ',
    fallbackAnswer: 'Manual excerpt',
  });

  assert.deepEqual(result, {
    answer: 'Manual-grounded answer',
    mode: 'openai',
  });
});

test('returns the manual fallback when OpenAI times out', async () => {
  const timeoutError = Object.assign(new Error('request exceeded deadline'), {
    name: 'APIConnectionTimeoutError',
    code: 'ETIMEDOUT',
  });
  const result = await resolveRepairAssistAnswer({
    requestAnswer: async () => {
      throw timeoutError;
    },
    fallbackAnswer: 'Manual excerpt',
  });

  assert.equal(result.answer, 'Manual excerpt');
  assert.equal(result.mode, 'manual-fallback');
  assert.equal(result.fallbackReason, 'request_failed');
  assert.deepEqual(result.error, {
    errorName: 'APIConnectionTimeoutError',
    errorCode: 'ETIMEDOUT',
    timeout: true,
  });
});

test('manual fallback centers the excerpt on the matching code and cites its chunk', () => {
  const prefix = 'General introduction. '.repeat(45);
  const answer = buildManualFallbackAnswer({
    machineModel: 'SCN30LCFXU3001',
    symptoms: 'e dr',
    errorCode: null,
    codeAliases: ['e dr', 'edr', 'e-dr', 'e:dr'],
    topChunks: [
      {
        chunkId: 'chunk-009',
        text: `${prefix}Error code E DR indicates a drain recovery fault. Disconnect power before opening service panels.`,
      },
    ],
  });

  assert.equal(answer.includes('[chunk-009]'), true);
  assert.equal(answer.includes('Error code E DR'), true);
  assert.equal(answer.includes('most relevant source passage'), true);
});

test('accepts bounded JPG, PNG, and WebP image data', () => {
  const images = parseRepairAssistImages([
    {
      contentType: 'image/jpeg',
      dataUrl: imageDataUrl('image/jpeg', jpegBytes),
    },
    {
      contentType: 'image/png',
      dataUrl: imageDataUrl('image/png', pngBytes),
    },
    {
      contentType: 'image/webp',
      dataUrl: imageDataUrl('image/webp', webpBytes),
    },
  ]);

  assert.equal(images.length, 3);
  assert.deepEqual(images.map((image) => image.contentType), ['image/jpeg', 'image/png', 'image/webp']);
  assert.equal(images.every((image) => image.byteLength > 0), true);
});

test('rejects malformed, unsupported, oversized, and excessive image payloads', () => {
  assert.throws(
    () => parseRepairAssistImages([{ contentType: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }]),
    /valid JPG, PNG, or WebP/,
  );
  assert.throws(
    () => parseRepairAssistImages([{ contentType: 'image/jpeg', dataUrl: 'data:image/png;base64,YQ==' }]),
    /valid JPG, PNG, or WebP/,
  );
  assert.throws(
    () => parseRepairAssistImages(Array.from({ length: 4 }, () => ({
      contentType: 'image/jpeg',
      dataUrl: imageDataUrl('image/jpeg', jpegBytes),
    }))),
    /up to 3 photos/,
  );
  const oversizedBytes = Buffer.alloc(MAX_REPAIR_ASSIST_IMAGE_BYTES + 1);
  jpegBytes.copy(oversizedBytes);
  assert.throws(
    () => parseRepairAssistImages([{ contentType: 'image/jpeg', dataUrl: imageDataUrl('image/jpeg', oversizedBytes) }]),
    /5 MB or smaller/,
  );
  assert.throws(
    () => parseRepairAssistImages([{
      contentType: 'image/jpeg',
      dataUrl: imageDataUrl('image/jpeg', Buffer.from('not-an-image')),
    }]),
    /does not match its JPG, PNG, or WebP file type/,
  );
});

test('builds one text block followed by high-detail image blocks', () => {
  const images = parseRepairAssistImages([
    {
      contentType: 'image/jpeg',
      dataUrl: imageDataUrl('image/jpeg', jpegBytes),
    },
  ]);
  const content = buildRepairAssistInputContent('Manual-backed prompt', images);

  assert.deepEqual(content, [
    {
      type: 'input_text',
      text: 'Manual-backed prompt',
    },
    {
      type: 'input_image',
      image_url: imageDataUrl('image/jpeg', jpegBytes),
      detail: 'high',
    },
  ]);
});

test('manual fallback states that attached photos were not analyzed', () => {
  const answer = buildManualFallbackAnswer({
    machineModel: 'SCN30LCFXU3001',
    symptoms: 'door will not unlock',
    errorCode: 'E DL',
    codeAliases: ['e dl'],
    imageCount: 2,
    topChunks: [{
      chunkId: 'chunk-004',
      text: 'E DL indicates a door lock error.',
    }],
  });

  assert.equal(answer.includes('Photo analysis was unavailable'), true);
  assert.equal(answer.includes('uploaded manual only'), true);
});

test('returns the manual fallback when OpenAI returns empty output', async () => {
  const result = await resolveRepairAssistAnswer({
    requestAnswer: async () => '   ',
    fallbackAnswer: 'Manual excerpt',
  });

  assert.deepEqual(result, {
    answer: 'Manual excerpt',
    mode: 'manual-fallback',
    fallbackReason: 'empty_response',
  });
});

test('safe error details never include an error message or unsafe code text', () => {
  const details = safeExternalErrorDetails(Object.assign(
    new Error('secret-bearing upstream message'),
    {
      name: 'APIError',
      code: 'unsafe code with spaces',
      status: 503,
    },
  ));

  assert.deepEqual(details, {
    errorName: 'APIError',
    httpStatus: 503,
    timeout: false,
  });
  assert.equal('message' in details, false);
});

test('OpenAI timeout stays below the Function timeout budget', () => {
  assert.equal(OPENAI_REPAIR_ASSIST_TIMEOUT_MS, 45_000);
  assert.equal(OPENAI_REPAIR_ASSIST_TIMEOUT_MS < 120_000, true);
});

let failures = 0;
for (const currentTest of tests) {
  try {
    await currentTest.run();
    console.log(`PASS ${currentTest.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${currentTest.name}`);
    console.error(error);
  }
}

console.log(`${tests.length - failures}/${tests.length} Repair Assist tests passed`);
process.exitCode = failures === 0 ? 0 : 1;
