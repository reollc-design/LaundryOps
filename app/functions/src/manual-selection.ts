export interface ManualSelectionDocument {
  id: string;
}

export const MULTIPLE_MANUALS_MATCH_ERROR =
  'Multiple indexed manuals match this machine model. Keep one approved manual for the model before using Repair Assist.';

export function selectSingleManualMatch<T extends ManualSelectionDocument>(matches: Iterable<T>): T | null {
  const uniqueMatches = new Map<string, T>();
  for (const match of matches) {
    uniqueMatches.set(match.id, match);
  }

  if (uniqueMatches.size > 1) {
    throw new Error(MULTIPLE_MANUALS_MATCH_ERROR);
  }

  return uniqueMatches.values().next().value ?? null;
}
