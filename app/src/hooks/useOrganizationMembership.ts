import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseClient } from '../firebase/client';

export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'technician' | 'viewer' | 'unknown';

export interface OrganizationMembershipState {
  loading: boolean;
  role: OrganizationRole;
  active: boolean;
  canManageManuals: boolean;
  canManageOperations: boolean;
  canChangeMachineStatus: boolean;
  canCreateWorkOrders: boolean;
  canEditWorkOrders: boolean;
  canDeleteWorkOrders: boolean;
  canEditMachines: boolean;
  canDeleteMachines: boolean;
}

const EMPTY_STATE: OrganizationMembershipState = {
  loading: false,
  role: 'unknown',
  active: false,
  canManageManuals: false,
  canManageOperations: false,
  canChangeMachineStatus: false,
  canCreateWorkOrders: false,
  canEditWorkOrders: false,
  canDeleteWorkOrders: false,
  canEditMachines: false,
  canDeleteMachines: false,
};

const MANUAL_MANAGER_ROLES = new Set<OrganizationRole>(['owner', 'admin', 'manager']);
const OPERATIONS_ROLES = new Set<OrganizationRole>(['owner', 'admin', 'manager']);
const STATUS_ROLES = new Set<OrganizationRole>(['owner', 'admin', 'manager', 'technician']);
const OWNER_ADMIN_ROLES = new Set<OrganizationRole>(['owner', 'admin']);

export function useOrganizationMembership(user: User | null, organizationId: string | null): OrganizationMembershipState {
  const client = useMemo(() => getFirebaseClient(), []);
  const [state, setState] = useState<OrganizationMembershipState>(EMPTY_STATE);

  useEffect(() => {
    if (!user || !organizationId || !client.db) {
      setState(EMPTY_STATE);
      return undefined;
    }

    let organizationOwnerUserId = '';
    let membershipRole: OrganizationRole = 'unknown';
    let membershipActive = false;
    const updateAccess = () => {
      const isOwner = organizationOwnerUserId === user.uid;
      const role = isOwner ? 'owner' : membershipRole;
      const active = isOwner || membershipActive;
      const canManageOperations = active && OPERATIONS_ROLES.has(role);
      setState({
        loading: false,
        role,
        active,
        canManageManuals: active && MANUAL_MANAGER_ROLES.has(role),
        canManageOperations,
        canChangeMachineStatus: active && STATUS_ROLES.has(role),
        canCreateWorkOrders: canManageOperations,
        canEditWorkOrders: canManageOperations,
        canDeleteWorkOrders: active && OWNER_ADMIN_ROLES.has(role),
        canEditMachines: canManageOperations,
        canDeleteMachines: active && OWNER_ADMIN_ROLES.has(role),
      });
    };
    setState((previous) => ({ ...previous, loading: true }));
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
        const rawRole = typeof data?.role === 'string' ? data.role : '';
        membershipRole = ['owner', 'admin', 'manager', 'technician', 'viewer'].includes(rawRole)
          ? rawRole as OrganizationRole
          : 'unknown';
        membershipActive = data?.status === 'active';
        updateAccess();
      },
      () => {
        membershipRole = 'unknown';
        membershipActive = false;
        updateAccess();
      },
    );
    return () => {
      unsubscribeOrganization();
      unsubscribeMembership();
    };
  }, [client.db, organizationId, user]);

  return state;
}
