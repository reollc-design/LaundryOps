# LaundryOps staging testing status

Last updated: 2026-08-06.

## IAM grant and one-upload retest - 2026-08-06 15:35:26 -04:00

| Check | Result | Evidence |
| --- | --- | --- |
| Exact staging IAM grant | PASS | `laundryops-staging` / `323299053901`; only `roles/firebaserules.firestoreServiceAgent` was added to `service-323299053901@firebase-rules.iam.gserviceaccount.com`. |
| IAM propagation | PASS | After a 45-second wait, read-only policy verification found the exact unconditioned binding present. |
| Existing synthetic owner | PASS | UID `Nyfpq9nTfoTDXO1TopYMOEqQGEp1` and organization `STG-PROVIDER-20260806-NYFPQ9NT` were reused. |
| One manual upload retest | FAIL / BLOCKED | The exact path ending in `ngZNuEukLAorUkStBsEF/STG-TestCo-TEST-ROLE-01-text.pdf` returned `storage/unauthorized` in the hosted UI. |
| OCR and Repair Assist | NOT RUN | Stopped immediately after the required upload failed; no Document AI or OpenAI request occurred. |

The authorized IAM binding is present, but Storage authorization still fails
for the authenticated synthetic owner. No retry, code change, rules change,
deployment, or additional IAM change was made.

## Storage authorization diagnosis - 2026-08-06 14:26:15 -04:00

| Check | Result | Evidence |
| --- | --- | --- |
| Project and bucket | PASS | Local env, hosted bundle, workflow, and deployed configuration resolve to `laundryops-staging` and `laundryops-staging.firebasestorage.app`. |
| Auth context | PASS | UID `Nyfpq9nTfoTDXO1TopYMOEqQGEp1`; organization `STG-PROVIDER-20260806-NYFPQ9NT`; profile default organization, owner UID, and active owner membership match. |
| Trial/onboarding gate | PASS | Organization is `trialing` with `trialEndsAt=2026-08-20T17:15:52.418Z`; account is authenticated and fully provisioned. |
| Client/backend/rules path | PASS | Client uses the Function-returned path; Function and deployed rule use `orgs/{orgId}/manuals/{uid}/{manualId}/{fileName}`. |
| Local/deployed Storage rules | PASS | Active `firebase.storage` release source matches local `app/storage.rules`; PDF, MIME, size, role, organization, and trial checks are intentionally restrictive and aligned. |
| Bounded upload authorization | FAIL / BLOCKED | The two already-used attempts returned `storage/unauthorized`; no third attempt was made and no PDF object exists. |

The exact blocker is the missing cross-service Firebase Rules binding in
`laundryops-staging`: the read-only project IAM policy has no
`roles/firebaserules.firestoreServiceAgent` grant for
`service-323299053901@firebase-rules.iam.gserviceaccount.com`. The deployed
Storage rules depend on `firestore.exists` and `firestore.get` to authorize
the organization and membership, so the live request is denied even though
the path, bucket, identity, role, and trial are correct. No IAM change was
made under this task's scope. OCR and grounded Repair Assist remain NOT
VERIFIED; provider request counts for this diagnosis are Document AI `0/2`
and OpenAI `0/3`.

Required next action: a staging administrator must grant only that exact role
to that exact Firebase Rules service agent, verify propagation, and then run
one bounded upload. Do not change Storage rules or retry before verification.

## Current authoritative inventory and P2 retests — 2026-08-06 12:36:24 -04:00

- Deployment remains accepted as successful; no redeploy occurred.
- Project: `laundryops-staging`; hosted marker:
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Read-only `functions:list` evidence: 19 active Functions in `us-central1`;
  12 approved Functions present; seven retained legacy Functions present;
  zero missing and zero unexpected. `createStripeCheckoutSession` is active.
- The false-negative inventory check was corrected locally in the staging-only
  workflow by replacing `grep -q` with a full-stream fixed-string match. The
  workflow was not redeployed.
- STG-014: **PASS**. Fresh synthetic account UID
  `jrmbzy7daFZwfF8CE2VAvXfjL2S2` loaded the isolated organization
  `STG-014-TECH-20260806-JRMBZY7D` at the hosted staging URL. The assigned
  `STG-014-WORKORDER` showed status-only controls with detail fields disabled;
  changing `Planned` to `In Progress` saved successfully. Read-only Firestore
  verification matched `status=in-progress`, `statusLabel=In Progress`, and
  `updatedBy=jrmbzy7daFZwfF8CE2VAvXfjL2S2`.
- STG-015: **PASS**. Live hosted onboarding remained on step `2/3` and
  preserved both synthetic location fields after refresh.
- No Function was changed or deleted. The synthetic account and provider-test
  records created for this run were preserved. Stripe was used only in bounded
  Test/Sandbox mode; no OpenAI or Document AI call occurred.
