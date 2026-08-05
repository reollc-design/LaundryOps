import type { Auth } from 'firebase/auth';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseClient } from './client';
import type { RepairAssistImageInput } from '../repairAssistPhotos';
import { isApprovedManualUpload, MAX_MANUAL_UPLOAD_BYTES } from '../manualUploadPolicy';

interface ManualEndpointResponse {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
  answer?: string;
  grounded?: boolean;
  model?: string;
  sourceMode?: string;
  answerMode?: 'openai' | 'manual-fallback';
  analyzedPhotoCount?: number;
  citations?: Array<{
    chunkId: string;
    preview: string;
  }>;
  manual?: {
    id: string;
    title: string;
    machineModel: string;
  };
  reindexedCount?: number;
  failedCount?: number;
  skippedCount?: number;
  uploadedManualCount?: number;
  manualId?: string;
  storagePath?: string;
  limited?: boolean;
  processing?: boolean;
  failures?: Array<{
    manualId: string;
    message: string;
  }>;
}

export interface UploadManualInput {
  organizationId: string;
  machineModel: string;
  file: File;
}

export interface UploadManualResult {
  manualId: string;
  storagePath: string;
  processing: boolean;
}

export interface DeleteManualInput {
  organizationId: string;
  manualId: string;
}

export interface RetryManualOcrInput {
  organizationId: string;
  manualId: string;
}

export interface RetryManualOcrResult {
  processing: boolean;
}

export interface ReindexManualsInput {
  organizationId: string;
}

export interface ReindexManualsResult {
  reindexedCount: number;
  failedCount: number;
  skippedCount: number;
  uploadedManualCount: number;
  limited: boolean;
  failures: Array<{
    manualId: string;
    message: string;
  }>;
}

export interface ManualRepairAssistInput {
  organizationId: string;
  machineModel: string;
  symptoms: string;
  errorCode?: string;
  machineId?: string;
  machineNumber?: string;
  images?: RepairAssistImageInput[];
}

export interface ManualRepairAssistResult {
  answer: string;
  grounded: boolean;
  model: string | null;
  sourceMode: string | null;
  answerMode: 'openai' | 'manual-fallback';
  manual: {
    id: string;
    title: string;
    machineModel: string;
  } | null;
  citations: Array<{
    chunkId: string;
    preview: string;
  }>;
  analyzedPhotoCount: number;
}

function requireFirebaseServices(): { auth: Auth; db: Firestore; storage: FirebaseStorage } {
  const client = getFirebaseClient();
  if (!client.auth || !client.db || !client.storage) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to run manual upload flows.');
  }
  return {
    auth: client.auth,
    db: client.db,
    storage: client.storage,
  };
}

function functionsApiBaseUrl(): string {
  const baseUrl =
    import.meta.env.VITE_FUNCTIONS_API_BASE_URL?.trim() ||
    import.meta.env.VITE_BILLING_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Functions API URL is not configured. Add VITE_FUNCTIONS_API_BASE_URL or VITE_BILLING_API_BASE_URL.');
  }
  return baseUrl.replace(/\/+$/, '');
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.length > 0 ? cleaned : `manual-${Date.now()}.pdf`;
}

async function callManualEndpoint(path: string, payload: Record<string, unknown>): Promise<ManualEndpointResponse> {
  const { auth } = requireFirebaseServices();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in before using manual actions.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${functionsApiBaseUrl()}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as ManualEndpointResponse;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error?.message ?? 'Manual request failed.');
  }
  return data;
}

