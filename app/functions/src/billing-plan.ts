export type BillingPlanKey = 'monthly' | 'annual';

export function billingPlanFromRequest(value: unknown): BillingPlanKey {
  if (value === 'monthly' || value === 'annual') {
    return value;
  }
  throw new Error('billingPlan is invalid.');
}
