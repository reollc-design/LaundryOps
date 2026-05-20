export type ScreenKey =
  | 'welcome'
  | 'sign-in'
  | 'create-account'
  | 'technician-invite'
  | 'owner-onboarding'
  | 'home'
  | 'machines'
  | 'machine-detail'
  | 'manuals'
  | 'account'
  | 'create-work-order'
  | 'work-orders'
  | 'work-order-detail'
  | 'ai-assist'
  | 'reports';
export type MachineStatus = 'running' | 'needs-repair' | 'down' | 'waiting';
export type ManualStatus = 'indexed' | 'processing' | 'missing';
export type WorkOrderStatus = 'open' | 'assigned' | 'in-progress' | 'waiting' | 'completed';
export type WorkOrderPriority = 'High' | 'Standard' | 'Low';

export interface UrgentMachine {
  id: string;
  machineNumber: string;
  type: string;
  row: string;
  status: MachineStatus;
  statusLabel: string;
  since: string;
}

export interface WorkOrderSummary {
  id: string;
  number: string;
  machineNumber: string;
  machineModel: string;
  title: string;
  location: string;
  status: WorkOrderStatus;
  statusLabel: string;
  priority: WorkOrderPriority;
  assignee: string;
  due: string;
  source: 'AI draft' | 'Manual entry' | 'Preventive';
  estimate: string;
}

export interface ReportMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  tone: 'primary' | 'teal' | 'down' | 'waiting';
}

export interface DowntimePoint {
  day: string;
  hours: number;
}

export interface ReportRow {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: 'primary' | 'teal' | 'down' | 'waiting';
}

export interface LocationSummary {
  id: string;
  name: string;
  address: string;
  machines: number;
  openWorkOrders: number;
  status: 'included' | 'add-on' | 'setup';
  planNote: string;
}

export interface AccountStat {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  detail: string;
  icon: 'account' | 'location' | 'machine' | 'team' | 'manual';
}

export interface TrialFeature {
  id: string;
  title: string;
  detail: string;
}

const defaultMachineState: Pick<UrgentMachine, 'status' | 'statusLabel' | 'since'> = {
  status: 'running',
  statusLabel: 'Running',
  since: 'No open issues',
};

const machineStateOverrides: Record<string, Pick<UrgentMachine, 'status' | 'statusLabel' | 'since'>> = {
  W12: {
    status: 'down',
    statusLabel: 'Down',
    since: 'Since 8:15 AM',
  },
  D07: {
    status: 'needs-repair',
    statusLabel: 'Needs Repair',
    since: 'Since 7:40 AM',
  },
  W03: {
    status: 'waiting',
    statusLabel: 'Waiting on Parts',
    since: 'Since yesterday',
  },
};

function makeMachine(machineNumber: string, type: string, row: string): UrgentMachine {
  const state = machineStateOverrides[machineNumber] ?? defaultMachineState;
  return {
    id: machineNumber.toLowerCase(),
    machineNumber,
    type,
    row,
    ...state,
  };
}

export const machineCatalog: UrgentMachine[] = [
  ...Array.from({ length: 30 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const row = `Row ${Math.floor(index / 10) + 1}`;
    return makeMachine(`W${number}`, 'Washer', row);
  }),
  ...Array.from({ length: 20 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const row = `Row ${Math.floor(index / 10) + 1}`;
    return makeMachine(`D${number}`, 'Dryer', row);
  }),
  ...Array.from({ length: 10 }, (_, index) => makeMachine(String(101 + index), 'Combo', `Row ${Math.floor(index / 5) + 4}`)),
];

export const urgentMachines: UrgentMachine[] = [
  {
    id: 'w12',
    machineNumber: 'W12',
    type: 'Washer',
    row: 'Row 2',
    status: 'down',
    statusLabel: 'Down',
    since: 'Since 8:15 AM',
  },
  {
    id: 'd07',
    machineNumber: 'D07',
    type: 'Dryer',
    row: 'Row 1',
    status: 'needs-repair',
    statusLabel: 'Needs Repair',
    since: 'Since 7:40 AM',
  },
  {
    id: 'w03',
    machineNumber: 'W03',
    type: 'Washer',
    row: 'Row 3',
    status: 'waiting',
    statusLabel: 'Waiting on Parts',
    since: 'Since yesterday',
  },
];

export const machineHistory = [
  {
    id: 'mh1',
    title: 'Replaced drain pump',
    meta: 'Apr 22, 2026 / Mike R.',
    cost: '$186.75',
    tone: 'complete',
  },
  {
    id: 'mh2',
    title: 'Cleared coin chute jam',
    meta: 'Apr 14, 2026 / Tom J.',
    cost: '$0.00',
    tone: 'warning',
  },
  {
    id: 'mh3',
    title: 'Routine inspection',
    meta: 'Mar 28, 2026 / Mike R.',
    cost: '$0.00',
    tone: 'complete',
  },
];

export const costRows = [
  ['Drain Pump Assembly', '$142.50'],
  ['Hose Clamp', '$3.25'],
  ['Labor', '$75.00'],
];

