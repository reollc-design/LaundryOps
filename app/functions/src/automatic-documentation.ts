export type DocumentationMode = 'observation' | 'approval' | 'automatic';
export type DocumentationMatchLevel = 'exact' | 'family' | 'serial_required' | 'review' | 'rejected';
export type DocumentationCandidateState = 'discovered' | 'review' | 'approved' | 'rejected' | 'attached' | 'detached' | 'cancelled';
export type DocumentationType =
  | 'service_manual' | 'troubleshooting_manual' | 'error_code_guide' | 'diagnostic_guide'
  | 'technical_manual' | 'parts_manual' | 'illustrated_parts_catalog' | 'installation_manual'
  | 'operator_manual' | 'programming_manual' | 'maintenance_manual' | 'wiring_diagram'
  | 'electrical_schematic' | 'service_bulletin' | 'technical_bulletin' | 'specification_sheet'
  | 'sales_brochure' | 'warranty' | 'unknown' | 'other';

export function isRepairDocumentationType(value: unknown): boolean {
  return [
    'service_manual', 'technical_manual', 'diagnostic_guide', 'troubleshooting_manual',
    'error_code_guide', 'wiring_diagram', 'electrical_schematic', 'service_bulletin',
    'technical_bulletin', 'maintenance_manual', 'parts_manual', 'illustrated_parts_catalog',
  ].includes(String(value));
}

export function isAutomaticManualAttachedToMachine(params: {
  manual: Record<string, unknown>;
  machineId?: string | null;
  attachment?: Record<string, unknown> | null;
}): boolean {
  if (params.manual.automaticDocumentation !== true) return true;
  if (!params.manual.aiRetrievalEnabled || !params.machineId || !params.attachment) return false;
  return params.attachment.state === 'attached'
    && params.attachment.aiRetrievalEnabled === true
    && params.attachment.machineId === params.machineId
    && params.attachment.manualId === params.manual.id;
}

export function hasSerialDependentApplicability(text: string): boolean {
  return /\b(?:serial(?:\s+(?:number|no\.?|range)|[- ]dependent)?|s\s*\/\s*n)\b/i.test(text);
}

export interface DocumentationSettings {
  automaticDocumentationEnabled?: unknown;
  mode?: unknown;
  disabledForLocationIds?: unknown;
  disabledForMachineIds?: unknown;
}

export interface EffectiveDocumentationSettings {
  enabled: boolean;
  mode: DocumentationMode;
  reason: 'enabled' | 'global_disabled' | 'organization_disabled' | 'location_disabled' | 'machine_disabled';
}

export interface DocumentationMachineIdentity {
  make?: string;
  modelNumber?: string;
  serialNumber?: string;
  productFamily?: string;
  category?: string;
}

export interface CandidateDocumentEvidence {
  title?: string;
  fileName?: string;
  extractedText?: string;
  sourceDomain?: string;
  sourceUrl?: string;
  exactModels?: string[];
  modelFamilies?: string[];
  serialRangesMentioned?: boolean;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function compactDocumentationKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];
}

export function effectiveDocumentationSettings(params: {
  globalEnabled: boolean;
  organization: DocumentationSettings | null | undefined;
  machineId: string;
  locationId?: string | null;
}): EffectiveDocumentationSettings {
  if (!params.globalEnabled) return { enabled: false, mode: 'approval', reason: 'global_disabled' };
  const organization = params.organization ?? {};
  if (organization.automaticDocumentationEnabled !== true) return { enabled: false, mode: 'approval', reason: 'organization_disabled' };
  if (params.locationId && list(organization.disabledForLocationIds).includes(params.locationId)) {
    return { enabled: false, mode: 'approval', reason: 'location_disabled' };
  }
  if (list(organization.disabledForMachineIds).includes(params.machineId)) {
    return { enabled: false, mode: 'approval', reason: 'machine_disabled' };
  }
  const mode = organization.mode === 'observation' || organization.mode === 'automatic' ? organization.mode : 'approval';
  return { enabled: true, mode, reason: 'enabled' };
}

