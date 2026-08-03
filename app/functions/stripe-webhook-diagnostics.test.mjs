import assert from 'node:assert/strict';
import {
  logStripeWebhookFailure,
  stripeWebhookFailureDetails,
} from './src/stripe-webhook-diagnostics.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test('reports only the processing stage and a safe error name', () => {
  const error = Object.assign(new Error('Signature payload must never be logged.'), {
    name: 'StripeSignatureVerificationError',
    code: 'signature_verification_failed',
  });

  assert.deepEqual(stripeWebhookFailureDetails('verify_signature', error), {
    stage: 'verify_signature',
    errorName: 'StripeSignatureVerificationError',
  });
});

test('never logs an error message, code, or secret-shaped value', () => {
  const error = Object.assign(new Error('whsec_secret_value_must_not_be_logged'), {
    name: 'sk_live_secret_value_must_not_be_logged',
    code: 'whsec_secret_value_must_not_be_logged',
  });

  let logged;
  logStripeWebhookFailure('persist_billing', error, (event, details) => {
    logged = { event, details };
  });

  assert.deepEqual(logged, {
    event: 'stripe_webhook_failed',
    details: {
      stage: 'persist_billing',
      errorName: 'UnknownError',
    },
  });
  const output = JSON.stringify(logged);
  assert.equal(output.includes('whsec_'), false);
  assert.equal(output.includes('sk_live_'), false);
  assert.equal(output.includes('Signature payload'), false);
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

console.log(`${tests.length - failures}/${tests.length} Stripe webhook diagnostics tests passed`);
process.exitCode = failures === 0 ? 0 : 1;
