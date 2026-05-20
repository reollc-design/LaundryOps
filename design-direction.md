# LaundryOps Design Direction

Date: 2026-05-15
Project folder: `C:\Users\reoll\CODEX\projects\LaundryOps`
Source prototype: `C:\Users\reoll\CODEX\projects\Maint Tracker\Maint-tracker-main`

## Design North Star

LaundryOps should feel like a serious operating tool for laundromat owners and technicians.

The app is not a notebook, a hobby tracker, or a generic admin dashboard. It is the place an owner opens when machines are down, money is being lost, and someone needs to know what to fix next.

The product should feel:

- Fast.
- Clean.
- Trustworthy.
- Built for field work.
- Easy to read while standing in a laundromat.
- Professional enough to justify a monthly subscription.

The first design test is simple: if a laundromat owner opens the app on an Android phone, they should immediately know what needs attention and what action to take.

## Brand Personality

LaundryOps should sound and look like an experienced operator, not a flashy tech startup.

Brand traits:

- Practical: focused on machines, repairs, downtime, and cost.
- Calm: serious problems are shown clearly without panic.
- Direct: labels and actions use plain operational language.
- Reliable: the interface should feel stable and precise.
- Modern: clean enough for the app store, but not trendy for its own sake.

The brand promise:

> Fewer broken machines. Faster repairs. Better control of maintenance costs.

Avoid hype. Avoid cute language. Avoid anything that makes the app feel like a toy.

## Visual Style

Use a modern field-service command center style.

The core look should combine:

- A dark, compact top area for identity and location context.
- Light work surfaces for lists, forms, details, reports, and timelines.
- Strong machine numbers and status signals.
- Clear bottom navigation for Android.
- Compact but comfortable spacing.
- Simple line icons.
- Status colors that mean something.
- Subtle depth, not heavy shadows.

The app should not look like a marketing landing page. It should look like a professional tool people use repeatedly.

Recommended visual references:

- Field service apps.
- Fleet management tools.
- Equipment maintenance systems.
- Modern mobile banking apps, for clarity and trust.
- Point-of-sale admin tools, for operational density.

Avoid:

- Decorative gradients as the main style.
- Oversized hero sections inside the app.
- Large rounded cards everywhere.
- Emoji-driven UI.
- Generic SaaS dashboard styling.
- A dark-only interface that is hard to read under bright lighting.

## Color Palette

Use a mostly light interface with strong operational status colors.

Primary palette:

- App background: `#F6F8FA`
- Surface: `#FFFFFF`
- Raised surface: `#EEF3F6`
- Header ink: `#102033`
- Primary text: `#18212B`
- Secondary text: `#647282`
- Muted text: `#8A96A3`
- Border: `#DDE5EC`
- Divider: `#E8EEF3`

Action colors:

- Primary blue: `#1D5FDB`
- Primary blue pressed: `#174BB0`
- Teal accent: `#009C9A`
- AI accent: `#6658D3`

Machine status colors:

- Running: `#15803D`
- Limited: `#CA8A04`
- Needs repair: `#D97706`
- Down: `#DC2626`
- Waiting on parts: `#7C3AED`
- Completed: `#0F766E`

Usage rules:

- Blue is for primary actions and selected navigation.
- Green, amber, red, purple, and teal are semantic. Do not use them as random decoration.
- Red should mean a machine is down, a destructive action, or a serious issue.
- Amber should mean needs attention, waiting, or risk.
- Green should mean operating or completed.
- Purple should be used sparingly for AI or waiting-on-parts states.
- The dashboard may use colored status rails or small status chips, but avoid giant full-color cards.

The palette should feel professional and practical, not playful. Keep the app mostly white and light gray, with color used as information.

## Typography Direction

Use typography that feels native on Android and professional in business software.

Recommended type stack:

- Primary: Roboto
- Fallback: Inter, system-ui, Arial, sans-serif
- Numeric emphasis: use tabular numbers where available

Type personality:

- Clear.
- Compact.
- High contrast.
- Built for scanning.
- No decorative fonts.

Suggested scale:

