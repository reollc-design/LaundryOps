# Manual Upload + OCR + OpenAI Repair Assist Setup

This setup enables two live backend actions:

- `indexOrganizationManual` - reads uploaded PDF manuals from Firebase Storage, runs the appropriate text/OCR path, chunks text, and stores manual chunks in Firestore.
- `completeManualOcrJobs` - checks Document AI batch jobs for larger manuals and activates their indexed text only after every OCR shard is ready.
- `generateRepairAssist` - builds repair guidance from indexed manual chunks, then uses OpenAI when `OPENAI_API_KEY` is configured.

## 1) Frontend env value

In app `.env` for web builds, set:

- `VITE_FUNCTIONS_API_BASE_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net`

`VITE_BILLING_API_BASE_URL` can remain for billing. Both may point to the same Functions host.

## 2) Enable OpenAI responses for live Repair Assist

Manual indexing works without OpenAI, but live Repair Assist requires OpenAI before beta testing.

To enable model-generated answers, provide:

- `OPENAI_API_KEY`

Optional model override:

- `OPENAI_MANUAL_MODEL=gpt-5.5`

If `OPENAI_API_KEY` is missing, Repair Assist cannot generate guidance. Set the Firebase secret before deploying the live assistant.

## 3) Configure Document OCR

LaundryOps uses one Google Document AI **Enterprise Document OCR** processor in `us`.

Set these Firebase Function parameters during deployment:

- `DOCUMENT_AI_OCR_PROCESSOR_ID` - the processor ID only; this is configuration, not a secret.
- `DOCUMENT_AI_OCR_LOCATION=us` - defaulted in code.

The deployed Functions service account needs `roles/documentai.apiUser`. The Document AI service agent needs Storage object read/write access to the LaundryOps bucket so it can read the uploaded PDF and write temporary OCR output. The app cleans up temporary OCR output and any temporary split-PDF inputs after a successful or terminally failed index.

New manuals are OCR-indexed once at upload time. Later re-indexing reuses the already stored OCR chunks, so it does not create a second OCR charge for the same PDF. Manuals with more than 30 pages enter a background Document AI queue; the operator may leave the app while it finishes. A manual over Document AI's 500-page per-PDF batch limit is split into ordered temporary 500-page PDFs. The scheduler intentionally starts one batch at a time across LaundryOps, then combines all completed parts in original page order before the new manual index becomes active. This is deliberately below Google’s concurrent-batch limit.

## 4) Deploy manual + AI functions

Deploy:

- `indexOrganizationManual`
- `completeManualOcrJobs`
- `generateRepairAssist`

## 5) Storage + Firestore prerequisites

Manual upload uses:

- Storage path: `orgs/{orgId}/manuals/{userId}/{manualId}/{fileName}`
- Firestore doc: `organizations/{orgId}/manuals/{manualId}`
- Active chunk docs: `organizations/{orgId}/manuals/{manualId}/{activeChunkCollection}/{chunkId}`

`userId` is the UID of the signed-in uploader. The web client creates the Firestore manual document first, then uploads the PDF under that user's UID and the new manual document ID. Storage rules allow owner, admin, and manager roles to upload only inside their own UID folder while the organization is active. The current beta upload guard is 25 MB and should display a clear warning for larger files; within that file-size policy the pipeline supports any page count. Other active organization members may read a manual, but client-side deletion is denied; `deleteOrganizationManual` performs trusted backend cleanup.

The indexer accepts only this organization-scoped shape and verifies that the `orgId` and `manualId` in the Storage path match the Firestore manual being indexed. The Firestore manual document stores the exact path in its `storagePath` field.

The indexer writes each new manual extraction to a fresh chunk collection first, then updates `activeChunkCollection` only after all chunks are written. Existing indexed manuals stay marked `indexed` while a replacement version is processing, so Repair Assist can keep using the last good manual if a re-index fails.

## 6) Live verification flow

1. Sign in with owner/admin/manager account.
2. Open `Manual Library`.
3. Enter machine model and upload PDF.
4. Confirm small manuals change to `Indexed`; manuals over 30 pages may show `Processing` while Document AI completes in the background. A terminal OCR failure retains the prior active index when one exists and records a clear failed state rather than remaining in `Processing` indefinitely.
5. Open `AI Assist`, enter symptoms + error code, run `Generate Repair Guidance`.
6. Confirm grounded answer and chunk citations return.
