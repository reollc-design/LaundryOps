# LaundryOps Project

LaundryOps is the commercial rebuild of the Maint Tracker prototype.

The goal is to create a professional Android-first subscription app for laundromat owners and technicians to manage machine maintenance, work orders, manuals, repair costs, and AI-assisted troubleshooting.

## Project Files

- `brief.md` - approved product brief and phased build plan.
- `screen-map.md` - app navigation, screens, and user flows.
- `data-model.md` - planned app data structure, Firebase collections, roles, and permission boundaries.
- `design-direction.md` - visual style, product design rules, and mobile-first design guidance.
- `firebase-auth-architecture.md` - Firebase Auth, organization accounts, roles, trial setup, manual-grounded AI backend, and security rule plan.
- `app/firebase/` - Firebase scaffold notes, Windows setup notes, rules test plan, and automated rule tests.

## Source Prototype

Original code:

`C:\Users\reoll\CODEX\projects\Maint Tracker\Maint-tracker-main`

## Current Decisions

- App name: LaundryOps
- Users: laundromat owners and laundromat technicians
- Business model: monthly subscription
- Platform: Android first
- AI direction: move from Gemini to OpenAI through a secure backend

## Next Step

Copy `.firebaserc.example` to `.firebaserc`, set the real Firebase development project ID, and wire the app auth/data layer after the local rule tests that now pass in emulator.
