import assert from 'node:assert/strict';
import {
  buildManualErrorCodeIndex,
  chunkManualText,
  errorCodeAliases,
  manualErrorCodeAliases,
  processManualPages,
} from './src/manual-indexing.ts';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test('normalizes E01, E-01, and E 01 to one indexed code with all aliases', () => {
  const entries = buildManualErrorCodeIndex([
    {
      chunkId: 'chunk-001',
      text: 'Error codes: E01 door lock fault. E-01 means the door did not lock. E 01 should be checked before service.',
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.normalizedCode, 'e01');
  assert.deepEqual(
    ['E01', 'E 01', 'E-01', 'E:01'].every((alias) => entries[0]?.aliases.includes(alias)),
    true,
  );
});

test('indexes letter-only manufacturer codes such as E DR when manual context supports them', () => {
  const entries = buildManualErrorCodeIndex([
    {
      chunkId: 'chunk-001',
      text: 'Error code E DR indicates a door release fault. Check the door lock assembly and wiring harness.',
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.normalizedCode, 'edr');
  assert.deepEqual(['EDR', 'E DR', 'E-DR', 'E:DR'].every((alias) => entries[0]?.aliases.includes(alias)), true);
});

test('builds equivalent query aliases for spaced, hyphenated, and compact input', () => {
  assert.deepEqual(['e-01', 'e01', 'e 01'].every((alias) => errorCodeAliases('E-01', '').includes(alias)), true);
  assert.deepEqual(['e 01', 'e01', 'e-01'].every((alias) => errorCodeAliases('E 01', '').includes(alias)), true);
  assert.deepEqual(['e01', 'e 01', 'e-01'].every((alias) => errorCodeAliases('E01', '').includes(alias)), true);
  assert.deepEqual(['E01', 'E 01', 'E-01', 'E:01'].every((alias) => manualErrorCodeAliases('E 01').includes(alias)), true);
});

test('does not index ordinary prose as an error code', () => {
  const entries = buildManualErrorCodeIndex([
    {
      chunkId: 'chunk-001',
      text: 'The door is closed. Check the code display and inspect the alarm before testing.',
    },
  ]);

  assert.deepEqual(entries, []);
});

test('returns no chunks for unreadable or empty extracted PDF text', () => {
  assert.deepEqual(chunkManualText(''), []);
  assert.deepEqual(chunkManualText('   \u0000\t  '), []);
});

test('processes every page beyond the first 100 and reports skipped manuals', async () => {
  const pages = [
    {
      items: Array.from({ length: 100 }, (_, index) => ({ id: `manual-${index + 1}`, uploaded: true })),
      nextCursor: 'manual-100',
    },
    {
      items: [
        { id: 'manual-101', uploaded: true },
        { id: 'manual-102', uploaded: false },
      ],
    },
  ];
  const seenCursors = [];

  const result = await processManualPages({
    fetchPage: async (cursor) => {
      seenCursors.push(cursor);
      return pages[seenCursors.length - 1] ?? { items: [] };
    },
    getItemId: (item) => item.id,
    shouldProcess: (item) => item.uploaded,
    process: async (item) => item.id,
    toErrorMessage: (error) => String(error),
  });

  assert.equal(result.fetchedCount, 102);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.processed.length, 101);
  assert.equal(result.processed.at(-1), 'manual-101');
  assert.deepEqual(seenCursors, [undefined, 'manual-100']);
});

test('continues after one manual fails and reports that manual by id', async () => {
  const result = await processManualPages({
    fetchPage: async () => ({ items: [{ id: 'good' }, { id: 'bad' }, { id: 'later' }] }),
    getItemId: (item) => item.id,
    shouldProcess: () => true,
    process: async (item) => {
      if (item.id === 'bad') {
        throw new Error('Unreadable PDF');
      }
      return item.id;
    },
    toErrorMessage: (error) => error instanceof Error ? error.message : 'Unknown error',
  });

  assert.deepEqual(result.processed, ['good', 'later']);
  assert.deepEqual(result.failures, [{ itemId: 'bad', message: 'Unreadable PDF' }]);
});

let failures = 0;
for (const currentTest of tests) {
  try {
    await currentTest.run();
    console.log(`PASS ${currentTest.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${currentTest.name}`);
    console.error(error);
  }
}

console.log(`${tests.length - failures}/${tests.length} manual indexing tests passed`);
process.exitCode = failures === 0 ? 0 : 1;
