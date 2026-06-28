import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const scopes = require('../node_modules/firebase-tools/lib/scopes.js');

const PROJECT_ID = 'laundromat-maintenance-app';
const DATABASE_ID = '(default)';
const SOURCE_COLLECTION = 'machines';
const TARGET_ORGANIZATION_ID = 'X3UZ6Qjyzi12dfAGgB7o';
const TARGET_COLLECTION = `organizations/${TARGET_ORGANIZATION_ID}/machines`;
const MIGRATION_ID = 'copy-legacy-machines-2026-06-13';

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const shouldDryRun = args.has('--dry-run');
const allowExisting = args.has('--allow-existing');

function usage() {
  console.log('Usage: node scripts/copy-legacy-machines.mjs --dry-run');
  console.log('       node scripts/copy-legacy-machines.mjs --write');
}

if (!shouldDryRun && !shouldWrite) {
  usage();
  process.exit(1);
}

if (shouldDryRun && shouldWrite) {
  console.error('Choose only one mode: --dry-run or --write.');
  process.exit(1);
}

function getDocumentId(name) {
  return name.split('/').pop();
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(decodeValue);
  }
  if ('mapValue' in value) {
    return decodeFields(value.mapValue.fields ?? {});
  }
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function encodeValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value) } };
  }
  return { stringValue: String(value) };
}

function encodeFields(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)]),
  );
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(rawStatus) {
  const normalized = normalizeString(rawStatus).toLowerCase();
  if (normalized === 'running' || normalized === 'operational' || normalized === 'op' || normalized === 'online') {
    return 'running';
  }
  if (
    normalized === 'needs-repair'
    || normalized.includes('repair')
    || normalized.includes('service')
    || normalized.includes('wait')
    || normalized.includes('part')
    || normalized.includes('leak')
  ) {
    return 'needs-repair';
  }
  if (
    normalized === 'down'
    || normalized.includes('out of service')
    || normalized.includes('offline')
    || normalized.includes('error')
    || normalized.includes('broken')
    || normalized.includes('fail')
  ) {
    return 'down';
  }
  return 'running';
}

function statusLabel(status) {
  if (status === 'down') return 'Down';
  if (status === 'needs-repair') return 'Needs Repair';
  return 'Operational';
}

function mapMachine(doc) {
  const source = decodeFields(doc.fields ?? {});
  const docId = getDocumentId(doc.name);
  const machineNumber = normalizeString(source.machineNumber) || normalizeString(source.number) || docId;
  const type = normalizeString(source.type) || normalizeString(source.classification) || normalizeString(source.category) || 'Machine';
  const make = normalizeString(source.make);
  const sourceModel = normalizeString(source.model);
  const modelNumber = normalizeString(source.modelNumber) || sourceModel;
  const model = sourceModel || [make, modelNumber].filter(Boolean).join(' ') || 'Machine details not set';
  const status = normalizeStatus(source.status);
  const now = new Date().toISOString();

  return {
    id: docId,
    machineNumber,
    type,
    make,
    modelNumber,
    model,
    status,
    statusLabel: statusLabel(status),
    legacySourceCollection: SOURCE_COLLECTION,
    legacyMachineDocId: docId,
    migratedAt: now,
    migrationId: MIGRATION_ID,
    createdAt: source.createdAt ?? now,
    createdBy: source.createdBy ?? 'legacy-machine-migration',
    updatedAt: now,
    updatedBy: 'legacy-machine-migration',
  };
}

async function getToken() {
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error('Firebase CLI is not logged in. Run npx.cmd firebase-tools login first.');
  }
  const token = await auth.getAccessToken(account.tokens.refresh_token, [scopes.CLOUD_PLATFORM]);
  if (!token?.access_token) {
    throw new Error('Could not get a Firebase CLI access token.');
  }
  return token.access_token;
}

async function firestoreRequest(token, path, options = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function listDocuments(token, collectionPath) {
  const documents = [];
  let pageToken = '';
  do {
    const separator = collectionPath.includes('?') ? '&' : '?';
    const path = `${collectionPath}${separator}pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const page = await firestoreRequest(token, path);
    documents.push(...(page.documents ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return documents;
}

async function writeMachines(token, machines) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:commit`;
  const writes = machines.map((machine) => ({
    update: {
      name: `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${TARGET_COLLECTION}/${machine.id}`,
      fields: encodeFields(machine),
    },
  }));
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Commit failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const token = await getToken();
const sourceDocs = await listDocuments(token, SOURCE_COLLECTION);
const destinationDocs = await listDocuments(token, TARGET_COLLECTION);
const machines = sourceDocs.map(mapMachine);

console.log(`Source collection: ${SOURCE_COLLECTION}`);
console.log(`Target collection: ${TARGET_COLLECTION}`);
console.log(`Source machines found: ${sourceDocs.length}`);
console.log(`Destination machines already present: ${destinationDocs.length}`);
console.log('');
console.log('Sample mapped machines:');
for (const machine of machines.slice(0, 8)) {
  console.log(`- ${machine.machineNumber}: ${machine.type} / ${machine.make} ${machine.modelNumber} / ${machine.statusLabel}`);
}

if (!shouldWrite) {
  console.log('');
  console.log('Dry run only. No Firestore documents were written.');
  process.exit(0);
}

if (destinationDocs.length > 0 && !allowExisting) {
  throw new Error(`Destination already has ${destinationDocs.length} machine documents. Re-run with --allow-existing only if you intentionally want to overwrite them.`);
}

if (machines.length === 0) {
  throw new Error('No source machines found. Nothing to copy.');
}

await writeMachines(token, machines);
const verifyDocs = await listDocuments(token, TARGET_COLLECTION);
console.log('');
console.log(`Copied machines: ${machines.length}`);
console.log(`Verified destination count after copy: ${verifyDocs.length}`);
