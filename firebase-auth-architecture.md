# LaundryOps Firebase and Auth Architecture

This document defines the safe backend path for LaundryOps before we put real customer data, repair manuals, work orders, or AI usage into production.

The goal is simple: every company gets its own protected account space, every user only sees what they are allowed to see, and all AI/manual work runs through a secure backend instead of exposing keys or trusted logic in the mobile app.

## What We Are Building

LaundryOps should use Firebase for:

- Sign-in and user identity.
- Company, location, machine, work order, manual, and subscription data.
- File storage for manuals, photos, invoices, and exports.
- Server-side functions for account setup, manual processing, AI Repair Assist, audit logs, backups, and billing updates.

OpenAI should be called only from the backend. The mobile app should never contain an OpenAI API key, service account key, billing webhook secret, or trusted repair-answer logic.

## Core Account Model

The main account unit is an organization. For this app, an organization means the customer company.

One organization can have:

- One owner account.
- Multiple users.
- One or more locations.
- Machines assigned to locations.
- Work orders tied to machines and locations.
- Manuals tied to machines, manufacturers, or machine types.
- One subscription record.

The recommended business model is one company subscription with one included location, then an add-on fee for each additional location. This supports single-location laundromats without overcharging them and still gives multi-location operators a clean upgrade path.

## Auth Providers

Use Firebase Authentication with:

- Email and password for all users.
- Google sign-in as an optional convenience provider.

Do not use anonymous auth for production accounts. Anonymous auth makes accountability, audit logs, subscriptions, and technician permissions harder to trust.

## Firestore Structure

Use a global user profile and keep business data under the organization.

```text
users/{userId}

organizations/{organizationId}
organizations/{organizationId}/memberships/{userId}
organizations/{organizationId}/locations/{locationId}
organizations/{organizationId}/machines/{machineId}
organizations/{organizationId}/workOrders/{workOrderId}
organizations/{organizationId}/maintenanceEvents/{eventId}
organizations/{organizationId}/manuals/{manualId}
organizations/{organizationId}/manuals/{manualId}/chunks/{chunkId}
organizations/{organizationId}/files/{fileId}
organizations/{organizationId}/aiDiagnoses/{diagnosisId}
organizations/{organizationId}/subscriptions/current
organizations/{organizationId}/auditLogs/{auditLogId}
organizations/{organizationId}/backups/{backupId}
```

This keeps customer data separated by company. It also makes it much easier to write security rules that say: if a user is not a member of this organization, they cannot read or write anything inside it.

## Roles

Start with these roles:

- Owner: full access to the organization, billing, users, locations, machines, manuals, and work orders.
- Admin: manages operations, users, locations, machines, manuals, and work orders, but does not own billing unless granted.
- Manager: manages assigned locations, machines, and work orders.
- Technician: sees assigned locations, assigned work orders, machine details, repair history, and manual-backed AI help.
- Viewer: read-only access for reports and history.
- Support: temporary internal support access, granted and audited through backend logic only.

For permissions, store role and location access in:

```text
organizations/{organizationId}/memberships/{userId}
```

Recommended fields:

```text
role
status
allowedLocationIds
createdAt
createdBy
lastActiveAt
```

Use custom claims lightly. They are useful for fast checks like platform support status, but they are not the best place to manage changing location-level permissions. Firestore membership documents are easier to update, audit, and reason about.

## Owner Onboarding

When a new owner starts a 14-day free trial, the backend should create the account in one controlled flow:

1. Create the Firebase Auth user.
2. Create `users/{userId}`.
3. Create `organizations/{organizationId}`.
4. Create `organizations/{organizationId}/memberships/{userId}` with role `owner`.
5. Create the first location.
6. Create `organizations/{organizationId}/subscriptions/current` with status `trialing`.
7. Set `trialStartedAt` and `trialEndsAt`.
8. Create the first audit log entry.

The trial should be baked into the backend subscription record, not just shown in the UI.

Recommended subscription fields:

```text
status: trialing
plan: pro
trialStartedAt
trialEndsAt
includedLocations: 1
activeLocationCount
subscriptionProvider
providerCustomerId
providerSubscriptionId
cancelAt
currentPeriodEnd
updatedAt
```

## Individual Account Flow For V1

Launch V1 does not include technician invitations.

Every user who wants LaundryOps creates their own account, starts their own 14-day free trial, and pays for their own subscription. A repair technician can still use LaundryOps, but they use it as their own paying workspace, not as a free invited user inside someone else's account.

This keeps launch simpler:

1. One signup path.
2. One company workspace per paying account.
3. One subscription owner.
4. No invite tokens, invite acceptance screens, or cross-company join risk.
5. Team seats can be reconsidered later as a paid upgrade.

## Location Access

Machines and work orders should include `locationId`.

Rules and backend checks should use that field to decide whether a manager or technician can access the record. A technician assigned to Location A should not be able to view Location B machines, manuals, photos, or work orders unless the owner grants that access.

## Manual-Grounded AI

Manual-backed AI is one of the biggest reasons LaundryOps can win. It should feel trustworthy because answers come from the customer-uploaded manuals, not generic web knowledge.

Recommended flow:

