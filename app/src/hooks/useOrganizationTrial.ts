import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseClient } from '../firebase/client';
import { evaluateTrialAccess, type TrialAccessStatus } from '../trial';

export interface OrganizationTrialState {
  loading: boolean;
  status: TrialAccessStatus | 'unknown';
  subscriptionStatus: string | null;
  trialStartedAtMs: number | null;
  trialEndsAtMs: number | null;
  error: string | null;
}

interface TrialRecord {
  subscriptionStatus: string | null;
  trialStartedAtMs: number | null;
  trialEndsAtMs: number | null;
}

function timestampToMillis(value: unknown): number | null {
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    const milliseconds = value.toMillis();
    return typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof value.seconds === 'number') {
    const nanoseconds = 'nanoseconds' in value && typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return value.seconds * 1000 + nanoseconds / 1_000_000;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function useOrganizationTrial(user: User | null, organizationId: string | null): OrganizationTrialState {
  const client = useMemo(() => getFirebaseClient(), []);
  const [record, setRecord] = useState<TrialRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!user || !organizationId) {
      setRecord(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    if (!client.db) {
      setRecord(null);
      setLoading(false);
      setError('Firestore client is not configured.');
      return undefined;
    }

    setLoading(true);
    setError(null);
    const organizationRef = doc(client.db, 'organizations', organizationId);
    const unsubscribe = onSnapshot(
      organizationRef,
      (snapshot) => {
        const data = snapshot.data();
        setRecord(snapshot.exists()
          ? {
              subscriptionStatus: typeof data?.subscriptionStatus === 'string' ? data.subscriptionStatus : null,
              trialStartedAtMs: timestampToMillis(data?.trialStartedAt),
              trialEndsAtMs: timestampToMillis(data?.trialEndsAt),
            }
          : null);
        setNowMs(Date.now());
        setLoading(false);
      },
      (snapshotError) => {
        setRecord(null);
        setLoading(false);
        setError(snapshotError.message);
      },
    );

    return unsubscribe;
  }, [client.db, organizationId, user]);

  const evaluation = record ? evaluateTrialAccess(record, nowMs) : null;

  useEffect(() => {
    if (!evaluation || evaluation.status !== 'active' || record?.subscriptionStatus !== 'trialing' || evaluation.trialEndsAtMs === null) {
      return undefined;
    }

    const delay = Math.max(0, evaluation.trialEndsAtMs - Date.now() + 1);
    const timeout = window.setTimeout(() => setNowMs(Date.now()), Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [evaluation, record?.subscriptionStatus]);

  return {
    loading,
    status: loading || !record || !evaluation ? 'unknown' : evaluation.status,
    subscriptionStatus: record?.subscriptionStatus ?? null,
    trialStartedAtMs: record?.trialStartedAtMs ?? null,
    trialEndsAtMs: evaluation?.trialEndsAtMs ?? null,
    error,
  };
}
