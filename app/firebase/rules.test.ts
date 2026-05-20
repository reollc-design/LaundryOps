import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'demo-laundryops-rules';
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`;

let testEnv: RulesTestEnvironment;

const readRules = (fileName: string) => readFileSync(resolve(process.cwd(), fileName), 'utf8');

const dbFor = (userId: string) => testEnv.authenticatedContext(userId).firestore();
const storageFor = (userId: string) => testEnv.authenticatedContext(userId).storage(BUCKET_URL);

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await db.doc('users/ownerA').set({ displayName: 'Owner A' });
    await db.doc('users/techA1').set({ displayName: 'Tech A1' });
    await db.doc('users/ownerB').set({ displayName: 'Owner B' });

    await db.doc('organizations/orgA').set({
      name: 'Sun State Laundry',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
      subscriptionStatus: 'trialing',
      trialStartedAt: '2026-05-18T00:00:00.000Z',
      trialEndsAt: '2026-06-01T00:00:00.000Z',
    });
    await db.doc('organizations/orgB').set({
      name: 'Other Laundry',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerB',
      subscriptionStatus: 'trialing',
    });

    await db.doc('organizations/orgA/memberships/ownerA').set({
      role: 'owner',
      status: 'active',
      allowedLocationIds: ['all'],
    });
    await db.doc('organizations/orgA/memberships/adminA').set({
      role: 'admin',
      status: 'active',
      allowedLocationIds: ['all'],
    });
    await db.doc('organizations/orgA/memberships/managerA1').set({
      role: 'manager',
      status: 'active',
      allowedLocationIds: ['locA1'],
    });
    await db.doc('organizations/orgA/memberships/techA1').set({
      role: 'technician',
      status: 'active',
      allowedLocationIds: ['locA1'],
    });
    await db.doc('organizations/orgA/memberships/viewerA').set({
      role: 'viewer',
      status: 'active',
      allowedLocationIds: ['locA1'],
    });
    await db.doc('organizations/orgB/memberships/ownerB').set({
      role: 'owner',
      status: 'active',
      allowedLocationIds: ['all'],
    });

    await db.doc('organizations/orgA/locations/locA1').set({ name: 'Main Street' });
    await db.doc('organizations/orgA/locations/locA2').set({ name: 'Beachside' });
    await db.doc('organizations/orgB/locations/locB1').set({ name: 'Other Main' });

    await db.doc('organizations/orgA/machines/washerA1').set({
      label: 'W12',
      locationId: 'locA1',
      status: 'healthy',
    });
    await db.doc('organizations/orgA/machines/washerA2').set({
      label: 'W18',
      locationId: 'locA2',
      status: 'down',
    });
    await db.doc('organizations/orgB/machines/washerB1').set({
      label: 'W01',
      locationId: 'locB1',
      status: 'healthy',
    });

    await db.doc('organizations/orgA/workOrders/workA1').set({
      title: 'Door lock fault',
      locationId: 'locA1',
      assignedUserId: 'techA1',
      status: 'open',
    });
    await db.doc('organizations/orgA/workOrders/workA2').set({
      title: 'Drain fault',
      locationId: 'locA2',
      assignedUserId: 'techA1',
      status: 'open',
    });

    await db.doc('organizations/orgA/manuals/manualA1').set({
      title: 'Washer Manual',
      manufacturer: 'Sample',
    });
    await db.doc('organizations/orgA/manuals/manualA1/chunks/chunkA1').set({
      section: 'Door lock',
      text: 'Check latch continuity.',
    });

    await db.doc('organizations/orgA/aiDiagnoses/diagnosisA1').set({
      locationId: 'locA1',
      workOrderId: 'workA1',
      groundingStatus: 'manual-grounded',
    });
    await db.doc('organizations/orgA/subscriptions/current').set({
      status: 'trialing',
      providerCustomerId: 'server-only',
    });
    await db.doc('organizations/orgA/auditLogs/logA1').set({
      action: 'organization.created',
      actorId: 'ownerA',
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readRules('firestore.rules'),
    },
    storage: {
      rules: readRules('storage.rules'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await seedBaseData();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore organization security', () => {
  it('blocks signed-out users from organization data', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(db.doc('organizations/orgA').get());
    await assertFails(db.doc('organizations/orgA/machines/washerA1').get());
  });

  it('prevents users from reading another company account', async () => {
    const ownerB = dbFor('ownerB');

    await assertFails(ownerB.doc('organizations/orgA').get());
    await assertFails(ownerB.doc('organizations/orgA/machines/washerA1').get());
    await assertSucceeds(ownerB.doc('organizations/orgB').get());
  });

  it('allows owners to read operations data and blocks protected direct writes', async () => {
    const ownerA = dbFor('ownerA');

    await assertSucceeds(ownerA.doc('organizations/orgA/machines/washerA1').get());
    await assertSucceeds(ownerA.doc('organizations/orgA').update({ name: 'Sun State Laundry Ops' }));
    await assertFails(ownerA.doc('organizations/orgA/subscriptions/current').update({ status: 'active' }));
    await assertFails(ownerA.doc('organizations/orgA/auditLogs/logA2').set({ action: 'manual.clientWrite' }));
  });

  it('limits managers and technicians to assigned locations', async () => {
    const managerA1 = dbFor('managerA1');
    const techA1 = dbFor('techA1');

    await assertSucceeds(managerA1.doc('organizations/orgA/machines/washerA1').get());
    await assertFails(managerA1.doc('organizations/orgA/machines/washerA2').get());
    await assertSucceeds(
      managerA1.doc('organizations/orgA/machines/washerNew').set({
        label: 'W19',
        locationId: 'locA1',
        status: 'healthy',
      }),
    );
    await assertFails(
      managerA1.doc('organizations/orgA/machines/washerBlocked').set({
        label: 'W20',
        locationId: 'locA2',
        status: 'healthy',
      }),
    );

    await assertSucceeds(techA1.doc('organizations/orgA/workOrders/workA1').get());
    await assertFails(techA1.doc('organizations/orgA/workOrders/workA2').get());
    await assertSucceeds(techA1.doc('organizations/orgA/workOrders/workA1').update({ status: 'in-progress' }));
    await assertFails(techA1.doc('organizations/orgA/workOrders/workA1').update({ locationId: 'locA2' }));
  });

  it('keeps manual chunks and AI diagnoses backend-only for writes', async () => {
    const ownerA = dbFor('ownerA');
    const techA1 = dbFor('techA1');

    await assertSucceeds(techA1.doc('organizations/orgA/manuals/manualA1/chunks/chunkA1').get());
    await assertFails(ownerA.doc('organizations/orgA/manuals/manualA1/chunks/chunkA2').set({ text: 'client write' }));
    await assertFails(ownerA.doc('organizations/orgA/aiDiagnoses/diagnosisA2').set({ locationId: 'locA1' }));
  });

  it('allows controlled owner bootstrap org creation and self-membership only', async () => {
    const ownerA = dbFor('ownerA');

    await assertSucceeds(
      ownerA.doc('organizations/orgBootstrap').set({
        name: 'Bootstrap Laundry',
        ownerUserId: 'ownerA',
        createdBy: 'ownerA',
        createdAt: '2026-05-20T00:00:00.000Z',
        subscriptionStatus: 'trialing',
        trialStartedAt: '2026-05-20T00:00:00.000Z',
        onboardingStatus: 'in-progress',
      }),
    );

    await assertSucceeds(
      ownerA.doc('organizations/orgBootstrap/memberships/ownerA').set({
        role: 'owner',
        status: 'active',
        allowedLocationIds: ['all'],
        createdAt: '2026-05-20T00:00:00.000Z',
        createdBy: 'ownerA',
      }),
    );

    await assertFails(
      ownerA.doc('organizations/orgBootstrap/memberships/ownerB').set({
        role: 'owner',
        status: 'active',
        allowedLocationIds: ['all'],
        createdBy: 'ownerA',
      }),
    );
  });

  it('blocks bootstrap org creation when owner identity does not match the signer', async () => {
    const ownerB = dbFor('ownerB');

    await assertFails(
      ownerB.doc('organizations/orgBlocked').set({
        name: 'Blocked Org',
        ownerUserId: 'ownerA',
        createdBy: 'ownerB',
        createdAt: '2026-05-20T00:00:00.000Z',
        subscriptionStatus: 'trialing',
        trialStartedAt: '2026-05-20T00:00:00.000Z',
        onboardingStatus: 'in-progress',
      }),
    );
  });
});

describe('Storage organization security', () => {
  it('allows manual PDFs only for leadership roles', async () => {
    const ownerStorage = storageFor('ownerA');
    const techStorage = storageFor('techA1');
    const pdf = new Blob(['manual'], { type: 'application/pdf' });
    const image = new Blob(['photo'], { type: 'image/png' });

    await assertSucceeds(ownerStorage.ref('orgs/orgA/manuals/manualA1/manual.pdf').put(pdf));
    await assertFails(ownerStorage.ref('orgs/orgA/manuals/manualA1/manual.png').put(image));
    await assertFails(techStorage.ref('orgs/orgA/manuals/manualA1/manual.pdf').put(pdf));
  });

  it('limits machine photos and work order files by location access', async () => {
    const techStorage = storageFor('techA1');
    const ownerBStorage = storageFor('ownerB');
    const image = new Blob(['photo'], { type: 'image/png' });

    await assertSucceeds(techStorage.ref('orgs/orgA/machines/washerA1/photos/photo.png').put(image));
    await assertFails(techStorage.ref('orgs/orgA/machines/washerA2/photos/photo.png').put(image));
    await assertFails(ownerBStorage.ref('orgs/orgA/machines/washerA1/photos/photo.png').put(image));
    await assertSucceeds(techStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.png').put(image));
    await assertFails(techStorage.ref('orgs/orgA/workOrders/workA2/attachments/photo.png').put(image));
  });

  it('blocks client writes to exports and backups', async () => {
    const ownerStorage = storageFor('ownerA');
    const pdf = new Blob(['export'], { type: 'application/pdf' });

    await assertFails(ownerStorage.ref('orgs/orgA/exports/exportA1/report.pdf').put(pdf));
    await assertFails(ownerStorage.ref('orgs/orgA/backups/backupA1/backup.pdf').put(pdf));
  });
});

describe('rule test harness', () => {
  it('uses the expected demo project only', () => {
    expect(testEnv.projectId).toBe(PROJECT_ID);
  });
});
