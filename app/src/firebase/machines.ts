import type { Auth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import type { MachineStatus } from '../data';
import { getFirebaseClient } from './client';

export type MachineOperationalStatus = Extract<MachineStatus, 'running' | 'needs-repair' | 'down'>;

function requireFirebaseAuth(): { auth: Auth; db: Firestore } {
  const client = getFirebaseClient();
  if (!client.auth || !client.db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to run machine status updates.');
  }
  return { auth: client.auth, db: client.db };
}

function statusLabel(status: MachineOperationalStatus): string {
  if (status === 'down') {
    return 'Down';
  }
  if (status === 'needs-repair') {
    return 'Needs Repair';
  }
  return 'Operational';
}

export interface UpdateMachineStatusInput {
  organizationId: string;
  machineId: string;
  status: MachineOperationalStatus;
}

export async function updateMachineStatus(input: UpdateMachineStatusInput): Promise<void> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before updating machine status.');
  }

  const machineRef = doc(db, `organizations/${input.organizationId}/machines/${input.machineId}`);
  await updateDoc(machineRef, {
    status: input.status,
    statusLabel: statusLabel(input.status),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

export interface CreateMachineInput {
  organizationId: string;
  locationId: string;
  machineNumber: string;
  type: string;
  make: string;
  modelNumber: string;
}

export async function createMachine(input: CreateMachineInput): Promise<{ machineId: string }> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before creating machines.');
  }

  const machineNumber = input.machineNumber.trim();
  const type = input.type.trim() || 'Machine';
  const make = input.make.trim();
  const modelNumber = input.modelNumber.trim();
  const model = `${make} ${modelNumber}`.trim();
  if (!machineNumber || !model) {
    throw new Error('Machine number, make, and model number are required.');
  }

  const machineRef = await addDoc(collection(db, `organizations/${input.organizationId}/machines`), {
    machineNumber,
    type,
    make,
    modelNumber,
    model,
    locationId: input.locationId,
    status: 'running',
    statusLabel: 'Operational',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  return { machineId: machineRef.id };
}

export interface UpdateMachineInput {
  organizationId: string;
  machineId: string;
  locationId: string;
  machineNumber: string;
  type: string;
  make: string;
  modelNumber: string;
}

export async function updateMachine(input: UpdateMachineInput): Promise<void> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before editing machines.');
  }

  const machineNumber = input.machineNumber.trim();
  const type = input.type.trim() || 'Machine';
  const make = input.make.trim();
  const modelNumber = input.modelNumber.trim();
  const model = `${make} ${modelNumber}`.trim();
  if (!machineNumber || !model) {
    throw new Error('Machine number, make, and model number are required.');
  }
  if (!input.locationId.trim()) {
    throw new Error('Location is required.');
  }

  const machineRef = doc(db, `organizations/${input.organizationId}/machines/${input.machineId}`);
  await updateDoc(machineRef, {
    machineNumber,
    type,
    make,
    modelNumber,
    model,
    locationId: input.locationId.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

export interface DeleteMachineInput {
  organizationId: string;
  machineId: string;
}

export async function deleteMachine(input: DeleteMachineInput): Promise<void> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before deleting machines.');
  }

  const machineRef = doc(db, `organizations/${input.organizationId}/machines/${input.machineId}`);
  await deleteDoc(machineRef);
}
