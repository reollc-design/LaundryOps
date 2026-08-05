# LaundryOps Staging Deployment and Smoke Report

Date: 2026-08-05  
Scope: staging only  
Branch: `feature/stripe-checkout-dedup`  
Current committed SHA before remediation commit: `2f9285535377f848c4a7b0523d3d329a078af570`

## Decision

**NO-GO pending commit and deployment.** Staging IAM is fixed and verified. Local quality gates and independent code/deployment reviews pass for the explicit staging Function deployment. The hosted marker, live Function inventory, and authenticated smoke tests remain pending because the reviewed remediation commit has not yet been created or deployed.

## Staging identity and IAM evidence

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

- Remediation commit: pending
- Push: not performed
- Functions deployment: pending
- Hosted commit marker: pending
- Complete live Function inventory: pending
- Legacy Function deletion: not requested and not performed

## Focused live smoke-test status

Not started. The following require the hosted marker and live inventory to pass first:

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

STAGING NO-GO — commit and staging deployment are still pending.
