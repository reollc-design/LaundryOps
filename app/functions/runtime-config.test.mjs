import assert from 'node:assert/strict';
import {
  allowedCorsOrigins,
  billingPriceIdForPlan,
  requiredStripeTestSecret,
  requiredApplicationUrl,
} from './src/runtime-config.ts';

const staging = {
  LAUNDRYOPS_APP_URL: 'https://laundryops-staging.web.app',
  LAUNDRYOPS_ALLOWED_CORS_ORIGINS: 'https://laundryops-staging.web.app,https://laundryops-staging.firebaseapp.com',
  STRIPE_MONTHLY_PRICE_ID: 'price_test_monthly',
  STRIPE_ANNUAL_PRICE_ID: 'price_test_annual',
};

assert.deepEqual(allowedCorsOrigins(staging), [
  'https://laundryops-staging.web.app',
  'https://laundryops-staging.firebaseapp.com',
]);
assert.equal(requiredApplicationUrl(staging), 'https://laundryops-staging.web.app');
assert.equal(billingPriceIdForPlan('monthly', staging), 'price_test_monthly');
assert.equal(billingPriceIdForPlan('annual', staging), 'price_test_annual');
assert.equal(requiredStripeTestSecret('sk_test_syntheticvalue'), 'sk_test_syntheticvalue');
assert.throws(
  () => requiredStripeTestSecret('sk_live_synthetic_value'),
  /Stripe Test\/Sandbox secret/,
  'staging billing must reject live Stripe keys',
);
assert.throws(
  () => requiredStripeTestSecret(undefined),
  /Stripe Test\/Sandbox secret/,
  'staging billing must fail closed without a Stripe key',
);

assert.throws(
  () => allowedCorsOrigins({}),
  /LAUNDRYOPS_ALLOWED_CORS_ORIGINS/,
  'non-emulator Functions must fail closed without CORS configuration',
);
assert.throws(
  () => requiredApplicationUrl({}),
  /LAUNDRYOPS_APP_URL/,
  'billing URLs must fail closed without an app URL',
);
assert.throws(
  () => billingPriceIdForPlan('monthly', {}),
  /STRIPE_MONTHLY_PRICE_ID/,
  'monthly checkout must fail closed without its configured test price',
);
assert.throws(
  () => billingPriceIdForPlan('annual', {}),
  /STRIPE_ANNUAL_PRICE_ID/,
  'annual checkout must fail closed without its configured test price',
);

assert.deepEqual(allowedCorsOrigins({ FUNCTIONS_EMULATOR: 'true' }), [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

console.log('Runtime configuration tests passed.');
