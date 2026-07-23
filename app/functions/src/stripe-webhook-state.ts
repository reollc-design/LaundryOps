export type StripeBillingEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

export interface StripeSubscriptionSnapshot {
  id: string;
  customerId: string | null;
  status: string;
  trialEndSeconds: number | null;
}

export interface StripeBillingEventState extends StripeSubscriptionSnapshot {
  eventId: string;
  eventCreated: number;
  eventType: StripeBillingEventType;
  organizationId: string;
}

export interface StoredStripeBillingState {
  eventId?: unknown;
  eventCreated?: unknown;
  eventType?: unknown;
  subscriptionId?: unknown;
  status?: unknown;
}

export type StripeBillingEventDecision = 'apply' | 'duplicate' | 'stale';

const EVENT_PRECEDENCE: Record<StripeBillingEventType, number> = {
  'checkout.session.completed': 1,
  'customer.subscription.created': 2,
  'customer.subscription.updated': 3,
  'customer.subscription.deleted': 4,
};

const STATUS_PRECEDENCE: Record<string, number> = {
  trialing: 1,
  active: 2,
  incomplete: 3,
  paused: 4,
  past_due: 5,
  unpaid: 6,
  incomplete_expired: 7,
  canceled: 8,
};

function storedString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function storedEventCreated(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function eventPrecedence(value: unknown): number {
  const eventType = storedString(value);
  return eventType && eventType in EVENT_PRECEDENCE
    ? EVENT_PRECEDENCE[eventType as StripeBillingEventType]
    : 0;
}

function statusPrecedence(value: unknown): number {
  const status = storedString(value);
  return status ? (STATUS_PRECEDENCE[status] ?? 0) : 0;
}

export function buildStripeBillingEventState(input: {
  eventId: string;
  eventCreated: number;
  eventType: StripeBillingEventType;
  organizationId: string;
  subscription: StripeSubscriptionSnapshot;
}): StripeBillingEventState {
  return {
    eventId: input.eventId,
    eventCreated: input.eventCreated,
    eventType: input.eventType,
    organizationId: input.organizationId,
    ...input.subscription,
  };
}

export function decideStripeBillingEvent(
  incoming: StripeBillingEventState,
  stored: StoredStripeBillingState,
): StripeBillingEventDecision {
  const storedEventId = storedString(stored.eventId);
  if (storedEventId === incoming.eventId) {
    return 'duplicate';
  }

  const previousCreated = storedEventCreated(stored.eventCreated);
  if (previousCreated === null) {
    return 'apply';
  }
  if (incoming.eventCreated < previousCreated) {
    return 'stale';
  }
  if (incoming.eventCreated > previousCreated) {
    return 'apply';
  }

  const incomingStatusPrecedence = statusPrecedence(incoming.status);
  const storedStatusPrecedence = statusPrecedence(stored.status);
  if (incomingStatusPrecedence !== storedStatusPrecedence) {
    return incomingStatusPrecedence > storedStatusPrecedence ? 'apply' : 'stale';
  }

  return EVENT_PRECEDENCE[incoming.eventType] > eventPrecedence(stored.eventType)
    ? 'apply'
    : 'stale';
}

export function shouldUpdateOrganizationBillingState(
  incoming: StripeBillingEventState,
  stored: StoredStripeBillingState,
): boolean {
  if (decideStripeBillingEvent(incoming, stored) !== 'apply') {
    return false;
  }

  const currentSubscriptionId = storedString(stored.subscriptionId);
  const isDifferentSubscription = currentSubscriptionId !== null && currentSubscriptionId !== incoming.id;
  if (!isDifferentSubscription) {
    return true;
  }

  // Only checkout/creation events establish a replacement subscription. A
  // delayed update or deletion from an older subscription must never replace
  // the organization's current subscription pointer or billing status.
  const establishesNewSubscription = incoming.eventType === 'checkout.session.completed'
    || incoming.eventType === 'customer.subscription.created';
  return establishesNewSubscription && incoming.status !== 'canceled';
}
