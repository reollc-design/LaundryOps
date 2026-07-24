export const MAX_MANUAL_CHUNK_LENGTH = 1400;
export const MAX_MANUAL_ERROR_CODE_INDEX_DOCS = 250;
export const MAX_MANUAL_ERROR_CODE_CHUNKS = 8;
export const MAX_MANUAL_ERROR_CODE_PREVIEW_LENGTH = 240;

export interface ManualChunkText {
  chunkId: string;
  text: string;
}

export interface ManualErrorCodeIndexEntry {
  normalizedCode: string;
  displayCode: string;
  aliases: string[];
  chunkIds: string[];
  previews: Array<{ chunkId: string; text: string }>;
}

export interface ManualPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface ManualPageProcessResult<R> {
  fetchedCount: number;
  skippedCount: number;
  pagesProcessed: number;
  processed: R[];
  failures: Array<{ itemId: string; message: string }>;
}

export interface MachineManualLinkFields {
  make?: string;
  modelNumber?: string;
  model?: string;
}

export interface ManualMachineCoverageRecord {
  id: string;
  machineModel?: string;
}

export function isManualIndexLeaseActive(leaseExpiresAtMs: number | null, nowMs: number): boolean {
  return leaseExpiresAtMs !== null && leaseExpiresAtMs > nowMs;
}

export function isManualOcrJobActive(status: unknown): boolean {
  return status === 'batch_queued' || status === 'batch_starting' || status === 'batch_processing';
}

export function isManualDeletionReserved(reservationExpiresAtMs: number | null, nowMs: number): boolean {
  return reservationExpiresAtMs !== null && reservationExpiresAtMs > nowMs;
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function modelCandidates(value: string): string[] {
  return uniqueStrings([
    compactKey(value),
    ...value.split(/\s+/).map(compactKey),
  ]).filter((candidate) => candidate.length >= 3 && /\d/.test(candidate));
}

export function manualModelMatchesMachine(
  manualModel: string,
  machine: MachineManualLinkFields,
): boolean {
  const manualModels = modelCandidates(manualModel);
  if (manualModels.length === 0) {
    return false;
  }

  const modelNumber = machine.modelNumber ?? '';
  const modelNumberKey = compactKey(modelNumber);
  if (modelNumberKey) {
    const makeModelKey = compactKey([machine.make, modelNumber].filter(Boolean).join(' '));
    const requiresManufacturer = /^\d+$/.test(modelNumberKey) || modelNumberKey.length < 4;
    const embeddedSpecificModelKeys = modelCandidates(modelNumber)
      .filter((candidate) => candidate.length >= 4 && /[a-z]/.test(candidate) && /\d/.test(candidate));
    const authoritativeMachineModels = uniqueStrings([
      ...(requiresManufacturer ? [] : [modelNumberKey]),
      makeModelKey === modelNumberKey ? '' : makeModelKey,
      ...embeddedSpecificModelKeys,
    ]);
    return manualModels.some((candidate) => authoritativeMachineModels.includes(candidate));
  }

  const legacyMachineModels = modelCandidates(machine.model ?? '');
  return manualModels.some((candidate) => legacyMachineModels.includes(candidate));
}

export function machineManualLinkFieldsChanged(
  before: MachineManualLinkFields | undefined,
  after: MachineManualLinkFields | undefined,
): boolean {
  if (!before || !after) {
    return true;
  }

  return before.make !== after.make
    || before.modelNumber !== after.modelNumber
    || before.model !== after.model;
}

export function manualMachineCoverageUpdates(params: {
  manuals: ManualMachineCoverageRecord[];
  machines: MachineManualLinkFields[];
  before?: MachineManualLinkFields;
  after?: MachineManualLinkFields;
}): Array<{ manualId: string; linkedMachineCount: number }> {
  return params.manuals.flatMap((manual) => {
    const machineModel = manual.machineModel?.trim();
    if (!machineModel) {
      return [];
    }

    const affected = [params.before, params.after]
      .some((machine) => machine && manualModelMatchesMachine(machineModel, machine));
    if (!affected) {
      return [];
    }

    return [{
      manualId: manual.id,
      linkedMachineCount: params.machines.filter((machine) => manualModelMatchesMachine(machineModel, machine)).length,
    }];
  });
}

export function chunkManualText(text: string, maxLength: number = MAX_MANUAL_CHUNK_LENGTH): string[] {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u0000/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n+/g, ' ').trim())
    .filter((part) => part.length > 0);

  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if ((current.length + 2 + paragraph.length) <= maxLength) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }
    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function formatManualErrorCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s*[-:]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function manualErrorCodeAliases(displayCode: string): string[] {
  const compact = compactKey(displayCode).toUpperCase();
  const spaced = compact.length > 1 ? `${compact.slice(0, 1)} ${compact.slice(1)}` : compact;
  return uniqueStrings([
    displayCode.toUpperCase(),
    compact,
    spaced,
    spaced.replace(/\s+/g, '-'),
    spaced.replace(/\s+/g, ':'),
  ]);
}

