import { createHash } from 'node:crypto';

export const MAX_AUTOMATIC_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export interface DownloadedExternalDocument {
  bytes: Buffer;
  contentType: string | null;
  fileName: string;
  sourceUrl: string;
  sha256: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isApprovedUrl(value: string, approvedDomains: string[]): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return approvedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function cleanFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^\.+/, '').trim();
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned || 'manufacturer-manual'}.pdf`;
}

function filenameFromResponse(response: Response, url: string): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const quoted = /filename\*?=(?:UTF-8''|\")?([^;\"]+)/i.exec(disposition)?.[1];
  if (quoted) return cleanFileName(decodeURIComponent(quoted.trim()));
  const pathName = new URL(url).pathname.split('/').pop() ?? '';
  return cleanFileName(pathName || 'manufacturer-manual.pdf');
}

async function readResponseWithLimit(response: Response, limit: number): Promise<Buffer> {
  const headerLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(headerLength) && headerLength > limit) {
    throw new Error('The document exceeds the 25 MB safety limit.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The document download did not include a response body.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new Error('The document exceeds the 25 MB safety limit.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function downloadApprovedPdf(params: {
  sourceUrl: string;
  approvedDomains: string[];
  fetchImpl?: FetchLike;
}): Promise<DownloadedExternalDocument> {
  const approvedDomains = params.approvedDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
  let currentUrl = params.sourceUrl;
  const fetchImpl = params.fetchImpl ?? fetch;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isApprovedUrl(currentUrl, approvedDomains)) {
      throw new Error('The document URL is outside the approved source domains.');
    }
    const response = await fetchImpl(currentUrl, { method: 'GET', redirect: 'manual', headers: { Accept: 'application/pdf' } });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      if (!next) throw new Error('The document source returned an invalid redirect.');
      currentUrl = new URL(next, currentUrl).toString();
      continue;
    }
    if (!response.ok) throw new Error(`The document source returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type');
    const bytes = await readResponseWithLimit(response, MAX_AUTOMATIC_DOCUMENT_BYTES);
    if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('The approved source did not return a valid PDF file.');
    }
    return {
      bytes,
      contentType,
      fileName: filenameFromResponse(response, currentUrl),
      sourceUrl: new URL(currentUrl).toString(),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  throw new Error('The document source redirected too many times.');
}
