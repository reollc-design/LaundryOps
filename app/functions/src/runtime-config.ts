export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export const LOCAL_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function requiredEnvironmentValue(env: RuntimeEnvironment, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing server environment variable ${name}.`);
  }
  return value.trim();
}

export function allowedCorsOrigins(env: RuntimeEnvironment = process.env): string[] {
  const configured = env.LAUNDRYOPS_ALLOWED_CORS_ORIGINS ?? '';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => /^https:\/\/[a-z0-9.-]+$/i.test(origin));

  if (origins.length === 0 && env.FUNCTIONS_EMULATOR !== 'true') {
    throw new Error('Missing server environment variable LAUNDRYOPS_ALLOWED_CORS_ORIGINS.');
  }

  return env.FUNCTIONS_EMULATOR === 'true'
    ? Array.from(new Set([...origins, ...LOCAL_CORS_ORIGINS]))
    : origins;
}

export function requiredApplicationUrl(env: RuntimeEnvironment = process.env): string {
  return requiredEnvironmentValue(env, 'LAUNDRYOPS_APP_URL');
}

export function billingPriceIdForPlan(
  plan: 'monthly' | 'annual',
  env: RuntimeEnvironment = process.env,
): string {
  return requiredEnvironmentValue(
    env,
    plan === 'monthly' ? 'STRIPE_MONTHLY_PRICE_ID' : 'STRIPE_ANNUAL_PRICE_ID',
  );
}

export function requiredStripeTestSecret(secret: string | undefined): string {
  const normalized = secret?.trim() ?? '';
  if (!/^sk_test_[A-Za-z0-9]+$/.test(normalized)) {
    throw new Error('Stripe Test/Sandbox secret is required for staging billing.');
  }
  return normalized;
}
