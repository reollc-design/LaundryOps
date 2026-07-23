export const OPENAI_REPAIR_ASSIST_TIMEOUT_MS = 45_000;
export const MAX_REPAIR_ASSIST_IMAGES = 3;
export const MAX_REPAIR_ASSIST_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_REPAIR_ASSIST_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;

const REPAIR_ASSIST_IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/]+={0,2})$/i;

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

export interface RepairAssistImage {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  dataUrl: string;
  byteLength: number;
}

export type RepairAssistInputContent =
  | {
    type: 'input_text';
    text: string;
  }
  | {
    type: 'input_image';
    image_url: string;
    detail: 'high';
  };

function hasExpectedImageSignature(
  contentType: RepairAssistImage['contentType'],
  bytes: Buffer,
): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3
      && bytes[0] === 0xff
      && bytes[1] === 0xd8
      && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length
      && signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

export function parseRepairAssistImages(value: unknown): RepairAssistImage[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('Repair Assist photos must be sent as a list.');
  }
  if (value.length > MAX_REPAIR_ASSIST_IMAGES) {
    throw new Error(`Repair Assist accepts up to ${MAX_REPAIR_ASSIST_IMAGES} photos per request.`);
  }

  let totalBytes = 0;
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('One Repair Assist photo is invalid.');
    }
    const record = entry as Record<string, unknown>;
    const contentType = typeof record.contentType === 'string' ? record.contentType.trim().toLowerCase() : '';
    const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl.trim() : '';
    const match = REPAIR_ASSIST_IMAGE_DATA_URL.exec(dataUrl);
    if (!match || match[1].toLowerCase() !== contentType) {
      throw new Error('Use a valid JPG, PNG, or WebP photo.');
    }

    const base64 = match[2];
    if (base64.length % 4 !== 0) {
      throw new Error('One Repair Assist photo is malformed.');
    }
    const decodedBytes = Buffer.from(base64, 'base64');
    const byteLength = decodedBytes.byteLength;
    if (byteLength <= 0 || byteLength > MAX_REPAIR_ASSIST_IMAGE_BYTES) {
      throw new Error('Each Repair Assist photo must be 5 MB or smaller.');
    }
    if (!hasExpectedImageSignature(contentType as RepairAssistImage['contentType'], decodedBytes)) {
      throw new Error('One Repair Assist photo does not match its JPG, PNG, or WebP file type.');
    }
    totalBytes += byteLength;
    if (totalBytes > MAX_REPAIR_ASSIST_TOTAL_IMAGE_BYTES) {
      throw new Error('Repair Assist photos must total 15 MB or less.');
    }

    return {
      contentType: contentType as RepairAssistImage['contentType'],
      dataUrl,
      byteLength,
    };
  });
}

export function buildRepairAssistInputContent(
  prompt: string,
  images: RepairAssistImage[],
): RepairAssistInputContent[] {
  return [
    {
      type: 'input_text',
      text: prompt,
    },
    ...images.map((image) => ({
      type: 'input_image' as const,
      image_url: image.dataUrl,
      detail: 'high' as const,
    })),
  ];
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
  imageCount?: number;
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
    params.imageCount
      ? 'Photo analysis was unavailable for this response. The guidance above comes from the uploaded manual only.'
      : '',
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
