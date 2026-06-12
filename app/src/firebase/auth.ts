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
  operatorName: string;
  businessAddress: string;
  ownerEmail: string;
}

export interface OwnerOnboardingResult {
  organizationId: string;
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
  };
  if (!trimmedDraft.businessName || !trimmedDraft.operatorName || !trimmedDraft.businessAddress || !trimmedDraft.ownerEmail) {
    throw new Error('Business name, operator name, address, and email are required.');
  }

  const organizationRef = doc(collection(db, 'organizations'));
  const membershipRef = doc(db, `organizations/${organizationRef.id}/memberships/${user.uid}`);

  await setDoc(organizationRef, {
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

  await setDoc(membershipRef, {
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await setDoc(
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

  return {
    organizationId: organizationRef.id,
  };
}