export const aiWorkOrderDraft = {
  machineNumber: 'W12',
  machineModel: 'Speed Queen SC40',
  location: 'Main Street / Washer Row 2',
  title: "W12 won't drain after cycle",
  priority: 'High',
  assignee: 'Mike R.',
  due: 'Today, 2:00 PM',
  symptoms: 'Water remains after final spin. Customer reported wet clothes and standing water in drum.',
  errorCode: 'E04',
  diagnosis: 'Drain pump is not clearing water. Inspect pump filter, impeller, and drain hose path first.',
  source: 'Speed Queen SC40 Service Manual',
  sourceDetail: 'p. 42 / Drain Pump Test',
  confidence: 'Medium',
  steps: [
    'Unplug washer and remove lower front panel.',
    'Inspect drain pump filter for debris.',
    'Check impeller for damage and confirm pump spins freely.',
    'Clear obstruction, test drain cycle, and replace pump if failed.',
  ],
  parts: ['Drain Pump Assembly', 'Hose Clamp'],
  estimate: '$220.75',
};

export const workOrderQueue: WorkOrderSummary[] = [
  {
    id: 'wo-1042',
    number: 'WO-1042',
    machineNumber: 'W12',
    machineModel: 'Speed Queen SC40',
    title: "Won't drain after cycle",
    location: 'Main Street / Washer Row 2',
    status: 'in-progress',
    statusLabel: 'In Progress',
    priority: 'High',
    assignee: 'Mike R.',
    due: 'Today, 2:00 PM',
    source: 'AI draft',
    estimate: '$220.75',
  },
  {
    id: 'wo-1043',
    number: 'WO-1043',
    machineNumber: 'D07',
    machineModel: 'Dexter T-50',
    title: 'Dryer overheating',
    location: 'Main Street / Dryer Row 1',
    status: 'open',
    statusLabel: 'Open',
    priority: 'High',
    assignee: 'Unassigned',
    due: 'Today, 4:00 PM',
    source: 'Manual entry',
    estimate: '$95.00',
  },
  {
    id: 'wo-1044',
    number: 'WO-1044',
    machineNumber: 'W03',
    machineModel: 'Speed Queen SC40',
    title: 'Coin chute jam',
    location: 'Main Street / Washer Row 1',
    status: 'waiting',
    statusLabel: 'Waiting Parts',
    priority: 'Standard',
    assignee: 'Tom J.',
    due: 'Tomorrow, 10:00 AM',
    source: 'Manual entry',
    estimate: '$38.50',
  },
  {
    id: 'wo-1045',
    number: 'WO-1045',
    machineNumber: '105',
    machineModel: 'Combo 100 Series',
    title: 'Preventive inspection',
    location: 'Main Street / Combo Row 4',
    status: 'assigned',
    statusLabel: 'Assigned',
    priority: 'Low',
    assignee: 'Mike R.',
    due: 'Wed, 9:00 AM',
    source: 'Preventive',
    estimate: '$0.00',
  },
  {
    id: 'wo-1041',
    number: 'WO-1041',
    machineNumber: 'D02',
    machineModel: 'Dexter T-50',
    title: 'Replace lint screen latch',
    location: 'Main Street / Dryer Row 1',
    status: 'completed',
    statusLabel: 'Completed',
    priority: 'Standard',
    assignee: 'Tom J.',
    due: 'Completed today',
    source: 'Manual entry',
    estimate: '$44.25',
  },
];

export const manualRows = [
  {
    id: 'manual-sc40',
    model: 'Speed Queen SC40',
    title: 'SC40 Service Manual',
    status: 'indexed' as ManualStatus,
    coverage: '30 washers linked',
    pages: '148 pages',
    updated: 'Updated May 12, 2026',
    source: 'Used by W12 Repair Assist',
  },
  {
    id: 'manual-t50',
    model: 'Dexter T-50',
    title: 'T-50 Dryer Service Manual',
    status: 'indexed' as ManualStatus,
    coverage: '20 dryers linked',
    pages: '96 pages',
    updated: 'Updated May 9, 2026',
    source: 'Ready for dryer repairs',
  },
  {
    id: 'manual-combo',
    model: 'Combo 100 Series',
    title: 'Manual needed',
    status: 'missing' as ManualStatus,
    coverage: '10 machines ungrounded',
    pages: 'No PDF uploaded',
    updated: 'Upload before launch',
    source: 'AI will use general guidance until linked',
  },
];

export const reportMetrics: ReportMetric[] = [
  {
    id: 'downtime',
    label: 'Downtime',
    value: '16.2 hrs',
    change: '-18% vs last week',
    tone: 'teal',
  },
  {
    id: 'repair-spend',
    label: 'Repair Spend',
    value: '$1,245',
    change: '+$320 vs April',
    tone: 'down',
  },
  {
    id: 'repeat-failures',
    label: 'Repeat Failures',
    value: '3',
    change: '2 machines need review',
    tone: 'waiting',
  },
  {
    id: 'manual-coverage',
    label: 'Manual Coverage',
    value: '83%',
    change: '50 of 60 machines grounded',
    tone: 'primary',
  },
];

