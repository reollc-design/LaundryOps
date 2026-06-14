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
  if (status === 'planned') {
    return 'Planned';
  }
  if (status === 'in-progress') {
    return 'In Progress';
  }
  if (status === 'completed') {
    return 'Completed';
  }
  if (status === 'waiting') {
    return 'In Progress';
  }
  if (status === 'assigned') {
    return 'Planned';
  }
  return 'Planned';
}

function createWorkOrderNumber(): string {
  const suffix = Date.now().toString().slice(-6);
  return `WO-${suffix}`;
}

export interface CreateWorkOrderFromDraftInput {
  organizationId: string;
  machineId?: string | null;
  machineNumber: string;
  machineModel: string;
  title: string;
  status: WorkOrderStatus;
  priority: 'High' | 'Standard' | 'Low';
  assigneeName: string;
  dueLabel?: string;
  repairType?: string;
  maintenanceType?: string;
  symptoms?: string;
  errorCode?: string;
  otherCost?: number;
  notes?: string;
  aiDiagnosis?: string | null;
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
    status: input.status,
    statusLabel: statusLabel(input.status),
    priority: input.priority,
    assigneeName: input.assigneeName,
    dueLabel: input.dueLabel ?? null,
    repairType: input.repairType ?? null,
    maintenanceType: input.maintenanceType ?? null,
    symptoms: input.symptoms ?? null,
    errorCode: input.errorCode ?? null,
    notes: input.notes ?? null,
    aiDiagnosis: input.aiDiagnosis ?? null,
    source: 'Manual entry',
    partsCost: input.partsCost,
    laborCost: input.laborCost,
    otherCost: input.otherCost ?? 0,
    totalCost: input.partsCost + input.laborCost + (input.otherCost ?? 0),
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
