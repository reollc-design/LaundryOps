import { Timestamp, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import type { DowntimePeriod } from '../downtime';
import { getFirebaseClient } from '../firebase/client';

interface OrganizationDowntimeState {
  loading: boolean;
  periods: DowntimePeriod[];
  error: string | null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toEpochMs(value: unknown): number | undefined {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const milliseconds = (value as { toDate: () => Date }).toDate().getTime();
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  return undefined;
}

function requireDb(): Firestore | null {
  return getFirebaseClient().db ?? null;
}

export function useOrganizationDowntimePeriods(user: User | null, organizationId: string | null): OrganizationDowntimeState {
  const db = useMemo(() => requireDb(), []);
  const [state, setState] = useState<OrganizationDowntimeState>({ loading: false, periods: [], error: null });

  useEffect(() => {
    if (!user || !organizationId) {
      setState({ loading: false, periods: [], error: null });
      return undefined;
    }
    if (!db) {
      setState({ loading: false, periods: [], error: 'Firestore client is not configured.' });
      return undefined;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));
    return onSnapshot(collection(db, `organizations/${organizationId}/downtimePeriods`), (snapshot) => {
      const periods = snapshot.docs.flatMap((entry) => {
        const data = entry.data();
        const startedAtMs = toEpochMs(data.startedAt);
        const machineId = asString(data.machineId);
        const machineNumber = asString(data.machineNumber);
        if (!startedAtMs || !machineId || !machineNumber) return [];
        return [{
          id: entry.id,
          machineId,
          machineNumber,
          machineModel: asString(data.machineModel) ?? 'Machine details not set',
          ...(asString(data.locationId) ? { locationId: asString(data.locationId) } : {}),
          startedAtMs,
          ...(toEpochMs(data.endedAt) ? { endedAtMs: toEpochMs(data.endedAt) } : {}),
          status: data.status === 'completed' ? 'completed' as const : 'active' as const,
        } satisfies DowntimePeriod];
      }).sort((left, right) => right.startedAtMs - left.startedAtMs);
      setState({ loading: false, periods, error: null });
    }, (error) => setState({ loading: false, periods: [], error: error.message }));
  }, [db, organizationId, user]);

  return state;
}
