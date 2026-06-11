# LaundryOps Firebase Rules Test Plan

These are the security cases that need automated emulator tests before launch.

## Must Pass

- Signed-out users cannot read organization, machine, work order, manual, subscription, AI, audit, or file data.
- A user in Company A cannot read or write Company B data.
- An active owner can read and manage the organization.
- An active admin can manage operations records but cannot directly write subscription provider fields.
- A manager can manage operations records inside the company account.
- A technician can read machines and work orders, and update machine status plus assigned work order status, but cannot change billing, roles, memberships, manual chunks, AI cost fields, backups, or audit logs.
- A viewer cannot write operational records.
- Manual chunks cannot be created, updated, or deleted by the mobile app.
- AI diagnosis records cannot be created, updated, or deleted by the mobile app.
- Audit logs cannot be created, updated, or deleted by the mobile app.
- Subscription provider fields cannot be changed by the mobile app.
- Machine photos can only be uploaded by users with operational access.
- Work order attachments can only be uploaded by users with operational access.
- Manuals can only be uploaded as PDFs by owner, admin, or manager roles.
- Backups and exports can be read only by the correct leadership roles and written only by trusted backend code.

## Test Users To Seed

- `ownerA` in `orgA`, role `owner`.
- `adminA` in `orgA`, role `admin`.
- `managerA1` in `orgA`, role `manager`.
- `techA1` in `orgA`, role `technician`.
- `viewerA` in `orgA`, role `viewer`.
- `ownerB` in `orgB`, role `owner`.

## Test Data To Seed

- `orgA` and `orgB`.
- Machines in each organization.
- Work orders in each organization.
- One manual and manual chunk in `orgA`.
- One AI diagnosis in `orgA`.
- One subscription record in each organization.
- One audit log in each organization.

## First Automated Test File To Build

Create emulator tests for:

1. Organization separation.
2. Role read/write permissions.
3. Machine access.
4. Work order access.
5. Manual chunk write denial.
6. Subscription write denial.
7. Audit log write denial.
8. Storage upload/read permissions.
