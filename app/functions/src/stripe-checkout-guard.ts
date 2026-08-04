export type StripeSubscriptionDisposition = 'checkout' | 'manage_billing';

const RECOVERABLE_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'incomplete',
]);

export function stripeSubscriptionDisposition(statuses: readonly string[]): StripeSubscriptionDisposition {
  return statuses.some((status) => RECOVERABLE_STRIPE_SUBSCRIPTION_STATUSES.has(status))
    ? 'manage_billing'
    : 'checkout';
}

export function stripeCustomerIdempotencyKey(organizationId: string): string {
  return `laundryops:customer:${organizationId}`;
}

export function stripeCheckoutIdempotencyKey(organizationId: string, attemptId: string): string {
  return `laundryops:checkout:${organizationId}:${attemptId}`;
}

export function isReusableCheckoutAttemptState(state: unknown): boolean {
  return state === 'ready' || state === 'in_progress' || state === 'failed';
}

export type CheckoutAttemptDecision = 'new_attempt' | 'existing_checkout' | 'pending' | 'resume_attempt';

export function decideCheckoutAttempt(params: {
  nowMs: number;
  expiresAtMs: number | null;
  state: unknown;
  hasCheckoutUrl: boolean;
}): CheckoutAttemptDecision {
  const active = params.expiresAtMs !== null && params.expiresAtMs > params.nowMs;
  if (!active) {
    return 'new_attempt';
  }
  if (params.state === 'ready' && params.hasCheckoutUrl) {
    return 'existing_checkout';
  }
  if (params.state === 'in_progress') {
    return 'pending';
  }
  if (params.state === 'failed') {
    return 'resume_attempt';
  }
  return 'new_attempt';
}
