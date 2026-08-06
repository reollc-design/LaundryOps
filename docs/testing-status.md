# LaundryOps staging testing status

Last updated: 2026-08-05.

## Release identity

- Branch: `feature/stripe-checkout-dedup`.
- Preflight baseline commit: `19671120e882909b1a3159ad64505a267fcce2e6`.
- Certified staging release commit: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`.
- Firebase project: `laundryops-staging`.
- Hosting URL: [laundryops-staging.web.app](https://laundryops-staging.web.app/).
- Stripe mode: staging Test/Sandbox configuration; no live session, card, customer, or subscription was created in this run.
- Existing working-tree changes and unrelated untracked repro artifacts were present before this run and were preserved.

## Verified in this run

| Area | Result | Evidence |
| --- | --- | --- |
| Frontend TypeScript lint | PASS | `app`: `npm.cmd run lint` |
| Functions TypeScript lint | PASS | `app/functions`: `npm.cmd run lint` |
| Runtime staging-config regression | PASS | `app/functions/runtime-config.test.mjs` |
| Full Functions unit suite | PASS | Manual indexing 28/28, deletion 4/4, OCR 11/11, OCR worker 15/15, onboarding 5/5, Repair Assist 12/12, request protection 6/6, Stripe webhook state 12/12, webhook diagnostics 2/2, downtime 7/7, machine status 5/5, trial and checkout guards passed |
| Frontend trial/onboarding/downtime tests | PASS | Trial, 7/7 onboarding-flow, downtime 8/8 |
| Manual upload and invalid-organization regressions | PASS | Frontend policy and recovery tests; Functions policy tests |
| Duplicate-manual fail-closed selection | PASS | `app/functions/manual-selection.test.mjs`, including exact, normalized, compact, legacy, and paginated duplicates |
| Repair Assist prompt-boundary policy | PASS | `app/functions/repair-assist-policy.test.mjs`; manual excerpts are explicitly delimited and treated as untrusted evidence |
| Repair Assist approved-citation fallback | PASS | 12/12 Repair Assist tests; uncited or unknown-chunk model output falls back to the manual excerpt |
| Stripe Test/Sandbox key guard | PASS | `requiredStripeTestSecret` rejects non-`sk_test_` values before Stripe client creation |
| Firestore and Storage rules emulator suite | PASS | 26/26 tests passed with explicit `laundryops-staging` project and `gs://laundryops-staging.firebasestorage.app` fixture |
| Application default and staging builds | PASS | 1,620 modules; static staging scan found no production project or live Stripe markers |
| Dependency audit | PASS | App and Functions: 0 info/low/moderate/high/critical findings |
| Diff whitespace check | PASS | `git diff --check` |
| Signed-out staging shell | PASS | Live public page loaded as LaundryOps with onboarding/sign-in controls |
| Responsive shell | PASS | 390x844 and 430x844 observations; no browser console errors in captured checks |
| Staging identity | PASS | Hosted authenticated snapshot visibly showed `Cloud mode / laundryops-staging`; synthetic account was already present and was not created or changed |
| Staging Function/Hosting inventory | PASS | Staging workflow run 31056051294 succeeded; hosted page returned HTTP 200 with the exact release marker; Firebase inventory showed all 12 approved current Functions and seven retained legacy Functions |

## Synthetic data record

- Existing synthetic staging account observed: `laundryops.staging.billing.1785878378889@example.com`.
- Existing synthetic workspace snapshot showed one labeled test machine (`STG-01`) and trial/billing UI. No new account, organization, machine, manual, payment, or subscription was created in this run.
- No production tenant data was read or copied.

## Not yet proven

