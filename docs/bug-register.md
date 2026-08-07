# LaundryOps staging bug register

Last updated: 2026-08-06.

## IAM grant and one-upload retest - 2026-08-06 15:35:26 -04:00

**STG-016 remains OPEN.** The explicitly authorized staging-only binding was
added and verified after propagation:
`service-323299053901@firebase-rules.iam.gserviceaccount.com` with
`roles/firebaserules.firestoreServiceAgent`. The existing Firebase Rules
system role was preserved.

The existing synthetic owner then made exactly one upload attempt. The exact
path was
`orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/ngZNuEukLAorUkStBsEF/STG-TestCo-TEST-ROLE-01-text.pdf`.
The hosted UI returned `storage/unauthorized` with “User does not have
permission to access” that path. No retry was made. OCR and Repair Assist
remain blocked; no Document AI or OpenAI request occurred.

## Storage authorization diagnosis - 2026-08-06 14:26:15 -04:00

**STG-016 remains OPEN.** The exact synthetic request context was verified:
UID `Nyfpq9nTfoTDXO1TopYMOEqQGEp1`, organization
`STG-PROVIDER-20260806-NYFPQ9NT`, active `owner` membership, matching profile
default organization, and a non-expired `trialing` organization. The two
attempted paths were under
`orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/`;
both returned `storage/unauthorized`.

The local client, Function path construction, bucket
`laundryops-staging.firebasestorage.app`, local `app/storage.rules`, and the
active deployed Storage rules release all agree. A read-only IAM policy check
found no `roles/firebaserules.firestoreServiceAgent` binding for
`service-323299053901@firebase-rules.iam.gserviceaccount.com`. Because the
Storage rules call `firestore.exists` and `firestore.get`, this missing
cross-service service-agent role is the exact staging authorization blocker.
No IAM change, rule change, code patch, or third upload attempt was made.
Required next action: grant only that role to that principal in
`laundryops-staging`, verify propagation, then rerun one bounded upload.

## Current P2 retest checkpoint — 2026-08-06 12:36:24 -04:00

- **STG-014 — PASS live:** At hosted marker
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`, fresh synthetic technician UID
  `jrmbzy7daFZwfF8CE2VAvXfjL2S2` opened assigned work order
  `STG-014-WORKORDER` in organization `STG-014-TECH-20260806-JRMBZY7D`.
  Detail fields were disabled, the status-only control changed `Planned` to
  `In Progress`, and the save succeeded. Read-only Firestore verification
  matched the updated status and technician UID. No password, token, or MFA
  value was used or recorded.
- **STG-015 — PASS live:** A fresh synthetic Email/Password account reached
  onboarding step `2/3`; after entering `STG-015 Refresh Test Location` and
  `15 Synthetic Refresh Way`, a refresh preserved step `2/3` and both values at
  the hosted staging URL.
- The staging Function inventory is authoritative and read-only: 19 active
  Functions, all 12 approved Functions, and all seven retained legacy
  Functions. `createStripeCheckoutSession` is present. No Function was
  modified or deleted.
- No Stripe, OpenAI, or Document AI call occurred. `agent.md` does not exist;
  the protected root `AGENTS.md` was not edited.

## Bounded provider-integration checkpoint - 2026-08-06 14:01:21 -04:00

- Stripe Sandbox integration passed within the approved limit: one synthetic
  customer, one subscription, one `cs_test_...` Checkout session, one created
  event, one same-subscription cancellation, and exactly one Firestore
  subscription record.
- Missing-manual Repair Assist refusal passed. Grounded Repair Assist,
  citations, photo handling, OCR, and wrong-model live rejection remain
  unverified because Storage rejected both controlled manual uploads.
- **STG-016** is open for the staging provider path: owner manual upload is
  denied by Firebase Storage even after the isolated synthetic owner membership
  was present. No source or rules change was made during this pass.

## Certification hold - 2026-08-06

The current live provider pass added STG-016. The earlier certification items
below are historical and must not be treated as fixed unless their current
checkpoint above says so:

- `STG-014` is fixed in committed and hosted staging code
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`; live regression evidence remains
  NOT VERIFIED because the available synthetic Chrome session is not the
  seeded technician and no approved technician password is available.
