import assert from 'node:assert/strict';
import { calculateTrialEndsAt, evaluateTrialAccess, TRIAL_DURATION_MS } from './trial.ts';

const startedAt = Date.UTC(2026, 6, 10, 12, 0, 0);
const endsAt = calculateTrialEndsAt(startedAt);

assert.equal(endsAt, startedAt + TRIAL_DURATION_MS);
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt - 1).status, 'active');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'expired');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'trialing', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt + 1).status, 'expired');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'active', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt).status, 'active');
assert.equal(evaluateTrialAccess({ subscriptionStatus: 'canceled', trialStartedAtMs: startedAt, trialEndsAtMs: endsAt }, endsAt - 1).status, 'expired');

console.log('Frontend trial tests passed.');
