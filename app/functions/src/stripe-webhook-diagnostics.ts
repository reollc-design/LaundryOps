export const STRIPE_WEBHOOK_FAILURE_STAGES = [
  'initialize',
  'load_webhook_secret',
  'verify_signature',
  'initialize_firestore',
  'resolve_subscription',
  'persist_billing',
] as const;

export type StripeWebhookFailureStage = (typeof STRIPE_WEBHOOK_FAILURE_STAGES)[number];

export interface StripeWebhookFailureDetails {
  stage: StripeWebhookFailureStage;
  errorName: string;
}

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error) || typeof error.name !== 'string') {
    return 'UnknownError';
  }

  return /^(?:Error|[A-Za-z][A-Za-z0-9]{0,80}Error)$/.test(error.name)
    ? error.name
    : 'UnknownError';
}

export function stripeWebhookFailureDetails(
  stage: StripeWebhookFailureStage,
  error: unknown,
): StripeWebhookFailureDetails {
  return {
    stage,
    errorName: safeErrorName(error),
  };
}

export function logStripeWebhookFailure(
  stage: StripeWebhookFailureStage,
  error: unknown,
  writeLog: (event: string, details: StripeWebhookFailureDetails) => void,
): void {
  writeLog('stripe_webhook_failed', stripeWebhookFailureDetails(stage, error));
}
