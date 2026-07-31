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
import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { getFirebaseClient } from './client';
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
  replayed: boolean;
}

interface OwnerOnboardingEndpointResponse extends Partial<OwnerOnboardingResult> {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
}

function functionsApiBaseUrl(): string {
  const baseUrl =
    import.meta.env.VITE_FUNCTIONS_API_BASE_URL?.trim()
    || import.meta.env.VITE_BILLING_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Functions API URL is not configured.');
  }
  return baseUrl.replace(/\/+$/, '');
}

export async function completeOwnerOnboarding(
  draft: OwnerOnboardingDraft,
  requestId: string,
): Promise<OwnerOnboardingResult> {
  const { auth } = requireFirebaseAuth();
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

  if (!requestId.trim()) {
    throw new Error('Could not create a safe onboarding request. Refresh and try again.');
  }

  logOnboardingWrite('onboarding-function-request-initiated', {
    endpoint: 'completeOwnerOnboarding',
    writeCount: 5,
  });
  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${functionsApiBaseUrl()}/completeOwnerOnboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ requestId: requestId.trim(), draft: trimmedDraft }),
    });
    const data = (await response.json().catch(() => ({}))) as OwnerOnboardingEndpointResponse;
    if (
      !response.ok
      || data.ok === false
      || typeof data.organizationId !== 'string'
      || typeof data.locationId !== 'string'
      || typeof data.machineId !== 'string'
    ) {
      throw new Error(data.error?.message ?? 'Could not complete company setup.');
    }

    logOnboardingWrite('onboarding-function-request-confirmed', {
      endpoint: 'completeOwnerOnboarding',
      writeCount: 5,
      replayed: Boolean(data.replayed),
    });
    return {
      organizationId: data.organizationId,
      locationId: data.locationId,
      machineId: data.machineId,
      replayed: Boolean(data.replayed),
    };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? 'unknown')
      : 'unknown';
    logOnboardingWrite('onboarding-function-request-failed', {
      writeCount: 5,
      code,
      name: error instanceof Error ? error.name : 'unknown',
    });
    throw error;
  }
}
