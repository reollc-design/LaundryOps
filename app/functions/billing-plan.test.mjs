import assert from 'node:assert/strict';
import { billingPlanFromRequest } from './src/billing-plan.ts';

assert.equal(billingPlanFromRequest('monthly'), 'monthly');
assert.equal(billingPlanFromRequest('annual'), 'annual');

for (const invalid of [undefined, null, '', ' ', 'Monthly', 'yearly', 12, {}, []]) {
  assert.throws(() => billingPlanFromRequest(invalid), { message: 'billingPlan is invalid.' });
}

console.log('Billing plan validation tests passed.');
