export type MachineOperationalStatus = 'running' | 'needs-repair' | 'down';

export interface StoredDowntimePeriod {
  id: string;
  machineId: string;
  machineNumber: string;
  machineModel: string;
  locationId?: string;
  startedAtMs: number;
  endedAtMs?: number;
  status: 'active' | 'completed';
}

export interface MachineStatusTransitionResult {
  action: 'opened' | 'closed' | 'status-only' | 'unchanged';
  nextStatus: MachineOperationalStatus;
  nextStatusLabel: string;
  downSinceMs?: number;
  activeDowntimeId?: string;
  period?: StoredDowntimePeriod;
}

export function machineStatusLabel(status: MachineOperationalStatus): string {
  if (status === 'down') return 'Down';
  if (status === 'needs-repair') return 'Needs Repair';
  return 'Operational';
}

export function planMachineStatusTransition(params: {
  requestedStatus: MachineOperationalStatus;
  currentStatus: MachineOperationalStatus;
  downSinceMs?: number;
  activeDowntimeId?: string;
  nowMs: number;
  nextDowntimeId: string;
  machineId: string;
  machineNumber: string;
  machineModel: string;
  locationId?: string;
}): MachineStatusTransitionResult {
  const label = machineStatusLabel(params.requestedStatus);

  if (params.requestedStatus === 'down') {
    if (params.currentStatus === 'down' && params.downSinceMs && params.activeDowntimeId) {
      return { action: 'unchanged', nextStatus: 'down', nextStatusLabel: label, downSinceMs: params.downSinceMs, activeDowntimeId: params.activeDowntimeId };
    }
    if (params.currentStatus === 'down' && !params.downSinceMs && !params.activeDowntimeId) {
      return { action: 'unchanged', nextStatus: 'down', nextStatusLabel: label };
    }
    if (params.currentStatus === 'down') {
      throw new Error('This machine has incomplete downtime tracking data. Keep it Down and contact support before changing its status.');
    }

    return {
      action: 'opened',
      nextStatus: 'down',
      nextStatusLabel: label,
      downSinceMs: params.nowMs,
      activeDowntimeId: params.nextDowntimeId,
      period: {
        id: params.nextDowntimeId,
        machineId: params.machineId,
        machineNumber: params.machineNumber,
        machineModel: params.machineModel,
        ...(params.locationId ? { locationId: params.locationId } : {}),
        startedAtMs: params.nowMs,
        status: 'active',
      },
    };
  }

  if (params.currentStatus !== 'down') {
    return params.currentStatus === params.requestedStatus
      ? { action: 'unchanged', nextStatus: params.requestedStatus, nextStatusLabel: label }
      : { action: 'status-only', nextStatus: params.requestedStatus, nextStatusLabel: label };
  }

  // Machines marked Down before this feature have no truthful start time. Let them
  // return to service without manufacturing an outage record.
  if (!params.downSinceMs && !params.activeDowntimeId) {
    return { action: 'status-only', nextStatus: params.requestedStatus, nextStatusLabel: label };
  }

  if (!params.downSinceMs || !params.activeDowntimeId) {
    throw new Error('This machine has incomplete downtime tracking data. Keep it Down and contact support before changing its status.');
  }

  return {
    action: 'closed',
    nextStatus: params.requestedStatus,
    nextStatusLabel: label,
    downSinceMs: params.downSinceMs,
    activeDowntimeId: params.activeDowntimeId,
  };
}
