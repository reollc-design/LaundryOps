import assert from 'node:assert/strict';
import { MAX_MANUAL_UPLOAD_BYTES, isApprovedManualUpload } from './manualUploadPolicy.ts';

assert.equal(isApprovedManualUpload('manual.pdf', 'application/pdf', 1024), true);
assert.equal(isApprovedManualUpload('MANUAL.PDF', 'application/pdf', MAX_MANUAL_UPLOAD_BYTES), true);
assert.equal(isApprovedManualUpload('manual.pdf.exe', 'application/pdf', 1024), false);
assert.equal(isApprovedManualUpload('manual', 'application/pdf', 1024), false);
assert.equal(isApprovedManualUpload('manual.pdf', 'application/octet-stream', 1024), false);
assert.equal(isApprovedManualUpload('manual.pdf', 'application/pdf', MAX_MANUAL_UPLOAD_BYTES + 1), false);

console.log('Frontend manual upload policy tests passed.');
