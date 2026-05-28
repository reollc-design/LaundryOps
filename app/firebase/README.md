# LaundryOps Firebase Foundation

This folder tracks the Firebase backend setup for the LaundryOps app.

The app now has local Firebase scaffold files at the app root:

- `firebase.json` - Firebase emulator and rules configuration.
- `.firebaserc` - real Firebase project and dedicated LaundryOps hosting target.
- `.firebaserc.example` - safe example project alias using a demo project ID.
- `firestore.rules` - first pass account, role, location, manual, billing, AI, and audit-log rules.
- `storage.rules` - first pass file access rules for manuals, machine photos, work order attachments, exports, and backups.
- `firestore.indexes.json` - empty starter index file.
- `firebase/rules.test.ts` - automated emulator tests for the highest-risk security cases.
- `src/firebase/client.ts` - Firebase app/auth/firestore/storage client bootstrap with optional emulator routing.
- `src/firebase/auth.ts` - shared auth actions for sign-in, owner account creation, and sign-out.
- `src/firebase/manuals.ts` - manual upload + index + Repair Assist function callers.
- `src/hooks/useAuthSession.ts` - auth session subscription hook for UI state.
- `src/hooks/useOrganizationManuals.ts` - live manual collection subscription hook.
- `.env.example` - required Vite environment keys for Firebase web client setup.
- `functions/src/index.ts` - Stripe billing endpoints (Checkout + Billing Portal) and webhook scaffold.
- `firebase/stripe-setup.md` - Stripe dashboard + key + webhook setup guide.
- `firebase/manual-ai-setup.md` - setup guide for manual indexing and OpenAI-backed Repair Assist.
- `firebase/beta-test-checklist.md` - launch-critical beta test checklist.
- `.tools/jdk11/` - local bundled JDK used only for Firebase emulator commands in this workspace.
- `.firebase-local-emulators/` - local cache path for downloaded emulator binaries inside the workspace.

## Current Status

The app now has a real Firebase project connection for hosting and deployed Stripe billing Functions.

Current live pieces:

- Firebase project: `laundromat-maintenance-app`.
- Dedicated LaundryOps hosting site: `https://laundryops-maintenance-app.web.app`.
- Hosting target: `laundryops`.
- Deployed Functions: `createStripeCheckoutSession`, `createStripeBillingPortalSession`, and `stripeWebhook`.
- Functions runtime: Node.js 22.

The rules run against local emulators using the bundled workspace JDK. The Vitest rules suite passes 11/11, though the Firebase CLI wrapper can still return a local shutdown/update-check error after the tests complete.

## Current Hosting Rule

Use the dedicated LaundryOps hosting site for this app:

- `https://laundryops-maintenance-app.web.app`

Do not deploy LaundryOps over the older default hosting site unless that is intentional.

## Secrets

Never put these in the mobile app:

- Firebase service account keys.
- OpenAI API keys.
- Billing webhook secrets.
- Admin SDK credentials.

The Firebase web config is allowed in the app later, but server secrets belong in Cloud Functions, Cloud Run, or Google Secret Manager.

## Next Build Step

Deploy and verify the manual + AI functions:

1. `indexOrganizationManual`
2. `generateRepairAssist`
3. Set `OPENAI_API_KEY` in Firebase secrets.
4. Run the checklist in `firebase/beta-test-checklist.md`.
