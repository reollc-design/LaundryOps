import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseClient } from '../firebase/client';
import { isInvalidOrganizationState } from '../organizationRecovery';
import { evaluateTrialAccess, shouldScheduleTrialExpiration, type TrialAccessStatus } from '../trial';

export interface OrganizationTrialState {
  loading: boolean;
  status: TrialAccessStatus | 'unknown';
  accessEntitlement: string | null;
  subscriptionStatus: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  trialStartedAtMs: number | null;
  trialEndsAtMs: number | null;
  error: string | null;
  invalidOrganization: boolean;
}

interface TrialRecord {
  accessEntitlement: string | null;
  subscriptionStatus: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
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
  const [organizationExists, setOrganizationExists] = useState<boolean | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!user || !organizationId) {
      setRecord(null);
      setLoading(false);
      setError(null);
      setOrganizationExists(null);
      setErrorCode(null);
      return undefined;
    }

    if (!client.db) {
      setRecord(null);
      setLoading(false);
      setError('Firestore client is not configured.');
      setOrganizationExists(null);
      setErrorCode('client-not-configured');
      return undefined;
    }

    setLoading(true);
    setError(null);
    setOrganizationExists(null);
    setErrorCode(null);
    const organizationRef = doc(client.db, 'organizations', organizationId);
    const unsubscribe = onSnapshot(
      organizationRef,
      (snapshot) => {
        const data = snapshot.data();
        const validOrganizationIdentity = snapshot.exists()
          && typeof data?.ownerUserId === 'string'
          && data.ownerUserId.trim().length > 0;
        setOrganizationExists(validOrganizationIdentity);
        setErrorCode(null);
        setRecord(snapshot.exists()
          ? {
              accessEntitlement: typeof data?.accessEntitlement === 'string' ? data.accessEntitlement : null,
              subscriptionStatus: typeof data?.subscriptionStatus === 'string' ? data.subscriptionStatus : null,
              providerCustomerId: typeof data?.providerCustomerId === 'string' ? data.providerCustomerId : null,
              providerSubscriptionId: typeof data?.providerSubscriptionId === 'string' ? data.providerSubscriptionId : null,
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
        setOrganizationExists(null);
        setErrorCode(snapshotError.code ?? null);
      },
    );

    return unsubscribe;
  }, [client.db, organizationId, user]);

  const evaluation = record ? evaluateTrialAccess(record, nowMs) : null;

  useEffect(() => {
    if (!evaluation || !record || !shouldScheduleTrialExpiration(record, evaluation)) {
      return undefined;
    }

    const delay = Math.max(0, evaluation.trialEndsAtMs - Date.now() + 1);
    const timeout = window.setTimeout(() => setNowMs(Date.now()), Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [evaluation, record]);

  return {
    loading,
    status: loading || !record || !evaluation ? 'unknown' : evaluation.status,
    accessEntitlement: record?.accessEntitlement ?? null,
    subscriptionStatus: record?.subscriptionStatus ?? null,
    providerCustomerId: record?.providerCustomerId ?? null,
    providerSubscriptionId: record?.providerSubscriptionId ?? null,
    trialStartedAtMs: record?.trialStartedAtMs ?? null,
    trialEndsAtMs: evaluation?.trialEndsAtMs ?? null,
    error,
    invalidOrganization: isInvalidOrganizationState({ loading, organizationExists, errorCode }),
  };
}
