import { collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import type { ManualStatus } from '../data';
import { getFirebaseClient } from '../firebase/client';

export interface ManualLibraryRow {
  id: string;
  model: string;
  title: string;
  status: ManualStatus;
  coverage: string;
  pages: string;
  updated: string;
  source: string;
  indexError: string | null;
}

interface OrganizationManualsState {
  loading: boolean;
  manuals: ManualLibraryRow[];
  error: string | null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asDate(value: unknown): Date | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    return maybeTimestamp.toDate();
  }
  return null;
}

function normalizeManualStatus(value: unknown): ManualStatus {
  if (value === 'indexed' || value === 'processing' || value === 'missing') {
    return value;
  }
  return 'processing';
}

function coverageLabel(status: ManualStatus, linkedMachineCount: number): string {
  if (status === 'missing') {
    return `${linkedMachineCount} machines need this manual`;
  }
  return `${linkedMachineCount} machines use this model`;
}

function pagesLabel(status: ManualStatus, pageCount: number | null): string {
  if (status === 'missing') {
    return 'No PDF uploaded';
  }
  if (!pageCount || pageCount <= 0) {
    return status === 'processing' ? 'Indexing PDF' : 'Pages unavailable';
  }
  return `${pageCount} pages`;
}

function updatedLabel(status: ManualStatus, updatedAt: Date | null): string {
  if (!updatedAt) {
    return status === 'missing' ? 'Upload before launch' : 'Update pending';
  }
  const value = updatedAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Updated ${value}`;
}

function sourceLabel(status: ManualStatus, indexError: string | null, source: string | null): string {
  if (indexError) {
    return `Index error: ${indexError}`;
  }
  if (source) {
    return source;
  }
  if (status === 'indexed') {
    return 'Ready for grounded AI repair answers';
  }
  if (status === 'processing') {
    return 'Indexing manual and preparing model matching';
  }
  return 'AI will use general guidance until a manual is uploaded';
}

function requireDb(): Firestore | null {
  const client = getFirebaseClient();
  return client.db ?? null;
}

export function useOrganizationManuals(user: User | null, organizationId: string | null): OrganizationManualsState {
  const db = useMemo(() => requireDb(), []);
  const [state, setState] = useState<OrganizationManualsState>({
    loading: false,
    manuals: [],
    error: null,
  });

  useEffect(() => {
    if (!user || !organizationId) {
      setState({
        loading: false,
        manuals: [],
        error: null,
      });
      return undefined;
    }

    if (!db) {
      setState({
        loading: false,
        manuals: [],
        error: 'Firestore client is not configured.',
      });
      return undefined;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    const manualsRef = collection(db, `organizations/${organizationId}/manuals`);
    const unsubscribe = onSnapshot(
      manualsRef,
      (snapshot) => {
        const manuals = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const status = normalizeManualStatus(data.status);
          const linkedMachineCount = Math.max(0, asNumber(data.linkedMachineCount) ?? 0);
          const pageCount = asNumber(data.pageCount);
          const indexError = asString(data.indexError);
          const source = asString(data.source);
          const updatedAt = asDate(data.updatedAt) ?? asDate(data.indexedAt) ?? asDate(data.createdAt);

          return {
            id: docSnapshot.id,
            model: asString(data.machineModel) ?? 'Model not set',
            title: asString(data.title) ?? (status === 'missing' ? 'Manual needed' : 'Manual file'),
            status,
            coverage: coverageLabel(status, linkedMachineCount),
            pages: pagesLabel(status, pageCount),
            updated: updatedLabel(status, updatedAt),
            source: sourceLabel(status, indexError, source),
            indexError,
          } satisfies ManualLibraryRow;
        });

        manuals.sort((a, b) => a.model.localeCompare(b.model, undefined, { sensitivity: 'base' }));
        setState({
          loading: false,
          manuals,
          error: null,
        });
      },
      (error) => {
        setState({
          loading: false,
          manuals: [],
          error: error.message,
        });
      },
    );

    return () => unsubscribe();
  }, [db, organizationId, user]);

  return state;
}
