import assert from 'node:assert/strict';
import {
  MANUAL_SELECTION_INVALID_CODE,
  MANUAL_SELECTION_MODEL_MISMATCH_ERROR,
  MANUAL_SELECTION_NOT_FOUND_ERROR,
  MANUAL_SELECTION_REQUIRED_CODE,
  MANUAL_SELECTION_REQUIRED_ERROR,
  selectSingleManualMatch,
  validateExplicitManualSelection,
} from './src/manual-selection.ts';
import { manualModelMatchesMachine } from './src/manual-indexing.ts';

const manual = (id) => ({ id });

assert.equal(selectSingleManualMatch([]), null);
assert.deepEqual(selectSingleManualMatch([manual('exact-1')]), manual('exact-1'));
assert.deepEqual(
  selectSingleManualMatch([manual('same-manual'), manual('same-manual')]),
  manual('same-manual'),
);

for (const matches of [
  [manual('exact-1'), manual('exact-2')],
  [manual('normalized-1'), manual('normalized-2')],
  [manual('compact-1'), manual('compact-2')],
  [manual('legacy-field-1'), manual('legacy-field-2')],
  [manual('page-1'), manual('page-2')],
]) {
  assert.throws(() => selectSingleManualMatch(matches), (error) => (
    error?.code === MANUAL_SELECTION_REQUIRED_CODE
    && error?.message === MANUAL_SELECTION_REQUIRED_ERROR
  ));
}

const explicitManual = manual('EdHy4QUsylAuPA8CoqXx');
const requestedMachine = {
  make: 'TestCo',
  modelNumber: 'TEST-ROLE-01',
  model: 'TestCo TEST-ROLE-01',
};
assert.deepEqual(selectSingleManualMatch([
  explicitManual,
  manual('c1suyjJgksBvJAZkvxLI'),
], explicitManual.id), explicitManual);
validateExplicitManualSelection({
  selectedManualId: explicitManual.id,
  selectedOrganizationId: 'org-test',
  requestedOrganizationId: 'org-test',
  indexed: true,
  matchesRequestedModel: manualModelMatchesMachine('TestCo TEST-ROLE-01', requestedMachine),
});

assert.throws(
  () => validateExplicitManualSelection({
    selectedManualId: explicitManual.id,
    selectedOrganizationId: 'org-other',
    requestedOrganizationId: 'org-test',
    indexed: true,
    matchesRequestedModel: true,
  }),
  (error) => error?.code === MANUAL_SELECTION_INVALID_CODE && error?.message === MANUAL_SELECTION_NOT_FOUND_ERROR,
);

assert.throws(
  () => validateExplicitManualSelection({
    selectedManualId: explicitManual.id,
    selectedOrganizationId: 'org-test',
    requestedOrganizationId: 'org-test',
    indexed: true,
    matchesRequestedModel: manualModelMatchesMachine('OtherCo OTHER-ROLE-99', requestedMachine),
  }),
  (error) => error?.code === MANUAL_SELECTION_INVALID_CODE && error?.message === MANUAL_SELECTION_MODEL_MISMATCH_ERROR,
);

assert.deepEqual(selectSingleManualMatch([manual('only-match')]), manual('only-match'));
assert.throws(
  () => selectSingleManualMatch([explicitManual], 'missing-manual'),
  (error) => error?.code === MANUAL_SELECTION_INVALID_CODE && error?.message === MANUAL_SELECTION_NOT_FOUND_ERROR,
);

assert.throws(
  () => validateExplicitManualSelection({
    selectedManualId: explicitManual.id,
    selectedOrganizationId: 'org-test',
    requestedOrganizationId: 'org-test',
    indexed: false,
    matchesRequestedModel: true,
  }),
  (error) => error?.code === MANUAL_SELECTION_INVALID_CODE
    && error?.message === 'The selected manual does not have a valid indexed version.',
);

console.log('Manual selection ambiguity tests passed.');
