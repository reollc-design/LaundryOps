# LaundryOps Staging Deployment and Smoke Report

Date: 2026-08-06
Scope: staging only  
Branch: `feature/stripe-checkout-dedup`  
Committed SHA: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`
Hosted marker: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db` (verified)

## IAM grant and one-upload retest - 2026-08-06 15:35:26 -04:00

- Project verification: `laundryops-staging`, project number
  `323299053901`.
- Exactly one IAM binding was added:
  `service-323299053901@firebase-rules.iam.gserviceaccount.com` with
  `roles/firebaserules.firestoreServiceAgent`. The existing
  `roles/firebaserules.system` binding was preserved.
- After a 45-second propagation wait, a fresh read-only IAM policy check found
  the requested binding present and unconditioned in `laundryops-staging`.
- Existing synthetic owner reused: UID `Nyfpq9nTfoTDXO1TopYMOEqQGEp1`,
  organization `STG-PROVIDER-20260806-NYFPQ9NT`, hosted marker
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Exactly one new manual upload attempt was made for the approved synthetic
  file `STG-TestCo-TEST-ROLE-01-text.pdf` and model `TestCo TEST-ROLE-01`.
- Exact attempted path:
  `orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/ngZNuEukLAorUkStBsEF/STG-TestCo-TEST-ROLE-01-text.pdf`.
- Actual result: **FAIL / BLOCKED**. The hosted UI reported:
  `Firebase Storage: User does not have permission to access 'orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/ngZNuEukLAorUkStBsEF/STG-TestCo-TEST-ROLE-01-text.pdf'. (storage/unauthorized)`.

Per the bounded-test instruction, no retry was made. OCR and Repair Assist
were not started. No Document AI or OpenAI request occurred after the IAM
grant.

## Storage authorization diagnosis - 2026-08-06 14:26:15 -04:00

Environment: `laundryops-staging`; no deployment, IAM change, production
resource, live Stripe resource, or source-code change occurred during this
diagnosis.

- Authenticated synthetic UID: `Nyfpq9nTfoTDXO1TopYMOEqQGEp1`.
- Organization: `STG-PROVIDER-20260806-NYFPQ9NT`.
- Profile: `users/{uid}.defaultOrganizationId` points to that organization.
- Membership: `owner`, `active`; the organization `ownerUserId` matches the
  UID.
- Trial: `subscriptionStatus=trialing`; `trialEndsAt=2026-08-20T17:15:52.418Z`,
  which is after the test time.
- Exact attempted Storage paths:
  `orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/IqVXnWliDHZxZC9h3pGK/STG-TestCo-TEST-ROLE-01-text.pdf`
  and
  `orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/NTymhu2kWBRGkoIaib3g/STG-TestCo-TEST-ROLE-01-text.pdf`.
- Bucket: local configuration, hosted Firebase config, workflow verification,
  and the Storage rules release all identify
  `laundryops-staging.firebasestorage.app` in project `laundryops-staging`.
- Path agreement: the client uses the Function-returned `storagePath`; the
  Function constructs the path above; the deployed rule match is
  `/orgs/{orgId}/manuals/{userId}/{manualId}/{fileName}`.
- Rules agreement: the active deployed release
  `projects/laundryops-staging/releases/firebase.storage/laundryops-staging.firebasestorage.app`
  was read back and its ruleset source matches local `app/storage.rules`.
  The rule requires an active owner/admin/manager, a non-expired trial, a PDF
  name, `application/pdf`, and a file no larger than 25 MB; the synthetic
  request satisfied the identity, organization, role, trial, name, and size
  conditions.
- Result: both and only the two bounded upload attempts returned
  `storage/unauthorized`; both Firestore manual records remain synthetic
  `status=missing` records and no PDF object was stored.

The exact root cause identified for the live Storage request is the missing
cross-service Firebase Rules binding in `laundryops-staging`. A read-only
project IAM policy check found no binding for
`service-323299053901@firebase-rules.iam.gserviceaccount.com` with
`roles/firebaserules.firestoreServiceAgent`. The deployed Storage rules call
`firestore.exists` and `firestore.get`; without this least-privilege service
agent role, the cross-service authorization evaluation cannot read the
organization and membership documents and the client surfaces
`storage/unauthorized`. The Rules API diagnostic also stopped at
`firestore.exists` (Storage rules line 52), consistent with that dependency.

No rule was loosened, no IAM change was made, and no third upload attempt was
made. The required next action is for a staging administrator to grant only
`roles/firebaserules.firestoreServiceAgent` to that exact Firebase Rules
service agent in `laundryops-staging`, then wait for propagation and rerun one
bounded upload. Do not retry or change rules before the grant is verified.

The text-PDF indexing, scanned-PDF OCR, wrong-model rejection, and grounded
Repair Assist checks remain blocked by this authorization denial. No Document
AI or OpenAI request was made in this diagnosis.

## Current checkpoint — 2026-08-06 12:36:24 -04:00

- Deployment is treated as successful and was not redeployed. The hosted URL
  is `https://laundryops-staging.web.app/` and the hosted marker matches the
  committed SHA above.
- Authoritative read-only inventory for `laundryops-staging`: **19 active
  Functions** in `us-central1`; **12 approved Functions present** and **7
  retained legacy Functions present**. There are no missing approved Functions
  and no unexpected Functions.
- `createStripeCheckoutSession` is present and active. The local staging
  workflow check was corrected from `grep -q` to a full-stream fixed-string
  match so `pipefail` cannot turn a successful match into a false negative. It
  was not redeployed or pushed in this pass.
- No Function was modified or deleted.

### Fresh-account P2 retests

| Test | Result | Live evidence |
| --- | --- | --- |
| STG-014 technician status-only workflow | **PASS** | Fresh synthetic account UID `jrmbzy7daFZwfF8CE2VAvXfjL2S2` used at `https://laundryops-staging.web.app/`. The assigned record `STG-014-WORKORDER` in organization `STG-014-TECH-20260806-JRMBZY7D` exposed the status selector while detail fields remained disabled. `Planned` changed to `In Progress` and saved successfully; read-only Firestore verification matched `status=in-progress`, `statusLabel=In Progress`, and `updatedBy=jrmbzy7daFZwfF8CE2VAvXfjL2S2`. |
| STG-015 onboarding refresh persistence | **PASS** | At `https://laundryops-staging.web.app/`, the fresh synthetic account reached onboarding step `2/3`; after entering `STG-015 Refresh Test Location` and `15 Synthetic Refresh Way`, refreshing kept step `2/3` active and preserved both field values. |

The supported staging provider is Email/Password and account creation succeeded.
The isolated STG-014 fixture was retained; no password or token was saved or
reported. Existing staging fixtures were not modified.
No OpenAI or Document AI call occurred. Stripe was exercised only in Test/Sandbox
mode within the bounded provider pass below.

## Bounded live provider-integration pass - 2026-08-06 14:01:21 -04:00

Environment: `laundryops-staging`; hosted marker
`22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`; synthetic provider-test owner
workspace `STG-PROVIDER-20260806-NYFPQ9NT`. No production resource, source
code, deployment, IAM setting, or live Stripe resource was touched.

| Test | Result | Requests, response, and Firestore evidence |
| --- | --- | --- |
| Valid text-PDF upload and indexing | **FAIL / BLOCKED** | Two controlled upload/index attempts using `STG-TestCo-TEST-ROLE-01-text.pdf`; both returned Firebase Storage `storage/unauthorized` for the staging manual path. Firestore contains two synthetic manual metadata records with `status=missing` and `indexError`; no PDF object was stored. Document AI requests: 0. No further retry was made. |
| One-page scanned PDF OCR | **NOT VERIFIED** | Blocked by the same Storage authorization failure before an OCR request could safely be made. Document AI/OCR requests: 0 of 2. |
| Wrong manufacturer/model rejection | **NOT VERIFIED** | Blocked before a manual could reach model validation. |
| Missing-manual behavior | **PASS** | One hosted Repair Assist request for `STG-PROVIDER-01` returned the explicit refusal that no indexed machine manual exists; no grounded answer was produced. |
| Controlled failure/retry handling | **PASS** | The UI surfaced a safe upload error and preserved the failed metadata state; exactly one bounded retry was attempted, then the path was stopped. |
| Grounded Repair Assist answer/citations | **NOT VERIFIED** | No approved manual was uploaded and indexed, so no OpenAI grounded-answer request was made. |
| Repair Assist photo request | **NOT VERIFIED** | Not attempted because the required matching manual was unavailable. |
| Stripe Checkout mode and session | **PASS** | Checkout visibly showed `Sandbox`; URL contained one `cs_test_...` session. Total due today was `$0.00`; annual test price was `$149.99` after the synthetic 14-day trial. |
| Stripe webhook persistence | **PASS** | Firestore organization record contains one `providerCustomerId`, one `providerSubscriptionId`, `billingProvider=stripe`, `billingStatus=trialing`, and `lastStripeBillingEventType=customer.subscription.created`. |
| Duplicate Checkout protection | **PASS** | After webhook persistence, the hosted Account page showed “Stripe subscription linked” and only “Manage Billing”; the subscription subcollection contained exactly one record. No second Checkout session was created. |
| Same-subscription cancellation | **PASS** | Stripe Billing Portal visibly showed `Test mode`; the same subscription was set to “Cancels Aug 20.” Firestore received `customer.subscription.updated` for the same subscription ID. |

