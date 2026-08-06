# LaundryOps staging bug register

Last updated: 2026-08-06.

## Certification hold - 2026-08-06

No new product defect was added during the remaining manual, OCR, AI, and
Stripe validation pass. The following items remain unchanged and must not be
treated as fixed:

- `STG-014` is fixed in the reviewed staging working tree; hosted regression
  evidence is still pending.
- `STG-015` is fixed in the reviewed staging working tree; hosted regression
  evidence is still pending.

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
| STG-014 | P2 | Open seeded assigned work order `WO-STG-ROLE-01` as technician `laundryops.staging.fixture.technician.20260806@example.com` at the new staging marker. | The supported technician status-only workflow should be visible and intentional. | The reviewed UI now exposes only Record Status and Save Status for the assigned technician; detail, photo, and AI controls remain disabled. | Product/security | FIXED IN WORKING TREE; hosted regression pending | `app/src/workOrderFlow.test.mjs`; rules emulator status-only case; hosted technician smoke test |
| STG-015 | P2 | Sign in as a fresh synthetic account, complete step 1, continue to step 2/3, enter location data, then refresh. | Onboarding should resume the current step and preserve the unsaved draft, or clearly warn before losing it. | The reviewed UI stores progress under the authenticated staging UID in session storage, resets on user switch, and clears it after successful completion. | Product/frontend | FIXED IN WORKING TREE; hosted regression pending | `app/src/onboardingFlow.test.mjs`; hosted onboarding refresh test |

No P0 has been confirmed. P1 items marked “fixed” are not release-closed until the exact staging commit is deployed and the live regression is observed.
