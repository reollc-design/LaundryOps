import type { Auth } from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseClient } from './client';

interface ManualEndpointResponse {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
  answer?: string;
  grounded?: boolean;
  citations?: Array<{
    chunkId: string;
    preview: string;
  }>;
  manual?: {
    id: string;
    title: string;
    machineModel: string;
  };
}

export interface UploadManualInput {
  organizationId: string;
  machineModel: string;
  file: File;
  linkedMachineCount: number;
}

export interface UploadManualResult {
  manualId: string;
  storagePath: string;
}

export interface ManualRepairAssistInput {
  organizationId: string;
  machineModel: string;
  symptoms: string;
  errorCode?: string;
}

export interface ManualRepairAssistResult {
  answer: string;
  grounded: boolean;
  manual: {
    id: string;
    title: string;
    machineModel: string;
  } | null;
  citations: Array<{
    chunkId: string;
    preview: string;
  }>;
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

function normalizeMachineModelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
  const looksLikePdf = input.file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) {
    throw new Error('Upload a PDF manual file.');
  }

  const { auth, db, storage } = requireFirebaseServices();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in before uploading manuals.');
  }

  const manualRef = doc(collection(db, `organizations/${organizationId}/manuals`));
  const storagePath = `orgs/${organizationId}/manuals/${manualRef.id}/${fileName}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, input.file, { contentType: 'application/pdf' });

  await setDoc(manualRef, {
    title: fileName,
    machineModel,
    machineModelKey: normalizeMachineModelKey(machineModel),
    status: 'processing',
    source: 'Uploaded from LaundryOps',
    storagePath,
    pageCount: null,
    chunkCount: 0,
    linkedMachineCount: Math.max(0, Number.isFinite(input.linkedMachineCount) ? Math.floor(input.linkedMachineCount) : 0),
    indexError: null,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  await callManualEndpoint('indexOrganizationManual', {
    organizationId,
    manualId: manualRef.id,
  });

  return {
    manualId: manualRef.id,
    storagePath,
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
  if (!symptoms) {
    throw new Error('Symptoms are required.');
  }

  const data = await callManualEndpoint('generateRepairAssist', {
    organizationId,
    machineModel,
    symptoms,
    errorCode: errorCode || null,
  });

  return {
    answer: data.answer ?? 'No response was returned.',
    grounded: Boolean(data.grounded),
    manual: data.manual ?? null,
    citations: Array.isArray(data.citations) ? data.citations : [],
  };
}
