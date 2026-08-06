export type WorkOrderEditMode = 'full' | 'assigned-status' | 'read-only';

export function getWorkOrderEditMode(input: {
  active: boolean;
  role: string;
  canEditWorkOrder: boolean;
  assignedToCurrentUser: boolean;
}): WorkOrderEditMode {
  if (!input.active) {
    return 'read-only';
  }
  if (input.canEditWorkOrder) {
    return 'full';
  }
  if (input.role === 'technician' && input.assignedToCurrentUser) {
    return 'assigned-status';
  }
  return 'read-only';
}
