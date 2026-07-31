# LaundryOps Project Instructions

These instructions apply to all work in this repository.

## Mandatory Preflight

Before starting any task, perform a quick read-only inspection of the relevant
project state. Do not edit code, change settings or permissions, transmit
secrets, push, or deploy during the preflight.

Check for:

- The exact requested wording, behavior, or code change.
- Related files, tests, documentation, workflows, rules, indexes, and features
  that may also need coordinated updates.
- The current branch, working-tree state, deployment target, and whether the
  task belongs on `main`, staging, or a feature branch.
- Required environment-variable and secret names without exposing their values.
- Required Firebase, Google Cloud, GitHub, Stripe, OpenAI, or other service
  permissions and authenticated identities.
- Required APIs, service accounts, IAM roles, Firebase products, database
  changes, rules, indexes, Storage paths, Hosting targets, and Function regions.
- Build, test, CI, migration, backup, rollback, and deployment requirements.
- Anything likely to block implementation, testing, pushing, or deployment.

Then give Robert one brief summary containing:

1. What will change.
2. Blockers or required actions.
3. Important risks.
4. One approval question.

Ask all necessary questions together. Keep the preflight concise; do not create
a long planning document unless Robert requests one.

## After Approval

After Robert approves:

- Complete the coordinated task without repeatedly stopping for avoidable setup.
- Keep changes limited to the approved scope.
- Run the relevant lint, build, unit, Functions, Firebase rules, and UI checks.
- Use the required code and deployment reviewers for major work.
- Report serious review findings before pushing or deploying.
- Push or deploy only when requested or explicitly approved.
- Verify the actual hosted result after deployment and report the exact URL,
  commit, workflow result, and remaining issues.

Pause only for a new material risk, destructive action, security concern,
unexpected production impact, required secret entry, authentication step, or
product decision that was not covered by the approval.

## Deployment Preflight

Before any staging or production deployment, verify all dependencies in one
coordinated pass:

- Confirm the exact Firebase project, Hosting site/target, database, Storage
  bucket, Function names, regions, and deployment command.
- Confirm the deployer identity has the minimum required permissions for every
  requested target, including rules, indexes, Hosting, Storage, Functions,
  Scheduler jobs, runtime service accounts, and Secret Manager IAM updates.
- Confirm all required APIs are already enabled.
- Confirm every required secret exists and the deployment/runtime identities
  can use it. This includes `OPENAI_API_KEY`, `TAVILY_API_KEY`, Stripe secrets,
  and any Document AI configuration required by the selected Functions.
- Confirm required GitHub environment variables and Firebase frontend variables
  exist for the selected environment.
- Confirm database rules, indexes, migrations, backups, rollback steps, and
  post-deployment smoke tests are ready.
- Confirm staging-only configuration cannot be deployed to production and
  production resources cannot be changed by a staging command.

If anything is missing, report the exact identity, minimum role or permission,
API, secret name, setting, or console path required before beginning. Never
request or print secret values.

Do not start a deployment expected to fail because a known dependency has not
been verified.
