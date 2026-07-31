export const ONBOARDING_TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

const MAX_ONBOARDING_FIELD_LENGTH = 500;
const MAX_REQUEST_ID_LENGTH = 200;

export interface OwnerOnboardingDraft {
  businessName: string;
  operatorName: string;
  businessAddress: string;
  ownerEmail: string;
  locationName: string;
  locationAddress: string;
  machineNumber: string;
  machineType: string;
  machineMake: string;
  machineModelNumber: string;
}

export interface OwnerOnboardingResult {
  organizationId: string;
  locationId: string;
  machineId: string;
  replayed: boolean;
}

export interface OnboardingTransaction {
  get(path: string): Promise<Record<string, unknown> | null>;
  set(path: string, data: Record<string, unknown>, options?: { merge: boolean }): void;
}

export interface OnboardingStore {
  newDocumentId(collectionPath: string): string;
  runTransaction<T>(work: (transaction: OnboardingTransaction) => Promise<T>): Promise<T>;
}

export interface CompleteOwnerOnboardingInput {
  store: OnboardingStore;
  uid: string;
  authenticatedEmail: string | null;
  requestId: string;
  draft: OwnerOnboardingDraft;
  nowMs: number;
  timestampFromMillis: (value: number) => unknown;
}

function requiredText(value: unknown, fieldName: string, maxLength = MAX_ONBOARDING_FIELD_LENGTH): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters.`);
  }
  return trimmed;
}

export function normalizeOwnerOnboardingDraft(
  draft: OwnerOnboardingDraft,
  authenticatedEmail: string | null,
): OwnerOnboardingDraft {
  const ownerEmail = typeof authenticatedEmail === 'string' && authenticatedEmail.trim().length > 0
    ? authenticatedEmail
    : draft.ownerEmail;

  return {
    businessName: requiredText(draft.businessName, 'businessName'),
    operatorName: requiredText(draft.operatorName, 'operatorName'),
    businessAddress: requiredText(draft.businessAddress, 'businessAddress'),
    ownerEmail: requiredText(ownerEmail, 'ownerEmail'),
    locationName: requiredText(draft.locationName, 'locationName'),
    locationAddress: requiredText(draft.locationAddress, 'locationAddress'),
    machineNumber: requiredText(draft.machineNumber, 'machineNumber'),
    machineType: typeof draft.machineType === 'string' && draft.machineType.trim().length > 0
      ? requiredText(draft.machineType, 'machineType')
      : 'Washer',
    machineMake: requiredText(draft.machineMake, 'machineMake'),
    machineModelNumber: requiredText(draft.machineModelNumber, 'machineModelNumber'),
  };
}

function storedOnboardingResult(data: Record<string, unknown>): OwnerOnboardingResult | null {
  const defaultOrganizationId = data.defaultOrganizationId;
  const result = data.onboardingResult;
  if (
    typeof defaultOrganizationId !== 'string'
    || typeof result !== 'object'
    || result === null
  ) {
    return null;
  }

  const stored = result as Record<string, unknown>;
  if (
    stored.organizationId !== defaultOrganizationId
    || typeof stored.locationId !== 'string'
    || typeof stored.machineId !== 'string'
  ) {
    return null;
  }

  return {
    organizationId: defaultOrganizationId,
    locationId: stored.locationId,
    machineId: stored.machineId,
    replayed: true,
  };
}

export async function completeOwnerOnboardingTransaction(
  input: CompleteOwnerOnboardingInput,
): Promise<OwnerOnboardingResult> {
  const uid = requiredText(input.uid, 'uid', MAX_REQUEST_ID_LENGTH);
  const requestId = requiredText(input.requestId, 'requestId', MAX_REQUEST_ID_LENGTH);
  if (!Number.isFinite(input.nowMs) || input.nowMs <= 0) {
    throw new Error('Server time is unavailable.');
  }

  const draft = normalizeOwnerOnboardingDraft(input.draft, input.authenticatedEmail);
  const organizationId = input.store.newDocumentId('organizations');
  const locationId = input.store.newDocumentId(`organizations/${organizationId}/locations`);
  const machineId = input.store.newDocumentId(`organizations/${organizationId}/machines`);
  const trialStartedAt = input.timestampFromMillis(input.nowMs);
  const trialEndsAt = input.timestampFromMillis(input.nowMs + ONBOARDING_TRIAL_DURATION_MS);

  return input.store.runTransaction(async (transaction) => {
    const userPath = `users/${uid}`;
    const userProfile = await transaction.get(userPath);
    if (userProfile?.defaultOrganizationId) {
      const existing = storedOnboardingResult(userProfile);
      if (existing) {
        return existing;
      }
      throw new Error('This account is already connected to an organization.');
    }

    const organizationPath = `organizations/${organizationId}`;
    const membershipPath = `${organizationPath}/memberships/${uid}`;
    const locationPath = `${organizationPath}/locations/${locationId}`;
    const machinePath = `${organizationPath}/machines/${machineId}`;
    const result = { organizationId, locationId, machineId };

    transaction.set(organizationPath, {
      name: draft.businessName,
      operatorName: draft.operatorName,
      businessAddress: draft.businessAddress,
      ownerEmail: draft.ownerEmail,
      ownerUserId: uid,
      createdBy: uid,
      createdAt: trialStartedAt,
      subscriptionStatus: 'trialing',
      trialStartedAt,
      trialEndsAt,
      onboardingStatus: 'completed',
    });
    transaction.set(membershipPath, {
      role: 'owner',
      status: 'active',
      createdAt: trialStartedAt,
      createdBy: uid,
    });
    transaction.set(locationPath, {
      name: draft.locationName,
      address: draft.locationAddress,
      status: 'active',
      createdAt: trialStartedAt,
      createdBy: uid,
      updatedAt: trialStartedAt,
      updatedBy: uid,
    });
    transaction.set(machinePath, {
      machineNumber: draft.machineNumber,
      type: draft.machineType,
      make: draft.machineMake,
      modelNumber: draft.machineModelNumber,
      model: `${draft.machineMake} ${draft.machineModelNumber}`.trim(),
      locationId,
      locationName: draft.locationName,
      status: 'running',
      statusLabel: 'Operational',
      createdAt: trialStartedAt,
      createdBy: uid,
      updatedAt: trialStartedAt,
      updatedBy: uid,
    });
    transaction.set(userPath, {
      displayName: draft.operatorName,
      email: draft.ownerEmail,
      defaultOrganizationId: organizationId,
      onboardingDraft: draft,
      onboardingCompletedAt: trialStartedAt,
      onboardingRequestId: requestId,
      onboardingResult: result,
    }, { merge: true });

    return { ...result, replayed: false };
  });
}
