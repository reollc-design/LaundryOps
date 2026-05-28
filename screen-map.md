# LaundryOps Screen Map

Date: 2026-05-15
Project: LaundryOps
Platform direction: Android first
Business model: Monthly subscription

## Purpose

This screen map turns LaundryOps from a maintenance tracker prototype into a professional laundromat operations app.

The app should help laundromat owners and technicians answer three questions fast:

1. What machines need attention right now?
2. What work needs to be done, who owns it, and what is the status?
3. Which machines are costing too much money or breaking too often?

The current prototype has useful pieces: dashboard, machines, maintenance ledger, reports, manuals, and AI diagnosis. LaundryOps should reorganize those pieces around a stronger professional workflow: machines, work orders, AI repair help, manuals, reports, and admin.

## Navigation Structure

LaundryOps should have three navigation areas:

1. Public access screens
   - Welcome
   - Sign in
   - Create account
   - Forgot password

2. Onboarding screens
   - Business setup
   - Subscription trial setup
   - First location setup
   - First machine setup
   - First manual upload

3. Main app screens
   - Home / Command Center
   - Machines
   - Machine Detail
   - Work Orders
   - Work Order Detail
   - AI Repair Assist
   - Manuals
   - Reports
   - Settings / Admin

Settings, subscription, users, data export, privacy, and support should not be primary bottom-nav tabs. They should live under the account/admin area.

## Bottom Navigation Recommendation

Use no more than five bottom navigation items. Android users should always know where they are and should not have to hunt for the main workflows.

### Owner Bottom Nav

1. Home
   - Main command center for the business.

2. Machines
   - Machine list, machine status, machine detail, QR scan, add/edit machine.

3. Work Orders
   - Open, assigned, in progress, waiting on parts, and completed repair work.

4. AI Assist
   - Troubleshooting, photo diagnosis, manual-aware repair help.

5. Reports
   - Repair cost, downtime, repeat failures, replacement decisions.

### Service Tech User

A technician can still use LaundryOps, but in launch V1 they sign up, start a trial, and pay like any other customer. They do not join another company's account by invite.

### Global Quick Action

Add one floating action button on the main screens.

Recommended quick actions:

- Scan machine QR code
- Create work order
- Add machine
- Ask AI
- Upload photo

The quick action menu should focus on work: scan machine QR code, create work order, add machine, ask AI, and upload photo.

## User Roles

## Owner View

Owners need the full business picture.

Owners should see:

- Fleet health
- Machines down
- Open work orders
- Repair costs
- Downtime
- Repeat failures
- Technician assignments
- Reports
- Subscription and billing
- Users and permissions
- Data export and privacy controls

Owners should be able to:

- Add, edit, and retire machines
- Create and assign work orders
- Upload manuals
- Manage their own account and subscription
- View all locations
- View all reports
- Manage subscription
- Export data
- Delete or archive records, with confirmation

## Technician View

Technicians need speed and clarity on the floor.

Technicians should see:

- Assigned work
- Machine status
- Machine detail
- Repair history
- Manuals
- AI troubleshooting
- Photos and notes
- Parts used
- Labor time or labor cost fields if owner allows it

Technicians should be able to:

- Start assigned work
- Update work order status
- Add notes
- Add photos
- Add error codes
- Use AI Assist
- Search manuals
- Mark work complete

Technicians should not see by default:

- Business billing
- Subscription settings
- Company-wide financial reports
- User management
- Data export
- Delete-company-data controls

## Primary Screens

## 1. Welcome

Purpose:
Give a clean first impression and send the user to sign in or start a trial.

Key actions:

- Sign in
- Start free trial

Notes:
Keep this practical. Do not make it feel like a marketing website. The app should move users into setup quickly.

## 2. Sign In

Purpose:
Secure access to the app.

Fields and actions:

- Email
- Password
- Sign in
- Continue with Google
- Forgot password
- Create account

Required states:

- Loading
- Wrong password
- Account not found
- No internet

Recommended UI split:

- Returning users use Sign In.
- New users use Create Account and then start the 14-day trial setup.

## 3. Owner Onboarding

Purpose:
Get a laundromat owner from new account to useful app as fast as possible.

