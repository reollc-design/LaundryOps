import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseClient } from '../firebase/client';
import { logOnboardingRedirect } from '../onboardingDebug';

export interface UserProfileData {
  displayName: string | null;
  email: string | null;
  createdFrom: string | null;
  defaultOrganizationId: string | null;
}

export interface UserProfileState {
  loading: boolean;
  loaded: boolean;
  profile: UserProfileData | null;
  error: string | null;
}

export function useUserProfile(user: User | null): UserProfileState {
  const client = useMemo(() => getFirebaseClient(), []);
  const [state, setState] = useState<UserProfileState>({
    loading: false,
    loaded: false,
    profile: null,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      logOnboardingRedirect('profile-listener-reset', {
        reason: 'no-authenticated-user',
      });
      setState({
        loading: false,
        loaded: false,
        profile: null,
        error: null,
      });
      return undefined;
    }

    if (!client.db) {
      logOnboardingRedirect('profile-listener-unavailable', {
        reason: 'firestore-not-configured',
      });
      setState({
        loading: false,
        loaded: true,
        profile: null,
        error: 'Firestore client is not configured.',
      });
      return undefined;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    const profileRef = doc(client.db, 'users', user.uid);
    logOnboardingRedirect('profile-listener-subscribed', {
      pathPattern: 'users/{uid}',
    });
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        const data = snapshot.data();
        const defaultOrganizationId = typeof data?.defaultOrganizationId === 'string'
          ? data.defaultOrganizationId
          : null;
        logOnboardingRedirect('profile-listener-snapshot', {
          pathPattern: 'users/{uid}',
          exists: snapshot.exists(),
          hasDefaultOrganizationId: Boolean(defaultOrganizationId),
          onboardingCompletedAtPresent: Boolean(data?.onboardingCompletedAt),
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
        setState({
          loading: false,
          loaded: true,
          profile: snapshot.exists()
            ? {
                displayName: typeof data?.displayName === 'string' ? data.displayName : null,
                email: typeof data?.email === 'string' ? data.email : user.email ?? null,
                createdFrom: typeof data?.createdFrom === 'string' ? data.createdFrom : null,
                defaultOrganizationId,
              }
            : null,
          error: null,
        });
      },
      (error) => {
        logOnboardingRedirect('profile-listener-error', {
          pathPattern: 'users/{uid}',
          code: error.code,
          name: error.name,
        });
        setState({
          loading: false,
          loaded: true,
          profile: null,
          error: error.message,
        });
      },
    );

    return unsubscribe;
  }, [client.db, user]);

  return state;
}