- The committed staging patch is proven live at the hosted marker; the two report edits in the working tree are documentation-only and are not part of the deployed commit.
- Authenticated live flows for onboarding, role personas, manuals, OCR, Repair Assist, expired trial, and billing remain incomplete because the Chrome authenticated tab became intermittently unavailable; no credentials or MFA were requested.
- Stripe Checkout has not been opened in this run. If tested later, the session must be `cs_test_...` and the page must visibly show Test/Sandbox.
- Document AI/OpenAI runtime latency, Secret Manager IAM permissions, App Check, throttled/offline behavior, 60+ machine rendering, and full browser route coverage remain open.
- Production-reference scanning of the deployed asset bundle passed in the staging workflow.
- Local build warning remains: the Firebase vendor chunk is approximately 516 kB, above Vite's 500 kB advisory threshold; this is tracked as a performance follow-up, not a release-security failure.
- Authenticated live smoke evidence, rollback execution, and the remaining full certification matrix are still pending. No rollback was needed.

## Current result

**READY FOR STAGING TEST.** The reviewed staging commit is deployed, the hosted marker matches, the exact live Function inventory is reconciled, and local quality gates pass. Authenticated synthetic smoke testing and the larger certification matrix are not complete, so this is not a production-release decision.

## Focused live role smoke-test update — 2026-08-06

Run identity remains the verified staging release:

