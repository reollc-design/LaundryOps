# LaundryOps Cleanup Items

Use this as the running cleanup list before beta and before app-store packaging.

## Firebase / Deploy

- Clean up old Cloud Functions build images in Artifact Registry if Firebase keeps warning that build image cleanup failed.
- Update GitHub Actions so CI validates the Functions TypeScript build, not just the web app.
- Update GitHub Actions to require `VITE_FUNCTIONS_API_BASE_URL` or confirm `VITE_BILLING_API_BASE_URL` is intentionally used for Functions.
- Decide whether GitHub Actions should deploy Storage rules along with Hosting and Firestore rules.
- Keep targeted Functions deploys for LaundryOps backend changes; do not broad-deploy unrelated functions from this project.
- Update Firebase rules tests and manual AI setup docs to match the current manual upload Storage path.

## Repair Assist / Manuals

- Smoke test real PDF manual upload from the live app.
- Smoke test `indexOrganizationManual` with a real manufacturer manual.
- Smoke test `generateRepairAssist` with a known manual error code and confirm citations come from the uploaded manual.
- Add UI visibility for `indexingStatus` so an indexed manual can show when a replacement index is processing or failed.
- Confirm OCR handling for scanned/image-based PDFs; current extraction depends on readable PDF text.
- OCR support will be added before full release.
- Revisit Storage PDF validation after beta. Current beta rule may allow `.pdf` filename extension in addition to content type; true validation happens when the backend parser indexes the uploaded file.

## Beta Readiness

- Run a full beta pass: create account, add machine, upload manual, create work order, run Repair Assist, start checkout, confirm Stripe/Firebase state.
- Re-check live authorized domains and Firebase web config after each hosting/domain change.
- Show and enforce trial dates clearly. Current Lake Eustis beta org is marked trialing from May 28, 2026, which means a strict 14-day trial would have ended June 11, 2026.
- Review Google Play beta packaging requirements once the web workflow is stable.
