const ONBOARDING_DEBUG_TOKEN = 'route-trace-v1';
const ONBOARDING_TRACE_VERSION = 'onboarding-route-write-trace-v1';

let traceSequence = 0;
let traceSessionId: string | null = null;

type TraceDetails = Record<string, unknown>;

function isOnboardingDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('debugOnboarding') === ONBOARDING_DEBUG_TOKEN;
}

function writeTrace(prefix: '[onboarding-redirect]' | '[onboarding-write]', event: string, details: TraceDetails): void {
  if (!isOnboardingDebugEnabled()) {
    return;
  }

  traceSequence += 1;
  traceSessionId ??= typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `trace-${Date.now()}`;
  console.log(`${prefix} ${JSON.stringify({
    traceVersion: ONBOARDING_TRACE_VERSION,
    traceSessionId,
    sequence: traceSequence,
    timestamp: new Date().toISOString(),
    event,
    ...details,
  })}`);
}

export function logOnboardingRedirect(event: string, details: TraceDetails = {}): void {
  writeTrace('[onboarding-redirect]', event, details);
}

export function logOnboardingWrite(event: string, details: TraceDetails = {}): void {
  writeTrace('[onboarding-write]', event, details);
}
