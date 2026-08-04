import assert from 'node:assert/strict';
import {
  decideCheckoutAttempt,
  isReusableCheckoutAttemptState,
  stripeCheckoutIdempotencyKey,
  stripeCustomerIdempotencyKey,
  stripeSubscriptionDisposition,
} from './src/stripe-checkout-guard.ts';

assert.equal(stripeSubscriptionDisposition([]), 'checkout', 'a normal app trial with no Stripe subscription can choose a plan');
assert.equal(stripeSubscriptionDisposition(['canceled']), 'checkout', 'a cancelled subscription may resubscribe');
assert.equal(stripeSubscriptionDisposition(['incomplete_expired']), 'checkout', 'an expired incomplete subscription may resubscribe');
for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']) {
  assert.equal(stripeSubscriptionDisposition([status]), 'manage_billing', `${status} must recover through billing management`);
}
assert.equal(stripeSubscriptionDisposition(['canceled', 'active']), 'manage_billing');
assert.equal(stripeCustomerIdempotencyKey('org-a'), stripeCustomerIdempotencyKey('org-a'));
assert.notEqual(stripeCustomerIdempotencyKey('org-a'), stripeCustomerIdempotencyKey('org-b'));
assert.equal(stripeCheckoutIdempotencyKey('org-a', 'attempt-a'), stripeCheckoutIdempotencyKey('org-a', 'attempt-a'));
assert.notEqual(stripeCheckoutIdempotencyKey('org-a', 'attempt-a'), stripeCheckoutIdempotencyKey('org-a', 'attempt-b'));
assert.equal(isReusableCheckoutAttemptState('ready'), true);
assert.equal(isReusableCheckoutAttemptState('in_progress'), true);
assert.equal(isReusableCheckoutAttemptState('failed'), true);
assert.equal(isReusableCheckoutAttemptState('blocked'), false);
assert.equal(decideCheckoutAttempt({ nowMs: 100, expiresAtMs: null, state: null, hasCheckoutUrl: false }), 'new_attempt');
assert.equal(decideCheckoutAttempt({ nowMs: 100, expiresAtMs: 200, state: 'in_progress', hasCheckoutUrl: false }), 'pending', 'a second simultaneous request must wait for the first reservation');
assert.equal(decideCheckoutAttempt({ nowMs: 100, expiresAtMs: 200, state: 'ready', hasCheckoutUrl: true }), 'existing_checkout', 'a repeat click must reuse the existing Checkout session');
assert.equal(decideCheckoutAttempt({ nowMs: 100, expiresAtMs: 200, state: 'failed', hasCheckoutUrl: false }), 'resume_attempt', 'a recoverable request failure must reuse its Stripe idempotency key');
assert.equal(decideCheckoutAttempt({ nowMs: 200, expiresAtMs: 200, state: 'ready', hasCheckoutUrl: true }), 'new_attempt', 'an expired session may be replaced');
console.log('Stripe checkout guard tests passed.');
