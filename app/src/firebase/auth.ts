import {
  type Auth,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, Timestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { getFirebaseClient } from './client';
import { calculateTrialEndsAt } from '../trial';
import { logOnboardingRedirect, logOnboardingWrite } from '../onboardingDebug';

function requireFirebaseAuth(): { auth: Auth; db: Firestore } {
  const client = getFirebaseClient();
  if (!client.auth || !client.db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to run auth flows.');
  }
  return { auth: client.auth, db: client.db };
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  const { auth } = requireFirebaseAuth();
  return signInWithEmailAndPassword(auth, email, password);
}

function getGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

async function upsertGoogleUserProfile(credential: UserCredential, db: Firestore): Promise<void> {
  const additionalUserInfo = getAdditionalUserInfo(credential);
  logOnboardingWrite('google-profile-write-initiated', {
    pathPattern: 'users/{uid}',
    isNewUser: Boolean(additionalUserInfo?.isNewUser),
    fields: ['displayName', 'email', 'lastSignInAt', 'lastSignInProvider'],
  });
  await setDoc(
    doc(db, 'users', credential.user.uid),
    {
      displayName: credential.user.displayName ?? null,
      email: credential.user.email,
      lastSignInAt: serverTimestamp(),
      lastSignInProvider: 'google.com',
      ...(additionalUserInfo?.isNewUser
        ? {
            createdAt: serverTimestamp(),
            createdFrom: 'google-provider',
          }
        : {}),
    },
    { merge: true },
  );
  logOnboardingWrite('google-profile-write-confirmed', {
    pathPattern: 'users/{uid}',
  });
}

async function upsertGoogleUserProfileAfterSignIn(credential: UserCredential, db: Firestore): Promise<void> {
  try {
    await upsertGoogleUserProfile(credential, db);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? 'unknown')
      : 'unknown';
    console.warn('Google authentication succeeded; profile setup will continue during onboarding.', { code });
    logOnboardingWrite('google-profile-write-failed', {
      pathPattern: 'users/{uid}',
      code,
      name: error instanceof Error ? error.name : 'unknown',
    });
  }
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const { auth, db } = requireFirebaseAuth();
  const provider = getGoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  await upsertGoogleUserProfileAfterSignIn(credential, db);
  return credential;
}

export async function signInWithGoogleRedirect(): Promise<void> {
  const { auth } = requireFirebaseAuth();
  const provider = getGoogleAuthProvider();
  await signInWithRedirect(auth, provider);
}

export async function completeGoogleSignInRedirect(): Promise<UserCredential | null> {
  const { auth, db } = requireFirebaseAuth();
  const credential = await getRedirectResult(auth);
  if (!credential) {
    return null;
  }
  await upsertGoogleUserProfileAfterSignIn(credential, db);
  return credential;
}

export async function createOwnerAccount(displayName: string, email: string, password: string): Promise<UserCredential> {
  const { auth } = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }

  return credential;
}

export async function signOutCurrentUser(): Promise<void> {
  const { auth } = requireFirebaseAuth();
  await signOut(auth);
}

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
}

