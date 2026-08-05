import assert from 'node:assert/strict';
import { MULTIPLE_MANUALS_MATCH_ERROR, selectSingleManualMatch } from './src/manual-selection.ts';

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
  assert.throws(
    () => selectSingleManualMatch(matches),
    { message: MULTIPLE_MANUALS_MATCH_ERROR },
  );
}

console.log('Manual selection ambiguity tests passed.');
