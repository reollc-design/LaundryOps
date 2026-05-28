# LaundryOps Project

LaundryOps is the commercial rebuild of the Maint Tracker prototype.

The goal is to create a professional Android-first subscription app for laundromat owners, operators, and service technicians to manage machine maintenance, work orders, manuals, repair costs, and AI-assisted troubleshooting.

## Project Files

- `brief.md` - approved product brief and phased build plan.
- `screen-map.md` - app navigation, screens, and user flows.
- `data-model.md` - planned app data structure, Firebase collections, roles, and permission boundaries.
- `design-direction.md` - visual style, product design rules, and mobile-first design guidance.
- `firebase-auth-architecture.md` - Firebase Auth, organization accounts, roles, trial setup, manual-grounded AI backend, and security rule plan.
- `app/firebase/` - Firebase scaffold notes, Windows setup notes, rules test plan, and automated rule tests.
- `app/functions/` - Firebase Functions for Stripe Checkout, Billing Portal, and Stripe webhook handling.
- `app/src/` - React/Vite web review app and mobile-first UI.

## Source Prototype

Original code:

`C:\Users\reoll\CODEX\projects\Maint Tracker\Maint-tracker-main`

## Current Decisions

- App name: LaundryOps
- Users: laundromat owners, operators, and service technicians
- Business model: monthly subscription with a 14-day free trial
- Platform: Android first
- AI direction: move from Gemini to OpenAI through a secure backend
- V1 account model: every user signs up, starts their own trial, and pays for their own workspace. Technician invite flows are removed from launch V1.

## Current Status

- Dedicated LaundryOps hosting target is configured for `https://laundryops-maintenance-app.web.app`.
- Firebase Functions are implemented for Stripe checkout, billing portal, and webhook updates.
- Firestore and Storage rules are in place with emulator tests.
- The web review app builds successfully and can be clicked through before Android beta testing.

## Next Step

Commit and push the current app work, then add the real Firebase web config so live auth/data calls replace the current review-mode banner.
