export interface DowntimePeriod {
  id: string;
  machineId: string;
  machineNumber: string;
  machineModel: string;
  locationId?: string;
  startedAtMs: number;
  endedAtMs?: number;
  status: 'active' | 'completed';
}

export interface DowntimeTrendPoint {
  label: string;
  hours: number;
  startMs: number;
  endMs: number;
}

export type DowntimeReportPeriod = 'This Week' | 'This Month' | '90 Days';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function localDayStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function localMonthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

export function getDowntimeReportRange(period: DowntimeReportPeriod, nowMs: number): { startMs: number; endMs: number } {
  const now = new Date(nowMs);
  if (period === 'This Week') {
    return { startMs: addDays(localDayStart(now), -7).getTime(), endMs: nowMs };
  }
  if (period === 'This Month') {
    return { startMs: localMonthStart(now).getTime(), endMs: nowMs };
  }
  return { startMs: addDays(localDayStart(now), -90).getTime(), endMs: nowMs };
}

export function overlappingDowntimeMs(period: DowntimePeriod, startMs: number, endMs: number, nowMs: number): number {
  const outageEnd = period.endedAtMs ?? nowMs;
  const overlapStart = Math.max(period.startedAtMs, startMs);
  const overlapEnd = Math.min(outageEnd, endMs);
  return Math.max(0, overlapEnd - overlapStart);
}

function labelsForPeriod(period: DowntimeReportPeriod, nowMs: number): Array<{ label: string; startMs: number; endMs: number }> {
  const range = getDowntimeReportRange(period, nowMs);
  const now = new Date(nowMs);
  if (period === 'This Week') {
    return Array.from({ length: 8 }, (_, index) => {
      const start = addDays(localDayStart(now), index - 7);
      const end = index === 7 ? new Date(nowMs) : addDays(start, 1);
      return { label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(start), startMs: start.getTime(), endMs: end.getTime() };
    });
  }
  if (period === 'This Month') {
    const points: Array<{ label: string; startMs: number; endMs: number }> = [];
    let start = localMonthStart(now);
    let weekNumber = 1;
    while (start.getTime() < nowMs) {
      const next = addDays(start, 7);
      points.push({ label: `W${weekNumber}`, startMs: start.getTime(), endMs: Math.min(next.getTime(), nowMs) });
      start = next;
      weekNumber += 1;
    }
    return points;
  }
  const points: Array<{ label: string; startMs: number; endMs: number }> = [];
  let start = localMonthStart(new Date(range.startMs));
  while (start.getTime() < nowMs) {
    const next = localMonthStart(addMonths(start, 1));
    const startMs = Math.max(start.getTime(), range.startMs);
    const endMs = Math.min(next.getTime(), nowMs);
    if (endMs > startMs) {
      points.push({ label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(start), startMs, endMs });
    }
    start = next;
  }
  return points;
}

export function buildDowntimeTrend(periods: DowntimePeriod[], reportPeriod: DowntimeReportPeriod, nowMs: number): DowntimeTrendPoint[] {
  return labelsForPeriod(reportPeriod, nowMs).map((point) => ({
    ...point,
    hours: Math.round((periods.reduce((total, outage) => total + overlappingDowntimeMs(outage, point.startMs, point.endMs, nowMs), 0) / HOUR_MS) * 10) / 10,
  }));
}

export function totalDowntimeHours(periods: DowntimePeriod[], reportPeriod: DowntimeReportPeriod, nowMs: number): number {
  const range = getDowntimeReportRange(reportPeriod, nowMs);
  return Math.round((periods.reduce((total, outage) => total + overlappingDowntimeMs(outage, range.startMs, range.endMs, nowMs), 0) / HOUR_MS) * 10) / 10;
}
