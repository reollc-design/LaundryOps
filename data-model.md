# LaundryOps Data Model Outline

Date: 2026-05-15
Project: LaundryOps
Source brief: `C:\Users\reoll\CODEX\projects\LaundryOps\brief.md`
Source prototype: `C:\Users\reoll\CODEX\projects\Maint Tracker\Maint-tracker-main`

## Purpose

This data model turns the Maint Tracker prototype into a production-ready structure for LaundryOps.

The prototype currently stores machines, maintenance records, manuals, and local checkpoints. LaundryOps needs a stronger model because it will be a paid Android-first subscription app used by real laundromat owners and technicians.

The production model must support:

- Multiple businesses.
- One or more laundromat locations per business.
- Owners, managers, technicians, and support users.
- Secure separation between customers.
- Work orders instead of simple repair notes.
- Machine history and cost reporting.
- Photos, files, and manuals.
- OpenAI repair assistance through a secure backend.
- Monthly subscriptions.
- Audit logs, backups, and restore points.

The guiding rule is simple: every business record belongs to an organization, and users only see the organizations they are allowed to access.

## Main Business Objects

### Organizations

An organization is the customer account.

For a single-store owner, the organization is that owner's laundromat business. For a multi-location operator, the organization owns all locations, users, machines, work orders, billing, and reports.

Key fields:

- `organizationId`: unique ID.
- `name`: business name.
- `ownerUserId`: primary owner.
- `status`: active, trialing, suspended, cancelled.
- `defaultCurrency`: usually USD.
- `timezone`: used for reports and work order dates.
- `createdAt`, `updatedAt`.

Why it matters:

- Keeps each customer's data separate.
- Gives billing one clear customer account.
- Allows future multi-location plans.

### Locations

A location is one laundromat store or operating site.

Key fields:

- `locationId`: unique ID.
- `organizationId`: parent business.
- `name`: store name or nickname.
- `address`: street, city, state, ZIP.
- `phone`: optional store phone.
- `timezone`: optional override.
- `status`: active, inactive.
- `createdAt`, `updatedAt`.

Why it matters:

- Owners can see machine health by store.
- Technicians can filter work by location.
- Reports can compare repair costs across locations later.

### Users And Roles

Users are people who can sign in. A user's role is defined by their membership in an organization, not by the user account alone.

Recommended roles:

- `owner`: full control over the business, billing, locations, users, and data export.
- `admin`: manages locations, machines, users, and reports, but may not own billing.
- `manager`: manages daily operations, work orders, and machines for assigned locations.
- `technician`: sees assigned work, updates work orders, uploads photos, and uses AI repair assist.
- `viewer`: read-only access for accountants, investors, or outside support.
- `support`: internal LaundryOps support access, time-limited and logged.

User profile key fields:

- `userId`: Firebase Auth UID.
- `displayName`.
- `email`.
- `phone`.
- `photoUrl`.
- `defaultOrganizationId`.
- `createdAt`, `lastLoginAt`.

Membership key fields:

- `organizationId`.
- `userId`.
- `role`.
- `allowedLocationIds`: optional location limits.
- `status`: invited, active, disabled.
- `invitedBy`, `invitedAt`, `acceptedAt`.

Why it matters:

- A technician can work for one organization without seeing another.
- A multi-location business can limit staff to certain locations.
- Every important change can show who made it.

### Machines

A machine is a washer, dryer, changer, payment kiosk, vending machine, HVAC unit, or other equipment item the business wants to track.

The prototype only tracks washer/dryer classification, machine number, make, model, and status. LaundryOps should keep those fields but add location, photos, QR support, and reporting fields.

Key fields:

- `machineId`.
- `organizationId`.
- `locationId`.
- `machineNumber`: the number visible in the store.
- `machineType`: washer, dryer, changer, kiosk, vending, HVAC, other.
- `classification`: washer or dryer when applicable.
- `make`.
- `model`.
- `serialNumber`.
- `capacity`: optional size such as 20 lb, 40 lb, 60 lb.
- `status`: operational, needs_attention, down, in_repair, retired.
- `statusReason`: short explanation for non-operational status.
- `qrCodeValue`: stable code used by stickers or scan flow.
- `primaryPhotoFileId`.
- `manualIds`: manuals linked to this machine or model.
- `purchaseDate`.
- `installDate`.
- `warrantyExpiresAt`.
- `estimatedReplacementCost`.
- `lifetimeRepairCost`.
- `lastServiceAt`.
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

Why it matters:

- Owners need to know which machines cost the most.
- Technicians need a fast way to open the right machine from the floor.
- Reports depend on clean machine identity.

### Work Orders