- `STG-015` is fixed in committed and hosted staging code
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`; live regression evidence remains
  NOT VERIFIED because the available session is not the fresh-onboarding
  fixture and no approved fresh-fixture password is available.

The current certification blocker is environmental/test-safety evidence rather
than a new application bug: hosted PDF indexing calls Google Document AI,
Repair Assist calls OpenAI, and Checkout creates Stripe Test-mode resources.
Those live actions were not invoked without a bounded no-charge harness. Local
regression and policy suites passed, but local passes do not close the hosted
manual/OCR, AI, or Stripe evidence gaps.

Severity: P0 = security/data-loss/billing/app-blocking; P1 = critical workflow failure; P2 = significant usability/reporting/security hardening; P3 = polish.

| ID | Severity | Reproduction / evidence | Expected | Actual | Owner | Status | Regression test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STG-001 | P1 | Remove `LAUNDRYOPS_APP_URL` or `LAUNDRYOPS_ALLOWED_CORS_ORIGINS` from a non-emulator Functions runtime; inspect `app/functions/src/index.ts`. | Missing environment must fail closed. | Previous code fell back to production URL/CORS. | Engineering | FIXED IN WORKING TREE; deployment pending | `app/functions/runtime-config.test.mjs` |
| STG-002 | P1 | Remove staging Stripe price env values and call billing plan selection. | Checkout must stop without an explicit configured staging price. | Previous code had hardcoded default price IDs. | Engineering | FIXED IN WORKING TREE; deployment pending | `app/functions/runtime-config.test.mjs` |
| STG-003 | P1 | Run staging workflow and inspect deployed Function list. | All current application Functions used by the client must be deployed and verified. | Previous workflow deployed only onboarding and billing Functions. | Release engineering | FIXED IN WORKING TREE; workflow run pending | Workflow exact list plus post-deploy inventory |
| STG-004 | P1 | Open signed-out Sign In and click “Forgot password?”. | Firebase Auth should request a reset email with safe generic messaging. | Previous UI displayed a placeholder only. | Frontend engineering | FIXED IN WORKING TREE; live synthetic verification pending | Frontend lint; live staging test with approved synthetic email |
| STG-005 | P1 | Create two indexed manuals with the same organization/model and request Repair Assist. | Ambiguous source manuals must not be selected silently. | Previous exact/normalized queries used `limit(1)` and could select arbitrarily. | AI/backend engineering | FIXED IN WORKING TREE; deployment and live regression pending | Functions suite; add staging duplicate-manual refusal test |
| STG-006 | P1 | Use a technician-role account to edit a maintenance record or upload a manual/photo. | UI affordances and backend role permissions must agree. | Rules restrict technician writes while UI exposed broader workflows. | Product/security | FIXED IN WORKING TREE; live role matrix pending | Rules emulator 26/26, app lint, capability-guarded UI handlers |
| STG-007 | P1 | Deploy a stale/generated `app/dist` bundle and inspect its Firebase/Function references. | Staging output must contain only staging references. | A stale local dist was reported with production references; live hosted marker was separately observed as staging. | Release engineering | FIXED IN WORKING TREE; workflow proof pending | Staging build scan and workflow asset scan/commit marker |
| STG-008 | P2 | Upload a 25 MB manual or a filename such as `.pdf.exe`. | Client, backend, and Storage rules should enforce the same safe PDF policy. | Previous rules accepted MIME variants and filenames without an end anchor, while using a strict `< 25 MB` boundary. | Security/frontend | FIXED IN WORKING TREE; live upload proof pending | Frontend/Functions policy tests and Storage rules 26/26 |
| STG-009 | P2 | Delete or invalidate the organization referenced by `users/{uid}.defaultOrganizationId`, then reopen a protected screen. | User should see an invalid-workspace recovery state and be signed out or routed to setup. | Client could render an unknown workspace state instead of a clear recovery path. | Frontend/backend | FIXED IN WORKING TREE; live invalid-workspace test pending | `app/src/organizationRecovery.test.mjs`, trial hook guards |
| STG-010 | P2 | Request Repair Assist with duplicate machine identifiers or a large manual. | Machine/manual resolution and chunk reads should be deterministic and bounded. | Fallback scans can select first matches and load all chunks. | AI/performance | OPEN | Duplicate-ID and 60+ machine/manual performance tests |
| STG-011 | P1 | Run Repair Assist with manual text containing instruction-like content or a photo with text. | Uploaded material remains source evidence, not control instructions; unsupported answers must refuse or qualify. | Previous prompt allowed general knowledge when the manual was insufficient and did not explicitly delimit untrusted manual instructions. | AI/security | FIXED IN WORKING TREE; deployment and live regression pending | Repair Assist policy test plus existing 10/10 Repair Assist suite |
| STG-012 | P2 | Build the staging app and inspect bundle-size warnings. | Operator screens should remain responsive at expected scale. | Firebase vendor chunk is approximately 516 kB, above Vite's advisory threshold. | Performance | OPEN; non-blocking follow-up | 60+ machine/manual performance harness |
| STG-013 | P0 | Configure a live Stripe secret in a staging Functions runtime and invoke billing. | Staging must reject live Stripe credentials before any customer, checkout, portal, or webhook operation. | Previous code accepted any non-empty Stripe secret; source now fails closed unless it matches `sk_test_...`. | Billing/security | FIXED IN WORKING TREE; runtime and live staging proof pending | Runtime-config test plus deployed Test-mode checkout evidence |
| STG-014 | P2 | Open assigned work order `STG-014-WORKORDER` as the fresh synthetic technician at hosted marker `22a92f3b963c6efd4f6e4f99b01adc9199d4a9db`. | The supported technician status-only workflow should be visible and intentional. | Fresh synthetic technician saw disabled detail fields, changed `Planned` to `In Progress`, saved successfully, and Firestore read-back confirmed the status and technician UID. | Product/security | FIXED IN HOSTED CODE; LIVE VERIFICATION PASS | `app/src/workOrderFlow.test.mjs`; 26/26 rules tests; hosted technician smoke test |
| STG-015 | P2 | Sign in as a fresh synthetic account, complete step 1, continue to step 2/3, enter location data, then refresh at hosted marker `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`. | Onboarding should resume the current step and preserve the unsaved draft, or clearly warn before losing it. | Hosted marker is correct; the live UI retest is NOT VERIFIED because the current session is not the fresh-onboarding fixture and no approved fresh-fixture password is available. | Product/frontend | FIXED IN HOSTED CODE; LIVE VERIFICATION NOT VERIFIED | `app/src/onboardingFlow.test.mjs`; hosted onboarding refresh test pending approved fixture login |
| STG-016 | P1 | As the synthetic owner of `STG-PROVIDER-20260806-NYFPQ9NT`, upload `STG-TestCo-TEST-ROLE-01-text.pdf` for `TestCo TEST-ROLE-01` at the verified staging marker. | Owner/admin manual upload should store the PDF and allow indexing. | Two controlled attempts returned Firebase Storage `storage/unauthorized`; Firestore metadata remains `status=missing` with no stored PDF. This blocks live OCR and grounded Repair Assist certification. | Security/release engineering | OPEN - STAGING PROVIDER BLOCKER | Storage rules emulator coverage plus bounded hosted upload/index smoke test |

No P0 has been confirmed. P1 items marked “fixed” are not release-closed until the exact staging commit is deployed and the live regression is observed.

## STG-016 root-cause correction - 2026-08-06 15:44:52 -04:00

The prior entry attributed STG-016 only to a missing Firebase Rules service
agent binding. That conclusion is superseded. After the exact authorized IAM
binding was present and verified, the hosted Firebase Storage Rules console for
`laundryops-staging.firebasestorage.app` still displayed:

> Your rules make use of cross-service database calls, but your project is not configured to execute those calls

The deployed manual rule depends on `firestore.exists` and `firestore.get`
inside `isOrganizationActive` and `hasRole`. The project-level cross-service
Rules integration is not enabled, so the organization and membership reads
cannot authorize the upload and the exact hosted request remains
`storage/unauthorized`.

Status remains **OPEN - STAGING PROVIDER BLOCKER**. Classification: another
specific cause - Storage-to-Firestore cross-service Rules integration is not
enabled in staging. The minimal next action is the staging Firebase Console's
`Fix issue` flow followed by read-only verification that the warning is gone.
No further upload attempt, IAM change, rules change, code patch, deployment,
OCR, OpenAI, or Stripe action was made. Email-verification state, custom claims,
and raw browser-token freshness were intentionally not extracted because they
are not used by these Storage rules and the session store was not inspected.

## Provider retest correction - 2026-08-06

The Storage portion of `STG-016` is now **PASS** after the authorized staging
Storage-to-Firestore cross-service connection was enabled and verified. One
text PDF and one scanned one-page PDF then uploaded and indexed successfully in
the hosted staging app. The earlier Storage `unauthorized` state must not be
used as the current result.

| ID | Severity | Reproduction / evidence | Expected | Actual | Owner | Status | Regression test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STG-017 | P1 | At hosted marker `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`, select synthetic machine `STG-PROVIDER-01` / model `TestCo TEST-ROLE-01`, enter `E01`, keep manual grounding enabled, and run Repair Assist once. | A grounded answer with citations from the selected staging manual is returned. | Cloud Run trace `184303455742cba154ed63b7680914ad` returned HTTP 400 after stages `request_received`, `authentication_complete`, `authorization_complete`, and `machine_resolved`. No `manual_selected`, `manual_chunks_loaded`, `manual_search_complete`, or `openai_request` stage occurred. Read-only Firestore evidence shows two indexed manuals for the same organization/model: text manual `EdHy4QUsylAuPA8CoqXx` and scanned manual `c1suyjJgksBvJAZkvxLI`. The selector therefore fails closed with `Multiple indexed manuals match this machine model...`. No retry was made. | AI/backend engineering | OPEN - STAGING APPLICATION LOGIC BLOCKER | Keep one approved indexed manual per model or add an explicit safe manual-selection path, then run one bounded staging regression request. |

The two successful manual indexing results do not close `STG-017`. Wrong-model
live rejection remains NOT VERIFIED because the bounded manual-index/OCR
actions were already completed and no third provider call was made. No Stripe,
production, IAM, source, rules, deployment, or synthetic-fixture cleanup
action occurred in this retest.

## STG-017 focused remediation - 2026-08-07 14:12 -04:00

The staging-branch implementation is complete in the working tree. The UI now
presents indexed manuals matching the selected manufacturer/model and passes
the chosen `manualId` to `generateRepairAssist`. The backend validates
organization scope, indexed status, and manufacturer/model match before
reading chunks or creating citations. Multiple matches without selection
return the stable `manual_selection_required` error with the message
`Select a manual before generating repair guidance.` Automatic selection is
allowed only when exactly one indexed match exists; the document ID is not used
as model evidence.

Regression evidence: duplicate-without-selection, explicit valid selection,
wrong-organization selection, manufacturer/model mismatch, exactly-one-match,
missing-selected-manual, and invalid-index cases pass in
`app/functions/manual-selection.test.mjs`. Frontend and Functions lint, the
full Functions suite, staging build, onboarding/work-order regressions, and
the staging-aligned Firestore/Storage rules suite (26/26) pass.

Status: **FIXED IN WORKING TREE; STAGING DEPLOYMENT BLOCKED PENDING COMMIT**.
The independent review found no remaining code P1 after removing document-ID
matching. A commit is required so the Hosting marker can identify the exact
reviewed source; no live Repair Assist request has been made after this fix.
