import type { Auth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseClient } from './client';

type DocumentationResponse = { ok?: boolean; error?: { message?: string }; jobId?: string; candidateId?: string; manualId?: string; status?: string; state?: string; processing?: boolean };

export interface DocumentationCandidate {
  id: string;
  title: string;
  sourceDomain: string;
  sourceUrl: string;
  state: 'review' | 'approved' | 'rejected' | 'attached' | 'cancelled' | string;
  attachmentStatus: string | null;
  verificationLevel: string | null;
  aiRetrievalEnabled: boolean;
}

function requireAuth(): Auth {
  const auth = getFirebaseClient().auth;
  if (!auth?.currentUser) throw new Error('Sign in before managing machine documentation.');
  return auth;
}

function apiBaseUrl(): string {
  const value = import.meta.env.VITE_FUNCTIONS_API_BASE_URL?.trim() || import.meta.env.VITE_BILLING_API_BASE_URL?.trim();
  if (!value) throw new Error('Functions API URL is not configured.');
  return value.replace(/\/+$/, '');
}

async function request(path: string, body: Record<string, unknown>): Promise<DocumentationResponse> {
  const auth = requireAuth();
  const response = await fetch(`${apiBaseUrl()}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as DocumentationResponse;
  if (!response.ok || data.ok === false) throw new Error(data.error?.message ?? 'Documentation request failed.');
  return data;
}

export function startDocumentationDiscovery(organizationId: string, machineId: string): Promise<DocumentationResponse> {
  return request('requestDocumentationDiscovery', { organizationId, machineId });
}

export function submitDocumentationCandidateUrl(organizationId: string, machineId: string, sourceUrl: string): Promise<DocumentationResponse> {
  return request('submitDocumentationCandidateUrl', { organizationId, machineId, sourceUrl });
}

export function reviewDocumentationCandidate(organizationId: string, candidateId: string, state: 'approved' | 'rejected'): Promise<DocumentationResponse> {
  return request('reviewDocumentationCandidate', { organizationId, candidateId, state });
}

export function attachApprovedDocumentationCandidate(organizationId: string, candidateId: string): Promise<DocumentationResponse> {
  return request('attachApprovedDocumentationCandidate', { organizationId, candidateId });
}

export function updateOrganizationDocumentationSettings(organizationId: string, automaticDocumentationEnabled: boolean, mode: 'observation' | 'approval' | 'automatic' = 'approval'): Promise<DocumentationResponse> {
  return request('updateOrganizationDocumentationSettings', { organizationId, automaticDocumentationEnabled, mode });
}

export async function loadMachineDocumentationCandidates(organizationId: string, machineId: string): Promise<DocumentationCandidate[]> {
  const db = getFirebaseClient().db;
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDocs(query(collection(db, `organizations/${organizationId}/documentCandidates`), where('machineId', '==', machineId)));
  return snapshot.docs.map((candidate) => {
    const data = candidate.data();
    return {
      id: candidate.id,
      title: typeof data.title === 'string' ? data.title : 'Untitled document',
      sourceDomain: typeof data.sourceDomain === 'string' ? data.sourceDomain : 'Unknown source',
      sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : '',
      state: typeof data.state === 'string' ? data.state : 'review',
      attachmentStatus: typeof data.attachmentStatus === 'string' ? data.attachmentStatus : null,
      verificationLevel: typeof data.verificationLevel === 'string' ? data.verificationLevel : null,
      aiRetrievalEnabled: data.aiRetrievalEnabled === true,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}
