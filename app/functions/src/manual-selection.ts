export interface ManualSelectionDocument {
  id: string;
}

export const MANUAL_SELECTION_REQUIRED_CODE = 'manual_selection_required';
export const MANUAL_SELECTION_REQUIRED_ERROR = 'Select a manual before generating repair guidance.';
export const MANUAL_SELECTION_INVALID_CODE = 'manual_selection_invalid';
export const MANUAL_SELECTION_NOT_FOUND_ERROR = 'The selected manual was not found in this organization.';
export const MANUAL_SELECTION_NOT_INDEXED_ERROR = 'The selected manual does not have a valid indexed version.';
export const MANUAL_SELECTION_MODEL_MISMATCH_ERROR = 'The selected manual does not match this machine manufacturer and model.';

// Keep the legacy export for callers and tests that still reference the old name.
export const MULTIPLE_MANUALS_MATCH_ERROR = MANUAL_SELECTION_REQUIRED_ERROR;

export class ManualSelectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ManualSelectionError';
  }
}

export function validateExplicitManualSelection(params: {
  selectedManualId?: string;
  selectedOrganizationId?: string;
  requestedOrganizationId: string;
  indexed: boolean;
  matchesRequestedModel: boolean;
}): void {
  if (
    !params.selectedManualId
    || !params.selectedOrganizationId
    || params.selectedOrganizationId !== params.requestedOrganizationId
  ) {
    throw new ManualSelectionError(MANUAL_SELECTION_INVALID_CODE, MANUAL_SELECTION_NOT_FOUND_ERROR);
  }

  if (!params.indexed) {
    throw new ManualSelectionError(MANUAL_SELECTION_INVALID_CODE, MANUAL_SELECTION_NOT_INDEXED_ERROR);
  }

  if (!params.matchesRequestedModel) {
    throw new ManualSelectionError(MANUAL_SELECTION_INVALID_CODE, MANUAL_SELECTION_MODEL_MISMATCH_ERROR);
  }
}

export function selectSingleManualMatch<T extends ManualSelectionDocument>(
  matches: Iterable<T>,
  selectedManualId?: string,
): T | null {
  const uniqueMatches = new Map<string, T>();
  for (const match of matches) {
    uniqueMatches.set(match.id, match);
  }

  if (selectedManualId) {
    const selectedManual = uniqueMatches.get(selectedManualId);
    if (!selectedManual) {
      throw new ManualSelectionError(MANUAL_SELECTION_INVALID_CODE, MANUAL_SELECTION_NOT_FOUND_ERROR);
    }
    return selectedManual;
  }

  if (uniqueMatches.size > 1) {
    throw new ManualSelectionError(MANUAL_SELECTION_REQUIRED_CODE, MANUAL_SELECTION_REQUIRED_ERROR);
  }

  return uniqueMatches.values().next().value ?? null;
}
