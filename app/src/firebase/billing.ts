import type { Auth } from 'firebase/auth';
import { getFirebaseClient } from './client';

export interface BillingCheckoutInput {
  organizationId: string;
}

export interface BillingPortalInput {
  organizationId: string;
}

interface BillingEndpointResponse {
  ok?: boolean;
  checkoutUrl?: string;
  portalUrl?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

function requireBillingAuth(): Auth {
  const client = getFirebaseClient();
  if (!client.auth) {
    throw new Error('Firebase auth is not configured.');
  }
  return client.auth;
}

function getBillingApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_BILLING_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Billing API URL is not configured. Add VITE_BILLING_API_BASE_URL.');
  }
  return baseUrl.replace(/\/+$/, '');
}

async function callBillingEndpoint(path: string, payload: Record<string, unknown>): Promise<BillingEndpointResponse> {
  const auth = requireBillingAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in before using billing actions.');
  }

  const idToken = await user.getIdToken();
  const endpoint = `${getBillingApiBaseUrl()}/${path}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as BillingEndpointResponse;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error?.message ?? 'Billing request failed.');
  }

  return data;
}

export async function startStripeCheckout(input: BillingCheckoutInput): Promise<string> {
  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }

  const data = await callBillingEndpoint('createStripeCheckoutSession', { organizationId });
  if (!data.checkoutUrl) {
    throw new Error('Checkout URL was not returned.');
  }
  return data.checkoutUrl;
}

export async function openStripeBillingPortal(input: BillingPortalInput): Promise<string> {
  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    throw new Error('Missing organization ID.');
  }

  const data = await callBillingEndpoint('createStripeBillingPortalSession', { organizationId });
  if (!data.portalUrl) {
    throw new Error('Billing portal URL was not returned.');
  }
  return data.portalUrl;
}