Provider limits used: Document AI/OCR `0/2`; OpenAI `0` evidenced because the
no-manual guard refused before grounded generation; Stripe `1` synthetic
customer, `1` subscription, and `1` Checkout session. No real card or live
Stripe mode was used.

`agent.md` does not exist in the approved repository scope. The protected root
`AGENTS.md` was not modified.

## Decision

**STAGING PROVIDER TESTS BLOCKED.** The staging deployment and Function
inventory are verified; STG-014, STG-015, missing-manual Repair Assist, and the
bounded Stripe Test-mode lifecycle passed. Manual upload was denied by staging
Storage twice because the Firebase Rules service agent lacks
`roles/firebaserules.firestoreServiceAgent` in `laundryops-staging`, blocking
OCR, wrong-model live rejection, grounded Repair Assist, citations, and photo
validation. The exact next action is to grant that one role to
`service-323299053901@firebase-rules.iam.gserviceaccount.com`, verify
propagation, and rerun only the bounded manual/OCR/grounded-AI checks.

## Authoritative Storage root-cause correction - 2026-08-06 15:44:52 -04:00

The earlier IAM-only diagnosis is superseded. The exact staging Firebase
Storage Rules console was opened read-only for the verified project and bucket.
It displayed this active warning above the deployed rules:

> Your rules make use of cross-service database calls, but your project is not configured to execute those calls

The warning is the actual hosted authorization blocker. The deployed manual
write rule at `allow create, update` calls `isOrganizationActive` and
`hasRole`; those functions depend on `firestore.exists` and `firestore.get` to
read the organization and membership documents. Because the project is not
configured to execute Storage-to-Firestore cross-service calls, those reads
cannot authorize the request and the rule denies the exact manual path with
`storage/unauthorized`.

Read-only evidence:

- Firebase project: `laundryops-staging`; hosted marker:
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Console-selected bucket: `laundryops-staging.firebasestorage.app`.
- Exact client path:
  `orgs/STG-PROVIDER-20260806-NYFPQ9NT/manuals/Nyfpq9nTfoTDXO1TopYMOEqQGEp1/ngZNuEukLAorUkStBsEF/STG-TestCo-TEST-ROLE-01-text.pdf`.
- Authenticated synthetic owner: email
  `laundryops.staging.provider.1786036508255@example.com`, UID
  `Nyfpq9nTfoTDXO1TopYMOEqQGEp1`; Firebase Authentication console showed the
  Email provider record in `laundryops-staging`. Email-verification state and
  custom-claim values were not exposed by the read-only UI and were not read
  from a browser token or session store. The Storage rules do not reference
  either field.
- Prior read-only Firestore evidence remains consistent: the profile points to
  `STG-PROVIDER-20260806-NYFPQ9NT`, the owner UID matches the organization, the
  membership is `owner` and `active`, and the organization is `trialing` until
  `2026-08-20T17:15:52.418Z`.
- Local client code, Function path construction, deployed rules source, and
  bucket all match. The local 26/26 rules suite passed, but it does not prove
  the hosted project's cross-service configuration.
- No forced token refresh was performed and no token/session store was
  inspected. The hosted app restored the signed-in staging workspace and
  loaded its Firestore-backed organization data; the deterministic console
  warning explains the denial independently of token freshness.
- The Firebase Rules console's `Fix issue` control was not clicked. No further
  IAM role, rules change, source change, deployment, upload, OCR, OpenAI, or
  Stripe action occurred.

Classification: **another specific cause - staging Firebase Storage-to-
Firestore cross-service Rules integration is not enabled**. This is a
project-level Firebase Rules configuration blocker, not a wrong bucket, wrong
client path, missing owner membership, expired trial, or proven stale token.
The minimum next action is for a staging administrator to use the Firebase
Console's `Fix issue` flow for this exact staging bucket and then verify the
warning is gone. Do not retry the upload before that read-only verification.

## Staging identity and IAM evidence

## Current STG-014/STG-015 deployment and live-retest attempt

