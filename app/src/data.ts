export type ScreenKey =
  | 'welcome'
  | 'sign-in'
  | 'create-account'
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
export type WorkOrderStatus = 'planned' | 'open' | 'assigned' | 'in-progress' | 'waiting' | 'completed';
export type WorkOrderPriority = 'High' | 'Standard' | 'Low';

export interface UrgentMachine {
  id: string;
  machineNumber: string;
  type: string;
  row: string;
  make?: string;
  modelNumber?: string;
  status: MachineStatus;
  statusLabel: string;
  since: string;
}

export interface WorkOrderSummary {
  id: string;
  createdAtEpoch?: number;
  maintenanceDate?: string;
  maintenanceDateEpoch?: number;
  number: string;
  machineId?: string | null;
  machineNumber: string;
  machineModel: string;
  title: string;
  status: WorkOrderStatus;
  statusLabel: string;
  priority: WorkOrderPriority;
  assignee: string;
  due: string;
  source: 'AI draft' | 'Manual entry' | 'Preventive';
  partsCost?: string;
  laborCost?: string;
  otherCost?: string;
  estimate: string;
  maintenanceType?: string;
  repairType?: string;
  symptoms?: string;
  errorCode?: string;
  notes?: string;
  aiDiagnosis?: string;
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
  icon: 'account' | 'location' | 'machine' | 'manual';
}

export interface TrialFeature {
  id: string;
  title: string;
  detail: string;
}

export const machineCatalog: UrgentMachine[] = [];

export const urgentMachines: UrgentMachine[] = [];

export const machineHistory: Array<{
  id: string;
  title: string;
  meta: string;
  cost: string;
  tone: string;
}> = [];

export const costRows: Array<[string, string]> = [];

export const aiWorkOrderDraft = {
  machineNumber: 'Machine',
  machineModel: 'Model not set',
  title: 'New maintenance issue',
  priority: 'High',
  assignee: 'Unassigned',
  due: 'Next available slot',
  symptoms: 'Enter machine symptoms to generate grounded guidance.',
  errorCode: 'Not provided',
  diagnosis: 'Diagnosis appears here after AI Repair Assist runs with your manual data.',
  source: 'Manual source pending',
  sourceDetail: 'Upload and index a manual to ground this maintenance record.',
  confidence: 'Medium',
  steps: [
    'Capture symptoms and any error code.',
    'Run AI Repair Assist with manual grounding enabled.',
    'Review recommended repair steps with the assigned technician.',
    'Enter parts and labor before creating the maintenance record.',
  ],
  parts: [] as string[],
  estimate: '$0.00',
  partsCost: '$0.00',
  laborCost: '$0.00',
};

export const workOrderQueue: WorkOrderSummary[] = [];

export const manualRows: Array<{
  id: string;
  model: string;
  title: string;
  status: ManualStatus;
  coverage: string;
  pages: string;
  updated: string;
  source: string;
}> = [];

export const reportMetrics: ReportMetric[] = [];

export const downtimeTrend: DowntimePoint[] = [];

export const spendBreakdownRows: ReportRow[] = [];

export const repeatFailureRows: ReportRow[] = [];

export const technicianLoadRows: ReportRow[] = [];

export const manualCoverageRows: ReportRow[] = [];

export const accountStats: AccountStat[] = [];

export const trialFeatures: TrialFeature[] = [
  {
    id: 'work-orders',
    title: 'Professional maintenance records',
    detail: 'Track repair status, assignee, parts, labor, and photos.',
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
    detail: 'Business name / operator / address / email',
    icon: 'account',
  },
  {
    id: 'location',
    title: 'Add first location',
    detail: 'Location name / location address',
    icon: 'location',
  },
  {
    id: 'machine',
    title: 'Add first machine',
    detail: 'Machine number / type / make / model number',
    icon: 'machine',
  },
];
