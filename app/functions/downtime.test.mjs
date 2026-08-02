import assert from 'node:assert/strict';
import { planMachineStatusTransition } from './src/downtime.ts';

const common = {
  nowMs: 1_800_000_000_000,
  nextDowntimeId: 'periodA',
  machineId: 'machineA',
  machineNumber: 'W12',
  machineModel: 'Speed Queen SC40',
};

const opened = planMachineStatusTransition({ ...common, currentStatus: 'running', requestedStatus: 'down' });
assert.equal(opened.action, 'opened');
assert.equal(opened.downSinceMs, common.nowMs);
assert.equal(opened.activeDowntimeId, 'periodA');
assert.deepEqual(opened.period, {
  id: 'periodA',
  machineId: 'machineA',
  machineNumber: 'W12',
  machineModel: 'Speed Queen SC40',
  startedAtMs: common.nowMs,
  status: 'active',
});

const repeatedDown = planMachineStatusTransition({
  ...common,
  nowMs: common.nowMs + 60_000,
  currentStatus: 'down',
  requestedStatus: 'down',
  downSinceMs: common.nowMs,
  activeDowntimeId: 'periodA',
});
assert.equal(repeatedDown.action, 'unchanged');
assert.equal(repeatedDown.downSinceMs, common.nowMs, 'a second Down click must preserve the original start');

const needsRepair = planMachineStatusTransition({ ...common, currentStatus: 'running', requestedStatus: 'needs-repair' });
assert.equal(needsRepair.action, 'status-only');
assert.equal(needsRepair.period, undefined, 'Needs Repair must not create downtime');

const closed = planMachineStatusTransition({
  ...common,
  currentStatus: 'down',
  requestedStatus: 'running',
  downSinceMs: common.nowMs,
  activeDowntimeId: 'periodA',
});
assert.equal(closed.action, 'closed');
assert.equal(closed.activeDowntimeId, 'periodA');

const legacyDown = planMachineStatusTransition({ ...common, currentStatus: 'down', requestedStatus: 'running' });
assert.equal(legacyDown.action, 'status-only', 'an older untracked Down machine must be able to return to service');

const repeatedLegacyDown = planMachineStatusTransition({ ...common, currentStatus: 'down', requestedStatus: 'down' });
assert.equal(repeatedLegacyDown.action, 'unchanged', 'an older untracked Down machine must not invent a new outage');

assert.throws(
  () => planMachineStatusTransition({ ...common, currentStatus: 'down', requestedStatus: 'running', downSinceMs: common.nowMs }),
  /incomplete downtime tracking data/,
);

console.log('7/7 downtime transition tests passed');
