import assert from 'node:assert/strict';
import { isManualDeletionReserved } from './src/manual-indexing.ts';

assert.equal(isManualDeletionReserved(1_001, 1_000), true);
assert.equal(isManualDeletionReserved(1_000, 1_000), false);
assert.equal(isManualDeletionReserved(999, 1_000), false);
assert.equal(isManualDeletionReserved(null, 1_000), false);

console.log('4/4 manual deletion reservation tests passed');
