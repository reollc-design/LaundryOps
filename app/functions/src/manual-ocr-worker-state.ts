export function manualOcrBatchOperationState(value: unknown): { done: boolean; failed: boolean } {
  const operation = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const response = typeof operation.latestResponse === 'object' && operation.latestResponse !== null
    ? operation.latestResponse as Record<string, unknown>
    : {};
  return {
    done: response.done === true,
    failed: typeof response.error === 'object' && response.error !== null,
  };
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export interface StoredManualOcrBatchJob {
  partIndex: number;
  operationName?: string;
  outputPrefix: string;
  sourceGcsUri?: string;
  completed: boolean;
}

export function storedManualOcrBatchJobs(value: unknown, legacy: {
  operationName: string | null;
  outputPrefix: string | null;
}): StoredManualOcrBatchJob[] {
  const rawJobs = Array.isArray(value) ? value : [];
  const jobs = rawJobs.map((rawJob) => {
    const job = typeof rawJob === 'object' && rawJob !== null ? rawJob as Record<string, unknown> : {};
    return {
      partIndex: positiveInteger(job.partIndex),
      operationName: nonEmptyString(job.operationName),
      outputPrefix: nonEmptyString(job.outputPrefix),
      sourceGcsUri: nonEmptyString(job.sourceGcsUri),
      completed: job.completed === true,
    };
  }).filter((job): job is {
    partIndex: number;
    operationName: string | null;
    outputPrefix: string;
    sourceGcsUri: string | null;
    completed: boolean;
  } => job.partIndex !== null && job.outputPrefix !== null).map((job) => ({
    partIndex: job.partIndex,
    ...(job.operationName ? { operationName: job.operationName } : {}),
    outputPrefix: job.outputPrefix,
    ...(job.sourceGcsUri ? { sourceGcsUri: job.sourceGcsUri } : {}),
    completed: job.completed,
  }));

  if (jobs.length > 0) {
    return [...jobs].sort((left, right) => left.partIndex - right.partIndex);
  }
  if (legacy.operationName && legacy.outputPrefix) {
    return [{ partIndex: 0, operationName: legacy.operationName, outputPrefix: legacy.outputPrefix, completed: false }];
  }
  return [];
}

export function nextManualOcrOutputWaitAttempt(currentValue: unknown): number {
  const current = positiveInteger(currentValue) ?? 0;
  return current + 1;
}
