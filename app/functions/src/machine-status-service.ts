import {
  machineStatusLabel,
  planMachineStatusTransition,
  type MachineOperationalStatus,
} from './downtime.js';

export interface MachineStatusPersistenceAdapter {
  getDowntimePeriod(periodId: string): Promise<Record<string, unknown> | null>;
  createDowntimePeriod(periodId: string, data: Record<string, unknown>): void;
  updateDowntimePeriod(periodId: string, data: Record<string, unknown>): void;
  updateMachine(data: Record<string, unknown>): void;
}

export async function applyMachineStatusTransition(params: {
  adapter: MachineStatusPersistenceAdapter;
  organizationId: string;
  machineId: string;
  machineNumber: string;
  machineModel: string;
  locationId?: string;
  currentStatus: MachineOperationalStatus;
  requestedStatus: MachineOperationalStatus;
  downSinceMs?: number;
  activeDowntimeId?: string;
  nowMs: number;
  timestamp: unknown;
  clearValue: unknown;
  updatedBy: string;
  nextDowntimeId: string;
}): Promise<{ action: 'opened' | 'closed' | 'status-only' | 'unchanged'; activeDowntimeId?: string }> {
  const transition = planMachineStatusTransition({
    requestedStatus: params.requestedStatus,
    currentStatus: params.currentStatus,
    downSinceMs: params.downSinceMs,
    activeDowntimeId: params.activeDowntimeId,
    nowMs: params.nowMs,
    nextDowntimeId: params.nextDowntimeId,
    machineId: params.machineId,
    machineNumber: params.machineNumber,
    machineModel: params.machineModel,
    locationId: params.locationId,
  });
  if (transition.action === 'unchanged') {
    return { action: transition.action, activeDowntimeId: transition.activeDowntimeId };
  }

  const machineUpdate = {
    status: transition.nextStatus,
    statusLabel: machineStatusLabel(transition.nextStatus),
    updatedAt: params.timestamp,
    updatedBy: params.updatedBy,
  };

  if (transition.action === 'opened' && transition.period) {
    params.adapter.createDowntimePeriod(transition.period.id, {
      organizationId: params.organizationId,
      machineId: transition.period.machineId,
      machineNumber: transition.period.machineNumber,
      machineModel: transition.period.machineModel,
      ...(transition.period.locationId ? { locationId: transition.period.locationId } : {}),
      status: 'active',
      startedAt: params.timestamp,
      createdAt: params.timestamp,
      createdBy: params.updatedBy,
      updatedAt: params.timestamp,
      updatedBy: params.updatedBy,
    });
    params.adapter.updateMachine({ ...machineUpdate, downSince: params.timestamp, activeDowntimeId: transition.period.id });
    return { action: transition.action, activeDowntimeId: transition.period.id };
  }

  if (transition.action === 'closed' && transition.downSinceMs && transition.activeDowntimeId) {
    const period = await params.adapter.getDowntimePeriod(transition.activeDowntimeId);
    if (!period || period.status !== 'active' || period.machineId !== params.machineId) {
      throw new Error('The active downtime record could not be closed safely. Keep the machine Down and try again.');
    }
    params.adapter.updateDowntimePeriod(transition.activeDowntimeId, {
      status: 'completed',
      endedAt: params.timestamp,
      durationMs: Math.max(0, params.nowMs - transition.downSinceMs),
      updatedAt: params.timestamp,
      updatedBy: params.updatedBy,
    });
    params.adapter.updateMachine({ ...machineUpdate, downSince: params.clearValue, activeDowntimeId: params.clearValue });
    return { action: transition.action, activeDowntimeId: transition.activeDowntimeId };
  }

  params.adapter.updateMachine(machineUpdate);
  return { action: transition.action };
}
