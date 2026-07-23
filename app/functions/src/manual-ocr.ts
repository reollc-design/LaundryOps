import { v1 as documentai } from '@google-cloud/documentai';
import { PDFDocument } from 'pdf-lib';

export const MAX_OCR_PAGES_PER_REQUEST = 15;
export const MAX_OCR_CONCURRENCY = 2;
export const MAX_INLINE_OCR_PAGES = 30;
// Document AI batch OCR accepts at most 500 pages per input PDF. Larger manuals
// are split into ordered temporary PDFs before their independent batch jobs start.
export const MAX_BATCH_OCR_PAGES_PER_DOCUMENT = 500;

export interface ManualOcrProcessor {
  processorPath(projectId: string, location: string, processorId: string): string;
  processDocument(request: {
    name: string;
    rawDocument: { content: string; mimeType: string };
    fieldMask: string;
    processOptions: {
      ocrConfig: { enableNativePdfParsing: boolean };
      individualPageSelector: { pages: number[] };
    };
  }): Promise<[{ document?: { text?: string } }]>;
  batchProcessDocuments(request: {
    name: string;
    inputDocuments: {
      gcsDocuments: { documents: Array<{ gcsUri: string; mimeType: string }> };
    };
    documentOutputConfig: {
      gcsOutputConfig: { gcsUri: string; fieldMask: string };
    };
  }): Promise<[{ name?: string }]>;
  checkBatchProcessDocumentsProgress(operationName: string): Promise<unknown>;
}

export interface ManualOcrConfig {
  projectId: string;
  location: string;
  processorId: string;
}

export interface ManualOcrResult {
  text: string;
  processedPageCount: number;
  requestCount: number;
}

export interface ManualOcrBatchStartResult {
  operationName: string;
  outputPrefix: string;
}

export interface ManualOcrBatchJob {
  partIndex: number;
  operationName: string;
  outputPrefix: string;
}

export interface ManualOcrShardResult {
  ready: boolean;
  text: string;
  shardCount: number;
}

export function buildOcrPageBatches(pageCount: number | null): number[][] {
  if (!Number.isFinite(pageCount) || !pageCount || pageCount < 1) {
    throw new Error('Unable to determine the PDF page count for OCR.');
  }

  const pages = Math.floor(pageCount);
  const batches: number[][] = [];
  for (let start = 1; start <= pages; start += MAX_OCR_PAGES_PER_REQUEST) {
    const end = Math.min(start + MAX_OCR_PAGES_PER_REQUEST - 1, pages);
    batches.push(Array.from({ length: end - start + 1 }, (_, index) => start + index));
  }
  return batches;
}

export async function splitManualPdfForBatchOcr(params: {
  pdfBytes: Buffer;
  maxPagesPerDocument?: number;
}): Promise<Buffer[]> {
  const maxPagesPerDocument = params.maxPagesPerDocument ?? MAX_BATCH_OCR_PAGES_PER_DOCUMENT;
  if (!Number.isInteger(maxPagesPerDocument) || maxPagesPerDocument < 1) {
    throw new Error('OCR batch page limit must be a positive integer.');
  }

  const source = await PDFDocument.load(params.pdfBytes, { ignoreEncryption: true });
  const pageCount = source.getPageCount();
  if (pageCount <= maxPagesPerDocument) {
    return [params.pdfBytes];
  }

  const parts: Buffer[] = [];
  for (let start = 0; start < pageCount; start += maxPagesPerDocument) {
    const target = await PDFDocument.create();
    const pageIndexes = Array.from(
      { length: Math.min(maxPagesPerDocument, pageCount - start) },
      (_, index) => start + index,
    );
    const copiedPages = await target.copyPages(source, pageIndexes);
    copiedPages.forEach((page) => target.addPage(page));
    parts.push(Buffer.from(await target.save()));
  }
  return parts;
}

export async function manualPdfPageCount(pdfBytes: Buffer): Promise<number> {
  const document = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return document.getPageCount();
}

