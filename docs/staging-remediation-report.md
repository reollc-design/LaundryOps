# LaundryOps Staging Remediation Report

Date: 2026-08-05  
Scope: staging only  
Firebase project: `laundryops-staging`  
Hosting: `https://laundryops-staging.web.app`  
Branch: `feature/stripe-checkout-dedup`

## Checkpoint

The local remediation fixes are present but not yet committed or deployed. The staging IAM gate now passes after the exact three least-privilege grants were applied and verified in the Google Cloud console. No production resource, legacy Function, Stripe setting, secret value, key, or staging data was changed by this checkpoint.

## Phase 1 - Dependency triage

The targeted non-breaking overrides are present in the app and Functions manifests and lockfiles:

- `websocket-driver`: `0.7.5`
- `body-parser`: `1.20.6`
- `brace-expansion`: `2.1.4`
- `form-data`: `2.5.6`
- `protobufjs`: `7.6.5`

Production-only audit evidence from the prior gate:

- App: two high Node-oriented dependency findings remain; the browser bundle contains none of the affected Node-only packages.
- Functions: eight moderate `uuid` findings remain; no critical or high finding remains after the targeted overrides.
- `npm audit fix --force` was not run.

The current Functions working directory has a stale installed `node_modules` copy resolving `websocket-driver@0.7.4`, while the reviewed manifest and lockfile specify `0.7.5`. The clean-install CI/deployment environment must be used for final dependency verification; `node_modules` is not part of the reviewed change set.

## Phase 2 - Function inventory reconciliation

Required local Functions missing from the previous live inventory:

- `updateMachineOperationalStatus`
- `refreshManualMachineCoverage`
- `deleteOrganizationManual`
- `createOrganizationManualUpload`

Existing current deployed Functions retained:

- `completeManualOcrJobs`
- `completeOwnerOnboarding`
- `createStripeBillingPortalSession`
- `createStripeCheckoutSession`
- `generateRepairAssist`
- `indexOrganizationManual`
- `reindexOrganizationManuals`
- `stripeWebhook`

Seven unexpected legacy Functions remain deployed and were not deleted:

- `attachApprovedDocumentationCandidate`
- `cancelDocumentationDiscovery`
- `requestDocumentationDiscovery`
- `reviewDocumentationCandidate`
- `submitDocumentationCandidateUrl`
- `updateGlobalDocumentationSettings`
- `updateOrganizationDocumentationSettings`

The approved deployment list contains the eight current Functions above plus the four missing required Functions. Legacy Functions are excluded and will be retained.

## Phase 3 - IAM deployment preflight

Verified staging identity:

- Project ID: `laundryops-staging`
- Project number: `323299053901`
- No principal is a human user.
- No broad role was requested or granted.

Verified bindings:

| Principal | Role | Result |
| --- | --- | --- |
| `service-323299053901@gcp-sa-pubsub.iam.gserviceaccount.com` | `roles/iam.serviceAccountTokenCreator` | Present |
| `service-323299053901@compute-system.iam.gserviceaccount.com` | `roles/run.invoker` | Present |
| `service-323299053901@compute-system.iam.gserviceaccount.com` | `roles/eventarc.eventReceiver` | Present |

The bindings remained visible after an IAM propagation delay. No production project or project number `867592802567` was used.

## Local remediation review status

An independent code review found no confirmed Critical or High issue, but identified and blocked on a P1 manual matching regression: legacy model-only manuals did not match machines that also had a manufacturer field. The matching logic and regression test have now been corrected in:

- `app/functions/src/manual-indexing.ts`
- `app/functions/manual-indexing.test.mjs`

The stale project-number content in this report has also been corrected to the authoritative staging identity above.

## Local quality gates

Previously passed:

- App TypeScript lint
- Functions TypeScript lint and build
- In-memory Vite staging build without writing `dist`
- Frontend onboarding, trial, downtime, manual-upload, and organization-recovery tests
- Full Functions suite
- Firestore and Storage emulator security suite: 26/26
- `npm ci --dry-run` lockfile validation
- `git diff --check`

Required after the latest manual-matching fix:

- Functions lint/build and full Functions tests
- Relevant security/rules tests
- Independent re-review
- Clean-install dependency verification in the deployment environment

## Deployment and smoke status

- Commit: pending
- Push: not performed
- Functions deployment: pending
- Hosted commit marker: pending
- Complete live Function inventory: pending after deployment
- Focused authenticated synthetic smoke tests: pending
- Legacy Function deletion: not requested and not performed

## Remaining release blockers

1. Re-run the local gates and obtain an independent re-review of the manual matching fix.
2. Commit only the reviewed staging files, including the previously untracked `billing-plan.ts` and test required by the modified Functions source.
3. Deploy only the explicit approved staging Function list.
4. Verify the hosted commit marker and complete live Function inventory.
5. Complete the focused synthetic staging smoke tests, including Stripe Test-mode verification.

STAGING NO-GO - remediation review and staging deployment are still pending.
