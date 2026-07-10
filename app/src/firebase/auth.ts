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
import { collection, doc, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { getFirebaseClient } from './client';

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
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const { auth, db } = requireFirebaseAuth();
  const provider = getGoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  await upsertGoogleUserProfile(credential, db);
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
  await upsertGoogleUserProfile(credential, db);
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

  if (!user) {
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
    throw new Error('Company, operator, address, email, location, and first machine details are required.');
  }

  const organizationRef = doc(collection(db, 'organizations'));
  const membershipRef = doc(db, `organizations/${organizationRef.id}/memberships/${user.uid}`);
  const locationRef = doc(collection(db, `organizations/${organizationRef.id}/locations`));
  const machineRef = doc(collection(db, `organizations/${organizationRef.id}/machines`));
  const batch = writeBatch(db);

  batch.set(organizationRef, {
    name: trimmedDraft.businessName,
    operatorName: trimmedDraft.operatorName,
    businessAddress: trimmedDraft.businessAddress,
    ownerEmail: trimmedDraft.ownerEmail,
    ownerUserId: user.uid,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    subscriptionStatus: 'trialing',
    trialStartedAt: serverTimestamp(),
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
  await batch.commit();

  return {
    organizationId: organizationRef.id,
    locationId: locationRef.id,
    machineId: machineRef.id,
  };
}
