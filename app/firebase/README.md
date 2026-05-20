# LaundryOps Firebase Foundation

This folder tracks the Firebase backend setup for the LaundryOps app.

The app now has local Firebase scaffold files at the app root:

- `firebase.json` - Firebase emulator and rules configuration.
- `.firebaserc.example` - safe example project alias using a demo project ID.
- `firestore.rules` - first pass account, role, location, manual, billing, AI, and audit-log rules.
- `storage.rules` - first pass file access rules for manuals, machine photos, work order attachments, exports, and backups.
- `firestore.indexes.json` - empty starter index file.
- `firebase/rules.test.ts` - automated emulator tests for the highest-risk security cases.
- `src/firebase/client.ts` - Firebase app/auth/firestore/storage client bootstrap with optional emulator routing.
- `src/firebase/auth.ts` - shared auth actions for sign-in, owner account creation, and sign-out.
- `src/hooks/useAuthSession.ts` - auth session subscription hook for UI state.
- `.env.example` - required Vite environment keys for Firebase web client setup.
- `.tools/jdk11/` - local bundled JDK used only for Firebase emulator commands in this workspace.
- `.firebase-local-emulators/` - local cache path for downloaded emulator binaries inside the workspace.

## Current Status

This is a local foundation only. It does not connect the app to a live Firebase project yet.

That is intentional. The rules now run against local emulators using the bundled workspace JDK and pass in automation.

## Recommended Project IDs

Use separate Firebase projects:

- `laundryops-dev` for development.
- `laundryops-prod` for production.

Do not put production data in the dev project.

## Secrets

Never put these in the mobile app:

- Firebase service account keys.
- OpenAI API keys.
- Billing webhook secrets.
- Admin SDK credentials.

The Firebase web config is allowed in the app later, but server secrets belong in Cloud Functions, Cloud Run, or Google Secret Manager.

## Next Build Step

Run `npm.cmd run test:rules` from the app folder.

After rule tests pass, copy `.firebaserc.example` to `.firebaserc`, replace the demo project ID with the real development Firebase project ID, and run the Auth, Firestore, Storage, and Emulator UI locally.
