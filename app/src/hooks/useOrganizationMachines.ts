import { collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import type { MachineStatus, UrgentMachine } from '../data';
import { getFirebaseClient } from '../firebase/client';

interface OrganizationMachinesState {
  loading: boolean;
  machines: UrgentMachine[];
  error: string | null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMachineStatus(rawStatus: string | null): MachineStatus {
  if (!rawStatus) {
    return 'running';
  }

  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === 'running' || normalized === 'needs-repair' || normalized === 'down') {
    return normalized;
  }
  if (normalized === 'waiting') {
    return 'down';
  }
  if (normalized === 'healthy' || normalized === 'online' || normalized === 'up') {
    return 'running';
  }
  if (normalized.includes('repair')) {
    return 'needs-repair';
  }
  if (normalized.includes('wait') || normalized.includes('part')) {
    return 'down';
  }
  if (normalized.includes('down') || normalized.includes('offline') || normalized.includes('error')) {
    return 'down';
  }
  return 'running';
}

function labelForStatus(status: MachineStatus, preferredLabel: string | null): string {
  if (preferredLabel) {
    const normalizedLabel = preferredLabel.trim().toLowerCase();
    if (status === 'running' && normalizedLabel.includes('op')) {
      return 'Operational';
    }
    if (status === 'needs-repair' && normalizedLabel.includes('repair')) {
      return 'Needs Repair';
    }
    if (status === 'down' && !normalizedLabel.includes('repair') && !normalizedLabel.includes('op')) {
      return 'Down';
    }
  }

  if (status === 'down') {
    return 'Down';
  }
  if (status === 'needs-repair') {
    return 'Needs Repair';
  }
  return 'Operational';
}

function sinceForStatus(status: MachineStatus): string {
  if (status === 'running') {
    return 'No open issues';
  }
  if (status === 'needs-repair') {
    return 'Needs service';
  }
  return 'Needs immediate service';
}

function requireDb(): Firestore | null {
  const client = getFirebaseClient();
  return client.db ?? null;
}

export function useOrganizationMachines(user: User | null, organizationId: string | null): OrganizationMachinesState {
  const db = useMemo(() => requireDb(), []);
  const [state, setState] = useState<OrganizationMachinesState>({
    loading: false,
    machines: [],
    error: null,
  });

  useEffect(() => {
    if (!user || !organizationId) {
      setState({
        loading: false,
        machines: [],
        error: null,
      });
      return undefined;
    }

    if (!db) {
      setState({
        loading: false,
        machines: [],
        error: 'Firestore client is not configured.',
      });
      return undefined;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    let machineDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

    const publishState = () => {
      const machines = machineDocs.map(({ id, data }) => {
        const status = normalizeMachineStatus(asString(data.status));
        const machineNumber = asString(data.machineNumber) ?? asString(data.label) ?? id.toUpperCase();
        const type = asString(data.type) ?? asString(data.category) ?? 'Machine';
        const model = asString(data.model);
        const make = asString(data.make);
        const modelNumber = asString(data.modelNumber);
        const row = model ?? ([make, modelNumber].filter(Boolean).join(' ') || 'Machine details not set');

        return {
          id,
          machineNumber,
          type,
          row,
          make: make ?? undefined,
          modelNumber: modelNumber ?? undefined,
          status,
          statusLabel: labelForStatus(status, asString(data.statusLabel)),
          since: sinceForStatus(status),
        } satisfies UrgentMachine;
      });

      machines.sort((a, b) => a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true, sensitivity: 'base' }));

      setState({
        loading: false,
        machines,
        error: null,
      });
    };

    const machinesRef = collection(db, `organizations/${organizationId}/machines`);

    const unsubscribeMachines = onSnapshot(
      machinesRef,
      (snapshot) => {
        machineDocs = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          data: docSnapshot.data() as Record<string, unknown>,
        }));
        publishState();
      },
      (error) => {
        setState({
          loading: false,
          machines: [],
          error: error.message,
        });
      },
    );

    return () => {
      unsubscribeMachines();
    };
  }, [db, organizationId, user]);

  return state;
}
