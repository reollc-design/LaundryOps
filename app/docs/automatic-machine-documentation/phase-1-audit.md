# Automatic Machine Documentation: Phase 1 Audit And Design

## Status

This is a design-only checkpoint. No production application behavior, Firebase
data, rules, Storage paths, or deployed Functions have changed.

- Feature branch: `feature/automatic-machine-documentation`
- Rollback commit: `c2cfdef4d49b5e99af9ce6af44099a89b3f673c9`
- Default operating mode for the new feature: `approval`
- Default feature flag: `automaticDocumentationEnabled: false`

## Existing LaundryOps Architecture

- Frontend: React 19, TypeScript, Vite, Firebase Web SDK.
- Backend: Firebase Functions v2 in `us-central1`, Node.js 22.
- Data: Firestore `(default)`, organization-scoped collections.
- Authentication: Firebase Authentication with organization memberships.
- Files: Firebase Storage. Tenant manual PDFs currently live under
  `orgs/{organizationId}/manuals/{userId}/{manualId}/{fileName}`.
- Existing manual processing: `indexOrganizationManual` extracts native PDF
  text, uses Document AI OCR for scanned or large PDFs, creates chunks and an
  error-code index, then makes the manual available to Repair Assist.
- Existing AI: `generateRepairAssist` requires an authenticated organization
  member, selects a matching indexed tenant manual, retrieves manual chunks,
  and uses GPT-5.5. Existing repair photos are validated, normalized in the
  browser, and passed as untrusted visual input with the request.

## Existing Components To Reuse

| Need | Existing component |
| --- | --- |
| Model normalization and cautious matching | `functions/src/manual-indexing.ts` |
| PDF/OCR processing | `functions/src/manual-ocr.ts`, `functions/src/manual-ocr-worker.ts` |
| Grounded Repair Assist | `functions/src/index.ts`, `functions/src/repair-assist.ts` |
| Organization access and rate limits | `functions/src/request-protection.ts` |
| Manual upload and list UI | `src/firebase/manuals.ts`, `src/hooks/useOrganizationManuals.ts` |
| Machine create/edit inputs | `src/firebase/machines.ts`, `src/App.tsx` |
| Photo validation and EXIF-stripping normalization | `src/repairAssistPhotos.ts` |

## Safety Boundaries

1. The current tenant manual upload, OCR, manual chunks, error-code indexes,
   and Repair Assist retrieval stay in place.
2. New data is additive. No existing manual field or Storage path is renamed
   or overwritten.
3. Automatic discovery is disabled until the organization-level feature flag
   is on. The new feature defaults to Approval mode.
4. An approval is required before a discovered document is attached to a
   tenant machine, copied into the tenant manual workflow, or used by Repair
   Assist.
5. Customer-uploaded PDFs remain tenant-private. The global library may store
   only system-acquired documents from explicitly approved sources, with a
   documented right to retain and reuse them. A customer upload is never
   promoted into shared storage automatically.
6. A document body, PDF, image, QR code, or barcode is untrusted input. It
   cannot alter prompts, permissions, matching rules, or system instructions.

## Proposed Additive Data Model

### Organization configuration

`organizations/{orgId}/documentationSettings/default`

- `automaticDocumentationEnabled: boolean`
- `mode: 'observation' | 'approval' | 'automatic'`
- `disabledForLocationIds: string[]`
- `disabledForMachineIds: string[]`
- `approvedDomains: string[]`
- `blockedDomains: string[]`
- `maxFileBytes: number`
- `updatedAt`, `updatedBy`

Only an owner or admin can change this document. The first release creates no
document automatically; absence is treated as disabled Approval mode.

### Per-machine documentation state

`organizations/{orgId}/machines/{machineId}` gains optional fields only:

- `documentationDiscoveryStatus`
- `documentationDiscoveryUpdatedAt`
- `documentationDiscoveryLastJobId`
- `documentationMachineIdentity` (normalized model key, optional serial,
  category, configuration fields, and user-confirmed source)

The existing `make`, `modelNumber`, and `model` fields remain authoritative.

### Jobs and review queue

`organizations/{orgId}/documentationJobs/{jobId}` and
`organizations/{orgId}/documentCandidates/{candidateId}`.

Each job and candidate records its state transitions, source evidence,
classification, verification level, reversible action, actor, and timestamps.
Candidates retain one of: `exact`, `family`, `serial_required`, `review`, or
`rejected`. A candidate cannot be used by AI while in `review`.

### Tenant attachments

`organizations/{orgId}/machineDocuments/{attachmentId}` records machine ID,
document library ID or tenant manual ID, compatibility status, approval state,
source evidence, and reversibility. Detaching removes only the attachment and
the AI eligibility flag; it never deletes a shared document.

### System-managed global library

`globalDocumentLibrary/documents/{documentId}` and
`globalDocumentLibrary/machineModels/{modelKey}` are backend-only records.
Their Storage objects live outside tenant prefixes. They hold only documents
obtained through an approved source and accepted by a system administrator.
Firestore client rules deny all direct reads and writes; Functions expose only
sanitized candidate metadata to authorized tenant reviewers.