export async function completeOwnerOnboarding(draft: OwnerOnboardingDraft): Promise<OwnerOnboardingResult> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;

  logOnboardingWrite('onboarding-write-requested', {
    authenticated: Boolean(user),
    requiredFieldPresence: {
      businessName: Boolean(draft.businessName.trim()),
      operatorName: Boolean(draft.operatorName.trim()),
      businessAddress: Boolean(draft.businessAddress.trim()),
      ownerEmail: Boolean(draft.ownerEmail.trim() || user?.email),
      locationName: Boolean(draft.locationName.trim()),
      locationAddress: Boolean(draft.locationAddress.trim()),
      machineNumber: Boolean(draft.machineNumber.trim()),
      machineType: Boolean(draft.machineType.trim()),
      machineMake: Boolean(draft.machineMake.trim()),
      machineModelNumber: Boolean(draft.machineModelNumber.trim()),
    },
  });

  if (!user) {
    logOnboardingWrite('onboarding-write-blocked', {
      reason: 'no-authenticated-user',
    });
    throw new Error('No authenticated user. Sign in before finishing onboarding.');
  }

  const trimmedDraft: OwnerOnboardingDraft = {
    businessName: draft.businessName.trim(),
    operatorName: draft.operatorName.trim(),
    businessAddress: draft.businessAddress.trim(),
    ownerEmail: draft.ownerEmail.trim() || user.email || '',
    locationName: draft.locationName.trim(),
    locationAddress: draft.locationAddress.trim(),
    machineNumber: draft.machineNumber.trim(),
    machineType: draft.machineType.trim() || 'Washer',
    machineMake: draft.machineMake.trim(),
    machineModelNumber: draft.machineModelNumber.trim(),
  };
  if (
    !trimmedDraft.businessName
    || !trimmedDraft.operatorName
    || !trimmedDraft.businessAddress
    || !trimmedDraft.ownerEmail
    || !trimmedDraft.locationName
    || !trimmedDraft.locationAddress
    || !trimmedDraft.machineNumber
    || !trimmedDraft.machineMake
    || !trimmedDraft.machineModelNumber
  ) {
    logOnboardingWrite('onboarding-write-blocked', {
      reason: 'required-field-validation-failed',
    });
    throw new Error('Company, operator, address, email, location, and first machine details are required.');
  }

  const organizationRef = doc(collection(db, 'organizations'));
  const membershipRef = doc(db, `organizations/${organizationRef.id}/memberships/${user.uid}`);
  const locationRef = doc(collection(db, `organizations/${organizationRef.id}/locations`));
  const machineRef = doc(collection(db, `organizations/${organizationRef.id}/machines`));
  const batch = writeBatch(db);
  const trialStartedAt = Timestamp.now();
  const trialEndsAt = Timestamp.fromMillis(calculateTrialEndsAt(trialStartedAt.toMillis()));

  batch.set(organizationRef, {
    name: trimmedDraft.businessName,
    operatorName: trimmedDraft.operatorName,
    businessAddress: trimmedDraft.businessAddress,
    ownerEmail: trimmedDraft.ownerEmail,
    ownerUserId: user.uid,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    subscriptionStatus: 'trialing',
    trialStartedAt,
    trialEndsAt,
    onboardingStatus: 'completed',
  });
  batch.set(membershipRef, {
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });
  batch.set(locationRef, {
    name: trimmedDraft.locationName,
    address: trimmedDraft.locationAddress,
    status: 'active',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(machineRef, {
    machineNumber: trimmedDraft.machineNumber,
    type: trimmedDraft.machineType,
    make: trimmedDraft.machineMake,
    modelNumber: trimmedDraft.machineModelNumber,
    model: `${trimmedDraft.machineMake} ${trimmedDraft.machineModelNumber}`.trim(),
    locationId: locationRef.id,
    locationName: trimmedDraft.locationName,
    status: 'running',
    statusLabel: 'Operational',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(
    doc(db, 'users', user.uid),
    {
      displayName: trimmedDraft.operatorName,
      email: trimmedDraft.ownerEmail,
      defaultOrganizationId: organizationRef.id,
      onboardingDraft: trimmedDraft,
      onboardingCompletedAt: serverTimestamp(),
    },
    { merge: true },
  );
  logOnboardingWrite('onboarding-batch-writes-queued', {
    pathPatterns: {
      organization: 'organizations/{organizationId}',
      membership: 'organizations/{organizationId}/memberships/{uid}',
      location: 'organizations/{organizationId}/locations/{locationId}',
      machine: 'organizations/{organizationId}/machines/{machineId}',
      userProfile: 'users/{uid}',
    },
    dataShape: {
      organizationFields: ['name', 'operatorName', 'businessAddress', 'ownerEmail', 'ownerUserId', 'createdBy', 'createdAt', 'subscriptionStatus', 'trialStartedAt', 'trialEndsAt', 'onboardingStatus'],
      membershipFields: ['role', 'status', 'createdAt', 'createdBy'],
      locationFields: ['name', 'address', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
      machineFields: ['machineNumber', 'type', 'make', 'modelNumber', 'model', 'locationId', 'locationName', 'status', 'statusLabel', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
      userProfileFields: ['displayName', 'email', 'defaultOrganizationId', 'onboardingDraft', 'onboardingCompletedAt'],
      onboardingStatus: 'completed',
      subscriptionStatus: 'trialing',
      allRequiredValuesPresent: true,
    },
  });
  logOnboardingWrite('onboarding-batch-commit-initiated', {
    writeCount: 5,
  });
  try {
    await batch.commit();
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? 'unknown')
      : 'unknown';
    logOnboardingWrite('onboarding-batch-commit-failed', {
      writeCount: 5,
      code,
      name: error instanceof Error ? error.name : 'unknown',
    });
    throw error;
  }

  logOnboardingWrite('onboarding-batch-commit-confirmed', {
    writeCount: 5,
    organizationCreated: true,
    membershipCreated: true,
    locationCreated: true,
    machineCreated: true,
    userProfileUpdated: true,
  });

  return {
    organizationId: organizationRef.id,
    locationId: locationRef.id,
    machineId: machineRef.id,
  };
}