export const downtimeTrend: DowntimePoint[] = [
  { day: 'Mon', hours: 1.8 },
  { day: 'Tue', hours: 3.4 },
  { day: 'Wed', hours: 2.2 },
  { day: 'Thu', hours: 4.1 },
  { day: 'Fri', hours: 2.6 },
  { day: 'Sat', hours: 1.4 },
  { day: 'Sun', hours: 0.7 },
];

export const spendBreakdownRows: ReportRow[] = [
  {
    id: 'parts',
    label: 'Parts',
    value: '$682',
    detail: 'Drain pumps, hose clamps, lint hardware',
    tone: 'down',
  },
  {
    id: 'labor',
    label: 'Labor',
    value: '$425',
    detail: '6.5 technician hours',
    tone: 'primary',
  },
  {
    id: 'preventive',
    label: 'Preventive',
    value: '$138',
    detail: 'Inspections and cleaning',
    tone: 'teal',
  },
];

export const repeatFailureRows: ReportRow[] = [
  {
    id: 'repeat-w12',
    label: 'W12',
    value: '3 issues',
    detail: 'Drain system failures in 45 days',
    tone: 'down',
  },
  {
    id: 'repeat-d07',
    label: 'D07',
    value: '2 issues',
    detail: 'Overheat reports tied to lint path',
    tone: 'waiting',
  },
  {
    id: 'repeat-w03',
    label: 'W03',
    value: '2 issues',
    detail: 'Coin chute jams during peak traffic',
    tone: 'primary',
  },
];

export const technicianLoadRows: ReportRow[] = [
  {
    id: 'tech-mike',
    label: 'Mike R.',
    value: '4 open',
    detail: '2 high priority / 1 waiting part',
    tone: 'down',
  },
  {
    id: 'tech-tom',
    label: 'Tom J.',
    value: '2 open',
    detail: '1 waiting part / 1 standard',
    tone: 'waiting',
  },
  {
    id: 'tech-unassigned',
    label: 'Unassigned',
    value: '1 open',
    detail: 'D07 needs owner assignment',
    tone: 'primary',
  },
];

export const manualCoverageRows: ReportRow[] = [
  {
    id: 'manual-washers',
    label: 'Washers',
    value: '30/30',
    detail: 'Speed Queen SC40 indexed',
    tone: 'teal',
  },
  {
    id: 'manual-dryers',
    label: 'Dryers',
    value: '20/20',
    detail: 'Dexter T-50 indexed',
    tone: 'teal',
  },
  {
    id: 'manual-combos',
    label: 'Combos',
    value: '0/10',
    detail: 'Combo 100 Series manual still needed',
    tone: 'down',
  },
];

export const accountStats: AccountStat[] = [
  {
    id: 'plan',
    label: 'Trial Status',
    value: '14 days',
    detail: 'Pro trial active / ends May 31, 2026',
  },
  {
    id: 'locations',
    label: 'Locations',
    value: '3',
    detail: '1 included / 2 add-on locations staged',
  },
  {
    id: 'users',
    label: 'Users',
    value: '5',
    detail: 'Owner, manager, and technician seats',
  },
  {
    id: 'ai',
    label: 'AI Usage',
    value: '38',
    detail: 'Manual-grounded diagnoses this month',
  },
];

export const locationSummaries: LocationSummary[] = [
  {
    id: 'main-street',
    name: 'Main Street',
    address: 'Daytona Beach, FL',
    machines: 60,
    openWorkOrders: 7,
    status: 'included',
    planNote: 'Included in base subscription',
  },
  {
    id: 'westside',
    name: 'Westside',
    address: 'Ormond Beach, FL',
    machines: 42,
    openWorkOrders: 3,
    status: 'add-on',
    planNote: 'Additional location fee',
  },
  {
    id: 'north-ave',
    name: 'North Ave',
    address: 'Port Orange, FL',
    machines: 36,
    openWorkOrders: 1,
    status: 'setup',
    planNote: 'Setup checklist pending',
  },
];

export const trialFeatures: TrialFeature[] = [
  {
    id: 'work-orders',
    title: 'Professional work orders',
    detail: 'Track repair status, technician assignment, parts, labor, and photos.',
  },
  {
    id: 'manual-ai',
    title: 'Manual-grounded AI',
    detail: 'Upload machine manuals so Repair Assist answers from factual service material.',
  },
  {
    id: 'owner-reports',
    title: 'Owner reports',
    detail: 'See downtime, repair spend, repeat failures, and machines that need attention.',
  },
];

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'account',
    title: 'Create company account',
    detail: 'Sun State Laundry / owner profile',
    icon: 'account',
  },
  {
    id: 'location',
    title: 'Add first location',
    detail: 'Main Street laundromat',
    icon: 'location',
  },
  {
    id: 'machine',
    title: 'Add first machine',
    detail: 'W12 / Speed Queen SC40',
    icon: 'machine',
  },
  {
    id: 'team',
    title: 'Invite technician',
    detail: 'Optional, can be skipped',
    icon: 'team',
  },
  {
    id: 'manual',
    title: 'Upload first manual',
    detail: 'Optional, improves AI answers',
    icon: 'manual',
  },
];
