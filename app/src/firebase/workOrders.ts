import type { Auth } from 'firebase/auth';
import { collection, deleteDoc, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { deleteObject, getBlob, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import type { RepairAssistSourceEvidence, WorkOrderPhotoAttachment, WorkOrderStatus } from '../data';
import { MAX_REPAIR_ASSIST_PHOTOS, MAX_REPAIR_ASSIST_PHOTO_BYTES } from '../repairAssistPhotos';
import { getFirebaseClient } from './client';

function requireFirebaseAuth(): { auth: Auth; db: Firestore; storage: FirebaseStorage } {
  const client = getFirebaseClient();
  if (!client.auth || !client.db || !client.storage) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to run work order flows.');
  }
  return { auth: client.auth, db: client.db, storage: client.storage };
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

function sanitizePhotoFilename(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'machine-photo.jpg';
}

function isSupportedPhoto(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase());
}

async function uploadWorkOrderPhotos(params: {
  storage: FirebaseStorage;
  organizationId: string;
  workOrderId: string;
  files: File[];
  source: WorkOrderPhotoAttachment['source'];
}): Promise<WorkOrderPhotoAttachment[]> {
  if (params.files.length > MAX_REPAIR_ASSIST_PHOTOS) {
    throw new Error(`Add up to ${MAX_REPAIR_ASSIST_PHOTOS} photos at a time.`);
  }

  const uploadedPaths: string[] = [];
  const attachments: WorkOrderPhotoAttachment[] = [];
  try {
    for (const file of params.files) {
      if (!isSupportedPhoto(file) || file.size <= 0 || file.size > MAX_REPAIR_ASSIST_PHOTO_BYTES) {
        throw new Error('Each photo must be a valid JPG, PNG, or WebP image no larger than 5 MB.');
      }
      const fileName = sanitizePhotoFilename(file.name);
      const storagePath = `orgs/${params.organizationId}/workOrders/${params.workOrderId}/attachments/${crypto.randomUUID()}-${fileName}`;
      await uploadBytes(ref(params.storage, storagePath), file, {
        contentType: file.type,
        customMetadata: {
          source: params.source,
          workOrderId: params.workOrderId,
        },
      });
      uploadedPaths.push(storagePath);
      attachments.push({
        storagePath,
        fileName,
        contentType: file.type,
        sizeBytes: file.size,
        source: params.source,
      });
    }
    return attachments;
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map((storagePath) => deleteObject(ref(params.storage, storagePath))));
    throw error;
  }
}

async function deleteStorageObjectIfPresent(storage: FirebaseStorage, storagePath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code !== 'storage/object-not-found') {
      throw error;
    }
  }
}

function normalizeMaintenanceDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Maintenance date is invalid.');
  }
  return new Date(parsed).toISOString().slice(0, 10);
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
  maintenanceDate: string;
  dueLabel?: string;
  repairType?: string;
  maintenanceType?: string;
  symptoms?: string;
  errorCode?: string;
  otherCost?: number;
  notes?: string;
  aiDiagnosis?: string | null;
  aiSource?: RepairAssistSourceEvidence | null;
  photoFiles?: File[];
  photoSource?: WorkOrderPhotoAttachment['source'];
  partsCost: number;
  laborCost: number;
  totalCostLabel: string;
}

export interface CreateWorkOrderFromDraftResult {
  workOrderId: string;
  photoUploadError: string | null;
}

