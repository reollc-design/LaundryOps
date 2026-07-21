export const TRIAL_DAYS = 14;
export const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
export const DEVELOPER_ACCESS_ENTITLEMENT = 'developer';

export type TrialAccessStatus = 'active' | 'expired';

export interface TrialRecordInput {
  accessEntitlement?: unknown;
  subscriptionStatus?: unknown;
  trialStartedAtMs?: number | null;
  trialEndsAtMs?: number | null;
}

export function hasDeveloperAccess(record: TrialRecordInput): boolean {
  return record.accessEntitlement === DEVELOPER_ACCESS_ENTITLEMENT;
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
  if (hasDeveloperAccess(record) || record.subscriptionStatus === 'active') {
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

export function shouldScheduleTrialExpiration(
  record: TrialRecordInput,
  evaluation: TrialAccessResult,
): evaluation is TrialAccessResult & { status: 'active'; trialEndsAtMs: number } {
  return !hasDeveloperAccess(record)
    && evaluation.status === 'active'
    && record.subscriptionStatus === 'trialing'
    && evaluation.trialEndsAtMs !== null;
}
