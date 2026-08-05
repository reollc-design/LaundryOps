import { allowedCorsOrigins, type RuntimeEnvironment } from './runtime-config.js';

export interface CorsDecision {
  allowed: boolean;
  headers: Record<string, string>;
}

export function decideCors(origin: string | undefined, env?: RuntimeEnvironment): CorsDecision {
  const normalizedOrigin = origin?.trim() ?? '';
  const allowedOrigins = allowedCorsOrigins(env);
  if (!normalizedOrigin) {
    return { allowed: true, headers: {} };
  }

  if (!allowedOrigins.includes(normalizedOrigin)) {
    return { allowed: false, headers: {} };
  }

  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': normalizedOrigin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  };
}
