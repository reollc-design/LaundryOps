import type { Auth } from 'firebase/auth';
import { addDoc, collection, doc, deleteDoc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import type { WorkOrderStatus } from '../data';
import { getFirebaseClient } from './client';

function requireFirebaseAuth(): { auth: Auth; db: Firestore } {
  const client = getFirebaseClient();
  if (!client.auth || !client.db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to run work order flows.');
  }
  return { auth: client.auth, db: client.db };
}

function statusLabel(status: WorkOrderStatus): string {
  if (status === 'in-progress') {
    return 'In Progress';
  }
  if (status === 'waiting') {
    return 'Waiting Parts';
  }
  if (status === 'completed') {
    return 'Completed';
  }
  if (status === 'assigned') {
    return 'Assigned';
  }
  return 'Open';
}

function createWorkOrderNumber(): string {
  const suffix = Date.now().toString().slice(-6);
  return `WO-${suffix}`;
}

export interface CreateWorkOrderFromDraftInput {
  organizationId: string;
  locationId: string;
  locationName: string;
  machineId?: string | null;
  machineNumber: string;
  machineModel: string;
  title: string;
  priority: 'High' | 'Standard' | 'Low';
  assigneeName: string;
  dueLabel: string;
  partsCost: number;
  laborCost: number;
  totalCostLabel: string;
}

export interface CreateWorkOrderFromDraftResult {
  workOrderId: string;
}

export async function createWorkOrderFromDraft(input: CreateWorkOrderFromDraftInput): Promise<CreateWorkOrderFromDraftResult> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before creating work orders.');
  }

  const workOrderRef = await addDoc(collection(db, `organizations/${input.organizationId}/workOrders`), {
    number: createWorkOrderNumber(),
    machineId: input.machineId ?? null,
    machineNumber: input.machineNumber,
    machineModel: input.machineModel,
    title: input.title,
    locationId: input.locationId,
    locationName: input.locationName,
    status: 'open',
    statusLabel: 'Open',
    priority: input.priority,
    assigneeName: input.assigneeName,
    dueLabel: input.dueLabel,
    source: 'AI draft',
    partsCost: input.partsCost,
    laborCost: input.laborCost,
    totalCost: input.partsCost + input.laborCost,
    estimate: input.totalCostLabel,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  return { workOrderId: workOrderRef.id };
}

export interface UpdateWorkOrderStatusInput {
  organizationId: string;
  workOrderId: string;
  status: WorkOrderStatus;
}

export async function updateWorkOrderStatus(input: UpdateWorkOrderStatusInput): Promise<void> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before updating work orders.');
  }

  const workOrderRef = doc(db, `organizations/${input.organizationId}/workOrders/${input.workOrderId}`);
  await updateDoc(workOrderRef, {
    status: input.status,
    statusLabel: statusLabel(input.status),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    ...(input.status === 'completed' ? { completedAt: serverTimestamp() } : {}),
  });
}

export interface DeleteWorkOrderInput {
  organizationId: string;
  workOrderId: string;
}

export async function deleteWorkOrder(input: DeleteWorkOrderInput): Promise<void> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before deleting work orders.');
  }

  const workOrderRef = doc(db, `organizations/${input.organizationId}/workOrders/${input.workOrderId}`);
  await deleteDoc(workOrderRef);
}
