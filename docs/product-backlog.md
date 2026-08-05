# LaundryOps staging product backlog

Prioritized by operator value, risk reduction, and release dependency. This is not a list of random feature ideas.

## Now — release blockers

1. Deploy and verify the complete staging Function set, rules/indexes, Storage, Hosting marker, and asset safety scan.
2. Complete synthetic authenticated acceptance coverage for onboarding, owner/admin/manager/technician/viewer permissions, invalid organizations, expired trials, and session recovery.
3. Finish live manual source-of-truth acceptance: ambiguous-manual refusal, prompt-injection fixtures, citation validation, bounded chunk retrieval, and explicit unsupported-procedure language.
4. Complete live technician/viewer role acceptance for the capability-aligned UI and backend rules.
5. Prove Stripe Test-mode checkout, webhook state transitions, duplicate protection, cancellation, recovery, and `cs_test_...` evidence without creating unintended duplicate resources; the server now rejects non-`sk_test_` keys.
6. Verify the fixed manual PDF validation boundary/filename behavior with a live staging upload matrix.

## Next — operator workflow completeness

7. Replace placeholder machine fields with authoritative serial, location, lifetime cost, maintenance history, and downtime data.
8. Add real password recovery verification, invalid-workspace recovery, and session-restore/back-navigation acceptance tests.
9. Add manual search/view/open/replace and explicit machine-to-manual association controls.
10. Add structured technician assignment, waiting-on-parts, reopen, activity history, and role-aware work-order controls.
11. Add the explicit assigned-technician status-only work-order control that matches the existing Firestore rule boundary.
12. Add report export, custom date/location filters, repair-versus-replace insight, and report calculation fixtures.

## Later — scale and retention

13. Paginate or window machine/work-order/manual listeners and add a large synthetic dataset performance harness.
14. Reduce Repair Assist and OCR read/memory costs with bounded retrieval and page-aware processing.
15. Add location administration, invitations/role management, privacy export/deletion requests, support, and notification preferences.
16. Add QR scanning, Android packaging, permissions review, offline queue/retry, and Play closed-testing evidence.

## Deferred by policy

- Automatic internet manual discovery remains observation/approval-only.
- Production billing, live payments, real customer data, and production deployment remain out of scope for this staging run.