A work order is the main repair workflow. It replaces the prototype's simple maintenance record as the primary operating record.

Work orders should track the problem from first report through completion.

Key fields:

- `workOrderId`.
- `organizationId`.
- `locationId`.
- `machineId`.
- `title`: short issue summary.
- `description`: detailed issue report.
- `status`: open, assigned, in_progress, waiting_on_parts, completed, cancelled.
- `priority`: low, normal, high, urgent.
- `reportedByUserId`.
- `assignedToUserId`.
- `symptoms`.
- `errorCode`.
- `suspectedCause`.
- `partsUsed`: list of parts, quantities, and costs.
- `partsCost`.
- `laborCost`.
- `otherCost`.
- `totalCost`.
- `downtimeStartedAt`.
- `downtimeEndedAt`.
- `completedAt`.
- `completionNotes`.
- `aiDiagnosisId`: optional AI result tied to the work order.
- `photoFileIds`: photos attached to the issue or repair.
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

Why it matters:

- Owners get repair cost, downtime, and repeat-failure reporting.
- Technicians have one place to record symptoms, parts, notes, and photos.
- AI diagnosis can be saved into a real repair workflow.

### Maintenance Events

A maintenance event is a timeline entry. It records what happened to a machine or work order.

Examples:

- Machine marked down.
- Work order created.
- Technician assigned.
- Photo added.
- Part replaced.
- AI diagnosis generated.
- Work order completed.
- Preventive maintenance performed.

Key fields:

- `eventId`.
- `organizationId`.
- `locationId`.
- `machineId`.
- `workOrderId`: optional.
- `eventType`: status_change, note, repair_action, preventive, photo_added, ai_diagnosis, cost_update, assignment_change.
- `summary`.
- `details`.
- `fromStatus`, `toStatus`: when relevant.
- `costImpact`: optional amount.
- `fileIds`: optional attached files.
- `createdAt`, `createdBy`.

Why it matters:

- Machine detail pages need a clean maintenance timeline.
- Audit logs are for compliance and security; maintenance events are for day-to-day operating history.
- Reports can calculate repeat failures, downtime, and repair patterns.

### Photos And Files

Files are stored in Firebase Storage. Firestore should only store file metadata and references.

Common file types:

- Machine photos.
- Problem photos.
- Completed repair photos.
- Receipts.
- Manuals.
- Export files.
- Backup files.

Key fields:

- `fileId`.
- `organizationId`.
- `locationId`: optional.
- `machineId`: optional.
- `workOrderId`: optional.
- `manualId`: optional.
- `fileType`: machine_photo, work_order_photo, receipt, manual_pdf, export, backup, other.
- `storagePath`: Firebase Storage path.
- `fileName`.
- `contentType`.
- `sizeBytes`.
- `checksum`: optional duplicate/safety check.
- `uploadedBy`.
- `uploadedAt`.
- `visibility`: organization, location, restricted.
- `status`: active, deleted, quarantined.

Why it matters:

- The app can show photos and manuals without storing bulky file data in Firestore.
- Storage rules can protect files by organization.
- Files can be attached to machines, work orders, and AI diagnoses.

### Manuals

A manual is the uploaded PDF or document tied to a make/model or machine.

The prototype stores `manualContent` directly in the manual record. The production app should not do that. Manuals should be uploaded to Storage, then processed server-side into searchable chunks.

Manual key fields:

- `manualId`.
- `organizationId`.
- `locationId`: optional.
- `make`.
- `model`.
- `machineType`.
- `machineIds`: optional machines directly linked to this manual.
- `fileId`.
- `fileName`.
- `storagePath`.
- `processingStatus`: uploaded, processing, ready, failed.
- `pageCount`.
- `language`.
- `uploadedBy`.
- `uploadedAt`, `updatedAt`.

Manual chunk key fields:

- `chunkId`.
- `organizationId`.
- `manualId`.
- `pageStart`.
- `pageEnd`.
- `sectionTitle`.
- `text`.
- `embeddingRef`: optional reference to vector storage or search index.
- `createdAt`.

Why it matters:

- Technicians can search manuals quickly.
- AI can answer using the actual manual instead of guessing.
- The app can cite manual pages or sections in AI answers.

### AI Diagnoses

An AI diagnosis is a repair assistant result created through the secure backend.

The Android app should send the user's request to a backend endpoint. The backend should call OpenAI, search relevant manuals, apply usage limits, save the result, and return only the answer the user needs.

Core product rule:
AI diagnosis should be grounded in uploaded repair manuals whenever the organization has a matching manual for the selected machine make/model. Manual-grounded answers should store the manual and chunk references used. If no manual match is available, the answer must clearly mark itself as general guidance rather than manual-backed guidance.

