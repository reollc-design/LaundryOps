import assert from 'node:assert/strict';
import {
  assertOrganizationAccess,
  bearerTokenFromHeader,
  consumeRateLimit,
  OrganizationAccessError,
  RequestAuthenticationError,
  REQUEST_RATE_LIMIT_POLICIES,
} from './src/request-protection.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function activeMembership(role) {
  return {
    organizationExists: true,
    membershipExists: true,
    membershipRole: role,
    membershipStatus: 'active',
  };
}

test('rejects missing authentication before protected work can run', () => {
  assert.throws(() => bearerTokenFromHeader(undefined), RequestAuthenticationError);
  assert.throws(() => bearerTokenFromHeader('Basic token'), /Missing auth token/);
  assert.throws(() => bearerTokenFromHeader('Bearer '), /Missing auth token/);
  assert.equal(bearerTokenFromHeader('Bearer valid-token'), 'valid-token');
});

test('rejects a caller from the wrong organization', () => {
  assert.throws(
    () => assertOrganizationAccess({
      uid: 'ownerB',
      mode: 'member',
      state: {
        organizationExists: true,
        ownerUserId: 'ownerA',
        membershipExists: false,
      },
    }),
    OrganizationAccessError,
  );
  assert.throws(
    () => assertOrganizationAccess({
      uid: 'ownerB',
      mode: 'member',
      state: {
        organizationExists: false,
        membershipExists: true,
        membershipRole: 'owner',
        membershipStatus: 'active',
      },
    }),
    /Organization access not found/,
  );
});

test('rejects an authenticated user without the required role', () => {
  assert.throws(
    () => assertOrganizationAccess({
      uid: 'techA1',
      mode: 'ownerOrAdmin',
      state: activeMembership('technician'),
    }),
    /Owner or admin access is required/,
  );
  assert.throws(
    () => assertOrganizationAccess({
      uid: 'viewerA',
      mode: 'manualManager',
      state: activeMembership('viewer'),
    }),
    /Owner, admin, or manager access is required/,
  );
});

test('blocks repeated requests after the endpoint policy is exhausted', () => {
  const policy = REQUEST_RATE_LIMIT_POLICIES.repairAssist;
  const nowMs = 1_000_000;
  let record = null;
  let lastDecision;

  for (let index = 0; index < policy.limit; index += 1) {
    lastDecision = consumeRateLimit(record, nowMs, policy);
    assert.equal(lastDecision.allowed, true);
    record = lastDecision.record;
  }

  assert.equal(lastDecision.remaining, 0);
  const blocked = consumeRateLimit(record, nowMs, policy);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds > 0, true);
});

test('defines an enforcement policy for every protected endpoint', () => {
  const operations = [
    'repairAssist',
    'indexManual',
    'reindexManuals',
    'deleteManual',
    'stripeCheckout',
    'billingPortal',
  ];
  for (const operation of operations) {
    const policy = REQUEST_RATE_LIMIT_POLICIES[operation];
    assert.equal(policy.limit > 0, true);
    assert.equal(policy.windowSeconds > 0, true);
  }
});

test('keeps valid owner, manager, and member requests functional', () => {
  assert.doesNotThrow(() => assertOrganizationAccess({
    uid: 'ownerA',
    mode: 'ownerOrAdmin',
    state: { organizationExists: true, ownerUserId: 'ownerA', membershipExists: false },
  }));
  assert.doesNotThrow(() => assertOrganizationAccess({
    uid: 'managerA1',
    mode: 'manualManager',
    state: activeMembership('manager'),
  }));
  assert.doesNotThrow(() => assertOrganizationAccess({
    uid: 'techA1',
    mode: 'member',
    state: activeMembership('technician'),
  }));

  const policy = REQUEST_RATE_LIMIT_POLICIES.indexManual;
  const first = consumeRateLimit(null, 2_000_000, policy);
  const second = consumeRateLimit(first.record, 2_000_001, policy);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, policy.limit - 2);
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

console.log(`${tests.length - failures}/${tests.length} request protection tests passed`);
process.exitCode = failures === 0 ? 0 : 1;
