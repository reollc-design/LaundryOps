import assert from 'node:assert/strict';
import { getWorkOrderEditMode } from './workOrderFlow.ts';

assert.equal(getWorkOrderEditMode({
  active: true,
  role: 'technician',
  canEditWorkOrder: false,
  assignedToCurrentUser: true,
}), 'assigned-status', 'an assigned active technician must receive the status-only workflow');

assert.equal(getWorkOrderEditMode({
  active: true,
  role: 'technician',
  canEditWorkOrder: false,
  assignedToCurrentUser: false,
}), 'read-only', 'an unassigned technician must not receive a status control');

assert.equal(getWorkOrderEditMode({
  active: true,
  role: 'manager',
  canEditWorkOrder: true,
  assignedToCurrentUser: false,
}), 'full', 'operations managers retain full work-order editing');

assert.equal(getWorkOrderEditMode({
  active: false,
  role: 'technician',
  canEditWorkOrder: false,
  assignedToCurrentUser: true,
}), 'read-only', 'inactive memberships cannot update assigned work orders');

console.log('4/4 STG-014 work-order flow regression tests passed');