Recommended steps:

1. Create account
2. Start free trial or choose plan
3. Add business name
4. Add first location
5. Add first machine
6. Upload first manual, optional
7. Land on Home / Command Center

The onboarding should not ask for everything upfront. Get enough information to make the app useful, then let the owner continue inside the app.

## 4. Individual Account Setup

Purpose:
Let any user, including an independent service technician, create their own paid LaundryOps workspace.

Recommended steps:

1. Create account
2. Start 14-day trial
3. Add business or service company name
4. Add first location or customer location
5. Add first machine
6. Land on Home / Command Center

Launch V1 has no technician invite flow. Team access can be reconsidered later as a paid add-on.

## 5. Home / Command Center

Purpose:
Show what needs attention right now.

Owner version should include:

- Fleet health score
- Machines down
- Machines needing repair
- Open work orders
- Work waiting on parts
- Highest priority issues
- Recent activity
- Monthly repair spend
- Quick actions

Technician version should include:

- Work assigned today
- Urgent open work
- Machines currently down at assigned location
- Recently updated work orders
- Quick scan button
- Quick AI Assist button

Key actions:

- Create work order
- Scan machine
- Add machine
- Ask AI
- View all work orders
- View machine

## 6. Machines

Purpose:
Manage every washer, dryer, and future equipment item.

List should support:

- Search by machine number, make, model, location, or status
- Filter by operational, needs repair, down, retired
- Filter by washer or dryer
- Filter by location
- Sort by machine number, status, repair cost, recent activity

Machine cards/list rows should show:

- Machine number
- Washer or dryer
- Make and model
- Location
- Current status
- Open work order indicator
- Lifetime repair cost
- Last serviced date
- Manual available or missing

Key actions:

- Add machine
- Edit machine
- Scan QR code
- View machine detail
- Change status
- Create work order
- Ask AI about this machine

## 7. Machine Detail

Purpose:
One complete record for a machine.

Must show:

- Machine number
- Photo
- Washer or dryer
- Make and model
- Serial number, if available
- Location
- Status
- QR code
- Current open issue
- Open work orders
- Maintenance timeline
- Lifetime repair cost
- Parts/labor/other cost totals
- Linked manuals
- AI diagnosis history
- Replacement notes

Key actions:

- Create work order
- Change machine status
- Ask AI
- Search manual
- Add photo
- Edit machine
- Retire machine

Owner detail view should emphasize cost and history.

Technician detail view should emphasize current issue, manual access, AI Assist, and previous repairs.

## 8. Work Orders

Purpose:
Replace the simple maintenance ledger with a professional repair workflow.

Recommended tabs:

- Open
- Assigned
- In Progress
- Waiting on Parts
- Completed

Work order list should show:

- Work order title
- Machine number
- Location
- Priority
- Status
- Assigned technician
- Created date
- Last updated date
- Error code, if entered
- Cost summary, if available

Key filters:

- My work
- All work
- Priority
- Status
- Technician
- Location
- Machine

## 9. Work Order Detail

Purpose:
Show the full repair job and let the owner or technician move it forward.

Must include:

- Work order title
- Machine
- Status
- Priority
- Assigned technician
- Symptoms
- Error code
- Photos
- AI diagnosis
- Manual references
- Parts used
- Labor cost
- Other cost
- Completion notes
- Activity history
- Date completed

Key actions:

- Assign technician
- Start work
- Mark waiting on parts
- Add note
- Add photo
- Ask AI
- Add parts/costs
- Complete work order
- Reopen work order

When completed, the work order should automatically become part of the machine maintenance timeline and reports.

## 10. AI Repair Assist

Purpose:
Help owners and technicians troubleshoot faster.

Entry points:

- Bottom nav AI Assist
- Machine Detail
- Work Order Detail
- Create Work Order
- Scan Machine

Recommended flow:

1. Select machine
2. Enter symptoms
3. Enter error code, optional
4. Add photo, optional
5. Choose whether to use linked manual
6. Generate diagnosis
7. Review likely causes, safety notes, and next steps
8. Save as new work order or attach to existing work order

AI result should include:

