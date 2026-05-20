# LaundryOps Brief

Date: 2026-05-15
Project folder: `C:\Users\reoll\CODEX\projects\LaundryOps`
Source prototype: `C:\Users\reoll\CODEX\projects\Maint Tracker\Maint-tracker-main`

## What We Are Building

LaundryOps is a professional Android-first app for laundromat maintenance operations.

The app helps laundromat owners and technicians keep machines running, track repairs, manage work orders, diagnose issues with AI, store machine manuals, and understand which machines are costing the most money.

The current Maint Tracker app is the prototype. LaundryOps is the commercial version.

The finished product should feel like a serious operating tool, not a hobby tracker. It should be clean, fast, mobile-first, secure, and useful on the floor of a laundromat.

## Who It Is For

### Primary Users

Laundromat owners and operators who need to:

- Know which machines are down, under repair, or operating.
- Track repair history by machine.
- Control maintenance costs.
- Reduce downtime.
- Decide when to repair or replace machines.
- Keep records organized across one or more locations.

### Secondary Users

Laundromat technicians and maintenance staff who need to:

- See assigned repair work.
- Log what was done.
- Add notes, photos, costs, and parts used.
- Search machine manuals.
- Use AI to troubleshoot problems faster.
- Update machine status while on site.

## Why It Wins

LaundryOps wins because most small laundromat operators manage maintenance with paper notes, text messages, memory, spreadsheets, or scattered photos. That creates lost history, repeated repairs, unclear costs, and slow decisions.

LaundryOps gives owners one place to see the health of the business-critical equipment.

The strongest selling points:

- Faster repair decisions.
- Less machine downtime.
- Cleaner maintenance records.
- Better visibility into repair costs.
- AI troubleshooting tied to uploaded manuals.
- Camera-based visual diagnosis.
- Machine-level history and replacement intelligence.
- Mobile-first workflow for real laundromat use.

## Product Positioning

LaundryOps is not just a maintenance log.

Position it as:

> The maintenance command center for laundromat owners who want fewer breakdowns, faster repairs, and better control of machine costs.

Tone:

- Practical.
- Professional.
- Operator-focused.
- No hype.
- Built for real-world maintenance work.

## Business Model

Monthly subscription.

Recommended initial pricing:

- Starter: $19/month for one location, basic machine tracking, work orders, and reports.
- Pro: $49/month for AI diagnosis, manual search, photo uploads, advanced reports, and multiple users.
- Multi-location: $99+/month for multiple laundromats, location-level reporting, admin roles, and higher AI usage.

Offer a 14-day free trial.

Important decision for later:

- If subscriptions are sold inside the Android app, Google Play Billing may be required.
- If this is sold as a web/SaaS subscription with an Android companion app, the billing flow and Play policy approach may differ.

## Platform Direction

Android first.

Recommended technical path:

- Keep React/Vite as the app foundation.
- Rebuild the interface mobile-first.
- Wrap the app with Capacitor for Android.
- Use Firebase for authentication, database, storage, and backend functions.
- Move AI features to OpenAI through a secure backend, not direct frontend calls.
- Publish through Google Play using an Android App Bundle (`.aab`).

## AI Direction

Move from Gemini to OpenAI.

AI should not be a gimmick. It should be framed as a practical repair assistant.

Important product rule:
Repair Assist should be grounded in uploaded factual repair manuals for each machine type whenever a matching manual exists. The goal is to avoid generic AI answers. The UI should make this visible by showing whether a linked manual was used and by citing the manual page or section when possible.

Recommended AI features:

- Text-based troubleshooting for a selected machine.
- Photo-based diagnosis using the phone camera.
- Manual-aware answers using uploaded technical manuals.
- Suggested likely cause.
- Suggested parts to inspect or order.
- Step-by-step repair guidance.
- Safety warnings.
- Option to save AI diagnosis directly as a work order.
- Clear confidence language when the answer is uncertain.

AI calls should run through Firebase Cloud Functions or Cloud Run, not directly from the Android/web client.