- Firebase project: `laundryops-staging`.
- Hosted marker: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`.
- Workflow: [31056051294](https://github.com/reollc-design/LaundryOps/actions/runs/31056051294).
- No deployment, IAM change, Stripe setting change, production access, or data deletion occurred.

### Live results

| Area | Result | Evidence |
| --- | --- | --- |
| Existing owner-like synthetic workspace | PASS | `laundryops.staging.billing.1785878378889@example.com` loaded with `Cloud mode / laundryops-staging`; Home, Machines, Maintenance Records, AI Assist, Reports, and Account routes loaded. |
| Synthetic machine creation and status | PASS | Created `STG-ROLE-OWNER-20260806`; Machines totals updated to 2 total, 1 operational, 1 Needs Repair; synthetic machine was left in Needs Repair. |
| Synthetic maintenance record | PASS | Created `WO-573064`; detail page confirmed creation, Planned status, synthetic technician, and `$53.50` total. |
| Reporting/status workflow | PASS | Reports showed 1 maintenance record, `$53.50` repair spend, and one assigned synthetic technician record. |
| Manual library access boundary | PASS for route; upload write NOT VERIFIED | Manual Library showed 0 models and owner upload/index controls; no PDF was uploaded. |
| Repair Assist authorization boundary | PASS for safe no-manual state; generation NOT VERIFIED | AI Assist showed `Manual required`; no AI call was invoked without an approved manual. |
| Billing visibility | PASS for read-only visibility | Account showed Pro trial active, 13 days remaining, one linked subscription, and Manage Billing; Checkout was not opened. |
| Session restoration | PASS | Refresh returned the same synthetic account to Home with the staging marker and the two synthetic-machine totals. |
| Signed-out public shell | PASS | Isolated signed-out tab showed the public landing page, Sign in, Create Account, and no organization/billing data. |
| Administrator, manager, technician, unauthorized roles | NOT VERIFIED | V1 has no supported invite/role-membership provisioning flow; no synthetic credentials for these personas were available, so no memberships were fabricated. |
| Live onboarding completion/refresh/duplicate/failure recovery | NOT VERIFIED | Fresh account completion requires a password and creates new authenticated records; no fresh credential or controlled failure was available. |
| Live trial expiration/recovery | NOT VERIFIED | Current account has 13 days remaining; no trial or billing state was changed. |
| Full sign-out/sign-in cycle and direct protected-route denial | NOT VERIFIED | Sign-out/sign-in controls were visible, but no password was available and no isolated unauthorized membership fixture existed. |

Detailed per-role evidence, expected/actual results, and synthetic-record tracking are in [docs/staging-deployment-and-smoke-report.md](staging-deployment-and-smoke-report.md).

### Current release status

No P0/P1 runtime security, data-integrity, authentication, or billing defect was observed in the supported live paths. The focused role smoke certification is blocked by missing supported synthetic role fixtures and missing fresh lifecycle credentials/state. This is a coverage/provisioning blocker, not a code patch made during this run.

ROLE SMOKE TEST BLOCKED — no supported staging role-account fixtures or V1 role-provisioning flow exist for administrator, manager, technician, and unauthorized live tests; fresh onboarding and expired-trial credentials/state are also unavailable.

## Seeded fixture role and lifecycle certification — 2026-08-06

The previously blocked live checks were run against a temporary synthetic
fixture set in `laundryops-staging` only. The fixtures remain preserved. The
temporary seed/recovery tooling was removed after use; no product source code
was changed and no deployment occurred.

### Fixture setup

- Shared role organization: `STG-ROLE-FIXTURE-20260806`.
- Expired-trial organization: `STG-EXPIRED-FIXTURE-20260806`.
- Owner UID: `lTlWH0LGjaOVUz9BSlcFcHqrWS42`.
- Administrator UID: `csFBelaBhFfgTUzVYPHL5arXzhb2`.
- Manager UID: `mliacoXtoIS894EL38HTEefvrYS2`.
- Technician UID: `HDBIGOQBCER44VYwE5EOZ3uH61m2`.
- Unauthorized UID: `t8y6AydiqhNZSobmko87gHIiVQu1`.
- Fresh onboarding UID: `9wGH9KuxIdfPy8jhvdvMFYGi2Kw2`.
- Expired-trial UID: `3Yz0kXtK6ecsiJvf94Q1peYhKSe2`.
- No password, token, API key, or secret value was written to this report.

### A. Authorization behavior using seeded fixtures

| Fixture | Live result |
| --- | --- |
| Owner | PASS for sign-in/out, routing, organization-scoped reads, machine creation, maintenance creation, manual access, and session restoration. Billing actions and AI generation were intentionally not invoked. |
| Administrator | PASS for sign-in/out, shared-organization reads, machine creation (`STG-ADMIN-WRITE-20260806`), maintenance creation (`WO-766976`), and manual access. Billing/AI actions were not invoked. |
| Manager | PASS for sign-in/out, reads, machine creation (`STG-MANAGER-WRITE-20260806`), maintenance creation (`WO-813604`), no-delete UI boundary, and manual access. |
| Technician | PASS for reads, no machine/work-order/manual write controls, manual-read access, and machine-status update. FAIL/P2 for assigned work-order status-only UI because the entire editor was disabled (`STG-014`). |
| Unauthorized | PASS: authenticated user received `Workspace unavailable`; no target organization data or replacement workspace appeared. |
| Signed-out | PASS for public landing/sign-in gate and no protected data visibility; direct protected-route denial was not separately exposed by the SPA. |

### B. Customer-facing role invitation/provisioning

NOT VERIFIED and not present in V1. Seeded memberships prove only backend
authorization behavior. The Account page still says each user signs up for its
own workspace; no customer-facing invite or role-management flow was exercised.

### C. Lifecycle behavior

| Test | Result |
| --- | --- |
| Fresh onboarding completion | PASS; created organization `aoPtb9B5AUjCfyrucYTm`, location `bMScWRk2Cz1h4HgyGTeY`, and machine `z9Ws8owaBszsvXUYFtf7`. |
| Refresh during onboarding | FAIL/P2; step 2/3 reset to step 1/3 and unsaved fields were lost. No partial records were created. |
| Duplicate onboarding submission | PASS; two final clicks produced one workspace, one machine, and one onboarding result. |
| Failed write/retry | PASS for validation failure and retry; network-failure recovery remains NOT VERIFIED. |
| Session restoration | PASS; owner refresh restored the same staging account and four-machine workspace. |
| Expired-trial restriction | PASS; hosted lock screen showed trial ended, 0 days left, plan controls, Manage Billing, and Sign Out only. |
| Trial recovery | PASS for temporary seeded active-state recovery and refresh; fixture was returned to expired state. Customer-facing Stripe recovery was not run. |

### Current result

The requested fixture-based role and lifecycle tests are complete. No P0 was
observed. Open P2 findings are `STG-014` (technician status-only workflow UI)
and `STG-015` (onboarding refresh loses unsaved progress). This is not a
production-release approval.

Detailed evidence and all synthetic records are in [docs/staging-deployment-and-smoke-report.md](staging-deployment-and-smoke-report.md).

STAGING ROLE AND LIFECYCLE TESTS COMPLETE

## Manual, AI, and Stripe validation hold - 2026-08-06

Run identity remains `laundryops-staging`, hosted at
`https://laundryops-staging.web.app`, with current verified marker
`b8c9ad58584c1be3f580d69dda6c7ec517f2046c`. No deployment, IAM change, Stripe
setting change, existing-fixture change, or data deletion occurred.

