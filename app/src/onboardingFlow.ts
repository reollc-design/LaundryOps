export type OrganizationRouteDecision = 'wait' | 'home' | 'owner-onboarding' | 'none';

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
  if (!input.hasOrganization && input.isProtectedScreen) {
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
