import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const scopes = require('../node_modules/firebase-tools/lib/scopes.js');

const PROJECT_ID = 'laundromat-maintenance-app';
const DATABASE_ID = '(default)';
const ADMIN_EMAIL = 'laundrytracker2024@gmail.com';
const TARGET_ORGANIZATION_ID = 'X3UZ6Qjyzi12dfAGgB7o';

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const shouldDryRun = args.has('--dry-run');

function usage() {
  console.log('Usage: node scripts/link-admin-user.mjs --dry-run');
  console.log('       node scripts/link-admin-user.mjs --write');
}

if (!shouldDryRun && !shouldWrite) {
  usage();
  process.exit(1);
}

if (shouldDryRun && shouldWrite) {
  console.error('Choose only one mode: --dry-run or --write.');
  process.exit(1);
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)]),
  );
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
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

async function requestJson(url, token, options = {}) {
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
    throw new Error(`${options.method ?? 'GET'} ${url} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function lookupAuthUser(token) {
  const body = await requestJson('https://identitytoolkit.googleapis.com/v1/accounts:lookup', token, {
    method: 'POST',
    body: JSON.stringify({
      email: [ADMIN_EMAIL],
      targetProjectId: PROJECT_ID,
    }),
  });
  const user = body.users?.[0];
  if (!user?.localId) {
    throw new Error(`No Firebase Auth user found for ${ADMIN_EMAIL}.`);
  }
  return user;
}

async function getFirestoreDoc(token, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (response.status === 404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function patchFirestoreDoc(token, path, fields) {
  const fieldNames = Object.keys(fields);
  const mask = fieldNames.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}?${mask}`;
  return requestJson(url, token, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });
}

const token = await getToken();
const authUser = await lookupAuthUser(token);
const uid = authUser.localId;
const userPath = `users/${uid}`;
const membershipPath = `organizations/${TARGET_ORGANIZATION_ID}/memberships/${uid}`;
const existingUser = await getFirestoreDoc(token, userPath);
const existingMembership = await getFirestoreDoc(token, membershipPath);

console.log(`Admin email: ${ADMIN_EMAIL}`);
console.log(`Auth UID: ${uid}`);
console.log(`Target organization: ${TARGET_ORGANIZATION_ID}`);
console.log(`User profile exists: ${existingUser ? 'yes' : 'no'}`);
if (existingUser) {
  const data = decodeFields(existingUser.fields ?? {});
  console.log(`Existing defaultOrganizationId: ${data.defaultOrganizationId ?? '(none)'}`);
}
console.log(`Membership exists: ${existingMembership ? 'yes' : 'no'}`);

if (!shouldWrite) {
  console.log('');
  console.log('Dry run only. No Firestore documents were written.');
  process.exit(0);
}

const now = new Date().toISOString();
await patchFirestoreDoc(token, userPath, {
  displayName: 'LaundryOps Admin',
  email: ADMIN_EMAIL,
  createdFrom: existingUser ? 'admin-link-updated' : 'admin-link',
  defaultOrganizationId: TARGET_ORGANIZATION_ID,
  updatedAt: now,
  updatedBy: 'admin-link-helper',
});

await patchFirestoreDoc(token, membershipPath, {
  role: 'admin',
  status: 'active',
  createdBy: 'manual-admin-link',
  updatedAt: now,
  updatedBy: 'admin-link-helper',
});

const verifiedUser = await getFirestoreDoc(token, userPath);
const verifiedMembership = await getFirestoreDoc(token, membershipPath);
const verifiedUserData = decodeFields(verifiedUser?.fields ?? {});
const verifiedMembershipData = decodeFields(verifiedMembership?.fields ?? {});

console.log('');
console.log(`Verified defaultOrganizationId: ${verifiedUserData.defaultOrganizationId ?? '(none)'}`);
console.log(`Verified membership status: ${verifiedMembershipData.status ?? '(none)'}`);
console.log(`Verified membership role: ${verifiedMembershipData.role ?? '(none)'}`);
