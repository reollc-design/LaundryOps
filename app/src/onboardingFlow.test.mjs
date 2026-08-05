import assert from 'node:assert/strict';
import {
  decideOrganizationRoute,
  onboardingFailureMessage,
  shouldApplyProfileSnapshot,
} from './onboardingFlow.ts';

assert.equal(shouldApplyProfileSnapshot(true), false, 'optimistic snapshots must not control routing');
assert.equal(shouldApplyProfileSnapshot(false), true, 'server-confirmed snapshots must remain usable');

assert.equal(decideOrganizationRoute({
  profileHasPendingWrites: true,
  hasOrganization: true,
  isAccountSetupScreen: true,
  isProtectedScreen: false,
}), 'wait', 'a pending organization snapshot must not flash Home');

assert.equal(decideOrganizationRoute({
  profileHasPendingWrites: false,
  hasOrganization: false,
  isAccountSetupScreen: false,
  isProtectedScreen: true,
}), 'owner-onboarding', 'a confirmed rollback must keep the user in onboarding');

assert.equal(decideOrganizationRoute({
  profileHasPendingWrites: false,
  hasOrganization: false,
  isAccountSetupScreen: true,
  isProtectedScreen: false,
}), 'owner-onboarding', 'an authenticated user restored to Welcome must continue to onboarding');

assert.equal(decideOrganizationRoute({
  profileHasPendingWrites: false,
  hasOrganization: true,
  isAccountSetupScreen: true,
  isProtectedScreen: false,
}), 'home', 'confirmed onboarding must route to Home');

assert.equal(
  onboardingFailureMessage(new Error('Could not complete company setup.')),
  'Could not complete company setup.',
  'the rejected-write error must remain visible to the user',
);
assert.equal(onboardingFailureMessage(null), 'Could not complete company setup. Try again.');

console.log('7/7 frontend onboarding flow tests passed');
