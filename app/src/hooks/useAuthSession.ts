import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { getFirebaseClient } from '../firebase/client';

export interface AuthSessionState {
  loading: boolean;
  user: User | null;
  error: string | null;
  configured: boolean;
  usingEmulators: boolean;
  projectId: string | null;
}

export function useAuthSession(): AuthSessionState {
  const client = useMemo(() => getFirebaseClient(), []);
  const [state, setState] = useState<AuthSessionState>({
    loading: client.configured,
    user: null,
    error: null,
    configured: client.configured,
    usingEmulators: client.usingEmulators,
    projectId: client.projectId,
  });

  useEffect(() => {
    if (!client.auth) {
      setState((previous) => ({
        ...previous,
        loading: false,
      }));
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(
      client.auth,
      (user) => {
        setState({
          loading: false,
          user,
          error: null,
          configured: client.configured,
          usingEmulators: client.usingEmulators,
          projectId: client.projectId,
        });
      },
      (error) => {
        setState({
          loading: false,
          user: null,
          error: error.message,
          configured: client.configured,
          usingEmulators: client.usingEmulators,
          projectId: client.projectId,
        });
      },
    );

    return unsubscribe;
  }, [client]);

  return state;
}

