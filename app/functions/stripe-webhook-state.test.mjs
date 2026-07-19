import assert from 'node:assert/strict';
import {
  buildStripeBillingEventState,
  decideStripeBillingEvent,
  shouldUpdateOrganizationBillingState,
} from './src/stripe-webhook-state.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function billingEvent(overrides = {}) {
  return buildStripeBillingEventState({
    eventId: 'evt_active',
    eventCreated: 200,
    eventType: 'checkout.session.completed',
    organizationId: 'org-1',
    subscription: {
      id: 'sub-1',
      customerId: 'cus-1',
      status: 'active',
      trialEndSeconds: null,
    },
    ...overrides,
  });
}

test('checkout completion preserves the retrieved active subscription status', () => {
  const event = billingEvent();
  assert.equal(event.status, 'active');
  assert.equal(event.trialEndSeconds, null);
  assert.equal(decideStripeBillingEvent(event, {}), 'apply');
});

test('checkout completion preserves the retrieved trialing status and Stripe trial end', () => {
  const event = billingEvent({
    eventId: 'evt_trialing',
    subscription: {
      id: 'sub-1',
      customerId: 'cus-1',
      status: 'trialing',
      trialEndSeconds: 1_800_000_000,
    },
  });

  assert.equal(event.status, 'trialing');
  assert.equal(event.trialEndSeconds, 1_800_000_000);
});

test('a canceled deletion is applied to the current subscription', () => {
  const deleted = billingEvent({
    eventId: 'evt_deleted',
    eventCreated: 300,
    eventType: 'customer.subscription.deleted',
    subscription: {
      id: 'sub-1',
      customerId: 'cus-1',
      status: 'canceled',
      trialEndSeconds: null,
    },
  });
  const stored = {
    eventId: 'evt_active',
    eventCreated: 200,
    eventType: 'customer.subscription.updated',
    subscriptionId: 'sub-1',
    status: 'active',
  };

  assert.equal(decideStripeBillingEvent(deleted, stored), 'apply');
  assert.equal(shouldUpdateOrganizationBillingState(deleted, stored), true);
});

test('a canceled update is applied to the current subscription', () => {
  const canceled = billingEvent({
    eventId: 'evt_canceled_update',
    eventCreated: 301,
    eventType: 'customer.subscription.updated',
    subscription: {
      id: 'sub-1',
      customerId: 'cus-1',
      status: 'canceled',
      trialEndSeconds: null,
    },
  });
  const stored = {
    eventId: 'evt_active',
    eventCreated: 200,
    eventType: 'customer.subscription.updated',
    subscriptionId: 'sub-1',
    status: 'active',
  };

  assert.equal(decideStripeBillingEvent(canceled, stored), 'apply');
  assert.equal(shouldUpdateOrganizationBillingState(canceled, stored), true);
});

test('a duplicate event cannot be applied twice', () => {
  const event = billingEvent();
  assert.equal(decideStripeBillingEvent(event, {
    eventId: event.eventId,
    eventCreated: event.eventCreated,
    eventType: event.eventType,
    status: event.status,
  }), 'duplicate');
});

test('a stale reordered event cannot overwrite newer billing state', () => {
  const stale = billingEvent({
    eventId: 'evt_stale',
    eventCreated: 100,
    eventType: 'customer.subscription.created',
  });
  const newerStored = {
    eventId: 'evt_newer',
    eventCreated: 200,
    eventType: 'customer.subscription.updated',
    subscriptionId: 'sub-1',
    status: 'active',
  };

  assert.equal(decideStripeBillingEvent(stale, newerStored), 'stale');
  assert.equal(shouldUpdateOrganizationBillingState(stale, newerStored), false);
});

test('a deleted old subscription cannot cancel a different current subscription', () => {
  const oldDeletion = billingEvent({
    eventId: 'evt_old_deleted',
    eventCreated: 400,
    eventType: 'customer.subscription.deleted',
    subscription: {
      id: 'sub-old',
      customerId: 'cus-1',
      status: 'canceled',
      trialEndSeconds: null,
    },
  });
  const currentOrganization = {
    eventId: 'evt_current',
    eventCreated: 300,
    eventType: 'customer.subscription.updated',
    subscriptionId: 'sub-current',
    status: 'active',
  };

  assert.equal(decideStripeBillingEvent(oldDeletion, currentOrganization), 'apply');
  assert.equal(shouldUpdateOrganizationBillingState(oldDeletion, currentOrganization), false);
});

