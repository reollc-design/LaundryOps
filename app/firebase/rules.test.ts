import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, Timestamp, writeBatch } from 'firebase/firestore';
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
    const trialStartedAt = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(trialStartedAt.toMillis() + 14 * 24 * 60 * 60 * 1000);

    await db.doc('users/ownerA').set({ displayName: 'Owner A' });
    await db.doc('users/developerOwner').set({ displayName: 'Developer Owner' });
    await db.doc('users/techA1').set({ displayName: 'Tech A1' });
    await db.doc('users/ownerB').set({ displayName: 'Owner B' });

    await db.doc('organizations/orgA').set({
      name: 'Sun State Laundry',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
      ownerUserId: 'ownerA',
      subscriptionStatus: 'trialing',
      trialStartedAt,
      trialEndsAt,
    });
    await db.doc('organizations/orgB').set({
      name: 'Other Laundry',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerB',
      ownerUserId: 'ownerB',
      subscriptionStatus: 'trialing',
    });
    await db.doc('organizations/orgExpired').set({
      name: 'Expired Laundry',
      createdBy: 'ownerA',
      ownerUserId: 'ownerA',
      subscriptionStatus: 'trialing',
      trialStartedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')),
      trialEndsAt: Timestamp.fromDate(new Date('2026-01-15T00:00:00.000Z')),
    });
    await db.doc('organizations/orgDeveloper').set({
      name: 'Developer Laundry',
      createdBy: 'developerOwner',
      ownerUserId: 'developerOwner',
      subscriptionStatus: 'trialing',
      trialStartedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')),
      trialEndsAt: Timestamp.fromDate(new Date('2026-01-15T00:00:00.000Z')),
      accessEntitlement: 'developer',
      accessEntitlementGrantedAt: Timestamp.fromDate(new Date('2026-07-21T00:00:00.000Z')),
      accessEntitlementGrantedBy: 'platform-admin',
    });

    await db.doc('organizations/orgA/memberships/ownerA').set({
      role: 'owner',
      status: 'active',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    await db.doc('organizations/orgA/memberships/adminA').set({
      role: 'admin',
      status: 'active',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    await db.doc('organizations/orgA/memberships/managerA1').set({
      role: 'manager',
      status: 'active',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    await db.doc('organizations/orgA/memberships/techA1').set({
      role: 'technician',
      status: 'active',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    await db.doc('organizations/orgA/memberships/viewerA').set({
      role: 'viewer',
      status: 'active',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    await db.doc('organizations/orgB/memberships/ownerB').set({
      role: 'owner',
      status: 'active',
      createdAt: '2026-05-18T00:00:00.000Z',
      createdBy: 'ownerB',
    });
    await db.doc('organizations/orgExpired/memberships/ownerA').set({
      role: 'owner',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    await db.doc('organizations/orgDeveloper/memberships/developerOwner').set({
      role: 'owner',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'developerOwner',
    });

    await db.doc('organizations/orgA/machines/washerA1').set({
      machineNumber: 'W12',
      type: 'Washer',
      make: 'Speed Queen',
      modelNumber: 'SC40',
      model: 'Speed Queen SC40',
      status: 'running',
      statusLabel: 'Operational',
    });
    await db.doc('organizations/orgA/machines/washerA2').set({
      machineNumber: 'D07',
      type: 'Dryer',
      make: 'Huebsch',
      modelNumber: 'HX12',
      model: 'Huebsch HX12',
      status: 'down',
      statusLabel: 'Down',
    });
    await db.doc('organizations/orgB/machines/washerB1').set({
      machineNumber: 'W01',
      type: 'Washer',
      make: 'Speed Queen',
      modelNumber: 'SQ11',
      model: 'Speed Queen SQ11',
      status: 'running',
      statusLabel: 'Operational',
    });

    await db.doc('organizations/orgA/workOrders/workA1').set({
      number: 'WO-1001',
      title: 'Door lock fault',
      machineId: 'washerA1',
      machineNumber: 'W12',
      machineModel: 'Speed Queen SC40',
      assignedUserId: 'techA1',
      status: 'open',
      statusLabel: 'Open',
    });
    await db.doc('organizations/orgA/workOrders/workA2').set({
      number: 'WO-1002',
      title: 'Drain fault',
      machineId: 'washerA2',
      machineNumber: 'D07',
      machineModel: 'Huebsch HX12',
      assignedUserId: 'techA1',
      status: 'open',
      statusLabel: 'Open',
    });

    await db.doc('organizations/orgA/manuals/manualA1').set({
      title: 'Washer Manual',
      manufacturer: 'Sample',
      createdBy: 'ownerA',
      status: 'processing',
    });
    await db.doc('organizations/orgA/manuals/manualA1/chunks/chunkA1').set({
      section: 'Door lock',
      text: 'Check latch continuity.',
    });
    await db.doc('organizations/orgA/manuals/manualA1/chunks_vm6g7xk_ab12cd/chunkA1').set({
      section: 'Door lock',
      text: 'Check latch continuity in versioned chunks.',
    });

    await db.doc('organizations/orgA/aiDiagnoses/diagnosisA1').set({
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
    await assertFails(ownerA.doc('organizations/orgA').update({
      billingProvider: 'stripe',
      lastStripeBillingEventType: 'customer.subscription.updated',
      lastStripeBillingEventId: 'evt_client_tamper',
      lastStripeBillingEventCreated: 9_999_999_999,
    }));
    await assertFails(ownerA.doc('organizations/orgA').update({
      accessEntitlement: 'developer',
      accessEntitlementGrantedAt: Timestamp.now(),
      accessEntitlementGrantedBy: 'ownerA',
    }));
    await assertFails(ownerA.doc('organizations/orgA/subscriptions/current').update({ status: 'active' }));
    await assertFails(ownerA.doc('organizations/orgA/auditLogs/logA2').set({ action: 'manual.clientWrite' }));
  });

  it('allows managers and technicians to manage operations without locations', async () => {
    const managerA1 = dbFor('managerA1');
    const techA1 = dbFor('techA1');

    await assertSucceeds(managerA1.doc('organizations/orgA/machines/washerA1').get());
    await assertSucceeds(managerA1.doc('organizations/orgA/machines/washerA2').get());
    await assertSucceeds(
      managerA1.doc('organizations/orgA/machines/washerNew').set({
        machineNumber: 'W19',
        type: 'Washer',
        make: 'Speed Queen',
        modelNumber: 'SQ19',
        model: 'Speed Queen SQ19',
        status: 'running',
        statusLabel: 'Operational',
      }),
    );

    await assertSucceeds(techA1.doc('organizations/orgA/machines/washerA2').get());
    await assertSucceeds(
      techA1.doc('organizations/orgA/machines/washerA1').update({
        status: 'down',
        statusLabel: 'Down',
        updatedAt: '2026-05-20T00:00:00.000Z',
        updatedBy: 'techA1',
      }),
    );

    await assertSucceeds(techA1.doc('organizations/orgA/workOrders/workA1').get());
    await assertSucceeds(techA1.doc('organizations/orgA/workOrders/workA2').get());
    await assertSucceeds(
      techA1.doc('organizations/orgA/workOrders/workA1').update({
        status: 'in-progress',
        statusLabel: 'In Progress',
        updatedAt: '2026-05-20T00:00:00.000Z',
        updatedBy: 'techA1',
      }),
    );
  });

  it('keeps manual chunks and AI diagnoses backend-only for writes', async () => {
    const ownerA = dbFor('ownerA');
    const techA1 = dbFor('techA1');

    await assertSucceeds(techA1.doc('organizations/orgA/manuals/manualA1/chunks/chunkA1').get());
    await assertSucceeds(techA1.doc('organizations/orgA/manuals/manualA1/chunks_vm6g7xk_ab12cd/chunkA1').get());
    await assertFails(ownerA.doc('organizations/orgA/manuals/manualA1/chunks/chunkA2').set({ text: 'client write' }));
    await assertFails(ownerA.doc('organizations/orgA/manuals/manualA1/chunks_vm6g7xk_ab12cd/chunkA2').set({ text: 'client write' }));
    await assertFails(ownerA.doc('organizations/orgA/aiDiagnoses/diagnosisA2').set({ workOrderId: 'workA1' }));
  });

  it('limits maintenance records to three photo attachments', async () => {
    const ownerA = dbFor('ownerA');
    const attachment = (index: number) => ({
      storagePath: `orgs/orgA/workOrders/workPhoto/attachments/photo-${index}.jpg`,
      fileName: `photo-${index}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      source: 'maintenance-record',
    });

    await assertSucceeds(
      ownerA.doc('organizations/orgA/workOrders/workPhoto').set({
        number: 'WO-PHOTO',
        title: 'Photo limit test',
        photoAttachments: [attachment(1), attachment(2), attachment(3)],
      }),
    );
    await assertFails(
      ownerA.doc('organizations/orgA/workOrders/workPhoto').update({
        photoAttachments: [attachment(1), attachment(2), attachment(3), attachment(4)],
      }),
    );
    await assertFails(
      ownerA.doc('organizations/orgA/workOrders/workPhotoTooMany').set({
        number: 'WO-PHOTO-4',
        title: 'Too many photos',
        photoAttachments: [attachment(1), attachment(2), attachment(3), attachment(4)],
      }),
    );
  });

  it('allows manual metadata edits but blocks direct manual deletes', async () => {
    const ownerA = dbFor('ownerA');

    await assertSucceeds(ownerA.doc('organizations/orgA/manuals/manualA1').update({ title: 'Updated Washer Manual' }));
    await assertFails(ownerA.doc('organizations/orgA/manuals/manualA1').delete());
  });

  it('allows controlled owner bootstrap org creation and self-membership only', async () => {
    const ownerA = dbFor('ownerA');
    const trialStartedAt = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(trialStartedAt.toMillis() + 14 * 24 * 60 * 60 * 1000);

    await assertSucceeds(
      ownerA.doc('organizations/orgBootstrap').set({
        name: 'Bootstrap Laundry',
        operatorName: 'Owner A',
        businessAddress: '123 Main Street',
        ownerEmail: 'owner@example.com',
        ownerUserId: 'ownerA',
        createdBy: 'ownerA',
        createdAt: '2026-05-20T00:00:00.000Z',
        subscriptionStatus: 'trialing',
        trialStartedAt,
        trialEndsAt,
        onboardingStatus: 'completed',
      }),
    );

    await assertSucceeds(
      ownerA.doc('organizations/orgBootstrap/memberships/ownerA').set({
        role: 'owner',
        status: 'active',
        createdAt: '2026-05-20T00:00:00.000Z',
        createdBy: 'ownerA',
      }),
    );

    await assertFails(
      ownerA.doc('organizations/orgBootstrap/memberships/ownerB').set({
        role: 'owner',
        status: 'active',
        createdBy: 'ownerA',
      }),
    );
  });

  it('allows atomic onboarding to create the organization, membership, location, and first machine', async () => {
    const ownerA = dbFor('ownerA');
    const organizationRef = doc(ownerA, 'organizations/orgAtomic');
    const membershipRef = doc(ownerA, 'organizations/orgAtomic/memberships/ownerA');
    const locationRef = doc(ownerA, 'organizations/orgAtomic/locations/locationA');
    const machineRef = doc(ownerA, 'organizations/orgAtomic/machines/machineA');
    const batch = writeBatch(ownerA);
    const trialStartedAt = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(trialStartedAt.toMillis() + 14 * 24 * 60 * 60 * 1000);

    batch.set(organizationRef, {
      name: 'Atomic Laundry',
      operatorName: 'Owner A',
      businessAddress: '123 Main Street',
      ownerEmail: 'owner@example.com',
      ownerUserId: 'ownerA',
      createdBy: 'ownerA',
      createdAt: '2026-05-20T00:00:00.000Z',
      subscriptionStatus: 'trialing',
      trialStartedAt,
      trialEndsAt,
      onboardingStatus: 'completed',
    });
    batch.set(membershipRef, {
      role: 'owner',
      status: 'active',
      createdAt: '2026-05-20T00:00:00.000Z',
      createdBy: 'ownerA',
    });
    batch.set(locationRef, {
      name: 'Main Store',
      address: '123 Main Street',
      status: 'active',
      createdAt: '2026-05-20T00:00:00.000Z',
      createdBy: 'ownerA',
      updatedAt: '2026-05-20T00:00:00.000Z',
      updatedBy: 'ownerA',
    });
    batch.set(machineRef, {
      machineNumber: 'W01',
      type: 'Washer',
      make: 'Speed Queen',
      modelNumber: 'SC40',
      model: 'Speed Queen SC40',
      locationId: locationRef.id,
      locationName: 'Main Store',
      status: 'running',
      statusLabel: 'Operational',
      createdAt: '2026-05-20T00:00:00.000Z',
      createdBy: 'ownerA',
      updatedAt: '2026-05-20T00:00:00.000Z',
      updatedBy: 'ownerA',
    });

    await assertSucceeds(batch.commit());
    await assertSucceeds(ownerA.doc('organizations/orgAtomic').get());
    await assertSucceeds(ownerA.doc('organizations/orgAtomic/memberships/ownerA').get());
    await assertSucceeds(ownerA.doc('organizations/orgAtomic/locations/locationA').get());
    await assertSucceeds(ownerA.doc('organizations/orgAtomic/machines/machineA').get());
  });

  it('requires the exact 14-day trial window and keeps trial fields immutable', async () => {
    const ownerA = dbFor('ownerA');
    const trialStartedAt = Timestamp.now();
    const correctTrialEndsAt = Timestamp.fromMillis(trialStartedAt.toMillis() + 14 * 24 * 60 * 60 * 1000);
    const incorrectTrialEndsAt = Timestamp.fromMillis(correctTrialEndsAt.toMillis() + 1);

    await assertFails(
      ownerA.doc('organizations/orgWrongTrial').set({
        name: 'Wrong Trial Laundry',
        ownerUserId: 'ownerA',
        createdBy: 'ownerA',
        createdAt: trialStartedAt,
        subscriptionStatus: 'trialing',
        trialStartedAt,
        trialEndsAt: incorrectTrialEndsAt,
        onboardingStatus: 'completed',
      }),
    );
    await assertFails(ownerA.doc('organizations/orgA').update({ trialEndsAt: correctTrialEndsAt }));
  });

  it('blocks operational writes after the trial end while keeping organization reads available', async () => {
    const ownerA = dbFor('ownerA');

    await assertSucceeds(ownerA.doc('organizations/orgExpired').get());
    await assertFails(
      ownerA.doc('organizations/orgExpired/machines/expiredMachine').set({
        machineNumber: 'E01',
        type: 'Washer',
        make: 'Speed Queen',
        modelNumber: 'Expired',
        model: 'Speed Queen Expired',
        status: 'running',
        statusLabel: 'Operational',
      }),
    );
    await assertFails(ownerA.doc('organizations/orgExpired/manuals/manualExpired').set({ title: 'Expired manual' }));
  });

  it('keeps a developer workspace active after its original trial and protects the entitlement', async () => {
    const developerOwner = dbFor('developerOwner');

    await assertSucceeds(
      developerOwner.doc('organizations/orgDeveloper/machines/developerMachine').set({
        machineNumber: 'DEV-01',
        type: 'Washer',
        make: 'Speed Queen',
        modelNumber: 'Developer',
        model: 'Speed Queen Developer',
        status: 'running',
        statusLabel: 'Operational',
      }),
    );
    await assertSucceeds(
      developerOwner.doc('organizations/orgDeveloper/workOrders/developerRecord').set({
        number: 'MR-DEV-01',
        title: 'Developer maintenance record',
        status: 'planned',
        statusLabel: 'Planned',
      }),
    );
    await assertFails(
      developerOwner.doc('organizations/orgDeveloper').update({ accessEntitlement: 'developer-plus' }),
    );
    await assertFails(
      developerOwner.doc('organizations/orgDeveloper').update({ accessEntitlementGrantedBy: 'developerOwner' }),
    );
  });

  it('does not allow a client to grant developer access during organization creation', async () => {
    const ownerA = dbFor('ownerA');
    const trialStartedAt = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(trialStartedAt.toMillis() + 14 * 24 * 60 * 60 * 1000);

    await assertFails(
      ownerA.doc('organizations/orgSelfGrantedDeveloper').set({
        name: 'Unauthorized Developer Laundry',
        ownerUserId: 'ownerA',
        createdBy: 'ownerA',
        createdAt: trialStartedAt,
        subscriptionStatus: 'trialing',
        trialStartedAt,
        trialEndsAt,
        onboardingStatus: 'completed',
        accessEntitlement: 'developer',
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
  it('enforces the canonical manual path and upload roles', async () => {
    const signedOutStorage = testEnv.unauthenticatedContext().storage(BUCKET_URL);
    const ownerStorage = storageFor('ownerA');
    const adminStorage = storageFor('adminA');
    const managerStorage = storageFor('managerA1');
    const ownerBStorage = storageFor('ownerB');
    const techStorage = storageFor('techA1');
    const viewerStorage = storageFor('viewerA');
    const pdf = new Blob(['manual'], { type: 'application/pdf' });
    const image = new Blob(['photo'], { type: 'image/png' });

    await assertSucceeds(ownerStorage.ref('orgs/orgA/manuals/ownerA/manualA1/manual.pdf').put(pdf));
    await assertSucceeds(adminStorage.ref('orgs/orgA/manuals/adminA/manualA2/manual.pdf').put(pdf));
    await assertSucceeds(managerStorage.ref('orgs/orgA/manuals/managerA1/manualA3/manual.pdf').put(pdf));

    await assertFails(ownerStorage.ref('orgs/orgA/manuals/manualA1/manual.pdf').put(pdf));
    await assertFails(ownerStorage.ref('orgs/orgA/manuals/ownerA/manualA1/manual.png').put(image));
    await assertFails(ownerStorage.ref('orgs/orgA/manuals/techA1/manualA1/manual.pdf').put(pdf));
    await assertFails(techStorage.ref('orgs/orgA/manuals/techA1/manualA1/manual.pdf').put(pdf));
    await assertFails(viewerStorage.ref('orgs/orgA/manuals/viewerA/manualA1/manual.pdf').put(pdf));
    await assertFails(ownerBStorage.ref('orgs/orgA/manuals/ownerB/manualA1/manual.pdf').put(pdf));
    await assertFails(signedOutStorage.ref('orgs/orgA/manuals/signedOut/manualA1/manual.pdf').put(pdf));
  });

  it('allows company members to read manuals but keeps client deletion backend-only', async () => {
    const signedOutStorage = testEnv.unauthenticatedContext().storage(BUCKET_URL);
    const ownerStorage = storageFor('ownerA');
    const techStorage = storageFor('techA1');
    const ownerBStorage = storageFor('ownerB');
    const manualPath = 'orgs/orgA/manuals/ownerA/manualA1/manual.pdf';
    const pdf = new Blob(['manual'], { type: 'application/pdf' });

    await assertSucceeds(ownerStorage.ref(manualPath).put(pdf));
    await assertSucceeds(techStorage.ref(manualPath).getDownloadURL());
    await assertFails(ownerBStorage.ref(manualPath).getDownloadURL());
    await assertFails(signedOutStorage.ref(manualPath).getDownloadURL());
    await assertFails(ownerStorage.ref(manualPath).delete());
  });

  it('rejects manual uploads at the 25 MB limit', async () => {
    const ownerStorage = storageFor('ownerA');
    const oversizedPdf = new Blob([new Uint8Array(25 * 1024 * 1024)], { type: 'application/pdf' });

    await assertFails(ownerStorage.ref('orgs/orgA/manuals/ownerA/manualA1/oversized.pdf').put(oversizedPdf));
  });

  it('allows operational machine photos and operations-lead work order attachments', async () => {
    const ownerStorage = storageFor('ownerA');
    const managerStorage = storageFor('managerA1');
    const techStorage = storageFor('techA1');
    const ownerBStorage = storageFor('ownerB');
    const image = new Blob(['photo'], { type: 'image/png' });
    const svg = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
    const oversizedImage = new Blob([new Uint8Array((5 * 1024 * 1024) + 1)], { type: 'image/jpeg' });

    await assertSucceeds(techStorage.ref('orgs/orgA/machines/washerA1/photos/photo.png').put(image));
    await assertSucceeds(ownerStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.png').put(image));
    await assertSucceeds(managerStorage.ref('orgs/orgA/workOrders/workA1/attachments/manager-photo.png').put(image));
    await assertFails(techStorage.ref('orgs/orgA/workOrders/workA1/attachments/tech-photo.png').put(image));
    await assertFails(techStorage.ref('orgs/orgA/workOrders/missingWork/attachments/photo.png').put(image));
    await assertFails(ownerStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.svg').put(svg));
    await assertFails(ownerStorage.ref('orgs/orgA/workOrders/workA1/attachments/oversized.jpg').put(oversizedImage));
    await assertFails(ownerBStorage.ref('orgs/orgA/machines/washerA1/photos/photo.png').put(image));
    await assertFails(ownerBStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.png').put(image));

    await assertFails(techStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.png').delete());
    await assertFails(ownerBStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.png').delete());
    await assertSucceeds(ownerStorage.ref('orgs/orgA/workOrders/workA1/attachments/photo.png').delete());
    await assertSucceeds(managerStorage.ref('orgs/orgA/workOrders/workA1/attachments/manager-photo.png').delete());
  });

  it('blocks client writes to exports and backups', async () => {
    const ownerStorage = storageFor('ownerA');
    const pdf = new Blob(['export'], { type: 'application/pdf' });

    await assertFails(ownerStorage.ref('orgs/orgA/exports/exportA1/report.pdf').put(pdf));
    await assertFails(ownerStorage.ref('orgs/orgA/backups/backupA1/backup.pdf').put(pdf));
  });

  it('blocks operational uploads after the organization trial ends', async () => {
    const ownerStorage = storageFor('ownerA');
    const pdf = new Blob(['manual'], { type: 'application/pdf' });

    await assertFails(ownerStorage.ref('orgs/orgExpired/manuals/ownerA/manualExpired/manual.pdf').put(pdf));
  });

  it('allows manual uploads for a developer workspace after its original trial', async () => {
    const developerStorage = storageFor('developerOwner');
    const pdf = new Blob(['manual'], { type: 'application/pdf' });

    await assertSucceeds(
      developerStorage.ref('orgs/orgDeveloper/manuals/developerOwner/manualDeveloper/manual.pdf').put(pdf),
    );
  });
});

describe('rule test harness', () => {
  it('uses the expected demo project only', () => {
    expect(testEnv.projectId).toBe(PROJECT_ID);
  });
});
