# Manual Upload + OpenAI Repair Assist Setup

This setup enables two live backend actions:

- `indexOrganizationManual` - reads uploaded PDF manuals from Firebase Storage, chunks text, and stores manual chunks in Firestore.
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

## 3) Deploy manual + AI functions

Deploy:

- `indexOrganizationManual`
- `generateRepairAssist`

## 4) Storage + Firestore prerequisites

Manual upload uses:

- Storage path: `orgs/{orgId}/manuals/{manualId}/{fileName}`
- Firestore doc: `organizations/{orgId}/manuals/{manualId}`
- Active chunk docs: `organizations/{orgId}/manuals/{manualId}/{activeChunkCollection}/{chunkId}`

The indexer writes each new manual extraction to a fresh chunk collection first, then updates `activeChunkCollection` only after all chunks are written. Existing indexed manuals stay marked `indexed` while a replacement version is processing, so Repair Assist can keep using the last good manual if a re-index fails.

## 5) Live verification flow

1. Sign in with owner/admin/manager account.
2. Open `Manual Library`.
3. Enter machine model and upload PDF.
4. Confirm status changes to `Indexed`.
5. Open `AI Assist`, enter symptoms + error code, run `Generate Repair Guidance`.
6. Confirm grounded answer and chunk citations return.