1. Owner, admin, or approved manager uploads a manual.
2. Manual PDF is stored in Firebase Storage.
3. Firestore creates a manual record.
4. Backend extracts the text.
5. Backend chunks the manual into searchable sections.
6. Chunks are stored under the manual record.
7. AI Repair Assist receives a machine, symptom, error code, and work order context.
8. Backend finds the most relevant manual chunks.
9. Backend calls OpenAI with the selected manual context.
10. Backend saves the diagnosis with cited manual sections and grounding status.
11. Mobile app displays the answer with source/manual references.

The app should clearly label whether an answer is manual-grounded. If the system cannot find a relevant manual section, it should say that and give a lower-confidence answer or ask the user to upload the manual.

## Client Should Never Write These Directly

The mobile app should not directly write:

- Audit logs.
- Subscription provider IDs.
- Subscription status changes.
- AI usage totals and cost fields.
- Manual chunks.
- Search indexes.
- Backup records.
- Restore records.
- Server trust fields like `createdByRole`, `sourceVerified`, or `billingVerified`.

Those fields should be written by Cloud Functions or another trusted backend service.

## Draft Firestore Rules Shape

This is not final code. It is the shape the rule set should follow.

```text
default: deny everything

allow signed-in users to read and update their own user profile

allow organization reads only when the user is an active member

allow owner/admin to manage locations
allow manager to read assigned locations
allow technician to read assigned locations

allow owner/admin to manage machines
allow manager/technician to read machines in assigned locations
allow technician to update limited machine status fields only when assigned

allow owner/admin/manager to create work orders
allow technician to read and update assigned work orders in assigned locations

allow owner/admin to upload and manage manuals
allow manager/technician to read manuals connected to assigned locations or assigned machines
deny all client writes to manual chunks

allow owner to read subscription status
deny all client writes to subscription provider fields

deny all client writes to audit logs
```

The rule tests need to prove that one customer cannot read another customer's data.

## Draft Storage Rules Shape

Recommended storage paths:

```text
orgs/{organizationId}/manuals/{manualId}/{fileName}
orgs/{organizationId}/machines/{machineId}/photos/{fileName}
orgs/{organizationId}/workOrders/{workOrderId}/attachments/{fileName}
orgs/{organizationId}/exports/{exportId}/{fileName}
orgs/{organizationId}/backups/{backupId}/{fileName}
```

Storage access should follow Firestore membership checks:

- Only signed-in organization members can read allowed organization files.
- Manual uploads should be limited to owner, admin, and approved manager roles.
- Work order attachments should be limited by location and assignment.
- Machine photos should be limited by location access.
- Client writes to exports and backups should be denied unless explicitly handled by trusted backend logic.

## Backend Functions To Build

Build these backend functions before trusting the app with live customers:

- `createOrganizationTrial`: creates the owner, organization, first location, membership, subscription trial, and audit log.
- `processManualUpload`: extracts manual text, chunks it, and prepares it for search.
- `runRepairAssist`: retrieves relevant manual sections, calls OpenAI, and stores the result.
- `createWorkOrderFromDiagnosis`: lets AI output become a real work order with human confirmation.
- `updateSubscriptionFromBillingWebhook`: updates subscription status from the billing provider.
- `writeAuditLog`: records important account, billing, permission, and maintenance events.
- `createBackup`: creates organization-level exports/backups through trusted backend code.

## Build Order

1. Create Firebase project and separate development/production environments.
2. Enable Firebase Auth with email/password and Google sign-in.
3. Add Firestore, Storage, Functions, and App Check.
4. Create local emulator setup.
5. Add the base collections and sample organization seed data.
6. Write Firestore and Storage security rules.
7. Write rule tests for org separation, roles, location access, manuals, billing, and audit logs.
8. Wire the mobile app to Firebase Auth.
9. Add owner trial creation.
10. Connect machines and work orders to Firestore.
11. Add secure file uploads.
12. Add manual processing.
13. Add OpenAI Repair Assist through the backend.
14. Add billing/trial enforcement.

## Security Test Checklist

Before launch, prove these cases:

- Signed-out users cannot read app data.
- A user in Company A cannot read Company B data.
- A technician cannot see unassigned locations.
- A technician cannot edit billing or subscription data.
- A manager cannot change owner permissions.
- A viewer cannot write operational records.
- Manual chunks cannot be edited from the mobile app.
- AI usage and cost records cannot be edited from the mobile app.
- Audit logs cannot be edited from the mobile app.
- Subscription provider fields can only be changed by backend code.
- Work order attachments cannot be read by users outside the organization.
- Machine photos cannot be read by users without location access.

## Environment and Secrets

The Firebase web/mobile config can be included in the app. It identifies the Firebase project, but it is not the same as an admin secret.

Never put these in the mobile app:

- Firebase service account key.
- OpenAI API key.
- Billing webhook secret.
- Admin SDK credentials.
- Private storage signing keys.

Use Google Secret Manager or protected Cloud Function environment variables for server-only secrets.

## Open Decisions

These do not block the architecture, but they should be decided before launch:

- Billing path: Google Play Billing, Stripe, or a hybrid model.
- Exact monthly price.
- Exact additional-location fee.
- Whether Google sign-in is optional or required.
- Whether internal support access is allowed, and what approval/audit process controls it.
- How long manual uploads, work order photos, and backups are retained after cancellation.

## Recommended Next Step

Implement the Firebase project foundation and local emulator setup, then write the first version of the security rules and rule tests before connecting the production mobile UI to real customer data.
