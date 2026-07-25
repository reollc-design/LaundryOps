import type { Auth } from 'firebase/auth';
import { getFirebaseClient } from './client';

type DocumentationResponse = { ok?: boolean; error?: { message?: string }; jobId?: string; candidateId?: string; status?: string; state?: string };

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