- `agent.md` is absent; protected `AGENTS.md` was not modified.

## Bounded live provider integrations - 2026-08-06 14:01:21 -04:00

Environment: `laundryops-staging`; hosted marker
`22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`; synthetic provider workspace
`STG-PROVIDER-20260806-NYFPQ9NT`.

| Area | Result | Evidence |
| --- | --- | --- |
| Text PDF upload/index | FAIL / BLOCKED | Two controlled attempts both returned Storage `storage/unauthorized`; two failed manual metadata records remain with `status=missing`; no file object or OCR request was created. |
| Scanned one-page OCR | NOT VERIFIED | Stopped before OCR because the required Storage upload path is blocked. Document AI requests used: 0/2. |
| Wrong-model rejection | NOT VERIFIED | Could not reach model validation after Storage rejection. |
| Missing-manual Repair Assist | PASS | Hosted UI refused with the explicit no-indexed-manual message. No grounded answer was generated. |
| Grounded Repair Assist/citations/photo | NOT VERIFIED | Requires a successfully indexed matching manual. OpenAI requests used: 0 evidenced. |
| Stripe Test mode | PASS | One `cs_test_...` Checkout session; Checkout and Billing Portal showed Sandbox/Test mode. |
| Stripe Firestore webhook | PASS | One synthetic customer and subscription persisted; `customer.subscription.created` was recorded. |
| Stripe duplicate protection | PASS | Account page switched to Manage Billing; exactly one Firestore subscription record exists. |
| Stripe cancellation | PASS | Same subscription showed “Cancels Aug 20”; `customer.subscription.updated` was recorded. |

No uncontrolled retries were made. No production, IAM, deployment, source code,
OpenAI, or live Stripe resource was touched.

## Release identity