- App title: 20 to 22px, 700 weight
- Screen title: 24px, 700 weight
- Section title: 17 to 18px, 700 weight
- Card title: 15 to 16px, 650 weight
- Body text: 14 to 15px, 400 to 500 weight
- Labels: 12 to 13px, 600 weight
- Small metadata: 11 to 12px, 500 weight
- Machine number: 28 to 36px, 800 weight when featured

Rules:

- Machine numbers should be visually strong.
- Status labels should be short and bold.
- Long explanatory copy should be rare inside the app.
- Use plain labels like "Down", "Open work orders", "Repair cost", and "Waiting on parts".
- Do not use tiny low-contrast text for important machine information.

## Icon Style

Use one consistent icon family across the app.

Recommended direction:

- Clean outline icons.
- 2px stroke.
- Rounded caps and joins.
- Simple, recognizable shapes.
- Use filled status dots only for machine state.
- Use icons to support labels, not replace critical text.

Recommended icon sources:

- Lucide for app navigation and standard actions.
- Custom simple machine icons only where a washer, dryer, QR code, or manual needs clearer meaning.

Core icons:

- Home / command center.
- Machines.
- Work orders.
- Reports.
- Manuals.
- AI assist.
- Camera.
- QR scan.
- Add.
- Search.
- Filter.
- User / team.
- Settings.
- Alert.
- Check.
- Clock.
- Tool.

Rules:

- No emoji icons.
- No mixed icon weights.
- No decorative icons inside every card.
- Bottom navigation icons must fit a 24px visual box.
- Status should be color plus label, not color alone.

## App Shell

Design mobile first for Android.

Primary shell:

- Compact top app bar.
- Bottom navigation.
- Floating or fixed primary action only where it helps.
- Optional location switcher near the top.
- No permanent desktop sidebar on mobile.

Top app bar:

- Left: LaundryOps wordmark or compact mark.
- Center or subtitle: active location, such as "Main Street".
- Right: profile, alerts, or sync/account status.

Bottom navigation:

- Owner: Home, Machines, Work Orders, AI Assist, Reports.
- Technician: Today, Work Orders, Machines, AI Assist, Manuals.

Use role-based bottom navigation instead of forcing one generic nav for everyone. AI Assist should stay visible as a primary tab because it is one of the main reasons the product can stand out. Settings, subscription, users, locations, support, and admin tools should live under the account/admin area, not in the main bottom navigation.

Desktop and tablet:

- Can use a left rail or sidebar.
- Keep the same screen structure as mobile.
- Do not design desktop first and squeeze it onto a phone.

Navigation rule:

The owner should be able to get from the home screen to a machine issue in two taps:

1. Tap machine or issue.
2. Open detail or work order.

## Dashboard Design

The dashboard is the command center. It answers:

> What needs attention right now?

Top dashboard priority:

- Fleet health score.
- Machines down.
- Open work orders.
- Waiting on parts.
- Repair cost this month.

Recommended layout:

1. Location and date context.
2. Fleet health summary.
3. Urgent machine list.
4. Open work orders.
5. Quick actions.
6. Recent activity.
7. Cost and downtime snapshot.

Mobile layout:

- Use one primary health panel at the top.
- Use compact metric tiles in a two-column grid only when they fit.
- Use lists for urgent machines and work orders.
- Keep actions thumb-friendly.

Dashboard components:

- Fleet health ring or bar.
- Status summary strip.
- Priority issue rows.
- Quick action buttons.
- Recent activity timeline.
- Small cost trend card.

Key actions:

- Add machine.
- Scan machine.
- Create work order.
- Ask AI.

Avoid:

- Four giant colored cards as the main dashboard.
- Empty dashboard space with no next action.
- Horizontal overflow on mobile.
- Generic "recent maintenance" as the main event when no work exists.

## Machine List Design

The machine list should be fast to scan while walking the floor.

Each machine row or card should show:

- Machine number.
- Type: washer or dryer.
- Status.
- Location or bank/row.
- Current issue if any.
- Last service date.
- Open work order count.
- Small photo or machine type icon.

Preferred mobile treatment:

