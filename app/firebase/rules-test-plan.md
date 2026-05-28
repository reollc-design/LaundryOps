# LaundryOps Firebase Rules Test Plan

These are the security cases that need automated emulator tests before launch.

## Must Pass

- Signed-out users cannot read organization, machine, work order, manual, subscription, AI, audit, or file data.
- A user in Company A cannot read or write Company B data.
- An active owner can read and manage the organization.
- An active admin can manage operations records but cannot directly write subscription provider fields.
- A manager can work only inside assigned locations.
- A technician can read assigned-location machines and assigned work orders.
- A technician cannot read unassigned locations.
- A technician cannot change billing, roles, memberships, manual chunks, AI cost fields, backups, or audit logs.
- A viewer cannot write operational records.
- Manual chunks cannot be created, updated, or deleted by the mobile app.
- AI diagnosis records cannot be created, updated, or deleted by the mobile app.
- Audit logs cannot be created, updated, or deleted by the mobile app.
- Subscription provider fields cannot be changed by the mobile app.
- Machine photos can only be uploaded by users with access to that machine location.
- Work order attachments can only be uploaded by users with access to that work order location.
- Manuals can only be uploaded as PDFs by owner, admin, or manager roles.
- Backups and exports can be read only by the correct leadership roles and written only by trusted backend code.

## Test Users To Seed

- `ownerA` in `orgA`, role `owner`, allowed locations `all`.
- `adminA` in `orgA`, role `admin`, allowed locations `all`.
- `managerA1` in `orgA`, role `manager`, allowed location `locA1`.
- `techA1` in `orgA`, role `technician`, allowed location `locA1`.
- `viewerA` in `orgA`, role `viewer`, allowed location `locA1`.
- `ownerB` in `orgB`, role `owner`, allowed locations `all`.

## Test Data To Seed

- `orgA` and `orgB`.
- `locA1`, `locA2`, and `locB1`.
- Machines in each location.
- Work orders in each location.
- One manual and manual chunk in `orgA`.
- One AI diagnosis in `orgA`.
- One subscription record in each organization.
- One audit log in each organization.

## First Automated Test File To Build

Create emulator tests for:

1. Organization separation.
2. Role read/write permissions.
3. Location-level machine access.
4. Location-level work order access.
5. Manual chunk write denial.
6. Subscription write denial.
7. Audit log write denial.
8. Storage upload/read permissions.