Key fields:

- `aiDiagnosisId`.
- `organizationId`.
- `locationId`.
- `machineId`.
- `workOrderId`: optional.
- `requestedBy`.
- `inputSymptoms`.
- `inputErrorCode`.
- `inputPhotoFileIds`.
- `manualIdsUsed`.
- `manualChunkIdsUsed`.
- `modelProvider`: OpenAI.
- `modelName`: stored for debugging and cost tracking.
- `summary`.
- `likelyCause`.
- `recommendedSteps`: ordered list.
- `partsToInspect`.
- `safetyWarnings`.
- `confidence`: low, medium, high.
- `citations`: manual page or section references when available.
- `groundingStatus`: manual_grounded, general_guidance, no_manual_available, manual_search_failed.
- `usage`: tokens, image count, estimated cost.
- `createdAt`.

Why it matters:

- AI becomes part of the repair history.
- Owners can control AI usage by plan.
- The app can show practical troubleshooting without exposing API keys.

### Subscriptions

Subscription data controls which features the organization can use.

For Android-first launch, billing approach must be decided carefully. If subscriptions are sold inside the Android app, Google Play Billing may be required. If billing is sold as SaaS outside the app, this model still tracks plan access inside LaundryOps.

Key fields:

- `subscriptionId`.
- `organizationId`.
- `provider`: google_play, stripe, manual, internal.
- `providerCustomerId`.
- `providerSubscriptionId`.
- `plan`: starter, pro, multi_location.
- `status`: trialing, active, past_due, cancelled, expired.
- `trialEndsAt`.
- `currentPeriodStart`.
- `currentPeriodEnd`.
- `cancelAtPeriodEnd`.
- `includedLocations`.
- `includedUsers`.
- `includedAiDiagnosesPerMonth`.
- `aiDiagnosesUsedThisPeriod`.
- `createdAt`, `updatedAt`.

Why it matters:

- The app can enforce plan limits.
- Owners can see their plan and billing state.
- Backend features can shut off safely if billing expires.

### Audit Logs

Audit logs record important account, security, and data changes. They should be append-only.

Examples:

- User invited.
- Role changed.
- Machine deleted.
- Work order restored.
- Manual deleted.
- Data export requested.
- Subscription changed.
- Support access granted.

Key fields:

- `auditLogId`.
- `organizationId`.
- `actorUserId`.
- `actorRole`.
- `action`.
- `targetType`: organization, user, location, machine, work_order, manual, subscription, backup.
- `targetId`.
- `before`: limited snapshot of important changed fields.
- `after`: limited snapshot of important changed fields.
- `ipAddress`: backend-only when available.
- `userAgent`: backend-only when available.
- `createdAt`.

Why it matters:

- Owners can trust who changed what.
- Support can troubleshoot without guessing.
- Sensitive operations have a record.

### Backups And Checkpoints

The prototype has local checkpoints in browser storage. Production checkpoints should be server-side, organization-scoped, and protected.

Backup key fields:

- `backupId`.
- `organizationId`.
- `name`.
- `type`: automatic, manual, pre_import, pre_restore.
- `status`: pending, completed, failed, restored.
- `storagePath`.
- `recordCounts`: machines, work orders, manuals, files.
- `createdBy`.
- `createdAt`.
- `restoredBy`.
- `restoredAt`.
- `notes`.

Why it matters:

- Imports and bulk changes need a safety point.
- Owners need confidence that data can be recovered.
- Restore actions should be logged and permission-protected.

## Suggested Firebase Structure

Recommended approach: use organization-scoped collections for customer data, plus a small global user profile collection.

```text
users/{userId}
organizations/{organizationId}
organizations/{organizationId}/memberships/{userId}
organizations/{organizationId}/locations/{locationId}
organizations/{organizationId}/machines/{machineId}
organizations/{organizationId}/workOrders/{workOrderId}
organizations/{organizationId}/maintenanceEvents/{eventId}
organizations/{organizationId}/files/{fileId}
organizations/{organizationId}/manuals/{manualId}
organizations/{organizationId}/manuals/{manualId}/chunks/{chunkId}
organizations/{organizationId}/aiDiagnoses/{aiDiagnosisId}
organizations/{organizationId}/subscriptions/current
organizations/{organizationId}/auditLogs/{auditLogId}
organizations/{organizationId}/backups/{backupId}
```

Recommended Firebase Storage paths:

```text
orgs/{organizationId}/locations/{locationId}/machines/{machineId}/photos/{fileId}
orgs/{organizationId}/work-orders/{workOrderId}/photos/{fileId}
orgs/{organizationId}/manuals/{manualId}/{fileName}
orgs/{organizationId}/exports/{exportId}/{fileName}
orgs/{organizationId}/backups/{backupId}/{fileName}
```

