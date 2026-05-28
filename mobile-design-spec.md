# LaundryOps Mobile Design Spec

Date: 2026-05-16
Concept source: `C:\Users\reoll\CODEX\projects\LaundryOps\mobile-concept-v1.png`
Build target: Android-first React/Vite app

## Purpose

This spec turns the approved LaundryOps mobile concept into implementation rules for the first UI rebuild.

The first build pass covers:

- Home / Command Center
- Machine Detail
- Work Order Detail
- AI Repair Assist

This pass is UI-first. It should use realistic sample data and interactive navigation, but it should not connect to Firebase or OpenAI yet.

## Screen 0: Welcome / Trial Start

Goal:
Give a new owner a clean path into the 14-day free trial without making the app feel like a marketing site.

Content order:

1. LaundryOps brand mark.
2. Sign in action for returning users.
3. 14-Day Free Trial hero:
   - Maintenance command center positioning.
   - Start 14-Day Free Trial action.
4. Trial feature list:
   - Professional work orders.
   - Manual-grounded AI.
   - Owner reports.
5. Billing note:
   - No payment screen in this prototype.
   - Production billing will connect to Google Play or SaaS billing.

Implementation notes:

- Welcome is the app front door, not a web landing page.
- Keep copy practical and owner-focused.

## Screen 0A: Owner Onboarding

Goal:
Get a new laundromat owner from trial start to a working app quickly.

Content order:

1. Header:
   - Start 14-Day Free Trial.
   - Owner setup.
   - Step count.
2. Setup progress:
   - Current setup task.
   - Percentage complete.
3. Setup checklist:
   - Create company account.
   - Add first location.
   - Add first machine.
   - Upload first manual, optional.
4. Current setup form:
   - Business information.
   - Location information.
   - First machine.
   - Optional manual.
5. Continue / skip / finish actions.

Implementation notes:

- The setup should feel fast. Do not ask for every possible business field upfront.
- The first useful outcome is landing on Home with a company, location, and first machine context.

## Screen 0B: Access Screens

Goal:
Give users a clear way to sign in or start their own trial before Firebase authentication is fully wired.

Screens:

1. Sign In:
   - Email.
   - Password.
   - Sign in.
   - Continue with Google.
   - Forgot password.
   - Create account.
2. Create Account:
   - Owner name.
   - Email.
   - Password.
   - 14-day trial confirmation.
   - Continue to owner onboarding.

Implementation notes:

- Launch V1 has no technician invite flow.
- A technician who wants LaundryOps should create their own account, start their own 14-day trial, and pay like any other user.
- Forgot password should show a clear reset state now and later connect to Firebase Auth.

## Product Rule For Repair Assist

Repair Assist must be designed around factual manual grounding.

The future backend will use uploaded repair manuals for each machine make/model. The UI should already show that direction:

- Show when a linked manual is being used.
- Show which manual was used.
- Cite the manual page or section.
- Show confidence level.
- Make it clear if an answer is general guidance instead of manual-backed guidance.

The accepted concept shows this correctly with:

- "Use linked manual" toggle.
- "Source: Speed Queen SC40 Service Manual".
- "p. 42 Drain Pump Test".
- Structured answer sections.

## Overall Visual Direction

LaundryOps should feel like a professional field-service command center.

Keep:

- Compact dark header.
- White content surfaces.
- Strong machine numbers.
- Clear red/amber/green/purple status language.
- Bottom navigation.
- Practical labels.
- Clean line icons.
- No emoji.

Avoid:

- Giant gradient cards.
- Generic dashboard filler.
- Horizontal overflow.
- Decorative backgrounds.
- Nested card stacks.
- Chatbot-only AI.

## Design Tokens

### Colors

```css
--bg: #f6f8fa;
--surface: #ffffff;
--surface-soft: #eef3f6;
--ink: #102033;
--text: #18212b;
--muted: #647282;
--subtle: #8a96a3;
--border: #dde5ec;
--divider: #e8eef3;
--primary: #1d5fdb;
--primary-pressed: #174bb0;
--teal: #009c9a;
--ai: #6658d3;
--running: #15803d;
--warning: #d97706;
--down: #dc2626;
--waiting: #7c3aed;
--completed: #0f766e;
```

### Typography

Use a system stack that feels close to Android Roboto:

