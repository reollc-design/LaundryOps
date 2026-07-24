import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseClient } from '../firebase/client';

const MANUAL_MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

export function useOrganizationMembership(user: User | null, organizationId: string | null): boolean {
  const client = useMemo(() => getFirebaseClient(), []);
  const [canManageManuals, setCanManageManuals] = useState(false);

  useEffect(() => {
    if (!user || !organizationId || !client.db) {
      setCanManageManuals(false);
      return undefined;
    }

    let organizationOwnerUserId = '';
    let membershipRole = '';
    let membershipActive = false;
    const updateAccess = () => {
      setCanManageManuals(
        organizationOwnerUserId === user.uid
        || (membershipActive && MANUAL_MANAGER_ROLES.has(membershipRole)),
      );
    };
    const unsubscribeOrganization = onSnapshot(
      doc(client.db, `organizations/${organizationId}`),
      (snapshot) => {
        const data = snapshot.data();
        organizationOwnerUserId = typeof data?.ownerUserId === 'string' ? data.ownerUserId : '';
        updateAccess();
      },
      () => {
        organizationOwnerUserId = '';
        updateAccess();
      },
    );
    const unsubscribeMembership = onSnapshot(
      doc(client.db, `organizations/${organizationId}/memberships/${user.uid}`),
      (snapshot) => {
        const data = snapshot.data();
        membershipRole = typeof data?.role === 'string' ? data.role : '';
        membershipActive = data?.status === 'active';
        updateAccess();
      },
      () => {
        membershipRole = '';
        membershipActive = false;
        updateAccess();
      },
    );
    return () => {
      unsubscribeOrganization();
      unsubscribeMembership();
    };
  }, [client.db, organizationId, user]);

  return canManageManuals;
}
