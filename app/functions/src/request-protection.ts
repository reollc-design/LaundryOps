export type OrganizationAccessMode = 'member' | 'ownerOrAdmin' | 'manualManager';

export type RequestRateLimitOperation =
  | 'repairAssist'
  | 'indexManual'
  | 'reindexManuals'
  | 'deleteManual'
  | 'stripeCheckout'
  | 'billingPortal';

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

export const REQUEST_RATE_LIMIT_POLICIES: Record<RequestRateLimitOperation, RateLimitPolicy> = {
  repairAssist: { limit: 10, windowSeconds: 60 },
  indexManual: { limit: 5, windowSeconds: 60 },
  reindexManuals: { limit: 2, windowSeconds: 300 },
  deleteManual: { limit: 10, windowSeconds: 60 },
  stripeCheckout: { limit: 5, windowSeconds: 300 },
  billingPortal: { limit: 10, windowSeconds: 60 },
};

export interface RateLimitRecord {
  windowStartedAtMs: number;
  count: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  record: RateLimitRecord;
  remaining: number;
  retryAfterSeconds?: number;
}

export interface OrganizationAccessState {
  organizationExists: boolean;
  ownerUserId?: string;
  membershipExists: boolean;
  membershipRole?: unknown;
  membershipStatus?: unknown;
}

export class RequestAuthenticationError extends Error {
  constructor(message = 'Missing auth token.') {
    super(message);
    this.name = 'RequestAuthenticationError';
  }
}

export class OrganizationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizationAccessError';
  }
}

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many requests. Please try again shortly.');
    this.name = 'RateLimitExceededError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function bearerTokenFromHeader(authHeader: unknown): string {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new RequestAuthenticationError();
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new RequestAuthenticationError();
  }
  return token;
}

export function assertOrganizationAccess(params: {
  uid: string;
  mode: OrganizationAccessMode;
  state: OrganizationAccessState;
}): void {
  const { state } = params;
  if (!state.organizationExists) {
    throw new OrganizationAccessError('Organization access not found.');
  }

  if (state.ownerUserId === params.uid) {
    return;
  }

  if (!state.membershipExists) {
    throw new OrganizationAccessError('Organization access not found.');
  }

  if (params.mode === 'member') {
    if (state.membershipStatus !== 'active') {
      throw new OrganizationAccessError('An active organization membership is required.');
    }
    return;
  }

  const roles = params.mode === 'manualManager'
    ? ['owner', 'admin', 'manager']
    : ['owner', 'admin'];
  if (!roles.includes(String(state.membershipRole)) || state.membershipStatus !== 'active') {
    throw new OrganizationAccessError(
      params.mode === 'manualManager'
        ? 'Owner, admin, or manager access is required.'
        : 'Owner or admin access is required.',
    );
  }
}

export function consumeRateLimit(
  previous: RateLimitRecord | null,
  nowMs: number,
  policy: RateLimitPolicy,
): RateLimitDecision {
  const windowMs = policy.windowSeconds * 1000;
  const hasValidWindow = previous !== null
    && Number.isFinite(previous.windowStartedAtMs)
    && Number.isInteger(previous.count)
    && previous.count >= 0
    && previous.windowStartedAtMs <= nowMs
    && nowMs - previous.windowStartedAtMs < windowMs;

  if (!hasValidWindow) {
    return {
      allowed: true,
      record: { windowStartedAtMs: nowMs, count: 1 },
      remaining: Math.max(0, policy.limit - 1),
    };
  }

  if (previous.count >= policy.limit) {
    return {
      allowed: false,
      record: previous,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((previous.windowStartedAtMs + windowMs - nowMs) / 1000)),
    };
  }

  const count = previous.count + 1;
  return {
    allowed: true,
    record: { ...previous, count },
    remaining: Math.max(0, policy.limit - count),
  };
}
