# Automatic Documentation Staging Checklist

## Scope

This checklist applies only to Firebase project `laundryops-staging`. It must not be used against `laundromat-maintenance-app`.

## Before deployment

- Confirm the current branch is `feature/automatic-machine-documentation`.
- Confirm `npm.cmd --prefix functions test` passes.
- Confirm `npm.cmd --prefix functions run lint` passes.
- Build the staging frontend from a normal Windows Command Prompt with `npm.cmd run build:staging`.
- Set `TAVILY_API_KEY` in the **staging** Firebase project. Do not copy it into a file or Git.
- Confirm the staging user is a platform documentation administrator only for the test.
- Configure a deliberately small approved manufacturer-domain list and turn the global feature flag on only in staging.

## Scoped staging release

Run the staging script only after setting its confirmation variable in the current PowerShell session:

```powershell
$env:CONFIRM_LAUNDRYOPS_STAGING_DEPLOY = 'yes'
.\scripts\deploy-staging.ps1 rules
.\scripts\deploy-staging.ps1 functions
.\scripts\deploy-staging.ps1 hosting
```

## Approval-mode test

1. Create a staging-only owner account, organization, and one machine with a real make and complete model number.
2. Enable organization documentation discovery in `approval` mode.
3. Request discovery and confirm every candidate is `review` with AI retrieval disabled.
4. Approve one candidate from an approved manufacturer domain.
5. Attach it. Confirm redirect, PDF signature, and 25 MB checks run before storage.
6. Confirm the created manual is not usable by Repair Assist until indexing confirms an exact model match.
7. Confirm a non-matching, family-only, serial-dependent, unreadable, or non-PDF candidate remains out of AI retrieval.
8. Confirm cancellation stops review and attachment actions for the cancelled job.

## Rollback

- Disable the global staging flag. No searches or attachments may start.
- Disable the organization setting for the test tenant.
- The existing manual upload and Repair Assist workflow must continue to work unchanged.
- If required, redeploy the recorded rollback commit to staging only after a separate review.
# GitHub Actions staging deployment prerequisites

The `Deploy LaundryOps staging` workflow is manual-only. It can run only when
`deployment_target` is explicitly set to `staging`; it has no production target.

Configure these GitHub repository secrets before running it:

- `FIREBASE_SERVICE_ACCOUNT_LAUNDRYOPS_STAGING`
- `STAGING_VITE_FIREBASE_API_KEY`
- `STAGING_VITE_FIREBASE_AUTH_DOMAIN`
- `STAGING_VITE_FIREBASE_PROJECT_ID`
- `STAGING_VITE_FIREBASE_STORAGE_BUCKET`
- `STAGING_VITE_FIREBASE_MESSAGING_SENDER_ID`
- `STAGING_VITE_FIREBASE_APP_ID`
- `STAGING_VITE_BILLING_API_BASE_URL`
- `STAGING_VITE_FUNCTIONS_API_BASE_URL`
- `STAGING_DOCUMENT_AI_OCR_PROCESSOR_ID`

The GitHub credential must be scoped to the `laundryops-staging` project only.
Never reuse the production Firebase credential for this job.
It also needs read-only metadata access to confirm the staging Function secret
names `OPENAI_API_KEY` and `TAVILY_API_KEY`; the workflow never reads their
values.
