import assert from 'node:assert/strict';
import { downloadApprovedPdf, MAX_AUTOMATIC_DOCUMENT_BYTES } from './src/external-document-download.ts';

const pdf = Buffer.from('%PDF-1.4\nminimal test file');
function response(body = pdf, init = {}) { return new Response(body, init); }

const valid = await downloadApprovedPdf({
  sourceUrl: 'https://speedqueen.com/manual.pdf?tracking=1',
  approvedDomains: ['speedqueen.com'],
  fetchImpl: async () => response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="manual.pdf"' } }),
});
assert.equal(valid.fileName, 'manual.pdf');
assert.equal(valid.bytes.length, pdf.length);
assert.equal(valid.sha256.length, 64);

await assert.rejects(
  () => downloadApprovedPdf({ sourceUrl: 'https://untrusted.example/manual.pdf', approvedDomains: ['speedqueen.com'], fetchImpl: async () => response() }),
  /outside the approved source domains/,
);
await assert.rejects(
  () => downloadApprovedPdf({ sourceUrl: 'https://speedqueen.com/file', approvedDomains: ['speedqueen.com'], fetchImpl: async () => response('<html>not a pdf</html>', { status: 200 }) }),
  /valid PDF/,
);
await assert.rejects(
  () => downloadApprovedPdf({ sourceUrl: 'https://speedqueen.com/file', approvedDomains: ['speedqueen.com'], fetchImpl: async () => response(pdf, { status: 200, headers: { 'content-length': String(MAX_AUTOMATIC_DOCUMENT_BYTES + 1) } }) }),
  /25 MB safety limit/,
);
await assert.rejects(
  () => downloadApprovedPdf({ sourceUrl: 'https://speedqueen.com/file', approvedDomains: ['speedqueen.com'], fetchImpl: async () => response(null, { status: 302, headers: { location: 'https://evil.example/file.pdf' } }) }),
  /outside the approved source domains/,
);

console.log('external document download tests: 4 passed');
