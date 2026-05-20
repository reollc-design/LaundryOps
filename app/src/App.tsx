import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  BookOpen,
  Camera,
  CalendarClock,
  Check,
  ChevronDown,
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
  MoreVertical,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';
import {
  accountStats,
  aiWorkOrderDraft,
  costRows,
  downtimeTrend,
  locationSummaries,
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
import type { AccountStat, LocationSummary, MachineStatus, ManualStatus, OnboardingStep, ReportMetric, ReportRow, ScreenKey, UrgentMachine, WorkOrderPriority, WorkOrderStatus, WorkOrderSummary } from './data';
import { useAuthSession } from './hooks/useAuthSession';
import { completeOwnerOnboarding, createOwnerAccount, signInWithEmail, signOutCurrentUser, type OwnerOnboardingDraft } from './firebase/auth';
import { useUserProfile } from './hooks/useUserProfile';

type TabKey = Extract<ScreenKey, 'home' | 'machines' | 'work-orders' | 'ai-assist' | 'reports'>;
type MachineFilter = 'all' | MachineStatus;
type WorkOrderStatusFilter = 'all' | Exclude<WorkOrderStatus, 'in-progress'>;
type WorkOrderPriorityFilter = 'all' | WorkOrderPriority;

const navItems: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'machines', label: 'Machines', icon: Camera },
  { key: 'work-orders', label: 'Work Orders', icon: ClipboardList },
  { key: 'ai-assist', label: 'AI Assist', icon: Sparkles },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

const screenTitles: Record<ScreenKey, string> = {
  welcome: 'LaundryOps',
  'sign-in': 'Sign In',
  'create-account': 'Create Account',
  'technician-invite': 'Technician Invite',
  'owner-onboarding': 'Start Trial',
  home: 'LaundryOps',
  machines: 'Machines',
  'machine-detail': 'Machine Detail',
  manuals: 'Manual Library',
  account: 'Account',
  'create-work-order': 'New Work Order',
  'work-orders': 'Work Orders',
  'work-order-detail': 'Work Order #WO-1042',
  'ai-assist': 'Repair Assist',
  reports: 'Reports',
};

const machineFilters: { key: MachineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'down', label: 'Down' },
  { key: 'needs-repair', label: 'Repair' },
  { key: 'waiting', label: 'Parts' },
];

const workOrderStatusFilters: { key: WorkOrderStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'completed', label: 'Done' },
];

const workOrderPriorityFilters: { key: WorkOrderPriorityFilter; label: string }[] = [
  { key: 'all', label: 'All Priority' },
  { key: 'High', label: 'High' },
  { key: 'Standard', label: 'Standard' },
  { key: 'Low', label: 'Low' },
];

const reportPeriods = ['This Week', 'This Month', '90 Days'];
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

  return maybeError.message ?? 'Authentication failed. Try again.';
}

