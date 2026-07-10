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
