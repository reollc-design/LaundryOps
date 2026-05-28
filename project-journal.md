# LaundryOps Project Journal

This file tracks build progress, decisions, and release notes for LaundryOps.

## How To Use

- Add a new dated entry at the top.
- Keep notes short and action-focused.
- Include what changed, why, and what is next.

---

## 2026-05-28

### UI, Hosting, Billing, And Account Model Updated

- Built the clickable LaundryOps web review app for mobile and desktop review.
- Deployed the app to the dedicated Firebase Hosting site:
  `https://laundryops-maintenance-app.web.app`
- Added Stripe billing Functions for Checkout, Billing Portal, and webhook subscription updates.
- Upgraded Functions runtime to Node.js 22.
- Removed the technician invite flow from launch V1.
- Updated the product rule: every user signs up, starts their own 14-day trial, and pays for their own workspace.
- Updated project docs so the roadmap no longer calls for technician invitation backend work.

### Verification

- App lint/type-check passes.
- App production build passes.
- Functions lint/type-check passes.
- Firestore rules tests pass 11/11, but the Firebase emulator wrapper still exits with a local CLI shutdown/update-check error after tests finish.

### Next

- Commit and push the current local work to GitHub.
- Add real frontend `VITE_FIREBASE_*` config values.
- Verify the full live flow: create account, create workspace, add machine, create work order, open Stripe Checkout, and confirm webhook updates Firestore.
- Build the manual upload and OpenAI Repair Assist backend.

## 2026-05-20

### Baseline Created

- Created this project journal to preserve build history across sessions.
- Initialized Git for this project and pushed first commit to GitHub:
  `https://github.com/reollc-design/LaundryOps`
- Default branch is `main`.
- Local working changes still in progress after first push (not yet committed in a follow-up push).

### Current Direction

- Continue Android-first professional product polish for laundromat owners and technicians.
- Keep AI Repair Assist grounded by uploaded machine repair manuals.
- Continue UI build flow and ship in clean, incremental updates.

### Next Update Trigger

- When new features are added, log:
  - screens changed,
  - major decisions,
  - data model or backend impact,
  - release readiness notes.
