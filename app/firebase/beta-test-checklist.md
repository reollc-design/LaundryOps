# LaundryOps Beta Test Checklist

Use this checklist before opening public beta.

## Account + Onboarding

- Create new owner account.
- Confirm 14-day trial messaging appears.
- Complete onboarding (company, location, machine).
- Confirm `users/{uid}` profile is created.
- Confirm `organizations/{orgId}` and `memberships/{uid}` are created.

## Core Operations

- Add machine and verify it appears in machine list and search.
- Create work order and verify status transitions.
- Confirm work order updates are visible in list and detail screens.

## Billing

- From Account screen, select `Annual` and start checkout.
- Confirm Stripe checkout shows `$149.99 per year` after trial.
- From Account screen, select `Monthly` and start checkout.
- Confirm Stripe checkout shows `$14.99 per month` after trial.
- Complete one test checkout and verify webhook updates Firestore subscription fields.

## Manuals + Repair Assist

- Upload a PDF manual from Manual Library.
- Confirm manual status becomes `Indexed` and chunk docs are written.
- In AI Assist, generate manual answer with symptoms + error code.
- Confirm response includes manual citations and not generic-only text.

## Security + Permissions

- Confirm non-member account cannot read another org's records.
- Confirm technician cannot update billing/subscription fields.
- Confirm manual uploads are blocked for unsupported roles.

## Stability

- Test mobile viewport (390x844) and desktop.
- Verify no blocking runtime errors in browser console.
- Verify app survives sign-out and sign-in without data corruption.

## Release Gate

- Firebase Hosting deploy complete.
- Functions deploy complete.
- Stripe webhook endpoint active with required events.
- Critical flows pass twice with fresh accounts.