## Core Screens

### 1. Onboarding

Purpose:
Set up the owner account, business, first location, and first machine.

Must include:

- Create account / sign in.
- Business name.
- Location setup.
- Add first machine.
- Invite technician option.

### 2. Login

Purpose:
Secure account access.

Must include:

- Email/password or Google sign-in.
- Forgot password.
- Loading state.
- Error handling.

### 3. Home / Command Center

Purpose:
Show what needs attention right now.

Must include:

- Fleet health score.
- Machines down.
- Machines needing repair.
- Open work orders.
- Recent activity.
- Quick actions: Add machine, scan machine, create work order, ask AI.

### 4. Machines

Purpose:
Manage all washers and dryers.

Must include:

- Search.
- Filter by status, location, type, make/model.
- Machine cards or compact list.
- Status controls.
- Add/edit machine.
- Machine photo.
- QR code support.

### 5. Machine Detail

Purpose:
Give a complete view of one machine.

Must include:

- Machine number.
- Status.
- Make/model.
- Location.
- Photo.
- Current open issue.
- Maintenance timeline.
- Lifetime repair cost.
- Manuals.
- AI diagnosis history.
- Add work order button.

### 6. Work Orders

Purpose:
Replace simple maintenance records with a professional repair workflow.

Must include:

- Issue reported.
- Status: open, assigned, in progress, waiting on parts, completed.
- Assigned technician.
- Symptoms.
- Error code.
- Photos.
- AI diagnosis.
- Parts used.
- Labor cost.
- Other cost.
- Completion notes.
- Date completed.

### 7. AI Repair Assist

Purpose:
Help owners and technicians troubleshoot faster.

Must include:

- Select machine.
- Enter symptoms.
- Add error code.
- Upload/capture photo.
- Use matching technical manual when available.
- Generate diagnosis.
- Save result as work order.

### 8. Manuals

Purpose:
Store and search machine manuals.

Must include:

- Upload PDF.
- Assign manual to make/model.
- Extract text server-side.
- Search manual.
- AI citation support.
- Delete/replace manual.

### 9. Reports

Purpose:
Help owners make better repair and replacement decisions.

Must include:

- Repair spend by machine.
- Downtime by machine.
- Repeat failures.
- Cost by make/model.
- Preventive maintenance status.
- Replace or repair score.
- Monthly spend.
- Export report.

### 10. Settings / Admin

Purpose:
Manage the account and business setup.

Must include:

- Business profile.
- Locations.
- Users.
- Roles.
- Subscription.
- Data export.
- Privacy/data deletion request.
- App support.

## Must-Have Features For Version 1

These are required for a serious first launch:

- Secure login.
- Organization/account-based data separation.
- Add/edit machines.
- Machine status tracking.
- Machine detail page.
- Work orders.
- Maintenance timeline.
- Parts/labor/other cost tracking.
- Photo upload.
- OpenAI repair assistant.
- Manual upload and searchable manual text.
- Dashboard command center.
- Reports.
- Android packaging.
- Privacy policy.
- Data safety disclosures.
- Subscription plan structure.

## Features To Save For Later

These are valuable, but not required for version 1:

- Parts inventory.
- Vendor management.
- Technician route planning.
- Push notifications.
- Preventive maintenance schedules.
- Multi-location benchmarking.
- Replacement forecasting.
- Integrations with accounting software.
- Owner web dashboard.
- White-label version for repair companies.

## Launch Requirements

### Product Requirements

- The app must look professional on Android phones.
- The core workflow must be fast: open app, see issues, update machine, create work order.
- The app must work with real laundromat data, not only demo data.
- Empty states must help the user take the next action.
- No prototype-looking UI elements.
- No emoji-based interface.

### Security Requirements

- Firestore rules must not allow public read/write.
- Every record must belong to an organization.
- Users must only access their authorized organization.
- Roles must control permissions.
- AI calls must happen server-side.
- Firebase App Check should protect backend resources.
- Deletes, restores, imports, and status changes should be logged.

