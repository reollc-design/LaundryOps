import type { OwnerOnboardingDraft } from './firebase/auth';

export type OrganizationRouteDecision = 'wait' | 'home' | 'owner-onboarding' | 'none';

const ONBOARDING_PROGRESS_VERSION = 1;

export interface StoredOnboardingProgress {
  activeStep: number;
  draft: OwnerOnboardingDraft;
}

export function emptyOnboardingDraft(): OwnerOnboardingDraft {
  return {
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
  };
}

export function onboardingProgressStorageKey(userId: string): string {
  return `laundryops:onboarding-progress:${userId}`;
}

export function serializeStoredOnboardingProgress(activeStep: number, draft: OwnerOnboardingDraft): string {
  return JSON.stringify({
    version: ONBOARDING_PROGRESS_VERSION,
    activeStep,
    draft,
  });
}

export function parseStoredOnboardingProgress(value: string | null, stepCount: number): StoredOnboardingProgress | null {
  if (!value || !Number.isInteger(stepCount) || stepCount <= 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      version?: unknown;
      activeStep?: unknown;
      draft?: unknown;
    };
    if (
      parsed.version !== ONBOARDING_PROGRESS_VERSION
      || !Number.isInteger(parsed.activeStep)
      || (parsed.activeStep as number) < 0
      || (parsed.activeStep as number) >= stepCount
      || typeof parsed.draft !== 'object'
      || parsed.draft === null
    ) {
      return null;
    }

    const draft = parsed.draft as Record<string, unknown>;
    const draftFields = [
      'businessName',
      'operatorName',
      'businessAddress',
      'ownerEmail',
      'locationName',
      'locationAddress',
      'machineNumber',
      'machineType',
      'machineMake',
      'machineModelNumber',
    ] as const;
    if (draftFields.some((field) => typeof draft[field] !== 'string')) {
      return null;
    }

    return {
      activeStep: parsed.activeStep as number,
      draft: {
        businessName: draft.businessName as string,
        operatorName: draft.operatorName as string,
        businessAddress: draft.businessAddress as string,
        ownerEmail: draft.ownerEmail as string,
        locationName: draft.locationName as string,
        locationAddress: draft.locationAddress as string,
        machineNumber: draft.machineNumber as string,
        machineType: draft.machineType as string,
        machineMake: draft.machineMake as string,
        machineModelNumber: draft.machineModelNumber as string,
      },
    };
  } catch {
    return null;
  }
}

export function shouldApplyProfileSnapshot(hasPendingWrites: boolean): boolean {
  return !hasPendingWrites;
}

export function decideOrganizationRoute(input: {
  profileHasPendingWrites: boolean;
  hasOrganization: boolean;
  isAccountSetupScreen: boolean;
  isProtectedScreen: boolean;
}): OrganizationRouteDecision {
  if (input.profileHasPendingWrites) {
    return 'wait';
  }
  if (input.hasOrganization && input.isAccountSetupScreen) {
    return 'home';
  }
  if (!input.hasOrganization && (input.isProtectedScreen || input.isAccountSetupScreen)) {
    return 'owner-onboarding';
  }
  return 'none';
}

export function onboardingFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Could not complete company setup. Try again.';
}
