# OpsDesk continuation checkpoint — 11 November 2026

This checkpoint supersedes older remaining-work statements in the historical handoff. Deployment is paused. No PR was merged by this session.

## Published work and merge state

| Work | Branch / PR | Verified state |
| --- | --- | --- |
| Latest fetched main | `main` at `4b755a4` | [PR #43](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/43) consolidated the booking and accessibility stack into main. All features and handoff changes from #40, #41 and #42 are now in main. |
| Secure attachments | `codex/opsdesk-secure-attachments`, [PR #40](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/40), head `6d04f35` | Both builds, 90 unit tests, standard API suite, 23 attachment HTTP checks and five Chromium flows passed locally. [Hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42889371405), including Firefox. Merged into main by PR #40. |
| Booking requests and exploratory load harness | `codex/opsdesk-booking-approvals`, [PR #41](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/41), head `9f3ff92` | Originally stacked on #40; now included in main through PR #43. Both builds, changed-file lint, 90 unit tests, standard API suite, 31 focused booking checks and all six Chromium flows passed. [Hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42892893653), including the standard cross-browser flows. |
| Accessibility audit harness and this handoff | `codex/opsdesk-accessibility-checks`, [PR #42](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/42) | Originally stacked on #41; now included in main through PR #43. Adds `npm run ops:test:a11y` with axe WCAG A/AA checks across ten states. Seven shared text colors were darkened to fix the recorded contrast defects. All ten Chromium states now pass axe WCAG A/AA checks, and the scan is included in the standard browser command. Manual assistive-technology acceptance remains open. Latest hosted validation must be checked. |

PR #40 merged into main directly; #41 and #42 merged into their original base branches and were then consolidated into main by #43. No further stack retargeting is needed for those changes. Start new work from current main. Leave future merge decisions to collaborators. GitHub rejected workflow-file edits because the token lacks `workflow` scope; all published changes avoid workflow-file edits and use the existing test commands.

## Implemented behavior

**Attachments:** message-thread upload/list/download UI; author-only uploads; current membership and customer/internal/supplier thread access checks; 2 MiB per file and five files per message; content/type checks; ClamAV INSTREAM integration that fails closed outside the synthetic preview; five-minute user-bound links that still require authentication; private database bytes; successful-upload audits; 30-day expiry and hourly deletion. The browser proxy now preserves binary bytes. The synthetic scanner is a fixture, not malware protection. Email does not deliver or import attachment bytes. See [attachment guide](OPSDESK_ATTACHMENTS.md).

**Booking requests:** agency/manager creation requests and scoped cancellation requests; manager approval/rejection with reasons; UUID request retries; repeat-safe concurrent decisions; trusted local agency/customer/supplier checks; UTC/IANA validation; stale-booking fingerprints; synthetic booking creation and cancellation persisted with audits. Cancellation preserves existing cases and saved deadlines and adds one event per linked case. The directory shows cancelled bookings. Manager browser forms are implemented; agency/customer submission is currently API-only. Provider-managed cancellations cannot run through the synthetic adapter. See [booking policy and API](OPSDESK_BOOKING_APPROVALS.md).

**Exploratory load:** `npm run ops:load` runs configurable mixed reads/writes on disposable local case fixtures and verifies acknowledged writes. One 200-request run at concurrency eight on 60 seeded cases/192 messages persisted all 40 writes exactly once, with p50 49 ms, p95 95 ms, p99 179 ms and 144.6 requests/second. These numbers are not representative-volume or production acceptance.

**Existing AI baseline:** synthetic development classification scored 27/30 and synthetic holdout scored 17/18. No independent evaluation or external LLM acceptance is claimed.

## Free-first options for remaining work

Options below were checked on 11 November 2026. They are development/testing choices, not newly connected services or proof of live acceptance. Recheck provider pricing and access requirements before selecting a live plan. No booking provider has been selected.

| Remaining area | Free option | Limit or additional requirement |
| --- | --- | --- |
| Agency/customer booking forms | Extend the existing Next.js/NestJS application and synthetic booking APIs. | No new paid service is required; implement the forms and test role/agency scopes. |
| Accessibility | Existing axe/Playwright scans plus [NVDA](https://www.nvaccess.org/download/), a free Windows screen reader. | Manual keyboard, screen-reader and zoom testing still requires a reviewer; an automated pass is not full acceptance. |
| Malware scanning | Run [ClamAV](https://www.clamav.net/about), the open-source scanner, against the existing INSTREAM adapter. | Needs machine resources, signature updates and clean/infected/unavailable-scanner validation. Live file and backup retention still need approval. |
| Email | [Resend's free plan](https://resend.com/pricing): currently 3,000 emails/month and 100/day. The project already has an opt-in adapter. | Quotas apply. A sending domain under the team's control may cost money; domain verification, credentials and actual send/receive acceptance remain necessary. Local fixtures do not prove delivery. |
| Booking integration | Continue with the local synthetic adapter, or evaluate [Duffel test mode](https://duffel.com/docs/api/overview/test-mode) for flights. | Sandbox bookings do not spend money or create real reservations. [Live Duffel use has fees](https://duffel.com/pricing). Do not treat this suggestion as provider selection or access to arbitrary bookings made elsewhere. |
| Independent AI evaluation | Existing local classifier evaluator and publicly available [Bitext travel data](https://huggingface.co/datasets/bitext/Bitext-travel-llm-chatbot-training-dataset/blob/main/README.md). | Respect the dataset licence and holdout separation. Independently labelled examples and human review are still needed. External model inference may have separate costs; no paid model API is needed to evaluate the current rules. |
| Representative load testing | Existing `npm run ops:load`, or [open-source k6](https://grafana.com/oss/k6/). | Local execution has no software subscription requirement, but large/distributed runs need computing capacity. Agree representative datasets, traffic and performance targets. |
| Monitoring | Self-hosted [Prometheus](https://prometheus.io/) for monitoring and alerting; evaluate [Grafana's free cloud tier](https://grafana.com/pricing/) if managed hosting is desired. | Self-hosting needs resources and maintenance; cloud free tiers have usage/retention limits. Define incident ownership and test alerts. |
| Backups/recovery | PostgreSQL [pg_dump/pg_restore](https://www.postgresql.org/docs/18/app-pgdump.html) and the existing recovery rehearsal. | Tools are available without a paid backup subscription. Reliable encrypted off-machine storage may cost money; restore testing, retention decisions and named recovery owners remain necessary. |

A development setup can avoid new service subscription costs by using local tools, synthetic/sandbox bookings and available free email quotas. This does not promise free production hosting, unlimited storage/email, real travel transactions, or zero human review effort. Keep deployment paused. Start with code and tests that need no credentials; provision external services only when selected and authorized, and never commit secrets.

## Immediate next work

1. Check latest main/PR #43 validation and retain the booking migration and policy evidence. Do not infer latest-main acceptance solely from earlier branch runs. There are 28 migrations including the attachment table, booking requests and booking decision constraints. Both booking migrations applied locally.
2. The seven contrast colors in `frontend/app/globals.css` are fixed, and `npm run ops:test:a11y` passes all ten Chromium states. The scan now runs in the standard browser command. Check latest hosted Chromium/Firefox results, then obtain manual keyboard, screen-reader and zoom acceptance. Do not treat an automated pass as full accessibility acceptance.
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

> Continue OpsDesk from current main, last fetched at `4b755a4`. PR #43 consolidated the attachments, manager-reviewed synthetic bookings, accessibility fixes and handoff from #40, #41 and #42 into main. Read `docs/OPSDESK_NEXT_TEAMMATE.md` first, then the feature guides and validation record. #40 and #41 hosted CI passed; check latest main/PR #43 validation. Both builds, 90 unit tests, full API checks, 31 booking checks and six Chromium flows passed locally. Seven contrast colors are fixed and the accessibility harness passes all ten Chromium states. It now runs in the standard browser command; check latest hosted results and obtain manual accessibility acceptance next. Read the free-first options table for local/open-source tools and sandbox/free-tier limits. No booking provider is selected; manager review is required for consequential booking changes. Live email/provider/scanner acceptance, independent AI evaluation, manual accessibility, representative load and operational recovery acceptance remain open. Use Node 22.23.x and the isolated synthetic preview. Preserve privacy, scopes, session safeguards, historical references, deadlines and audit/idempotency behavior. Leave merges to collaborators. Deployment stays paused.