### Safe evidence completed

| Area | Result | Evidence |
| --- | --- | --- |
| Synthetic manual inputs | PASS locally | Correct-model text PDF extracted 260 characters and included `E01` and `E DR`; image-only PDF loaded with no matching text; wrong-model and corrupt fixtures classified correctly. |
| Manual/OCR deterministic behavior | PASS locally | Functions build; manual indexing 28/28, OCR 11/11, OCR worker 15/15, selection, upload policy, and alias matching passed. |
| Repair Assist deterministic behavior | PASS locally | 12/12 Repair Assist tests, including citations, manual fallback, timeout, malformed photo, bounded photo, and unsupported-output cases. |
| Stripe deterministic behavior | PASS locally | Test-key guard, checkout disposition/idempotency, webhook state 12/12, webhook diagnostics 2/2, and request protection passed. |
| Frontend checks | PASS | TypeScript lint, onboarding 7/7, trial, and downtime 8/8 passed. |
| Hosted signed-out shell | PASS | In-app staging browser loaded `LaundryOps` and the public sign-in/create-account controls from the staging hostname. |

### Hosted checks not claimed as complete

| Hosted test group | Result | Reason |
| --- | --- | --- |
| PDF upload, text indexing, scanned OCR, retry, failure recovery, wrong-model upload, manual visibility, metadata protection, and live error-code citations | NOT VERIFIED | The hosted PDF path invokes Google Document AI and would create Storage/Firestore records; no bounded no-charge OCR harness was available. |
| Matching-manual Repair Assist, citation accuracy, photos, latency, timeout, and live cost limits | NOT VERIFIED | The hosted endpoint invokes OpenAI after manual selection; no external AI call was started. Missing-manual preflight refusal remains PASS from the prior live role run. |
| Stripe Test-mode Checkout, webhook persistence, duplicate protection, cancellation, reactivation, and Stripe past-due lifecycle | NOT VERIFIED | No Checkout session was opened, so there is no live `cs_test_...` or Firestore webhook evidence. No Stripe customer, subscription, card, or webhook was created. |

The detailed per-test record is in
[docs/staging-deployment-and-smoke-report.md](staging-deployment-and-smoke-report.md),
including environment, role, input, expected/actual behavior, result, evidence,
and created-record status. `STG-014` and `STG-015` remain open and were not
modified.

STAGING TESTS BLOCKED - live Document AI/OCR, OpenAI Repair Assist, and Stripe Test-mode evidence require external provider/resource calls without a bounded no-charge staging harness.

## STG-014/STG-015 remediation - 2026-08-06

The focused staging patch is limited to the two requested P2 defects. No
Document AI, OpenAI, Stripe, production resource, existing fixture, or
temporary Chrome profile was touched.

| Defect | Local evidence | Hosted evidence |
| --- | --- | --- |
| STG-014 technician assigned-work-order status UI | PASS: assigned active technicians resolve to `assigned-status`; unassigned/inactive users remain read-only; `4/4` work-order regression tests, lint, and rules suite pass | Pending deployment and one live status update on seeded `WO-STG-ROLE-01` |
| STG-015 onboarding refresh loses step/draft | PASS: UID-scoped session persistence, corrupt/stale-value rejection, user-switch reset, and completion cleanup; `11/11` onboarding regression tests and lint pass | Pending deployment and one live refresh during fresh synthetic onboarding |

The staging workflow will provide the build gate and hosted release marker;
the existing synthetic fixtures remain preserved for the live checks.
