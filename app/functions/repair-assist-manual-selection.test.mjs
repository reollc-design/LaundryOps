import assert from 'node:assert/strict';
import test from 'node:test';
import { findIndexedManualForModel } from './lib/index.js';

function manual(id, fields) {
  return { id, data: () => fields };
}

function manualDb(manuals, attachments) {
  const query = {
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    startAfter: () => query,
    get: async () => ({ docs: manuals, empty: false, size: manuals.length }),
  };
  return {
    collection: () => query,
    doc: (path) => ({
      get: async () => {
        const id = path.split('/').at(-1);
        const data = attachments[id];
        return { exists: Boolean(data), data: () => data };
      },
    }),
  };
}

test('Repair Assist skips an automatic manual attached to another machine and continues to an eligible same-model manual', async () => {
  const result = await findIndexedManualForModel({
    db: manualDb([
      manual('automatic-other-machine', {
        status: 'indexed', automaticDocumentation: true, aiRetrievalEnabled: true,
        machineModelKey: 'speed queen sc40', machineModelCompactKey: 'speedqueensc40', machineModel: 'Speed Queen SC40',
      }),
      manual('customer-uploaded-manual', {
        status: 'indexed', machineModelKey: 'speed queen sc40', machineModelCompactKey: 'speedqueensc40', machineModel: 'Speed Queen SC40',
      }),
    ], {
      'automatic-other-machine': { manualId: 'automatic-other-machine', machineId: 'machine-other', state: 'attached', aiRetrievalEnabled: true },
    }),
    organizationId: 'orgA',
    machineModel: 'Speed Queen SC40',
    machine: { id: 'machine-current', machineNumber: '40', type: 'washer', make: 'Speed Queen', modelNumber: 'SC40', model: 'Speed Queen SC40' },
  });
  assert.equal(result?.id, 'customer-uploaded-manual');
});

for (const [label, attachment] of [
  ['has no attachment record', undefined],
  ['has an attachment record for a different manual', { manualId: 'another-manual', machineId: 'machine-current', state: 'attached', aiRetrievalEnabled: true }],
  ['has an attachment with AI retrieval disabled', { manualId: 'automatic-other-machine', machineId: 'machine-current', state: 'attached', aiRetrievalEnabled: false }],
]) {
  test(`Repair Assist skips an automatic manual when it ${label}`, async () => {
    const result = await findIndexedManualForModel({
      db: manualDb([
        manual('automatic-other-machine', {
          status: 'indexed', automaticDocumentation: true, aiRetrievalEnabled: true,
          machineModelKey: 'speed queen sc40', machineModelCompactKey: 'speedqueensc40', machineModel: 'Speed Queen SC40',
        }),
        manual('customer-uploaded-manual', {
          status: 'indexed', machineModelKey: 'speed queen sc40', machineModelCompactKey: 'speedqueensc40', machineModel: 'Speed Queen SC40',
        }),
      ], attachment ? { 'automatic-other-machine': attachment } : {}),
      organizationId: 'orgA',
      machineModel: 'Speed Queen SC40',
      machine: { id: 'machine-current', machineNumber: '40', type: 'washer', make: 'Speed Queen', modelNumber: 'SC40', model: 'Speed Queen SC40' },
    });
    assert.equal(result?.id, 'customer-uploaded-manual');
  });
}
