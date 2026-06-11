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
  machineNumber: string;
  machineType: string;
  machineMake: string;
  machineModelNumber: string;
  manualName: string;
}

export interface OwnerOnboardingResult {
  organizationId: string;
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
    machineNumber: draft.machineNumber.trim(),
    machineType: draft.machineType.trim(),
    machineMake: draft.machineMake.trim(),
    machineModelNumber: draft.machineModelNumber.trim(),
    manualName: draft.manualName.trim(),
  };
  const machineModel = `${trimmedDraft.machineMake} ${trimmedDraft.machineModelNumber}`.trim();

  const organizationRef = doc(collection(db, 'organizations'));
  const membershipRef = doc(db, `organizations/${organizationRef.id}/memberships/${user.uid}`);
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
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await setDoc(machineRef, {
    machineNumber: trimmedDraft.machineNumber,
    type: trimmedDraft.machineType,
    make: trimmedDraft.machineMake,
    modelNumber: trimmedDraft.machineModelNumber,
    model: machineModel || trimmedDraft.machineModelNumber || trimmedDraft.machineMake,
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
    machineId: machineRef.id,
  };
}
