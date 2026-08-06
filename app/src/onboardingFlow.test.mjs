import assert from 'node:assert/strict';
import {
  decideOrganizationRoute,
  emptyOnboardingDraft,
  onboardingFailureMessage,
  onboardingProgressStorageKey,
  parseStoredOnboardingProgress,
  serializeStoredOnboardingProgress,
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
assert.deepEqual(emptyOnboardingDraft(), {
  businessName: '',
  operatorName: '',
  businessAddress: '',
  ownerEmail: '',
  locationName: '',
  locationAddress: '',
  machineNumber: '',
  machineType: 'Washer',
  machineMake: '',
  machineModelNumber: '',
}, 'a user switch must start from an empty onboarding draft');

const onboardingDraft = {
  businessName: 'STG-015 Test Laundry',
  operatorName: 'Synthetic Operator',
  businessAddress: '100 Test Street',
  ownerEmail: 'stg015@example.com',
  locationName: 'Test Location',
  locationAddress: '101 Test Street',
  machineNumber: 'STG-015-W1',
  machineType: 'Washer',
  machineMake: 'Synthetic',
  machineModelNumber: 'MODEL-015',
};
const serializedProgress = serializeStoredOnboardingProgress(1, onboardingDraft);
assert.equal(onboardingProgressStorageKey('uid-stg015'), 'laundryops:onboarding-progress:uid-stg015');
assert.notEqual(
  onboardingProgressStorageKey('uid-stg015'),
  onboardingProgressStorageKey('uid-other'),
  'different authenticated users must never share an onboarding storage key',
);
assert.deepEqual(
  parseStoredOnboardingProgress(serializedProgress, 3),
  { activeStep: 1, draft: onboardingDraft },
  'saved onboarding step and fields must round-trip through session storage',
);
assert.equal(parseStoredOnboardingProgress('{not-json', 3), null, 'corrupt onboarding storage must be ignored');
assert.equal(
  parseStoredOnboardingProgress(serializeStoredOnboardingProgress(3, onboardingDraft), 3),
  null,
  'a stale step outside the current onboarding flow must be ignored',
);

console.log('11/11 frontend onboarding flow tests passed');