test('a delayed update from an old subscription cannot replace the current subscription', () => {
  const oldUpdate = billingEvent({
    eventId: 'evt_old_updated',
    eventCreated: 400,
    eventType: 'customer.subscription.updated',
    subscription: {
      id: 'sub-old',
      customerId: 'cus-1',
      status: 'active',
      trialEndSeconds: null,
    },
  });
  const currentOrganization = {
    eventId: 'evt_current',
    eventCreated: 300,
    eventType: 'checkout.session.completed',
    subscriptionId: 'sub-current',
    status: 'active',
  };

  assert.equal(decideStripeBillingEvent(oldUpdate, currentOrganization), 'apply');
  assert.equal(shouldUpdateOrganizationBillingState(oldUpdate, currentOrganization), false);
});

test('a checkout event can establish a replacement subscription', () => {
  const replacementCheckout = billingEvent({
    eventId: 'evt_replacement',
    eventCreated: 400,
    subscription: {
      id: 'sub-new',
      customerId: 'cus-1',
      status: 'active',
      trialEndSeconds: null,
    },
  });
  const currentOrganization = {
    eventId: 'evt_current',
    eventCreated: 300,
    eventType: 'customer.subscription.deleted',
    subscriptionId: 'sub-old',
    status: 'canceled',
  };

  assert.equal(shouldUpdateOrganizationBillingState(replacementCheckout, currentOrganization), true);
});

test('a canceled replacement event cannot replace the current subscription', () => {
  const canceledReplacement = billingEvent({
    eventId: 'evt_canceled_replacement',
    eventCreated: 400,
    eventType: 'customer.subscription.created',
    subscription: {
      id: 'sub-canceled',
      customerId: 'cus-1',
      status: 'canceled',
      trialEndSeconds: null,
    },
  });
  const currentOrganization = {
    eventId: 'evt_current',
    eventCreated: 300,
    eventType: 'customer.subscription.updated',
    subscriptionId: 'sub-current',
    status: 'active',
  };

  assert.equal(shouldUpdateOrganizationBillingState(canceledReplacement, currentOrganization), false);
});

test('equal-time cancellation wins and cannot be reversed by an active event', () => {
  const deleted = billingEvent({
    eventId: 'evt_deleted',
    eventCreated: 500,
    eventType: 'customer.subscription.deleted',
    subscription: {
      id: 'sub-1',
      customerId: 'cus-1',
      status: 'canceled',
      trialEndSeconds: null,
    },
  });
  const active = billingEvent({
    eventId: 'evt_active_same_second',
    eventCreated: 500,
    eventType: 'customer.subscription.updated',
  });

  assert.equal(decideStripeBillingEvent(deleted, {
    eventId: active.eventId,
    eventCreated: active.eventCreated,
    eventType: active.eventType,
    status: active.status,
  }), 'apply');
  assert.equal(decideStripeBillingEvent(active, {
    eventId: deleted.eventId,
    eventCreated: deleted.eventCreated,
    eventType: deleted.eventType,
    status: deleted.status,
  }), 'stale');
});

test('equal-time nonpaying Stripe statuses cannot be overwritten by active access', () => {
  const active = billingEvent({
    eventId: 'evt_active_same_second',
    eventCreated: 600,
    eventType: 'customer.subscription.updated',
  });

  for (const status of ['incomplete', 'paused', 'past_due', 'unpaid', 'incomplete_expired']) {
    const restricted = billingEvent({
      eventId: `evt_${status}`,
      eventCreated: 600,
      eventType: 'customer.subscription.updated',
      subscription: {
        id: 'sub-1',
        customerId: 'cus-1',
        status,
        trialEndSeconds: null,
      },
    });

    assert.equal(decideStripeBillingEvent(restricted, {
      eventId: active.eventId,
      eventCreated: active.eventCreated,
      eventType: active.eventType,
      status: active.status,
    }), 'apply');
    assert.equal(decideStripeBillingEvent(active, {
      eventId: restricted.eventId,
      eventCreated: restricted.eventCreated,
      eventType: restricted.eventType,
      status: restricted.status,
    }), 'stale');
  }
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

console.log(`${tests.length - failures}/${tests.length} Stripe webhook state tests passed`);
process.exitCode = failures === 0 ? 0 : 1;
