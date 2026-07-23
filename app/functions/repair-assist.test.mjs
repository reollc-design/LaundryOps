import assert from 'node:assert/strict';
import {
  buildManualFallbackAnswer,
  OPENAI_REPAIR_ASSIST_TIMEOUT_MS,
  resolveRepairAssistAnswer,
  safeExternalErrorDetails,
} from './src/repair-assist.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
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