export function classifyDocumentation(input: Pick<CandidateDocumentEvidence, 'title' | 'fileName' | 'extractedText'>): {
  primary: DocumentationType;
  secondary: DocumentationType[];
  confidence: number;
  evidence: string[];
  requiresReview: boolean;
} {
  const haystack = [input.title, input.fileName, input.extractedText].map(text).join('\n').toLowerCase();
  const definitions: Array<[DocumentationType, RegExp]> = [
    ['error_code_guide', /\b(error|fault|alarm) codes?\b/],
    ['troubleshooting_manual', /\btroubleshooting\b/],
    ['diagnostic_guide', /\bdiagnostic (test|guide|procedure)|\bdiagnostics\b/],
    ['parts_manual', /\bparts manual\b|\bparts list\b/],
    ['illustrated_parts_catalog', /\billustrated parts\b|\bipc\b/],
    ['wiring_diagram', /\bwiring diagram\b/],
    ['electrical_schematic', /\belectrical schematic\b|\bschematic\b/],
    ['service_bulletin', /\bservice bulletin\b/],
    ['technical_bulletin', /\btechnical bulletin\b/],
    ['installation_manual', /\binstallation (manual|instructions?)\b/],
    ['operator_manual', /\b(operator|operating|owner)('?s)? manual\b/],
    ['programming_manual', /\bprogramming manual\b/],
    ['maintenance_manual', /\bmaintenance manual\b/],
    ['service_manual', /\bservice manual\b/],
    ['technical_manual', /\btechnical manual\b/],
    ['specification_sheet', /\b(specification|spec) sheet\b/],
    ['warranty', /\bwarranty\b/],
    ['sales_brochure', /\b(brochure|features and benefits)\b/],
  ];
  const matches = definitions.filter(([, pattern]) => pattern.test(haystack)).map(([type]) => type);
  const primary = matches[0] ?? 'unknown';
  const evidence = matches.map((type) => `Matched ${type.replace(/_/g, ' ')} terminology.`);
  return { primary, secondary: matches.slice(1), confidence: primary === 'unknown' ? 0 : Math.min(0.95, 0.55 + matches.length * 0.12), evidence, requiresReview: primary === 'unknown' };
}

export function verifyDocumentationCompatibility(machine: DocumentationMachineIdentity, candidate: CandidateDocumentEvidence): {
  level: DocumentationMatchLevel;
  evidence: string[];
} {
  const model = compactDocumentationKey(text(machine.modelNumber));
  if (!model || model.length < 4) return { level: 'review' as const, evidence: ['A complete machine model number is required.'] };
  const exactModels = list(candidate.exactModels).map(compactDocumentationKey);
  const families = list(candidate.modelFamilies).map(compactDocumentationKey);
  const corpus = [candidate.title, candidate.fileName, candidate.extractedText].map(text).join(' ');
  // Preserve separators in document text for a real boundary check. The compact
  // form alone cannot distinguish ABC123 from ABC1234.
  const modelPattern = model.split('').join('[\\s-]*');
  const hasExact = exactModels.includes(model)
    || new RegExp(`(^|[^a-z0-9])${modelPattern}(?![a-z0-9])`, 'i').test(corpus);
  if (hasExact) {
    // A serial number on the machine is not proof that it falls within the
    // document's applicable serial range. Keep these candidates in review
    // until the range itself can be verified.
    return candidate.serialRangesMentioned
      ? { level: 'serial_required' as const, evidence: ['Exact model found, but the document has serial-dependent applicability that still needs verification.'] }
      : { level: 'exact' as const, evidence: ['Exact model number appears in the candidate evidence.'] };
  }
  const family = compactDocumentationKey(text(machine.productFamily));
  if (family && families.includes(family)) return { level: 'family' as const, evidence: ['Document lists the machine product family, not the exact model.'] };
  return { level: 'rejected' as const, evidence: ['Candidate does not establish exact-model applicability.'] };
}

export function canTransitionCandidate(from: DocumentationCandidateState, to: DocumentationCandidateState): boolean {
  const transitions: Record<DocumentationCandidateState, DocumentationCandidateState[]> = {
    discovered: ['review', 'rejected', 'cancelled'], review: ['approved', 'rejected', 'cancelled'],
    approved: ['attached', 'rejected'], rejected: ['review'], attached: ['detached'], detached: ['attached', 'review'], cancelled: ['review'],
  };
  return transitions[from].includes(to);
}

export function isDocumentationJobReviewable(status: unknown): boolean {
  return typeof status === 'string' && !['cancelled', 'completed', 'failed'].includes(status);
}

// A reservation is deliberately short-lived so a stopped attachment can be retried,
// but a completed manual must always block a second automatic download.
export function canStartDocumentationAttachment(params: {
  candidateState: unknown;
  reservationToken?: unknown;
  reservationExpiresAtMs?: number | null;
  manualExists: boolean;
  attachmentStatus?: unknown;
  nowMs: number;
}): boolean {
  if (params.candidateState !== 'approved') return false;
  const activeReservation = typeof params.reservationToken === 'string'
    && typeof params.reservationExpiresAtMs === 'number'
    && params.reservationExpiresAtMs > params.nowMs;
  if (activeReservation) return false;
  if (!params.manualExists) return true;
  return ['failed', 'review_required', 'cancelled'].includes(String(params.attachmentStatus ?? ''));
}

export function canRecoverStaleAutomaticAttachment(params: {
  manualExists: boolean;
  manualStatus?: unknown;
  indexingLeaseActive: boolean;
  ocrActive: boolean;
}): boolean {
  if (!params.manualExists || params.indexingLeaseActive || params.ocrActive) return false;
  return ['processing', 'failed', 'indexed'].includes(String(params.manualStatus ?? ''));
}

export function safeDocumentationUrl(value: unknown, allowedDomains: string[]): URL | null {
  const raw = text(value);
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    const allowed = allowedDomains.map((domain) => domain.toLowerCase().replace(/^\./, '')).filter(Boolean);
    if (!allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    // Candidate records are review metadata, never a place to retain signed or tracking URLs.
    url.search = '';
    url.hash = '';
    return url;
  } catch { return null; }
}