export async function createWorkOrderFromDraft(input: CreateWorkOrderFromDraftInput): Promise<CreateWorkOrderFromDraftResult> {
  const { auth, db, storage } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before creating work orders.');
  }
  const maintenanceDate = normalizeMaintenanceDate(input.maintenanceDate);
  const hasMachine = Boolean(input.organizationId.trim() && input.machineId && input.machineNumber.trim() && input.machineModel.trim());
  const hasTechnicianEntry = Boolean(
    input.symptoms?.trim()
    || input.repairType?.trim()
    || input.errorCode?.trim()
    || input.notes?.trim()
    || input.aiDiagnosis?.trim()
    || input.partsCost > 0
    || input.laborCost > 0
    || (input.otherCost ?? 0) > 0,
  );
  if (!hasMachine) {
    throw new Error('Choose a machine before saving this maintenance record.');
  }
  if (!hasTechnicianEntry) {
    throw new Error('Add symptoms, issue type, notes, an error code, or a cost before saving.');
  }

  const workOrderRef = doc(collection(db, `organizations/${input.organizationId}/workOrders`));
  await setDoc(workOrderRef, {
    number: createWorkOrderNumber(),
    machineId: input.machineId ?? null,
    machineNumber: input.machineNumber,
    machineModel: input.machineModel,
    title: input.title,
    status: input.status,
    statusLabel: statusLabel(input.status),
    priority: input.priority,
    maintenanceDate,
    assigneeName: input.assigneeName,
    dueLabel: maintenanceDate,
    maintenanceDateEpoch: Date.parse(maintenanceDate),
    repairType: input.repairType ?? null,
    maintenanceType: input.maintenanceType ?? null,
    symptoms: input.symptoms ?? null,
    errorCode: input.errorCode ?? null,
    notes: input.notes ?? null,
    aiDiagnosis: input.aiDiagnosis ?? null,
    aiSource: input.aiSource ?? null,
    photoAttachments: [],
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

  let photoUploadError: string | null = null;
  const photoFiles = input.photoFiles ?? [];
  if (photoFiles.length > 0) {
    let attachments: WorkOrderPhotoAttachment[] = [];
    try {
      attachments = await uploadWorkOrderPhotos({
        storage,
        organizationId: input.organizationId,
        workOrderId: workOrderRef.id,
        files: photoFiles,
        source: input.photoSource ?? 'maintenance-record',
      });
      await updateDoc(workOrderRef, {
        photoAttachments: attachments,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    } catch (error) {
      await Promise.allSettled(attachments.map((attachment) => deleteObject(ref(storage, attachment.storagePath))));
      photoUploadError = error instanceof Error ? error.message : 'Photos could not be attached.';
    }
  }

  return {
    workOrderId: workOrderRef.id,
    photoUploadError,
  };
}

export interface AddWorkOrderPhotosInput {
  organizationId: string;
  workOrderId: string;
  files: File[];
}

export async function addWorkOrderPhotos(input: AddWorkOrderPhotosInput): Promise<void> {
  const { auth, db, storage } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before adding photos.');
  }
  if (input.files.length === 0) {
    return;
  }

  const workOrderRef = doc(db, `organizations/${input.organizationId}/workOrders/${input.workOrderId}`);
  const attachments = await uploadWorkOrderPhotos({
    storage,
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    files: input.files,
    source: 'maintenance-record',
  });
  try {
    await runTransaction(db, async (transaction) => {
      const workOrderSnap = await transaction.get(workOrderRef);
      if (!workOrderSnap.exists()) {
        throw new Error('Maintenance record not found.');
      }
      const existingAttachments = Array.isArray(workOrderSnap.data().photoAttachments)
        ? workOrderSnap.data().photoAttachments
        : [];
      if (existingAttachments.length + attachments.length > MAX_REPAIR_ASSIST_PHOTOS) {
        throw new Error(`Add up to ${MAX_REPAIR_ASSIST_PHOTOS} photos to a maintenance record.`);
      }
      transaction.update(workOrderRef, {
        photoAttachments: [...existingAttachments, ...attachments],
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    });
  } catch (error) {
    await Promise.allSettled(attachments.map((attachment) => deleteObject(ref(storage, attachment.storagePath))));
    throw error;
  }
}

export async function loadWorkOrderPhotoBlob(storagePath: string): Promise<Blob> {
  const { auth, storage } = requireFirebaseAuth();
  if (!auth.currentUser) {
    throw new Error('Sign in before viewing maintenance photos.');
  }
  return getBlob(ref(storage, storagePath), MAX_REPAIR_ASSIST_PHOTO_BYTES);
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
    completedAt: input.status === 'completed' ? serverTimestamp() : deleteField(),
  });
}

export interface UpdateWorkOrderDetailsInput {
  organizationId: string;
  workOrderId: string;
  title: string;
  status: WorkOrderStatus;
  assigneeName: string;
  maintenanceDate: string;
  dueLabel?: string;
  repairType?: string;
  maintenanceType?: string;
  symptoms?: string;
  errorCode?: string;
  notes?: string;
  aiDiagnosis?: string | null;
  aiSource?: RepairAssistSourceEvidence | null;
  partsCost: number;
  laborCost: number;
  otherCost: number;
  totalCostLabel: string;
}

export async function updateWorkOrderDetails(input: UpdateWorkOrderDetailsInput): Promise<void> {
  const { auth, db } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before updating work orders.');
  }
  const maintenanceDate = normalizeMaintenanceDate(input.maintenanceDate);

  const workOrderRef = doc(db, `organizations/${input.organizationId}/workOrders/${input.workOrderId}`);
  await updateDoc(workOrderRef, {
    title: input.title,
    status: input.status,
    statusLabel: statusLabel(input.status),
    assigneeName: input.assigneeName,
    dueLabel: maintenanceDate,
    maintenanceDate,
    maintenanceDateEpoch: Date.parse(maintenanceDate),
    repairType: input.repairType ?? null,
    maintenanceType: input.maintenanceType ?? null,
    symptoms: input.symptoms ?? null,
    errorCode: input.errorCode ?? null,
    notes: input.notes ?? null,
    aiDiagnosis: input.aiDiagnosis ?? null,
    aiSource: input.aiSource ?? null,
    partsCost: input.partsCost,
    laborCost: input.laborCost,
    otherCost: input.otherCost,
    totalCost: input.partsCost + input.laborCost + input.otherCost,
    estimate: input.totalCostLabel,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    completedAt: input.status === 'completed' ? serverTimestamp() : deleteField(),
  });
}

export interface DeleteWorkOrderInput {
  organizationId: string;
  workOrderId: string;
}

export async function deleteWorkOrder(input: DeleteWorkOrderInput): Promise<void> {
  const { auth, db, storage } = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before deleting work orders.');
  }

  const workOrderRef = doc(db, `organizations/${input.organizationId}/workOrders/${input.workOrderId}`);
  const workOrderSnap = await getDoc(workOrderRef);
  const attachments = workOrderSnap.exists() && Array.isArray(workOrderSnap.data().photoAttachments)
    ? workOrderSnap.data().photoAttachments as Array<Record<string, unknown>>
    : [];
  const storagePaths = attachments
    .map((attachment) => typeof attachment.storagePath === 'string' ? attachment.storagePath : null)
    .filter((storagePath): storagePath is string =>
      Boolean(storagePath?.startsWith(`orgs/${input.organizationId}/workOrders/${input.workOrderId}/attachments/`)));
  await deleteDoc(workOrderRef);
  await Promise.allSettled(storagePaths.map((storagePath) => deleteStorageObjectIfPresent(storage, storagePath)));
}
