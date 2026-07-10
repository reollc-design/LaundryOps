export const TRIAL_DAYS = 14;
export const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export type TrialAccessStatus = 'active' | 'expired';

export interface TrialRecordInput {
  subscriptionStatus?: unknown;
  trialStartedAtMs?: number | null;
  trialEndsAtMs?: number | null;
}

export interface TrialAccessResult {
  status: TrialAccessStatus;
  trialEndsAtMs: number | null;
}

export function timestampToMilliseconds(value: unknown): number | null {
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    const milliseconds = value.toMillis();
    return typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof value.seconds === 'number') {
    const nanoseconds = 'nanoseconds' in value && typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return value.seconds * 1000 + nanoseconds / 1_000_000;
  }
  return finiteMilliseconds(value);
}

function finiteMilliseconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function calculateTrialEndsAt(startedAtMs: number): number {
  if (!Number.isFinite(startedAtMs)) {
    throw new Error('Trial start time must be a finite number.');
  }
  return startedAtMs + TRIAL_DURATION_MS;
}

export function resolveTrialEndsAt(record: TrialRecordInput): number | null {
  const storedEnd = finiteMilliseconds(record.trialEndsAtMs);
  if (storedEnd !== null) {
    return storedEnd;
  }

  const storedStart = finiteMilliseconds(record.trialStartedAtMs);
  return storedStart === null ? null : calculateTrialEndsAt(storedStart);
}

export function evaluateTrialAccess(record: TrialRecordInput, nowMs: number): TrialAccessResult {
  if (record.subscriptionStatus === 'active') {
    return { status: 'active', trialEndsAtMs: resolveTrialEndsAt(record) };
  }

  if (record.subscriptionStatus !== 'trialing') {
    return { status: 'expired', trialEndsAtMs: resolveTrialEndsAt(record) };
  }

  const trialEndsAtMs = resolveTrialEndsAt(record);
  return {
    status: trialEndsAtMs !== null && Number.isFinite(nowMs) && nowMs < trialEndsAtMs ? 'active' : 'expired',
    trialEndsAtMs,
  };
}

export function stripeTrialEndForCheckout(record: TrialRecordInput, nowMs: number): number | undefined {
  if (record.subscriptionStatus !== 'trialing') {
    return undefined;
  }

  const trial = evaluateTrialAccess(record, nowMs);
  if (trial.status !== 'active' || trial.trialEndsAtMs === null) {
    return undefined;
  }

  // Stripe accepts whole Unix seconds. Ceiling preserves the stored end instead of
  // starting billing up to 999ms early when the Firestore timestamp has fractions.
  return Math.ceil(trial.trialEndsAtMs / 1000);
}

export interface CheckoutSubscriptionData {
  metadata: Record<string, string>;
  trial_end?: number;
}

export function buildCheckoutSubscriptionData(params: {
  organizationId: string;
  billingPlan: string;
  trial: TrialRecordInput;
  nowMs: number;
}): CheckoutSubscriptionData {
  const subscriptionData: CheckoutSubscriptionData = {
    metadata: {
      organizationId: params.organizationId,
      billingPlan: params.billingPlan,
    },
  };
  const trialEndUnixSeconds = stripeTrialEndForCheckout(params.trial, params.nowMs);
  if (trialEndUnixSeconds !== undefined) {
    subscriptionData.trial_end = trialEndUnixSeconds;
  }
  return subscriptionData;
}
