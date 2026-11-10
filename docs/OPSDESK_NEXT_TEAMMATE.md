# OpsDesk continuation checkpoint — 11 November 2026

This checkpoint supersedes older remaining-work statements in the historical handoff. Deployment is paused. No PR was merged by this session.

## Published work and branch order

| Work | Branch / PR | Verified state |
| --- | --- | --- |
| Latest fetched main | `main` at `6d63063` | PR #39 merged the earlier handoff. PRs #35–#38 were already merged. |
| Secure attachments | `codex/opsdesk-secure-attachments`, [PR #40](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/40), head `6d04f35` | Both builds, 90 unit tests, standard API suite, 23 attachment HTTP checks and five Chromium flows passed locally. [Hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42889371405), including Firefox. Draft-to-ready was denied by the connected account's permissions. |
| Booking requests and exploratory load harness | `codex/opsdesk-booking-approvals`, [PR #41](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/41), head `9f3ff92` | Stacked on #40. Both builds, changed-file lint, 90 unit tests, standard API suite, 31 focused booking checks and all six Chromium flows passed. Hosted run `42892893653` was still running when this handoff was prepared; check its conclusion before acceptance. |
| Accessibility audit harness and this handoff | `codex/opsdesk-accessibility-checks` | Stacked on #41. Adds `npm run ops:test:a11y` with axe WCAG A/AA checks across ten states. The scan currently **fails**, exposing existing contrast defects. It is intentionally not added to the standard browser command until those defects are fixed. No CSS contrast fixes were made in this checkpoint. |

Review/merge #40 first, then retarget #41 onto main after #40 merges. Retarget the accessibility PR after #41 merges. Do not merge an entire stack out of order. Leave merge decisions to collaborators. GitHub rejected workflow-file edits because the token lacks `workflow` scope; all published changes avoid workflow-file edits and use the existing test commands.

## Implemented behavior

**Attachments:** message-thread upload/list/download UI; author-only uploads; current membership and customer/internal/supplier thread access checks; 2 MiB per file and five files per message; content/type checks; ClamAV INSTREAM integration that fails closed outside the synthetic preview; five-minute user-bound links that still require authentication; private database bytes; successful-upload audits; 30-day expiry and hourly deletion. The browser proxy now preserves binary bytes. The synthetic scanner is a fixture, not malware protection. Email does not deliver or import attachment bytes. See [attachment guide](OPSDESK_ATTACHMENTS.md).

**Booking requests:** agency/manager creation requests and scoped cancellation requests; manager approval/rejection with reasons; UUID request retries; repeat-safe concurrent decisions; trusted local agency/customer/supplier checks; UTC/IANA validation; stale-booking fingerprints; synthetic booking creation and cancellation persisted with audits. Cancellation preserves existing cases and saved deadlines and adds one event per linked case. The directory shows cancelled bookings. Manager browser forms are implemented; agency/customer submission is currently API-only. Provider-managed cancellations cannot run through the synthetic adapter. See [booking policy and API](OPSDESK_BOOKING_APPROVALS.md).

**Exploratory load:** `npm run ops:load` runs configurable mixed reads/writes on disposable local case fixtures and verifies acknowledged writes. One 200-request run at concurrency eight on 60 seeded cases/192 messages persisted all 40 writes exactly once, with p50 49 ms, p95 95 ms, p99 179 ms and 144.6 requests/second. These numbers are not representative-volume or production acceptance.

**Existing AI baseline:** synthetic development classification scored 27/30 and synthetic holdout scored 17/18. No independent evaluation or external LLM acceptance is claimed.

## Immediate next work

1. Check PR #41's hosted result and review the booking migrations and policy. There are 28 migrations including the attachment table, booking requests and booking decision constraints. Both booking migrations applied locally.
2. Run `npm run ops:test:a11y`, fix the contrast findings in `frontend/app/globals.css`, and rerun all ten states. Current failures are only `color-contrast`, grouped in nine of ten scanned states. Affected foreground colors/selectors: sidebar counters `#597466`, connection label `#62806c`, small avatars `#85698a`, active-tab counts `#53775a`, urgent badges `#98625a`, in-progress badges `#756982`, and pagination/helper text `#698257`. Darken the foregrounds while preserving the palette; do not suppress the rule. Then add the passing scan to standard browser validation, and obtain manual keyboard/screen-reader/zoom acceptance.
3. Validate a real ClamAV daemon with clean, infected and unavailable-scanner cases; agree live file/backup retention and deletion policies. Review whether incoming/outgoing email attachments are required as a separate increment.
4. Select a booking provider. The user explicitly said none is selected. Duffel test mode was suggested for flight sandbox development, not adopted or connected. Use provider-neutral/synthetic tests meanwhile. Build credentialed read/reconciliation and eventual provider command handling with manager review, stable ownership mapping, retries/idempotency and confirmed cancellation outcomes. Fee/refund handling and agency/customer browser forms remain open.
5. Complete verified mail sending/receiving domains, credentials and a real send/receive/receipt/reply rehearsal. Synthetic and provider-fixture tests do not prove live delivery.
6. Obtain independently labelled evaluation data and evaluate classification, privacy/linking and grounded summaries/drafts. Current deterministic record briefs and synthetic keyword fixtures do not satisfy independent AI acceptance.
7. Extend load tests to representative data volumes, skew, long threads, cold caches and sustained concurrent readers/writers, with agreed latency/throughput targets.
8. Complete operational recovery acceptance: named incident/recovery owners, approved live-data tenancy and retention, managed backups/monitoring/alerts and an approved staging restore. Existing synthetic recovery/worker-restart CI evidence remains useful but is not operational acceptance. Keep deployment paused.

## Reproduce locally

Use Node.js **22.23.x**, `npm ci`, and `npm run ops:preview`. Keep the demo isolated and credential-free. This checkout used PostgreSQL port **55439**, API **3141**, and frontend **3140** because default ports were occupied. Local env files are ignored and were not committed. `LOCAL_POSTGRES_PORT` now supports an isolated database port; the preview derives the web port from `FRONTEND_URL`.

For these custom ports, set `OPSDESK_TEST_URL=http://127.0.0.1:3141` and `OPSDESK_BROWSER_URL=http://127.0.0.1:3140` before tests. Run `npm run ops:test` and then `npm run ops:test:browser` **sequentially**, since policy-mutating suites interfere when run together. The latter includes the new booking browser flow. Hosted CI exercises Chromium and Firefox. Local Playwright Firefox failed to launch on this Windows host (`spawn UNKNOWN`) even after reinstalling; do not count that as a local Firefox pass.

The preview generates a temporary attachment signing key if none is set; restarting invalidates old links. Live use requires an independent secret and configured scanner. Never commit credentials or enable live sending as part of a demo.

## Copy-ready next-teammate message

> Continue OpsDesk from the published PR stack #40 (attachments) → #41 (manager-reviewed synthetic bookings) → the accessibility-checks/handoff PR. Main was last fetched at `6d63063`. Read `docs/OPSDESK_NEXT_TEAMMATE.md` first, then the feature guides and validation record. #40 hosted CI passed; check #41 and the newest PR's hosted results. Both builds, 90 unit tests, full API checks, 31 booking checks and six Chromium flows passed locally. The accessibility harness scans ten states and currently fails existing contrast defects in nine states; fix those next without suppressing the rule. No booking provider is selected; manager review is required for consequential booking changes. Live email/provider/scanner acceptance, independent AI evaluation, manual accessibility, representative load and operational recovery acceptance remain open. Use Node 22.23.x and the isolated synthetic preview. Preserve privacy, scopes, session safeguards, historical references, deadlines and audit/idempotency behavior. Leave merges to collaborators. Deployment stays paused.
