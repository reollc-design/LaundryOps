import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseClient } from '../firebase/client';

export interface UserProfileData {
  displayName: string | null;
  email: string | null;
  createdFrom: string | null;
}

export interface UserProfileState {
  loading: boolean;
  profile: UserProfileData | null;
  error: string | null;
}

export function useUserProfile(user: User | null): UserProfileState {
  const client = useMemo(() => getFirebaseClient(), []);
  const [state, setState] = useState<UserProfileState>({
    loading: false,
    profile: null,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      setState({
        loading: false,
        profile: null,
        error: null,
      });
      return undefined;
    }

    if (!client.db) {
      setState({
        loading: false,
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
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        const data = snapshot.data();
        setState({
          loading: false,
          profile: snapshot.exists()
            ? {
                displayName: typeof data?.displayName === 'string' ? data.displayName : null,
                email: typeof data?.email === 'string' ? data.email : user.email ?? null,
                createdFrom: typeof data?.createdFrom === 'string' ? data.createdFrom : null,
              }
            : null,
          error: null,
        });
      },
      (error) => {
        setState({
          loading: false,
          profile: null,
          error: error.message,
        });
      },
    );

    return unsubscribe;
  }, [client.db, user]);

  return state;
}

