# LaundryOps staging architecture

Status: working-tree documentation for the staging release program.
Last reviewed: 2026-08-05.

## System structure

- `app/src/` is the React/Vite client. It owns signed-out access, onboarding screens, the authenticated workspace shell, machines, maintenance records, reports, manuals, and Repair Assist callers.
- `app/functions/src/index.ts` is the Firebase Functions entry point. It owns authenticated onboarding, machine-status transitions, manual indexing/reindexing/deletion, scheduled OCR completion, Repair Assist, Stripe Checkout, Billing Portal, and Stripe webhook processing.
- `app/firestore.rules` protects tenant documents. `app/storage.rules` protects organization-scoped manuals, machine photos, work-order attachments, exports, and backups.
- `app/firebase.staging.json` maps the staging config to the `laundryops-staging` Hosting site, `laundryops-staging.firebasestorage.app`, Firestore rules/indexes, and the Functions source.

## Primary data paths

All customer-owned documents are under `organizations/{orgId}`:

- `organizations/{orgId}` — organization profile, owner, trial/subscription status, and billing identity.
- `organizations/{orgId}/memberships/{uid}` — role and active/disabled membership state.
- `organizations/{orgId}/locations/{locationId}` — operating locations.
- `organizations/{orgId}/machines/{machineId}` — machine identity, model, status, and downtime pointers.
- `organizations/{orgId}/workOrders/{workOrderId}` — maintenance records, costs, status, notes, and photo metadata.
- `organizations/{orgId}/manuals/{manualId}` — manual metadata, indexing/OCR state, model keys, and active chunk collection names.
- `organizations/{orgId}/manuals/{manualId}/{chunkCollection}/{chunkId}` — backend-written manual text chunks and error-code index collections.
- `organizations/{orgId}/downtimePeriods/{periodId}` — backend-written downtime periods.
- `organizations/{orgId}/subscriptions/{subscriptionId}` — backend-written billing snapshots.
- `organizations/{orgId}/aiDiagnoses/{diagnosisId}`, `auditLogs`, and `backups` — backend-only records unless a rule explicitly permits read access.

Storage paths are organization-scoped under `orgs/{orgId}`. Manual PDFs are stored at `orgs/{orgId}/manuals/{uid}/{manualId}/{fileName}`. Machine photos and work-order attachments have separate paths and role checks.

## Request and data flow

1. Firebase Auth establishes the signed-in user.
2. The client reads only the selected organization through Firestore listeners. Protected writes either pass Firestore rules or call an authenticated Function.
3. Functions verify the Firebase ID token, validate document IDs and payload limits, check organization membership/role/trial access, apply rate limits, and perform server-authoritative transactions where needed. The client mirrors the same role capabilities by hiding or disabling unsupported machine, work-order, status, photo, and manual actions.
4. Machine status changes create or close downtime periods in one transaction.
5. Manual upload writes an approved PDF to Storage and a manual record to Firestore. The client, Storage rules, and backend require exact `application/pdf`, a `.pdf` or `.PDF` filename ending, and a size no greater than 25 MiB. Indexing extracts text, normalizes model/error-code aliases, and writes versioned chunk collections. Large/scanned manuals use Document AI batch OCR and a scheduled completion worker.
6. Repair Assist resolves the requested organization machine, selects exactly one indexed matching manual, ranks stored chunks, and sends bounded excerpts plus optional technician photos to OpenAI through the backend. Ambiguous duplicate manuals fail closed. Excerpts are delimited and treated as untrusted evidence; the response returns source metadata and chunk previews, and no client-side OpenAI key is used.
7. Billing uses server-side Stripe Test-mode keys and configured staging price IDs. The Functions runtime rejects any Stripe secret that is not an `sk_test_...` key before constructing a Stripe client. Checkout customer/session creation is idempotency-keyed and reserved in Firestore. Stripe webhooks verify signatures and apply ordered state transitions.

## Security boundaries

- Signed-out clients cannot read organization data.
- Organization membership and owner checks are evaluated against the requested organization path; client-supplied organization IDs are not trusted by Functions.
- Membership, billing, AI diagnosis, chunk, audit, backup, and downtime writes are backend-controlled by rules or Functions.
- Storage enforces organization path, role, content type, and size limits.
- Secrets are Firebase Secret Manager references (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`); values must never enter the client or logs.
- Staging runtime URL, CORS, and Stripe price settings are now required. Missing settings fail closed instead of falling back to production values.
- If the selected organization is missing, invalid, or no longer owned by the signed-in account, the client stops protected workspace listeners and shows a recovery state rather than creating or substituting a tenant.
- Uploaded manuals, OCR text, photos, and model output are untrusted input. Automatic internet documentation discovery remains approval-gated and is not part of the selected-manual source of truth.
- Repair Assist accepts a model response as OpenAI-grounded only when it cites a chunk ID from the selected manual; otherwise it returns the bounded manual fallback.

## Staging boundary

- Firebase project: `laundryops-staging`.
- Hosting URL: `https://laundryops-staging.web.app`.
- Functions region: `us-central1`.
- Stripe mode: Test/Sandbox only.
- The staging workflow must always pass `--config firebase.staging.json --project laundryops-staging` and target an explicit Function/resource list.
- Production defaults and production-only config are intentionally outside this staging change set. Any future production deployment must supply its own explicit runtime URL, CORS, and price settings before deployment.