export async function uploadManualAndIndex(input: UploadManualInput): Promise<UploadManualResult> {
  const organizationId = input.organizationId.trim();
  const machineModel = input.machineModel.trim();
  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }
  if (!machineModel) {
    throw new Error('Machine model is required.');
  }

  const fileName = sanitizeFilename(input.file.name || 'manual.pdf');
  if (!isApprovedManualUpload(fileName, input.file.type, input.file.size)) {
    throw new Error('Upload a PDF manual file.');
  }
  if (input.file.size > MAX_MANUAL_UPLOAD_BYTES) {
    throw new Error('PDF is too large. Please upload a manual of 25 MB or less.');
  }

  const { auth, db, storage } = requireFirebaseServices();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in before uploading manuals.');
  }

  const initialization = await callManualEndpoint('createOrganizationManualUpload', {
    organizationId,
    machineModel,
    fileName,
    contentType: input.file.type,
    sizeBytes: input.file.size,
  });
  if (typeof initialization.manualId !== 'string' || typeof initialization.storagePath !== 'string') {
    throw new Error('Manual upload authorization was not returned.');
  }

  const manualRef = doc(db, `organizations/${organizationId}/manuals/${initialization.manualId}`);
  const storagePath = initialization.storagePath;
  const fileRef = ref(storage, storagePath);

  try {
    await uploadBytes(fileRef, input.file, { contentType: 'application/pdf' });
  } catch (error) {
    await setDoc(
      manualRef,
      {
        status: 'missing',
        indexError: 'Manual upload failed. Try again.',
      },
      { merge: true },
    );
    throw error;
  }

  const indexResult = await callManualEndpoint('indexOrganizationManual', {
    organizationId,
    manualId: initialization.manualId,
  });

  return {
    manualId: manualRef.id,
    storagePath,
    processing: Boolean(indexResult.processing),
  };
}

export async function deleteOrganizationManual(input: DeleteManualInput): Promise<void> {
  const organizationId = input.organizationId.trim();
  const manualId = input.manualId.trim();

  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }
  if (!manualId) {
    throw new Error('Missing manual ID.');
  }

  await callManualEndpoint('deleteOrganizationManual', {
    organizationId,
    manualId,
  });
}

export async function retryOrganizationManualOcr(input: RetryManualOcrInput): Promise<RetryManualOcrResult> {
  const organizationId = input.organizationId.trim();
  const manualId = input.manualId.trim();
  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }
  if (!manualId) {
    throw new Error('Missing manual ID.');
  }

  const data = await callManualEndpoint('indexOrganizationManual', {
    organizationId,
    manualId,
  });

  return {
    processing: Boolean(data.processing),
  };
}

export async function reindexOrganizationManuals(input: ReindexManualsInput): Promise<ReindexManualsResult> {
  const organizationId = input.organizationId.trim();

  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }

  const data = await callManualEndpoint('reindexOrganizationManuals', {
    organizationId,
  });

  return {
    reindexedCount: typeof data.reindexedCount === 'number' ? data.reindexedCount : 0,
    failedCount: typeof data.failedCount === 'number' ? data.failedCount : 0,
    skippedCount: typeof data.skippedCount === 'number' ? data.skippedCount : 0,
    uploadedManualCount: typeof data.uploadedManualCount === 'number' ? data.uploadedManualCount : 0,
    limited: Boolean(data.limited),
    failures: Array.isArray(data.failures) ? data.failures : [],
  };
}

export async function generateManualRepairAssist(input: ManualRepairAssistInput): Promise<ManualRepairAssistResult> {
  const organizationId = input.organizationId.trim();
  const machineModel = input.machineModel.trim();
  const symptoms = input.symptoms.trim();
  const errorCode = input.errorCode?.trim();

  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }
  if (!machineModel) {
    throw new Error('Machine model is required.');
  }
  const images = Array.isArray(input.images) ? input.images : [];
  if (!symptoms && !errorCode) {
    throw new Error('Enter symptoms or an error code before using Repair Assist. Photos help confirm visible conditions.');
  }

  const data = await callManualEndpoint('generateRepairAssist', {
    organizationId,
    machineModel,
    symptoms,
    errorCode: errorCode || null,
    machineId: input.machineId?.trim() || null,
    machineNumber: input.machineNumber?.trim() || null,
    images,
  });

  return {
    answer: data.answer ?? 'No response was returned.',
    grounded: Boolean(data.grounded),
    model: data.model ?? null,
    sourceMode: data.sourceMode ?? null,
    answerMode: data.answerMode === 'manual-fallback' ? 'manual-fallback' : 'openai',
    manual: data.manual ?? null,
    citations: Array.isArray(data.citations) ? data.citations : [],
    analyzedPhotoCount: typeof data.analyzedPhotoCount === 'number' ? data.analyzedPhotoCount : 0,
  };
}
