import assert from 'node:assert/strict';
import { MAX_MANUAL_UPLOAD_BYTES, isApprovedManualUpload } from './src/manual-upload-policy.ts';

const valid = (overrides = {}) => ({
  fileName: 'washer-manual.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
  ...overrides,
});

assert.equal(isApprovedManualUpload(valid()), true);
assert.equal(isApprovedManualUpload(valid({ fileName: 'WASHER-MANUAL.PDF' })), true);
assert.equal(isApprovedManualUpload(valid({ fileName: 'washer-manual.Pdf' })), false);
assert.equal(isApprovedManualUpload(valid({ sizeBytes: MAX_MANUAL_UPLOAD_BYTES })), true);
assert.equal(isApprovedManualUpload(valid({ fileName: 'washer-manual.pdf.exe' })), false);
assert.equal(isApprovedManualUpload(valid({ fileName: 'washer-manual' })), false);
assert.equal(isApprovedManualUpload(valid({ contentType: 'application/octet-stream' })), false);
assert.equal(isApprovedManualUpload(valid({ sizeBytes: MAX_MANUAL_UPLOAD_BYTES + 1 })), false);

console.log('Manual upload policy tests passed.');
