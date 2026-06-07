import { collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import type { WorkOrderStatus, WorkOrderSummary } from '../data';
import { getFirebaseClient } from '../firebase/client';

interface OrganizationWorkOrdersState {
  loading: boolean;
  workOrders: WorkOrderSummary[];
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function normalizeWorkOrderStatus(rawStatus: string | null): WorkOrderStatus {
  if (!rawStatus) {
    return 'open';
  }

  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === 'open' || normalized === 'assigned' || normalized === 'in-progress' || normalized === 'waiting' || normalized === 'completed') {
    return normalized;
  }
  if (normalized.includes('progress') || normalized === 'active') {
    return 'in-progress';
  }
  if (normalized.includes('wait') || normalized.includes('part')) {
    return 'waiting';
  }
  if (normalized.includes('complete') || normalized.includes('closed') || normalized.includes('done')) {
    return 'completed';
  }
  return 'open';
}

function statusLabel(status: WorkOrderStatus): string {
  if (status === 'in-progress') {
    return 'In Progress';
  }
  if (status === 'completed') {
    return 'Completed';
  }
  if (status === 'waiting') {
    return 'Waiting Parts';
  }
  if (status === 'assigned') {
    return 'Assigned';
  }
  return 'Open';
}

function normalizePriority(rawPriority: string | null): 'High' | 'Standard' | 'Low' {
  if (!rawPriority) {
    return 'Standard';
  }

  const normalized = rawPriority.trim().toLowerCase();
  if (normalized === 'high' || normalized === 'urgent') {
    return 'High';
  }
  if (normalized === 'low') {
    return 'Low';
  }
  return 'Standard';
}

function displayDue(rawDue: string | null): string {
  if (!rawDue) {
    return 'Not scheduled';
  }
  return rawDue;
}

function requireDb(): Firestore | null {
  const client = getFirebaseClient();
  return client.db ?? null;
}

export function useOrganizationWorkOrders(user: User | null, organizationId: string | null): OrganizationWorkOrdersState {
  const db = useMemo(() => requireDb(), []);
  const [state, setState] = useState<OrganizationWorkOrdersState>({
    loading: false,
    workOrders: [],
    error: null,
  });

  useEffect(() => {
    if (!user || !organizationId) {
      setState({
        loading: false,
        workOrders: [],
        error: null,
      });
      return undefined;
    }

    if (!db) {
      setState({
        loading: false,
        workOrders: [],
        error: 'Firestore client is not configured.',
      });
      return undefined;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    let locationNames: Record<string, string> = {};
    let machineLookup: Record<string, { machineNumber: string; machineModel: string; locationId: string | null }> = {};
    let workOrderDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

    const publishState = () => {
      const workOrders = workOrderDocs
        .map(({ id, data }) => {
          const status = normalizeWorkOrderStatus(asString(data.status));
          const priority = normalizePriority(asString(data.priority));
          const locationId = asString(data.locationId);
          const machineId = asString(data.machineId);
          const machineFromLookup = machineId ? machineLookup[machineId] : undefined;
          const machineNumber =
            asString(data.machineNumber) ??
            (machineFromLookup ? machineFromLookup.machineNumber : null) ??
            'Unknown';
          const machineModel =
            asString(data.machineModel) ??
            (machineFromLookup ? machineFromLookup.machineModel : null) ??
            'Model not set';
          const locationName =
            asString(data.locationName) ??
            (locationId ? locationNames[locationId] : null) ??
            (machineFromLookup?.locationId ? locationNames[machineFromLookup.locationId] : null) ??
            'Location not set';
          const partsCostValue = asNumber(data.partsCost) ?? 0;
          const laborCostValue = asNumber(data.laborCost) ?? 0;
          const partsCost = formatUsd(partsCostValue);
          const laborCost = formatUsd(laborCostValue);
          const totalCost = formatUsd(partsCostValue + laborCostValue);

          return {
            id,
            number: asString(data.number) ?? id.toUpperCase(),
            machineId,
            machineNumber,
            machineModel,
            title: asString(data.title) ?? 'Work order',
            location: locationName,
            status,
            statusLabel: asString(data.statusLabel) ?? statusLabel(status),
            priority,
            assignee: asString(data.assigneeName) ?? asString(data.assignedUserId) ?? 'Unassigned',
            due: displayDue(asString(data.dueLabel) ?? asString(data.due)),
            source: (asString(data.source) === 'AI draft' || asString(data.source) === 'Preventive') ? (asString(data.source) as 'AI draft' | 'Preventive') : 'Manual entry',
            partsCost,
            laborCost,
            estimate: asString(data.estimate) ?? totalCost,
          } satisfies WorkOrderSummary;
        })
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }));

      setState({
        loading: false,
        workOrders,
        error: null,
      });
    };

    const locationsRef = collection(db, `organizations/${organizationId}/locations`);
    const machinesRef = collection(db, `organizations/${organizationId}/machines`);
    const workOrdersRef = collection(db, `organizations/${organizationId}/workOrders`);

    const unsubscribeLocations = onSnapshot(
      locationsRef,
      (snapshot) => {
        locationNames = snapshot.docs.reduce<Record<string, string>>((accumulator, docSnapshot) => {
          const name = asString(docSnapshot.data().name) ?? docSnapshot.id;
          accumulator[docSnapshot.id] = name;
          return accumulator;
        }, {});
        publishState();
      },
      (error) => {
        setState({
          loading: false,
          workOrders: [],
          error: error.message,
        });
      },
    );

    const unsubscribeMachines = onSnapshot(
      machinesRef,
      (snapshot) => {
        machineLookup = snapshot.docs.reduce<Record<string, { machineNumber: string; machineModel: string; locationId: string | null }>>(
          (accumulator, docSnapshot) => {
            const data = docSnapshot.data();
            accumulator[docSnapshot.id] = {
              machineNumber: asString(data.machineNumber) ?? asString(data.label) ?? docSnapshot.id.toUpperCase(),
              machineModel: asString(data.model) ?? 'Model not set',
              locationId: asString(data.locationId),
            };
            return accumulator;
          },
          {},
        );
        publishState();
      },
      (error) => {
        setState({
          loading: false,
          workOrders: [],
          error: error.message,
        });
      },
    );

    const unsubscribeWorkOrders = onSnapshot(
      workOrdersRef,
      (snapshot) => {
        workOrderDocs = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          data: docSnapshot.data() as Record<string, unknown>,
        }));
        publishState();
      },
      (error) => {
        setState({
          loading: false,
          workOrders: [],
          error: error.message,
        });
      },
    );

    return () => {
      unsubscribeLocations();
      unsubscribeMachines();
      unsubscribeWorkOrders();
    };
  }, [db, organizationId, user]);

  return state;
}
