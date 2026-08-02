import assert from 'node:assert/strict';
import { buildDowntimeTrend, getDowntimeReportRange, overlappingDowntimeMs, totalDowntimeHours } from './downtime.ts';

const now = new Date(2026, 6, 15, 12, 0, 0).getTime();
const localMonthStart = new Date(2026, 6, 1).getTime();
const crossBoundary = {
  id: 'period-1', machineId: 'machine-1', machineNumber: 'W01', machineModel: 'Speed Queen SC40', status: 'completed',
  startedAtMs: new Date(2026, 5, 30, 20, 0, 0).getTime(),
  endedAtMs: new Date(2026, 6, 2, 4, 0, 0).getTime(),
};
const activePeriod = {
  id: 'period-2', machineId: 'machine-2', machineNumber: 'D02', machineModel: 'Huebsch HX12', status: 'active',
  startedAtMs: new Date(2026, 6, 14, 12, 0, 0).getTime(),
};

assert.equal(overlappingDowntimeMs(crossBoundary, localMonthStart, now, now), 28 * 60 * 60 * 1000, 'only the July portion belongs in July');
assert.equal(totalDowntimeHours([crossBoundary], 'This Month', now), 28);
assert.equal(totalDowntimeHours([activePeriod], 'This Week', now), 24, 'active downtime is calculated dynamically without a database write');

const trend = buildDowntimeTrend([crossBoundary, activePeriod], 'This Week', now);
assert.equal(trend.length, 8);
assert.equal(trend.reduce((sum, point) => sum + point.hours, 0), 24, 'one active outage must be allocated once across weekly buckets');

const monthRange = getDowntimeReportRange('This Month', now);
assert.equal(monthRange.startMs, localMonthStart);

const ninetyDayRange = getDowntimeReportRange('90 Days', now);
const ninetyDayBoundary = {
  id: 'period-3', machineId: 'machine-3', machineNumber: 'W03', machineModel: 'Speed Queen SC30', status: 'completed',
  startedAtMs: ninetyDayRange.startMs - 10 * 60 * 60 * 1000,
  endedAtMs: ninetyDayRange.startMs + 14 * 60 * 60 * 1000,
};
const ninetyDayTrend = buildDowntimeTrend([ninetyDayBoundary], '90 Days', now);
assert.equal(ninetyDayTrend[0].startMs, ninetyDayRange.startMs, 'the first 90-day chart bucket must include the partial opening month');
assert.equal(totalDowntimeHours([ninetyDayBoundary], '90 Days', now), 14);
assert.equal(ninetyDayTrend.reduce((sum, point) => sum + point.hours, 0), 14, '90-day chart buckets must cover the same range as the total');

console.log('8/8 downtime reporting tests passed');
