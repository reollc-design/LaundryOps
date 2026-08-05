# LaundryOps staging testing status

Last updated: 2026-08-05.

## Release identity

- Branch: `feature/stripe-checkout-dedup`.
- Preflight baseline commit: `19671120e882909b1a3159ad64505a267fcce2e6`.
- Current release source is in the working tree; the certified commit and hosted marker will be recorded after commit and staging workflow verification.
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
| Staging Function/Hosting inventory | PARTIAL | Explicit Firebase CLI inventory succeeded once for staging Functions/Hosting; later independent review reported CLI timeout, so post-patch inventory still requires workflow proof |

## Synthetic data record

- Existing synthetic staging account observed: `laundryops.staging.billing.1785878378889@example.com`.
- Existing synthetic workspace snapshot showed one labeled test machine (`STG-01`) and trial/billing UI. No new account, organization, machine, manual, payment, or subscription was created in this run.
- No production tenant data was read or copied.

## Not yet proven

- The current working-tree patch is not yet proven live after deployment.
- Authenticated live flows for onboarding, role personas, manuals, OCR, Repair Assist, expired trial, and billing remain incomplete because the Chrome authenticated tab became intermittently unavailable; no credentials or MFA were requested.
- Stripe Checkout has not been opened in this run. If tested later, the session must be `cs_test_...` and the page must visibly show Test/Sandbox.
- Document AI/OpenAI runtime latency, Secret Manager IAM permissions, App Check, throttled/offline behavior, 60+ machine rendering, and full browser route coverage remain open.
- Production-reference scanning of the new deployed asset bundle awaits the updated staging workflow.
- Local build warning remains: the Firebase vendor chunk is approximately 516 kB, above Vite's 500 kB advisory threshold; this is tracked as a performance follow-up, not a release-security failure.
- Workflow execution, hosted commit marker, deployed Function inventory, rules/indexes/Storage verification, and rollback evidence remain pending until the approved commit is pushed.

## Current result

**NOT READY.** The source-level gates pass and six P1 safeguards plus one P2 security hardening fix are patched in the working tree, but full staging certification still requires a staging-only deployment, exact Function inventory, live smoke evidence, authenticated synthetic workflow coverage, and closure or explicit acceptance of remaining P1 findings.