const MANUAL_ERROR_CODE_CONTEXT_PATTERN = /\b(error|fault|code|codes|display|displays|diagnostic|diagnostics|alarm|alarms)\b/i;
const MANUAL_ERROR_CODE_LINE_START_PATTERN = /^[\s*|:;.,-]*[EF]\s*[-:]?\s*[A-Z0-9]{1,5}\b/i;
const MANUAL_ERROR_CODE_PATTERN = /\b(?:[EF]\s*[-:]?\s*[A-Z0-9]{1,5}|[A-Z]{1,3}\s*[-:]?\s*\d{1,5}|\d{1,3}\s*[-:]?\s*[A-Z]{1,3})\b/gi;
const MANUAL_ERROR_CODE_BLOCKLIST = new Set([
  'alarm',
  'alarms',
  'code',
  'codes',
  'diagnostic',
  'diagnostics',
  'display',
  'displays',
  'door',
  'error',
  'errors',
  'fault',
  'faults',
]);

function shouldScanManualLineForErrorCodes(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 320) {
    return false;
  }
  return MANUAL_ERROR_CODE_CONTEXT_PATTERN.test(trimmed) || MANUAL_ERROR_CODE_LINE_START_PATTERN.test(trimmed);
}

function isLikelyManualErrorCode(rawCode: string): boolean {
  const trimmed = rawCode.replace(/\s+/g, ' ').trim();
  const compact = compactKey(trimmed);
  if (compact.length < 2 || compact.length > 12 || MANUAL_ERROR_CODE_BLOCKLIST.has(compact)) {
    return false;
  }

  const hasDigit = /\d/.test(compact);
  const hasSeparator = /[\s:-]/.test(trimmed);
  const startsWithCommonErrorPrefix = /^[ef]/i.test(compact);
  const isUppercaseLike = trimmed === trimmed.toUpperCase();
  return hasDigit || (startsWithCommonErrorPrefix && compact.length <= 6 && (hasSeparator || isUppercaseLike));
}

function previewForManualErrorCode(chunkText: string, normalizedCode: string, preferredPreview?: string): string {
  if (preferredPreview) {
    return preferredPreview.length > MAX_MANUAL_ERROR_CODE_PREVIEW_LENGTH
      ? `${preferredPreview.slice(0, MAX_MANUAL_ERROR_CODE_PREVIEW_LENGTH)}...`
      : preferredPreview;
  }

  const lines = chunkText
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
  const matchingLine = lines.find((line) => compactKey(line).includes(normalizedCode)) ?? lines[0] ?? '';
  return matchingLine.length > MAX_MANUAL_ERROR_CODE_PREVIEW_LENGTH
    ? `${matchingLine.slice(0, MAX_MANUAL_ERROR_CODE_PREVIEW_LENGTH)}...`
    : matchingLine;
}

function manualErrorCodeContext(chunkText: string, index: number, rawCode: string): string {
  const start = Math.max(0, index - 110);
  const end = Math.min(chunkText.length, index + rawCode.length + 180);
  return chunkText.slice(start, end).replace(/\s+/g, ' ').trim();
}

function contextSupportsManualErrorCode(context: string): boolean {
  return MANUAL_ERROR_CODE_CONTEXT_PATTERN.test(context) || MANUAL_ERROR_CODE_LINE_START_PATTERN.test(context);
}

function addManualErrorCodeIndexEntry(params: {
  entries: Map<string, ManualErrorCodeIndexEntry>;
  chunk: ManualChunkText;
  rawCode: string;
  preview?: string;
}): void {
  if (!isLikelyManualErrorCode(params.rawCode)) {
    return;
  }

  const displayCode = formatManualErrorCode(params.rawCode);
  const normalizedCode = compactKey(displayCode);
  const existing = params.entries.get(normalizedCode);
  const entry: ManualErrorCodeIndexEntry = existing ?? {
    normalizedCode,
    displayCode,
    aliases: manualErrorCodeAliases(displayCode),
    chunkIds: [],
    previews: [],
  };

  entry.aliases = uniqueStrings([...entry.aliases, ...manualErrorCodeAliases(displayCode)]);
  if (!entry.chunkIds.includes(params.chunk.chunkId) && entry.chunkIds.length < MAX_MANUAL_ERROR_CODE_CHUNKS) {
    entry.chunkIds.push(params.chunk.chunkId);
    entry.previews.push({
      chunkId: params.chunk.chunkId,
      text: previewForManualErrorCode(params.chunk.text, normalizedCode, params.preview),
    });
  }
  params.entries.set(normalizedCode, entry);
}

