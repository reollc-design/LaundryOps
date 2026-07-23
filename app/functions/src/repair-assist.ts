export const OPENAI_REPAIR_ASSIST_TIMEOUT_MS = 45_000;

export interface SafeExternalErrorDetails {
  errorName: string;
  errorCode?: string;
  httpStatus?: number;
  timeout: boolean;
}

export interface RepairAssistAnswerResult {
  answer: string;
  mode: 'openai' | 'manual-fallback';
  fallbackReason?: 'empty_response' | 'request_failed';
  error?: SafeExternalErrorDetails;
}

export interface RepairAssistChunk {
  chunkId: string;
  text: string;
}

function safeErrorCode(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const code = String(value).trim();
  return /^[a-z0-9_.:-]{1,80}$/i.test(code) ? code : undefined;
}

function safeHttpStatus(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

export function safeExternalErrorDetails(error: unknown): SafeExternalErrorDetails {
  const record = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {};
  const errorName = typeof record.name === 'string' && /^[a-z0-9_.:-]{1,80}$/i.test(record.name)
    ? record.name
    : 'UnknownError';
  const errorCode = safeErrorCode(record.code);
  const httpStatus = safeHttpStatus(record.status);
  const timeoutText = `${errorName} ${errorCode ?? ''}`.toLowerCase();

  return {
    errorName,
    ...(errorCode ? { errorCode } : {}),
    ...(httpStatus ? { httpStatus } : {}),
    timeout: timeoutText.includes('timeout') || timeoutText.includes('timedout') || errorCode === 'ETIMEDOUT',
  };
}

function flexibleAliasPattern(alias: string): RegExp | null {
  const parts = alias
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0 || parts.length > 5) {
    return null;
  }
  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b${escaped.join('[\\s:-]*')}\\b`, 'i');
}

function contextualExcerpt(text: string, matchIndex: number, maxLength = 900): string {
  if (text.length <= maxLength) {
    return text.trim();
  }
  const before = Math.floor(maxLength * 0.35);
  const start = Math.max(0, matchIndex - before);
  const end = Math.min(text.length, start + maxLength);
  const adjustedStart = Math.max(0, end - maxLength);
  return `${adjustedStart > 0 ? '...' : ''}${text.slice(adjustedStart, end).trim()}${end < text.length ? '...' : ''}`;
}

export function buildManualFallbackAnswer(params: {
  machineModel: string;
  symptoms: string;
  errorCode: string | null;
  codeAliases: string[];
  topChunks: RepairAssistChunk[];
}): string {
  let selectedChunk = params.topChunks[0];
  let matchIndex = 0;
  for (const chunk of params.topChunks) {
    const matchingPattern = params.codeAliases
      .map(flexibleAliasPattern)
      .filter((pattern): pattern is RegExp => pattern !== null)
      .find((pattern) => pattern.test(chunk.text));
    if (!matchingPattern) {
      continue;
    }
    selectedChunk = chunk;
    matchIndex = matchingPattern.exec(chunk.text)?.index ?? 0;
    break;
  }

  const codeLine = params.errorCode ? `Error code reported: ${params.errorCode}.` : '';
  const symptomsLine = params.symptoms ? `Symptoms: ${params.symptoms}.` : 'Symptoms: not provided.';
  const excerpt = selectedChunk
    ? `[${selectedChunk.chunkId}] ${contextualExcerpt(selectedChunk.text, matchIndex)}`
    : 'No matching manual chunk was found.';

  return [
    `Machine model: ${params.machineModel}.`,
    codeLine,
    symptomsLine,
    'The AI explanation was unavailable, so LaundryOps is showing the most relevant source passage from the uploaded manual:',
    excerpt,
    'Review the cited manual section and its safety instructions before servicing the machine.',
  ].filter(Boolean).join('\n');
}

export async function resolveRepairAssistAnswer(params: {
  requestAnswer: () => Promise<string | null | undefined>;
  fallbackAnswer: string;
}): Promise<RepairAssistAnswerResult> {
  try {
    const answer = (await params.requestAnswer())?.trim();
    if (answer) {
      return {
        answer,
        mode: 'openai',
      };
    }

    return {
      answer: params.fallbackAnswer,
      mode: 'manual-fallback',
      fallbackReason: 'empty_response',
    };
  } catch (error) {
    return {
      answer: params.fallbackAnswer,
      mode: 'manual-fallback',
      fallbackReason: 'request_failed',
      error: safeExternalErrorDetails(error),
    };
  }
}
