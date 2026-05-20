import {
  type Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
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

export async function createOwnerAccount(displayName: string, email: string, password: string): Promise<UserCredential> {
  const { auth, db } = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }

  await setDoc(
    doc(db, 'users', credential.user.uid),
    {
      displayName: displayName.trim() || null,
      email: credential.user.email,
      createdAt: serverTimestamp(),
      createdFrom: 'mobile-ui',
    },
    { merge: true },
  );

  return credential;
}

export async function signOutCurrentUser(): Promise<void> {
  const { auth } = requireFirebaseAuth();
  await signOut(auth);
}

export interface OwnerOnboardingDraft {
  businessName: string;
  locationName: string;
  locationCityState: string;
  machineNumber: string;
  machineType: string;
  machineModel: string;
  technicianName: string;
  manualName: string;
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
    locationName: draft.locationName.trim(),
    locationCityState: draft.locationCityState.trim(),
    machineNumber: draft.machineNumber.trim(),
    machineType: draft.machineType.trim(),
    machineModel: draft.machineModel.trim(),
    technicianName: draft.technicianName.trim(),
    manualName: draft.manualName.trim(),
  };

  const organizationRef = doc(collection(db, 'organizations'));
  const membershipRef = doc(db, `organizations/${organizationRef.id}/memberships/${user.uid}`);
  const locationRef = doc(collection(db, `organizations/${organizationRef.id}/locations`));
  const machineRef = doc(collection(db, `organizations/${organizationRef.id}/machines`));

  await setDoc(organizationRef, {
    name: trimmedDraft.businessName,
    ownerUserId: user.uid,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    subscriptionStatus: 'trialing',
    trialStartedAt: serverTimestamp(),
    onboardingStatus: 'in-progress',
  });

  await setDoc(membershipRef, {
    role: 'owner',
    status: 'active',
    allowedLocationIds: ['all'],
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await setDoc(locationRef, {
    name: trimmedDraft.locationName,
    cityState: trimmedDraft.locationCityState,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await setDoc(machineRef, {
    machineNumber: trimmedDraft.machineNumber,
    type: trimmedDraft.machineType,
    model: trimmedDraft.machineModel,
    locationId: locationRef.id,
    status: 'running',
    statusLabel: 'Running',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await setDoc(
    doc(db, 'users', user.uid),
    {
      defaultOrganizationId: organizationRef.id,
      onboardingDraft: trimmedDraft,
      onboardingCompletedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    organizationId: organizationRef.id,
    locationId: locationRef.id,
    machineId: machineRef.id,
  };
}
