import assert from 'node:assert/strict';
import {
  calculateTrialEndsAt,
  buildCheckoutSubscriptionData,
  evaluateTrialAccess,
  stripeTrialEndForCheckout,
  TRIAL_DURATION_MS,
} from './src/trial.ts';

const startedAt = Date.UTC(2026, 6, 10, 12, 0, 0);
const endsAt = calculateTrialEndsAt(startedAt);

assert.equal(endsAt, startedAt + TRIAL_DURATION_MS);
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt - 1).status, 'active');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'expired');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt + 1).status, 'expired');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'active', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'active');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'canceled', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt - 1).status, 'expired');

const organizationTrial = {
  subscriptionStatus: 'trialing',
  trialStartedAtMs: startedAt,
  trialEndsAtMs: endsAt + 123,
};
const originalTrialEnd = organizationTrial.trialEndsAtMs;
assert.equal(stripeTrialEndForCheckout(organizationTrial, originalTrialEnd), undefined, 'expired checkout must bill immediately');
assert.equal(stripeTrialEndForCheckout(organizationTrial, originalTrialEnd - 1000), Math.ceil(originalTrialEnd / 1000));
assert.equal(organizationTrial.trialEndsAtMs, originalTrialEnd, 'checkout planning must not mutate trialEndsAt');

const activeCheckoutData = buildCheckoutSubscriptionData({
  organizationId: 'orgA',
  billingPlan: 'annual',
  trial: organizationTrial,
  nowMs: originalTrialEnd - 1000,
});
assert.equal(activeCheckoutData.trial_end, Math.ceil(originalTrialEnd / 1000));
assert.equal(activeCheckoutData.metadata.organizationId, 'orgA');

const expiredCheckoutData = buildCheckoutSubscriptionData({
  organizationId: 'orgA',
  billingPlan: 'annual',
  trial: organizationTrial,
  nowMs: originalTrialEnd,
});
assert.equal('trial_end' in expiredCheckoutData, false, 'expired checkout must not receive a trial_end');

console.log('Functions trial tests passed.');
