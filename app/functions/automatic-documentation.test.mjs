import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionCandidate, classifyDocumentation, effectiveDocumentationSettings, isRepairDocumentationType,
  hasSerialDependentApplicability, isDocumentationJobReviewable, canStartDocumentationAttachment, canRecoverStaleAutomaticAttachment, isAutomaticManualAttachedToMachine, safeDocumentationUrl, verifyDocumentationCompatibility,
} from './src/automatic-documentation.ts';

test('documentation is disabled unless both global and organization flags are enabled', () => {
  assert.equal(effectiveDocumentationSettings({ globalEnabled: false, organization: { automaticDocumentationEnabled: true }, machineId: 'm1' }).reason, 'global_disabled');
  assert.equal(effectiveDocumentationSettings({ globalEnabled: true, organization: {}, machineId: 'm1' }).reason, 'organization_disabled');
});
test('machine exclusions override an enabled approval configuration', () => {
  assert.equal(effectiveDocumentationSettings({ globalEnabled: true, organization: { automaticDocumentationEnabled: true, disabledForMachineIds: ['m1'] }, machineId: 'm1' }).reason, 'machine_disabled');
});
test('classification does not call a generic service mention a service manual', () => {
  assert.equal(classifyDocumentation({ title: 'Customer service information' }).primary, 'unknown');
  assert.equal(classifyDocumentation({ title: 'Model ABC service manual and diagnostics' }).primary, 'diagnostic_guide');
});
test('exact model and serial dependency are distinguished from family matches', () => {
  assert.equal(verifyDocumentationCompatibility({ modelNumber: 'ABC-123', serialNumber: '12' }, { exactModels: ['ABC123'] }).level, 'exact');
  assert.equal(verifyDocumentationCompatibility({ modelNumber: 'ABC-123', serialNumber: '12' }, { exactModels: ['ABC123'], serialRangesMentioned: true }).level, 'serial_required');
  assert.equal(verifyDocumentationCompatibility({ modelNumber: 'ABC-123' }, { exactModels: ['ABC123'], serialRangesMentioned: true }).level, 'serial_required');
  assert.equal(verifyDocumentationCompatibility({ modelNumber: 'ABC-123', productFamily: 'Horizon' }, { modelFamilies: ['Horizon'] }).level, 'family');
  assert.equal(verifyDocumentationCompatibility({ modelNumber: 'SFNNCASG113TN01' }, { title: 'Speed Queen Horizon SFNNCASG113TN01 service manual' }).level, 'exact');
  assert.equal(verifyDocumentationCompatibility({ modelNumber: 'ABC123' }, { title: 'Model ABC1234 service manual' }).level, 'rejected');
});
test('serial applicability is detected across a full large manual', () => {
  assert.equal(hasSerialDependentApplicability(`${'x'.repeat(250_001)} S/N 1000 and later`), true);
  assert.equal(hasSerialDependentApplicability('Model ABC123 standard service procedure'), false);
});
test('candidate lifecycle does not permit attachment without approval', () => {
  assert.equal(canTransitionCandidate('review', 'attached'), false);
  assert.equal(canTransitionCandidate('approved', 'attached'), true);
});
test('a cancelled discovery job cannot be reviewed later', () => {
  assert.equal(isDocumentationJobReviewable('cancelled'), false);
  assert.equal(isDocumentationJobReviewable('candidates_pending_review'), true);
});
test('only allowed HTTPS document URLs are accepted', () => {
  assert.equal(safeDocumentationUrl('https://support.speedqueen.com/manual.pdf', ['speedqueen.com'])?.hostname, 'support.speedqueen.com');
  assert.equal(safeDocumentationUrl('http://speedqueen.com/manual.pdf', ['speedqueen.com']), null);
  assert.equal(safeDocumentationUrl('https://speedqueen.com.evil.example/manual.pdf', ['speedqueen.com']), null);
  assert.equal(safeDocumentationUrl('https://speedqueen.com/manual.pdf?token=secret#section', ['speedqueen.com'])?.toString(), 'https://speedqueen.com/manual.pdf');
});
test('only repair documentation classifications may be used for AI retrieval', () => {
  assert.equal(isRepairDocumentationType('service_manual'), true);
  assert.equal(isRepairDocumentationType('error_code_guide'), true);
  assert.equal(isRepairDocumentationType('sales_brochure'), false);
  assert.equal(isRepairDocumentationType('warranty'), false);
});
test('automatic manuals are eligible only for their approved machine attachment', () => {
  const manual = { id: 'manualA', automaticDocumentation: true, aiRetrievalEnabled: true };
  const attachment = { manualId: 'manualA', machineId: 'machineA', state: 'attached', aiRetrievalEnabled: true };
  assert.equal(isAutomaticManualAttachedToMachine({ manual, machineId: 'machineA', attachment }), true);
  assert.equal(isAutomaticManualAttachedToMachine({ manual, machineId: 'machineB', attachment }), false);
  assert.equal(isAutomaticManualAttachedToMachine({ manual, machineId: 'machineA', attachment: { ...attachment, state: 'review' } }), false);
  assert.equal(isAutomaticManualAttachedToMachine({ manual: { id: 'uploadedManual' }, machineId: 'machineB' }), true);
});
test('attachment reservations recover after expiry but never duplicate an existing completed manual', () => {
  const nowMs = 1_000;
  assert.equal(canStartDocumentationAttachment({ candidateState: 'approved', reservationToken: 'active', reservationExpiresAtMs: nowMs + 1, manualExists: false, nowMs }), false);
  assert.equal(canStartDocumentationAttachment({ candidateState: 'approved', reservationToken: 'expired', reservationExpiresAtMs: nowMs, manualExists: false, nowMs }), true);
  assert.equal(canStartDocumentationAttachment({ candidateState: 'approved', manualExists: true, attachmentStatus: 'attached', nowMs }), false);
  assert.equal(canStartDocumentationAttachment({ candidateState: 'approved', manualExists: true, attachmentStatus: 'failed', nowMs }), true);
});
test('only an idle incomplete automatic manual can be recovered after a stale reservation', () => {
  assert.equal(canRecoverStaleAutomaticAttachment({ manualExists: true, manualStatus: 'processing', indexingLeaseActive: false, ocrActive: false }), true);
  assert.equal(canRecoverStaleAutomaticAttachment({ manualExists: true, manualStatus: 'processing', indexingLeaseActive: true, ocrActive: false }), false);
  assert.equal(canRecoverStaleAutomaticAttachment({ manualExists: true, manualStatus: 'processing', indexingLeaseActive: false, ocrActive: true }), false);
  assert.equal(canRecoverStaleAutomaticAttachment({ manualExists: true, manualStatus: 'indexed', indexingLeaseActive: false, ocrActive: false }), true);
});