### Google Play Requirements

- Android app must target the required current API level. Current Google Play guidance says new apps and updates must target Android 15 / API level 35 or higher starting August 31, 2025.
- Google Play publishing should use Android App Bundle (`.aab`) format.
- App must include a privacy policy.
- Play Console Data safety section must be completed.
- Camera and file permissions must be clearly justified.
- App must meet Android core app quality expectations for stability, performance, visual quality, and responsive layouts.

Current references:

- Google Play target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- User data policy: https://support.google.com/googleplay/android-developer/answer/9888076
- Android app bundles: https://developer.android.com/guide/app-bundle
- Firebase App Check: https://firebase.google.com/docs/app-check

## Phased Build Plan

### Phase 1: Product And Design Foundation

Goal:
Define the product clearly and design the new app before rebuilding.

Work:

- Finalize product brief.
- Create screen map.
- Define app roles.
- Define data model.
- Create visual direction.
- Generate design concepts.
- Approve final design system.

Deliverables:

- `brief.md`
- Screen map
- Data model outline
- Design concept images
- Design system notes

### Phase 2: UI Rebuild

Goal:
Replace the prototype interface with a professional mobile-first app shell.

Work:

- Build new app shell.
- Build bottom navigation.
- Build dashboard command center.
- Build machines list.
- Build machine detail.
- Build work order screens.
- Build reports layout.
- Build settings/admin layout.
- Replace emoji icons with real icons.

Deliverables:

- Redesigned React UI
- Mobile screenshots
- Desktop/tablet sanity check
- Clean visual QA pass

### Phase 3: Production Backend

Goal:
Make the app secure and account-based.

Work:

- Add Firebase Authentication.
- Create organization/location/user model.
- Update Firestore collections.
- Write locked-down Firestore rules.
- Add Firebase Storage for photos and manuals.
- Add App Check.
- Add audit logging.

Deliverables:

- Secure data model
- Auth flow
- Firestore rules
- Storage rules
- Backend verification notes

### Phase 4: OpenAI Repair Assistant

Goal:
Move AI from client-side Gemini to server-side OpenAI.

Work:

- Add OpenAI backend endpoint.
- Build text diagnosis.
- Build photo diagnosis.
- Add manual-aware answers.
- Add source/citation behavior.
- Save AI results to work orders.
- Add usage tracking.

Deliverables:

- OpenAI repair assistant
- Manual-based diagnosis
- Work order save flow
- AI usage safeguards

### Phase 5: Android Build

Goal:
Package LaundryOps for Android.

Work:

- Add Capacitor.
- Configure Android project.
- Add app icon and splash screen.
- Configure camera/file permissions.
- Test on Android emulator/device.
- Build Android App Bundle.

Deliverables:

- Android project
- `.aab` build
- Store-ready icon/splash assets
- Android test notes

### Phase 6: Subscription And Launch Prep

Goal:
Prepare the app for sale.

Work:

- Choose billing implementation.
- Add subscription state.
- Add trial/plan screens.
- Write privacy policy.
- Complete Data safety answers.
- Prepare Google Play listing.
- Create store screenshots.
- Run closed testing.

Deliverables:

- Subscription flow
- Privacy policy draft
- Play listing copy
- Store screenshots
- Closed test build

## Success Criteria

LaundryOps is ready for launch when:

- It looks like a paid professional app.
- It runs cleanly on Android.
- Owners can manage machines and work orders.
- Technicians can update repairs from the floor.
- AI diagnosis works through OpenAI securely.
- Manuals can be uploaded and searched.
- Data is protected by account and role.
- Google Play requirements are satisfied.
- The app has a clear monthly subscription offer.

## Immediate Next Step

Create the first polished mobile design concept.

Planning files now created:

- `screen-map.md`
- `data-model.md`
- `design-direction.md`

Recommended next deliverable:

- Mobile concept for the Home / Command Center screen.
- Mobile concept for Machine Detail.
- Mobile concept for Work Order Detail.
- Mobile concept for AI Repair Assist.
