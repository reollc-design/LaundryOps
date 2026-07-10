import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  BookOpen,
  Camera,
  CalendarClock,
  Check,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Filter,
  FileText,
  FileUp,
  Home,
  Hourglass,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';
import {
  accountStats,
  aiWorkOrderDraft,
  downtimeTrend,
  machineCatalog,
  machineHistory,
  manualCoverageRows,
  manualRows,
  onboardingSteps,
  repeatFailureRows,
  reportMetrics,
  spendBreakdownRows,
  technicianLoadRows,
  trialFeatures,
  urgentMachines,
  workOrderQueue,
} from './data';
import type { AccountStat, MachineStatus, ManualStatus, OnboardingStep, ReportMetric, ReportRow, ScreenKey, UrgentMachine, WorkOrderPriority, WorkOrderStatus, WorkOrderSummary } from './data';
import washerImage from './assets/washer.png';
import { useAuthSession } from './hooks/useAuthSession';
import {
  completeGoogleSignInRedirect,
  completeOwnerOnboarding,
  createOwnerAccount,
  signInWithEmail,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signOutCurrentUser,
  type OwnerOnboardingDraft,
} from './firebase/auth';
import { openStripeBillingPortal, startStripeCheckout, type BillingPlanKey } from './firebase/billing';
import { deleteOrganizationManual, generateManualRepairAssist, reindexOrganizationManuals, uploadManualAndIndex } from './firebase/manuals';
import { createMachine, deleteMachine as deleteMachineRecord, updateMachine, updateMachineStatus, type MachineOperationalStatus } from './firebase/machines';
import { createWorkOrderFromDraft, deleteWorkOrder, updateWorkOrderDetails } from './firebase/workOrders';
import { useUserProfile } from './hooks/useUserProfile';
import { useOrganizationTrial, type OrganizationTrialState } from './hooks/useOrganizationTrial';
import { useOrganizationMachines } from './hooks/useOrganizationMachines';
import { useOrganizationManuals, type ManualLibraryRow } from './hooks/useOrganizationManuals';
import { useOrganizationWorkOrders } from './hooks/useOrganizationWorkOrders';

type TabKey = Extract<ScreenKey, 'home' | 'machines' | 'work-orders' | 'ai-assist' | 'reports'>;
type MachineFilter = 'all' | MachineOperationalStatus;
type WorkOrderStatusFilter = 'all' | 'planned' | 'in-progress' | 'completed';
type WorkOrderPriorityFilter = 'all' | WorkOrderPriority;
type BillingAction = 'checkout' | 'portal';
type AssistPreset = {
  machineId: string;
  machineNumber: string;
  machineModel: string;
};

const billingPlans: {
  key: BillingPlanKey;
  name: string;
  price: string;
  cadence: string;
  detail: string;
  recommended?: boolean;
}[] = [
  {
    key: 'annual',
    name: 'Annual',
    price: '$149.99',
    cadence: '/ year',
    detail: 'Best value - save $29.89 per year',
    recommended: true,
  },
  {
    key: 'monthly',
    name: 'Monthly',
    price: '$14.99',
    cadence: '/ month',
    detail: 'Billed monthly after trial',
  },
];

const navItems: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'machines', label: 'Machines', icon: Camera },
  { key: 'work-orders', label: 'Maintenance Records', icon: ClipboardList },
  { key: 'ai-assist', label: 'AI Assist', icon: Sparkles },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

const screenTitles: Record<ScreenKey, string> = {
  welcome: 'LaundryOps',
  'sign-in': 'Sign In',
  'create-account': 'Create Account',
  'owner-onboarding': 'Start Trial',
  home: 'LaundryOps',
  machines: 'Machines',
  'machine-detail': 'Machine Detail',
  manuals: 'Manual Library',
  account: 'Account',
  'create-work-order': 'New Maintenance Record',
  'work-orders': 'Maintenance Records',
  'work-order-detail': 'Maintenance Record',
  'ai-assist': 'Repair Assist',
  reports: 'Reports',
};

const machineFilters: { key: MachineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Operational' },
  { key: 'needs-repair', label: 'Needs Repair' },
  { key: 'down', label: 'Down' },
];

const workOrderStatusFilters: { key: WorkOrderStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'planned', label: 'Planned' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const workOrderPriorityFilters: { key: WorkOrderPriorityFilter; label: string }[] = [
  { key: 'all', label: 'All Priority' },
  { key: 'High', label: 'High' },
  { key: 'Standard', label: 'Standard' },
  { key: 'Low', label: 'Low' },
];

const reportPeriods = ['This Week', 'This Month', '90 Days'];

function dateOnlyUtcEpoch(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getReportPeriodCutoff(period: string, now = Date.now()): number | null {
  const current = new Date(now);

  if (period === 'This Week') {
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() - 7);
    return dateOnlyUtcEpoch(weekStart);
  }

  if (period === 'This Month') {
    return Date.UTC(current.getFullYear(), current.getMonth(), 1);
  }

  if (period === '90 Days') {
    const ninetyDayStart = new Date(current);
    ninetyDayStart.setDate(current.getDate() - 90);
    return dateOnlyUtcEpoch(ninetyDayStart);
  }

  return null;
}

function formatTrialDate(milliseconds: number | null): string {
  if (milliseconds === null) {
    return 'Not available';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(milliseconds));
}

function trialDaysRemaining(milliseconds: number | null): number {
  if (milliseconds === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((milliseconds - Date.now()) / (24 * 60 * 60 * 1000)));
}

function getInitialScreen(): ScreenKey {
  const requestedScreen = new URLSearchParams(window.location.search).get('screen');
  return requestedScreen && requestedScreen in screenTitles ? (requestedScreen as ScreenKey) : 'welcome';
}

const protectedScreens: ScreenKey[] = [
  'home',
  'machines',
  'machine-detail',
  'manuals',
  'account',
  'create-work-order',
  'work-orders',
  'work-order-detail',
  'ai-assist',
  'reports',
];

const accountSetupScreens: ScreenKey[] = [
  'welcome',
  'sign-in',
  'create-account',
  'owner-onboarding',
];

function getAuthErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'Authentication failed. Try again.';
  }

  const maybeError = error as { code?: string; message?: string };
  const code = maybeError.code ?? '';

  if (code === 'auth/invalid-email') {
    return 'Email format is not valid.';
  }
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/wrong-password') {
    return 'Password is incorrect.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'That email is already in use.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Use at least 6 characters.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network issue. Check connection and retry.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was closed before it finished.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google sign-in window. Allow popups for LaundryOps and try again.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email already has an account. Sign in with your email and password first.';
  }
  if (code === 'auth/redirect-cancelled-by-user') {
    return 'Google redirect sign-in was canceled.';
  }

  return maybeError.message ?? 'Authentication failed. Try again.';
}

function shouldFallbackToGoogleRedirect(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { message?: string };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }
  }

  return fallback;
}

function findMachines(query: string, machines: UrgentMachine[]) {
  const normalizedQuery = query.trim().toLowerCase();
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]+/g, '');
  const letteredQueryNumber = /^[a-z]+\d+$/.test(compactQuery)
    ? compactQuery.replace(/^[a-z]+0*/, '')
    : '';
  const singleLetterQuery = /^[a-z]$/.test(compactQuery) ? compactQuery : '';
  if (!normalizedQuery) {
    return machines;
  }

  return machines.filter((machine) => {
    const machineId = machine.machineNumber.toLowerCase();
    const numericId = machineId.replace(/^[a-z]+0*/, '');
    const type = machine.type.trim().toLowerCase();
    const typeInitial = type[0] ?? '';
    const compactMachineId = machineId.replace(/[^a-z0-9]+/g, '');
    const compactNumericId = numericId.replace(/[^a-z0-9]+/g, '');
    const searchableTokens = [
      machineId,
      compactMachineId,
      numericId,
      compactNumericId,
      type,
      machine.make ?? '',
      machine.modelNumber ?? '',
      machine.statusLabel,
      machine.status,
    ]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    if (singleLetterQuery.length > 0) {
      return (
        compactMachineId.startsWith(singleLetterQuery)
        || searchableTokens.some((token) => token === singleLetterQuery)
      );
    }

    const letteredAliases = compactNumericId
      ? [
        `${typeInitial}${compactNumericId}`,
        `${type} ${numericId}`,
        `${type}${compactNumericId}`,
      ]
      : [];
    const searchableText = [
      machineId,
      numericId,
      compactMachineId,
      machine.type,
      ...letteredAliases,
      machine.make ?? '',
      machine.modelNumber ?? '',
      machine.statusLabel,
      machine.status,
    ]
      .join(' ')
      .toLowerCase();

    return (
      searchableText.includes(normalizedQuery)
      || searchableText.replace(/[^a-z0-9]+/g, '').includes(compactQuery)
      || (letteredQueryNumber.length > 0 && compactNumericId === letteredQueryNumber)
    );
  });
}

function machineStatusLabel(status: MachineOperationalStatus): string {
  if (status === 'down') {
    return 'Down';
  }
  if (status === 'needs-repair') {
    return 'Needs Repair';
  }
  return 'Operational';
}

function machineStatusSince(status: MachineOperationalStatus): string {
  if (status === 'down') {
    return 'Out of service';
  }
  if (status === 'needs-repair') {
    return 'Open maintenance record';
  }
  return 'No open issues';
}

function toOperationalStatus(status: MachineStatus): MachineOperationalStatus {
  if (status === 'down') {
    return 'down';
  }
  if (status === 'waiting') {
    return 'down';
  }
  if (status === 'needs-repair') {
    return 'needs-repair';
  }
  return 'running';
}

function applyStatusOverrides(
  machines: UrgentMachine[],
  overrides: Record<string, MachineOperationalStatus>,
): UrgentMachine[] {
  return machines.map((machine) => {
    const override = overrides[machine.id];
    if (!override) {
      return machine;
    }
    return {
      ...machine,
      status: override,
      statusLabel: machineStatusLabel(override),
      since: machineStatusSince(override),
    };
  });
}

function machineStatusCounts(machines: UrgentMachine[]): {
  total: number;
  operational: number;
  repair: number;
  down: number;
} {
  let operational = 0;
  let repair = 0;
  let down = 0;

  for (const machine of machines) {
    const status = toOperationalStatus(machine.status);
    if (status === 'running') {
      operational += 1;
      continue;
    }
    if (status === 'needs-repair') {
      repair += 1;
      continue;
    }
    down += 1;
  }

  return {
    total: machines.length,
    operational,
    repair,
    down,
  };
}

interface WorkOrderCostEntry {
  maintenanceDate: string;
  machineId?: string | null;
  status: 'planned' | 'in-progress' | 'completed';
  maintenanceType: string;
  repairType: string;
  technicianName: string;
  symptoms: string;
  errorCode: string;
  partsCost: number;
  laborCost: number;
  otherCost: number;
  notes: string;
  aiDiagnosis: string;
}

interface WorkOrderDetailsEntry {
  maintenanceDate: string;
  status: 'planned' | 'in-progress' | 'completed';
  maintenanceType: string;
  repairType: string;
  technicianName: string;
  symptoms: string;
  errorCode: string;
  partsCost: number;
  laborCost: number;
  otherCost: number;
  notes: string;
  aiDiagnosis: string;
}

