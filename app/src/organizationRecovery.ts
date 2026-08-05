export interface OrganizationRecoveryStateInput {
  loading: boolean;
  organizationExists: boolean | null;
  errorCode: string | null;
}

export function isInvalidOrganizationState(input: OrganizationRecoveryStateInput): boolean {
  if (input.loading) {
    return false;
  }

  return input.organizationExists === false
    || input.errorCode === 'permission-denied'
    || input.errorCode === 'not-found';
}
