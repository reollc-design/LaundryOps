# LaundryOps Cleanup Items

Use this as the running cleanup list before beta and before app-store packaging.

## Firebase / Deploy

- Clean up old Cloud Functions build images in Artifact Registry if Firebase keeps warning that build image cleanup failed.
- Update GitHub Actions so CI validates the Functions TypeScript build, not just the web app.
- Update GitHub Actions to require `VITE_FUNCTIONS_API_BASE_URL` or confirm `VITE_BILLING_API_BASE_URL` is intentionally used for Functions.
- Decide whether GitHub Actions should deploy Storage rules along with Hosting and Firestore rules.
- Keep targeted Functions deploys for LaundryOps backend changes; do not broad-deploy unrelated functions from this project.
- Implement actual server-side rate limiting for expensive and sensitive Cloud Functions, especially `generateRepairAssist`, `indexOrganizationManual`, `deleteOrganizationManual`, `createStripeCheckoutSession`, and `createStripeBillingPortalSession`. Headers alone do not block abuse; enforce limits with Firestore counters, App Check, Cloud Armor, or another backend gate before public launch.
- Update Firebase rules tests and manual AI setup docs to match the current manual upload Storage path.
- Before creating any new Google Cloud/Firebase project that uses Developer Connect Git repository connections, explicitly enable the Secret Manager API (`secretmanager.googleapis.com`). Starting September 21, 2026, Developer Connect will no longer auto-enable it. Existing LaundryOps projects should not need action from this notice.
- Review Firebase Authentication users before launch. `Authentication > Users` contains login identities only, not companies or machine records.
- Separate Firebase Auth users into three buckets before cleanup: keep, obvious test/delete, and inspect before deleting.
- Remember that deleting a Firebase Auth user does not automatically delete that user's Firestore organization, machines, work orders, manuals, or billing-linked data.
- Do not bulk-delete Firebase Auth users until each account is checked against Firestore ownership/membership data.

## Repair Assist / Manuals

- Smoke test real PDF manual upload from the live app.
- Smoke test `indexOrganizationManual` with a real manufacturer manual.
- Smoke test `generateRepairAssist` with a known manual error code and confirm citations come from the uploaded manual.
- Add UI visibility for `indexingStatus` so an indexed manual can show when a replacement index is processing or failed.
- Confirm OCR handling for scanned/image-based PDFs; current extraction depends on readable PDF text.
- OCR support will be added before full release.
- Keep beta manual Storage uploads role-gated. Current rule allows only owner/admin/manager users to upload a PDF under their own UID folder.
- Revisit Storage PDF validation after beta. Current beta rule may allow `.pdf` filename extension in addition to content type; true validation happens when the backend parser indexes the uploaded file.

## Beta Readiness

- Run a full beta pass: create account, add machine, upload manual, create work order, run Repair Assist, start checkout, confirm Stripe/Firebase state.
- Re-check live authorized domains and Firebase web config after each hosting/domain change.
- Show and enforce trial dates clearly. Current Lake Eustis beta org is marked trialing from May 28, 2026, which means a strict 14-day trial would have ended June 11, 2026.
- Build the full trial-expiration gate. Firebase login only proves the user's identity; the app must also check whether the user's company account is allowed to use LaundryOps. On company setup, save `trialStartedAt`, `trialEndsAt`, and `subscriptionStatus: "trialing"` on `organizations/{organizationId}`. Every time the app opens, and while the user is using it, check that company record. If today is past `trialEndsAt` and there is no active Stripe subscription, show a lock screen with only `Choose Monthly`, `Choose Annual`, `Manage Billing`, and `Sign Out`. Also enforce the lock in Firestore rules, Storage rules, and Cloud Functions so expired accounts cannot add machines, upload manuals, create work orders, or use AI Repair Assist even if they stay logged in.
- Add an in-app timer/check that locks the screen as soon as the 14-day trial passes, without requiring the user to sign out or refresh.
- Review Google Play beta packaging requirements once the web workflow is stable.