Why this structure works:

- It keeps customer data grouped under the organization.
- It makes security rules easier to understand.
- It supports multi-location accounts without redesigning later.
- It keeps files in Storage and searchable metadata in Firestore.

## Permission Boundaries

### Owner

Can:

- Manage organization profile.
- Manage billing and subscription.
- Add, edit, and delete locations.
- Invite, remove, and change user roles.
- Add, edit, and retire machines.
- Create and manage work orders.
- Upload and delete manuals.
- Export data.
- Create and restore backups.
- View audit logs.

### Admin

Can:

- Manage locations, users, machines, manuals, and work orders.
- View reports.
- Create backups.

Usually cannot:

- Transfer ownership.
- Delete the organization.
- Change billing owner unless explicitly allowed.

### Manager

Can:

- Manage assigned locations.
- Create and assign work orders.
- Update machine status.
- View reports for allowed locations.
- Upload photos and notes.

Usually cannot:

- Manage billing.
- Change roles.
- Export all organization data.
- Restore backups.

### Technician

Can:

- View assigned locations and assigned work orders.
- Update work order status.
- Add notes, parts, costs, and photos.
- Use AI repair assist if the plan allows it.
- Search manuals for assigned locations.

Usually cannot:

- See billing.
- Manage users.
- Delete machines.
- Delete manuals.
- Restore backups.
- Export organization data.

### Viewer

Can:

- View allowed locations, machines, work orders, and reports.

Cannot:

- Create, edit, delete, export, restore, or run AI actions.

### Support

Can:

- Access only when granted by the organization or through an internal support process.
- Access should be time-limited.
- Every support action must be audit logged.

## What Should Not Be Stored Client-Side

The Android app should not store sensitive or high-value data directly on the device unless it is part of Firebase's normal secured offline cache and the user is authorized.

Do not store these in client-side code, local storage, or plain device files:

- OpenAI API keys.
- Firebase service account keys.
- Billing provider secrets.
- Admin credentials.
- Raw subscription webhook payloads.
- Full manual text used for AI search.
- Vector embeddings.
- Large PDFs or backups outside controlled app storage.
- Other organizations' data.
- Role/permission decisions that can be trusted only because the app says so.
- Audit log write authority.
- Server-only cost calculations for AI usage.
- Security rules or permission bypass flags.

Client-side can keep:

- The signed-in user's basic profile.
- Authorized organization and location IDs.
- Recently viewed machines and work orders through Firebase's secured cache.
- Temporary upload files before they are sent to Storage.
- Non-secret UI preferences such as selected location, filters, and theme.

The backend must own:

- AI calls to OpenAI.
- Manual text extraction.
- Manual chunking and search indexing.
- Subscription status updates from billing providers.
- Permission enforcement for sensitive actions.
- Audit log creation.
- Backup creation and restore.
- Data exports.

## Reporting Fields To Maintain

Reports should not require expensive calculations every time the user opens the app. Some totals can be stored and updated by backend functions.

Useful summary fields:

- Machine lifetime repair cost.
- Machine repair count.
- Machine downtime hours.
- Last service date.
- Repeat failure count.
- Monthly repair spend by location.
- Monthly AI usage by organization.
- Open work order count by location.
- Machines down by location.

These fields should be treated as derived data. The source of truth remains the underlying machines, work orders, maintenance events, files, and AI diagnoses.

## Migration From Prototype

The prototype maps cleanly into the production model:

- `Machine` becomes `organizations/{organizationId}/machines/{machineId}` with added organization, location, QR, photo, warranty, and reporting fields.
- `MaintenanceRecord` becomes `WorkOrder` plus one or more `MaintenanceEvent` timeline entries.
- `TechnicalManual` becomes `Manual` plus Storage file metadata and server-created `ManualChunk` records.
- `Checkpoint` becomes a protected server-side `Backup`.
- Current top-level Firestore collections should be replaced with organization-scoped collections.
- Current open Firestore rules must be replaced before production. Public read/write is not acceptable for a paid app.

## Version 1 Minimum Data Model

For the first paid launch, build these first:

- Organizations.
- Locations.
- Users and memberships.
- Machines.
- Work orders.
- Maintenance events.
- File metadata and Storage paths.
- Manuals and manual chunks.
- AI diagnoses.
- Subscription record.
- Audit logs.
- Backups/checkpoints.

This is enough to support the core promise of LaundryOps: owners know what is broken, technicians know what to fix, repair history is organized, AI helps with diagnosis, and the business has control over cost and downtime.
