import assert from 'node:assert/strict';
import {
  calculateTrialEndsAt,
  evaluateTrialAccess,
  shouldScheduleTrialExpiration,
  TRIAL_DURATION_MS,
} from './trial.ts';

const startedAt = Date.UTC(2026, 6, 10, 12, 0, 0);
const endsAt = calculateTrialEndsAt(startedAt);

assert.equal(endsAt, startedAt + TRIAL_DURATION_MS);
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt - 1).status, 'active');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'expired');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt + 1).status, 'expired');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'active', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'active');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'canceled', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt - 1).status, 'expired');
assert.equal(evaluateTrialAccess({ accessEntitlement: 'developer', subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'active');
assert.equal(evaluateTrialAccess({ accessEntitlement: 'developer', subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt + 1).status, 'active');
assert.equal(evaluateTrialAccess({ accessEntitlement: 'developer', subscriptionStatus: 'canceled' }, endsAt + 1).status, 'active');

const activeTrialRecord = { subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt };
assert.equal(
  shouldScheduleTrialExpiration(activeTrialRecord, evaluateTrialAccess(activeTrialRecord, endsAt - 1)),
  true,
);
const expiredDeveloperRecord = {
  accessEntitlement: 'developer',
  subscriptionStatus: 'trialing',
  trialStartedAtMs: startedAt,
  trialEndsAtMs: endsAt,
};
assert.equal(
  shouldScheduleTrialExpiration(expiredDeveloperRecord, evaluateTrialAccess(expiredDeveloperRecord, endsAt + 1)),
  false,
  'developer access must not schedule an immediate expired-trial timer',
);

console.log('Frontend trial tests passed.');