export function buildManualErrorCodeIndex(chunks: ManualChunkText[]): ManualErrorCodeIndexEntry[] {
  const entries = new Map<string, ManualErrorCodeIndexEntry>();

  for (const chunk of chunks) {
    const lines = chunk.text
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(shouldScanManualLineForErrorCodes);

    for (const line of lines) {
      for (const match of line.matchAll(MANUAL_ERROR_CODE_PATTERN)) {
        addManualErrorCodeIndexEntry({
          entries,
          chunk,
          rawCode: match[0] ?? '',
          preview: line,
        });
      }
    }

    for (const match of chunk.text.matchAll(MANUAL_ERROR_CODE_PATTERN)) {
      const rawCode = match[0] ?? '';
      const matchIndex = match.index ?? 0;
      const context = manualErrorCodeContext(chunk.text, matchIndex, rawCode);
      if (!contextSupportsManualErrorCode(context)) {
        continue;
      }
      addManualErrorCodeIndexEntry({
        entries,
        chunk,
        rawCode,
        preview: context,
      });
    }
  }

  return Array.from(entries.values())
    .sort((a, b) => a.normalizedCode.localeCompare(b.normalizedCode))
    .slice(0, MAX_MANUAL_ERROR_CODE_INDEX_DOCS);
}

export function errorCodeAliases(errorCode: string | null, symptoms: string): string[] {
  const sourceValues = [errorCode ?? ''];
  const codePattern = /\b(?:error\s*code|code)\s*(?:is|:)?\s*((?:[ef]\s*[-:]?\s*[a-z0-9]{1,5})|(?:[a-z]{1,3}\s*[-:]?\s*\d{1,5}))\b/gi;
  for (const match of symptoms.matchAll(codePattern)) {
    sourceValues.push(match[1] ?? '');
  }

  const displayPattern = /\b(?:showing|displaying|shows|displays)\s*(?:error\s*code\s*)?(?:is|:)?\s*((?:[ef]\s*[-:]?\s*[a-z0-9]{1,5})|(?:[a-z]{1,3}\s*[-:]?\s*\d{1,5}))\b/gi;
  for (const match of symptoms.matchAll(displayPattern)) {
    sourceValues.push(match[1] ?? '');
  }

  const standaloneSymptoms = symptoms.trim();
  const standaloneCompact = compactKey(standaloneSymptoms);
  const standaloneCodePattern = /^(?:[ef][\s:-]+[a-z0-9]{1,5}|[ef][a-z0-9]*\d[a-z0-9]*|e(?:dl|dr))$/i;
  if (
    standaloneSymptoms.length <= 14
    && standaloneCompact.length >= 2
    && standaloneCompact.length <= 8
    && standaloneCodePattern.test(standaloneSymptoms)
  ) {
    sourceValues.push(standaloneSymptoms);
  }

  const aliases: string[] = [];
  for (const source of sourceValues) {
    const cleaned = source
      .toLowerCase()
      .replace(/\b(on|and|with|for|in|at|while|when|during|showing|displaying)\b.*$/i, '')
      .replace(/[.?!,;]+$/g, '')
      .trim();
    if (!cleaned) {
      continue;
    }

    const parts = cleaned.split(/[^a-z0-9]+/).filter(Boolean);
    const compact = parts.join('');
    aliases.push(cleaned, compact);
    if (parts.length > 1) {
      aliases.push(parts.join(' '), parts.join('-'), parts.join(':'));
    } else if (/^[a-z]{1,2}[0-9a-z]{1,5}$/.test(compact)) {
      aliases.push(
        `${compact.slice(0, 1)} ${compact.slice(1)}`,
        `${compact.slice(0, 1)}-${compact.slice(1)}`,
        `${compact.slice(0, 1)}:${compact.slice(1)}`,
      );
    }
  }

  return uniqueStrings(aliases).filter((alias) => compactKey(alias).length >= 2);
}

export async function processManualPages<T, R>(params: {
  fetchPage: (cursor?: string) => Promise<ManualPage<T>>;
  getItemId: (item: T) => string;
  shouldProcess: (item: T) => boolean;
  process: (item: T) => Promise<R>;
  toErrorMessage: (error: unknown) => string;
}): Promise<ManualPageProcessResult<R>> {
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  const processed: R[] = [];
  const failures: Array<{ itemId: string; message: string }> = [];
  let fetchedCount = 0;
  let skippedCount = 0;
  let pagesProcessed = 0;

  while (true) {
    const page = await params.fetchPage(cursor);
    pagesProcessed += 1;
    fetchedCount += page.items.length;
    if (page.items.length === 0) {
      break;
    }

    for (const item of page.items) {
      if (!params.shouldProcess(item)) {
        skippedCount += 1;
        continue;
      }

      try {
        processed.push(await params.process(item));
      } catch (error) {
        failures.push({
          itemId: params.getItemId(item),
          message: params.toErrorMessage(error),
        });
      }
    }

    if (!page.nextCursor || seenCursors.has(page.nextCursor)) {
      break;
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  return {
    fetchedCount,
    skippedCount,
    pagesProcessed,
    processed,
    failures,
  };
}
