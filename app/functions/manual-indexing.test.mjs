import assert from 'node:assert/strict';
import {
  buildManualErrorCodeIndex,
  chunkManualText,
  errorCodeAliases,
  manualErrorCodeAliases,
  manualModelMatchesMachine,
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

for (const symptoms of ['E DR', 'E-DR', 'EDR', 'e dr', 'e-dr', 'edr']) {
  test(`recognizes and normalizes bare "${symptoms}" entered in Symptoms`, () => {
    const expectedAliases = ['e dr', 'edr', 'e-dr', 'e:dr'];
    const aliases = errorCodeAliases(null, symptoms);
    assert.deepEqual(
      expectedAliases.every((alias) => aliases.includes(alias)),
      true,
      `Expected "${symptoms}" to produce aliases: ${expectedAliases.join(', ')}`,
    );
  });
}

test('does not misclassify ordinary symptom prose as a bare error code', () => {
  const symptomInputs = [
    'Door will not release after the cycle finishes',
    'Machine is displaying a warning and making a grinding noise',
    'Water remains in the drum when the washer stops',
    'fan loud',
    'easy',
    'FIRE',
    'FILL',
    'empty',
    'earth',
    'eject',
    'excess',
  ];

  for (const symptoms of symptomInputs) {
    assert.deepEqual(errorCodeAliases(null, symptoms), []);
  }
});

test('recognizes a code described as showing on the machine display', () => {
  const aliases = errorCodeAliases(null, 'Machine is displaying e dr');
  assert.deepEqual(['e dr', 'edr', 'e-dr', 'e:dr'].every((alias) => aliases.includes(alias)), true);
});

test('stops a labeled error code before the remaining symptom sentence', () => {
  const aliases = errorCodeAliases(null, 'error code E DR but door will not open');
  assert.deepEqual(['e dr', 'edr', 'e-dr', 'e:dr'].every((alias) => aliases.includes(alias)), true);
  assert.equal(aliases.some((alias) => alias.includes('door')), false);
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

test('matches manual model numbers despite case, spacing, dashes, make, or product-family wording', () => {
  const manualModel = 'SFNNCASG113TN01';
  const matchingMachines = [
    { modelNumber: 'SFNNCASG113TN01' },
    { modelNumber: 'sfnncasg113tn01' },
    { modelNumber: 'SFN-NCASG-113TN01' },
    { model: 'Speed Queen Horizon SFNNCASG113TN01' },
  ];

  assert.equal(
    matchingMachines.every((machine) => manualModelMatchesMachine(manualModel, machine)),
    true,
  );
});

test('matches a manufacturer-prefixed manual model to a bare machine model number', () => {
  assert.equal(
    manualModelMatchesMachine('ADC285', {
      make: 'ADC',
      modelNumber: '285',
      model: 'ADC 285',
    }),
    true,
  );
});

test('does not treat nearby model numbers as the same model', () => {
  const differentModels = [
    {
      make: 'Speed Queen',
      modelNumber: 'SFNNCASG113TN010',
      model: 'Speed Queen Horizon SFNNCASG113TN010',
    },
    {
      make: 'Speed Queen',
      modelNumber: 'SFNNCASG113TN01A',
      model: 'Speed Queen Horizon SFNNCASG113TN01A',
    },
    {
      make: 'Speed Queen',
      modelNumber: 'XSFNNCASG113TN01',
      model: 'Speed Queen Horizon XSFNNCASG113TN01',
    },
  ];

  assert.equal(
    differentModels.every((machine) => !manualModelMatchesMachine('SFNNCASG113TN01', machine)),
    true,
  );
});

test('does not ignore a conflicting manufacturer on a short numeric model', () => {
  const otherBrandMachine = {
      make: 'Other Brand',
      modelNumber: '285',
      model: 'Other Brand 285',
  };

  assert.equal(
    ['ADC285', 'ADC 285', '285'].every((manualModel) => !manualModelMatchesMachine(manualModel, otherBrandMachine)),
    true,
  );
});

test('requires and accepts the correct manufacturer for a short numeric model', () => {
  const adcMachine = {
    make: 'ADC',
    modelNumber: '285',
    model: 'ADC 285',
  };

  assert.equal(
    ['ADC285', 'ADC 285'].every((manualModel) => manualModelMatchesMachine(manualModel, adcMachine)),
    true,
  );
  assert.equal(
    manualModelMatchesMachine('285', adcMachine),
    false,
  );
});

test('uses an explicit model number instead of a stale combined-model field', () => {
  assert.equal(
    manualModelMatchesMachine('ABC123', {
      make: 'Example',
      modelNumber: 'ABC124',
      model: 'Example ABC123',
    }),
    false,
  );
});

test('counts all eight machines that share the same normalized model number', () => {
  const machines = Array.from({ length: 8 }, (_, index) => ({
    make: 'Speed Queen',
    modelNumber: index % 2 === 0 ? 'SFNNCASG113TN01' : 'SFN-NCASG-113TN01',
    model: `Speed Queen Horizon SFNNCASG113TN01 machine ${index + 1}`,
  }));

  assert.equal(
    machines.filter((machine) => manualModelMatchesMachine('SFNNCASG113TN01', machine)).length,
    8,
  );
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
