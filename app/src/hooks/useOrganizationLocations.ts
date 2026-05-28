import { collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { getFirebaseClient } from '../firebase/client';

export interface OrganizationLocation {
  id: string;
  name: string;
  cityState: string | null;
}

interface OrganizationLocationsState {
  loading: boolean;
  locations: OrganizationLocation[];
  error: string | null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireDb(): Firestore | null {
  const client = getFirebaseClient();
  return client.db ?? null;
}

export function useOrganizationLocations(user: User | null, organizationId: string | null): OrganizationLocationsState {
  const db = useMemo(() => requireDb(), []);
  const [state, setState] = useState<OrganizationLocationsState>({
    loading: false,
    locations: [],
    error: null,
  });

  useEffect(() => {
    if (!user || !organizationId) {
      setState({
        loading: false,
        locations: [],
        error: null,
      });
      return undefined;
    }

    if (!db) {
      setState({
        loading: false,
        locations: [],
        error: 'Firestore client is not configured.',
      });
      return undefined;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    const locationsRef = collection(db, `organizations/${organizationId}/locations`);
    const unsubscribe = onSnapshot(
      locationsRef,
      (snapshot) => {
        const locations = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              name: asString(data.name) ?? docSnapshot.id,
              cityState: asString(data.cityState),
            } satisfies OrganizationLocation;
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        setState({
          loading: false,
          locations,
          error: null,
        });
      },
      (error) => {
        setState({
          loading: false,
          locations: [],
          error: error.message,
        });
      },
    );

    return unsubscribe;
  }, [db, organizationId, user]);

  return state;
}