- Compact vertical list.
- Search pinned near the top.
- Filter chips below search.
- Status rail on the left edge of each row.
- Tap row to open machine detail.

Filters:

- All.
- Running.
- Needs repair.
- Down.
- Waiting on parts.
- Washer.
- Dryer.
- Location.

Do not force machine cards into a wide desktop grid on phones.

## Machine Detail Design

Machine detail is the heart of the product.

Top section:

- Large machine number.
- Status chip.
- Machine photo.
- Make/model.
- Serial number if available.
- Location.
- QR code status.
- Primary action: Create work order.

Important sections:

- Current issue.
- Open work order.
- Maintenance timeline.
- Lifetime repair cost.
- Downtime history.
- Manuals.
- AI diagnosis history.
- Photos and receipts.

Design rules:

- Put current status and current issue above history.
- Use a timeline for repair history.
- Use cost and downtime summaries as small facts, not huge decorative widgets.
- Make "Change status" quick but protected from accidental taps.
- Use clear audit language: who changed what and when.

Machine status should always be visible near the machine number.

## Work Order Design

Work orders replace the prototype's simple maintenance ledger.

Work order list:

- Group by status or priority.
- Show machine number, issue, assigned person, age, and status.
- Make overdue or blocked work easy to spot.

Work order detail:

- Issue reported.
- Machine.
- Status.
- Assigned technician.
- Symptoms.
- Error code.
- Photos.
- AI diagnosis.
- Parts used.
- Labor cost.
- Other cost.
- Completion notes.
- Activity log.

Status flow:

- Open.
- Assigned.
- In progress.
- Waiting on parts.
- Completed.
- Canceled.

Mobile rules:

- Use a stepper or status bar for the work order state.
- Keep the main update action sticky near the bottom.
- Make photo capture and notes fast.
- Use big tap targets for technicians.

Owner view:

- Focus on priority, cost, downtime, and completion.

Technician view:

- Focus on assigned work, symptoms, photos, parts, notes, and status updates.

## AI Assist Design

AI should be framed as a repair assistant, not magic.

Recommended product name:

- Repair Assist

Repair Assist should make manual grounding visible. When a matching uploaded manual is used, the screen should clearly show "Using linked manual" and cite the manual page or section in the result. When no manual is available, the screen should say that the answer is general guidance so the user understands it is not grounded in a specific source.

Entry points:

- Dashboard quick action.
- Machine detail.
- Work order detail.
- Manuals.

AI input screen:

- Select machine.
- Enter symptoms.
- Add error code.
- Add photo.
- Choose whether to use manuals.
- Generate diagnosis.

AI result screen:

- Likely cause.
- What to inspect first.
- Suggested steps.
- Possible parts.
- Safety notes.
- Confidence language.
- Manual references when available.
- Save as work order.
- Add to existing work order.

Design style:

- Use the AI accent color sparingly.
- Keep results in a clean structured report.
- Use calm labels like "Likely cause" and "Next steps".
- Show uncertainty clearly.

Avoid:

- Chatbot-only experience as the main workflow.
- Overpromising that AI can diagnose everything.
- Full-screen purple AI branding.
- AI answers with no way to save them into operations.

## Manuals Design

Manuals should feel like a searchable technical library.

Manual list:

- Make/model.
- Machine type.
- Assigned machines.
- Upload date.
- Processing status.

Manual detail:

- Manual search.
- Sections or page references.
- Linked machines.
- Replace manual.
- Delete manual.

Processing states:

- Uploading.
- Extracting text.
- Ready.
- Needs review.
- Failed.

AI manual answers should cite the manual source or page when available.

## Reports Design

Reports should sell the business value of the subscription.

Main report areas:

- Repair spend by machine.
- Downtime by machine.
- Repeat failures.
- Cost by make/model.
- Monthly maintenance spend.
- Preventive maintenance status.
- Replace or repair score.

Report style:

- Clean charts.
- Plain labels.
- Strong takeaways.
- Export action.
- Date range controls.
- Location filter.

Use charts only when they clarify decisions.

Preferred visuals:

- Bar charts for cost by machine.
- Line chart for monthly spend.
- Ranked list for repeat failures.
- Heat map or status table for downtime.
- Scorecard for replace-or-repair recommendations.