export function normalizeOcrText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

export async function startManualOcrBatch(params: {
  client: ManualOcrProcessor;
  config: ManualOcrConfig;
  sourceGcsUri: string;
  outputPrefix: string;
}): Promise<ManualOcrBatchStartResult> {
  const [operation] = await params.client.batchProcessDocuments({
    name: params.client.processorPath(
      params.config.projectId,
      params.config.location,
      params.config.processorId,
    ),
    inputDocuments: {
      gcsDocuments: {
        documents: [{ gcsUri: params.sourceGcsUri, mimeType: 'application/pdf' }],
      },
    },
    documentOutputConfig: {
      gcsOutputConfig: {
        gcsUri: params.outputPrefix,
        fieldMask: 'text,shardInfo',
      },
    },
  });
  const operationName = typeof operation.name === 'string' ? operation.name.trim() : '';
  if (!operationName) {
    throw new Error('Document OCR did not return a batch operation.');
  }
  return { operationName, outputPrefix: params.outputPrefix };
}

export function collectManualOcrShards(values: unknown[]): ManualOcrShardResult {
  const shards = values.map((value) => {
    const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const shardInfo = typeof record.shardInfo === 'object' && record.shardInfo !== null
      ? record.shardInfo as Record<string, unknown>
      : {};
    return {
      text: normalizeOcrText(record.text),
      index: numericValue(shardInfo.shardIndex),
      count: numericValue(shardInfo.shardCount),
    };
  });

  if (shards.length === 0) {
    return { ready: false, text: '', shardCount: 0 };
  }
  const expectedShardCount = Math.max(...shards.map((shard) => shard.count ?? 1));
  const hasCompleteShardInfo = shards.every((shard) => shard.index !== null && shard.count === expectedShardCount);
  if (expectedShardCount > 1 && (!hasCompleteShardInfo || shards.length !== expectedShardCount)) {
    return { ready: false, text: '', shardCount: expectedShardCount };
  }

  const ordered = hasCompleteShardInfo
    ? [...shards].sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    : shards;
  const text = ordered.map((shard) => shard.text).filter(Boolean).join('\n\n').trim();
  return {
    ready: true,
    text,
    shardCount: expectedShardCount,
  };
}

export async function extractManualOcrText(params: {
  client: ManualOcrProcessor;
  config: ManualOcrConfig;
  pdfBytes: Buffer;
  pageCount: number | null;
}): Promise<ManualOcrResult> {
  const batches = buildOcrPageBatches(params.pageCount);
  const name = params.client.processorPath(
    params.config.projectId,
    params.config.location,
    params.config.processorId,
  );
  const textParts: string[] = [];

  for (let offset = 0; offset < batches.length; offset += MAX_OCR_CONCURRENCY) {
    const requestGroup = batches.slice(offset, offset + MAX_OCR_CONCURRENCY);
    const results = await Promise.all(requestGroup.map(async (pages) => {
      const [result] = await params.client.processDocument({
        name,
        rawDocument: {
          content: params.pdfBytes.toString('base64'),
          mimeType: 'application/pdf',
        },
        // Return only the text and page identifiers needed for manual indexing.
        fieldMask: 'text,pages.pageNumber',
        processOptions: {
          ocrConfig: { enableNativePdfParsing: true },
          individualPageSelector: { pages },
        },
      });
      return normalizeOcrText(result.document?.text);
    }));
    for (const text of results) {
      if (text) {
        textParts.push(text);
      }
    }
  }

  return {
    text: textParts.join('\n\n').trim(),
    processedPageCount: batches.reduce((count, pages) => count + pages.length, 0),
    requestCount: batches.length,
  };
}

export function createDocumentAiOcrClient(location: string): ManualOcrProcessor {
  return new documentai.DocumentProcessorServiceClient({
    apiEndpoint: `${location}-documentai.googleapis.com`,
  }) as unknown as ManualOcrProcessor;
}
