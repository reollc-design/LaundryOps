import assert from 'node:assert/strict';
import { decideCors } from './lib/cors-policy.js';

const staging = {
  LAUNDRYOPS_ALLOWED_CORS_ORIGINS: 'https://laundryops-staging.web.app,https://laundryops-staging.firebaseapp.com',
};

assert.deepEqual(decideCors(undefined, staging), { allowed: true, headers: {} });
assert.deepEqual(decideCors('https://laundryops-staging.web.app', staging), {
  allowed: true,
  headers: {
    'Access-Control-Allow-Origin': 'https://laundryops-staging.web.app',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  },
});
assert.deepEqual(decideCors('https://laundryops-staging.firebaseapp.com', staging).allowed, true);
assert.deepEqual(decideCors('https://laundryops-staging.web.app.evil.example', staging), {
  allowed: false,
  headers: {},
});
assert.throws(
  () => decideCors('https://laundryops-staging.web.app'),
  /LAUNDRYOPS_ALLOWED_CORS_ORIGINS/,
  'CORS must fail closed when the server configuration is missing',
);
assert.throws(
  () => decideCors(undefined),
  /LAUNDRYOPS_ALLOWED_CORS_ORIGINS/,
  'CORS must validate configuration even for non-browser requests',
);

console.log('CORS policy tests passed.');