- Branch: `feature/stripe-checkout-dedup`.
- Preflight baseline commit: `19671120e882909b1a3159ad64505a267fcce2e6`.
- Certified staging release commit: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`.
- Current STG-014/STG-015 commit: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Push: succeeded to `origin/feature/stripe-checkout-dedup`.
- Hosted marker: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Firebase project: `laundryops-staging`.
- Hosting URL: [laundryops-staging.web.app](https://laundryops-staging.web.app/).
- Stripe mode: staging Test/Sandbox configuration; one synthetic test customer,
  one test subscription, and one `cs_test_...` Checkout session were used. No
  live Stripe resource was created.
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
| Staging Function/Hosting inventory | PASS with workflow verification defect | Run 31109412248 deployed staging Functions/rules/Storage/Hosting; hosted page returned HTTP 200 with the exact marker; independent `functions:list` showed 19 active Functions, including all 12 current Functions and seven retained legacy Functions. The workflow's final grep falsely reported `createStripeCheckoutSession` missing. |

## Synthetic data record

- Existing synthetic staging account observed: `laundryops.staging.billing.1785878378889@example.com`.
- Existing synthetic workspace snapshot showed one labeled test machine (`STG-01`) and trial/billing UI. No new account, organization, machine, manual, payment, or subscription was created in this run.
- No production tenant data was read or copied.

## Not yet proven

- The committed staging patch is proven live at the hosted marker; the two report edits in the working tree are documentation-only and are not part of the deployed commit.
- Authenticated live flows for onboarding, role personas, manuals, OCR, Repair Assist, expired trial, and billing remain incomplete because the Chrome authenticated tab became intermittently unavailable; no credentials or MFA were requested.
- One Stripe Checkout session was opened and completed in Test/Sandbox mode;
  the session was `cs_test_...`, the page showed Sandbox, and the same test
  subscription was later canceled at period end.
- Document AI/OpenAI runtime latency, Secret Manager IAM permissions, App Check, throttled/offline behavior, 60+ machine rendering, and full browser route coverage remain open.
- Production-reference scanning of the deployed asset bundle passed in the staging workflow.
- Local build warning remains: the Firebase vendor chunk is approximately 516 kB, above Vite's 500 kB advisory threshold; this is tracked as a performance follow-up, not a release-security failure.
- Authenticated live smoke evidence, rollback execution, and the remaining full certification matrix are still pending. No rollback was needed.

## Current result

**NO-GO FOR FULL PROVIDER CERTIFICATION.** The reviewed staging commit and
independent Function inventory are complete. Stripe Test-mode and missing-manual
Repair Assist checks passed, but Storage authorization blocked manual upload,
OCR, wrong-model live rejection, grounded Repair Assist, citations, and photo
validation. This is not a production-release decision.

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

## Authoritative Storage root-cause correction - 2026-08-06 15:44:52 -04:00

| Check | Result | Evidence |
| --- | --- | --- |
| Hosted bucket and project | PASS | Firebase Storage Rules console for `laundryops-staging` selected `laundryops-staging.firebasestorage.app`; hosted marker is `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`. |
| Exact attempted path | PASS | `orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/ngZNuEukLAorUkStBsEF/STG-TestCo-TEST-ROLE-01-text.pdf`. |
| Authenticated identity | PASS / PARTIAL | Hosted UI and Authentication console showed the synthetic owner email and UID `Nyfpq9nTfoTDXO1TopYMOEqQGEp1`; email verification and custom claims were not exposed by the read-only UI and are not referenced by Storage rules. |
| Profile, membership, trial | PASS | Prior read-only Firestore evidence shows matching owner/profile organization, active owner membership, and unexpired trial through `2026-08-20T17:15:52.418Z`. |
| Deployed rules | PASS | Console displayed the deployed Storage rules and the active warning that cross-service database calls are not configured. |
| Local rules/client path | PASS | Local rules, client Function-returned path, and bucket match; local emulator suite passed 26/26. |
| Token freshness | NOT INDEPENDENTLY VERIFIED | No browser token or session store was inspected; the deterministic project warning explains the denial without requiring a stale-token hypothesis. |
| Hosted authorization | FAIL / BLOCKED | The console warning means `firestore.exists`/`firestore.get` cannot authorize the Storage request, so the manual write condition evaluates to denial. |

The earlier missing-IAM-binding conclusion is superseded. The exact root
cause is **staging Firebase Storage-to-Firestore cross-service Rules
integration not enabled**. The Firebase Console `Fix issue` flow remains
untouched; no additional IAM role, rules change, deployment, or upload was
made.

## STG-014/STG-015 deployment follow-up - 2026-08-06

- Commit: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Commit message: `fix: repair technician status and onboarding refresh persistence`.
- Automated verification after commit: frontend lint PASS; onboarding and
  work-order regression tests PASS (`11/11` and `4/4`); Functions suite PASS;
  Firestore/Storage rules PASS (`26/26`) using the explicit
  `laundryops-staging` emulator target and bundled supported Java runtime.
- Deployment result: staging resources deployed in workflow run
  [31109412248](https://github.com/reollc-design/LaundryOps/actions/runs/31109412248);
  the final workflow inventory check returned red on a false-negative
  `createStripeCheckoutSession` lookup.
- Hosted marker: verified as
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- STG-014 live retest: NOT VERIFIED; the current Chrome session is not the
  seeded technician and no approved technician password is available.
- STG-015 live retest: NOT VERIFIED; the current Chrome session is not the
  fresh-onboarding fixture and no approved fresh-fixture password is available.
- No Stripe, OpenAI, Document AI, production, IAM, fixture, or Chrome-profile
  action occurred.

## STG-014/STG-015 remediation - 2026-08-06

The focused staging patch is limited to the two requested P2 defects. No
Document AI, OpenAI, Stripe, production resource, existing fixture, or
temporary Chrome profile was touched.

| Defect | Local evidence | Hosted evidence |
| --- | --- | --- |
| STG-014 technician assigned-work-order status UI | PASS: assigned active technicians resolve to `assigned-status`; unassigned/inactive users remain read-only; `4/4` work-order regression tests, lint, and rules suite pass | Pending deployment and one live status update on seeded `WO-STG-ROLE-01` |
| STG-015 onboarding refresh loses step/draft | PASS: UID-scoped session persistence, corrupt/stale-value rejection, user-switch reset, and completion cleanup; `11/11` onboarding regression tests and lint pass | Pending deployment and one live refresh during fresh synthetic onboarding |

Independent staging evidence: `functions:list` returned 19 ACTIVE Functions,
including `createStripeCheckoutSession`, the four required remediation
Functions, and all seven retained legacy Functions. The existing synthetic
fixtures remain preserved for the live checks.

## Repair Assist backend diagnosis - 2026-08-07

| Check | Result | Evidence |
| --- | --- | --- |
| Logging path | PASS | Google Cloud Logs Explorer was queried in `laundryops-staging` for both `cloud_function` and `cloud_run_revision` resources. The Cloud Run trace query returned the current invocation; the Cloud Functions resource query returned no rows. |
| Active revision and runtime | PASS | Cloud Run service `generaterepairassist`, region `us-central1`, revision `generaterepairassist-00005-hij` receiving 100% traffic; runtime service account `323299053901-compute@developer.gserviceaccount.com`. |
| Secret binding/access status | PASS / NOT EXERCISED | Revision configuration binds `projects/laundryops-staging/secrets/OPENAI_API_KEY:1`; Secret Manager shows version 1 enabled. The failed request never reached `openai_request`, so runtime secret retrieval was not exercised and no secret value was read. |
| Model and endpoint | PASS | No `OPENAI_MANUAL_MODEL` runtime override is present, so source default `gpt-5.5` applies. The source constructs the OpenAI client without a custom base URL, so the SDK default endpoint applies. No provider request was made for this trace. |
| Auth/org context | PASS | Existing synthetic owner UID `Nyfpq9nTfoTDXO1TopYMOEqQGEp1` and organization `STG-PROVIDER-20260806-NYFPQ9NT` were reused. Profile, owner membership, completed onboarding, and future trial were previously verified. |
| Selected manual/index/citations | PASS | Manual `EdHy4QUsylAuPA8CoqXx` is `indexed`, model `TestCo TEST-ROLE-01`, one chunk, active chunk collection `chunks_vmsj5rdko_l466g4`, active error-code collection `errorCodes_vmsj5rdko_h82nlf`, and one linked machine. Its `e01` index maps aliases including `E01`, `E-01`, and `E 01` to `chunk-001`. A second indexed scanned manual `c1suyjJgksBvJAZkvxLI` has the same model, producing an ambiguous match. |
| Failure stage | FAIL | The safe error payload contained `errorName=Error`, `stage=machine_resolved`, and `timeout=false`; the Cloud Run request returned HTTP 400 in 882 ms. No provider status/code was present because no provider call occurred. |

Diagnosis: **application logic - ambiguous indexed manual selection**. The backend intentionally fails closed when more than one indexed manual matches a model. This is not a secret-access, provider/API, authorization, missing-chunk, or timeout failure. No OpenAI request was retried or made during this diagnosis.

## STG-017 focused remediation checkpoint - 2026-08-07 14:12 -04:00

| Test / evidence | Environment | Result |
| --- | --- | --- |
| Duplicate indexed manuals without selection | Local Functions regression suite | PASS - stable `manual_selection_required` code/message |
| Explicit valid manual selection | Local Functions regression suite | PASS - selected manual is returned and validated |
| Wrong-organization manual | Local Functions regression suite | PASS - selection is rejected as not found |
| Manufacturer/model mismatch | Local Functions regression suite using production matcher | PASS - mismatch rejected |
| Exactly one indexed match | Local Functions regression suite | PASS - single match may auto-select |
| UI wiring | Local TypeScript lint and staging build | PASS - selector sends `manualId` |
| Full Functions tests | Local staging code | PASS |
| Firestore/Storage rules | Local emulators with project/bucket set to `laundryops-staging` | PASS - 26/26 |
| Hosted marker after this patch | `laundryops-staging` | NOT RUN - commit and focused deployment are pending |
| One bounded live Repair Assist request with `EdHy4QUsylAuPA8CoqXx` | `laundryops-staging` | NOT RUN - deployment is pending; no provider call made |

Current release state: **STAGING DEPLOYMENT BLOCKED PENDING COMMIT**. The
focused Hosting build can only carry a truthful reviewed marker after this
working-tree patch is committed. No source, IAM, secret, production, or
provider action was taken to bypass that control.

## Bounded provider retest - 2026-08-06

| Test | Environment / input | Result | Evidence |
| --- | --- | --- | --- |
| Storage cross-service authorization | `laundryops-staging`; hosted Storage Rules console | PASS | Warning, `Fix issue`, and `Attach permissions` were absent after the authorized staging action. Upload was then tested once per approved bounded flow. |
| Text manual upload/index | Owner fixture; `STG-TestCo-TEST-ROLE-01-text.pdf`; model `TestCo TEST-ROLE-01` | PASS | Hosted UI: `Manual uploaded and indexed`, `Indexed`, one page, one machine using the model. |
| Scanned one-page OCR | Owner fixture; `STG-TestCo-TEST-ROLE-01-scanned.pdf`; same model | PASS | Hosted UI: `Indexed`, one page, one machine using the model. This was the second and final bounded manual-index/OCR action; no further OCR request was made. |
| Wrong-model rejection | Synthetic wrong-model PDF | NOT VERIFIED | No third Document AI/OCR request or uncontrolled upload was made. Local fixture preserved. |
| Grounded Repair Assist | Owner fixture; `STG-PROVIDER-01`, `E01`, indexed manual selected | FAIL | Hosted UI returned `Repair Assist failed` / `Could not generate repair guidance`; no answer or citation was produced. One OpenAI-backed request only; no retry. |
| Repair Assist backend evidence | Explicit `functions:log` for `generateRepairAssist`, staging project/config | NOT VERIFIED | Log retrieval timed out twice; exact backend/provider cause remains unknown. |

No Stripe, production, IAM, source, rules, deployment, or fixture-cleanup
action occurred during this pass. The remaining provider blocker is the failed
grounded Repair Assist request and the unavailable backend log evidence.