```css
font-family: Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Type scale:

- App bar title: 18px, 800.
- Screen title: 22px to 24px, 800.
- Machine number: 44px to 56px, 900.
- Section title: 16px to 18px, 800.
- Card title: 14px to 16px, 750.
- Body: 14px to 15px.
- Metadata: 12px to 13px.
- Bottom nav label: 11px to 12px.

Use tabular numbers for machine metrics and money values.

### Layout

Mobile viewport target:

- 390px wide Android phone.
- One-column layout.
- Fixed bottom nav.
- Header height around 72px.
- Content padding 16px.
- Bottom content padding at least 96px.

Cards:

- Radius: 8px to 12px.
- Border: 1px solid `--border`.
- Shadow: light, only for major cards.
- No card inside card unless it is a clearly distinct form/result panel.

Buttons:

- Primary: blue background, white text, 48px minimum height.
- Secondary: white or light background, border, dark text.
- AI action: purple accent only where AI is the active context.
- Destructive: red, used sparingly.

Tap targets:

- Minimum 44px height.

## App Shell

### Header

Use a dark compact header.

Owner Home:

- LaundryOps mark/text.
- Location: Main Street.
- Alert icon on right.

Detail screens:

- Back icon.
- Screen title.
- More/options icon.

### Bottom Navigation

Owner nav:

- Home
- Machines
- Work Orders
- AI Assist
- Reports

Selected item:

- Blue for normal screens.
- Purple for AI Assist.

Use line icons. No emoji.

## Screen 1: Home / Command Center

Goal:
Show the owner what needs attention right now.

Content order:

1. Dark header with LaundryOps and location.
2. Machine Health panel.
3. Four compact metrics:
   - Machines Down: 3
   - Open Work Orders: 7
   - Waiting on Parts: 2
   - Repair Spend: $1,245
4. Find Machine search:
   - Search all machines in a location without scrolling through the full equipment list.
   - Support letter-prefixed IDs like W12 and D07, number-only IDs like 101, row, type, and status.
5. Urgent Machines list.
6. Quick Actions.
7. Bottom nav.

Key sample rows:

- W12, Washer, Row 2, Down, Since 8:15 AM.
- D07, Dryer, Row 1, Needs Repair, Since 7:40 AM.
- W03, Washer, Row 3, Waiting on Parts, Since Yesterday.

Quick actions:

- Scan Machine.
- New Work Order.
- Ask AI.

Implementation notes:

- Use a circular machine health ring or a strong score card.
- Use status rail colors on urgent machine rows.
- Keep metric tiles compact; do not use giant full-color cards.
- If the layout gets tight, stack the metric panel cleanly without overflow.

## Screen 2: Machines Directory

Goal:
Let an owner or technician quickly find any machine in a 60-machine location.

Content order:

1. Header: Machines.
2. Location context: Main Street / 60 machines.
3. Compact status summary:
   - Total Machines.
   - Down.
   - Needs Repair.
   - Waiting Parts.
4. Search field:
   - Search W12, 12, dryer, row 2.
   - Match letter-prefixed IDs, number-only IDs, type, row, and status.
5. Status filters:
   - All.
   - Down.
   - Repair.
   - Parts.
6. Machine result list.
7. Tap a row to open Machine Detail.

Implementation notes:

- Store machine IDs as text, not numbers.
- Keep filters compact enough for Android width.
- Show a manageable first set of rows, then rely on search/filter to narrow the list.

## Screen 3: Machine Detail

Goal:
Make one machine's status, current issue, and history clear.

Content order:

1. Header: Machine Detail.
2. Machine hero:
   - W12.
   - Down chip.
   - Speed Queen SC40.
   - Main Street, Washer Row 2.
   - Serial number.
   - Machine photo.
3. Current Issue:
   - Won't drain after cycle.
   - Reported today 8:15 AM.
4. Primary action:
   - Create Work Order.
5. Action shortcuts:
   - Ask AI.
   - Search Manual.
   - Add Photo.
6. Summary metrics:
   - Lifetime Repair Cost: $2,842.
   - Last Service: Apr 22, 2026.
   - Downtime: 16.2 hrs.
7. Maintenance History:
   - Replaced drain pump, Apr 22, 2026, Mike R., $186.75.
   - Cleared coin chute jam, Apr 14, 2026, Tom J., $0.00.
   - Routine inspection, Mar 28, 2026, Mike R., $0.00.

Implementation notes:

- Machine number should be visually dominant.
- Current issue must appear above history.
- Machine image can be a styled placeholder in this first pass.
- Ask AI and Search Manual should visually reinforce manual-grounded repair workflow.

## Screen 4: Work Order Detail

Goal:
Show the repair job and make the next action obvious.

Content order:

1. Header: Work Order #WO-1042.
2. Title:
   - W12 won't drain.
   - Created today 8:25 AM.
   - High priority badge.
3. Status stepper:
   - Open.
   - Assigned.
   - In Progress.
   - Waiting.
   - Completed.
4. Assignment/status card:
   - Assigned to Mike R.
   - Technician.
   - Status: In Progress.
   - Since 9:10 AM.
5. Symptoms:
   - Water left in drum after cycle.
6. Error Code:
   - E04.
7. Photos strip.
8. Parts & Cost:
   - Drain Pump Assembly: $142.50.
   - Hose Clamp: $3.25.
   - Labor: $75.00.
   - Estimated Total: $220.75.
9. Sticky primary action:
   - Mark Waiting on Parts.
10. Bottom nav.

Implementation notes:

- Status stepper should be readable on a phone.
- Sticky action should not cover content.
- Work order state should feel operational, not decorative.

## Screen 4B: Work Orders List

Goal:
Give owners and technicians a fast operational queue so they can see what is open, what is high priority, and what is waiting on parts without opening every job.

Content order:

1. Header:
   - Work Orders.
   - Main Street / active work order count.
2. Summary stats:
   - Open.
   - High priority.
   - Waiting Parts.
3. Status filters:
   - All.
   - Open.
   - Assigned.
   - Waiting.
   - Completed.
4. Priority filters:
   - All Priority.
   - High.
   - Standard.
   - Low.
5. Queue rows:
   - Work order number.
   - Machine ID.
   - Issue title.
   - Machine model and location.
   - Status badge.
   - Assignee.
   - Due time.
   - Estimate.
   - Source: AI draft, manual entry, or preventive.
6. Tap a row to open Work Order Detail.

Implementation notes:

- The Work Orders bottom nav should open this list, not a single work order.
- Keep the queue dense enough for daily operations but still readable on Android.
- Assigned filter may include jobs already in progress, because those are owned by a technician.
- Completed work should remain visible so an owner can confirm what was closed today.

## Screen 4A: New Work Order / AI Draft Review

Goal:
Turn a manual-grounded Repair Assist answer into an operational work order without forcing the owner or technician to retype the same repair details.

Entry points:

- Home Quick Actions: New Work Order.
- Machine Detail: Create Work Order.
- AI Repair Assist: Save as Work Order.

Content order:

1. Header:
   - New Work Order.
   - AI draft review.
2. Draft source banner:
   - Created from Repair Assist.
   - Show priority.
3. Machine card:
   - W12.
   - Speed Queen SC40.
   - Main Street / Washer Row 2.
4. Work order setup:
   - Title.
   - Priority.
   - Assignee.
   - Due time.
5. AI repair notes:
   - Symptoms.
   - Error code.
   - Diagnosis.
6. Technician checklist:
   - Manual-backed steps pulled from Repair Assist.
7. Manual source card:
   - Speed Queen SC40 Service Manual.
   - p. 42 / Drain Pump Test.
8. Parts and estimate.
9. Primary action:
   - Create Work Order.

Implementation notes:

- This screen should feel like a review step, not a blank form.
- The user should see exactly what the AI is adding to the work order.
- Manual source must remain attached so the technician can trust the repair instructions.
- After save, route to Work Order Detail and show confirmation that the draft was attached.

## Screen 5: Manual Library

Goal:
Make uploaded repair manuals visible, searchable, and clearly linked to machine models so AI Repair Assist does not give generic answers.

Content order:

1. Header:
   - Manual Library.
   - Grounded repair answers.
2. Manual coverage summary:
   - Models grounded.
   - Ungrounded models.
3. Upload Repair Manual panel:
   - Machine model.
   - Manual PDF.
   - Process/index manual action.
4. Linked Manuals list:
   - Speed Queen SC40 Service Manual, indexed, linked to washers.
   - Dexter T-50 Dryer Service Manual, indexed, linked to dryers.
   - Combo 100 Series, missing or processing, linked once uploaded.
5. AI grounding note:
   - Repair Assist uses linked manuals first.
   - If no linked manual exists, answer is marked as general guidance.
6. Action:
   - Open AI Repair Assist.

Implementation notes:

- Manual status should be obvious: Indexed, Processing, Missing.
- Upload flow should feel operational even before backend storage is connected.
- Keep this screen tied to machine model, not only individual machine number.

## Screen 6: AI Repair Assist

Goal:
Make AI troubleshooting feel factual, structured, and tied to uploaded manuals.

Content order:

1. Header:
   - Repair Assist.
   - AI indicator.
2. Selected machine card:
   - W12.
   - Speed Queen SC40.
   - Main Street, Washer Row 2.
   - Change link.
3. Inputs:
   - Symptoms: Water remains after final spin.
   - Error Code: E04.
   - Photo attachment.
   - Add Photo tile.
4. Manual grounding:
   - Toggle on: Use linked manual.
   - Show manual available: Speed Queen SC40 Service Manual.
5. Result card:
   - Likely cause: Drain pump is not clearing water.
   - Inspect first: Check drain pump for blockage or impeller damage.
   - Next steps:
     1. Remove lower front panel.
     2. Inspect drain pump and filter.
     3. Clear debris and test pump.
   - Parts to check: Drain pump assembly, hose clamp.
   - Safety note: Unplug machine before working on drain system.
6. Confidence panel:
   - Medium.
7. Source panel:
   - Speed Queen SC40 Service Manual.
   - p. 42.
   - Drain Pump Test.
8. Actions:
   - Add to Existing.
   - Save as Work Order.

Implementation notes:

- Purple is allowed here, but keep the screen mostly white and operational.
- AI results should look like a structured repair note, not a chat bubble.
- Manual source should be visible without digging.
- This first UI pass should not make live OpenAI calls.

## Screen 7: Reports

Goal:
Give the laundromat owner a clear operating picture: downtime, spend, repeat failures, technician load, and AI/manual coverage.

Content order:

1. Header:
   - Reports.
   - Main Street location.
2. Reporting period control:
   - This Week.
   - This Month.
   - 90 Days.
3. Owner summary:
   - Plain-English readout of what is improving and what needs action.
   - Machine Health score.
4. Metric tiles:
   - Downtime.
   - Repair Spend.
   - Repeat Failures.
   - Manual Coverage.
5. Downtime chart:
   - Seven-day bar chart.
   - Hours offline per day.
6. Insight card:
   - Downtime improved, but concentrated in specific machines.
7. Repair spend breakdown:
   - Parts.
   - Labor.
   - Preventive.
8. Repeat-failure machines:
   - W12.
   - D07.
   - W03.
9. Technician load:
   - Mike R.
   - Tom J.
   - Unassigned.
10. Manual coverage:
   - Washers.
   - Dryers.
   - Combos.
11. Launch-readiness note:
   - Manual upload is required for complete AI grounding.

Implementation notes:

- Reports should feel like an owner dashboard, not a generic chart wall.
- Every metric should answer an operating question.
- Use compact charts and list rows so the screen stays useful on Android.
- Manual coverage belongs in Reports because it affects whether AI Repair Assist is sellable and trustworthy.

## Screen 8: Account & Locations

Goal:
Give owners a clean place to manage the company account, 14-day free trial, subscription direction, locations, users, and launch admin readiness without crowding the main bottom navigation.

Entry point:

- Tap the location chip in the header.

Content order:

1. Company Account:
   - Business name.
   - One account can manage one or more laundromats.
2. 14-Day Free Trial:
   - Pro trial active.
   - Trial includes work orders, reports, manual uploads, and OpenAI Repair Assist.
3. Account stats:
   - Trial status.
   - Locations.
   - Users.
   - AI usage.
4. Subscription model:
   - One company subscription.
   - One location included.
   - Additional locations as paid add-ons.
5. Locations list:
   - Included location.
   - Add-on locations.
   - Setup status.
6. Admin readiness:
   - Users and roles.
   - Data separation.
   - Billing decision before launch.

Implementation notes:

- Keep Settings/Admin out of bottom nav so the app stays focused on daily operations.
- Do not force the final add-on price yet. The app should show the recommended structure while leaving exact pricing for the billing setup decision.
- The 14-day free trial should be a real product assumption from this point forward.

## Approved Concept Elements

Preserve these:

- Four-screen structure.
- Dark app header.
- White operational cards.
- Strong machine number.
- Status rail/card language.
- Manual source/citation inside Repair Assist.
- Bottom nav with five items.
- Structured AI answer.
- Work order stepper.
- Quick action tiles.

## Known Refinements For Build

Improve these during implementation:

- Keep text code-native and fully readable.
- Use actual SVG/lucide-style icons, not rasterized or emoji icons.
- Make the UI responsive inside a real phone viewport.
- Keep all labels crisp.
- Use CSS tokens so the design system can scale.
- Keep sample data realistic but not overstuffed.

## First Build Checklist

- Create `LaundryOps/app`.
- Build React/Vite static UI.
- Add design tokens in CSS.
- Add app shell and bottom nav.
- Add four clickable screens.
- Add realistic sample data.
- Add manual-grounded Repair Assist state.
- Run type check/build.
- Run local browser screenshot at mobile width.
- Compare screenshot to `mobile-concept-v1.png`.
