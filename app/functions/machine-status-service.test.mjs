import assert from 'node:assert/strict';
import { applyMachineStatusTransition } from './lib/machine-status-service.js';

function adapterWith(periods = {}) {
  const writes = { created: [], updatedPeriods: [], updatedMachines: [] };
  return {
    writes,
    adapter: {
      getDowntimePeriod: async (id) => periods[id] ?? null,
      createDowntimePeriod: (id, data) => writes.created.push({ id, data }),
      updateDowntimePeriod: (id, data) => writes.updatedPeriods.push({ id, data }),
      updateMachine: (data) => writes.updatedMachines.push(data),
    },
  };
}

const shared = {
  organizationId: 'orgA', machineId: 'machineA', machineNumber: 'W12', machineModel: 'Speed Queen SC40',
  nowMs: 1_800_000_000_000, timestamp: 'server-timestamp', clearValue: 'delete-marker', updatedBy: 'techA', nextDowntimeId: 'periodA',
};

const opened = adapterWith();
const openResult = await applyMachineStatusTransition({ ...shared, adapter: opened.adapter, currentStatus: 'running', requestedStatus: 'down' });
assert.equal(openResult.action, 'opened');
assert.equal(opened.writes.created.length, 1);
assert.equal(opened.writes.created[0].data.status, 'active');
assert.equal(opened.writes.updatedMachines[0].downSince, 'server-timestamp');
assert.equal(opened.writes.updatedMachines[0].activeDowntimeId, 'periodA');

const repeated = adapterWith();
const repeatResult = await applyMachineStatusTransition({ ...shared, adapter: repeated.adapter, currentStatus: 'down', requestedStatus: 'down', downSinceMs: shared.nowMs, activeDowntimeId: 'periodA' });
assert.equal(repeatResult.action, 'unchanged');
assert.equal(repeated.writes.created.length + repeated.writes.updatedMachines.length, 0, 'repeat Down must make no writes');

const closed = adapterWith({ periodA: { machineId: 'machineA', status: 'active' } });
const closeResult = await applyMachineStatusTransition({ ...shared, adapter: closed.adapter, currentStatus: 'down', requestedStatus: 'running', downSinceMs: shared.nowMs - 3_600_000, activeDowntimeId: 'periodA' });
assert.equal(closeResult.action, 'closed');
assert.equal(closed.writes.updatedPeriods[0].data.durationMs, 3_600_000);
assert.equal(closed.writes.updatedMachines[0].downSince, 'delete-marker');

const wrongMachine = adapterWith({ periodA: { machineId: 'other-machine', status: 'active' } });
await assert.rejects(
  () => applyMachineStatusTransition({ ...shared, adapter: wrongMachine.adapter, currentStatus: 'down', requestedStatus: 'running', downSinceMs: shared.nowMs - 1, activeDowntimeId: 'periodA' }),
  /could not be closed safely/,
);
assert.equal(wrongMachine.writes.updatedMachines.length, 0, 'a mismatched period must not clear the machine markers');

const legacy = adapterWith();
const legacyResult = await applyMachineStatusTransition({ ...shared, adapter: legacy.adapter, currentStatus: 'down', requestedStatus: 'running' });
assert.equal(legacyResult.action, 'status-only');
assert.equal(legacy.writes.updatedPeriods.length, 0);

console.log('5/5 machine status transaction tests passed');