- Commit: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Commit message: `fix: repair technician status and onboarding refresh persistence`.
- Push: succeeded to `origin/feature/stripe-checkout-dedup`.
- Workflow: [31109412248](https://github.com/reollc-design/LaundryOps/actions/runs/31109412248).
- Deployment result: Functions, Firestore indexes/rules, Storage rules, and
  Hosting completed successfully in `laundryops-staging`.
- Workflow result: FAILED only in the final verification step. The step
  reported `Required staging Function is missing: createStripeCheckoutSession`;
  the independent staging inventory below shows it active, so this is a
  verification false negative rather than an absent deployed Function.
- Hosted URL: `https://laundryops-staging.web.app/`.
- Hosted marker observed: `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Live Function inventory: 19 active Functions; all 12 current required
  Functions and all seven retained legacy Functions are present. No Function
  was deleted.
- STG-014 live retest: NOT VERIFIED. The hosted Chrome session was signed in
  as `laundryops.staging.billing.1785878378889@example.com`, not the seeded
  technician; the supported product has no role switch/invitation flow, and no
  technician password was available.
- STG-015 live retest: NOT VERIFIED. The same session was not the fresh
  onboarding fixture, and no fresh-fixture password was available. No new
  account or record was created.
- Rules and automated evidence: lint PASS; Functions suite PASS; frontend
  onboarding/work-order regressions PASS; Firestore/Storage rules PASS 26/26.
- No Stripe, OpenAI, or Document AI call occurred. No production resource,
  IAM setting, staging data, or temporary Chrome profile was changed.

- Project ID: `laundryops-staging`
- Project number: `323299053901`
- Project name: `Laundry Ops Staging 2026`
- Hosting: `https://laundryops-staging.web.app`
- Pub/Sub principal: `service-323299053901@gcp-sa-pubsub.iam.gserviceaccount.com`
- Compute principal: `service-323299053901@compute-system.iam.gserviceaccount.com`

After IAM propagation, the staging IAM console showed exactly these bindings:

| Principal | Role | Result |
| --- | --- | --- |
| `service-323299053901@gcp-sa-pubsub.iam.gserviceaccount.com` | `roles/iam.serviceAccountTokenCreator` | Present |
| `service-323299053901@compute-system.iam.gserviceaccount.com` | `roles/run.invoker` | Present |
| `service-323299053901@compute-system.iam.gserviceaccount.com` | `roles/eventarc.eventReceiver` | Present |

No human user, broad role, service-account key, production project, production data, or production Stripe resource was changed.

## Local quality gates

Passed on the current working tree:

- App TypeScript lint
- In-memory staging build: 1,620 modules transformed; 6 output entries; no hosted deployment
- Functions TypeScript lint and build
- Full Functions suite, including manual indexing 28/28, deletion 4/4, OCR 11/11, OCR worker 15/15, onboarding 5/5, Repair Assist 12/12, request protection 6/6, Stripe state and diagnostics, trial, downtime, and machine status
- Frontend trial, onboarding, manual-upload, organization-recovery, and downtime tests
- Firestore and Storage emulator security suite: 26/26 using the bundled JDK 11.0.26 and demo emulator project only
- App production-only audit: 0 vulnerabilities in the current audit run
- Functions production-only audit: 0 vulnerabilities in the current audit run
- Lockfile view resolves `websocket-driver@0.7.5` with the reviewed override
- `npm audit fix --force` was not run

The local Functions `node_modules` folder still contains an older `websocket-driver@0.7.4` installation, but it is not part of the reviewed change set or deployment artifact. The manifest and lockfile resolve `0.7.5`; clean-install deployment verification remains required.

## Independent review

- Code review: approved after reassessing the manual-model finding as a false positive. Existing safety tests intentionally require manufacturer matching for short numeric and long alphanumeric model identifiers.
- Deployment/release review: approved the explicit 12-Function staging-only deployment.
- No confirmed Critical or High deployed-runtime issue remains.

## Approved Function deployment set

Only these current Functions may be deployed:

```text
completeOwnerOnboarding
createOrganizationManualUpload
updateMachineOperationalStatus
createStripeCheckoutSession
createStripeBillingPortalSession
indexOrganizationManual
reindexOrganizationManuals
refreshManualMachineCoverage
completeManualOcrJobs
deleteOrganizationManual
generateRepairAssist
stripeWebhook
```

The seven unexpected legacy Functions remain retained and are excluded from deployment:

```text
attachApprovedDocumentationCandidate
cancelDocumentationDiscovery
requestDocumentationDiscovery
reviewDocumentationCandidate
submitDocumentationCandidateUrl
updateGlobalDocumentationSettings
updateOrganizationDocumentationSettings
```

## Commit and deployment status

- Remediation commit: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`
- Push: performed to `origin/feature/stripe-checkout-dedup`
- Functions deployment: complete for all 12 approved current Functions; the initial 11-of-12 attempt was completed by a targeted retry of `refreshManualMachineCoverage`
- Hosted commit marker: PASS; expected and observed `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`
- Complete live Function inventory: verified; all 12 approved current Functions are present and all seven legacy Functions remain present
- Required Functions `updateMachineOperationalStatus`, `refreshManualMachineCoverage`, `deleteOrganizationManual`, and `createOrganizationManualUpload`: present
- Legacy Function deletion: not requested and not performed
- Staging workflow: PASS; [run 31056051294](https://github.com/reollc-design/LaundryOps/actions/runs/31056051294)

Historical first-attempt deployment error:

```text
Permission denied while using the Eventarc Service Agent. If you recently started to use Eventarc, it may take a few minutes before all necessary permissions are propagated to the Service Agent. Otherwise, verify that it has Eventarc Service Agent role.
```

The authorized IAM changes covered the Pub/Sub service agent Token Creator role and the Compute service agent Invoker/Eventarc Event Receiver roles. No additional Eventarc Service Agent role was granted because it was not authorized. A targeted retry succeeded after propagation. The build-image cleanup warning was also reported; no manual artifact cleanup was attempted.

## Focused live smoke-test status

Not started. Deployment gates now pass; the following authenticated synthetic tests remain:

- Owner, administrator, manager, and technician permissions
- Unauthorized and signed-out access
- Onboarding refresh, duplicate submission, and failed-write recovery
- Trial expiration and recovery
- Machine creation, maintenance records, and reporting/status workflows
- Manual metadata protection
- Repair Assist authorization
- Stripe Test-mode Checkout/webhook verification using only synthetic staging data

No synthetic staging account, Firestore record, Storage object, Stripe session, subscription, or webhook was created in this pre-deployment phase.

## Rollback

If the staging deployment fails or the hosted marker does not equal the committed SHA, stop. Preserve the failed evidence, do not delete Functions or data, and redeploy only the last verified staging commit after review. Production rollback or production deployment is outside this authorization.

STAGING NO-GO — focused authenticated staging smoke tests remain pending.

## Focused live role smoke-test run — 2026-08-06

This section supersedes the earlier pending-status note. No deployment, IAM
change, Stripe setting change, production access, or data deletion occurred.

### Run identity and evidence

- Firebase project: `laundryops-staging` only.
- Hosted marker: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`.
- Staging workflow: [31056051294](https://github.com/reollc-design/LaundryOps/actions/runs/31056051294).
- Hosted URL: [https://laundryops-staging.web.app/](https://laundryops-staging.web.app/).
- Browser evidence: authenticated Chrome staging tab plus an isolated signed-out in-app browser tab.
- Stripe: no Checkout session opened; no Stripe setting or billing record changed.
- Data protection: no production or beta-customer data was read; only the existing synthetic staging account and two new synthetic records below were used.

### Synthetic records created

- Machine: `STG-ROLE-OWNER-20260806`, Washer, TestCo, model `TEST-OWNER-01`, left in `Needs Repair` for status/report verification.
- Maintenance record: `WO-573064`, synthetic washer diagnostic, Standard Repair, Planned, Synthetic Test Technician, total `$53.50`.
- Existing synthetic account used: `laundryops.staging.billing.1785878378889@example.com`.
- No role accounts were created. The live Account page states: “Every user signs up for their own paid workspace”; V1 has no supported invite or role-membership provisioning flow.

### Owner/operator smoke results

The available account is owner-like because it owns and loads its company workspace; the UI does not expose a separate role label.

| Role | Action | Expected result | Actual result | Result | Evidence | Created record |
| --- | --- | --- | --- | --- | --- | --- |
| Owner/operator | Sign-in and sign-out | Authenticated owner can use the workspace and sign out safely. | Existing synthetic session loaded; `Sign out` control was visible. A full sign-out/sign-in cycle was not run because no password credential was available. | NOT VERIFIED | Authenticated Chrome page showed the synthetic email and `Cloud mode / laundryops-staging`. | — |
| Owner/operator | Landing/routing | Owner lands in the company workspace and can reach the main routes. | Home loaded after refresh; Machines, Maintenance Records, AI Assist, Reports, and Account were reachable. | PASS | Hosted Home page and route checks. | — |
| Owner/operator | Organization visibility | Owner sees only its staging company workspace. | Company Account showed `LaundryOps Company`; the staging cloud-mode marker was visible; no production or other organization data appeared. | PASS | Account and Home screens. | — |
| Owner/operator | Machine read/write | Owner can read machines and create a synthetic machine. | Existing `STG-01` and new `STG-ROLE-OWNER-20260806` were visible; new machine saved; status changed to `Needs Repair`; totals changed to 2 machines, 1 operational, 1 needs repair. | PASS | Machines screen before/after save and status update. | `STG-ROLE-OWNER-20260806` |
| Owner/operator | Maintenance-record permissions | Owner can create and read a maintenance record. | Record saved with synthetic notes, technician, error code, costs, Planned status, and total `$53.50`; detail page showed `Maintenance record created` and `WO-573064`. | PASS | Maintenance detail screen. | `WO-573064` |
| Owner/operator | Manual-library permissions | Owner can reach the manual library and see its protected upload controls. | Manual Library loaded with 0 models, `Upload Repair Manual`, and upload/index controls. No PDF was uploaded. | PASS for access; upload write NOT VERIFIED | Manual Library screen. | — |
| Owner/operator | Repair Assist authorization | Authorized owner can open Repair Assist; no matching manual must fail closed safely. | AI Assist route loaded; selecting no manual showed `Manual required` and no result. Generation was not invoked because no approved manual was present and an AI call was unnecessary. | PASS for safe authorization boundary; response generation NOT VERIFIED | AI Assist screen showing manual-required state. | — |
| Owner/operator | Billing visibility/restrictions | Owner can see its trial/subscription state without an unintended checkout. | Account showed `14-Day Free Trial`, 13 days remaining, `Stripe subscription linked`, `One company subscription`, and `Manage Billing`. Checkout was not opened. | PASS | Account screen. | — |
| Owner/operator | Denied actions/safe errors | Unauthorized operations must be denied safely. | No owner-denial case was applicable; no unsafe error was observed in permitted flows. | NOT VERIFIED | No negative owner action was run. | — |
| Owner/operator | Cross-organization isolation | Owner must not see another organization. | Only the existing synthetic workspace was available; a second organization/persona was not available to make a live cross-org comparison. | NOT VERIFIED | Account page and current workspace only. | — |

### Administrator, manager, technician, and unauthorized-user results

Each row below is an individual requested check. These are `NOT VERIFIED`, not
passes or failures, because no supported staging flow exists to provision the
requested persona or membership, and no corresponding synthetic credentials
were available. No membership or backend record was fabricated to force the
test.

| Role | Action | Expected result | Actual result | Result | Evidence | Created record |
| --- | --- | --- | --- | --- | --- | --- |
| Administrator | Sign-in/sign-out | Admin can authenticate and end the session. | No supported admin account or credential was available. | NOT VERIFIED | Live Account page states each user signs up for its own workspace; no invite/role flow exists. | — |
| Administrator | Landing/routing | Admin reaches the correct organization workspace. | No admin session available. | NOT VERIFIED | Same live Account page evidence. | — |
| Administrator | Organization visibility | Admin sees only its organization. | No admin membership available for comparison. | NOT VERIFIED | No second synthetic role workspace was created. | — |
| Administrator | Machine read/write | Admin has the intended machine permissions. | No admin session available. | NOT VERIFIED | No supported role fixture. | — |
| Administrator | Maintenance-record permissions | Admin has the intended maintenance permissions. | No admin session available. | NOT VERIFIED | No supported role fixture. | — |
| Administrator | Manual-library permissions | Admin has the intended manual permissions. | No admin session available. | NOT VERIFIED | No supported role fixture. | — |
| Administrator | Repair Assist authorization | Admin has the intended AI authorization. | No admin session available. | NOT VERIFIED | No supported role fixture. | — |
| Administrator | Billing visibility/restrictions | Admin sees only permitted billing controls. | No admin session available. | NOT VERIFIED | No supported role fixture. | — |
| Administrator | Denied actions/safe errors | Disallowed actions fail safely. | No admin session available to exercise negative cases. | NOT VERIFIED | No supported role fixture. | — |
| Administrator | Cross-organization isolation | Admin cannot see another organization. | No second organization/persona available for a live comparison. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Sign-in/sign-out | Manager can authenticate and end the session. | No supported manager account or credential was available. | NOT VERIFIED | V1 has no invite/role-membership provisioning flow. | — |
| Manager | Landing/routing | Manager reaches the correct organization workspace. | No manager session available. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Organization visibility | Manager sees only its organization. | No manager membership available for comparison. | NOT VERIFIED | No second synthetic role workspace was created. | — |
| Manager | Machine read/write | Manager has the intended machine permissions. | No manager session available. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Maintenance-record permissions | Manager has the intended maintenance permissions. | No manager session available. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Manual-library permissions | Manager has the intended manual permissions. | No manager session available. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Repair Assist authorization | Manager has the intended AI authorization. | No manager session available. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Billing visibility/restrictions | Manager sees only permitted billing controls. | No manager session available. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Denied actions/safe errors | Disallowed actions fail safely. | No manager session available to exercise negative cases. | NOT VERIFIED | No supported role fixture. | — |
| Manager | Cross-organization isolation | Manager cannot see another organization. | No second organization/persona available for a live comparison. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Sign-in/sign-out | Technician can authenticate and end the session. | No supported technician account or credential was available. | NOT VERIFIED | V1 documentation says technician invite flows are not part of launch V1. | — |
| Technician | Landing/routing | Technician reaches the correct organization workspace. | No technician session available. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Organization visibility | Technician sees only its organization. | No technician membership available for comparison. | NOT VERIFIED | No second synthetic role workspace was created. | — |
| Technician | Machine read/write | Technician has the intended machine permissions. | No technician session available. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Maintenance-record permissions | Technician has the intended maintenance permissions. | No technician session available. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Manual-library permissions | Technician has the intended manual permissions. | No technician session available. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Repair Assist authorization | Technician has the intended AI authorization. | No technician session available. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Billing visibility/restrictions | Technician sees no unauthorized billing controls. | No technician session available. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Denied actions/safe errors | Disallowed actions fail safely. | No technician session available to exercise negative cases. | NOT VERIFIED | No supported role fixture. | — |
| Technician | Cross-organization isolation | Technician cannot see another organization. | No second organization/persona available for a live comparison. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Sign-in/sign-out | A user without membership cannot authenticate into the target organization. | No unauthorized synthetic account or target-organization membership test fixture was available. | NOT VERIFIED | No supported role-provisioning flow. | — |
| Unauthorized user | Landing/routing | Unauthorized user is routed away from protected workspace. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Organization visibility | No target-organization data is visible. | No direct protected-route attempt was possible without the fixture. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Machine read/write | Machine data and writes are denied. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Maintenance-record permissions | Maintenance data and writes are denied. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Manual-library permissions | Manual data and writes are denied. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Repair Assist authorization | Repair Assist is denied without organization authorization. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Billing visibility/restrictions | Billing data and actions are denied. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Denied actions/safe errors | Denied requests return safe errors. | No unauthorized session available. | NOT VERIFIED | No supported role fixture. | — |
| Unauthorized user | Cross-organization isolation | No data from the target organization is visible. | No cross-organization test fixture available. | NOT VERIFIED | No supported role fixture. | — |

### Signed-out visitor results

| Role | Action | Expected result | Actual result | Result | Evidence | Created record |
| --- | --- | --- | --- | --- | --- | --- |
| Signed-out visitor | Sign-in/sign-out | Public visitor sees a sign-in entry point and no authenticated session. | Isolated staging tab showed `Sign in`; sign-in form showed Email, Password, Google sign-in, and Forgot password. No credentials were submitted. | PASS for entry point; full auth cycle NOT VERIFIED | Isolated signed-out staging tab. | — |
| Signed-out visitor | Landing/routing | Visitor sees the public landing page. | Public page showed LaundryOps, `Maintenance command center`, `Start 14-Day Free Trial`, and `Create Account`. | PASS | Isolated signed-out staging tab. | — |
| Signed-out visitor | Organization visibility | No organization or machine data is visible. | Public page showed no company, machine, maintenance, manual, AI, or billing records. | PASS | Isolated signed-out staging tab. | — |
| Signed-out visitor | Machine read/write | Protected machine data and writes are unavailable. | No protected route was directly attempted in the isolated tab because no supported route/link was exposed on the public page. | NOT VERIFIED | Public shell only. | — |
| Signed-out visitor | Maintenance-record permissions | Protected maintenance data and writes are unavailable. | No protected route was directly attempted. | NOT VERIFIED | Public shell only. | — |
| Signed-out visitor | Manual-library permissions | Protected manuals and uploads are unavailable. | No protected route was directly attempted. | NOT VERIFIED | Public shell only. | — |
| Signed-out visitor | Repair Assist authorization | Repair Assist is unavailable without authentication. | No protected AI route was directly attempted. | NOT VERIFIED | Public shell only. | — |
| Signed-out visitor | Billing visibility/restrictions | No billing data or controls are exposed. | Public page showed no billing data or controls. | PASS | Isolated signed-out staging tab. | — |
| Signed-out visitor | Denied actions/safe errors | Protected actions fail safely. | No protected action was attempted. | NOT VERIFIED | Public shell only. | — |
| Signed-out visitor | Cross-organization isolation | No organization data is visible. | No organization data appeared. | PASS for public-shell isolation; cross-org attempt NOT VERIFIED | Isolated signed-out staging tab. | — |

### Onboarding, recovery, and trial-state results

| Test | Expected result | Actual result | Result | Evidence |
| --- | --- | --- | --- | --- |
| Onboarding completion | A fresh synthetic owner can create its company and initial workspace records. | The public Create Account screen was inspected, but completion was not submitted because it requires a password and creates a new authenticated account; no fresh credential was available. | NOT VERIFIED | Public Create owner account screen; local onboarding tests passed separately. |
| Refresh during onboarding | Refresh preserves or safely resumes onboarding without duplicate data. | No fresh onboarding session was available for a live refresh test. | NOT VERIFIED | No new account or organization created. |
| Duplicate onboarding submission | Double submission creates one organization/workspace only. | No live fresh onboarding submission was run. | NOT VERIFIED | No duplicate test record created. |
| Failed write and retry | A failed onboarding write gives a safe error and retry can recover without duplicates. | No controlled failure was induced against a fresh account. | NOT VERIFIED | No new account or organization created. |
| Session restoration | Refresh/reopen restores the authenticated session and correct staging workspace. | After hosted refresh, the same synthetic account returned to Home with `Cloud mode / laundryops-staging`, 2 machines, 1 operational, and 1 Needs Repair. | PASS | Authenticated Chrome refresh evidence. |
| Trial expiration access behavior | Expired trial follows the intended restriction and recovery path. | Current synthetic account remains `Pro trial active` with 13 days left; changing trial/billing state was outside this run. | NOT VERIFIED | Account screen; no Stripe or billing state change. |

### Findings and release decision

- No P0/P1 runtime security, authentication, data-integrity, or billing defect was observed in the flows that could be exercised.
- The primary certification blocker is test-fixture/product coverage: administrator, manager, technician, and unauthorized live personas cannot be provisioned through the supported V1 product, and no approved synthetic credentials were available.
- Live fresh-account onboarding, failed-write recovery, and expired-trial behavior also remain unverified because exercising them requires creating or changing authenticated/billing state.
- Local automated rules and application tests remain evidence for code-level coverage, but they do not replace the missing live persona and lifecycle evidence.

ROLE SMOKE TEST BLOCKED — no supported staging role-account fixtures or V1 role-provisioning flow exist for administrator, manager, technician, and unauthorized live tests; fresh onboarding and expired-trial credentials/state are also unavailable.

## Seeded staging fixture role and lifecycle run — 2026-08-06

This run used temporary, clearly labeled synthetic fixtures in the staging
project only. The fixture records were preserved. The temporary seed scripts
were removed after setup and recovery checks; no product source code was
patched and no deployment occurred.

### Run identity and fixture manifest

- Firebase project: `laundryops-staging` only.
- Hosted marker: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`.
- Hosted URL: [https://laundryops-staging.web.app/](https://laundryops-staging.web.app/).
- Authentication provider: Firebase Email/Password. Google credentials were not invented or used.
- Stripe: no Checkout, portal, customer, subscription, webhook, or Stripe setting was changed.
- Production: no production project, tenant, identity, data, IAM, or Function was read or changed.

| Fixture | Synthetic email | UID | Organization | Seeded role/state | Intended permission boundary |
| --- | --- | --- | --- | --- | --- |
| Owner | `laundryops.staging.fixture.owner.20260806@example.com` | `lTlWH0LGjaOVUz9BSlcFcHqrWS42` | `STG-ROLE-FIXTURE-20260806` | `owner`, active | Full organization operations and manual management. |
| Administrator | `laundryops.staging.fixture.administrator.20260806@example.com` | `csFBelaBhFfgTUzVYPHL5arXzhb2` | `STG-ROLE-FIXTURE-20260806` | `admin`, active | Organization operations and manual management; billing fields remain backend-only. |
| Manager | `laundryops.staging.fixture.manager.20260806@example.com` | `mliacoXtoIS894EL38HTEefvrYS2` | `STG-ROLE-FIXTURE-20260806` | `manager`, active | Operations and manual management; no machine/work-order delete permission. |
| Technician | `laundryops.staging.fixture.technician.20260806@example.com` | `HDBIGOQBCER44VYwE5EOZ3uH61m2` | `STG-ROLE-FIXTURE-20260806` | `technician`, active | Read operations and change status; no machine/manual/details write permission. |
| Unauthorized user | `laundryops.staging.fixture.unauthorized.20260806@example.com` | `t8y6AydiqhNZSobmko87gHIiVQu1` | `STG-ROLE-FIXTURE-20260806` as default target, no membership | `no-membership` | Must not read or write the target organization. |
| Fresh onboarding | `laundryops.staging.fixture.fresh-onboarding.20260806@example.com` | `9wGH9KuxIdfPy8jhvdvMFYGi2Kw2` | Created by the customer-facing flow: `aoPtb9B5AUjCfyrucYTm` | `onboarding-pending` at seed, then owner after completion | Fresh account creates its own organization, location, and machine. |
| Expired trial | `laundryops.staging.fixture.expired-trial.20260806@example.com` | `3Yz0kXtK6ecsiJvf94Q1peYhKSe2` | `STG-EXPIRED-FIXTURE-20260806` | owner, active membership, expired trial state | Workspace lock until recovery; no Stripe recovery was attempted. |

Seeded shared-role records included `STG-ROLE-01`, `WO-STG-ROLE-01`, the
synthetic indexed manual `STG Synthetic TestCo TEST-ROLE-01 Manual`, and one
synthetic manual chunk. Customer-facing writes created `STG-OWNER-WRITE-20260806`
with `WO-709016`, `STG-ADMIN-WRITE-20260806` with `WO-766976`,
`STG-MANAGER-WRITE-20260806` with `WO-813604`, `STG-FRESH-01`, and
`STG-FRESH-RETRY-20260806`. No record was deleted.

## A. Authorization behavior verified using seeded staging fixtures

### Owner

| Action | Expected | Actual | Result | Evidence / created record |
| --- | --- | --- | --- | --- |
| Sign-in/sign-out and routing | Owner authenticates, reaches its workspace, and can sign out. | Email/password sign-in succeeded; Home loaded; sign-out returned to the sign-in screen. | PASS | Hosted staging browser; synthetic owner email. |
| Organization visibility | Owner sees only the shared synthetic role organization. | `Cloud mode / laundryops-staging`; four shared-role machines loaded; no fresh or expired organization data appeared. | PASS | Home/Machines screens. |
| Machine read/write | Owner can read and create machines. | `STG-OWNER-WRITE-20260806` was created and listed. | PASS | Machines page; created machine preserved. |
| Maintenance read/write | Owner can create and read maintenance records. | Owner-created record opened as `WO-709016`, total `$36.00`. | PASS | Maintenance detail page. |
| Manual-library permission | Owner can read/manage the manual library. | One seeded indexed manual was visible; owner upload controls were available. No PDF upload was performed. | PASS for access; upload write NOT VERIFIED | Manual Library page. |
| Repair Assist authorization | Owner can reach Repair Assist and use only approved manual evidence. | Repair Assist route loaded with machine selection and manual-grounding controls. Model generation was not invoked to avoid an external AI call. | PASS for route boundary; generation NOT VERIFIED | AI Assist page. |
| Billing visibility/restriction | Owner can view billing state without an unintended charge. | Account showed an active synthetic organization subscription and Manage Billing; no billing action was clicked. | PASS for read-only check; action restriction NOT VERIFIED | Account page. |
| Denied actions | No unsafe denial should occur during permitted owner work. | No unsafe error appeared in permitted flows. | PASS for exercised paths | Browser evidence above. |
| Cross-organization isolation | Owner must not see another fixture organization. | Only shared-role organization data loaded. Direct organization-ID tampering was not exposed by the UI. | PASS for default workspace; direct tamper NOT VERIFIED | Home/Machines data. |

### Administrator

| Action | Expected | Actual | Result | Evidence / created record |
| --- | --- | --- | --- | --- |
| Sign-in/sign-out and routing | Administrator authenticates, reaches its workspace, and can sign out. | Email/password sign-in and sign-out succeeded; correct shared workspace loaded. | PASS | Hosted staging browser; synthetic administrator email. |
| Organization visibility and reads | Administrator reads only the shared organization. | Two seeded machines were initially visible; no other organization data appeared. | PASS | Home/Machines page. |
| Machine write | Administrator can create machines. | `STG-ADMIN-WRITE-20260806` was created as a Dryer. | PASS | Machines page; created machine preserved. |
| Maintenance write/read | Administrator can create and read maintenance records. | `WO-766976` opened with total `$24.00`. | PASS | Maintenance detail page. |
| Manual-library permission | Administrator can read/manage manuals. | Seeded manual was visible and upload/index controls were available. No PDF upload was performed. | PASS for access; upload write NOT VERIFIED | Manual Library page. |
| Repair Assist authorization | Administrator can reach Repair Assist without bypassing manual grounding. | Repair Assist route loaded; generation was not invoked. | PASS for route boundary; generation NOT VERIFIED | AI Assist page. |
| Billing visibility/restriction | Billing state is visible without creating a Stripe resource. | Account showed plan controls and Manage Billing. No billing action was clicked. | PASS for read-only check; action restriction NOT VERIFIED | Account page. |
| Denied actions and cross-organization isolation | Backend-only and other-organization data stays protected. | No cross-organization data appeared; no backend-only write was attempted. | PASS for observed isolation; negative write NOT VERIFIED | Hosted browser and rules evidence. |

### Manager

| Action | Expected | Actual | Result | Evidence / created record |
| --- | --- | --- | --- | --- |
| Sign-in/sign-out and routing | Manager authenticates, reaches its workspace, and can sign out. | Email/password sign-in and sign-out succeeded. | PASS | Hosted staging browser; synthetic manager email. |
| Organization visibility and reads | Manager reads only the shared organization. | Shared machines and maintenance records loaded; no other organization data appeared. | PASS | Home/Machines/Maintenance pages. |
| Machine write/delete boundary | Manager can create/edit but not delete machines. | `STG-MANAGER-WRITE-20260806` was created; Delete controls count was zero. | PASS | Machines page; created machine preserved. |
| Maintenance write/read/delete boundary | Manager can create/edit records but must not delete them in this run. | `WO-813604` was created with total `$21.00`; no delete action was clicked. | PASS for create/read; delete denial NOT VERIFIED | Maintenance detail page. |
| Manual-library permission | Manager can read/manage manuals. | Seeded manual and upload/manage controls were visible. No PDF upload was performed. | PASS for access; upload write NOT VERIFIED | Manual Library page. |
| Repair Assist authorization | Manager can reach Repair Assist without bypassing manual grounding. | Repair Assist route loaded; generation was not invoked. | PASS for route boundary; generation NOT VERIFIED | AI Assist page. |
| Billing visibility/restriction | Billing state is visible without creating a Stripe resource. | Account controls were available; no billing action was clicked. | PASS for read-only check; action restriction NOT VERIFIED | Account page pattern matched admin. |
| Denied actions and cross-organization isolation | Delete/backend-only and other-organization data stay protected. | Delete controls were absent; no other organization data appeared. | PASS for observed UI boundary; backend negative writes NOT VERIFIED | Machines page. |

### Technician

| Action | Expected | Actual | Result | Evidence / created record |
| --- | --- | --- | --- | --- |
| Sign-in/sign-out and routing | Technician authenticates, reaches its workspace, and can sign out. | Email/password sign-in and sign-out succeeded. | PASS | Hosted staging browser; synthetic technician email. |
| Organization visibility and reads | Technician can read shared machines and work orders only. | Four machines and four maintenance records loaded; no other organization data appeared. | PASS | Machines/Maintenance pages. |
| Machine write boundary | Technician cannot add, edit, or delete machines. | Add Machine, Edit, and Delete controls were absent; machine status controls remained available. | PASS | Machines control inspection. |
| Machine status write | Technician can change operational status. | `STG-ROLE-01` changed from Operational to Needs Repair; totals changed to 3 operational and 1 needs repair. | PASS | Machines page; seeded machine preserved in Needs Repair. |
| Maintenance read boundary | Technician can read assigned and other work orders. | Four records were visible, including assigned `WO-STG-ROLE-01`. | PASS | Maintenance Records page. |
| Assigned work-order status write | Assigned technician should have the supported status-only update. | Work-order editor fields, status select, AI Diagnose, and Save were disabled; no status-only UI was available. | FAIL — P2 | Live reproduction of existing `STG-014`; no record changed. |
| Manual-library permission | Technician can read manuals but cannot upload/manage them. | Seeded manual was visible; file input and Upload & Index button were disabled; explanatory restriction text was shown. | PASS | Manual Library page. |
| Repair Assist authorization | Technician should be subject to the approved AI/manual boundary. | AI Assist route was visible, but no model call was made; no result authorization was claimed. | NOT VERIFIED | AI Assist page; generation intentionally skipped. |
| Billing visibility/restriction | Technician must not create or change billing state. | Account displayed plan controls and Manage Billing; no billing action was clicked. | NOT VERIFIED | Account page; backend billing action not exercised to avoid Stripe side effects. |
| Cross-organization isolation | Technician sees only the shared organization. | Only shared-role machines/work orders loaded. | PASS for default workspace; direct tamper NOT VERIFIED | Hosted browser. |

### Unauthorized user

| Action | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- |
| Sign-in/sign-out | Auth may succeed, but no target organization access is granted. | Authenticated successfully; `Sign out and recover access` returned to the sign-in page. | PASS | `Workspace unavailable` screen. |
| Landing/routing | Unauthorized user is routed away from protected workspace. | App displayed `This account is not connected to an accessible LaundryOps organization. No replacement workspace was created.` | PASS | Hosted staging browser. |
| Organization/machine/maintenance reads | No target data is visible. | No company, machine, work-order, manual, AI, or billing data was shown. | PASS | Workspace unavailable screen. |
| Writes and denied actions | Writes fail closed without creating replacement data. | No Add Machine or protected action was available; no replacement workspace or record was created. | PASS | Workspace unavailable screen. |
| Cross-organization isolation | A no-membership user cannot read the target organization. | Target organization was set only as the profile default; no membership existed and no target data loaded. | PASS | Seeded no-membership fixture and hosted denial screen. |

### Signed-out visitor

| Action | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- |
| Signed-out landing | Public visitor sees the landing page and sign-in entry point. | Public shell showed LaundryOps, Sign in, Create Account, and trial messaging. | PASS | Isolated signed-out staging tab. |
| Protected data visibility | No organization data is visible. | No company, machine, work-order, manual, AI, or billing data appeared. | PASS | Public shell. |
| Protected action denial | Visitor cannot perform protected writes. | No protected action was exposed on the public shell; the app requires sign-in. | PASS for public gate; direct protected-route attempt NOT VERIFIED | Sign-in screen. |

## B. Customer-facing role invitation/provisioning flow

**NOT VERIFIED / not present in the customer-facing product.** The live Account
page still states that every user signs up for its own paid workspace, and no
invite, membership-management, or role-assignment screen exists in V1. The
administrator, manager, and technician memberships above were seeded through a
staging-only backend fixture tool solely to exercise authorization behavior.
Those seeded results must not be described as proof that customer-facing role
invitation/provisioning works.

## C. Lifecycle behavior

| Lifecycle test | Expected | Actual | Result | Evidence / records |
| --- | --- | --- | --- | --- |
| Fresh account sign-in | New synthetic user enters onboarding without a profile or organization. | Fresh account opened the 1/3 Owner setup screen; no profile was seeded before sign-in. | PASS | Fresh UID `9wGH9KuxIdfPy8jhvdvMFYGi2Kw2`. |
| Onboarding completion | Customer-facing flow creates one user profile, organization, membership, location, and machine. | Completed flow created organization `aoPtb9B5AUjCfyrucYTm`, location `bMScWRk2Cz1h4HgyGTeY`, machine `z9Ws8owaBszsvXUYFtf7`, and `STG-FRESH-01`. | PASS | Hosted Home plus read-only Firestore verification of the onboarding result. |
| Refresh during onboarding | Progress and draft should resume safely without losing entered data. | Refresh at step 2/3 returned to step 1/3 and cleared the entered company draft. No partial organization was created. | FAIL — P2 | Live hosted reproduction; documented as `STG-015`. |
| Duplicate onboarding submission | Simultaneous final submissions create one organization/workspace. | Two final-button clicks both completed at the browser layer; app redirected once to one workspace with one machine and one onboarding result. | PASS | Fresh Home showed one `STG-FRESH-01`; Firestore user profile had one onboarding result. |
| Failed write and retry | A failed write should show a safe error and a valid retry should recover. | Invalid machine submission showed required-field validation; correcting Make/Model and retrying created `STG-FRESH-RETRY-20260806`. | PASS for validation-failure retry; network-failure recovery NOT VERIFIED | Machines page; no duplicate invalid record. |
| Session restoration | Refresh restores the authenticated fixture session and correct workspace. | Owner refresh returned the same synthetic account with `Cloud mode / laundryops-staging`, four machines, and status totals. | PASS | Hosted Chrome/in-app browser evidence. |
| Expired-trial restriction | Expired organization is locked to plan, billing, and sign-out actions. | Expired fixture showed `Your trial has ended`, `0 days left`, Choose a plan, Manage Billing, and Sign Out; no workspace navigation or machine data appeared. | PASS | `STG-EXPIRED-FIXTURE-20260806` hosted screen. |
| Trial recovery | Recovery restores workspace access without an unintended duplicate or Stripe resource. | The tagged expired fixture was temporarily changed by staging-only Admin SDK state setup to `active`; refresh returned Home. It was then returned to expired state. No Stripe call occurred. | PASS for seeded-state recovery; customer-facing billing recovery NOT VERIFIED | Recovery script output and hosted refresh. |
| Final signed-out state | Sign-out leaves no authenticated data visible. | Sign-out returned to the Firebase sign-in screen. | PASS | Hosted staging browser. |

## Findings and release status

- Authorization behavior for seeded owner, administrator, manager, technician,
  unauthorized, and signed-out fixtures is now materially covered on the hosted
  staging marker.
- `STG-014` was reproduced live: Firestore rules permit an assigned technician
  to update status-only work-order fields, but the hosted UI disables the entire
  work-order editor. This remains an open P2 product/security alignment issue.
- `STG-015` was identified live: refreshing during step 2/3 onboarding resets
  the flow to step 1/3 and loses the unsaved draft. No partial backend records
  were created.
- Customer-facing role invitation/provisioning remains unimplemented and is
  explicitly not marked PASS.
- AI generation, manual PDF upload/OCR, and Stripe checkout were not invoked;
  doing so would require an external AI call, manual upload, or Stripe action
  outside this fixture authorization.
- No P0 was observed. The live P2 defects and unverified customer-facing role
  flow prevent a production-readiness claim.

STAGING ROLE AND LIFECYCLE TESTS COMPLETE

## Manual, AI, and Stripe staging validation hold - 2026-08-06

Run identity:

- Firebase project: `laundryops-staging` only.
- Hosted URL: `https://laundryops-staging.web.app`.
- Current verified hosted marker: `b8c9ad58584c1be3f580d69dda6c7ec517f2046c`.
- No deployment, IAM change, Stripe setting change, production access, or
  existing staging-fixture change occurred in this pass.
- Synthetic local inputs are retained in `docs/staging-test-assets/`. No
  password, token, secret, private manual, or real customer data was written
  to the report.

The hosted manual index path invokes Google Document AI for the PDF path used
by these fixtures. Hosted Repair Assist invokes OpenAI after selecting manual
chunks. A real Checkout test would create Stripe Test-mode customer/session
and subscription-side records. No non-billed provider sandbox or bounded
external-spend harness was available, so those live calls were not started.
This is a certification blocker, not a product defect and not a reason to
weaken guards.

### Synthetic input verification

| Input | Environment | Expected | Actual | Result | Evidence / records |
| --- | --- | --- | --- | --- | --- |
| Correct-model text PDF | Local only; no account | Valid one-page PDF with `TEST-ROLE-01`, `E01`, `E-01`, `E 01`, and `E DR` text. | `pdf-parse` read 260 characters and detected `E01` and `E DR`. | PASS | `docs/staging-test-assets/STG-TestCo-TEST-ROLE-01-text.pdf`; no staging record. |
| Image-only scanned PDF | Local only; no account | Valid one-page image-only PDF with no embedded manual text. | PDF loaded with one page and produced no `E01`/`E DR` text; page render was visually inspected. | PASS for fixture classification | `STG-TestCo-TEST-ROLE-01-scanned.pdf`, `render-scanned.png`; no staging record. |
| Wrong-model PDF | Local only; no account | Valid PDF for `OTHER-999`, not `TEST-ROLE-01`. | PDF loaded with one page; wrong-model input was kept separate from the correct-model input. | PASS for fixture classification | `STG-TestCo-OTHER-999-wrong-model.pdf`; no staging record. |
| Corrupt PDF | Local only; no account | Invalid bytes must be rejected before indexing. | `pdf-lib` rejected the file. | PASS | `STG-TestCo-corrupt.pdf`; no staging record. |
| Synthetic photo | Local only; no account | PNG signature and bounded photo payload accepted by the photo parser. | A 68-byte synthetic PNG parsed successfully; live AI upload was not attempted. | PASS for local parser | `STG-role-photo.png`, `repair-assist.test.mjs`; no staging record. |

### Manual and OCR matrix

| # | Environment | Test account/role | Input | Expected | Actual | Result | Evidence / staging records |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hosted staging | None used in this pass; existing fixtures untouched | Correct-model PDF upload | Owner/admin/manager can upload a PDF and receive an indexed manual. | Not started because the hosted upload invokes Document AI and creates Storage/Firestore records. | NOT VERIFIED | Local correct-model fixture and upload-policy tests passed; no staging manual created. |
| 2 | Hosted staging | None used | Text-based PDF indexing | Text is extracted, indexed, and visible with correct model coverage. | Not started; no hosted upload or index call. | NOT VERIFIED | Local `pdf-parse` extraction passed; Functions manual-indexing suite passed; no staging record. |
| 3 | Hosted staging | None used | Scanned PDF/OCR indexing | Image-only manual is OCR-indexed and searchable. | Not started; Document AI call was intentionally avoided. | NOT VERIFIED | Local image-only fixture classification and 11/11 OCR tests passed; no staging record. |
| 4 | Hosted staging | None used | Retry after a failed OCR state | Retry reuses the stored PDF and advances the job safely. | No hosted failed job was created, so no retry was clicked. | NOT VERIFIED | OCR worker retry/state tests passed; no staging record. |
| 5 | Hosted staging | None used | Failed OCR recovery | Failed OCR remains safe, reports an error, and can recover without a duplicate index. | No hosted OCR failure was induced. | NOT VERIFIED | OCR worker suite 15/15 passed; no staging record. |
| 6 | Hosted staging | None used | Wrong-model manual | Upload/linking must reject or refuse a manual that does not match the machine model. | No hosted wrong-model upload was started. | NOT VERIFIED | Manual selection and matching tests passed; wrong-model PDF retained locally only. |
| 7 | Hosted staging | Owner fixture, prior run at verified marker | Machine with no indexed manual | Repair Assist must explain that a manual is required and must not invent a grounded answer. | Prior hosted role run showed `Manual required`; no generation call was made. | PASS for missing-manual UI boundary | Prior live role evidence in this report; no new record. |
| 8 | Hosted staging | None used in this pass | Manual visibility by organization | A manual is visible only to members of its organization. | No new manual was created and no direct cross-organization manual read was attempted. | NOT VERIFIED | Rules/request-protection tests passed locally; no staging record. |
| 9 | Hosted staging | None used in this pass | Manual metadata mutation | Client cannot change backend-owned model, index, OCR, chunk, or coverage metadata. | No hosted manual metadata write was attempted. | NOT VERIFIED | Firestore/Storage rules suite 26/26 and policy tests passed; no staging record. |
| 10 | Hosted staging | None used in this pass | `E01`, `E-01`, `E 01`, and `E DR` | Matching and citations resolve aliases to the selected manual only. | No hosted indexed manual or citation response was created. | NOT VERIFIED | Local alias/index tests passed, including `E DR`; no staging record. |

### Repair Assist matrix

| # | Environment | Test account/role | Input | Expected | Actual | Result | Evidence / staging records |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hosted staging | None used in this pass | Selected matching manual plus synthetic symptom/code | Response is grounded in the selected manual. | OpenAI-backed generation was not started. | NOT VERIFIED | Repair Assist policy and fallback tests passed; no AI request or record. |
| 2 | Hosted staging | None used | Generated response with manual citations | Every citation belongs to the selected manual and is accurate. | No hosted response was generated. | NOT VERIFIED | 12/12 local Repair Assist tests passed, including approved-citation fallback. |
| 3 | Hosted staging | Owner fixture, prior run | Machine without a matching manual | Clear refusal; no unsupported grounded answer. | Prior hosted AI route displayed `Manual required` before any model call. | PASS for preflight refusal boundary | Prior live role evidence; no AI request. |
| 4 | Hosted staging | Unauthorized fixture, prior run | Direct Repair Assist request | Request is denied without revealing organization data. | Fixture was stopped at `Workspace unavailable`; direct endpoint call was not attempted. | NOT VERIFIED for endpoint | Prior hosted unauthorized boundary plus local request-protection tests; no record. |
| 5 | Hosted staging | None used | Manual ID/model from another organization | Other-organization manual cannot be selected. | No cross-organization Repair Assist request was attempted. | NOT VERIFIED | Local wrong-organization authorization test passed; no staging record. |
| 6 | Hosted staging | None used | Synthetic PNG photo | Photo is validated, bounded, and passed only as evidence. | Local parser accepted the synthetic PNG; live OpenAI image request was not started. | NOT VERIFIED for live flow | `STG-role-photo.png`; photo policy tests passed; no AI request. |
| 7 | Hosted staging | None used | Provider timeout/empty response | Safe fallback or clear error without exposing provider details. | No hosted provider call was made. | NOT VERIFIED for live flow | Local timeout/empty-output/fallback tests passed; no record. |
| 8 | Hosted staging | None used | One live Repair Assist request | Latency stays within the documented Function budget. | No live latency sample exists. | NOT VERIFIED | Source timeout budget and local tests only; no AI request. |
| 9 | Hosted staging | None used | Repeated Repair Assist requests | Request protection limits abuse and cost. | Local request protection passed; live rate-limit sequence was not run. | NOT VERIFIED for live flow | `request-protection.test.mjs` 6/6; no AI request. |

### Stripe Test-mode matrix

| # | Environment | Test account/role | Input | Expected | Actual | Result | Evidence / staging records |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Staging configuration / hosted page | None used | Checkout plan selection | Checkout visibly shows Test/Sandbox and returns `cs_test_...`. | Source guard rejects any Stripe secret that is not `sk_test_...`; hosted Checkout was not opened, so no `cs_test_...` evidence exists. | NOT VERIFIED | `runtime-config.test.mjs` and `stripe-checkout-guard.test.mjs`; no Stripe resource. |
| 2 | Hosted staging | None used | One synthetic monthly or annual checkout | One controlled Test-mode Checkout session opens. | Not started because it creates an external Stripe test resource. | NOT VERIFIED | No session, customer, card, or subscription created. |
| 3 | Hosted staging | None used | Completed synthetic Test-mode checkout | Webhook writes customer/subscription/status fields to staging Firestore. | No Checkout or webhook event was generated. | NOT VERIFIED | Webhook state 12/12 and diagnostics 2/2 local tests; no Firestore billing record. |
| 4 | Hosted staging | None used | Double-click/simultaneous checkout | Existing reservation/idempotency returns one session. | No live request sequence was run. | NOT VERIFIED | Local Stripe guard and request-protection tests passed; no Stripe resource. |
| 5 | Hosted staging | None used | Cancellation | Cancellation state is persisted and access follows policy. | No Stripe subscription was created or canceled. | NOT VERIFIED | Local webhook state tests passed; no staging billing record. |
| 6 | Hosted staging | None used | Reactivation | Recovery uses the existing customer/subscription path without duplicates. | No reactivation was attempted. | NOT VERIFIED | Local subscription disposition tests passed; no Stripe resource. |
| 7 | Hosted staging | None used | Expired-trial and past-due paths | Expired and nonpaying states restrict access safely. | Expired-trial UI was previously verified with a seeded fixture; Stripe past-due state was not created. | NOT VERIFIED for Stripe lifecycle | Prior expired-trial live evidence; local trial/webhook tests; no Stripe record. |
| 8 | Hosted staging | None used | Customer/subscription count after the run | No unintended duplicate customer or subscription exists. | No live Checkout was run; this pass created zero Stripe resources. | PASS for non-creation in this pass; lifecycle proof NOT VERIFIED | No Stripe session/customer/subscription/webhook was created. |

### Local quality evidence for this pass

- Functions build and full Functions suite passed: manual indexing 28/28,
  manual OCR 11/11, OCR worker 15/15, Repair Assist 12/12, request protection
  6/6, Stripe webhook state 12/12, webhook diagnostics 2/2, plus all other
  listed Functions suites.
- Frontend TypeScript lint, onboarding 7/7, trial, and downtime 8/8 passed.
- No P0/P1 product defect was found in the tests that were safe to execute.
- `STG-014` and `STG-015` remain documented and were not fixed in this pass.

STAGING TESTS BLOCKED - live Document AI/OCR, OpenAI Repair Assist, and Stripe Test-mode evidence require external provider/resource calls without a bounded no-charge staging harness.

## Bounded provider retest after Storage Rules connection - 2026-08-06

- Environment: hosted `https://laundryops-staging.web.app/`, Firebase project
  `laundryops-staging`, hosted marker
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`.
- Account: synthetic owner
  `laundryops.staging.provider.1786036508255@example.com`; existing fixture
  preserved. No production identity or data was used.
- Storage authorization: PASS. The Firebase Storage Rules console no longer
  displayed the cross-service warning after the authorized staging console
  action. No Storage rules, source code, or deployment changed.
- Text PDF upload/index: PASS. `STG-TestCo-TEST-ROLE-01-text.pdf` uploaded
  and indexed for `TestCo TEST-ROLE-01`; the hosted UI showed one grounded
  model, one page, and one machine using the model.
- Scanned one-page PDF/OCR: PASS. `STG-TestCo-TEST-ROLE-01-scanned.pdf`
  uploaded and indexed; the hosted UI showed `Indexed`, one page, and one
  machine using the model. This was the second and final manual-index/OCR
  action in this bounded pass; no further OCR request was made.
- Wrong-model rejection: NOT VERIFIED live. The bounded manual-index/OCR
  actions were already completed; no third provider request or uncontrolled
  upload was attempted. The synthetic wrong-model PDF remains preserved
  locally.
- Grounded Repair Assist: FAIL. One request was made for machine
  `STG-PROVIDER-01`, model `TestCo TEST-ROLE-01`, symptom `E01`, and the
  selected indexed-manual grounding toggle. The hosted UI returned
  `Repair Assist failed` / `Could not generate repair guidance`; no grounded
  answer or citations were produced. No retry was made.
- Backend evidence: the explicit staging `functions:log` read was attempted
  twice for `generateRepairAssist` and timed out both times, so the exact
  backend/provider cause remains NOT VERIFIED.
- Stripe, production, IAM, source, rules, and deployment actions: none in
  this pass. Existing synthetic records and the temporary Chrome profile were
  preserved.

Bounded result: Storage authorization PASS; text indexing PASS; scanned OCR
PASS; grounded Repair Assist FAIL pending exact Function/provider evidence.

## Repair Assist diagnosis - 2026-08-07

- Environment: hosted marker
  `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`, Firebase project
  `laundryops-staging`, Function `generateRepairAssist`.
- Logging evidence: Google Cloud Logs Explorer was used directly. The
  `cloud_run_revision` trace query returned the invocation and its structured
  stage/error entries. The matching `cloud_function` resource query returned
  no rows, consistent with this being a 2nd-generation Function.
- Active runtime: Cloud Run service `generaterepairassist`, `us-central1`,
  revision `generaterepairassist-00005-hij` at 100% traffic, runtime service
  account `323299053901-compute@developer.gserviceaccount.com`.
- Runtime configuration: Firebase config identifies project
  `laundryops-staging` and bucket `laundryops-staging.firebasestorage.app`.
  The revision binds Secret Manager resource
  `projects/laundryops-staging/secrets/OPENAI_API_KEY:1`; version 1 is
  enabled. No secret value was read. No `OPENAI_MANUAL_MODEL` override is
  present, so source default `gpt-5.5` applies; source uses the SDK default
  OpenAI endpoint. The provider was not called for this trace.
- Trace: `projects/laundryops-staging/traces/184303455742cba154ed63b7680914ad`
  at `2026-08-07 12:29:11 EDT`. Stages reached were
  `request_received`, `authentication_complete`, `authorization_complete`,
  and `machine_resolved`. The request then returned HTTP 400 in 882 ms with
  safe fields `errorName=Error`, `stage=machine_resolved`, and
  `timeout=false`. No provider status/code was emitted.
- Data comparison: the existing owner/org and machine are valid. The selected
  text manual `EdHy4QUsylAuPA8CoqXx` is indexed with one active chunk and an
  `e01` citation index mapping to `chunk-001`. A second indexed scanned manual
  `c1suyjJgksBvJAZkvxLI` has the same `TestCo TEST-ROLE-01` model. The backend
  `selectSingleManualMatch` guard therefore rejects the request with the safe
  multiple-indexed-manuals failure before `manual_selected` and before
  `openai_request`.

Root cause classification: **application logic - ambiguous indexed manual
selection**. No code, IAM, secret, deployment, production resource, data
deletion, or provider call was made in this diagnosis.

## STG-017 focused fix release checkpoint - 2026-08-07 14:12 -04:00

- Scope: staging-only Repair Assist manual selection.
- Changed source: `app/functions/src/index.ts`,
  `app/functions/src/manual-selection.ts`,
  `app/functions/manual-selection.test.mjs`, `app/src/App.tsx`, and
  `app/src/firebase/manuals.ts`.
- Behavior: explicit selection sends `manualId`; the backend validates the
  authenticated organization path, indexed status, and manufacturer/model;
  duplicate matches without selection return `manual_selection_required`;
  citations are read only from the validated manual.
- Automated evidence: frontend lint PASS; staging frontend build PASS with
  local marker `22a92f3b963c6efd4f4e6f99b01adc9199d4a9db`; onboarding/work-order
  regressions PASS; full Functions suite PASS; Firestore/Storage rules PASS
  26/26 with explicit staging project and bucket settings.
- Independent review: the prior document-ID matching P1 was fixed and the
  second review confirmed the selection logic, organization/model/index checks,
  and staging-only deployment scope. Remaining release control is the
  uncommitted Hosting source/marker; the reviewer advised no deployment until
  the exact reviewed source is committed.
- Deployment: NOT RUN. No Function, Hosting, rules, IAM, secret, production,
  Stripe, OpenAI, or Document AI action was taken.
- Live selected-manual Repair Assist: NOT RUN. The required one bounded request
  using `EdHy4QUsylAuPA8CoqXx` remains pending deployment; no retry occurred.

Release decision: **STAGING NO-GO - commit the focused patch before deploying
`functions:generateRepairAssist,hosting` and running the one bounded live
selected-manual request.**