function parseUsdAmount(value: string): number | null {
  const sanitized = value.replace(/[^0-9.]/g, '').trim();
  if (!sanitized) {
    return null;
  }

  if ((sanitized.match(/\./g) ?? []).length > 1) {
    return null;
  }

  const parsed = Number.parseFloat(sanitized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function formatUsdAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function editableWorkOrderSignature(entry: WorkOrderDetailsEntry): string {
  return JSON.stringify({
    maintenanceDate: entry.maintenanceDate,
    status: entry.status,
    maintenanceType: entry.maintenanceType.trim(),
    repairType: entry.repairType.trim() || 'General Repair',
    technicianName: entry.technicianName.trim() || 'Unassigned',
    symptoms: entry.symptoms.trim(),
    errorCode: entry.errorCode.trim(),
    partsCost: formatUsdAmount(entry.partsCost),
    laborCost: formatUsdAmount(entry.laborCost),
    otherCost: formatUsdAmount(entry.otherCost),
    notes: entry.notes.trim(),
    aiDiagnosis: entry.aiDiagnosis.trim(),
  });
}

function workOrderSummarySignature(order: WorkOrderSummary): string {
  const status = order.status === 'in-progress' || order.status === 'completed' || order.status === 'planned'
    ? order.status
    : 'planned';
  return JSON.stringify({
    maintenanceDate: order.maintenanceDate ?? '',
    status,
    maintenanceType: (order.maintenanceType ?? 'Standard Repair').trim(),
    repairType: (order.repairType ?? 'General Repair').trim(),
    technicianName: (order.assignee ?? 'Unassigned').trim() || 'Unassigned',
    symptoms: (order.symptoms ?? '').trim(),
    errorCode: (order.errorCode ?? '').trim(),
    partsCost: order.partsCost ?? '$0.00',
    laborCost: order.laborCost ?? '$0.00',
    otherCost: order.otherCost ?? '$0.00',
    notes: (order.notes ?? '').trim(),
    aiDiagnosis: (order.aiDiagnosis ?? '').trim(),
  });
}

function parseCurrencyString(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInputValue(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return '';
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>(() => getInitialScreen());
  const [workOrderReturnScreen, setWorkOrderReturnScreen] = useState<ScreenKey>('machine-detail');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [createWorkOrderMachineId, setCreateWorkOrderMachineId] = useState<string | null>(null);
  const [machineFilterPreset, setMachineFilterPreset] = useState<MachineFilter | null>(null);
  const [assistPreset, setAssistPreset] = useState<AssistPreset | null>(null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [createdFromDraft, setCreatedFromDraft] = useState(false);
  const [workOrderBusy, setWorkOrderBusy] = useState(false);
  const [workOrderError, setWorkOrderError] = useState<string | null>(null);
  const [workOrderDeleteBusyId, setWorkOrderDeleteBusyId] = useState<string | null>(null);
  const [workOrderDeleteError, setWorkOrderDeleteError] = useState<string | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [billingBusyAction, setBillingBusyAction] = useState<BillingAction | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [machineStatusOverrides, setMachineStatusOverrides] = useState<Record<string, MachineOperationalStatus>>({});
  const [machineStatusBusyId, setMachineStatusBusyId] = useState<string | null>(null);
  const [machineStatusError, setMachineStatusError] = useState<string | null>(null);
  const [onboardingDraft, setOnboardingDraft] = useState<OwnerOnboardingDraft>({
    businessName: '',
    operatorName: '',
    businessAddress: '',
    ownerEmail: '',
    locationName: '',
    locationAddress: '',
    machineNumber: '',
    machineType: 'Washer',
    machineMake: '',
    machineModelNumber: '',
  });
  const authSession = useAuthSession();
  const userProfile = useUserProfile(authSession.user);
  const defaultOrganizationId = userProfile.profile?.defaultOrganizationId ?? null;
  const orgConnected = authSession.configured && !!authSession.user && !!defaultOrganizationId;
  const organizationTrial = useOrganizationTrial(authSession.user, defaultOrganizationId);
  const workspaceTrialExpired = orgConnected && organizationTrial.status === 'expired';
  const orgMachines = useOrganizationMachines(authSession.user, defaultOrganizationId);
  const orgManuals = useOrganizationManuals(authSession.user, defaultOrganizationId);
  const orgWorkOrders = useOrganizationWorkOrders(authSession.user, defaultOrganizationId);
  const workspaceLabel = userProfile.profile?.displayName ?? 'Company Account';
  const workOrderQueueData = orgConnected ? orgWorkOrders.workOrders : workOrderQueue;
  const machineCatalogBase = orgConnected ? orgMachines.machines : machineCatalog;
  const machineCatalogData = useMemo(() => applyStatusOverrides(machineCatalogBase, machineStatusOverrides), [machineCatalogBase, machineStatusOverrides]);
  const selectedMachine = useMemo(() => {
    if (selectedMachineId) {
      const found = machineCatalogData.find((machine) => machine.id === selectedMachineId);
      if (found) {
        return found;
      }
    }
    return machineCatalogData[0] ?? null;
  }, [machineCatalogData, selectedMachineId]);
  const createWorkOrderMachine = useMemo(() => {
    if (!createWorkOrderMachineId) {
      return null;
    }
    return machineCatalogData.find((machine) => machine.id === createWorkOrderMachineId) ?? null;
  }, [createWorkOrderMachineId, machineCatalogData]);
  const selectedWorkOrder = useMemo(() => {
    if (selectedWorkOrderId) {
      const found = workOrderQueueData.find((order) => order.id === selectedWorkOrderId);
      if (found) {
        return found;
      }
    }
    return workOrderQueueData[0] ?? null;
  }, [selectedWorkOrderId, workOrderQueueData]);
  const selectedWorkOrderMachine = useMemo(() => {
    if (!selectedWorkOrder?.machineId) {
      return null;
    }
    return machineCatalogData.find((machine) => machine.id === selectedWorkOrder.machineId) ?? null;
  }, [machineCatalogData, selectedWorkOrder?.machineId]);
  const urgentMachineData = useMemo(() => {
    if (!orgConnected) {
      return urgentMachines;
    }

    const computedUrgent = machineCatalogData.filter((machine) => machine.status !== 'running').slice(0, 6);
    return computedUrgent.length > 0 ? computedUrgent : orgMachines.machines.slice(0, 6);
  }, [machineCatalogData, orgConnected, orgMachines.machines]);
  const isSetupFlow = accountSetupScreens.includes(activeScreen);
  const showBack =
    activeScreen === 'machine-detail' ||
    activeScreen === 'manuals' ||
    activeScreen === 'account' ||
    activeScreen === 'create-work-order' ||
    activeScreen === 'work-order-detail' ||
    activeScreen === 'ai-assist';
  const title = screenTitles[activeScreen];

  useEffect(() => {
    if (authSession.loading || !authSession.configured) {
      return;
    }

    if (!authSession.user && activeScreen === 'owner-onboarding') {
      setActiveScreen('create-account');
      return;
    }

    if (!authSession.user && protectedScreens.includes(activeScreen)) {
      setActiveScreen('sign-in');
    }
  }, [activeScreen, authSession.configured, authSession.loading, authSession.user]);
  useEffect(() => {
    if (authSession.loading || !authSession.configured) {
      return;
    }

    void (async () => {
      try {
        await completeGoogleSignInRedirect();
      } catch (error) {
        console.error('Unable to complete Google redirect sign-in.', error);
      }
    })();
  }, [authSession.configured, authSession.loading]);
  useEffect(() => {
    if (authSession.loading || userProfile.loading || !userProfile.loaded || !authSession.configured || !authSession.user) {
      return;
    }

    if (defaultOrganizationId && accountSetupScreens.includes(activeScreen)) {
      setActiveScreen('home');
      return;
    }

    if (!defaultOrganizationId && protectedScreens.includes(activeScreen)) {
      setActiveScreen('owner-onboarding');
    }
  }, [
    activeScreen,
    authSession.configured,
    authSession.loading,
    authSession.user,
    defaultOrganizationId,
    userProfile.loaded,
    userProfile.loading,
  ]);
  useEffect(() => {
    if (selectedWorkOrderId && !workOrderQueueData.some((order) => order.id === selectedWorkOrderId)) {
      setSelectedWorkOrderId(null);
    }
  }, [selectedWorkOrderId, workOrderQueueData]);
  useEffect(() => {
    if (selectedMachineId && !machineCatalogData.some((machine) => machine.id === selectedMachineId)) {
      setSelectedMachineId(null);
    }
  }, [selectedMachineId, machineCatalogData]);
  useEffect(() => {
    if (createWorkOrderMachineId && !machineCatalogData.some((machine) => machine.id === createWorkOrderMachineId)) {
      setCreateWorkOrderMachineId(null);
    }
  }, [createWorkOrderMachineId, machineCatalogData]);
  useEffect(() => {
    if (!['machines', 'machine-detail'].includes(activeScreen) && machineFilterPreset !== null) {
      setMachineFilterPreset(null);
    }
  }, [activeScreen, machineFilterPreset]);
  useEffect(() => {
    if (activeScreen !== 'ai-assist' && assistPreset !== null) {
      setAssistPreset(null);
    }
  }, [activeScreen, assistPreset]);
  useEffect(() => {
    const validMachineIds = new Set(machineCatalogBase.map((machine) => machine.id));
    setMachineStatusOverrides((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([machineId]) => validMachineIds.has(machineId)),
      ) as Record<string, MachineOperationalStatus>;
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [machineCatalogBase]);
  const handleEmailSignIn = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmail(email, password);
      setActiveScreen('home');
      return null;
    } catch (error) {
      return getAuthErrorMessage(error);
    }
  };
  const handleGoogleSignIn = async (): Promise<string | null> => {
    try {
      await signInWithGoogle();
      setActiveScreen('home');
      return null;
    } catch (error) {
      if (shouldFallbackToGoogleRedirect(error)) {
        try {
          await signInWithGoogleRedirect();
          return null;
        } catch (redirectError) {
          return getAuthErrorMessage(redirectError);
        }
      }

      return getAuthErrorMessage(error);
    }
  };
  const handleOwnerCreate = async (draft: OwnerOnboardingDraft, password: string): Promise<string | null> => {
    try {
      await createOwnerAccount(draft.operatorName, draft.ownerEmail, password);
      setOnboardingDraft(draft);
      setActiveScreen('owner-onboarding');
      return null;
    } catch (error) {
      return getAuthErrorMessage(error);
    }
  };
  const handleSignOut = async (): Promise<void> => {
    setSignOutError(null);
    setSignOutBusy(true);
    try {
      await signOutCurrentUser();
      setActiveScreen('sign-in');
    } catch (error) {
      setSignOutError(getAuthErrorMessage(error));
    } finally {
      setSignOutBusy(false);
    }
  };
  const handleOwnerOnboardingFinish = async (draft: OwnerOnboardingDraft): Promise<string | null> => {
    try {
      await completeOwnerOnboarding(draft);
      setActiveScreen('home');
      return null;
    } catch (error) {
      return getAuthErrorMessage(error);
    }
  };
  const handleStartSubscription = async (billingPlan: BillingPlanKey): Promise<void> => {
    setBillingError(null);

    if (!defaultOrganizationId) {
      setBillingError('No organization is connected yet. Finish onboarding first.');
      return;
    }

    setBillingBusyAction('checkout');
    try {
      const checkoutUrl = await startStripeCheckout({
        organizationId: defaultOrganizationId,
        billingPlan,
      });
      window.location.assign(checkoutUrl);
    } catch (error) {
      setBillingError(getErrorMessage(error, 'Could not start Stripe checkout. Try again.'));
    } finally {
      setBillingBusyAction(null);
    }
  };
  const handleManageBilling = async (): Promise<void> => {
    setBillingError(null);

    if (!defaultOrganizationId) {
      setBillingError('No organization is connected yet. Finish onboarding first.');
      return;
    }

    setBillingBusyAction('portal');
    try {
      const portalUrl = await openStripeBillingPortal({
        organizationId: defaultOrganizationId,
      });
      window.location.assign(portalUrl);
    } catch (error) {
      setBillingError(getErrorMessage(error, 'Could not open Stripe billing portal. Try again.'));
    } finally {
      setBillingBusyAction(null);
    }
  };
  const openMachinesScreen = (filter: MachineFilter | null = null): void => {
    setMachineFilterPreset(filter);
    setActiveScreen('machines');
  };
  const openAssistScreen = (machine: UrgentMachine | null = null): void => {
    if (machine) {
      const cleanMachineModel = [machine.make, machine.modelNumber].filter(Boolean).join(' ') || machine.type || machine.machineNumber;
      setAssistPreset({
        machineId: machine.id,
        machineNumber: machine.machineNumber,
        machineModel: cleanMachineModel,
      });
    } else {
      setAssistPreset(null);
    }
    setActiveScreen('ai-assist');
  };
  const openCreateWorkOrder = (returnScreen: ScreenKey, machineId: string | null = null) => {
    setWorkOrderError(null);
    setWorkOrderReturnScreen(returnScreen);
    setCreateWorkOrderMachineId(machineId);
    setActiveScreen('create-work-order');
  };
  const openWorkOrderDetail = (workOrderId: string) => {
    setWorkOrderError(null);
    setCreatedFromDraft(false);
    setSelectedWorkOrderId(workOrderId);
    setActiveScreen('work-order-detail');
  };
  const openMachineDetail = (machineId: string) => {
    setSelectedMachineId(machineId);
    setActiveScreen('machine-detail');
  };
  const handleSetMachineStatus = async (machineId: string, status: MachineOperationalStatus): Promise<void> => {
    const machine = machineCatalogData.find((item) => item.id === machineId);
    if (!machine) {
      return;
    }

    const normalizedCurrentStatus = toOperationalStatus(machine.status);
    if (normalizedCurrentStatus === status) {
      return;
    }

    if (!orgConnected || !defaultOrganizationId) {
      setMachineStatusError('Complete onboarding first before updating machine status.');
      return;
    }

    setMachineStatusError(null);
    setMachineStatusOverrides((previous) => ({
      ...previous,
      [machineId]: status,
    }));

    setMachineStatusBusyId(machineId);
    try {
      await updateMachineStatus({
        organizationId: defaultOrganizationId,
        machineId,
        status,
      });
    } catch (error) {
      setMachineStatusOverrides((previous) => ({
        ...previous,
        [machineId]: normalizedCurrentStatus,
      }));
      setMachineStatusError(getErrorMessage(error, 'Could not update machine status. Try again.'));
    } finally {
      setMachineStatusBusyId((current) => (current === machineId ? null : current));
    }
  };
  const handleCreateWorkOrderFromDraft = async (entry: WorkOrderCostEntry): Promise<void> => {
    setWorkOrderError(null);
    const candidateMachineId = entry.machineId ?? createWorkOrderMachineId;
    const preferredMachine = candidateMachineId
      ? orgMachines.machines.find((machine) => machine.id === candidateMachineId)
      : null;
    if (!orgConnected || !defaultOrganizationId) {
      setWorkOrderError('Complete onboarding first before saving maintenance records.');
      return;
    }

    if (!preferredMachine?.id) {
      setWorkOrderError('Select a machine before creating this maintenance record.');
      return;
    }

    const machineNumber = preferredMachine.machineNumber;
    const machineModel = [
      preferredMachine?.make?.trim(),
      preferredMachine?.modelNumber?.trim(),
    ].filter(Boolean).join(' ') || preferredMachine?.type || aiWorkOrderDraft.machineModel;
    const fallbackTitle = [machineModel, entry.symptoms].filter(Boolean).join(' / ');
    const workOrderTitle = fallbackTitle.length > 0 ? fallbackTitle : aiWorkOrderDraft.title;

    setWorkOrderBusy(true);
    try {
      const totalCost = Math.max(0, entry.partsCost) + Math.max(0, entry.laborCost) + Math.max(0, entry.otherCost);
      const result = await createWorkOrderFromDraft({
        organizationId: defaultOrganizationId,
        machineId: preferredMachine?.id ?? null,
        machineNumber,
        machineModel,
        title: workOrderTitle,
        status: entry.status,
        priority: 'Standard',
        assigneeName: entry.technicianName || aiWorkOrderDraft.assignee,
        maintenanceDate: entry.maintenanceDate,
        dueLabel: entry.maintenanceDate,
        maintenanceType: entry.maintenanceType,
        repairType: entry.repairType,
        symptoms: entry.symptoms,
        errorCode: entry.errorCode,
        otherCost: entry.otherCost,
        notes: entry.notes,
        aiDiagnosis: entry.aiDiagnosis,
        partsCost: entry.partsCost,
        laborCost: entry.laborCost,
        totalCostLabel: formatUsdAmount(totalCost),
      });
      setCreatedFromDraft(true);
      setSelectedWorkOrderId(result.workOrderId);
      setActiveScreen('work-order-detail');
    } catch (error) {
      setWorkOrderError(getErrorMessage(error, 'Could not create maintenance record. Try again.'));
    } finally {
      setWorkOrderBusy(false);
    }
  };
  const handleUpdateSelectedWorkOrderDetails = async (entry: WorkOrderDetailsEntry): Promise<void> => {
    if (!selectedWorkOrder) {
      return;
    }

    if (!orgConnected || !defaultOrganizationId) {
      setWorkOrderError('Complete onboarding first before saving maintenance records.');
      return;
    }

    const totalCost = Math.max(0, entry.partsCost) + Math.max(0, entry.laborCost) + Math.max(0, entry.otherCost);
    const title = [entry.repairType.trim(), entry.symptoms.trim()]
      .filter(Boolean)
      .join(' / ') || selectedWorkOrder.title || 'Maintenance record';

    setWorkOrderError(null);
    setWorkOrderBusy(true);
    try {
      await updateWorkOrderDetails({
        organizationId: defaultOrganizationId,
        workOrderId: selectedWorkOrder.id,
        title,
        status: entry.status,
        maintenanceDate: entry.maintenanceDate,
        assigneeName: entry.technicianName.trim() || 'Unassigned',
        dueLabel: entry.maintenanceDate,
        maintenanceType: entry.maintenanceType,
        repairType: entry.repairType.trim() || 'General Repair',
        symptoms: entry.symptoms.trim(),
        errorCode: entry.errorCode.trim(),
        notes: entry.notes.trim(),
        aiDiagnosis: entry.aiDiagnosis.trim(),
        partsCost: entry.partsCost,
        laborCost: entry.laborCost,
        otherCost: entry.otherCost,
        totalCostLabel: formatUsdAmount(totalCost),
      });
      if (entry.status === 'completed') {
        setCreatedFromDraft(false);
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save maintenance record. Try again.');
      setWorkOrderError(message);
      throw new Error(message);
    } finally {
      setWorkOrderBusy(false);
    }
  };
  const handleDeleteWorkOrder = async (workOrderId: string): Promise<void> => {
    if (!orgConnected || !defaultOrganizationId) {
      setWorkOrderDeleteError('Complete onboarding first before deleting maintenance records.');
      return;
    }

    if (!window.confirm('Delete this maintenance record permanently?')) {
      return;
    }

    setWorkOrderDeleteError(null);
    setWorkOrderDeleteBusyId(workOrderId);
    try {
      await deleteWorkOrder({
        organizationId: defaultOrganizationId,
        workOrderId,
      });
      if (selectedWorkOrderId === workOrderId) {
        setSelectedWorkOrderId(null);
        setActiveScreen('work-orders');
      }
    } catch (error) {
      setWorkOrderDeleteError(getErrorMessage(error, 'Could not delete maintenance record. Try again.'));
    } finally {
      setWorkOrderDeleteBusyId((current) => (current === workOrderId ? null : current));
    }
  };
  const handleBack = () => {
    if (activeScreen === 'create-work-order') {
      setActiveScreen(workOrderReturnScreen);
      return;
    }

    if (activeScreen === 'work-order-detail') {
      setActiveScreen('work-orders');
      return;
    }

    setActiveScreen(activeScreen === 'machine-detail' || activeScreen === 'manuals' ? 'machines' : 'home');
  };

  return (
    <main className="app-canvas">
      <section className="phone-frame" aria-label="LaundryOps">
        <div className={`phone-shell ${isSetupFlow ? 'setup-shell' : 'workspace-shell'} ${activeScreen === 'welcome' ? 'landing-shell' : ''}`}>
          {activeScreen !== 'welcome' && <StatusBar />}
          {isSetupFlow ? (
            <div className="setup-content">
              {activeScreen === 'welcome' && (
                <WelcomeScreen
                  onStartTrial={() => setActiveScreen('create-account')}
                  onSignIn={() => setActiveScreen('sign-in')}
                  onCreateAccount={() => setActiveScreen('create-account')}
                />
              )}
              {activeScreen === 'sign-in' && (
                <SignInScreen
                  onBack={() => setActiveScreen('welcome')}
                  onSignIn={handleEmailSignIn}
                  onGoogleSignIn={handleGoogleSignIn}
                  onCreateAccount={() => setActiveScreen('create-account')}
                />
              )}
              {activeScreen === 'create-account' && (
                <CreateAccountAccessScreen
                  onBack={() => setActiveScreen('welcome')}
                  onStartTrial={handleOwnerCreate}
                  onSignIn={() => setActiveScreen('sign-in')}
                />
              )}
              {activeScreen === 'owner-onboarding' && (
                <OwnerOnboardingScreen
                  onBack={() => setActiveScreen('welcome')}
                  draft={onboardingDraft}
                  ownerEmail={authSession.user?.email ?? 'Owner email not available'}
                  onDraftChange={setOnboardingDraft}
                  onFinish={handleOwnerOnboardingFinish}
                />
              )}
            </div>
          ) : (
            <>
              {workspaceTrialExpired ? (
                <TrialExpiredScreen
                  billingBusyAction={billingBusyAction}
                  billingError={billingError}
                  onStartSubscription={handleStartSubscription}
                  onManageBilling={handleManageBilling}
                  onSignOut={handleSignOut}
                  signOutBusy={signOutBusy}
                />
              ) : (
                <>
                  <AppHeader
                    title={title}
                    showBack={showBack}
                    activeScreen={activeScreen}
                    onBack={handleBack}
                    onAccountClick={() => setActiveScreen('account')}
                    workspaceLabel={workspaceLabel}
                    machineCount={machineCatalogData.length}
                    workOrderCount={workOrderQueueData.length}
                  />
                  <div className="screen-content">
                    <BackendSessionBanner authSession={authSession} compact />
                    {activeScreen === 'home' && (
                  <HomeScreen
                    setActiveScreen={setActiveScreen}
                    onOpenMachines={openMachinesScreen}
                    onCreateWorkOrder={() => openCreateWorkOrder('home')}
                    onOpenMachineDetail={openMachineDetail}
                    onSetMachineStatus={handleSetMachineStatus}
                    machineCatalogData={machineCatalogData}
                    urgentMachineData={urgentMachineData}
                    orgMachinesLoading={orgMachines.loading}
                    orgMachinesError={orgMachines.error ?? orgWorkOrders.error}
                    machineStatusBusyId={machineStatusBusyId}
                    machineStatusError={machineStatusError}
                    orgConnected={orgConnected}
                    signOutBusy={signOutBusy}
                    signOutError={signOutError}
                    onSignOut={handleSignOut}
                  />
                    )}
                    {activeScreen === 'machines' && (
                  <MachinesScreen
                    setActiveScreen={setActiveScreen}
                    activeFilter={machineFilterPreset ?? 'all'}
                    onFilterChange={setMachineFilterPreset}
                    onOpenMachineDetail={openMachineDetail}
                    onCreateWorkOrder={(machineId) => openCreateWorkOrder('machines', machineId)}
                    onOpenAiAssist={openAssistScreen}
                    onSetMachineStatus={handleSetMachineStatus}
                    organizationId={defaultOrganizationId}
                    machineCatalogData={machineCatalogData}
                    orgMachinesLoading={orgMachines.loading}
                    orgMachinesError={orgMachines.error}
                    machineStatusBusyId={machineStatusBusyId}
                    machineStatusError={machineStatusError}
                    orgConnected={orgConnected}
                  />
                    )}
                    {activeScreen === 'machine-detail' && (
                  <MachineDetailScreen
                    setActiveScreen={setActiveScreen}
                    machine={selectedMachine}
                    onCreateWorkOrder={() => openCreateWorkOrder('machine-detail', selectedMachine?.id ?? null)}
                    onOpenAiAssist={() => openAssistScreen(selectedMachine)}
                    onOpenMaintenanceRecords={() => setActiveScreen('work-orders')}
                  />
                    )}
                    {activeScreen === 'manuals' && (
                  <ManualLibraryScreen
                    setActiveScreen={setActiveScreen}
                    orgConnected={orgConnected}
                    organizationId={defaultOrganizationId}
                    orgManualsLoading={orgManuals.loading}
                    orgManualsError={orgManuals.error}
                    orgManualsData={orgManuals.manuals}
                  />
                    )}
                    {activeScreen === 'account' && (
                  <AccountScreen
                    authSession={authSession}
                    userProfile={userProfile}
                    orgConnected={orgConnected}
                    signOutBusy={signOutBusy}
                    signOutError={signOutError}
                    onSignOut={handleSignOut}
                    billingBusyAction={billingBusyAction}
                    billingError={billingError}
                    onStartSubscription={handleStartSubscription}
                    onManageBilling={handleManageBilling}
                    organizationTrial={organizationTrial}
                  />
                    )}
                    {activeScreen === 'create-work-order' && (
                  <CreateWorkOrderScreen
                    onSave={handleCreateWorkOrderFromDraft}
                    busy={workOrderBusy}
                    error={workOrderError}
                    machine={createWorkOrderMachine}
                    availableMachines={machineCatalogData}
                    orgConnected={orgConnected}
                    organizationId={defaultOrganizationId}
                    onSetMachineStatus={handleSetMachineStatus}
                  />
                    )}
                    {activeScreen === 'work-orders' && (
                  <WorkOrdersScreen
                    setActiveScreen={setActiveScreen}
                    onCreateWorkOrder={() => openCreateWorkOrder('work-orders')}
                    onOpenWorkOrderDetail={openWorkOrderDetail}
                    onOpenMachineDetail={openMachineDetail}
                    onDeleteWorkOrder={handleDeleteWorkOrder}
                    workOrderQueueData={workOrderQueueData}
                    orgConnected={orgConnected}
                    orgWorkOrdersLoading={orgWorkOrders.loading}
                    orgWorkOrdersError={orgWorkOrders.error}
                    workOrderDeleteBusyId={workOrderDeleteBusyId}
                    workOrderDeleteError={workOrderDeleteError}
                  />
                    )}
                    {activeScreen === 'work-order-detail' && (
                  <WorkOrderDetailScreen
                    setActiveScreen={setActiveScreen}
                    createdFromDraft={createdFromDraft}
                    order={selectedWorkOrder}
                    machine={selectedWorkOrderMachine}
                    busy={workOrderBusy}
                    error={workOrderError}
                    machineStatusBusy={selectedWorkOrderMachine ? machineStatusBusyId === selectedWorkOrderMachine.id : false}
                    machineStatusError={machineStatusError}
                    orgConnected={orgConnected}
                    organizationId={defaultOrganizationId}
                    onUpdateDetails={handleUpdateSelectedWorkOrderDetails}
                    onSetMachineStatus={handleSetMachineStatus}
                  />
                    )}
                    {activeScreen === 'ai-assist' && (
                  <RepairAssistScreen
                    assistPreset={assistPreset}
                    onClearAssistPreset={() => setAssistPreset(null)}
                    onCreateWorkOrder={(machineId) => openCreateWorkOrder('ai-assist', machineId)}
                    orgConnected={orgConnected}
                    organizationId={defaultOrganizationId}
                    machines={machineCatalogData}
                    manualModels={orgManuals.manuals}
                  />
                    )}
                    {activeScreen === 'reports' && (
                  <ReportsScreen
                    orgConnected={orgConnected}
                    workOrders={workOrderQueueData}
                    machines={machineCatalogData}
                  />
                    )}
                  </div>
                  <BottomNav activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function BackendSessionBanner({
  authSession,
  compact = false,
}: {
  authSession: ReturnType<typeof useAuthSession>;
  compact?: boolean;
}) {
  const tone = authSession.error
    ? 'error'
    : authSession.user
      ? 'ready'
      : authSession.configured
        ? 'pending'
        : 'offline';

  const title = authSession.error
    ? 'Firebase auth error'
    : authSession.loading
      ? 'Checking auth session...'
      : authSession.user
        ? `Signed in: ${authSession.user.email ?? authSession.user.uid}`
        : authSession.configured
          ? 'Firebase connected (no active session)'
          : 'Firebase config not set';

  const detail = authSession.error
    ? authSession.error
    : authSession.configured
      ? `${authSession.usingEmulators ? 'Emulator mode' : 'Cloud mode'}${authSession.projectId ? ` / ${authSession.projectId}` : ''}`
      : 'Add VITE_FIREBASE_* values in local environment to enable real auth/data calls.';

  return (
    <section className={`backend-session-banner banner-${tone} ${compact ? 'is-compact' : ''}`}>
      <span className="backend-dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function TrialFeatureIcon({ featureId }: { featureId: string }) {
  if (featureId === 'manual-ai') {
    return <ShieldCheck size={31} />;
  }

  if (featureId === 'owner-reports') {
    return <BarChart3 size={32} />;
  }

  return <Wrench size={31} />;
}

function WelcomeScreen({
  onStartTrial,
  onSignIn,
  onCreateAccount,
}: {
  onStartTrial: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  return (
    <div className="welcome-screen">
      <div className="welcome-top">
        <div className="landing-menu-button" aria-hidden="true">
          <Menu size={28} />
        </div>
        <div className="welcome-brand">
          <div className="brand-mark large welcome-logo-mark" aria-hidden="true">
            <span className="brand-lines" />
          </div>
          <div>
            <span>Laundry<span>Ops</span></span>
            <strong>Maintenance command center</strong>
          </div>
        </div>
        <button className="text-action" type="button" onClick={onSignIn}>
          <UserRound size={22} /> Sign in
        </button>
      </div>

      <section className="welcome-hero">
        <div>
          <span className="trial-badge"><Star size={15} fill="currentColor" /> 14-Day Free Trial</span>
          <h1>More <span className="uptime-word">uptime</span>. <br />More <span className="revenue-word">revenue</span>.</h1>
          <p>Track machines, maintenance records, manuals, repair spend, and manual-grounded AI from one Android-first app.</p>
        </div>
        <div className="welcome-machine">
          <MachineIllustration />
        </div>
      </section>

      <button className="primary-action welcome-primary" type="button" onClick={onStartTrial}>
        Start 14-Day Free Trial <ChevronRight size={18} />
      </button>

      <div className="welcome-secondary-actions">
        <button className="secondary-action" type="button" onClick={onCreateAccount}>
          Create Account
        </button>
      </div>

      <section className="trial-feature-list">
        {trialFeatures.map((feature) => (
          <div className="trial-feature-row" key={feature.id}>
            <span className={`trial-feature-icon icon-${feature.id}`}><TrialFeatureIcon featureId={feature.id} /></span>
            <div>
              <strong>{feature.title}</strong>
              <small>{feature.detail}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="trial-feature-row trial-proof-card">
        <span className="trial-feature-icon icon-trial"><ShieldCheck size={32} /></span>
        <div>
          <strong>No credit card required to start.</strong>
          <span>Create your account, add your machines, and test LaundryOps free for 14 days before choosing a paid plan.</span>
        </div>
      </section>
    </div>
  );
}

function SignInScreen({
  onBack,
  onSignIn,
  onGoogleSignIn,
  onCreateAccount,
}: {
  onBack: () => void;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onGoogleSignIn: () => Promise<string | null>;
  onCreateAccount: () => void;
}) {
  const [showReset, setShowReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const submitSignIn = async () => {
    if (!email.trim() || !password) {
      setAuthError('Enter your email and password.');
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    const error = await onSignIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      setAuthError(error);
    }
  };
  const submitGoogleSignIn = async () => {
    setAuthError(null);
    setIsGoogleSubmitting(true);
    const error = await onGoogleSignIn();
    setIsGoogleSubmitting(false);

    if (error) {
      setAuthError(error);
    }
  };

  return (
    <div className="access-screen">
      <AccessHeader eyebrow="Secure access" title="Sign in to LaundryOps" onBack={onBack} />

      <section className="access-card">
        <div className="access-icon">
          <LockKeyhole size={23} />
        </div>
        <div className="access-copy">
          <span>Owner / Operator / Service Tech</span>
          <h1>Welcome back.</h1>
          <p>Use your account to open your company workspace, machines, and work queue.</p>
        </div>
        <div className="access-fields">
          <AuthField icon={Mail} label="Email" value={email} type="email" onChange={setEmail} />
          <AuthField icon={KeyRound} label="Password" value={password} type="password" placeholder="Enter password" onChange={setPassword} />
        </div>
        {authError && (
          <div className="auth-message">
            <strong>Sign-in failed</strong>
            <span>{authError}</span>
          </div>
        )}
        {showReset && (
          <div className="auth-message">
            <strong>Password reset ready</strong>
            <span>Production Firebase Auth will send the reset email from this screen.</span>
          </div>
        )}
        <button className="primary-action" type="button" onClick={submitSignIn} disabled={isSubmitting}>
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>
        <button
          className="google-action"
          type="button"
          onClick={submitGoogleSignIn}
          disabled={isGoogleSubmitting}
        >
          {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
        </button>
        <div className="access-link-row">
          <button type="button" onClick={() => setShowReset(true)}>Forgot password?</button>
          <button type="button" onClick={onCreateAccount}>Create account</button>
        </div>
      </section>
    </div>
  );
}

function CreateAccountAccessScreen({
  onBack,
  onStartTrial,
  onSignIn,
}: {
  onBack: () => void;
  onStartTrial: (draft: OwnerOnboardingDraft, password: string) => Promise<string | null>;
  onSignIn: () => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitCreateAccount = async () => {
    const draft: OwnerOnboardingDraft = {
      businessName: businessName.trim(),
      operatorName: operatorName.trim(),
      businessAddress: businessAddress.trim(),
      ownerEmail: email.trim(),
      locationName: '',
      locationAddress: '',
      machineNumber: '',
      machineType: 'Washer',
      machineMake: '',
      machineModelNumber: '',
    };

    if (!draft.businessName || !draft.operatorName || !draft.businessAddress || !draft.ownerEmail || !password) {
      setAuthError('Business name, operator name, address, email, and password are required.');
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    const error = await onStartTrial(draft, password);
    setIsSubmitting(false);

    if (error) {
      setAuthError(error);
    }
  };

  return (
    <div className="access-screen">
      <AccessHeader eyebrow="14-Day Free Trial" title="Create owner account" onBack={onBack} />

      <section className="access-card">
        <div className="access-icon account">
          <UserPlus size={23} />
        </div>
        <div className="access-copy">
          <span>Owner setup</span>
          <h1>Start with Pro trial.</h1>
          <p>Create the company account that owns machines, maintenance records, manuals, billing, and reports.</p>
        </div>
        <div className="access-fields">
          <AuthField icon={Building2} label="Business Name" value={businessName} onChange={setBusinessName} />
          <AuthField icon={UserRound} label="Operator Name" value={operatorName} onChange={setOperatorName} />
          <AuthField icon={ClipboardCheck} label="Address" value={businessAddress} onChange={setBusinessAddress} />
          <AuthField icon={Mail} label="Email" value={email} type="email" onChange={setEmail} />
          <AuthField icon={KeyRound} label="Password" value={password} type="password" placeholder="Create password" onChange={setPassword} />
        </div>
        {authError && (
          <div className="auth-message">
            <strong>Account setup failed</strong>
            <span>{authError}</span>
          </div>
        )}
        <section className="trial-proof-card light">
          <ShieldCheck size={18} />
          <div>
            <strong>14 days included before billing.</strong>
            <span>The trial includes maintenance records, reports, manual uploads, and OpenAI Repair Assist.</span>
          </div>
        </section>
        <button className="primary-action" type="button" onClick={submitCreateAccount} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Create Account & Continue Setup'}
        </button>
        <div className="access-link-row single">
          <button type="button" onClick={onSignIn}>Already have an account?</button>
        </div>
      </section>
    </div>
  );
}

function AccessHeader({
  eyebrow,
  title,
  onBack,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="setup-header access-header">
      <button className="icon-button setup-back" type="button" onClick={onBack} aria-label="Go back">
        <ArrowLeft size={21} />
      </button>
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className="access-lock" aria-hidden="true">
        <ShieldCheck size={18} />
      </div>
    </header>
  );
}

function AuthField({
  icon: Icon,
  label,
  value,
  type = 'text',
  placeholder,
  onChange,
  readOnly = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  type?: 'text' | 'password' | 'email';
  placeholder?: string;
  onChange?: (nextValue: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div>
        <Icon size={17} />
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly || !onChange}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        />
      </div>
    </label>
  );
}

function OwnerOnboardingScreen({
  onBack,
  draft,
  ownerEmail,
  onDraftChange,
  onFinish,
}: {
  onBack: () => void;
  draft: OwnerOnboardingDraft;
  ownerEmail: string;
  onDraftChange: (draft: OwnerOnboardingDraft) => void;
  onFinish: (draft: OwnerOnboardingDraft) => Promise<string | null>;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentStep = onboardingSteps[activeStep];
  const isLastStep = activeStep === onboardingSteps.length - 1;
  const ownerEmailValue = draft.ownerEmail || ownerEmail;

  const validateCurrentStep = (): string | null => {
    if (currentStep.id === 'account' && (!draft.businessName.trim() || !draft.operatorName.trim() || !draft.businessAddress.trim() || !ownerEmailValue.trim())) {
      return 'Business name, operator name, address, and email are required before continuing.';
    }
    if (currentStep.id === 'location' && (!draft.locationName.trim() || !draft.locationAddress.trim())) {
      return 'Location name and location address are required before continuing.';
    }
    if (currentStep.id === 'machine' && (!draft.machineNumber.trim() || !draft.machineType.trim() || !draft.machineMake.trim() || !draft.machineModelNumber.trim())) {
      return 'Machine number, type, make, and model number are required before finishing setup.';
    }
    return null;
  };

  useEffect(() => {
    if (!draft.ownerEmail && ownerEmail && ownerEmail !== 'Owner email not available') {
      onDraftChange({
        ...draft,
        ownerEmail,
      });
    }
  }, [draft, onDraftChange, ownerEmail]);

  const advance = async () => {
    const stepError = validateCurrentStep();
    if (stepError) {
      setSubmitError(stepError);
      return;
    }

    if (isLastStep) {
      setSubmitError(null);
      setIsSubmitting(true);
      const error = await onFinish({
        ...draft,
        ownerEmail: ownerEmailValue,
      });
      setIsSubmitting(false);
      if (error) {
        setSubmitError(error);
      }
      return;
    }

    setSubmitError(null);
    setActiveStep((step) => step + 1);
  };
  const goBack = () => {
    if (activeStep === 0) {
      onBack();
      return;
    }

    setActiveStep((step) => step - 1);
  };

  return (
    <div className="onboarding-screen">
      <header className="setup-header">
        <button className="icon-button setup-back" type="button" onClick={goBack} aria-label="Go back">
          <ArrowLeft size={21} />
        </button>
        <div>
          <span>Start 14-Day Free Trial</span>
          <strong>Owner setup</strong>
        </div>
        <b>{activeStep + 1}/{onboardingSteps.length}</b>
      </header>

      <section className="setup-progress-card">
        <div className="setup-progress-copy">
          <span>Setup Progress</span>
          <strong>{currentStep.title}</strong>
          <p>{currentStep.detail}</p>
        </div>
        <div className="setup-progress-ring">
          <strong>{Math.round(((activeStep + 1) / onboardingSteps.length) * 100)}%</strong>
        </div>
      </section>

      <section className="setup-step-list">
        {onboardingSteps.map((step, index) => (
          <OnboardingStepRow key={step.id} step={step} index={index} activeStep={activeStep} />
        ))}
      </section>

      <section className="setup-form-card">
        <OnboardingStepIcon step={currentStep} />
        <div className="setup-form-copy">
          <span>Required Setup</span>
          <h2>{currentStep.title}</h2>
          <p>{getOnboardingStepCopy(currentStep.id)}</p>
        </div>
        <OnboardingStepFields
          stepId={currentStep.id}
          draft={draft}
          ownerEmail={ownerEmailValue}
          onDraftChange={onDraftChange}
        />
      </section>
      {submitError && (
        <section className="auth-message">
          <strong>Setup save failed</strong>
          <span>{submitError}</span>
        </section>
      )}

      <div className="setup-actions">
        <button className="primary-action" type="button" onClick={() => void advance()} disabled={isSubmitting}>
          {isSubmitting ? 'Saving Setup...' : isLastStep ? 'Finish Setup' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function OnboardingStepRow({
  step,
  index,
  activeStep,
}: {
  step: OnboardingStep;
  index: number;
  activeStep: number;
}) {
  const status = index < activeStep ? 'done' : index === activeStep ? 'active' : 'next';
  return (
    <div className={`setup-step-row setup-step-${status}`}>
      <OnboardingStepIcon step={step} compact />
      <div>
        <strong>{step.title}</strong>
        <span>{step.detail}</span>
      </div>
      <b>{status === 'done' ? <Check size={15} /> : index + 1}</b>
    </div>
  );
}

function OnboardingStepIcon({ step, compact = false }: { step: OnboardingStep; compact?: boolean }) {
  const iconProps = { size: compact ? 17 : 22 };
  const Icon =
    step.icon === 'account' ? Building2 :
    step.icon === 'location' ? MapPin :
    step.icon === 'machine' ? Wrench :
    BookOpen;

  return (
    <span className={`setup-step-icon ${compact ? 'compact' : ''}`}>
      <Icon {...iconProps} />
    </span>
  );
}

function OnboardingStepFields({
  stepId,
  draft,
  ownerEmail,
  onDraftChange,
}: {
  stepId: string;
  draft: OwnerOnboardingDraft;
  ownerEmail: string;
  onDraftChange: (draft: OwnerOnboardingDraft) => void;
}) {
  const patchDraft = (updates: Partial<OwnerOnboardingDraft>) => {
    onDraftChange({
      ...draft,
      ...updates,
    });
  };

  if (stepId === 'account') {
    return (
      <div className="setup-field-grid">
        <SetupField label="Business Name" value={draft.businessName} onChange={(value) => patchDraft({ businessName: value })} />
        <SetupField label="Operator Name" value={draft.operatorName} onChange={(value) => patchDraft({ operatorName: value })} />
        <SetupField label="Address" value={draft.businessAddress} onChange={(value) => patchDraft({ businessAddress: value })} />
        <SetupField label="Email Address" value={ownerEmail} onChange={(value) => patchDraft({ ownerEmail: value })} />
      </div>
    );
  }

  if (stepId === 'location') {
    return (
      <div className="setup-field-grid">
        <SetupField label="Location Name" value={draft.locationName} onChange={(value) => patchDraft({ locationName: value })} />
        <SetupField label="Location Address" value={draft.locationAddress} onChange={(value) => patchDraft({ locationAddress: value })} wide />
      </div>
    );
  }

  if (stepId === 'machine') {
    return (
      <div className="setup-field-grid">
        <SetupField label="Machine Number" value={draft.machineNumber} onChange={(value) => patchDraft({ machineNumber: value })} />
        <SetupSelectField
          label="Machine Type"
          value={draft.machineType}
          options={['Washer', 'Dryer', 'Other']}
          onChange={(value) => patchDraft({ machineType: value })}
        />
        <SetupField label="Make" value={draft.machineMake} onChange={(value) => patchDraft({ machineMake: value })} />
        <SetupField label="Model Number" value={draft.machineModelNumber} onChange={(value) => patchDraft({ machineModelNumber: value })} />
      </div>
    );
  }

  return null;
}

function SetupField({
  label,
  value,
  wide = false,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className={wide ? 'wide' : ''}>
      <span>{label}</span>
      <input
        value={value}
        readOnly={readOnly || !onChange}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </label>
  );
}

function SetupSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[] | Array<{ value: string; label: string }>;
  onChange: (nextValue: string) => void;
}) {
  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option);

  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function getOnboardingStepCopy(stepId: string) {
  const copy: Record<string, string> = {
    account: 'Create the company account that owns billing, users, machines, manuals, and reports.',
    location: 'Add the first operating location where your machines are managed.',
    machine: 'Add the first machine so your account opens with a usable maintenance workspace.',
  };

  return copy[stepId];
}

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <div className="status-icons">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function AppHeader({
  title,
  showBack,
  activeScreen,
  onBack,
  onAccountClick,
  workspaceLabel,
  machineCount,
  workOrderCount,
}: {
  title: string;
  showBack: boolean;
  activeScreen: ScreenKey;
  onBack: () => void;
  onAccountClick: () => void;
  workspaceLabel: string;
  machineCount: number;
  workOrderCount: number;
}) {
  const isAssist = activeScreen === 'ai-assist';
  return (
    <header className="app-header">
      {showBack ? (
        <button className="icon-button header-icon" type="button" onClick={onBack} aria-label="Go back">
          <ArrowLeft size={22} />
        </button>
      ) : (
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-lines" />
        </div>
      )}
      <div className="header-copy">
        <h1>{title}</h1>
        {!showBack && activeScreen !== 'machines' && activeScreen !== 'work-orders' && (
          <button className="workspace-chip" type="button" onClick={onAccountClick}>
            {workspaceLabel}
          </button>
        )}
        {activeScreen === 'machines' && <span className="header-subtitle">{machineCount} machines</span>}
        {activeScreen === 'work-orders' && <span className="header-subtitle">{workOrderCount} maintenance records</span>}
        {activeScreen === 'manuals' && <span className="header-subtitle">Grounded repair answers</span>}
        {activeScreen === 'account' && <span className="header-subtitle">Business, subscription</span>}
        {activeScreen === 'create-work-order' && <span className="header-subtitle">Record setup</span>}
      </div>
      {isAssist ? (
        <span className="ai-pill">AI</span>
      ) : showBack ? (
        <button className="icon-button header-icon" type="button" onClick={onAccountClick} aria-label="More options">
          <MoreVertical size={21} />
        </button>
      ) : (
        <button className="icon-button header-icon" type="button" onClick={onAccountClick} aria-label="Notifications">
          <Bell size={21} />
        </button>
      )}
    </header>
  );
}

function BottomNav({
  activeScreen,
  setActiveScreen,
}: {
  activeScreen: ScreenKey;
  setActiveScreen: (screen: ScreenKey) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          activeScreen === item.key ||
          ((activeScreen === 'machine-detail' || activeScreen === 'manuals') && item.key === 'machines') ||
          ((activeScreen === 'create-work-order' || activeScreen === 'work-order-detail') && item.key === 'work-orders');
        return (
          <button
            className={`nav-item ${active ? 'is-active' : ''} ${item.key === 'ai-assist' ? 'is-ai' : ''}`}
            key={item.key}
            type="button"
            onClick={() => setActiveScreen(item.key)}
          >
            <Icon size={22} strokeWidth={2.2} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HomeScreen({
  setActiveScreen,
  onOpenMachines,
  onCreateWorkOrder,
  onOpenMachineDetail,
  onSetMachineStatus,
  machineCatalogData,
  urgentMachineData,
  orgMachinesLoading,
  orgMachinesError,
  machineStatusBusyId,
  machineStatusError,
  orgConnected,
  signOutBusy,
  signOutError,
  onSignOut,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  onOpenMachines: (filter: MachineFilter | null) => void;
  onCreateWorkOrder: () => void;
  onOpenMachineDetail: (machineId: string) => void;
  onSetMachineStatus: (machineId: string, status: MachineOperationalStatus) => Promise<void>;
  machineCatalogData: UrgentMachine[];
  urgentMachineData: UrgentMachine[];
  orgMachinesLoading: boolean;
  orgMachinesError: string | null;
  machineStatusBusyId: string | null;
  machineStatusError: string | null;
  orgConnected: boolean;
  signOutBusy: boolean;
  signOutError: string | null;
  onSignOut: () => Promise<void>;
}) {
  const [machineQuery, setMachineQuery] = useState('');
  const normalizedQuery = machineQuery.trim().toLowerCase();
  const machineResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return findMachines(machineQuery, machineCatalogData).slice(0, 6);
  }, [machineCatalogData, normalizedQuery, machineQuery]);
  const counts = useMemo(() => machineStatusCounts(machineCatalogData), [machineCatalogData]);

  return (
    <div className="screen-stack">
      <MachineStatusOverview counts={counts} onSelectStatus={onOpenMachines} />

      <section className="content-section machine-search-section">
        <div className="section-heading">
          <h2>Find Machine</h2>
          <span>{machineCatalogData.length} machines</span>
        </div>
        <label className="machine-search" htmlFor="machine-search">
          <Search size={18} />
          <input
            id="machine-search"
            type="search"
            value={machineQuery}
            onChange={(event) => setMachineQuery(event.target.value)}
            placeholder="Search machine ID, type, make, model, or status"
          />
        </label>
        {normalizedQuery ? (
          <div className="search-results" aria-live="polite">
            <div className="search-result-meta">
              <strong>{machineResults.length ? `${machineResults.length} matches` : 'No matches'}</strong>
              <span>IDs can start with letters or numbers.</span>
            </div>
            {machineResults.length > 0 && (
              <div className="machine-list search-machine-list">
                {machineResults.map((machine) => (
                  <UrgentMachineRow
                    key={machine.id}
                    machine={machine}
                    busy={machineStatusBusyId === machine.id}
                    onClick={() => onOpenMachineDetail(machine.id)}
                    onSetStatus={onSetMachineStatus}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="search-hint">Search by machine ID, number, type, make, model, or status.</p>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Urgent Machines</h2>
          <button type="button" onClick={() => onOpenMachines(null)}>See all <ChevronRight size={14} /></button>
        </div>
        <div className="machine-list">
          {urgentMachineData.map((machine) => (
            <UrgentMachineRow
              key={machine.id}
              machine={machine}
              busy={machineStatusBusyId === machine.id}
              onClick={() => onOpenMachineDetail(machine.id)}
              onSetStatus={onSetMachineStatus}
            />
          ))}
        </div>
        {urgentMachineData.length === 0 && <p className="empty-state">No machines need attention yet.</p>}
        {orgConnected && orgMachinesLoading && <p className="search-hint">Refreshing machines from your company data...</p>}
        {orgConnected && orgMachinesError && <p className="empty-state">Could not load live machines: {orgMachinesError}</p>}
        {orgConnected && !orgMachinesLoading && !orgMachinesError && <p className="search-hint">Live machines loaded from your company workspace.</p>}
        {machineStatusError && <p className="empty-state">{machineStatusError}</p>}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Quick Actions</h2>
        </div>
        <div className="quick-grid">
          <QuickAction icon={BookOpen} label="Manual Library" tone="teal" onClick={() => setActiveScreen('manuals')} />
          <QuickAction icon={ClipboardList} label="New Maintenance Record" tone="primary" onClick={onCreateWorkOrder} />
          <QuickAction icon={Sparkles} label="Ask AI" tone="ai" onClick={() => setActiveScreen('ai-assist')} />
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Account</h2>
          <button type="button" onClick={() => setActiveScreen('account')}>Details <ChevronRight size={14} /></button>
        </div>
        {signOutError && (
          <div className="auth-message">
            <strong>Sign-out failed</strong>
            <span>{signOutError}</span>
          </div>
        )}
        <button className="secondary-action home-sign-out" type="button" onClick={() => void onSignOut()} disabled={signOutBusy}>
          {signOutBusy ? 'Signing Out...' : 'Sign Out'}
        </button>
      </section>
    </div>
  );
}

function MachinesScreen({
  setActiveScreen,
  activeFilter,
  onFilterChange,
  onOpenMachineDetail,
  onCreateWorkOrder,
  onOpenAiAssist,
  onSetMachineStatus,
  organizationId,
  machineCatalogData,
  orgMachinesLoading,
  orgMachinesError,
  machineStatusBusyId,
  machineStatusError,
  orgConnected,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  activeFilter: MachineFilter;
  onFilterChange: (filter: MachineFilter | null) => void;
  onOpenMachineDetail: (machineId: string) => void;
  onCreateWorkOrder: (machineId: string) => void;
  onOpenAiAssist: (machine: UrgentMachine) => void;
  onSetMachineStatus: (machineId: string, status: MachineOperationalStatus) => Promise<void>;
  organizationId: string | null;
  machineCatalogData: UrgentMachine[];
  orgMachinesLoading: boolean;
  orgMachinesError: string | null;
  machineStatusBusyId: string | null;
  machineStatusError: string | null;
  orgConnected: boolean;
}) {
  const [machineQuery, setMachineQuery] = useState('');
  const [showAddMachineForm, setShowAddMachineForm] = useState(false);
  const [machineNumberInput, setMachineNumberInput] = useState('');
  const [machineTypeInput, setMachineTypeInput] = useState('Washer');
  const [machineMakeInput, setMachineMakeInput] = useState('');
  const [machineModelNumberInput, setMachineModelNumberInput] = useState('');
  const [addMachineBusy, setAddMachineBusy] = useState(false);
  const [addMachineError, setAddMachineError] = useState<string | null>(null);
  const [editingMachine, setEditingMachine] = useState<UrgentMachine | null>(null);
  const [editMachineNumberInput, setEditMachineNumberInput] = useState('');
  const [editMachineTypeInput, setEditMachineTypeInput] = useState('Washer');
  const [editMachineMakeInput, setEditMachineMakeInput] = useState('');
  const [editMachineModelNumberInput, setEditMachineModelNumberInput] = useState('');
  const [editMachineBusy, setEditMachineBusy] = useState(false);
  const [editMachineError, setEditMachineError] = useState<string | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<UrgentMachine | null>(null);
  const [deleteMachineBusy, setDeleteMachineBusy] = useState(false);
  const [deleteMachineError, setDeleteMachineError] = useState<string | null>(null);
  const filteredMachines = useMemo(() => {
    const statusFiltered = activeFilter === 'all'
      ? machineCatalogData
      : machineCatalogData.filter((machine) => toOperationalStatus(machine.status) === activeFilter);
    return findMachines(machineQuery, statusFiltered);
  }, [activeFilter, machineCatalogData, machineQuery]);
  const counts = useMemo(() => machineStatusCounts(machineCatalogData), [machineCatalogData]);

  const resetAddMachineForm = () => {
    setMachineNumberInput('');
    setMachineTypeInput('Washer');
    setMachineMakeInput('');
    setMachineModelNumberInput('');
    setAddMachineError(null);
  };
  const closeEditMachine = () => {
    setEditingMachine(null);
    setEditMachineError(null);
    setEditMachineBusy(false);
  };
  const closeDeleteMachine = () => {
    setDeletingMachine(null);
    setDeleteMachineError(null);
    setDeleteMachineBusy(false);
  };
  const openEditMachine = (machine: UrgentMachine) => {
    setEditingMachine(machine);
    setEditMachineNumberInput(machine.machineNumber);
    setEditMachineTypeInput(machine.type || 'Washer');
    setEditMachineMakeInput(machine.make ?? '');
    setEditMachineModelNumberInput(machine.modelNumber ?? '');
    setEditMachineError(null);
  };

  const handleAddMachine = async (): Promise<void> => {
    setAddMachineError(null);
    if (!orgConnected || !organizationId) {
      setAddMachineError('Complete onboarding first before adding machines.');
      return;
    }
    if (!machineNumberInput.trim() || !machineMakeInput.trim() || !machineModelNumberInput.trim()) {
      setAddMachineError('Machine ID, make, and model number are required.');
      return;
    }

    setAddMachineBusy(true);
    try {
      await createMachine({
        organizationId,
        machineNumber: machineNumberInput.trim(),
        type: machineTypeInput,
        make: machineMakeInput.trim(),
        modelNumber: machineModelNumberInput.trim(),
      });
      setShowAddMachineForm(false);
      resetAddMachineForm();
    } catch (error) {
      setAddMachineError(getErrorMessage(error, 'Could not add machine. Try again.'));
    } finally {
      setAddMachineBusy(false);
    }
  };
  const handleSaveMachineEdits = async (): Promise<void> => {
    setEditMachineError(null);
    if (!editingMachine) {
      return;
    }
    if (!orgConnected || !organizationId) {
      setEditMachineError('Complete onboarding first before editing machines.');
      return;
    }
    if (!editMachineNumberInput.trim() || !editMachineMakeInput.trim() || !editMachineModelNumberInput.trim()) {
      setEditMachineError('Machine ID, make, and model number are required.');
      return;
    }

    setEditMachineBusy(true);
    try {
      await updateMachine({
        organizationId,
        machineId: editingMachine.id,
        machineNumber: editMachineNumberInput.trim(),
        type: editMachineTypeInput.trim(),
        make: editMachineMakeInput.trim(),
        modelNumber: editMachineModelNumberInput.trim(),
      });
      closeEditMachine();
    } catch (error) {
      setEditMachineError(getErrorMessage(error, 'Could not update machine. Try again.'));
    } finally {
      setEditMachineBusy(false);
    }
  };
  const handleDeleteMachine = async (): Promise<void> => {
    setDeleteMachineError(null);
    if (!deletingMachine) {
      return;
    }
    if (!orgConnected || !organizationId) {
      setDeleteMachineError('Complete onboarding first before deleting machines.');
      return;
    }

    setDeleteMachineBusy(true);
    try {
      await deleteMachineRecord({
        organizationId,
        machineId: deletingMachine.id,
      });
      closeDeleteMachine();
    } catch (error) {
      setDeleteMachineError(getErrorMessage(error, 'Could not delete machine. Try again.'));
    } finally {
      setDeleteMachineBusy(false);
    }
  };

  return (
    <div className="screen-stack">
      <MachineStatusOverview
        counts={counts}
        onSelectStatus={(filter) => {
          onFilterChange(filter);
          setMachineQuery('');
        }}
      />

      <section className="content-section machine-search-section">
        <div className="section-heading">
          <h2>Maintenance Ledger</h2>
          <button type="button" onClick={() => setActiveScreen('manuals')}>Manuals <ChevronRight size={14} /></button>
        </div>
        <p className="search-hint">{filteredMachines.length} shown</p>
        <label className="machine-search" htmlFor="directory-machine-search">
          <Search size={18} />
          <input
            id="directory-machine-search"
            type="search"
            value={machineQuery}
            onChange={(event) => setMachineQuery(event.target.value)}
            placeholder="Search machine ID, type, make, model, or status"
          />
        </label>
        <div className="filter-strip" aria-label="Machine status filters">
          {machineFilters.map((filter) => (
            <button
              className={activeFilter === filter.key ? 'is-selected' : ''}
              key={filter.key}
              type="button"
              onClick={() => {
                onFilterChange(filter.key);
                setMachineQuery('');
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="content-section directory-list-section">
        {orgConnected && orgMachinesLoading && <p className="search-hint">Refreshing machine directory from your company data...</p>}
        {orgConnected && orgMachinesError && <p className="empty-state">Could not load live machines: {orgMachinesError}</p>}
        <div className="machine-list directory-machine-list">
          {filteredMachines.map((machine) => (
            <UrgentMachineRow
              key={machine.id}
              machine={machine}
              busy={machineStatusBusyId === machine.id}
              onClick={() => onOpenMachineDetail(machine.id)}
              onOpenDetails={() => onOpenMachineDetail(machine.id)}
              onAskAi={() => onOpenAiAssist(machine)}
              onCreateWorkOrder={() => onCreateWorkOrder(machine.id)}
              onSetStatus={onSetMachineStatus}
              onEdit={() => openEditMachine(machine)}
              onDelete={() => {
                setDeletingMachine(machine);
                setDeleteMachineError(null);
              }}
            />
          ))}
        </div>
        {filteredMachines.length === 0 && <p className="empty-state">{machineQuery.trim() ? 'No machines match that search.' : 'No machines found yet.'}</p>}
        {machineStatusError && <p className="empty-state">{machineStatusError}</p>}
      </section>

      <button
        className="machine-fab"
        type="button"
        onClick={() => {
          setShowAddMachineForm(true);
          setAddMachineError(null);
        }}
        aria-label="Add machine"
      >
        <Plus size={22} />
      </button>

      {showAddMachineForm && (
        <section className="machine-modal-backdrop" role="dialog" aria-modal="true" aria-label="Add machine">
          <div className="machine-modal-card">
            <div className="section-heading">
              <h2>Add Machine</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddMachineForm(false);
                  resetAddMachineForm();
                }}
              >
                Close
              </button>
            </div>
            <div className="setup-field-grid">
              <SetupField label="Machine ID" value={machineNumberInput} onChange={setMachineNumberInput} />
              <SetupSelectField label="Type" value={machineTypeInput} options={['Washer', 'Dryer', 'Other']} onChange={setMachineTypeInput} />
              <SetupField label="Machine Make" value={machineMakeInput} onChange={setMachineMakeInput} />
              <SetupField label="Model Number" value={machineModelNumberInput} onChange={setMachineModelNumberInput} />
            </div>
            {addMachineError && (
              <div className="auth-message">
                <strong>Could not add machine</strong>
                <span>{addMachineError}</span>
              </div>
            )}
            <button
              className="primary-action"
              type="button"
              onClick={() => void handleAddMachine()}
              disabled={addMachineBusy}
            >
              {addMachineBusy ? 'Saving...' : 'Save Machine'}
            </button>
          </div>
        </section>
      )}
      {editingMachine && (
        <section className="machine-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit machine">
          <div className="machine-modal-card">
            <div className="section-heading">
              <h2>Edit Machine</h2>
              <button type="button" onClick={closeEditMachine}>
                Close
              </button>
            </div>
            <div className="setup-field-grid">
              <SetupField label="Machine ID" value={editMachineNumberInput} onChange={setEditMachineNumberInput} />
              <SetupSelectField label="Type" value={editMachineTypeInput} options={['Washer', 'Dryer', 'Other']} onChange={setEditMachineTypeInput} />
              <SetupField label="Machine Make" value={editMachineMakeInput} onChange={setEditMachineMakeInput} />
              <SetupField label="Model Number" value={editMachineModelNumberInput} onChange={setEditMachineModelNumberInput} />
            </div>
            {editMachineError && (
              <div className="auth-message">
                <strong>Could not update machine</strong>
                <span>{editMachineError}</span>
              </div>
            )}
            <div className="machine-modal-actions">
              <button className="secondary-action" type="button" onClick={closeEditMachine} disabled={editMachineBusy}>
                Cancel
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={() => void handleSaveMachineEdits()}
                disabled={editMachineBusy}
              >
                {editMachineBusy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </section>
      )}
      {deletingMachine && (
        <section className="machine-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete machine">
          <div className="machine-modal-card">
            <div className="section-heading">
              <h2>Delete Machine</h2>
              <button type="button" onClick={closeDeleteMachine}>
                Close
              </button>
            </div>
            <p className="delete-machine-text">
              Delete machine <strong>{deletingMachine.machineNumber}</strong>? This removes the card from your machine list.
            </p>
            {deleteMachineError && (
              <div className="auth-message">
                <strong>Could not delete machine</strong>
                <span>{deleteMachineError}</span>
              </div>
            )}
            <div className="machine-modal-actions">
              <button className="secondary-action" type="button" onClick={closeDeleteMachine} disabled={deleteMachineBusy}>
                Cancel
              </button>
              <button className="danger-action" type="button" onClick={() => void handleDeleteMachine()} disabled={deleteMachineBusy}>
                {deleteMachineBusy ? 'Deleting...' : 'Delete Machine'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MachineStatusOverview({
  counts,
  onSelectStatus,
}: {
  counts: {
    total: number;
    operational: number;
    repair: number;
    down: number;
  };
  onSelectStatus?: (filter: MachineFilter) => void;
}) {
  return (
    <section className="machine-overview-grid">
      <OverviewCard label="Total Machines" value={String(counts.total)} tone="total" onClick={() => onSelectStatus?.('all')} />
      <OverviewCard label="Operational" value={String(counts.operational)} tone="operational" onClick={() => onSelectStatus?.('running')} />
      <OverviewCard label="Needs Repair" value={String(counts.repair)} tone="repair" onClick={() => onSelectStatus?.('needs-repair')} />
      <OverviewCard label="Out of Service" value={String(counts.down)} tone="down" onClick={() => onSelectStatus?.('down')} />
    </section>
  );
}

function OverviewCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: 'total' | 'operational' | 'repair' | 'down';
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );

  if (onClick) {
    return (
      <button className={`overview-card overview-${tone} is-clickable`} type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={`overview-card overview-${tone}`}>
      {content}
    </div>
  );
}

function UrgentMachineRow({
  machine,
  onClick,
  onOpenDetails,
  onAskAi,
  onCreateWorkOrder,
  onSetStatus,
  busy = false,
  onEdit,
  onDelete,
}: {
  machine: UrgentMachine;
  onClick: () => void;
  onOpenDetails?: () => void;
  onAskAi?: () => void;
  onCreateWorkOrder?: () => void;
  onSetStatus: (machineId: string, status: MachineOperationalStatus) => Promise<void>;
  busy?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const activeStatus = toOperationalStatus(machine.status);

  return (
    <div className={`machine-row status-${activeStatus}`}>
      <button className="machine-row-open" type="button" onClick={onClick}>
        <MachineThumb />
        <div className="machine-row-main">
          <strong>{machine.machineNumber}</strong>
          <span>{machine.type} / {machine.make ?? 'Make not set'}</span>
        </div>
        <div className="machine-row-status">
          <StatusBadge status={activeStatus}>{machineStatusLabel(activeStatus)}</StatusBadge>
          <span>{machine.since}</span>
        </div>
        <ChevronRight className="row-chevron" size={18} />
      </button>
      <div className="machine-status-toggle" role="group" aria-label={`Status for ${machine.machineNumber}`}>
        {([
          ['running', 'Op'],
          ['needs-repair', 'Repair'],
          ['down', 'Down'],
        ] as Array<[MachineOperationalStatus, string]>).map(([statusKey, label]) => (
          <button
            key={statusKey}
            type="button"
            className={`status-chip ${activeStatus === statusKey ? `status-chip-${statusKey} is-active` : ''}`}
            onClick={() => void onSetStatus(machine.id, statusKey)}
            disabled={busy}
            aria-pressed={activeStatus === statusKey}
          >
            {label}
          </button>
        ))}
      </div>
      {(onAskAi || onOpenDetails || onCreateWorkOrder || onEdit || onDelete) && (
        <div className="machine-row-actions">
          {onAskAi && (
            <button className="row-action-button row-action-ai" type="button" onClick={onAskAi} disabled={busy}>
              <Sparkles size={14} /> AI Assist
            </button>
          )}
          {onOpenDetails && (
            <button className="row-action-button" type="button" onClick={onOpenDetails} disabled={busy}>
              <FileText size={14} /> Details
            </button>
          )}
          {onCreateWorkOrder && (
            <button className="row-action-button row-action-primary" type="button" onClick={onCreateWorkOrder} disabled={busy}>
              <ClipboardList size={14} /> Record
            </button>
          )}
          {onEdit && (
            <button className="row-action-button" type="button" onClick={onEdit} disabled={busy}>
              <Pencil size={14} /> Edit
            </button>
          )}
          {onDelete && (
            <button className="row-action-button row-action-delete" type="button" onClick={onDelete} disabled={busy}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MachineDetailScreen({
  setActiveScreen,
  machine,
  onCreateWorkOrder,
  onOpenAiAssist,
  onOpenMaintenanceRecords,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  machine: UrgentMachine | null;
  onCreateWorkOrder: () => void;
  onOpenAiAssist: () => void;
  onOpenMaintenanceRecords: () => void;
}) {
  const machineStatus = machine ? toOperationalStatus(machine.status) : 'running';
  const machineStatusText = machine ? machineStatusLabel(machineStatus) : 'Operational';
  const machineNumber = machine?.machineNumber ?? 'Machine';
  const machineModel = machine?.make && machine?.modelNumber
    ? `${machine.make} ${machine.modelNumber}`.trim()
    : machine?.make ?? machine?.modelNumber ?? machine?.type ?? 'Model not set';
  const issueLabel = machineStatus === 'down'
    ? 'Machine offline'
    : machineStatus === 'needs-repair'
      ? 'Needs repair attention'
      : 'No active issue';
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  return (
    <div className="screen-stack detail-stack">
      <section className="machine-hero">
        <div className="machine-hero-copy">
          <div className="machine-title-line">
            <h2>{machineNumber}</h2>
            <StatusBadge status={machineStatus}>{machineStatusText}</StatusBadge>
          </div>
          <strong>{machineModel}</strong>
          <span>{machine?.type ?? 'Machine type not set'}</span>
          <span>S/N 123456789</span>
        </div>
        <MachineIllustration />
      </section>

      <section className="issue-card">
        <span>Current Issue</span>
        <strong>{issueLabel}</strong>
        <p>{machine?.since ?? 'Status just updated'}</p>
      </section>

      <button className="primary-action" type="button" onClick={onCreateWorkOrder}>
        <Plus size={20} /> Create Maintenance Record
      </button>

      <div className="shortcut-grid">
        <Shortcut icon={Sparkles} label="Ask AI" onClick={onOpenAiAssist} tone="ai" />
        <Shortcut icon={BookOpen} label="Search Manual" onClick={() => setActiveScreen('manuals')} />
        <Shortcut icon={Camera} label="Add Photo" onClick={() => setPhotoMessage('Photo attachments are queued for the beta attachment workflow.')} />
      </div>

      {photoMessage && (
        <div className="auth-message">
          <strong>Add Photo</strong>
          <span>{photoMessage}</span>
        </div>
      )}

      <div className="stat-grid">
        <SmallStat label="Lifetime Repair Cost" value="Not set" tone="teal" />
        <SmallStat label="Last Service" value="Not set" />
        <SmallStat label="Downtime (Current)" value="Not set" tone="down" />
      </div>

      <section className="content-section">
        <div className="section-heading">
          <h2>Maintenance History</h2>
          <button type="button" onClick={onOpenMaintenanceRecords}>
            See all <ChevronRight size={14} />
          </button>
        </div>
        <div className="timeline-list">
          {machineHistory.map((event) => (
            <div className="timeline-row" key={event.id}>
              <span className={`timeline-dot ${event.tone}`}><Check size={13} /></span>
              <div>
                <strong>{event.title}</strong>
                <span>{event.meta}</span>
              </div>
              <b>{event.cost}</b>
            </div>
          ))}
        </div>
        {machineHistory.length === 0 && <p className="empty-state">No maintenance history recorded yet.</p>}
      </section>
    </div>
  );
}

function ManualLibraryScreen({
  setActiveScreen,
  orgConnected,
  organizationId,
  orgManualsLoading,
  orgManualsError,
  orgManualsData,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  orgConnected: boolean;
  organizationId: string | null;
  orgManualsLoading: boolean;
  orgManualsError: string | null;
  orgManualsData: ManualLibraryRow[];
}) {
  const [machineModel, setMachineModel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexError, setReindexError] = useState<string | null>(null);
  const [reindexSuccess, setReindexSuccess] = useState<string | null>(null);
  const [filePickerKey, setFilePickerKey] = useState(0);

  const fallbackManualRows: ManualLibraryRow[] = manualRows.map((manual) => ({
    ...manual,
    indexError: null,
  }));
  const manualData = orgConnected ? orgManualsData : fallbackManualRows;
  const indexedCount = manualData.filter((manual) => manual.status === 'indexed').length;
  const missingCount = manualData.filter((manual) => manual.status === 'missing').length;
  const uploadReady = Boolean(orgConnected && organizationId && machineModel.trim() && selectedFile);
  const reindexReady = Boolean(orgConnected && organizationId && manualData.length > 0);

  const handleUpload = async (): Promise<void> => {
    setUploadError(null);
    setUploadSuccess(null);
    setDeleteError(null);
    setDeleteSuccess(null);
    setReindexError(null);
    setReindexSuccess(null);

    if (!orgConnected || !organizationId) {
      setUploadError('Complete onboarding first to connect manual uploads to your organization account.');
      return;
    }
    if (!machineModel.trim()) {
      setUploadError('Enter the machine model number first.');
      return;
    }
    if (!selectedFile) {
      setUploadError('Choose a PDF file before processing.');
      return;
    }

    setUploadBusy(true);
    try {
      await uploadManualAndIndex({
        organizationId,
        machineModel: machineModel.trim(),
        file: selectedFile,
        linkedMachineCount: 0,
      });
      setUploadSuccess(`Manual uploaded and indexed for model number ${machineModel.trim()}.`);
      setMachineModel('');
      setSelectedFile(null);
      setFilePickerKey((value) => value + 1);
    } catch (error) {
      setUploadError(getErrorMessage(error, 'Could not upload and index manual. Try again.'));
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDeleteManual = async (manual: ManualLibraryRow): Promise<void> => {
    setDeleteError(null);
    setDeleteSuccess(null);
    setUploadError(null);
    setUploadSuccess(null);
    setReindexError(null);
    setReindexSuccess(null);

    if (!orgConnected || !organizationId) {
      setDeleteError('Complete onboarding first before deleting manuals.');
      return;
    }

    const confirmed = window.confirm(`Delete the manual for ${manual.model}? This removes the uploaded PDF and indexed AI source text.`);
    if (!confirmed) {
      return;
    }

    setDeleteBusyId(manual.id);
    try {
      await deleteOrganizationManual({
        organizationId,
        manualId: manual.id,
      });
      setDeleteSuccess(`Deleted manual for ${manual.model}.`);
    } catch (error) {
      setDeleteError(getErrorMessage(error, 'Could not delete manual. Try again.'));
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleReindexManuals = async (): Promise<void> => {
    setReindexError(null);
    setReindexSuccess(null);
    setUploadError(null);
    setUploadSuccess(null);
    setDeleteError(null);
    setDeleteSuccess(null);

    if (!orgConnected || !organizationId) {
      setReindexError('Complete onboarding first before re-indexing manuals.');
      return;
    }

    const confirmed = window.confirm('Re-index all uploaded manuals? This reuses the existing PDF uploads and rebuilds the AI source text and error-code index.');
    if (!confirmed) {
      return;
    }

    setReindexBusy(true);
    try {
      const result = await reindexOrganizationManuals({ organizationId });
      const failureNote = result.failedCount > 0 ? ` ${result.failedCount} manual(s) need review.` : '';
      const limitNote = result.limited ? ' Only the first batch was processed; run it again for more.' : '';
      setReindexSuccess(`Re-indexed ${result.reindexedCount} uploaded manual(s).${failureNote}${limitNote}`);
    } catch (error) {
      setReindexError(getErrorMessage(error, 'Could not re-index manuals. Try again.'));
    } finally {
      setReindexBusy(false);
    }
  };

  return (
    <div className="screen-stack">
      <section className="manual-summary">
        <div>
          <span>Manual Coverage</span>
          <strong>{indexedCount}</strong>
          <small>machine models grounded</small>
        </div>
        <div>
          <span>Ungrounded</span>
          <strong className={missingCount > 0 ? 'tone-down' : 'tone-teal'}>{Math.max(missingCount, 0)}</strong>
          <small>models need upload</small>
        </div>
      </section>

      <section className="upload-panel">
        <div className="upload-copy">
          <span className="upload-icon"><FileUp size={23} /></span>
          <div>
            <h2>Upload Repair Manual</h2>
            <p>Link a PDF to a specific machine model number so AI Repair Assist answers from the actual manual.</p>
          </div>
        </div>
        <div className="upload-form">
          <label>
            <span>Machine Model Number</span>
            <input
              value={machineModel}
              placeholder="Ex: SFNNCASG113TN01"
              onChange={(event) => setMachineModel(event.target.value)}
              disabled={uploadBusy}
            />
          </label>
          <label>
            <span>Manual PDF</span>
            <input
              key={filePickerKey}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              disabled={uploadBusy}
            />
          </label>
          {selectedFile && (
            <div className="upload-status-line">
              <Check size={15} />
              <span>{selectedFile.name} ready to upload and index.</span>
            </div>
          )}
        </div>
        <button
          className={uploadBusy ? 'secondary-action full-width-action' : 'primary-action'}
          type="button"
          onClick={() => void handleUpload()}
          disabled={uploadBusy}
        >
          {uploadBusy ? 'Processing Manual...' : 'Upload & Index Manual'}
        </button>
        {!uploadReady && !uploadError && (
          <div className="auth-message">
            <strong>Manual upload required fields</strong>
            <span>Enter a machine model and choose a PDF manual before uploading.</span>
          </div>
        )}
        {!orgConnected && (
          <p className="search-hint">Complete onboarding first to connect manual uploads to your organization account.</p>
        )}
        {uploadError && (
          <div className="auth-message">
            <strong>Manual upload failed</strong>
            <span>{uploadError}</span>
          </div>
        )}
        {uploadSuccess && (
          <div className="profile-status-line">
            <Check size={16} />
            <span>{uploadSuccess}</span>
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Manual Library</h2>
          <span>{manualData.length} models</span>
        </div>
        {orgConnected && (
          <button
            className="secondary-action full-width-action"
            type="button"
            onClick={() => void handleReindexManuals()}
            disabled={!reindexReady || reindexBusy}
          >
            {reindexBusy ? 'Re-indexing Manuals...' : 'Re-index Uploaded Manuals'}
          </button>
        )}
        {orgConnected && orgManualsLoading && <p className="search-hint">Refreshing manuals from your company data...</p>}
        {orgConnected && orgManualsError && <p className="empty-state">Could not load live manuals: {orgManualsError}</p>}
        {reindexError && (
          <div className="auth-message">
            <strong>Manual re-index failed</strong>
            <span>{reindexError}</span>
          </div>
        )}
        {reindexSuccess && (
          <div className="profile-status-line">
            <Check size={16} />
            <span>{reindexSuccess}</span>
          </div>
        )}
        <div className="manual-list">
          {manualData.map((manual) => (
            <ManualRow
              key={manual.id}
              manual={manual}
              canDelete={orgConnected}
              deleting={deleteBusyId === manual.id}
              onDelete={() => void handleDeleteManual(manual)}
            />
          ))}
        </div>
        {deleteError && (
          <div className="auth-message">
            <strong>Manual delete failed</strong>
            <span>{deleteError}</span>
          </div>
        )}
        {deleteSuccess && (
          <div className="profile-status-line">
            <Check size={16} />
            <span>{deleteSuccess}</span>
          </div>
        )}
      </section>

      <section className="ai-grounding-card">
        <BookOpen size={18} />
        <div>
          <strong>Repair Assist uses uploaded manuals first.</strong>
          <span>When no manual exists, the answer is marked as general guidance until a manual is uploaded.</span>
        </div>
      </section>

      <button className="ai-action" type="button" onClick={() => setActiveScreen('ai-assist')}>
        Open AI Repair Assist
      </button>
    </div>
  );
}

function ManualRow({
  manual,
  canDelete,
  deleting,
  onDelete,
}: {
  manual: ManualLibraryRow;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const status: ManualStatus = manual.status;
  const statusLabel: Record<ManualStatus, string> = {
    indexed: 'Indexed',
    processing: 'Processing',
    missing: 'Missing',
  };
  return (
    <div className={`manual-row manual-${status}`}>
      <div className="manual-row-icon">
        <BookOpen size={20} />
      </div>
      <div className="manual-row-main">
        <strong>{manual.model}</strong>
        <span>{manual.title}</span>
        <small>{manual.source}</small>
      </div>
      <div className="manual-row-meta">
        <StatusBadge status={status === 'indexed' ? 'running' : status === 'processing' ? 'waiting' : 'down'}>{statusLabel[status]}</StatusBadge>
        <span>{manual.coverage}</span>
        <small>{manual.pages}</small>
        {canDelete && (
          <button
            className="manual-delete-action"
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete manual for ${manual.model}`}
          >
            <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}

function TrialExpiredScreen({
  billingBusyAction,
  billingError,
  onStartSubscription,
  onManageBilling,
  onSignOut,
  signOutBusy,
}: {
  billingBusyAction: BillingAction | null;
  billingError: string | null;
  onStartSubscription: (billingPlan: BillingPlanKey) => Promise<void>;
  onManageBilling: () => Promise<void>;
  onSignOut: () => Promise<void>;
  signOutBusy: boolean;
}) {
  const [selectedBillingPlan, setSelectedBillingPlan] = useState<BillingPlanKey>('annual');
  const selectedPlan = billingPlans.find((plan) => plan.key === selectedBillingPlan) ?? billingPlans[0];

  return (
    <div className="screen-stack">
      <section className="trial-card">
        <div>
          <span>14-Day Free Trial</span>
          <strong>Your trial has ended</strong>
          <p>Choose a paid plan to continue managing machines, maintenance records, manuals, reports, and Repair Assist.</p>
        </div>
        <div className="trial-days">
          <strong>0</strong>
          <span>days left</span>
        </div>
      </section>

      <section className="content-section subscription-card">
        <div className="section-heading">
          <h2>Choose a plan to continue</h2>
          <span>Annual recommended</span>
        </div>
        <div className="billing-plan-grid" role="radiogroup" aria-label="Subscription plan">
          {billingPlans.map((plan) => (
            <button
              key={plan.key}
              className={`billing-plan-option ${selectedBillingPlan === plan.key ? 'is-selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={selectedBillingPlan === plan.key}
              onClick={() => setSelectedBillingPlan(plan.key)}
            >
              <span className="billing-plan-header">
                <strong>{plan.name}</strong>
                {plan.recommended && <small>Best value</small>}
              </span>
              <span className="billing-plan-price">
                <b>{plan.price}</b>
                <em>{plan.cadence}</em>
              </span>
              <span className="billing-plan-detail">{plan.detail}</span>
            </button>
          ))}
        </div>
        <div className="subscription-actions">
          <button
            className="primary-action"
            type="button"
            disabled={billingBusyAction !== null}
            onClick={() => void onStartSubscription(selectedBillingPlan)}
          >
            <CreditCard size={18} />
            {billingBusyAction === 'checkout' ? 'Starting...' : `Start ${selectedPlan.name} Plan`}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={billingBusyAction !== null}
            onClick={() => void onManageBilling()}
          >
            {billingBusyAction === 'portal' ? 'Opening...' : 'Manage Billing'}
          </button>
          <button className="secondary-action" type="button" onClick={() => void onSignOut()} disabled={signOutBusy}>
            {signOutBusy ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
        {billingError && (
          <div className="auth-message">
            <strong>Billing action failed</strong>
            <span>{billingError}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountScreen({
  authSession,
  userProfile,
  orgConnected,
  organizationTrial,
  signOutBusy,
  signOutError,
  onSignOut,
  billingBusyAction,
  billingError,
  onStartSubscription,
  onManageBilling,
}: {
  authSession: ReturnType<typeof useAuthSession>;
  userProfile: ReturnType<typeof useUserProfile>;
  orgConnected: boolean;
  organizationTrial: OrganizationTrialState;
  signOutBusy: boolean;
  signOutError: string | null;
  onSignOut: () => Promise<void>;
  billingBusyAction: BillingAction | null;
  billingError: string | null;
  onStartSubscription: (billingPlan: BillingPlanKey) => Promise<void>;
  onManageBilling: () => Promise<void>;
}) {
  const [selectedBillingPlan, setSelectedBillingPlan] = useState<BillingPlanKey>('annual');
  const selectedPlan = billingPlans.find((plan) => plan.key === selectedBillingPlan) ?? billingPlans[0];
  const trialExpired = organizationTrial.status === 'expired';
  const paidSubscription = organizationTrial.subscriptionStatus === 'active';
  const trialing = organizationTrial.subscriptionStatus === 'trialing' && !trialExpired;
  const trialLabel = paidSubscription ? 'Subscription active' : trialExpired ? 'Trial ended' : 'Pro trial active';

  return (
    <div className="screen-stack">
      <section className="account-hero">
        <div className="account-hero-icon">
          <Building2 size={24} />
        </div>
        <div>
          <span>Company Account</span>
          <strong>LaundryOps Company</strong>
          <p>One company account manages your machines, maintenance records, manuals, and reports.</p>
        </div>
      </section>

      <section className="content-section profile-card">
        <div className="section-heading">
          <h2>User Session</h2>
          {authSession.user ? <StatusBadge status="running">Authenticated</StatusBadge> : <StatusBadge status="down">Signed Out</StatusBadge>}
        </div>
        {!authSession.configured && (
          <div className="profile-status-line">
            <ShieldCheck size={17} />
            <span>Firebase config is not set. Add VITE_FIREBASE_* values to enable live account access.</span>
          </div>
        )}
        {authSession.configured && authSession.loading && (
          <div className="profile-status-line">
            <Hourglass size={17} />
            <span>Checking active session...</span>
          </div>
        )}
        {authSession.configured && authSession.error && (
          <div className="profile-status-line profile-status-error">
            <ShieldCheck size={17} />
            <span>{authSession.error}</span>
          </div>
        )}
        {authSession.user && (
          <div className="profile-grid">
            <ProfileValue label="UID" value={authSession.user.uid} />
            <ProfileValue label="Session Email" value={authSession.user.email ?? 'No email'} />
            <ProfileValue label="Profile Name" value={userProfile.profile?.displayName ?? authSession.user.displayName ?? 'Not set'} />
            <ProfileValue label="Source" value={userProfile.profile?.createdFrom ?? 'No profile document yet'} />
          </div>
        )}
        {authSession.user && userProfile.loading && (
          <div className="profile-status-line">
            <Hourglass size={17} />
            <span>Reading `users/{'{uid}'}` profile document...</span>
          </div>
        )}
        {authSession.user && userProfile.error && (
          <div className="profile-status-line profile-status-error">
            <ShieldCheck size={17} />
            <span>{userProfile.error}</span>
          </div>
        )}
        <div className="profile-actions">
          <button className="secondary-action" type="button" onClick={() => void onSignOut()} disabled={!authSession.user || signOutBusy}>
            {signOutBusy ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
        {signOutError && (
          <div className="auth-message">
            <strong>Sign-out failed</strong>
            <span>{signOutError}</span>
          </div>
        )}
      </section>

      <section className="trial-card">
        <div>
          <span>14-Day Free Trial</span>
          <strong>{trialLabel}</strong>
          <p>
            {trialExpired
              ? 'Choose a paid plan to continue using LaundryOps.'
              : paidSubscription
                ? 'Your company subscription is active.'
                : `Trial includes maintenance records, reports, manual uploads, and OpenAI Repair Assist. Ends ${formatTrialDate(organizationTrial.trialEndsAtMs)}.`}
          </p>
        </div>
        <div className="trial-days">
          <strong>{trialing ? trialDaysRemaining(organizationTrial.trialEndsAtMs) : paidSubscription ? '✓' : '0'}</strong>
          <span>{trialing ? 'days left' : paidSubscription ? 'active' : 'days left'}</span>
        </div>
      </section>

      <section className="account-stat-grid">
        {accountStats.map((stat) => (
          <AccountStatTile key={stat.id} stat={stat} />
        ))}
      </section>
      {accountStats.length === 0 && <p className="empty-state">No account metrics yet.</p>}

      <section className="content-section subscription-card">
        <div className="section-heading">
          <h2>{trialExpired ? 'Choose a plan to continue' : 'Choose your plan after your 14-day free trial'}</h2>
          <span>Annual recommended</span>
        </div>
        <div className="subscription-line">
          <CreditCard size={18} />
          <div>
            <strong>One company subscription</strong>
            <span>Use one login for the full machine and repair workflow.</span>
          </div>
        </div>
        <div className="billing-plan-grid" role="radiogroup" aria-label="Subscription plan">
          {billingPlans.map((plan) => (
            <button
              key={plan.key}
              className={`billing-plan-option ${selectedBillingPlan === plan.key ? 'is-selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={selectedBillingPlan === plan.key}
              onClick={() => setSelectedBillingPlan(plan.key)}
            >
              <span className="billing-plan-header">
                <strong>{plan.name}</strong>
                {plan.recommended && <small>Best value</small>}
              </span>
              <span className="billing-plan-price">
                <b>{plan.price}</b>
                <em>{plan.cadence}</em>
              </span>
              <span className="billing-plan-detail">{plan.detail}</span>
            </button>
          ))}
        </div>
        <div className="subscription-actions">
          <button
            className="primary-action"
            type="button"
            disabled={!orgConnected || billingBusyAction !== null}
            onClick={() => void onStartSubscription(selectedBillingPlan)}
          >
            <CreditCard size={18} />
            {billingBusyAction === 'checkout' ? 'Starting...' : `Start ${selectedPlan.name} Plan`}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={!orgConnected || billingBusyAction !== null}
            onClick={() => void onManageBilling()}
          >
            {billingBusyAction === 'portal' ? 'Opening...' : 'Manage Billing'}
          </button>
        </div>
        {!orgConnected && (
          <p className="search-hint">Complete onboarding first to connect billing to your organization account.</p>
        )}
        {billingError && (
          <div className="auth-message">
            <strong>Billing action failed</strong>
            <span>{billingError}</span>
          </div>
        )}
      </section>

      <section className="content-section admin-card">
        <div className="section-heading">
          <h2>Admin Readiness</h2>
          <span>Launch setup</span>
        </div>
        <div className="admin-actions">
          <AdminAction icon={UsersRound} title="Account Access" detail="Every user signs up for their own paid workspace" />
          <AdminAction icon={ShieldCheck} title="Data Separation" detail="Every record belongs to one company account" />
          <AdminAction icon={FileText} title="Billing Decision" detail="Finalize Google Play or SaaS billing path before launch" />
        </div>
      </section>
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AccountStatTile({ stat }: { stat: AccountStat }) {
  return (
    <div className="account-stat-tile">
      <span>{stat.label}</span>
      <strong>{stat.value}</strong>
      <small>{stat.detail}</small>
    </div>
  );
}

function AdminAction({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof UsersRound;
  title: string;
  detail: string;
}) {
  return (
    <div className="admin-action">
      <span><Icon size={18} /></span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function CreateWorkOrderScreen({
  onSave,
  busy,
  error,
  machine,
  orgConnected,
  organizationId,
  availableMachines = [],
  onSetMachineStatus,
}: {
  onSave: (entry: WorkOrderCostEntry) => Promise<void>;
  busy: boolean;
  error: string | null;
  machine: UrgentMachine | null;
  orgConnected: boolean;
  organizationId: string | null;
  availableMachines?: UrgentMachine[];
  onSetMachineStatus?: (machineId: string, status: MachineOperationalStatus) => Promise<void>;
}) {
  const [maintenanceType, setMaintenanceType] = useState('Standard Repair');
  const [repairType, setRepairType] = useState('');
  const [status, setStatus] = useState<'planned' | 'in-progress' | 'completed'>('planned');
  const [maintenanceDate, setMaintenanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [technicianName, setTechnicianName] = useState(aiWorkOrderDraft.assignee);
  const [symptoms, setSymptoms] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [machineStatus, setMachineStatus] = useState<MachineOperationalStatus>('running');
  const [partsCostInput, setPartsCostInput] = useState('');
  const [laborCostInput, setLaborCostInput] = useState('');
  const [otherCostInput, setOtherCostInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [techNoteError, setTechNoteError] = useState<string | null>(null);
  const [machineStatusError, setMachineStatusError] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [assistantManualTitle, setAssistantManualTitle] = useState<string | null>(null);
  const [assistantGrounded, setAssistantGrounded] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(machine?.id ?? null);
  const statusOptions: Array<'planned' | 'in-progress' | 'completed'> = ['planned', 'in-progress', 'completed'];
  const selectedMachine = useMemo(() => {
    if (selectedMachineId) {
      const selected = availableMachines.find((entry) => entry.id === selectedMachineId);
      if (selected) {
        return selected;
      }
    }

    return machine ?? null;
  }, [availableMachines, machine, selectedMachineId]);
  const draftMachineNumber = selectedMachine?.machineNumber ?? aiWorkOrderDraft.machineNumber;
  const draftMachineModel = selectedMachine?.make && selectedMachine?.modelNumber
    ? `${selectedMachine.make} ${selectedMachine.modelNumber}`.trim()
    : selectedMachine?.make ?? selectedMachine?.modelNumber ?? selectedMachine?.type ?? aiWorkOrderDraft.machineModel;
  const hasMachineContext = Boolean(selectedMachine?.id);
  const parsedPartsCost = parseUsdAmount(partsCostInput);
  const parsedLaborCost = parseUsdAmount(laborCostInput);
  const parsedOtherCost = parseUsdAmount(otherCostInput);
  const totalCost = (parsedPartsCost ?? 0) + (parsedLaborCost ?? 0) + (parsedOtherCost ?? 0);

  useEffect(() => {
    if (machine?.id && machine?.status) {
      setSelectedMachineId(machine.id);
    }
    if (selectedMachine?.status) {
      setMachineStatus(toOperationalStatus(selectedMachine.status));
      return;
    }
    setMachineStatus('running');
  }, [machine?.id, machine?.status, selectedMachine?.id, selectedMachine?.status]);

  const submitCreateWorkOrder = async (): Promise<void> => {
    const partsCost = parseUsdAmount(partsCostInput);
    const laborCost = parseUsdAmount(laborCostInput);
    const otherCost = parseUsdAmount(otherCostInput);
    const hasInvalidCostInput = [partsCostInput, laborCostInput, otherCostInput].some((value) => value.trim() !== '' && parseUsdAmount(value) === null);
    if (hasInvalidCostInput) {
      setTechNoteError('Enter valid numbers for parts, labor, and other cost fields.');
      return;
    }
    const finalPartsCost = partsCost ?? 0;
    const finalLaborCost = laborCost ?? 0;
    const finalOtherCost = otherCost ?? 0;
    if (!orgConnected || !organizationId) {
      setTechNoteError('Complete onboarding first before saving maintenance records.');
      return;
    }
    if (!selectedMachine?.id || !hasMachineContext) {
      setTechNoteError('Choose a machine before saving this maintenance record.');
      return;
    }
    if (!maintenanceDate.trim()) {
      setTechNoteError('Set a maintenance date for this maintenance record.');
      return;
    }
    const hasTechnicianEntry =
      symptoms.trim().length > 0
      || repairType.trim().length > 0
      || errorCode.trim().length > 0
      || notesInput.trim().length > 0
      || finalPartsCost > 0
      || finalLaborCost > 0
      || finalOtherCost > 0;
    if (!hasTechnicianEntry) {
      setTechNoteError('Add symptoms, issue type, notes, an error code, or a cost before saving.');
      return;
    }

    setTechNoteError(null);
    setAssistantError(null);
    await onSave({
      machineId: selectedMachine.id,
      maintenanceDate,
      status,
      maintenanceType,
      repairType: repairType.trim() || 'General Repair',
      technicianName,
      symptoms,
      errorCode,
      partsCost: finalPartsCost,
      laborCost: finalLaborCost,
      otherCost: finalOtherCost,
      notes: notesInput,
      aiDiagnosis: assistantAnswer ?? '',
    });
  };

  const runAiDiagnosis = async (): Promise<void> => {
    if (assistantLoading) {
      return;
    }
    if (!hasMachineContext) {
      setAssistantError('Keep this maintenance record tied to a machine before running AI Diagnose.');
      return;
    }
    if (!symptoms.trim() && !errorCode.trim()) {
      setAssistantError('Add symptoms or an error code, then click AI Diagnose.');
      return;
    }
    if (!orgConnected || !organizationId) {
      setAssistantError('Complete onboarding first before using AI diagnostics.');
      return;
    }
    setAssistantError(null);
    setAssistantLoading(true);
    try {
      const result = await generateManualRepairAssist({
        organizationId,
        machineModel: draftMachineModel,
        symptoms,
        errorCode,
        machineId: selectedMachine?.id,
        machineNumber: selectedMachine?.machineNumber,
      });
      setAssistantAnswer(result.answer);
      setAssistantGrounded(result.grounded);
      setAssistantManualTitle(result.manual?.title ?? null);
    } catch (diagError) {
      setAssistantError(getErrorMessage(diagError, 'Could not generate AI diagnosis.'));
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleMachineStatusChange = async (nextStatus: MachineOperationalStatus): Promise<void> => {
    const previousStatus = machineStatus;
    if (!selectedMachine?.id) {
      setMachineStatusError('Open this form from a machine to update machine status.');
      return;
    }
    if (nextStatus === machineStatus || !onSetMachineStatus || !selectedMachine?.id) {
      return;
    }

    setMachineStatusError(null);
    setMachineStatus(nextStatus);
    try {
      await onSetMachineStatus(selectedMachine.id, nextStatus);
    } catch {
      setMachineStatus(previousStatus);
      setMachineStatusError('Could not update machine status. Please try again.');
    }
  };

  return (
    <div className="screen-stack">
      <section className="draft-machine-card">
        <MachineThumb />
        <div>
          <span>Machine</span>
          <strong>{draftMachineNumber}</strong>
          <small>{draftMachineModel}</small>
        </div>
        <CalendarClock size={20} />
      </section>

      {availableMachines.length > 0 && (
        <section className="content-section compact">
          <label className="review-field">
            <span>Machine</span>
            <select
              value={selectedMachineId ?? ''}
              onChange={(event) => {
                setSelectedMachineId(event.target.value || null);
                setMachineStatusError(null);
              }}
            >
              <option value="" disabled>
                Select machine
              </option>
              {availableMachines.map((machineOption) => (
                <option key={machineOption.id} value={machineOption.id}>
                  {machineOption.machineNumber} - {machineOption.make ?? ''} {machineOption.modelNumber ?? machineOption.type}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <section className="content-section compact">
        <label className="review-field">
          <span>Maintenance Date</span>
          <input
            type="date"
            value={maintenanceDate}
            onChange={(event) => {
              setMaintenanceDate(event.target.value);
              setTechNoteError(null);
            }}
            required
          />
        </label>
      </section>
      {!machine && availableMachines.length === 0 && (
        <section className="content-section compact">
          <div className="auth-message">
            <strong>No machine selected</strong>
            <span>Open this form from a machine card or add a machine first.</span>
          </div>
        </section>
      )}

      <section className="review-card">
        <div className="review-heading">
          <h2>Maintenance Record</h2>
          <span>Track issue details, labor parts, and status.</span>
        </div>
        <label className="review-field">
          <span>Issue / Symptoms (optional)</span>
          <div className="symptoms-ai-row">
            <textarea
              value={symptoms}
              placeholder="Describe what the machine is doing"
              rows={3}
              onChange={(event) => {
                setSymptoms(event.target.value);
                setAssistantError(null);
              }}
            />
            <button
              className="row-action-button row-action-ai"
              type="button"
              onClick={() => void runAiDiagnosis()}
              disabled={assistantLoading}
            >
              <Sparkles size={14} /> {assistantLoading ? 'Diagnosing...' : 'AI Diagnose'}
            </button>
          </div>
        </label>
      <section className="content-section compact">
        <h2>Machine Status</h2>
        <div className="machine-status-toggle detail-status-toggle" role="group" aria-label={`Machine status for ${draftMachineNumber}`}>
          {(
            [
              ['running', 'Operational'],
              ['needs-repair', 'Needs Repair'],
              ['down', 'Down'],
            ] as Array<[MachineOperationalStatus, string]>
          ).map(([statusKey, statusLabel]) => (
            <button
              key={statusKey}
              type="button"
              className={`status-chip ${machineStatus === statusKey ? `status-chip-${statusKey} is-active` : ''}`}
              onClick={() => void handleMachineStatusChange(statusKey)}
              disabled={busy || !onSetMachineStatus}
              aria-pressed={machineStatus === statusKey}
            >
              {statusLabel}
            </button>
          ))}
        </div>
        {machineStatusError && (
          <div className="auth-message">
            <strong>Machine status update</strong>
            <span>{machineStatusError}</span>
          </div>
        )}
        {!selectedMachine?.id && <p className="empty-state">Choose a machine first to update machine status.</p>}
      </section>
        <div className="review-field-grid">
          <label className="review-field">
            <span>Issue Type</span>
            <input
              value={repairType}
              placeholder="Example: door strike, leaks, no spin"
              onChange={(event) => setRepairType(event.target.value)}
            />
          </label>
          <label className="review-field">
            <span>Maintenance Category</span>
            <select
              value={maintenanceType}
              onChange={(event) => setMaintenanceType(event.target.value)}
            >
              <option value="Standard Repair">Standard Repair</option>
              <option value="Preventive">Preventive</option>
              <option value="Routine Maint">Routine Maint</option>
            </select>
          </label>
        </div>
        <label className="review-field">
          <span>Error Code (if shown)</span>
          <input
            value={errorCode}
            placeholder="Example: E DL"
            onChange={(event) => setErrorCode(event.target.value)}
          />
        </label>
        <div className="review-field-grid">
          <label className="review-field">
            <span>Technician</span>
            <input
              value={technicianName}
              onChange={(event) => setTechnicianName(event.target.value)}
              placeholder="Technician handling this record"
            />
          </label>
          <label className="review-field">
            <span>Record Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as 'planned' | 'in-progress' | 'completed')}>
              {statusOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption === 'in-progress' ? 'In Progress' : statusOption === 'completed' ? 'Completed' : 'Planned'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="source-card">
        <div className="source-card-icon"><Sparkles size={20} /></div>
        <div>
          <strong>AI Repair Assist</strong>
          <span>{assistantManualTitle || 'Manual-backed guidance (if available)'}</span>
          <small>{assistantGrounded ? 'Manual-backed answer ready' : hasMachineContext ? 'Enter symptoms or error code, then click AI Diagnose' : 'Select machine first to use AI Diagnose'}</small>
        </div>
      </section>

      {assistantAnswer && (
        <section className="task-card">
          <div className="section-heading">
            <h2>Diagnosis Result</h2>
          </div>
          <div className="task-list">
            {assistantAnswer.split('\n').map((line, index) => (
              <div className="task-row" key={`${line}-${index}`}>
                <span>{index + 1}</span>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {assistantError && (
        <div className="auth-message">
          <strong>AI Diagnose</strong>
          <span>{assistantError}</span>
        </div>
      )}

      <section className="cost-card">
        <h2>Technician Entry</h2>
        <label className="review-field">
          <span>Parts Cost</span>
          <input
            value={partsCostInput}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => setPartsCostInput(event.target.value)}
          />
        </label>
        <label className="review-field">
          <span>Labor Cost</span>
          <input
            value={laborCostInput}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => setLaborCostInput(event.target.value)}
          />
        </label>
        <label className="review-field">
          <span>Other Cost</span>
          <input
            value={otherCostInput}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => setOtherCostInput(event.target.value)}
          />
        </label>
        <label className="review-field">
          <span>Tech Notes</span>
          <textarea
            value={notesInput}
            rows={3}
            placeholder="Work notes, observations, part numbers, follow-up items"
            onChange={(event) => setNotesInput(event.target.value)}
          />
        </label>
        {techNoteError && (
          <div className="auth-message">
            <strong>Maintenance record required</strong>
            <span>{techNoteError}</span>
          </div>
        )}
        <div className="cost-total">
          <span>Total Cost</span>
          <strong>{formatUsdAmount(totalCost)}</strong>
        </div>
      </section>

      {error && (
        <div className="auth-message">
          <strong>Could not create maintenance record</strong>
          <span>{error}</span>
        </div>
      )}

      <button className="primary-action sticky-action" type="button" onClick={() => void submitCreateWorkOrder()} disabled={busy}>
        <ClipboardCheck size={19} /> {busy ? 'Saving...' : 'Save Maintenance Record'}
      </button>
    </div>
  );
}

function WorkOrdersScreen({
  setActiveScreen,
  onCreateWorkOrder,
  onOpenWorkOrderDetail,
  onOpenMachineDetail,
  onDeleteWorkOrder,
  workOrderQueueData,
  orgConnected,
  orgWorkOrdersLoading,
  orgWorkOrdersError,
  workOrderDeleteBusyId,
  workOrderDeleteError,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  onCreateWorkOrder: () => void;
  onOpenWorkOrderDetail: (workOrderId: string) => void;
  onOpenMachineDetail: (machineId: string) => void;
  onDeleteWorkOrder: (workOrderId: string) => Promise<void>;
  workOrderQueueData: WorkOrderSummary[];
  orgConnected: boolean;
  orgWorkOrdersLoading: boolean;
  orgWorkOrdersError: string | null;
  workOrderDeleteBusyId: string | null;
  workOrderDeleteError: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriorityFilter>('all');
  const filteredOrders = useMemo(() => {
    return workOrderQueueData.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [priorityFilter, statusFilter, workOrderQueueData]);
  const totalCount = workOrderQueueData.length;
  const inProgressCount = workOrderQueueData.filter((order) => order.status === 'in-progress').length;
  const completedCount = workOrderQueueData.filter((order) => order.status === 'completed').length;
  const plannedCount = workOrderQueueData.filter((order) => order.status === 'planned').length;

  return (
    <div className="screen-stack">
      <section className="work-order-summary">
        <WorkQueueStat label="Total" value={String(totalCount)} />
        <WorkQueueStat label="Planned" value={String(plannedCount)} tone="down" />
        <WorkQueueStat label="In Progress" value={String(inProgressCount)} tone="down" />
        <WorkQueueStat label="Completed" value={String(completedCount)} />
      </section>

      <section className="content-section work-filter-card">
        <div className="section-heading">
          <h2>Maintenance Records</h2>
          <button type="button" onClick={onCreateWorkOrder}><Plus size={14} /> New Record</button>
        </div>
        <div className="work-filter-block">
          <div className="filter-label">
            <Filter size={14} />
            <span>Record Status</span>
          </div>
          <div className="work-status-filter" aria-label="Maintenance record status filters">
            {workOrderStatusFilters.map((filter) => (
              <button
                className={statusFilter === filter.key ? 'is-selected' : ''}
                key={filter.key}
                type="button"
                aria-pressed={statusFilter === filter.key}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="work-filter-block">
          <div className="filter-label">
            <Filter size={14} />
            <span>Priority</span>
          </div>
          <div className="work-priority-filter" aria-label="Maintenance record priority filters">
            {workOrderPriorityFilters.map((filter) => (
              <button
                className={priorityFilter === filter.key ? 'is-selected' : ''}
                key={filter.key}
                type="button"
                aria-pressed={priorityFilter === filter.key}
                onClick={() => setPriorityFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="work-order-list" aria-live="polite">
        {orgConnected && orgWorkOrdersLoading && <p className="search-hint">Refreshing maintenance records from your company data...</p>}
        {orgConnected && orgWorkOrdersError && <p className="empty-state">Could not load live maintenance records: {orgWorkOrdersError}</p>}
        <div className="list-count-line">
          <strong>{filteredOrders.length} shown</strong>
          <span>{statusFilter === 'all' ? 'All statuses' : workOrderStatusFilters.find((filter) => filter.key === statusFilter)?.label}</span>
        </div>
        {filteredOrders.map((order) => (
          <WorkOrderQueueRow
            key={order.id}
            order={order}
            busy={workOrderDeleteBusyId === order.id}
            onClick={() => onOpenWorkOrderDetail(order.id)}
            onOpenMachine={() => {
              if (order.machineId) {
                onOpenMachineDetail(order.machineId);
              }
            }}
            onDelete={() => void onDeleteWorkOrder(order.id)}
          />
        ))}
        {filteredOrders.length === 0 && <p className="empty-state">No maintenance records match your filters.</p>}
        {workOrderDeleteError && <p className="empty-state">{workOrderDeleteError}</p>}
      </section>
    </div>
  );
}

function WorkQueueStat({ label, value, tone }: { label: string; value: string; tone?: 'down' | 'waiting' }) {
  return (
    <div className="work-queue-stat">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function WorkOrderQueueRow({
  order,
  onClick,
  onOpenMachine,
  onDelete,
  busy = false,
}: {
  order: WorkOrderSummary;
  onClick: () => void;
  onOpenMachine?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`work-order-card wo-${order.status}`}>
      <button className="work-order-row" type="button" onClick={onClick}>
        <div className="work-row-top">
          <div>
            <span>{order.number}</span>
            <strong>{order.machineNumber} / {order.title}</strong>
          </div>
          <StatusBadge status={priorityToBadgeStatus(order.priority)}>{order.priority}</StatusBadge>
        </div>
        <div className="work-row-meta">
          <span>{order.machineModel}</span>
          <span>{order.machineNumber}</span>
        </div>
        <div className="work-row-footer">
          <WorkOrderStatusBadge status={order.status}>{order.statusLabel}</WorkOrderStatusBadge>
          <span>{order.assignee}</span>
          <span>{order.due}</span>
          <strong>{order.estimate}</strong>
        </div>
        <div className="work-row-source">
          <span>{order.source}</span>
          <ChevronRight size={17} />
        </div>
      </button>
      <div className="work-order-actions">
        {onOpenMachine && order.machineId && (
          <button className="row-action-button row-action-ai" type="button" onClick={onOpenMachine} disabled={busy}>
            <Building2 size={14} /> Machine
          </button>
        )}
        <button className="row-action-button row-action-primary" type="button" onClick={onClick} disabled={busy}>
          <Pencil size={14} /> Open
        </button>
        {onDelete && (
          <button className="row-action-button row-action-delete" type="button" onClick={onDelete} disabled={busy}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

function priorityToBadgeStatus(priority: WorkOrderPriority): MachineStatus | 'primary' | 'down' {
  if (priority === 'High') {
    return 'down';
  }

  if (priority === 'Low') {
    return 'running';
  }

  return 'primary';
}

function WorkOrderStatusBadge({ status, children }: { status: WorkOrderStatus; children: React.ReactNode }) {
  return <span className={`work-status-pill work-status-${status}`}>{children}</span>;
}

function WorkOrderDetailScreen({
  setActiveScreen,
  createdFromDraft,
  order,
  machine,
  busy,
  error,
  machineStatusBusy,
  machineStatusError,
  orgConnected,
  organizationId,
  onUpdateDetails,
  onSetMachineStatus,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  createdFromDraft: boolean;
  order: WorkOrderSummary | null;
  machine: UrgentMachine | null;
  busy: boolean;
  error: string | null;
  machineStatusBusy: boolean;
  machineStatusError: string | null;
  orgConnected: boolean;
  organizationId: string | null;
  onUpdateDetails: (entry: WorkOrderDetailsEntry) => Promise<void>;
  onSetMachineStatus: (machineId: string, status: MachineOperationalStatus) => Promise<void>;
}) {
  const statusOptions: Array<'planned' | 'in-progress' | 'completed'> = ['planned', 'in-progress', 'completed'];
  const [selectedStatus, setSelectedStatus] = useState<'planned' | 'in-progress' | 'completed'>('planned');
  const statusLabelText = order?.status === 'in-progress'
    ? 'In Progress'
    : order?.status === 'completed'
      ? 'Completed'
      : 'Planned';
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('Standard Repair');
  const [repairType, setRepairType] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [partsCostInput, setPartsCostInput] = useState('');
  const [laborCostInput, setLaborCostInput] = useState('');
  const [otherCostInput, setOtherCostInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [aiDiagnosisInput, setAiDiagnosisInput] = useState('');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailAssistantError, setDetailAssistantError] = useState<string | null>(null);
  const [detailAssistantMessage, setDetailAssistantMessage] = useState<string | null>(null);
  const [detailAssistantLoading, setDetailAssistantLoading] = useState(false);
  const [isDetailDirty, setIsDetailDirty] = useState(false);
  const [loadedDetailOrderId, setLoadedDetailOrderId] = useState<string | null>(null);
  const [pendingSavedSignature, setPendingSavedSignature] = useState<string | null>(null);
  const machineOperationalStatus = machine ? toOperationalStatus(machine.status) : null;
  const parsedPartsCost = parseUsdAmount(partsCostInput);
  const parsedLaborCost = parseUsdAmount(laborCostInput);
  const parsedOtherCost = parseUsdAmount(otherCostInput);
  const totalCost = (parsedPartsCost ?? 0) + (parsedLaborCost ?? 0) + (parsedOtherCost ?? 0);
  const detailInputsDisabled = busy || detailAssistantLoading || !orgConnected || pendingSavedSignature !== null;

  useEffect(() => {
    if (!order) {
      setSelectedStatus('planned');
      setMaintenanceDate('');
      setMaintenanceType('Standard Repair');
      setRepairType('');
      setTechnicianName('');
      setSymptoms('');
      setErrorCode('');
      setPartsCostInput('');
      setLaborCostInput('');
      setOtherCostInput('');
      setNotesInput('');
      setAiDiagnosisInput('');
      setDetailAssistantError(null);
      setDetailAssistantMessage(null);
      setDetailAssistantLoading(false);
      setIsDetailDirty(false);
      setLoadedDetailOrderId(null);
      setPendingSavedSignature(null);
      return;
    }

    const orderSignature = workOrderSummarySignature(order);
    const confirmedPendingSave = pendingSavedSignature === orderSignature;
    if (loadedDetailOrderId === order.id && isDetailDirty && !confirmedPendingSave) {
      return;
    }

    if (order.status === 'in-progress' || order.status === 'completed' || order.status === 'planned') {
      setSelectedStatus(order.status);
    } else {
      setSelectedStatus('planned');
    }
    setMaintenanceDate(toDateInputValue(order.maintenanceDate));
    setMaintenanceType(order.maintenanceType ?? 'Standard Repair');
    setRepairType(order.repairType ?? '');
    setTechnicianName(order.assignee ?? '');
    setSymptoms(order.symptoms ?? '');
    setErrorCode(order.errorCode ?? '');
    setPartsCostInput(order.partsCost ?? '');
    setLaborCostInput(order.laborCost ?? '');
    setOtherCostInput(order.otherCost ?? '');
    setNotesInput(order.notes ?? '');
    setAiDiagnosisInput(order.aiDiagnosis ?? '');
    setDetailError(null);
    setDetailAssistantError(null);
    setDetailAssistantMessage(null);
    setLoadedDetailOrderId(order.id);
    setIsDetailDirty(false);
    if (confirmedPendingSave) {
      setPendingSavedSignature(null);
    }
  }, [
    isDetailDirty,
    loadedDetailOrderId,
    order?.aiDiagnosis,
    order?.assignee,
    order?.errorCode,
    order?.id,
    order?.laborCost,
    order?.maintenanceType,
    order?.notes,
    order?.otherCost,
    order?.partsCost,
    order?.repairType,
    order?.maintenanceDate,
    order?.status,
    order?.symptoms,
    pendingSavedSignature,
  ]);

  const buildSavedDetailsEntry = (aiDiagnosisOverride = aiDiagnosisInput): WorkOrderDetailsEntry | null => {
    const partsCost = parseUsdAmount(partsCostInput);
    const laborCost = parseUsdAmount(laborCostInput);
    const otherCost = parseUsdAmount(otherCostInput);
    const hasInvalidCostInput = [partsCostInput, laborCostInput, otherCostInput].some((value) => value.trim() !== '' && parseUsdAmount(value) === null);
    if (hasInvalidCostInput) {
      setDetailError('Enter valid numbers for parts, labor, and other cost fields.');
      return null;
    }
    if (!maintenanceDate.trim()) {
      setDetailError('Set a maintenance date for this maintenance record.');
      return null;
    }

    return {
      maintenanceDate,
      status: selectedStatus,
      maintenanceType,
      repairType,
      technicianName,
      symptoms,
      errorCode,
      partsCost: partsCost ?? 0,
      laborCost: laborCost ?? 0,
      otherCost: otherCost ?? 0,
      notes: notesInput,
      aiDiagnosis: aiDiagnosisOverride,
    };
  };

  const submitUpdateDetails = async (): Promise<void> => {
    const savedEntry = buildSavedDetailsEntry();
    if (!savedEntry) {
      return;
    }

    setDetailError(null);
    setDetailAssistantError(null);
    setDetailAssistantMessage(null);
    try {
      await onUpdateDetails(savedEntry);
      setPendingSavedSignature(editableWorkOrderSignature(savedEntry));
    } catch {
      // The parent handler displays the Firestore error in the shared record banner.
    }
  };

  const runDetailAiDiagnosis = async (): Promise<void> => {
    if (detailAssistantLoading) {
      return;
    }
    if (!orgConnected || !organizationId) {
      setDetailAssistantError('Complete onboarding first before using AI diagnostics.');
      return;
    }
    if (!order) {
      setDetailAssistantError('Open a maintenance record before using AI diagnostics.');
      return;
    }
    if (!machine?.id) {
      setDetailAssistantError('This maintenance record must be linked to a machine before AI can save a diagnosis.');
      return;
    }
    if (!symptoms.trim() && !errorCode.trim()) {
      setDetailAssistantError('Enter symptoms or an error code before using AI Diagnose.');
      return;
    }

    const detailMachineModel = [machine.make?.trim(), machine.modelNumber?.trim()]
      .filter(Boolean)
      .join(' ') || order.machineModel;
    if (!detailMachineModel.trim()) {
      setDetailAssistantError('This machine needs make and model information before AI can find the correct manual.');
      return;
    }

    setDetailError(null);
    setDetailAssistantError(null);
    setDetailAssistantMessage(null);
    setDetailAssistantLoading(true);
    try {
      const result = await generateManualRepairAssist({
        organizationId,
        machineModel: detailMachineModel,
        symptoms,
        errorCode,
        machineId: machine.id,
        machineNumber: machine.machineNumber,
      });
      const savedEntry = buildSavedDetailsEntry(result.answer);
      setAiDiagnosisInput(result.answer);
      if (!savedEntry) {
        setIsDetailDirty(true);
        return;
      }

      await onUpdateDetails(savedEntry);
      setPendingSavedSignature(editableWorkOrderSignature(savedEntry));
      setDetailAssistantMessage(`AI diagnosis saved to this maintenance record${result.manual?.title ? ` from ${result.manual.title}` : ''}.`);
    } catch (diagError) {
      setDetailAssistantError(getErrorMessage(diagError, 'Could not generate and save AI diagnosis.'));
    } finally {
      setDetailAssistantLoading(false);
    }
  };

  if (!order) {
    return (
      <div className="screen-stack">
        <section className="content-section">
          <h2>No Maintenance Record Selected</h2>
          <p className="empty-state">Open a maintenance record from the list to view details.</p>
          <button className="secondary-action" type="button" onClick={() => setActiveScreen('work-orders')}>
            Back to Maintenance Records
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="screen-stack">
      {createdFromDraft && (
        <section className="created-banner">
          <Check size={17} />
          <div>
            <strong>Maintenance record created</strong>
            <span>Technician record details were saved.</span>
          </div>
        </section>
      )}

      <section className="work-title">
        <div>
          <h2>{order.machineNumber} {order.title}</h2>
          <span>{order.number} / {order.machineModel}</span>
        </div>
        <StatusBadge status={priorityToBadgeStatus(order.priority)}>{order.priority}</StatusBadge>
      </section>

      <section className="assignment-card">
        <div className="assignee">
          <div className="avatar"><UserRound size={18} /></div>
        <div>
          <span>Technician</span>
          <strong>{order.assignee}</strong>
          <small>Technician assigned to this maintenance record</small>
        </div>
      </div>
        <div className="status-box">
          <span>Status</span>
          <strong>{statusLabelText}</strong>
          <small>{order.due}</small>
        </div>
        <div className="status-box machine-status-box">
          <span>Machine Status</span>
          {machine && machineOperationalStatus ? (
            <div className="machine-status-toggle detail-status-toggle inline-status-toggle" role="group" aria-label={`Machine status for ${machine.machineNumber}`}>
              {(
                [
                  ['running', 'Operational'],
                  ['needs-repair', 'Needs Repair'],
                  ['down', 'Down'],
                ] as Array<[MachineOperationalStatus, string]>
              ).map(([statusKey, statusLabel]) => (
                <button
                  key={statusKey}
                  type="button"
                  className={`status-chip ${machineOperationalStatus === statusKey ? `status-chip-${statusKey} is-active` : ''}`}
                  onClick={() => void onSetMachineStatus(machine.id, statusKey)}
                  disabled={busy || machineStatusBusy || !orgConnected}
                  aria-pressed={machineOperationalStatus === statusKey}
                >
                  {statusLabel}
                </button>
              ))}
            </div>
          ) : (
            <small>Machine not linked</small>
          )}
        </div>
      </section>

      <section className="content-section compact">
        <label className="review-field">
          <span>Maintenance Date</span>
          <input
            type="date"
            value={maintenanceDate}
            onChange={(event) => {
              setMaintenanceDate(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
            required
          />
        </label>
      </section>

      {machineStatusError && (
        <div className="auth-message">
          <strong>Machine status update</strong>
          <span>{machineStatusError}</span>
        </div>
      )}

      <section className="review-card">
        <div className="review-heading">
          <h2>Maintenance Record Details</h2>
          <span>Edit repair details, costs, notes, and status.</span>
        </div>
        <div className="review-field-grid">
          <label className="review-field">
            <span>Maintenance Category</span>
            <select
              value={maintenanceType}
              onChange={(event) => {
                setMaintenanceType(event.target.value);
                setIsDetailDirty(true);
              }}
              disabled={detailInputsDisabled}
            >
              <option value="Standard Repair">Standard Repair</option>
              <option value="Preventive">Preventive</option>
              <option value="Routine Maint">Routine Maint</option>
            </select>
          </label>
          <label className="review-field">
            <span>Issue Type</span>
            <input
              value={repairType}
              placeholder="Example: door strike, leaks, no spin"
              onChange={(event) => {
                setRepairType(event.target.value);
                setIsDetailDirty(true);
              }}
              disabled={detailInputsDisabled}
            />
          </label>
        </div>
        <label className="review-field">
          <span>Symptoms / Issues</span>
          <textarea
            value={symptoms}
            rows={3}
            placeholder="Describe what the machine is doing"
            onChange={(event) => {
              setSymptoms(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          />
        </label>
        <div className="review-field-grid">
          <label className="review-field">
            <span>Error Code</span>
            <input
              value={errorCode}
              placeholder="Example: E DL"
              onChange={(event) => {
                setErrorCode(event.target.value);
                setIsDetailDirty(true);
              }}
              disabled={detailInputsDisabled}
            />
          </label>
          <label className="review-field">
            <span>Technician</span>
            <input
              value={technicianName}
              placeholder="Technician handling this record"
              onChange={(event) => {
                setTechnicianName(event.target.value);
                setIsDetailDirty(true);
              }}
              disabled={detailInputsDisabled}
            />
          </label>
        </div>
        <InfoBlock label="Machine Model" value={order.machineModel} />
        <label className="review-field">
          <span>Record Status</span>
          <select
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value as 'planned' | 'in-progress' | 'completed');
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          >
            {statusOptions.map((statusValue) => (
              <option key={statusValue} value={statusValue}>
                {statusValue === 'planned' ? 'Planned' : statusValue === 'in-progress' ? 'In Progress' : 'Completed'}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="content-section compact">
        <h2>Technician Notes</h2>
        <label className="review-field">
          <span>Notes</span>
          <textarea
            value={notesInput}
            rows={4}
            placeholder="Work notes, observations, part numbers, follow-up items"
            onChange={(event) => {
              setNotesInput(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          />
        </label>
      </section>

      <section className="content-section compact">
        <div className="section-heading">
          <div>
            <h2>AI Diagnosis</h2>
            <span>Diagnosis Result</span>
          </div>
          <button
            className="row-action-button row-action-ai"
            type="button"
            onClick={() => void runDetailAiDiagnosis()}
            disabled={detailInputsDisabled || !machine?.id}
          >
            <Sparkles size={14} /> {detailAssistantLoading ? 'Diagnosing...' : 'AI Diagnose'}
          </button>
        </div>
        <label className="review-field">
          <span>Diagnosis Result</span>
          <textarea
            value={aiDiagnosisInput}
            rows={5}
            placeholder="AI diagnosis can be saved here when used."
            onChange={(event) => {
              setAiDiagnosisInput(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          />
        </label>
        {detailAssistantMessage && <p className="search-hint">{detailAssistantMessage}</p>}
        {detailAssistantError && (
          <div className="auth-message">
            <strong>AI Diagnose</strong>
            <span>{detailAssistantError}</span>
          </div>
        )}
      </section>

      <section className="content-section compact">
        <h2>Photos</h2>
        <p className="empty-state">No photos attached yet.</p>
        <button
          className="secondary-action full-width-action"
          type="button"
          onClick={() => setPhotoMessage('Photo attachments are queued for the beta attachment workflow.')}
        >
          <Plus size={18} /> Add Photo
        </button>
        {photoMessage && (
          <div className="auth-message">
            <strong>Add Photo</strong>
            <span>{photoMessage}</span>
          </div>
        )}
      </section>

      <section className="cost-card">
        <h2>Parts & Cost</h2>
        <label className="review-field">
          <span>Parts Cost</span>
          <input
            value={partsCostInput}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => {
              setPartsCostInput(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          />
        </label>
        <label className="review-field">
          <span>Labor Cost</span>
          <input
            value={laborCostInput}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => {
              setLaborCostInput(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          />
        </label>
        <label className="review-field">
          <span>Other Cost</span>
          <input
            value={otherCostInput}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => {
              setOtherCostInput(event.target.value);
              setIsDetailDirty(true);
            }}
            disabled={detailInputsDisabled}
          />
        </label>
        <div className="cost-total">
          <span>Total Cost</span>
          <strong>{formatUsdAmount(totalCost)}</strong>
        </div>
      </section>

      {!orgConnected && (
        <div className="search-hint">
          <p>Connect onboarding first to save status updates.</p>
        </div>
      )}

      {error && (
        <div className="auth-message">
          <strong>Could not save maintenance record</strong>
          <span>{error}</span>
        </div>
      )}

      {detailError && (
        <div className="auth-message">
          <strong>Maintenance record details</strong>
          <span>{detailError}</span>
        </div>
      )}

      <button
        className="primary-action sticky-action"
        type="button"
        disabled={detailInputsDisabled}
        onClick={() => void submitUpdateDetails()}
      >
        <ClipboardCheck size={19} /> {busy ? 'Saving...' : 'Save Maintenance Record'}
      </button>
    </div>
  );
}

const NO_INDEXED_MANUAL_MESSAGE =
  'No machine manual has been uploaded and indexed for this machine model number, so AI Repair Assist cannot provide a manual-grounded answer. Upload the manufacturer repair manual using the exact model number before using AI Repair Assist.';

function repairAssistModelKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function repairAssistMachineModel(machine: UrgentMachine | null): string {
  return [machine?.make?.trim(), machine?.modelNumber?.trim()].filter(Boolean).join(' ');
}

function repairAssistMachineSummary(machine: UrgentMachine | null): string {
  if (!machine) {
    return 'Choose a machine number';
  }

  const machineModel = repairAssistMachineModel(machine);
  return machineModel ? `${machine.type} - ${machineModel}` : `${machine.type} - Make/model not set`;
}

function RepairAssistScreen({
  assistPreset,
  onClearAssistPreset,
  onCreateWorkOrder,
  orgConnected,
  organizationId,
  machines,
  manualModels,
}: {
  assistPreset: AssistPreset | null;
  onClearAssistPreset: () => void;
  onCreateWorkOrder: (machineId?: string | null) => void;
  orgConnected: boolean;
  organizationId: string | null;
  machines: UrgentMachine[];
  manualModels: ManualLibraryRow[];
}) {
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [manualGroundingEnabled, setManualGroundingEnabled] = useState(true);
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistAnswer, setAssistAnswer] = useState<string | null>(null);
  const [assistManualTitle, setAssistManualTitle] = useState<string | null>(null);
  const [assistGrounded, setAssistGrounded] = useState(false);
  const [assistModel, setAssistModel] = useState<string | null>(null);
  const [assistCitations, setAssistCitations] = useState<Array<{ chunkId: string; preview: string }>>([]);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const assistRequestIdRef = useRef(0);
  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === selectedMachineId) ?? null,
    [machines, selectedMachineId],
  );
  const machineModel = useMemo(() => repairAssistMachineModel(selectedMachine), [selectedMachine]);
  const selectedMachineHasMakeModel = Boolean(selectedMachine?.make?.trim() && selectedMachine?.modelNumber?.trim());
  const selectedModelHasIndexedManual = useMemo(() => {
    const selectedKey = repairAssistModelKey(selectedMachine?.modelNumber ?? '');
    if (!selectedKey) {
      return false;
    }

    return manualModels.some((manual) => {
      if (manual.status !== 'indexed') {
        return false;
      }
      const manualKey = repairAssistModelKey(`${manual.model} ${manual.title}`);
      return Boolean(manualKey && manualKey.includes(selectedKey));
    });
  }, [manualModels, selectedMachine?.modelNumber]);

  const clearAssistResult = (invalidateRequest = true): void => {
    if (invalidateRequest) {
      assistRequestIdRef.current += 1;
      setAssistBusy(false);
    }
    setAssistError(null);
    setAssistAnswer(null);
    setAssistManualTitle(null);
    setAssistGrounded(false);
    setAssistModel(null);
    setAssistCitations([]);
    setPhotoMessage(null);
  };

  useEffect(() => {
    clearAssistResult();
    setSelectedMachineId(assistPreset?.machineId ?? '');
    setSymptoms('');
    setErrorCode('');
  }, [assistPreset?.machineId]);

  useEffect(() => {
    if (machines.length > 0 && selectedMachineId && !machines.some((machine) => machine.id === selectedMachineId)) {
      setSelectedMachineId('');
      clearAssistResult();
    }
  }, [machines, selectedMachineId]);

  const runRepairAssist = async (): Promise<void> => {
    const requestId = assistRequestIdRef.current + 1;
    assistRequestIdRef.current = requestId;
    clearAssistResult(false);

    if (!manualGroundingEnabled) {
      setAssistAnswer('Manual grounding is turned off. Enable it to get manual-backed repair guidance.');
      setAssistGrounded(false);
      setAssistManualTitle(null);
      setAssistModel(null);
      setAssistCitations([]);
      return;
    }

    if (!orgConnected || !organizationId) {
      setAssistError('Complete onboarding first so Repair Assist can use your organization manuals.');
      return;
    }

    if (!selectedMachine) {
      setAssistError('Select a machine number before using Repair Assist.');
      return;
    }

    if (!selectedMachineHasMakeModel) {
      setAssistError('This machine needs make and model information before Repair Assist can find the correct manual.');
      return;
    }

    if (!selectedModelHasIndexedManual) {
      setAssistError(NO_INDEXED_MANUAL_MESSAGE);
      return;
    }

    if (!symptoms.trim() && !errorCode.trim()) {
      setAssistError('Enter symptoms or an error code before using Repair Assist.');
      return;
    }

    setAssistBusy(true);
    try {
      const result = await generateManualRepairAssist({
        organizationId,
        machineModel,
        symptoms,
        errorCode,
        machineId: selectedMachine.id,
        machineNumber: selectedMachine.machineNumber,
      });
      if (requestId !== assistRequestIdRef.current) {
        return;
      }
      setAssistAnswer(result.answer);
      setAssistGrounded(result.grounded);
      setAssistManualTitle(result.manual?.title ?? null);
      setAssistModel(result.model);
      setAssistCitations(result.citations);
    } catch (error) {
      if (requestId !== assistRequestIdRef.current) {
        return;
      }
      setAssistError(getErrorMessage(error, 'Could not generate manual-grounded guidance.'));
    } finally {
      if (requestId === assistRequestIdRef.current) {
        setAssistBusy(false);
      }
    }
  };

  return (
    <div className="screen-stack">
      <section className="assist-machine-card">
        <MachineThumb />
        <div>
          <strong>{selectedMachine?.machineNumber ?? 'Machine not selected'}</strong>
          <span>{repairAssistMachineSummary(selectedMachine)}</span>
          <small>{selectedMachine ? 'Machine context loaded from your machine list' : 'Select an entered machine number to load make/model'}</small>
        </div>
        <button
          type="button"
          onClick={() => {
            onClearAssistPreset();
            setSelectedMachineId('');
            setSymptoms('');
            setErrorCode('');
            clearAssistResult();
          }}
        >
          Change
        </button>
      </section>

      <section className="assist-form">
        <label>
          <span>Machine number</span>
          <select
            value={selectedMachineId}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedMachineId(nextValue);
              clearAssistResult();
            }}
            disabled={machines.length === 0}
          >
            <option value="" disabled>
              Select machine number
            </option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.machineNumber}
              </option>
            ))}
          </select>
        </label>
        {selectedMachine && !selectedModelHasIndexedManual && selectedMachineHasMakeModel && (
          <p className="search-hint">No indexed machine manual is available for this machine yet.</p>
        )}
        <label>
          <span>Symptoms (optional)</span>
          <input
            value={symptoms}
            onChange={(event) => {
              setSymptoms(event.target.value);
              clearAssistResult();
            }}
          />
        </label>
        <label>
          <span>Error Code</span>
          <input
            value={errorCode}
            onChange={(event) => {
              setErrorCode(event.target.value);
              clearAssistResult();
            }}
          />
        </label>
        <div className="assist-photos">
          <PhotoTile variant="pump" large />
          <button className="attach-photo" type="button" onClick={() => setPhotoMessage('Photo analysis is queued for the beta attachment workflow.')}>
            <Plus size={22} /> Add Photo
          </button>
        </div>
        {photoMessage && (
          <div className="auth-message">
            <strong>Add Photo</strong>
            <span>{photoMessage}</span>
          </div>
        )}
        <div className="manual-toggle">
          <div>
            <strong>Use uploaded manual as source of truth</strong>
            <span>
              {manualGroundingEnabled
                ? assistManualTitle
                  ? `${assistManualTitle} selected`
                  : 'Manual grounding is on'
                : 'Manual grounding is off'}
            </span>
          </div>
          <button
            className={manualGroundingEnabled ? 'toggle-on' : 'toggle-off'}
            type="button"
            role="switch"
            aria-checked={manualGroundingEnabled}
            aria-label={manualGroundingEnabled ? 'Manual grounding on' : 'Manual grounding off'}
            onClick={() => {
              setManualGroundingEnabled((value) => !value);
              clearAssistResult();
            }}
          />
        </div>
        <button className="secondary-action full-width-action" type="button" onClick={() => void runRepairAssist()} disabled={assistBusy}>
          {assistBusy ? 'Generating...' : 'Generate Repair Guidance'}
        </button>
        {!orgConnected && <p className="search-hint">Complete onboarding first to run live Repair Assist.</p>}
        {assistError && (
          <div className="auth-message">
            <strong>Repair Assist failed</strong>
            <span>{assistError}</span>
          </div>
        )}
      </section>

      <section className="ai-result-card">
        <div className="manual-source-banner">
          <BookOpen size={16} />
          <span>
            {assistManualTitle
              ? `Manual source of truth / ${assistManualTitle}`
              : 'Run Generate Repair Guidance to pull from indexed manuals'}
          </span>
        </div>
        <div className="result-grid">
          <div className="result-main">
            {assistAnswer ? (
              <>
                <ResultSection title="Repair guidance">
                  <div className="assist-answer-copy">
                    {assistAnswer.split('\n').map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                </ResultSection>
                {assistCitations.length > 0 && (
                  <ResultSection title="Manual citations">
                    <ul className="assist-citation-list">
                      {assistCitations.map((citation) => (
                        <li key={citation.chunkId}>
                          <strong>{citation.chunkId}</strong>
                          <span>{citation.preview}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}
              </>
            ) : (
              <>
                <ResultSection title="Likely cause">Run the live assistant to generate manual-grounded diagnosis.</ResultSection>
                <ResultSection title="Inspect first">Upload manuals and keep machine model names consistent for best grounding.</ResultSection>
                <ResultSection title="Next steps">Use Generate Repair Guidance, then save the result into a maintenance record.</ResultSection>
              </>
            )}
          </div>
          <aside className="confidence-card">
            <span>Confidence</span>
            <strong>{assistGrounded ? 'High' : 'Medium'}</strong>
            <div className="confidence-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>Source</span>
            <b>{assistManualTitle ?? 'Manual not selected yet'}</b>
            <small>{assistGrounded ? `${assistModel ?? 'GPT-5.5'} explaining uploaded manual` : 'Manual required'}</small>
          </aside>
        </div>
      </section>

      <div className="assist-actions">
        <button className="secondary-action" type="button" onClick={() => void runRepairAssist()} disabled={assistBusy}>
          Refresh Guidance
        </button>
        <button
          className="ai-action"
          type="button"
          onClick={() => {
            if (!selectedMachine) {
              setAssistError('Select a machine number before saving as a maintenance record.');
              return;
            }
            onCreateWorkOrder(selectedMachine.id);
          }}
        >
          Save as Maintenance Record
        </button>
      </div>
    </div>
  );
}

function ReportsScreen({
  orgConnected,
  workOrders,
  machines,
}: {
  orgConnected: boolean;
  workOrders: WorkOrderSummary[];
  machines: UrgentMachine[];
}) {
  const [activePeriod, setActivePeriod] = useState(reportPeriods[1]);
  const activePeriodCutoff = useMemo(() => getReportPeriodCutoff(activePeriod), [activePeriod]);
  const reportWorkOrders = useMemo(
    () => workOrders.filter((order) => {
      if (order.maintenanceDateEpoch == null) {
        return false;
      }
      if (activePeriodCutoff === null) {
        return true;
      }
      return order.maintenanceDateEpoch >= activePeriodCutoff;
    }),
    [activePeriodCutoff, workOrders],
  );
  const liveTotalCost = useMemo(
    () => reportWorkOrders.reduce(
      (total, order) => total
        + parseCurrencyString(order.partsCost)
        + parseCurrencyString(order.laborCost)
        + parseCurrencyString(order.otherCost),
      0,
    ),
    [reportWorkOrders],
  );
  const liveCompletedCount = useMemo(
    () => reportWorkOrders.filter((order) => order.status === 'completed').length,
    [reportWorkOrders],
  );
  const liveInProgressCount = useMemo(
    () => reportWorkOrders.filter((order) => order.status === 'in-progress').length,
    [reportWorkOrders],
  );
  const liveMetrics = useMemo<ReportMetric[]>(() => {
    if (!orgConnected || reportWorkOrders.length === 0) {
      return [];
    }

    return [
      {
        id: 'live-records',
        label: 'Maintenance Records',
        value: String(reportWorkOrders.length),
        change: `${liveCompletedCount} completed`,
        tone: 'primary',
      },
      {
        id: 'live-spend',
        label: 'Repair Spend',
        value: formatUsdAmount(liveTotalCost),
        change: 'Live maintenance totals',
        tone: 'down',
      },
      {
        id: 'live-active',
        label: 'Open Work',
        value: String(liveInProgressCount),
        change: 'In progress now',
        tone: 'waiting',
      },
    ];
  }, [liveCompletedCount, liveInProgressCount, liveTotalCost, orgConnected, reportWorkOrders.length]);
  const liveSpendRows = useMemo<ReportRow[]>(() => {
    if (!orgConnected || reportWorkOrders.length === 0) {
      return [];
    }

    return [...reportWorkOrders]
      .map((order): ReportRow => {
        const total = parseCurrencyString(order.partsCost) + parseCurrencyString(order.laborCost) + parseCurrencyString(order.otherCost);
        return {
          id: order.id,
          label: `${order.machineNumber} ${order.repairType ?? order.title}`,
          value: formatUsdAmount(total),
          detail: `${order.statusLabel} / ${order.assignee}`,
          tone: (total > 0 ? 'down' : 'primary') as ReportRow['tone'],
        } satisfies ReportRow;
      })
      .sort((a, b) => parseCurrencyString(b.value) - parseCurrencyString(a.value))
      .slice(0, 8);
  }, [orgConnected, reportWorkOrders]);
  const liveRepeatRows = useMemo<ReportRow[]>(() => {
    if (!orgConnected || reportWorkOrders.length === 0) {
      return [];
    }

    const counts = new Map<string, { count: number; label: string; detail: string }>();
    reportWorkOrders.forEach((order) => {
      const key = order.machineId ?? order.machineNumber;
      const current = counts.get(key) ?? { count: 0, label: order.machineNumber, detail: order.machineModel };
      current.count += 1;
      counts.set(key, current);
    });

    return [...counts.entries()]
      .filter(([, entry]) => entry.count > 1)
      .map(([id, entry]): ReportRow => ({
        id,
        label: entry.label,
        value: `${entry.count} records`,
        detail: entry.detail,
        tone: 'waiting',
      }))
      .slice(0, 8);
  }, [orgConnected, reportWorkOrders]);
  const liveTechnicianRows = useMemo<ReportRow[]>(() => {
    if (!orgConnected || reportWorkOrders.length === 0) {
      return [];
    }

    const counts = new Map<string, number>();
    reportWorkOrders.forEach((order) => {
      const key = order.assignee || 'Unassigned';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([name, count]) => ({
        id: name,
        label: name,
        value: `${count} records`,
        detail: 'Assigned maintenance records',
        tone: 'primary' as const,
      }))
      .sort((a, b) => Number.parseInt(b.value, 10) - Number.parseInt(a.value, 10))
      .slice(0, 8);
  }, [orgConnected, reportWorkOrders]);
  const hasReportData =
    liveMetrics.length > 0 ||
    liveSpendRows.length > 0 ||
    liveRepeatRows.length > 0 ||
    liveTechnicianRows.length > 0 ||
    reportWorkOrders.length > 0;
  const maxDowntime = downtimeTrend.length > 0 ? Math.max(...downtimeTrend.map((point) => point.hours)) : 1;

  return (
    <div className="screen-stack">
      <section className="report-period-card">
        <div>
          <span>Reporting Period</span>
          <strong>{activePeriod}</strong>
        </div>
        <div className="period-toggle" aria-label="Report period">
          {reportPeriods.map((period) => (
            <button
              className={activePeriod === period ? 'is-selected' : ''}
              key={period}
              type="button"
              aria-pressed={activePeriod === period}
              onClick={() => setActivePeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </section>

      <section className="report-hero">
        <div>
          <span>Owner Summary</span>
          <strong>{hasReportData ? 'Live maintenance data loaded.' : 'No report data yet.'}</strong>
          <p>{hasReportData ? 'Review trends across downtime, costs, repeat failures, and manual coverage.' : 'Create machines and maintenance records to start generating report insights.'}</p>
        </div>
        <div className="report-score">
          <span>Health</span>
          <strong>{hasReportData ? 'Active' : '--'}</strong>
          <small>{hasReportData ? 'Live' : 'Waiting data'}</small>
        </div>
      </section>

      <section className="report-metric-grid">
        {liveMetrics.map((metric) => (
          <ReportMetricTile key={metric.id} metric={metric} />
        ))}
        {liveMetrics.length === 0 && <p className="empty-state">No report metrics yet.</p>}
      </section>

      <section className="content-section report-chart-card">
        <div className="section-heading">
          <h2>Downtime Trend</h2>
          <span>Hours offline</span>
        </div>
        <div className="downtime-chart" aria-label="Weekly downtime chart">
          {downtimeTrend.map((point) => (
            <div className="downtime-bar-column" key={point.day}>
              <div className="downtime-bar-track">
                <span style={{ height: `${Math.max((point.hours / maxDowntime) * 100, 10)}%` }} />
              </div>
              <strong>{point.hours}</strong>
              <small>{point.day}</small>
            </div>
          ))}
        </div>
        {downtimeTrend.length === 0 && <p className="empty-state">No downtime data yet.</p>}
      </section>

      <section className="report-insight-card">
        <TrendingDown size={20} />
        <div>
          <strong>{hasReportData ? 'Review trends before making operational changes.' : 'Insights will appear as live data is added.'}</strong>
          <span>{hasReportData ? 'Use this page to monitor downtime, spend, and repeat issues over time.' : 'Once your team logs repairs and updates machine statuses, this section will populate automatically.'}</span>
        </div>
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Repair Spend</h2>
          <span>{liveSpendRows.length > 0 ? 'Parts + labor' : 'No entries yet'}</span>
        </div>
        <ReportRows rows={liveSpendRows} />
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Repeat-Failure Machines</h2>
          <span>Needs owner review</span>
        </div>
        <ReportRows rows={liveRepeatRows} />
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Technician Workload</h2>
          <span>Open work</span>
        </div>
        <ReportRows rows={liveTechnicianRows} />
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Manual Coverage</h2>
          <span>AI grounding</span>
        </div>
        <ReportRows rows={manualCoverageRows} />
      </section>

      <section className="report-insight-card manual-report-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Manual upload is now a launch requirement.</strong>
          <span>Upload manuals for each machine family to keep AI Repair Assist grounded in factual repair documents.</span>
        </div>
      </section>
    </div>
  );
}

function ReportMetricTile({ metric }: { metric: ReportMetric }) {
  return (
    <div className={`report-metric-tile report-tone-${metric.tone}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.change}</small>
    </div>
  );
}

function ReportRows({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">No data yet.</p>;
  }

  return (
    <div className="report-rows">
      {rows.map((row) => (
        <div className="report-row" key={row.id}>
          <span className={`report-row-marker ${row.tone ? `report-marker-${row.tone}` : ''}`} />
          <div>
            <strong>{row.label}</strong>
            <span>{row.detail}</span>
          </div>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, children }: { status: MachineStatus | 'primary' | 'down'; children: React.ReactNode }) {
  return <span className={`status-badge badge-${status}`}>{children}</span>;
}

function QuickAction({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  tone: 'teal' | 'primary' | 'ai';
  onClick?: () => void;
}) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span className={`quick-icon ${tone}`}><Icon size={28} /></span>
      <strong>{label}</strong>
    </button>
  );
}

function Shortcut({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  onClick?: () => void;
  tone?: 'ai';
}) {
  return (
    <button className={`shortcut ${tone === 'ai' ? 'shortcut-ai' : ''}`} type="button" onClick={onClick}>
      <Icon size={25} />
      <strong>{label}</strong>
    </button>
  );
}

function SmallStat({ label, value, tone }: { label: string; value: string; tone?: 'teal' | 'down' }) {
  return (
    <div className="small-stat">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="info-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="result-section">
      <span>{title}</span>
      <div>{children}</div>
    </div>
  );
}

function MachineThumb() {
  return (
    <div className="machine-thumb" aria-hidden="true">
      <div className="machine-window" />
      <div className="machine-door" />
    </div>
  );
}

function MachineIllustration() {
  return (
    <div className="machine-illustration" aria-hidden="true">
      <img src={washerImage} alt="" />
    </div>
  );
}

function PhotoTile({ variant = 'drum', large = false }: { variant?: 'drum' | 'pump' | 'fan'; large?: boolean }) {
  return (
    <div className={`photo-tile ${variant} ${large ? 'large' : ''}`} aria-hidden="true">
      <div />
    </div>
  );
}