function findMachines(query: string, machines: UrgentMachine[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return machines;
  }

  return machines.filter((machine) => {
    const machineId = machine.machineNumber.toLowerCase();
    const numericId = machineId.replace(/^[a-z]+0*/, '');
    const searchableText = [
      machineId,
      numericId,
      machine.type,
      machine.row,
      machine.statusLabel,
      machine.status,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('welcome');
  const [workOrderReturnScreen, setWorkOrderReturnScreen] = useState<ScreenKey>('machine-detail');
  const [createdFromDraft, setCreatedFromDraft] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [onboardingDraft, setOnboardingDraft] = useState<OwnerOnboardingDraft>({
    businessName: 'Sun State Laundry',
    locationName: 'Main Street',
    locationCityState: 'Daytona Beach, FL',
    machineNumber: 'W12',
    machineType: 'Washer',
    machineModel: 'Speed Queen SC40',
    technicianName: 'Mike R.',
    manualName: 'SC40 Service Manual',
  });
  const authSession = useAuthSession();
  const userProfile = useUserProfile(authSession.user);
  const isSetupFlow =
    activeScreen === 'welcome' ||
    activeScreen === 'sign-in' ||
    activeScreen === 'create-account' ||
    activeScreen === 'technician-invite' ||
    activeScreen === 'owner-onboarding';
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

    if (!authSession.user && protectedScreens.includes(activeScreen)) {
      setActiveScreen('sign-in');
    }
  }, [activeScreen, authSession.configured, authSession.loading, authSession.user]);
  const handleEmailSignIn = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmail(email, password);
      setActiveScreen('home');
      return null;
    } catch (error) {
      return getAuthErrorMessage(error);
    }
  };
  const handleOwnerCreate = async (displayName: string, email: string, password: string): Promise<string | null> => {
    try {
      await createOwnerAccount(displayName, email, password);
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
  const openCreateWorkOrder = (returnScreen: ScreenKey) => {
    setWorkOrderReturnScreen(returnScreen);
    setActiveScreen('create-work-order');
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
      <section className="phone-frame" aria-label="LaundryOps mobile UI preview">
        <div className="phone-shell">
          <StatusBar />
          {isSetupFlow ? (
            <div className="setup-content">
              <BackendSessionBanner authSession={authSession} />
              {activeScreen === 'welcome' && (
                <WelcomeScreen
                  onStartTrial={() => setActiveScreen('owner-onboarding')}
                  onSignIn={() => setActiveScreen('sign-in')}
                  onCreateAccount={() => setActiveScreen('create-account')}
                  onTechnicianInvite={() => setActiveScreen('technician-invite')}
                />
              )}
              {activeScreen === 'sign-in' && (
                <SignInScreen
                  onBack={() => setActiveScreen('welcome')}
                  onSignIn={handleEmailSignIn}
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
              {activeScreen === 'technician-invite' && (
                <TechnicianInviteScreen
                  onBack={() => setActiveScreen('welcome')}
                  onAccept={() => setActiveScreen('work-orders')}
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
              <AppHeader title={title} showBack={showBack} activeScreen={activeScreen} onBack={handleBack} onAccountClick={() => setActiveScreen('account')} />
              <div className="screen-content">
                <BackendSessionBanner authSession={authSession} compact />
                {activeScreen === 'home' && <HomeScreen setActiveScreen={setActiveScreen} onCreateWorkOrder={() => openCreateWorkOrder('home')} />}
                {activeScreen === 'machines' && <MachinesScreen setActiveScreen={setActiveScreen} />}
                {activeScreen === 'machine-detail' && (
                  <MachineDetailScreen setActiveScreen={setActiveScreen} onCreateWorkOrder={() => openCreateWorkOrder('machine-detail')} />
                )}
                {activeScreen === 'manuals' && <ManualLibraryScreen setActiveScreen={setActiveScreen} />}
                {activeScreen === 'account' && (
                  <AccountScreen
                    authSession={authSession}
                    userProfile={userProfile}
                    signOutBusy={signOutBusy}
                    signOutError={signOutError}
                    onSignOut={handleSignOut}
                  />
                )}
                {activeScreen === 'create-work-order' && (
                  <CreateWorkOrderScreen
                    onSave={() => {
                      setCreatedFromDraft(true);
                      setActiveScreen('work-order-detail');
                    }}
                  />
                )}
                {activeScreen === 'work-orders' && <WorkOrdersScreen setActiveScreen={setActiveScreen} onCreateWorkOrder={() => openCreateWorkOrder('work-orders')} />}
                {activeScreen === 'work-order-detail' && <WorkOrderDetailScreen setActiveScreen={setActiveScreen} createdFromDraft={createdFromDraft} />}
                {activeScreen === 'ai-assist' && <RepairAssistScreen onCreateWorkOrder={() => openCreateWorkOrder('ai-assist')} />}
                {activeScreen === 'reports' && <ReportsScreen />}
              </div>
              <BottomNav activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
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

function WelcomeScreen({
  onStartTrial,
  onSignIn,
  onCreateAccount,
  onTechnicianInvite,
}: {
  onStartTrial: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onTechnicianInvite: () => void;
}) {
  return (
    <div className="welcome-screen">
      <div className="welcome-top">
        <div className="welcome-brand">
          <div className="brand-mark large" aria-hidden="true">
            <span className="brand-lines" />
          </div>
          <div>
            <span>LaundryOps</span>
            <strong>Maintenance command center</strong>
          </div>
        </div>
        <button className="text-action" type="button" onClick={onSignIn}>Sign in</button>
      </div>

      <section className="welcome-hero">
        <div>
          <span>14-Day Free Trial</span>
          <h1>Keep laundromat machines running.</h1>
          <p>Track machines, work orders, manuals, repair spend, and manual-grounded AI from one Android-first app.</p>
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
        <button className="secondary-action" type="button" onClick={onTechnicianInvite}>
          Accept Technician Invite
        </button>
      </div>

      <section className="trial-feature-list">
        {trialFeatures.map((feature) => (
          <div className="trial-feature-row" key={feature.id}>
            <span><Check size={15} /></span>
            <div>
              <strong>{feature.title}</strong>
              <small>{feature.detail}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="trial-proof-card">
        <ShieldCheck size={18} />
        <div>
          <strong>No payment screen in this prototype.</strong>
          <span>Production billing will activate after the 14-day trial path is wired to Google Play or SaaS billing.</span>
        </div>
      </section>
    </div>
  );
}

function SignInScreen({
  onBack,
  onSignIn,
  onCreateAccount,
}: {
  onBack: () => void;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onCreateAccount: () => void;
}) {
  const [showReset, setShowReset] = useState(false);
  const [email, setEmail] = useState('owner@sunstatedemo.com');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitSignIn = async () => {
    if (!email.trim() || !password) {
      setAuthError('Enter your email and password.');
      return;
    }

    setAuthError(null);
    setProviderMessage(null);
    setIsSubmitting(true);
    const error = await onSignIn(email.trim(), password);
    setIsSubmitting(false);

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
          <span>Owner / Manager / Technician</span>
          <h1>Welcome back.</h1>
          <p>Use your account to open the right company, location, role, and work queue.</p>
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
        {providerMessage && (
          <div className="auth-message">
            <strong>Google sign-in not enabled yet</strong>
            <span>{providerMessage}</span>
          </div>
        )}
        <button className="primary-action" type="button" onClick={submitSignIn} disabled={isSubmitting}>
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>
        <button
          className="google-action"
          type="button"
          onClick={() => setProviderMessage('Enable Google provider in Firebase Auth to activate this button.')}
        >
          Continue with Google
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
  onStartTrial: (displayName: string, email: string, password: string) => Promise<string | null>;
  onSignIn: () => void;
}) {
  const [ownerName, setOwnerName] = useState('Robert');
  const [email, setEmail] = useState('owner@sunstatedemo.com');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitCreateAccount = async () => {
    if (!ownerName.trim() || !email.trim() || !password) {
      setAuthError('Owner name, email, and password are required.');
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    const error = await onStartTrial(ownerName.trim(), email.trim(), password);
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
          <p>Create the owner login first. The next step builds the company, first location, and first machine.</p>
        </div>
        <div className="access-fields">
          <AuthField icon={UserRound} label="Owner Name" value={ownerName} onChange={setOwnerName} />
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
            <span>The trial includes work orders, reports, manual uploads, and OpenAI Repair Assist.</span>
          </div>
        </section>
        <button className="primary-action" type="button" onClick={submitCreateAccount} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Create Account & Start Trial'}
        </button>
        <div className="access-link-row single">
          <button type="button" onClick={onSignIn}>Already have an account?</button>
        </div>
      </section>
    </div>
  );
}

function TechnicianInviteScreen({
  onBack,
  onAccept,
}: {
  onBack: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="access-screen">
      <AccessHeader eyebrow="Invite Access" title="Join as technician" onBack={onBack} />

      <section className="access-card">
        <div className="access-icon invite">
          <UsersRound size={23} />
        </div>
        <div className="access-copy">
          <span>Sun State Laundry invited you</span>
          <h1>Mike R. / Technician</h1>
          <p>Technicians get assigned work, machine lookup, manual search, photos, and Repair Assist. Billing stays hidden.</p>
        </div>
        <div className="invite-summary">
          <InvitePermission icon={MapPin} title="Location Access" detail="Main Street only" />
          <InvitePermission icon={ClipboardList} title="Work Orders" detail="Assigned work and status updates" />
          <InvitePermission icon={Camera} title="Photos" detail="Attach repair and machine photos" />
          <InvitePermission icon={BookOpen} title="Manuals & AI" detail="Search manuals and use Repair Assist" />
        </div>
        <div className="access-fields">
          <AuthField icon={Mail} label="Technician Email" value="mike@sunstatedemo.com" />
          <AuthField icon={KeyRound} label="Password" value="********" type="password" />
        </div>
        <button className="primary-action" type="button" onClick={onAccept}>
          Accept Invite
        </button>
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

function InvitePermission({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof MapPin;
  title: string;
  detail: string;
}) {
  return (
    <div className="invite-permission">
      <span><Icon size={17} /></span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
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
  const isOptionalStep = currentStep.id === 'team' || currentStep.id === 'manual';
  const advance = async () => {
    if (isLastStep) {
      if (!draft.businessName.trim() || !draft.locationName.trim() || !draft.machineNumber.trim() || !draft.machineModel.trim()) {
        setSubmitError('Business, location, machine number, and model are required before finishing setup.');
        return;
      }

      setSubmitError(null);
      setIsSubmitting(true);
      const error = await onFinish(draft);
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
          <span>{isOptionalStep ? 'Optional Setup' : 'Required Setup'}</span>
          <h2>{currentStep.title}</h2>
          <p>{getOnboardingStepCopy(currentStep.id)}</p>
        </div>
        <OnboardingStepFields
          stepId={currentStep.id}
          draft={draft}
          ownerEmail={ownerEmail}
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
        {isOptionalStep && (
          <button className="secondary-action" type="button" onClick={() => void advance()} disabled={isSubmitting}>
            Skip for Now
          </button>
        )}
        <button className="primary-action" type="button" onClick={() => void advance()} disabled={isSubmitting}>
          {isSubmitting ? 'Saving Setup...' : isLastStep ? 'Finish Setup' : isOptionalStep ? 'Add & Continue' : 'Continue'}
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
    step.icon === 'team' ? UsersRound :
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
        <SetupField label="Owner Email" value={ownerEmail} readOnly />
      </div>
    );
  }

  if (stepId === 'location') {
    return (
      <div className="setup-field-grid">
        <SetupField label="Location Name" value={draft.locationName} onChange={(value) => patchDraft({ locationName: value })} />
        <SetupField label="City / State" value={draft.locationCityState} onChange={(value) => patchDraft({ locationCityState: value })} />
      </div>
    );
  }

  if (stepId === 'machine') {
    return (
      <div className="setup-field-grid two-column">
        <SetupField label="Machine ID" value={draft.machineNumber} onChange={(value) => patchDraft({ machineNumber: value })} />
        <SetupField label="Type" value={draft.machineType} onChange={(value) => patchDraft({ machineType: value })} />
        <SetupField label="Make / Model" value={draft.machineModel} onChange={(value) => patchDraft({ machineModel: value })} wide />
      </div>
    );
  }

  if (stepId === 'team') {
    return (
      <div className="setup-field-grid">
        <SetupField label="Technician Name" value={draft.technicianName} onChange={(value) => patchDraft({ technicianName: value })} />
        <SetupField label="Role" value="Technician" readOnly />
      </div>
    );
  }

  return (
    <div className="setup-field-grid">
      <SetupField label="Manual" value={draft.manualName} onChange={(value) => patchDraft({ manualName: value })} />
      <SetupField label="Linked Machines" value="30 washers" readOnly />
    </div>
  );
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

function getOnboardingStepCopy(stepId: string) {
  const copy: Record<string, string> = {
    account: 'Create the customer account that owns billing, users, locations, machines, manuals, and reports.',
    location: 'Add the first laundromat so every machine and work order has the right operating context.',
    machine: 'Add one real machine now. The full machine directory can be imported or expanded later.',
    team: 'Invite a technician so repair work can be assigned without giving away owner controls.',
    manual: 'Upload the first manual so Repair Assist can answer from factual service material instead of generic guidance.',
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
}: {
  title: string;
  showBack: boolean;
  activeScreen: ScreenKey;
  onBack: () => void;
  onAccountClick: () => void;
}) {
  const isAssist = activeScreen === 'ai-assist';
  return (
    <header className="app-header">
      {showBack ? (
        <button className="icon-button header-icon" onClick={onBack} aria-label="Go back">
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
          <button className="location-chip" type="button" onClick={onAccountClick}>
            Main Street <ChevronDown size={13} />
          </button>
        )}
        {activeScreen === 'machines' && <span className="header-subtitle">Main Street / 60 machines</span>}
        {activeScreen === 'work-orders' && <span className="header-subtitle">Main Street / {workOrderQueue.length} work orders</span>}
        {activeScreen === 'manuals' && <span className="header-subtitle">Grounded repair answers</span>}
        {activeScreen === 'account' && <span className="header-subtitle">Business, locations, subscription</span>}
        {activeScreen === 'create-work-order' && <span className="header-subtitle">AI draft review</span>}
      </div>
      {isAssist ? (
        <span className="ai-pill">AI</span>
      ) : showBack ? (
        <button className="icon-button header-icon" aria-label="More options">
          <MoreVertical size={21} />
        </button>
      ) : (
        <button className="icon-button header-icon" aria-label="Notifications">
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
  onCreateWorkOrder,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  onCreateWorkOrder: () => void;
}) {
  const [machineQuery, setMachineQuery] = useState('');
  const normalizedQuery = machineQuery.trim().toLowerCase();
  const machineResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return findMachines(machineQuery, machineCatalog).slice(0, 6);
  }, [normalizedQuery]);

  return (
    <div className="screen-stack">
      <section className="section-card fleet-card">
        <div className="section-heading">
          <h2>Machine Health</h2>
          <span>Updated 9:41 AM</span>
        </div>
        <div className="fleet-grid">
          <div className="health-ring" aria-label="Machine health score 72 good">
            <div className="ring-score">
              <strong>72</strong>
              <span>Good</span>
            </div>
          </div>
          <div className="metric-grid">
            <Metric label="Machines Down" value="3" tone="down" action="View details" />
            <Metric label="Open Work Orders" value="7" tone="primary" action="View details" />
            <Metric label="Waiting on Parts" value="2" tone="waiting" action="View details" />
            <Metric label="Repair Spend (May)" value="$1,245" tone="teal" action="View report" />
          </div>
        </div>
      </section>

      <section className="content-section machine-search-section">
        <div className="section-heading">
          <h2>Find Machine</h2>
          <span>{machineCatalog.length} machines</span>
        </div>
        <label className="machine-search" htmlFor="machine-search">
          <Search size={18} />
          <input
            id="machine-search"
            type="search"
            value={machineQuery}
            onChange={(event) => setMachineQuery(event.target.value)}
            placeholder="Search W12, 12, dryer, row 2"
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
                  <UrgentMachineRow key={machine.id} machine={machine} onClick={() => setActiveScreen('machine-detail')} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="search-hint">Search by machine ID, number, type, row, or status.</p>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Urgent Machines</h2>
          <button type="button" onClick={() => setActiveScreen('machines')}>See all <ChevronRight size={14} /></button>
        </div>
        <div className="machine-list">
          {urgentMachines.map((machine) => (
            <UrgentMachineRow key={machine.id} machine={machine} onClick={() => setActiveScreen('machine-detail')} />
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Quick Actions</h2>
        </div>
        <div className="quick-grid">
          <QuickAction icon={QrCode} label="Scan Machine" tone="teal" />
          <QuickAction icon={ClipboardList} label="New Work Order" tone="primary" onClick={onCreateWorkOrder} />
          <QuickAction icon={Sparkles} label="Ask AI" tone="ai" onClick={() => setActiveScreen('ai-assist')} />
        </div>
      </section>
    </div>
  );
}

function MachinesScreen({ setActiveScreen }: { setActiveScreen: (screen: ScreenKey) => void }) {
  const [machineQuery, setMachineQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<MachineFilter>('all');
  const filteredMachines = useMemo(() => {
    const statusFiltered = activeFilter === 'all' ? machineCatalog : machineCatalog.filter((machine) => machine.status === activeFilter);
    return findMachines(machineQuery, statusFiltered);
  }, [activeFilter, machineQuery]);
  const downCount = machineCatalog.filter((machine) => machine.status === 'down').length;
  const needsRepairCount = machineCatalog.filter((machine) => machine.status === 'needs-repair').length;
  const waitingCount = machineCatalog.filter((machine) => machine.status === 'waiting').length;

  return (
    <div className="screen-stack">
      <section className="directory-summary">
        <DirectoryStat label="Total Machines" value={String(machineCatalog.length)} />
        <DirectoryStat label="Down" value={String(downCount)} tone="down" />
        <DirectoryStat label="Needs Repair" value={String(needsRepairCount)} tone="warning" />
        <DirectoryStat label="Waiting Parts" value={String(waitingCount)} tone="waiting" />
      </section>

      <section className="content-section machine-search-section">
        <div className="section-heading">
          <h2>Machine Directory</h2>
          <span>{filteredMachines.length} shown</span>
        </div>
        <label className="machine-search" htmlFor="directory-machine-search">
          <Search size={18} />
          <input
            id="directory-machine-search"
            type="search"
            value={machineQuery}
            onChange={(event) => setMachineQuery(event.target.value)}
            placeholder="Search W12, 12, dryer, row 2"
          />
        </label>
        <div className="filter-strip" aria-label="Machine status filters">
          {machineFilters.map((filter) => (
            <button
              className={activeFilter === filter.key ? 'is-selected' : ''}
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="content-section directory-list-section">
        <div className="machine-list directory-machine-list">
          {filteredMachines.slice(0, 24).map((machine) => (
            <UrgentMachineRow key={machine.id} machine={machine} onClick={() => setActiveScreen('machine-detail')} />
          ))}
        </div>
        {filteredMachines.length === 0 && <p className="empty-state">No machines match that search.</p>}
        {filteredMachines.length > 24 && <p className="search-hint">Showing first 24. Search to narrow the list.</p>}
      </section>
    </div>
  );
}

function DirectoryStat({ label, value, tone }: { label: string; value: string; tone?: 'down' | 'warning' | 'waiting' }) {
  return (
    <div className="directory-stat">
      <span>{label}</span>
      <strong className={tone ? `directory-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  action,
}: {
  label: string;
  value: string;
  tone: 'down' | 'primary' | 'waiting' | 'teal';
  action: string;
}) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong className={`metric-value tone-${tone}`}>{value}</strong>
      <button type="button">
        {action} <ChevronRight size={12} />
      </button>
    </div>
  );
}

function UrgentMachineRow({ machine, onClick }: { machine: UrgentMachine; onClick: () => void }) {
  return (
    <button className={`machine-row status-${machine.status}`} type="button" onClick={onClick}>
      <MachineThumb />
      <div className="machine-row-main">
        <strong>{machine.machineNumber}</strong>
        <span>{machine.type} / {machine.row}</span>
      </div>
      <div className="machine-row-status">
        <StatusBadge status={machine.status}>{machine.statusLabel}</StatusBadge>
        <span>{machine.since}</span>
      </div>
      <ChevronRight className="row-chevron" size={18} />
    </button>
  );
}

function MachineDetailScreen({
  setActiveScreen,
  onCreateWorkOrder,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  onCreateWorkOrder: () => void;
}) {
  return (
    <div className="screen-stack detail-stack">
      <section className="machine-hero">
        <div className="machine-hero-copy">
          <div className="machine-title-line">
            <h2>W12</h2>
            <StatusBadge status="down">Down</StatusBadge>
          </div>
          <strong>Speed Queen SC40</strong>
          <span>Main Street / Washer Row 2</span>
          <span>S/N 123456789</span>
        </div>
        <MachineIllustration />
      </section>

      <section className="issue-card">
        <span>Current Issue</span>
        <strong>Won't drain after cycle</strong>
        <p>Reported today 8:15 AM</p>
      </section>

      <button className="primary-action" type="button" onClick={onCreateWorkOrder}>
        <Plus size={20} /> Create Work Order
      </button>

      <div className="shortcut-grid">
        <Shortcut icon={Sparkles} label="Ask AI" onClick={() => setActiveScreen('ai-assist')} tone="ai" />
        <Shortcut icon={BookOpen} label="Search Manual" onClick={() => setActiveScreen('manuals')} />
        <Shortcut icon={Camera} label="Add Photo" />
      </div>

      <div className="stat-grid">
        <SmallStat label="Lifetime Repair Cost" value="$2,842" tone="teal" />
        <SmallStat label="Last Service" value="Apr 22, 2026" />
        <SmallStat label="Downtime (May)" value="16.2 hrs" tone="down" />
      </div>

      <section className="content-section">
        <div className="section-heading">
          <h2>Maintenance History</h2>
          <button type="button">See all <ChevronRight size={14} /></button>
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
      </section>
    </div>
  );
}

function ManualLibraryScreen({ setActiveScreen }: { setActiveScreen: (screen: ScreenKey) => void }) {
  const [showUpload, setShowUpload] = useState(false);
  const [queuedManual, setQueuedManual] = useState(false);
  const indexedCount = manualRows.filter((manual) => manual.status === 'indexed').length + (queuedManual ? 1 : 0);
  const missingCount = manualRows.filter((manual) => manual.status === 'missing').length - (queuedManual ? 1 : 0);

  return (
    <div className="screen-stack">
      <section className="manual-summary">
        <div>
          <span>Manual Coverage</span>
          <strong>{indexedCount}/3</strong>
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
            <p>Link a PDF to a machine model so AI Repair Assist answers from the actual manual.</p>
          </div>
        </div>
        {showUpload && (
          <div className="upload-form">
            <label>
              <span>Machine Model</span>
              <input value="Combo 100 Series" readOnly />
            </label>
            <label>
              <span>Manual File</span>
              <input value="combo-100-service-manual.pdf" readOnly />
            </label>
            <div className="upload-status-line">
              <Check size={15} />
              <span>PDF ready to index and link to 10 machines.</span>
            </div>
          </div>
        )}
        <button
          className={queuedManual ? 'secondary-action full-width-action' : 'primary-action'}
          type="button"
          onClick={() => {
            if (showUpload) {
              setQueuedManual(true);
            }
            setShowUpload(true);
          }}
        >
          {queuedManual ? 'Manual Queued for Indexing' : showUpload ? 'Process Manual' : 'Upload Manual'}
        </button>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>Linked Manuals</h2>
          <span>{manualRows.length} models</span>
        </div>
        <div className="manual-list">
          {manualRows.map((manual) => (
            <ManualRow key={manual.id} manual={manual} queuedManual={queuedManual && manual.id === 'manual-combo'} />
          ))}
        </div>
      </section>

      <section className="ai-grounding-card">
        <BookOpen size={18} />
        <div>
          <strong>Repair Assist uses linked manuals first.</strong>
          <span>When no manual exists, the answer is marked as general guidance until a manual is uploaded.</span>
        </div>
      </section>

      <button className="ai-action" type="button" onClick={() => setActiveScreen('ai-assist')}>
        Open AI Repair Assist
      </button>
    </div>
  );
}

function ManualRow({ manual, queuedManual }: { manual: (typeof manualRows)[number]; queuedManual: boolean }) {
  const status: ManualStatus = queuedManual ? 'processing' : manual.status;
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
        <span>{queuedManual ? 'combo-100-service-manual.pdf' : manual.title}</span>
        <small>{queuedManual ? 'Indexing manual and linking machines' : manual.source}</small>
      </div>
      <div className="manual-row-meta">
        <StatusBadge status={status === 'indexed' ? 'running' : status === 'processing' ? 'waiting' : 'down'}>{statusLabel[status]}</StatusBadge>
        <span>{queuedManual ? '10 machines linked' : manual.coverage}</span>
        <small>{queuedManual ? 'Processing now' : manual.pages}</small>
      </div>
    </div>
  );
}

function AccountScreen({
  authSession,
  userProfile,
  signOutBusy,
  signOutError,
  onSignOut,
}: {
  authSession: ReturnType<typeof useAuthSession>;
  userProfile: ReturnType<typeof useUserProfile>;
  signOutBusy: boolean;
  signOutError: string | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="screen-stack">
      <section className="account-hero">
        <div className="account-hero-icon">
          <Building2 size={24} />
        </div>
        <div>
          <span>Company Account</span>
          <strong>Sun State Laundry</strong>
          <p>One company account can manage one store today and multiple laundromats later.</p>
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
          <strong>Pro trial active</strong>
          <p>Trial includes work orders, reports, manual uploads, and OpenAI Repair Assist.</p>
        </div>
        <div className="trial-days">
          <strong>14</strong>
          <span>days</span>
        </div>
      </section>

      <section className="account-stat-grid">
        {accountStats.map((stat) => (
          <AccountStatTile key={stat.id} stat={stat} />
        ))}
      </section>

      <section className="content-section subscription-card">
        <div className="section-heading">
          <h2>Subscription Model</h2>
          <span>Recommended</span>
        </div>
        <div className="subscription-line">
          <CreditCard size={18} />
          <div>
            <strong>One company subscription</strong>
            <span>Base plan includes one location. Additional locations are paid add-ons under the same login.</span>
          </div>
        </div>
        <div className="subscription-rule">
          <span>Why this wins</span>
          <strong>Owners get one account, one bill, and one dashboard across all stores.</strong>
        </div>
      </section>

      <section className="content-section location-list-card">
        <div className="section-heading">
          <h2>Locations</h2>
          <button type="button"><Plus size={14} /> Add</button>
        </div>
        <div className="location-list">
          {locationSummaries.map((location) => (
            <LocationRow key={location.id} location={location} />
          ))}
        </div>
      </section>

      <section className="content-section admin-card">
        <div className="section-heading">
          <h2>Admin Readiness</h2>
          <span>Launch setup</span>
        </div>
        <div className="admin-actions">
          <AdminAction icon={UsersRound} title="Users & Roles" detail="Owner, manager, technician, viewer" />
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

function LocationRow({ location }: { location: LocationSummary }) {
  const statusLabel: Record<LocationSummary['status'], string> = {
    included: 'Included',
    'add-on': 'Add-On',
    setup: 'Setup',
  };

  return (
    <div className={`location-row location-${location.status}`}>
      <div className="location-row-icon">
        <MapPin size={19} />
      </div>
      <div className="location-row-main">
        <strong>{location.name}</strong>
        <span>{location.address}</span>
        <small>{location.planNote}</small>
      </div>
      <div className="location-row-meta">
        <StatusBadge status={location.status === 'included' ? 'running' : location.status === 'add-on' ? 'primary' : 'waiting'}>
          {statusLabel[location.status]}
        </StatusBadge>
        <span>{location.machines} machines</span>
        <small>{location.openWorkOrders} open work orders</small>
      </div>
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

function CreateWorkOrderScreen({ onSave }: { onSave: () => void }) {
  const [priority, setPriority] = useState(aiWorkOrderDraft.priority);
  const [assignee, setAssignee] = useState(aiWorkOrderDraft.assignee);
  const priorityOptions = ['High', 'Standard', 'Low'];
  const assigneeOptions = ['Mike R.', 'Tom J.', 'Unassigned'];

  return (
    <div className="screen-stack">
      <section className="draft-banner">
        <span className="draft-banner-icon"><ClipboardCheck size={22} /></span>
        <div className="draft-banner-copy">
          <strong>Draft created from Repair Assist</strong>
          <span>Review the AI notes, manual source, assignee, and parts before opening the work order.</span>
        </div>
        <StatusBadge status={priority === 'High' ? 'down' : 'primary'}>{priority}</StatusBadge>
      </section>

      <section className="draft-machine-card">
        <MachineThumb />
        <div>
          <span>Machine</span>
          <strong>{aiWorkOrderDraft.machineNumber}</strong>
          <small>{aiWorkOrderDraft.machineModel}</small>
          <small>{aiWorkOrderDraft.location}</small>
        </div>
        <CalendarClock size={20} />
      </section>

      <section className="review-card">
        <div className="review-heading">
          <h2>Work Order Setup</h2>
          <span>Due {aiWorkOrderDraft.due}</span>
        </div>
        <label className="review-field">
          <span>Title</span>
          <input value={aiWorkOrderDraft.title} readOnly />
        </label>
        <div className="review-control-group">
          <span>Priority</span>
          <div className="selectable-strip">
            {priorityOptions.map((option) => (
              <button
                className={priority === option ? 'is-selected' : ''}
                key={option}
                type="button"
                aria-pressed={priority === option}
                onClick={() => setPriority(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="review-control-group">
          <span>Assign To</span>
          <div className="selectable-strip">
            {assigneeOptions.map((option) => (
              <button
                className={assignee === option ? 'is-selected' : ''}
                key={option}
                type="button"
                aria-pressed={assignee === option}
                onClick={() => setAssignee(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="draft-summary-card">
        <div className="review-heading">
          <h2>AI Repair Notes</h2>
          <span>{aiWorkOrderDraft.confidence} confidence</span>
        </div>
        <InfoBlock label="Symptoms" value={aiWorkOrderDraft.symptoms} />
        <InfoBlock label="Error Code" value={aiWorkOrderDraft.errorCode} />
        <InfoBlock label="Diagnosis" value={aiWorkOrderDraft.diagnosis} />
      </section>

      <section className="content-section task-card">
        <div className="section-heading">
          <h2>Technician Checklist</h2>
          <span>{aiWorkOrderDraft.steps.length} steps</span>
        </div>
        <div className="task-list">
          {aiWorkOrderDraft.steps.map((step, index) => (
            <div className="task-row" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="source-card">
        <div className="source-card-icon"><FileText size={20} /></div>
        <div>
          <strong>Manual source attached</strong>
          <span>{aiWorkOrderDraft.source}</span>
          <small>{aiWorkOrderDraft.sourceDetail}</small>
        </div>
        <StatusBadge status="running">Grounded</StatusBadge>
      </section>

      <section className="cost-card">
        <h2>Parts & Estimate</h2>
        {aiWorkOrderDraft.parts.map((part) => (
          <div className="cost-row" key={part}>
            <span>{part}</span>
            <strong>Needed</strong>
          </div>
        ))}
        <div className="cost-total">
          <span>Estimated Total</span>
          <strong>{aiWorkOrderDraft.estimate}</strong>
        </div>
      </section>

      <button className="primary-action sticky-action" type="button" onClick={onSave}>
        <ClipboardCheck size={19} /> Create Work Order
      </button>
    </div>
  );
}

function WorkOrdersScreen({
  setActiveScreen,
  onCreateWorkOrder,
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  onCreateWorkOrder: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriorityFilter>('all');
  const filteredOrders = useMemo(() => {
    return workOrderQueue.filter((order) => {
      const matchesStatus =
        statusFilter === 'all' ||
        order.status === statusFilter ||
        (statusFilter === 'assigned' && order.status === 'in-progress');
      const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [priorityFilter, statusFilter]);
  const openCount = workOrderQueue.filter((order) => order.status !== 'completed').length;
  const highCount = workOrderQueue.filter((order) => order.priority === 'High' && order.status !== 'completed').length;
  const waitingCount = workOrderQueue.filter((order) => order.status === 'waiting').length;

  return (
    <div className="screen-stack">
      <section className="work-order-summary">
        <WorkQueueStat label="Open" value={String(openCount)} />
        <WorkQueueStat label="High" value={String(highCount)} tone="down" />
        <WorkQueueStat label="Waiting Parts" value={String(waitingCount)} tone="waiting" />
      </section>

      <section className="content-section work-filter-card">
        <div className="section-heading">
          <h2>Work Order Queue</h2>
          <button type="button" onClick={onCreateWorkOrder}><Plus size={14} /> New</button>
        </div>
        <div className="work-filter-block">
          <div className="filter-label">
            <Filter size={14} />
            <span>Status</span>
          </div>
          <div className="work-status-filter" aria-label="Work order status filters">
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
          <div className="work-priority-filter" aria-label="Work order priority filters">
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
        <div className="list-count-line">
          <strong>{filteredOrders.length} shown</strong>
          <span>{statusFilter === 'all' ? 'All statuses' : workOrderStatusFilters.find((filter) => filter.key === statusFilter)?.label}</span>
        </div>
        {filteredOrders.map((order) => (
          <WorkOrderQueueRow key={order.id} order={order} onClick={() => setActiveScreen('work-order-detail')} />
        ))}
        {filteredOrders.length === 0 && <p className="empty-state">No work orders match those filters.</p>}
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

function WorkOrderQueueRow({ order, onClick }: { order: WorkOrderSummary; onClick: () => void }) {
  return (
    <button className={`work-order-row wo-${order.status}`} type="button" onClick={onClick}>
      <div className="work-row-top">
        <div>
          <span>{order.number}</span>
          <strong>{order.machineNumber} / {order.title}</strong>
        </div>
        <StatusBadge status={priorityToBadgeStatus(order.priority)}>{order.priority}</StatusBadge>
      </div>
      <div className="work-row-meta">
        <span>{order.machineModel}</span>
        <span>{order.location}</span>
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
}: {
  setActiveScreen: (screen: ScreenKey) => void;
  createdFromDraft: boolean;
}) {
  const steps = useMemo(() => ['Open', 'Assigned', 'In Progress', 'Waiting', 'Completed'], []);
  return (
    <div className="screen-stack">
      {createdFromDraft && (
        <section className="created-banner">
          <Check size={17} />
          <div>
            <strong>Work order created from AI draft</strong>
            <span>Manual source and technician checklist were attached.</span>
          </div>
        </section>
      )}

      <section className="work-title">
        <div>
          <h2>W12 won't drain</h2>
          <span>Created today 8:25 AM</span>
        </div>
        <StatusBadge status="down">High</StatusBadge>
      </section>

      <div className="stepper">
        {steps.map((step, index) => {
          const active = index <= 2;
          const current = index === 2;
          return (
            <div className={`step ${active ? 'done' : ''} ${current ? 'current' : ''}`} key={step}>
              <span>{active ? (current ? <Wrench size={14} /> : <Check size={14} />) : <Circle size={13} />}</span>
              <b>{step}</b>
            </div>
          );
        })}
      </div>

      <section className="assignment-card">
        <div className="assignee">
          <div className="avatar"><UserRound size={18} /></div>
          <div>
            <span>Assigned To</span>
            <strong>Mike R.</strong>
            <small>Technician</small>
          </div>
        </div>
        <div className="status-box">
          <span>Status</span>
          <strong>In Progress</strong>
          <small>Since 9:10 AM</small>
        </div>
      </section>

      <InfoBlock label="Symptoms" value="Water left in drum after cycle" />
      <InfoBlock label="Error Code" value="E04" />

      <section className="content-section compact">
        <h2>Photos</h2>
        <div className="photo-strip">
          <PhotoTile />
          <PhotoTile variant="pump" />
          <PhotoTile variant="fan" />
          <button className="add-photo" type="button"><Plus size={21} /> Add</button>
        </div>
      </section>

      <section className="cost-card">
        <h2>Parts & Cost</h2>
        {costRows.map(([name, cost]) => (
          <div className="cost-row" key={name}>
            <span>{name}</span>
            <strong>{cost}</strong>
          </div>
        ))}
        <div className="cost-total">
          <span>Estimated Total</span>
          <strong>$220.75</strong>
        </div>
      </section>

      <button className="primary-action sticky-action" type="button" onClick={() => setActiveScreen('work-orders')}>
        <Hourglass size={19} /> Mark Waiting on Parts
      </button>
    </div>
  );
}

function RepairAssistScreen({ onCreateWorkOrder }: { onCreateWorkOrder: () => void }) {
  return (
    <div className="screen-stack">
      <section className="assist-machine-card">
        <MachineThumb />
        <div>
          <strong>W12</strong>
          <span>Speed Queen SC40</span>
          <small>Main Street / Washer Row 2</small>
        </div>
        <button type="button">Change</button>
      </section>

      <section className="assist-form">
        <label>
          <span>Symptoms</span>
          <input value="Water remains after final spin" readOnly />
        </label>
        <label>
          <span>Error Code</span>
          <input value="E04" readOnly />
        </label>
        <div className="assist-photos">
          <PhotoTile variant="pump" large />
          <button className="attach-photo" type="button"><Plus size={22} /> Add Photo</button>
        </div>
        <div className="manual-toggle">
          <div>
            <strong>Use linked manual</strong>
            <span>Speed Queen SC40 Service Manual found</span>
          </div>
          <button className="toggle-on" type="button" role="switch" aria-checked="true" aria-label="Manual grounding on" />
        </div>
      </section>

      <section className="ai-result-card">
        <div className="manual-source-banner">
          <BookOpen size={16} />
          <span>Manual-grounded answer / p. 42 Drain Pump Test</span>
        </div>
        <div className="result-grid">
          <div className="result-main">
            <ResultSection title="Likely cause">Drain pump is not clearing water.</ResultSection>
            <ResultSection title="Inspect first">Check drain pump for blockage or impeller damage.</ResultSection>
            <ResultSection title="Next steps">
              <ol>
                <li>Remove lower front panel.</li>
                <li>Inspect drain pump and filter.</li>
                <li>Clear debris and test pump.</li>
              </ol>
            </ResultSection>
            <ResultSection title="Parts to check">Drain pump assembly, hose clamp.</ResultSection>
            <ResultSection title="Safety note">Unplug machine before working on drain system.</ResultSection>
          </div>
          <aside className="confidence-card">
            <span>Confidence</span>
            <strong>Medium</strong>
            <div className="confidence-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>Source</span>
            <b>Speed Queen SC40 Service Manual</b>
            <small>p. 42 / Drain Pump Test</small>
          </aside>
        </div>
      </section>

      <div className="assist-actions">
        <button className="secondary-action" type="button">Add to Existing</button>
        <button className="ai-action" type="button" onClick={onCreateWorkOrder}>Save as Work Order</button>
      </div>
    </div>
  );
}

function ReportsScreen() {
  const [activePeriod, setActivePeriod] = useState(reportPeriods[1]);
  const maxDowntime = Math.max(...downtimeTrend.map((point) => point.hours));

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
          <strong>Maintenance cost is up, downtime is improving.</strong>
          <p>W12 and D07 are the machines to watch. Combo machines still need manuals before AI coverage is complete.</p>
        </div>
        <div className="report-score">
          <span>Health</span>
          <strong>72</strong>
          <small>Good</small>
        </div>
      </section>

      <section className="report-metric-grid">
        {reportMetrics.map((metric) => (
          <ReportMetricTile key={metric.id} metric={metric} />
        ))}
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
      </section>

      <section className="report-insight-card">
        <TrendingDown size={20} />
        <div>
          <strong>Downtime improved 18% this week.</strong>
          <span>Most of the remaining downtime is concentrated in two machines: W12 and D07.</span>
        </div>
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Repair Spend</h2>
          <span>$1,245 total</span>
        </div>
        <ReportRows rows={spendBreakdownRows} />
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Repeat-Failure Machines</h2>
          <span>Needs owner review</span>
        </div>
        <ReportRows rows={repeatFailureRows} />
      </section>

      <section className="content-section report-list-card">
        <div className="section-heading">
          <h2>Technician Load</h2>
          <span>Open work</span>
        </div>
        <ReportRows rows={technicianLoadRows} />
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
          <span>Upload the Combo 100 Series manual to make every machine family eligible for manual-grounded AI answers.</span>
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
  icon: typeof QrCode;
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
      <div className="machine-panel">
        <span />
        <span />
        <span />
      </div>
      <div className="machine-big-door">
        <div />
      </div>
      <div className="machine-base" />
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