### Audit trail

`organizations/{orgId}/documentationAuditLogs/{auditId}` is backend-written.
It stores job ID, machine ID, candidate/document ID, prior state, next state,
timestamp, evidence summary, responsible actor, and reversal reference.

## Background Workflow

1. A user creates or materially edits a machine and confirms its identifier.
2. A protected Function checks the global enable flag, organization setting,
   location/machine exclusions, and complete model information.
3. It searches the existing approved global library first.
4. If no library result exists and no provider is configured, it creates a
   reviewable job explaining that a URL submission or manual upload is needed.
5. A future provider adapter can search only allowed domains, download within
   size/time limits, verify PDF signatures, hash the file, classify it, and
   create candidates. It never auto-approves uncertain matches.
6. In Observation mode the system records what it found but downloads nothing.
   In Approval mode it queues candidates. In Automatic mode it attaches only a
   verified exact match from an approved source with no serial conflict.
7. Approved documents are copied or linked into the existing tenant manual
   path, then pass through the existing indexing/OCR workflow. Tenant Repair
   Assist remains the final retrieval layer.

## Retrieval And Classification Rules

- A source document is classified before it becomes AI eligible.
- The current indexing metadata will be extended with document type,
  applicability, source URL, revision, page, section, and verification status.
- Troubleshooting intent ranks exact error-code guides, troubleshooting,
  diagnostics, service documents, and bulletins before wiring, operator,
  installation, and parts documents.
- A part is never labeled `10/10 Verified Match` without direct OEM evidence
  for model, configuration, serial applicability where required, assembly,
  and OEM part number.
- A machine-specific answer that lacks verified source evidence must say it
  cannot be found in documentation verified for that exact machine.

## Camera And Image Extension

The current Repair Assist photo path already validates type, byte size,
signature, quantity, and normalizes browser-readable images into JPEGs. The
documentation module will add a separate `machineEvidence` workflow rather
than changing Repair Assist behavior:

- data-plate, display, part-label, wiring, QR/barcode, and damage photos;
- explicit user confirmation before a recognized identifier is saved;
- secure organization Storage path and evidence record;
- confidence and unusable-image feedback;
- visual label evidence kept separate from documentary compatibility evidence.

No vision-derived model, serial number, error code, or part number can trigger
discovery or change a machine record until the user confirms it.

## Missing External Infrastructure

1. A selected web-search provider and server-side secret. Until selected, the
   safe fallback is global-library lookup plus administrator URL submission or
   regular manual upload.
2. An approved-domain allowlist, beginning with manufacturer and authorized
   distributor domains.
3. A malware-scanning integration or documented pre-attachment scanning gate.
4. A documented retention/licensing policy for any global-library document.
5. A staging Firebase project and a backup bucket before production release.

## File-By-File Phase Plan

### Phase 2: Foundation

- `src/data.ts`: additive types for document status, candidate, attachment,
  classification, and evidence.
- `src/firebase/machines.ts`: optional normalized identity fields, no change to
  existing required inputs.
- `src/firebase/documentation.ts`: client calls for jobs, review, and safe
  machine evidence upload.
- `src/hooks/useMachineDocumentation.ts`: read-only status and review queue.
- `src/App.tsx` plus isolated styles: Documentation section on Machine Detail.
- `functions/src/documentation.ts`: pure matching, classification, transition,
  and validation helpers with fixtures.
- `functions/src/index.ts`: narrowly scoped authenticated Functions and
  machine-write trigger.
- `firestore.rules`, `storage.rules`, `firebase/rules.test.ts`: additive,
  least-privilege rules and tests.
- `firestore.indexes.json`: only indexes proven necessary by the new queries.

### Phase 3+: Discovery, Processing, Parts, And Knowledge Graph

These phases begin only after the Phase 2 review, unit tests, staging setup,
search-provider choice, and source-retention policy are approved.

## Backup, Rollback, And Removal Plan

- Before a staging or production migration, export Firestore and record the
  timestamp, target database, and Storage inventory in a release record.
- New records include `featureVersion`, `createdBy`, and job/attachment IDs so
  a rollback script can remove only feature-created records.
- Disabling requires setting `automaticDocumentationEnabled` false. It stops
  new jobs and leaves prior records visible but not AI-eligible unless approved.
- Deployment rollback is a targeted Functions/Hosting redeploy from the saved
  Git rollback commit. Existing tenant manual upload and Repair Assist remain
  unaffected.
- Feature removal first disables the flag, drains/cancels jobs, detaches
  automatic attachments, removes AI eligibility, and only then removes the
  additive code and collections under an explicitly approved data-retention
  procedure.

## Phase 1 Exit Criteria

- Current architecture and reusable components are documented.
- New data is additive and tenant isolation is preserved.
- No automatic use of uncertain documents is possible by design.
- The missing search, scanning, retention, and staging decisions are visible
  before any production behavior changes.
