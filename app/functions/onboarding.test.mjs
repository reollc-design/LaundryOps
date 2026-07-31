import assert from 'node:assert/strict';
import {
  completeOwnerOnboardingTransaction,
  ONBOARDING_TRIAL_DURATION_MS,
} from './src/onboarding.ts';

const draft = {
  businessName: 'Test Laundry',
  operatorName: 'Owner Test',
  businessAddress: '123 Main Street',
  ownerEmail: 'owner@example.com',
  locationName: 'Main Store',
  locationAddress: '123 Main Street',
  machineNumber: 'W01',
  machineType: 'Washer',
  machineMake: 'Speed Queen',
  machineModelNumber: 'SC40',
};

class MemoryOnboardingStore {
  docs = new Map();
  transactionWriteCounts = [];
  failOnSetNumber = null;

  newDocumentId(collectionPath) {
    if (collectionPath === 'organizations') return 'orgA';
    if (collectionPath.endsWith('/locations')) return 'locationA';
    if (collectionPath.endsWith('/machines')) return 'machineA';
    throw new Error(`Unexpected collection path: ${collectionPath}`);
  }

  async runTransaction(work) {
    const staged = new Map(this.docs);
    let setCount = 0;
    const result = await work({
      get: async (path) => staged.get(path) ?? null,
      set: (path, data, options) => {
        setCount += 1;
        if (this.failOnSetNumber === setCount) {
          throw new Error('simulated transaction failure');
        }
        const previous = options?.merge ? staged.get(path) ?? {} : {};
        staged.set(path, { ...previous, ...data });
      },
    });
    this.docs = staged;
    this.transactionWriteCounts.push(setCount);
    return result;
  }
}

function runOnboarding(store, requestId = 'request-1') {
  return completeOwnerOnboardingTransaction({
    store,
    uid: 'ownerA',
    authenticatedEmail: 'owner@example.com',
    requestId,
    draft,
    nowMs: 1_800_000_000_000,
    timestampFromMillis: (value) => value,
  });
}

const successfulStore = new MemoryOnboardingStore();
const firstResult = await runOnboarding(successfulStore);
assert.deepEqual(firstResult, {
  organizationId: 'orgA',
  locationId: 'locationA',
  machineId: 'machineA',
  replayed: false,
});
assert.equal(successfulStore.docs.size, 5, 'onboarding must atomically create exactly five documents');
assert.equal(successfulStore.transactionWriteCounts[0], 5);
assert.deepEqual([...successfulStore.docs.keys()].sort(), [
  'organizations/orgA',
  'organizations/orgA/locations/locationA',
  'organizations/orgA/machines/machineA',
  'organizations/orgA/memberships/ownerA',
  'users/ownerA',
]);
const organization = successfulStore.docs.get('organizations/orgA');
assert.equal(organization.trialStartedAt, 1_800_000_000_000);
assert.equal(organization.trialEndsAt, 1_800_000_000_000 + ONBOARDING_TRIAL_DURATION_MS);
assert.equal(organization.ownerEmail, 'owner@example.com');

const replay = await runOnboarding(successfulStore);
assert.equal(replay.replayed, true);
assert.deepEqual({ ...replay, replayed: false }, firstResult);
assert.equal(successfulStore.docs.size, 5, 'retry must not create duplicate documents');
assert.equal(successfulStore.transactionWriteCounts[1], 0, 'retry must not rewrite completed onboarding');

const laterRequestReplay = await runOnboarding(successfulStore, 'request-2');
assert.equal(laterRequestReplay.replayed, true);
assert.equal(successfulStore.docs.size, 5, 'a later request must reuse the connected organization');

const failedStore = new MemoryOnboardingStore();
failedStore.failOnSetNumber = 3;
await assert.rejects(() => runOnboarding(failedStore), /simulated transaction failure/);
assert.equal(failedStore.docs.size, 0, 'failed transaction must roll back all five writes');

const verifiedEmailStore = new MemoryOnboardingStore();
await completeOwnerOnboardingTransaction({
  store: verifiedEmailStore,
  uid: 'ownerA',
  authenticatedEmail: 'verified@example.com',
  requestId: 'request-verified-email',
  draft: { ...draft, ownerEmail: 'different@example.com' },
  nowMs: 1_800_000_000_000,
  timestampFromMillis: (value) => value,
});
assert.equal(
  verifiedEmailStore.docs.get('organizations/orgA').ownerEmail,
  'verified@example.com',
  'the verified Firebase Auth email must override browser-supplied email text',
);

console.log('5/5 owner onboarding transaction tests passed');