- Short summary
- Likely cause
- Things to inspect first
- Suggested repair steps
- Parts to check or order
- Safety warning when needed
- Confidence language
- Manual references when available

Important rule:
AI should assist the repair decision. It should not pretend to be certain when it is not.

## 11. Manuals

Purpose:
Store, search, and use machine manuals.

Owner/admin view should include:

- Upload PDF
- Assign manual to make/model
- Assign manual to specific machines, optional
- See extraction status
- Search manuals
- Replace manual
- Delete manual

Technician view should include:

- Search manuals
- Open manual
- Search within selected machine manual
- Ask AI using this manual

Manual cards/list rows should show:

- Make/model
- File name
- Machines linked
- Upload date
- Text extraction status
- Last used date

## 12. Reports

Purpose:
Help owners make repair, spending, and replacement decisions.

Owner reports should include:

- Fleet health
- Repair spend by machine
- Downtime by machine
- Repeat failures
- Cost by make/model
- Monthly repair spend
- Preventive maintenance status
- Replace or repair score
- Technician workload, optional for v1

Key report actions:

- Filter by location
- Filter by date range
- Filter by machine type
- Open machine detail from report row
- Export report

Technician report access:
Technicians should not see owner financial reports by default. If allowed, they can see repair history for machines they service.

## 13. Settings / Admin

Purpose:
Manage the business account.

Owner/admin settings should include:

- Business profile
- Locations
- Users
- Roles and permissions
- Subscription
- Billing status
- Data export
- Privacy and data deletion request
- App support
- Notification preferences

Technician settings should include:

- Profile
- Assigned locations
- Camera/photo permission guidance
- Notification preferences
- Sign out
- Support

## Secondary Screens

These screens matter, but they should not all become bottom-nav items.

## Scanner

Purpose:
Scan a machine QR code and jump directly to the right machine.

Entry points:

- Quick action menu
- Machines
- Work order creation
- Machine Detail

After scan:

- If machine is found, open Machine Detail.
- If machine has an open work order, show that first.
- If machine is not found, offer Add Machine.

## Add / Edit Machine

Purpose:
Create or update a machine record.

Fields:

- Machine number
- Washer or dryer
- Make
- Model
- Serial number
- Location
- Photo
- Status
- QR code
- Notes

## Account Access

Purpose:
Keep launch V1 simple with one paid workspace per account.

Fields:

- Name
- Email
- Password
- Company/workspace name
- Subscription status

## Subscription / Trial

Purpose:
Make the monthly subscription clear.

Screens:

- Plan selection
- Trial status
- 14-day free trial
- Active plan
- Payment status
- Upgrade/downgrade
- Cancel instructions

Keep the plan language simple:

- Starter
- Pro
- Multi-location

Recommended v1 structure:

- One company account.
- One subscription per company.
- One included location.
- Additional laundromat locations as add-ons.
- 14-day free trial before the paid plan starts.

## Support

Purpose:
Give users a place to get help.

Should include:

- Contact support
- Report a problem
- Send feedback
- App version
- Terms
- Privacy policy

## Key User Flows

## Flow 1: New Owner Setup

1. Open app
2. Tap Start free trial
3. Confirm 14-day Pro trial
4. Create company account
5. Add first location
6. Add first machine
7. Optionally upload a manual
8. Land on Home / Command Center

Success state:
The owner sees at least one machine and clear next actions.

## Flow 2: Service Technician Signup

1. Technician opens app
2. Technician taps Start free trial
3. Technician creates account
4. Technician adds their business or service workspace
5. Technician adds machines or customer locations they manage
6. Technician chooses a paid plan after the trial

Success state:
The technician has their own paid workspace and can use machines, work orders, manuals, and Repair Assist without joining another company's account.

## Flow 3: Create Work Order

1. Start from Home, Machine Detail, Work Orders, or QR scan
2. Select machine
3. Enter issue title
4. Enter symptoms
5. Add error code, optional
6. Add photos, optional
7. Set priority
8. Assign technician, optional
9. Save work order

Success state:
The work order appears in Open or Assigned, and the machine shows an open issue.

## Flow 4: Technician Completes Work

