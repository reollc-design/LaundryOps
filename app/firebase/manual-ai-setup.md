# Manual Upload + OpenAI Repair Assist Setup

This setup enables two live backend actions:

- `indexOrganizationManual` - reads uploaded PDF manuals from Firebase Storage, chunks text, and stores manual chunks in Firestore.
- `generateRepairAssist` - builds repair guidance from indexed manual chunks, then uses OpenAI when `OPENAI_API_KEY` is configured.

## 1) Frontend env value

In app `.env` for web builds, set:

- `VITE_FUNCTIONS_API_BASE_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net`

`VITE_BILLING_API_BASE_URL` can remain for billing. Both may point to the same Functions host.

## 2) Enable OpenAI responses (optional for first rollout)

Manual indexing works without OpenAI.

To enable model-generated answers, provide:

- `OPENAI_API_KEY`

Optional model override:

- `OPENAI_MANUAL_MODEL=gpt-4.1-mini`

If `OPENAI_API_KEY` is missing, Repair Assist returns manual-based fallback guidance.

## 3) Deploy manual + AI functions

Deploy:

- `indexOrganizationManual`
- `generateRepairAssist`

## 4) Storage + Firestore prerequisites

Manual upload uses:

- Storage path: `orgs/{orgId}/manuals/{manualId}/{fileName}`
- Firestore doc: `organizations/{orgId}/manuals/{manualId}`
- Chunk docs: `organizations/{orgId}/manuals/{manualId}/chunks/{chunkId}`

## 5) Live verification flow

1. Sign in with owner/admin/manager account.
2. Open `Manual Library`.
3. Enter machine model and upload PDF.
4. Confirm status changes to `Indexed`.
5. Open `AI Assist`, enter symptoms + error code, run `Generate Manual Answer`.
6. Confirm grounded answer and chunk citations return.