Avoid:

- Decorative charts with no decision value.
- Dense financial dashboards that feel like accounting software.
- Tiny chart labels on mobile.

## Empty States

Empty states must help the user take the next action.

Good empty states:

- "No machines yet" with Add first machine.
- "No open work orders" with Create work order.
- "No manuals uploaded" with Upload manual.
- "No AI history" with Start Repair Assist.
- "No reports yet" with Add machines and complete work orders.

Visual style:

- Simple icon.
- Short headline.
- One sentence max.
- One primary action.
- Optional secondary link only when useful.

Avoid:

- Blank white panels.
- Clipboards or generic placeholder icons everywhere.
- Long teaching copy.
- Empty states that make the app feel unfinished.

## Mobile-First Rules

Design every primary screen for a 390px wide Android phone first.

Rules:

- No horizontal overflow.
- No tables as the primary mobile layout.
- Use lists, accordions, drawers, and stacked sections on phones.
- Keep bottom navigation visible.
- Keep primary actions thumb-friendly.
- Use 44px minimum tap targets.
- Keep important status information visible without scrolling.
- Do not place critical controls only in top-right menus.
- Make search and filters easy to reach.
- Use sticky save/update actions on long forms.
- Keep forms broken into sections.
- Preserve readability in bright lighting.
- Show loading, offline, error, and sync states.

Responsive behavior:

- Phone: one-column layout.
- Large phone: one-column with compact metric pairs.
- Tablet: two-column detail layout.
- Desktop: optional side navigation and wider reporting layouts.

The mobile app should feel intentionally designed, not like a web page squeezed into a phone.

## Google Play Screenshot Style

Store screenshots should sell the app as a business tool.

Overall style:

- Real app screens inside clean Android device frames.
- Light background.
- Short direct headline above or beside the phone.
- No clutter.
- No fake feature claims.
- Use real operational language.

Recommended screenshot sequence:

1. Command Center: "See what needs attention now."
2. Machine Detail: "Know every machine's status and history."
3. Work Orders: "Assign, track, and complete repairs."
4. Repair Assist: "Use AI to troubleshoot faster."
5. Reports: "Find the machines costing you money."
6. Manuals: "Search technical manuals from the floor."

Screenshot rules:

- Show realistic laundromat data.
- Use strong status examples, including a down machine and open work order.
- Keep text large enough to read in Google Play.
- Do not use generic marketing mockups.
- Do not show unfinished screens, placeholders, or empty data.

## Prototype Issues To Avoid

The current Maint Tracker prototype has useful product ideas, but the commercial version should not inherit its visual approach.

Avoid these prototype patterns:

- Emoji icons in navigation, cards, and empty states.
- Giant colored metric cards as the main dashboard.
- Horizontal overflow on mobile.
- Top navigation that disappears into mobile constraints.
- A dashboard that feels empty when there is no data.
- Generic Tailwind-style cards and shadows.
- Mixed icon styles.
- Placeholder manual extraction.
- A maintenance ledger where a work order workflow is needed.
- Reports that feel secondary instead of business-critical.
- AI as a separate novelty instead of part of machine and work order workflows.
- Weak empty states.
- Prototype labels such as "Laundromat Tracker".
- Unclear user roles and account context.

Keep the useful ideas:

- Machine inventory.
- Status tracking.
- Maintenance history.
- Reports.
- Manuals.
- AI diagnosis.
- Camera/photo support.
- Backup/export thinking.

Rebuild the experience around professional operations, not prototype screens.

## Design Quality Bar

LaundryOps is ready for design approval when:

- The first screen clearly shows what needs attention.
- The mobile layout has no overflow.
- The app feels like a paid business tool.
- Machine number, status, and issue are always easy to find.
- Work orders feel like a real workflow.
- AI assist is useful, structured, and operational.
- Reports show business value.
- Empty states push the user to the right next action.
- Icons, colors, type, and spacing are consistent.
- The design would look credible in Google Play screenshots.

The strongest version of LaundryOps is not the flashiest app. It is the clearest one.