1. Technician opens Today
2. Taps assigned work order
3. Reviews machine and issue
4. Starts work
5. Searches manual or asks AI if needed
6. Adds notes and photos
7. Adds parts, labor, and other costs
8. Marks complete

Success state:
The work order becomes completed, machine status updates, and the repair is added to history.

## Flow 5: AI Repair Assist

1. Start AI Assist
2. Select machine or scan QR code
3. Enter symptoms
4. Enter error code, optional
5. Add photo, optional
6. AI checks linked manual when available
7. AI returns likely cause and recommended next steps
8. User saves result as a work order or attaches it to existing work

Success state:
The user has a practical repair plan and can turn it into a tracked job.

## Flow 6: Manual Upload And Search

Owner/admin upload flow:

1. Open Manuals
2. Tap Upload manual
3. Choose PDF
4. Assign make/model
5. App extracts text server-side
6. Manual becomes searchable
7. Manual can be used by AI Assist

Technician search flow:

1. Open Manuals or Machine Detail
2. Search by make/model, error code, or keyword
3. Open result
4. Ask AI about selected manual section, optional

Success state:
Manual knowledge is attached to real machines and available during repair.

## Flow 7: Reports

1. Owner opens Reports
2. Chooses date range
3. Chooses location or all locations
4. Reviews fleet health, repair spend, downtime, and repeat failures
5. Opens a machine from the report if needed
6. Exports report

Success state:
The owner can see which machines need attention and which machines may need replacement.

## Launch V1 Screens

These should be built for the first serious launch.

| Screen | Include In V1 | Notes |
| --- | --- | --- |
| Welcome | Yes | Simple entry to sign in or start trial. |
| Sign in / Create account | Yes | Required for secure account access. |
| Owner onboarding | Yes | Business, plan, location, first machine. |
| Technician invite onboarding | No | Removed from launch V1. Technicians sign up and pay like any other user. |
| Home / Command Center | Yes | Main operating screen. |
| Machines | Yes | Search, filters, machine status, add/edit. |
| Machine Detail | Yes | History, costs, manuals, AI, work orders. |
| QR Scanner | Yes | Important for Android floor use. |
| Work Orders | Yes | Core professional workflow. |
| Work Order Detail | Yes | Status, assignment, photos, costs, notes. |
| AI Repair Assist | Yes | Main product differentiator. |
| Manuals | Yes | Upload, search, link to machines, AI use. |
| Reports | Yes | Repair spend, downtime, repeat failures. |
| Settings / Admin | Yes | Business, locations, users, subscription, support. |
| Subscription / Trial | Yes | Monthly subscription app requires this. |
| Privacy / Data Export | Yes | Needed for trust and Google Play readiness. |

## Later Screens

These are valuable, but should wait until the v1 app is solid.

| Screen | Add Later | Why Later |
| --- | --- | --- |
| Parts Inventory | Later | Useful, but can slow v1 if built too early. |
| Vendor Management | Later | Better after work orders are stable. |
| Preventive Maintenance Calendar | Later | Strong feature, but not required for first launch. |
| Route Planning | Later | Mainly useful for outside repair companies. |
| Push Notification Center | Later | Add after core workflows are proven. |
| Multi-location Benchmarking | Later | Needs enough multi-location customer data. |
| Replacement Forecasting | Later | Needs repair history and cost patterns. |
| Accounting Integrations | Later | Valuable, but adds complexity. |
| Owner Web Dashboard | Later | Android first is the launch path. |
| White-label Admin | Later | Only after the core product sells. |

## Screen Priority

Build order should be:

1. Sign in and onboarding
2. App shell and bottom nav
3. Home / Command Center
4. Machines and Machine Detail
5. Work Orders and Work Order Detail
6. Manuals
7. AI Repair Assist
8. Reports
9. Settings / Admin
10. Subscription / Trial
11. Android packaging screens and permissions

This order gives the app a complete operating workflow before adding polish-only features.

## Practical Product Rule

Every screen should help the user do one of these things:

- Keep machines running
- Get repair work done
- Reduce downtime
- Understand repair cost
- Make a better repair-or-replace decision

If a screen does not support one of those outcomes, it should not be in launch v1.
