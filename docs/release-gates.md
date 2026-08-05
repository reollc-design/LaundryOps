# LaundryOps staging release gates

Current decision: **NOT READY**.

## Gate 1 — identity and scope

- [x] Approved working repository and branch recorded.
- [x] Firebase project is explicitly `laundryops-staging`.
- [x] `app/firebase.staging.json` maps the staging Hosting site and Storage bucket.
- [ ] Updated source commit is deployed and recorded after the current patches.

## Gate 2 — code and automated quality

- [x] App TypeScript lint passes.
- [x] Functions TypeScript lint passes.
- [x] Frontend trial/onboarding/downtime tests pass.
- [x] Functions manual/OCR/onboarding/Repair Assist/rate-limit/Stripe/trial/downtime/machine-status tests pass.
- [x] Runtime configuration regression passes.
- [x] Staging Stripe client rejects non-Test/Sandbox secret prefixes before any billing API call.
- [x] Repair Assist returns manual fallback when model output lacks an approved chunk citation.
- [x] No whitespace errors.
- [x] Dependency vulnerability review is complete with zero reported findings.
- [x] Rules emulator suite passes in this release run: 26/26.

## Gate 3 — staging deployment safety

- [x] Staging workflow uses explicit config and project flags.
- [x] Workflow targets an explicit list of current application Functions.
- [x] Workflow requires staging frontend values, Stripe test prices, and named secret versions without printing values.
- [x] Workflow contains post-deploy Function inventory, hosted commit marker, staging asset scan, and unauthenticated smoke checks.
- [x] Workflow runs the Firestore/Storage emulator suite with explicit staging project and bucket fixtures.
- [ ] Workflow runs successfully on the current commit.
- [ ] Deployed Function list, rules/indexes, Storage, Hosting URL, and source marker are captured after the run.
- [ ] Rollback command and previous verified commit are recorded.

## Gate 4 — security and data protection

- [x] Firestore and Storage rules deny signed-out and cross-organization access in source tests/fixtures.
- [x] Billing, AI, chunks, audit logs, memberships, downtime, and backend fields are protected in source rules.
- [x] No secret values were read or exposed.
- [x] Rules emulator suite is rerun against current rules: 26/26.
- [ ] Role matrix is verified live for owner, admin, manager, technician, viewer, and unauthorized users; source-level capability guards are present.
- [x] Invalid organization, input tampering, upload boundary, and prompt-boundary regressions pass in source/emulator tests; live persona evidence remains open.
- [ ] App Check and service-account/IAM permissions are verified for staging.

## Gate 5 — product and UX

- [x] Public landing/sign-in/onboarding shell observed at staging URL.
- [x] 390x844 and 430x844 responsive observations completed with no captured console errors.
- [x] Password reset implementation is present in the working tree.
- [ ] Authenticated screen/button/field/dialog matrix is completed on staging.
- [ ] Technician workflow, manual library, OCR, Repair Assist, reports, billing, offline, refresh, and session restore are live-tested with synthetic data.
- [ ] Accessibility labels, keyboard behavior, touch targets, error/loading/empty states, and long-list performance are signed off.

## Gate 6 — billing and AI

- [ ] Checkout page visibly shows Test/Sandbox and returns a `cs_test_...` session; source now rejects non-`sk_test_` keys.
- [ ] Monthly/annual staging prices are the intended test prices.
- [ ] Webhook updates only staging Firestore and handles duplicate/reordered/canceled/recovered states.
- [ ] One organization produces no unintended duplicate Stripe customer/subscription.
- [ ] Repair Assist uses only the selected organization’s approved matching manual.
- [ ] Manual fallback, citations, refusal, image limits, timeout, retry, and cost/latency evidence are captured.
- [x] Source-level Repair Assist selection is exactly one organization manual; duplicate manuals and uncited model output fail closed.
- [ ] OCR text/scanned/corrupt/oversized/wrong-model/no-manual cases are verified.

## Promotion rule

Do not promote until every P0/P1 is closed with code evidence and actual staging evidence. A passing build or unit suite alone is not a release decision.
