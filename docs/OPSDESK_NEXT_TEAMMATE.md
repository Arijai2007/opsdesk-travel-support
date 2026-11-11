# OpsDesk continuation checkpoint — 12 November 2026

## Current continuation — 12 November 2026

> Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support. Fetch latest main, inspect open PRs and actual CI (including Firefox), then read this file, handoff, backlog, validation, acceptance review and supplied load-target guides. This increment starts from main e699fd3 with PRs #58–#63 merged and zero open PRs at the initial check. Latest main CI and recorded #60–#62 runs were queued, not passed. Review the codex/opsdesk-acceptance-followup PR and its actual checks before depending on it. The user confirmed no approved performance targets exist and requested configurable checks; OPSDESK_LOAD_TARGETS now compares supplied aggregate/per-role sample and latency limits, optional throughput/duration limits, and fails after verified cleanup. No configuration means not-configured, not a target pass. Read the exact validation results and do not treat synthetic tooling thresholds as approved targets. Next agree representative traffic and performance targets, have humans label/adjudicate/freeze the classifier export, and obtain actual spoken screen-reader evidence. No booking provider is selected; live booking/mail acceptance, scanner monitoring, retention approval and an authorized staging restore with named owners/targets remain open. Use Node 22.23.x, npm ci and isolated synthetic ops:preview. Run mutating API, browser and load suites sequentially; preserve unrelated work, authorization, agency isolation, sessions, saved deadlines, idempotency and audit history. Commit verified work and publish a PR targeting main, leaving merge to collaborators. Deployment remains paused.

Earlier continuation messages below are historical. Use this section and its [validation record](OPSDESK_VALIDATION.md#supplied-load-targets--12-november-2026) for current status.

## Current continuation message

> Continue OpsDesk in `DhruvKhanna7777/opsdesk-travel-support`. Fetch latest main, check open PRs and their CI, then read the handoff, backlog, validation record, acceptance review guide and README.
>
> **Finished and merged.** The application baseline is `b1b97ab` through PR #62. It includes the scoped customer portal, classifier review tools, populated supplier startup probes, 12-identity synthetic load, message shared-buffer profiling and truncated-backup recovery. PRs #58 and #59 passed hosted CI. Local checks passed for #60–#62. The combined main validation through #62 was queued at handoff.
>
> **Partially complete.** Synthetic evidence still needs representative data and traffic, approved performance targets, full cold-cache testing and operational recovery validation.
>
> **Next.** Recheck main CI, including Firefox. Have a human label and adjudicate the blind classifier pack in `npm run ops:review-classifier`, freeze the export, and score it with `--dataset`. Obtain observable screen-reader speech. Live booking and mail acceptance, production scanner monitoring, retention approval, and an authorized staging restore with named owners and targets remain open. No booking provider has been selected.
>
> Use Node 22.23.x and an isolated synthetic preview. Run mutating API, browser and load suites sequentially. Preserve authorization, agency isolation, sessions, saved deadlines, idempotency and audit history. Keep private exports and credentials out of Git. Push verified work for collaborator review. Deployment remains paused.

Use the [current handoff](OPSDESK_HANDOFF.md#current-merged-checkpoint) for PR links and checked CI states. The sections below record earlier checkpoints.

## Supplier message-history continuation

This follow-up builds on the populated supplier-list probe in PR #58. Select `supplier-history` to measure page 12 of a 240-message thread after a fresh API process starts. The probe checks the returned scope and confirms that another supplier history returns HTTP 404 after timing. [Procedure](OPSDESK_STARTUP_PROFILE.md) · [Local validation](OPSDESK_VALIDATION.md#supplier-message-history-startup)

The next acceptance inputs remain a human-labelled, adjudicated classifier export and observable spoken screen-reader review. The local blind form is available through `npm run ops:review-classifier`. Representative performance targets, controlled caches, live integration and operational acceptance remain open. Leave merge decisions to collaborators. Deployment remains paused.

## Earlier checkpoint after PR #57

Main `0310cd5` includes the startup profiler. Both PR and main CI passed, including startup smoke, five-role load, recovery, Chromium, Firefox and dependency audit. This follow-up adds a populated and scope-checked supplier list in the disposable startup fixture. Review its separate hosted results before reporting them. [PR #57 CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43075807792) · [Main CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43076744463)

> Continue from latest main. Check open PRs and CI. Run the local blind form with `npm run ops:review-classifier`, then ask a human reviewer to complete and adjudicate labels, save and freeze the exported JSON under ignored `.opsdesk/`, and run the evaluator in `--dataset` mode. Obtain observable spoken screen-reader evidence using the acceptance guide. Continue representative booking/identity workloads and controlled-cache testing. Use Node 22.23.x and isolated synthetic data. Keep deployment paused and leave merging to collaborators.

## API process-start continuation

Use the startup profiler procedure to reproduce the local measurements and interpret their scope. [Procedure and limits](OPSDESK_STARTUP_PROFILE.md)

## Blind review form continuation

PR #55 is merged in main `9503315`; its hosted validation passed with dynamic PostgreSQL ports, five-role load, Chromium and Firefox. This follow-up adds `npm run ops:review-classifier`, a loopback-only form for the existing blind pack. Reviewers can import/download drafts, enter categories/rationales and export validated JSON without seeing generated predictions. [Use the review form and evaluation procedure](OPSDESK_ACCEPTANCE_REVIEW.md#local-blind-review-form) · [Exact checks and limits](OPSDESK_VALIDATION.md#blind-review-form---11-november-2026)

Local Chromium and Firefox form tests and axe/reflow checks passed. No independent human labels, classifier acceptance or spoken-output acceptance were produced. Next check this PR and post-merge main CI, have a reviewer complete/adjudicate the pack and freeze it before scoring, and obtain observable screen-reader speech. Representative booking/identity distributions, cold-cache procedures and performance targets, live integrations and operational acceptance remain open. Keep deployment paused and merging with collaborators. Older checkpoints below are historical where superseded.

## Five-role load continuation

PR #54 is merged in main `64c5245`; its PR workflow passed. Post-merge CI failed before tests because fixed PostgreSQL host port 55432 was occupied. This follow-up uses a dynamically assigned service port and adds a short five-role load rehearsal to CI. Check its hosted result separately.

The synthetic load harness now accepts read weights for all five roles and reports actual per-role counts/latencies. A local 60-second run with 12 workers, 3,000 background cases and 1,200 history messages completed **8,035 requests** and verified **1,607 writes exactly once**. Fixture cleanup restored the original counts. These are single-host synthetic results with uncontrolled caches and one identity per role, not representative or cold-cache acceptance. [Exact evidence and limits](OPSDESK_VALIDATION.md#five-role-load-and-ci-port-isolation---11-november-2026) · [Run options](OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal)

Next check this PR's CI, obtain human labels for the merged blind review pack and observable spoken screen-reader evidence, then agree representative booking/role distributions, cold-cache procedures and performance targets. Keep live integration and operational acceptance open. Use Node 22.23.x and the isolated synthetic preview; run mutating API/load/browser suites sequentially. Leave merging to collaborators and deployment paused. The older checkpoints below are historical where superseded.

## CI browser runtime follow-up

PR #53 is merged in main `b7bfa3a`. Its CI timed out while Ubuntu package hosts repeatedly failed DNS resolution during Playwright OS-dependency installation. The follow-up workflow uses the official version/digest-pinned Playwright container for sequential Chromium/Firefox fixtures, retaining the existing loopback guards and Node 22.23.x. Check its hosted result before claiming browser acceptance. [Diagnosis, implementation and verification limits](OPSDESK_VALIDATION.md#ci-browser-runtime-follow-up---11-november-2026)

The requested blind labelling pack and evaluator are now merged. Obtain human labels and observable spoken screen-reader evidence using the [review guide](OPSDESK_ACCEPTANCE_REVIEW.md); neither acceptance is complete. No deployment is authorized. Earlier descriptions of PR #53 as awaiting merge are historical.

## Validation continuation - 11 November 2026

This continuation starts from main `f29ce705d4cb1ced1a3d9440b43e872336994d60` (PR #52). There were no open PRs at the initial check. The combined application workflow and the documentation commit's validation both ended **cancelled during Playwright installation**. On `f29ce70`, recovery, API and booking ownership checks passed; hosted Chromium/Firefox and the final dependency audit were skipped. The integration rejected a retry with HTTP 403 (Actions write permission unavailable). Do not describe either cancelled run as passing. [Exact evidence](OPSDESK_VALIDATION.md#validation-continuation---11-november-2026)

The evaluator now accepts a reviewer-labelled local dataset and emits provenance/hashes, per-category metrics and a confusion matrix. A blank synthetic review pack and [review procedures](OPSDESK_ACCEPTANCE_REVIEW.md) are available. No independent dataset was scored. Narrator launched but its captured window reported a Windows integrity restriction; spoken output remains unverified.

**Copy-ready continuation**

> Continue OpsDesk from latest main and inspect open PRs plus CI first. Read this section, the handoff, backlog, validation record and acceptance review guide. At base f29ce70, combined main CI was cancelled during browser installation; recovery/API checks passed but hosted browsers and the final audit were skipped. The retry was denied with HTTP 403. Check this continuation PR's hosted results separately and leave merge to collaborators. Obtain an observable spoken screen-reader review and independently assigned human labels before running the new --dataset evaluation mode. The supplied review pack is unlabelled synthetic wording, not independent acceptance. Existing synthetic regression scores remain 27/30 and 17/18. Keep representative/cold-cache load, agreed targets, live booking/mail, scanner monitoring, retention and operational recovery open. Use Node 22.23.x and the isolated synthetic preview; run API/browser suites sequentially. Preserve authorization, agency isolation, sessions, saved deadlines, idempotency and audit. No provider is selected. Deployment remains paused.

Earlier checkpoints below remain historical; their pending-CI wording is superseded by this section.

## Current checkpoint after PRs #50 and #51

The latest application checkpoint is `b667d12a24c3dc091000f7a5d703a19b463888b1`. The customer portal and sustained-load rehearsal are merged. There were no open PRs when this handoff was prepared. The combined main workflow reached Playwright installation, with hosted Chromium and Firefox pending at that check. The portal passed both engines locally. [Combined main CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43044393887)

**Copy-ready message for the next teammate**

> Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support. Fetch latest main and check open PRs and CI. The verified application checkpoint is b667d12, with PRs #50 and #51 merged. Read this file first, then OPSDESK_HANDOFF.md, OPSDESK_BACKLOG.md, OPSDESK_VALIDATION.md, OPSDESK_BOOKING_APPROVALS.md, OPSDESK_ATTACHMENTS.md and the root README.
>
> **Finished and merged.** The customer portal shows scoped booking cards and case history with the existing ticket and cancellation-request actions. Local API and Chromium/Firefox workflows passed. Actual Chrome tab zoom passed at 200% and 400% on the customer workspace. The synthetic load harness ran for 60 seconds at 12 workers and completed 3,904 requests, with 781 writes verified exactly once.
>
> **Partially complete.** Load has single-host synthetic evidence. Cold-cache testing, representative booking and role distributions, and performance targets still need acceptance. Synthetic booking approvals, the email pilot, local ClamAV and recovery rehearsals work. Live booking and mail, production scanner monitoring, retention approval and operational recovery still need owners, credentials or an approved environment.
>
> **Next work.** First check combined main CI, including Firefox. Then arrange observable spoken screen-reader review and independently labelled classifier evaluation. Use local tools where possible. No booking provider is selected. Keep deployment paused.
>
> Use Node.js 22.23.x, npm ci and npm run ops:preview in an isolated synthetic environment. Run API and browser fixtures sequentially. Preserve authorization, agency isolation, sessions, saved deadlines, idempotency and audit history. Leave unrelated branches and worktrees intact. Record exact evidence in the validation docs and push a reviewable PR to main.

The sections below are historical. Use this checkpoint for current status.

## Customer portal continuation

Start from main `5956e1f` after PR #49. The PR and post-merge workflows passed, including both hosted Firefox steps. The customer workspace now summarizes scoped cases and presents authenticated bookings as cards with on-demand support history. Existing new-ticket and cancellation-request controls remain available. The original Stitch ZIP was unavailable in this checkout, so the adaptation follows the merged cobalt/navy design.

**Copy-ready continuation prompt.** Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support. Fetch main and review open PRs and CI. Read this checkpoint, then the handoff, backlog, validation record, booking approval guide, attachment guide and README. Review the customer portal PR and leave merge to collaborators. Actual Chrome tab zoom passed at 200% and 400% on the customer workspace. Use the validation record for the tested interactions. Obtain spoken screen-reader acceptance on an observable setup. Continue independent AI evaluation and representative sustained load and recovery acceptance. No live booking provider is selected. Live email and booking acceptance, scanner monitoring and retention approval remain open. Use Node.js 22.23.x, an isolated synthetic preview and sequential API/browser suites. Preserve access scopes, sessions, saved deadlines, idempotency and audit. Deployment remains paused.

The earlier sections are historical checkpoints.

## Latest follow-up — case detail and Insights reference adaptation

Started from merged main `a2d65cd440fabf1e9c268b6888dcdab01e4317e4` after PR #48. Both [PR #48 validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43018682596) and [its post-merge run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43018765372) passed, including hosted Chromium and Firefox. No PRs were open at the start of this follow-up. A separate worktree preserved the merged branch and all unrelated work.

The current branch adapts two more surfaces from the user-provided Stitch ZIP. Case detail gains a four-step isometric journey panel driven by saved case state: intake, owner, supplier reply and outcome. Insights gains three isometric issue columns driven by the existing authorized category counts. These visuals do not claim a live itinerary, provider command, or financial metric. The original case conversation, supplier threads, audit/activity, manager controls, deadlines, booking context and scoped report remain in place. A focused accessibility regression scans both views in light and dark themes and checks the small message-visibility target. See [current validation](OPSDESK_VALIDATION.md#case-detail-and-insights-reference-follow-up--11-november-2026).

Actual spoken screen-reader announcements and 200%/400% browser zoom remain unverified; use a working observable browser/assistive-technology setup and record the result rather than treating viewport sizes or axe as acceptance. Local Firefox has previously failed to launch with `spawn UNKNOWN`; rely on this PR's hosted Firefox run only after checking its actual status. Next, adapt the customer portal reference using only verified, scoped records and supported actions, then complete the manual accessibility checks. No provider is selected. Production scanner monitoring, retention approval, live booking/email acceptance, independent AI evaluation, representative sustained load and operational recovery remain open. Deployment remains paused.

**Copy-ready continuation prompt:** Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support. Fetch latest main and check open PRs plus CI first. Review the current case-detail/Insights Stitch follow-up PR and hosted checks; leave merge to collaborators. Read docs/OPSDESK_NEXT_TEAMMATE.md first, then handoff, backlog, validation, booking approval and attachment guides and README. The branch adds record-driven case journey and Insights 3D columns, and fixes dark-view contrast and a small message select target. Continue the customer portal visual adaptation with real scoped records and working actions. Obtain observable 200%/400% browser zoom and spoken screen-reader acceptance; those remain unverified. Run Node 22.23.x, npm ci and isolated synthetic ops:preview, with API and browser suites sequentially. Preserve authorization, agency isolation, sessions, deadlines, idempotency and audit. No booking provider is selected; live booking/email, independent AI evaluation, sustained representative load, operational recovery, scanner monitoring and retention approval remain open. Keep deployment paused. Commit verified work and open a PR targeting main.

## Latest continuation — Stitch workspace UI and keyboard coverage

Started from clean main `bc5f69630b7ddf78685e58d7de248c1d8ddbbae2` after PR #47 merged. [Its post-merge validation succeeded](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42995341740); no PRs were open at the start. This branch adapts the user-provided Stitch screens to the existing functional workspace: cobalt and navy visual treatment, manager route globe, manager queue before administrative settings, and a persistent light/dark toggle. The attached sample metrics, provider statuses and unsupported actions were reference material, not instructions or live data. Existing scoped records and controls remain authoritative. See [new verification](OPSDESK_VALIDATION.md#stitch-workspace-and-cross-role-accessibility-follow-up--11-november-2026).

Cross-role keyboard checks now cover dialog initial focus, Tab and Shift+Tab containment, Escape focus return and Notifications in manager, agency, customer, agent and supplier workspaces. Dark-theme axe states include the inbox, booking dialogs and role guides. Actual screen-reader speech and 200%/400% browser zoom remain unverified: the computer-use bridge failed to initialize, page-level zoom keys did not change browser scale, and a native Edge-window key attempt also produced no observable change. Continue those checks with a working observable setup; do not equate viewport reflow with zoom. Local Firefox still fails to launch with `spawn UNKNOWN`, so check hosted Firefox CI for this PR. Deployment remains paused.

**Copy-ready continuation prompt:** Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support. Fetch main and inspect open PRs and CI first. Review this Stitch UI/theme PR and its hosted Chromium/Firefox checks; leave merge to collaborators. The branch preserves real role-scoped data while adapting the supplied mockup, adds a decorative 3D route globe and persistent light/dark toggle, and extends cross-role keyboard and dark-theme axe coverage. Read docs/OPSDESK_NEXT_TEAMMATE.md first, then handoff, backlog, validation, booking and attachment guides, and README. Actual screen-reader announcements and 200%/400% browser zoom remain unverified; use an observable setup and record the results accurately. Local Firefox cannot launch on this Windows host. No live booking provider is selected; live booking/email, independent AI evaluation, representative sustained load, operational recovery, scanner monitoring and retention approval remain open. Use Node 22.23.x, npm ci and an isolated synthetic preview; run API and browser fixtures sequentially. Preserve authorization, agency isolation, sessions, deadlines, idempotency and audit history. Deployment remains paused.

This checkpoint supersedes older remaining-work statements below and in the historical handoff. Deployment is paused. PRs #45 and #46 are merged into main `84aa88e037ad1f1310b1d40d83ff5cb7cc5f620a`; their combined [post-merge validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42989735456). Leave merge decisions to collaborators.

## Current accessibility follow-up

Published in [PR #47](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/47), targeting main; implementation commit `50b83b6`. Leave merge decisions to collaborators. Local preview services were stopped after the completed checks. Check the latest PR-head CI result before merging or starting dependent work.

Branch `codex/manual-accessibility-acceptance` fixes four observed defects: narrow header actions falling off-screen, Notifications extending outside the workspace, missing notification Escape dismissal, and intake pagination forcing horizontal dialog scrolling. Header actions wrap, the panel stays within the narrow workspace, Escape restores notification-button focus, and pagination wraps. Server access boundaries, session safeguards, audit history and saved deadlines are unchanged. [Exact checks, failures and remaining acceptance](OPSDESK_VALIDATION.md#manual-accessibility-follow-up--11-november-2026).

Local verification passed: `npm ci`, both application builds, 91 backend unit tests, the full API command, six workflow scripts in each of Chromium and Firefox, ten axe states in each engine, five reflow/keyboard widths in each engine, changed-file lint, script syntax and whitespace checks. The full API breakdown is in validation; live services and production readiness are not established by these results.

Actual screen-reader announcements remain unverified: portable NVDA setup was blocked by automatic approval, Narrator launch timed out, and the user explicitly directed continuation with announcements unverified. Browser zoom shortcuts did not produce an observable scale change; viewport resizing is not actual zoom acceptance. Finish those checks with a usable assistive-technology/browser setup and broaden manual role/workflow coverage. No hosting or deployment work is authorized.

## Earlier checkpoint (historical)

## Published work and merge state

| Work | Branch / PR | Verified state |
| --- | --- | --- |
| Latest fetched main | `main` at `66b43b8` | [PR #43](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/43) consolidated the booking and accessibility stack into main. PR #44 merged the free-first handoff. [Main CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42896535687). |
| Secure attachments | `codex/opsdesk-secure-attachments`, [PR #40](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/40), head `6d04f35` | Both builds, 90 unit tests, standard API suite, 23 attachment HTTP checks and five Chromium flows passed locally. [Hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42889371405), including Firefox. Merged into main by PR #40. |
| Booking requests and exploratory load harness | `codex/opsdesk-booking-approvals`, [PR #41](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/41), head `9f3ff92` | Originally stacked on #40; now included in main through PR #43. Both builds, changed-file lint, 90 unit tests, standard API suite, 31 focused booking checks and all six Chromium flows passed. [Hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42892893653), including the standard cross-browser flows. |
| Accessibility audit harness and this handoff | `codex/opsdesk-accessibility-checks`, [PR #42](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/42) | Originally stacked on #41; now included in main through PR #43. Adds `npm run ops:test:a11y` with axe WCAG A/AA checks across ten states. Seven shared text colors were darkened to fix the recorded contrast defects. All ten Chromium states now pass axe WCAG A/AA checks, and the scan is included in the standard browser command. Manual assistive-technology acceptance remains open. Latest hosted validation must be checked. |

PR #40 merged into main directly; #41 and #42 merged into their original base branches and were then consolidated into main by #43. No further stack retargeting is needed for those changes. Start new work from current main. Leave future merge decisions to collaborators. GitHub rejected workflow-file edits because the token lacks `workflow` scope; all published changes avoid workflow-file edits and use the existing test commands.

## Implemented behavior

**Attachments:** message-thread upload/list/download UI; author-only uploads; current membership and customer/internal/supplier thread access checks; 2 MiB per file and five files per message; content/type checks; ClamAV INSTREAM integration that fails closed outside the synthetic preview; five-minute user-bound links that still require authentication; private database bytes; successful-upload audits; 30-day expiry and hourly deletion. The browser proxy now preserves binary bytes. The synthetic scanner is a fixture, not malware protection. Email does not deliver or import attachment bytes. See [attachment guide](OPSDESK_ATTACHMENTS.md).

**Booking requests:** agency/manager creation requests and scoped cancellation requests; manager approval/rejection with reasons; UUID request retries; repeat-safe concurrent decisions; trusted local agency/customer/supplier checks; UTC/IANA validation; stale-booking fingerprints; synthetic booking creation and cancellation persisted with audits. Cancellation preserves existing cases and saved deadlines and adds one event per linked case. The directory shows cancelled bookings. Agency and customer request forms now use the same scoped API and show request status. Manager review remains in Booking reviews. Provider-managed cancellations cannot run through the synthetic adapter. See [booking policy and API](OPSDESK_BOOKING_APPROVALS.md).

**Exploratory load:** `npm run ops:load` runs configurable mixed reads/writes on disposable local case fixtures and verifies acknowledged writes. One 200-request run at concurrency eight on 60 seeded cases/192 messages persisted all 40 writes exactly once, with p50 49 ms, p95 95 ms, p99 179 ms and 144.6 requests/second. These numbers are not representative-volume or production acceptance.

**Existing AI baseline:** synthetic development classification scored 27/30 and synthetic holdout scored 17/18. No independent evaluation or external LLM acceptance is claimed.

## Message buffer continuation

The optional query profiler controls the message table and index shared buffers in a disposable database. Use the [procedure and limits](OPSDESK_QUERY_PROFILE.md#message-shared-buffer-experiment) and [validation](OPSDESK_VALIDATION.md#message-shared-buffer-experiment). Continue representative traffic design, observable spoken screen-reader review and independent human classifier labels. Deployment remains paused and merges remain with collaborators.

## Free-first options for remaining work

Options below were checked on 11 November 2026. They are development/testing choices, not newly connected services or proof of live acceptance. Recheck provider pricing and access requirements before selecting a live plan. No booking provider has been selected.

| Remaining area | Free option | Limit or additional requirement |
| --- | --- | --- |
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

1. Review the requester forms PR and its hosted checks. Main after PR #44 passed the full workflow. The requester change adds no migration.
2. The seven contrast colors in `frontend/app/globals.css` are fixed, and `npm run ops:test:a11y` passes all ten Chromium states. The scan now runs in the standard browser command. Check latest hosted Chromium/Firefox results, then obtain manual keyboard, screen-reader and zoom acceptance. Do not treat an automated pass as full accessibility acceptance.
3. Validate a real ClamAV daemon with clean, infected and unavailable-scanner cases; agree live file/backup retention and deletion policies. Review whether incoming/outgoing email attachments are required as a separate increment.
4. Select a booking provider. The user explicitly said none is selected. Duffel test mode was suggested for flight sandbox development, not adopted or connected. Use provider-neutral/synthetic tests meanwhile. Build credentialed read/reconciliation and eventual provider command handling with manager review, stable ownership mapping, retries/idempotency and confirmed cancellation outcomes. Fee and refund handling remain open.
5. Complete verified mail sending/receiving domains, credentials and a real send/receive/receipt/reply rehearsal. Synthetic and provider-fixture tests do not prove live delivery.
6. Obtain independently labelled evaluation data and evaluate classification, privacy/linking and grounded summaries/drafts. Current deterministic record briefs and synthetic keyword fixtures do not satisfy independent AI acceptance.
7. Reproduce the [sustained synthetic load rehearsal](OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal). Extend it to representative booking and role distributions and a cold-cache run, with owner-approved latency and throughput targets. See the [observed results](OPSDESK_VALIDATION.md#sustained-synthetic-load).
8. Complete operational recovery acceptance: named incident/recovery owners, approved live-data tenancy and retention, managed backups/monitoring/alerts and an approved staging restore. Existing synthetic recovery/worker-restart CI evidence remains useful but is not operational acceptance. Keep deployment paused.

## ClamAV checkpoint

PR #46 enables the real scanner when the local preview has a ClamAV host configured. Local Windows validation passed with ClamAV 1.5.4 and both a private test signature and official databases verified and installed by FreshClam. Clean files uploaded and downloaded byte-for-byte, EICAR was rejected, and stopping the daemon caused uploads to fail with HTTP 503 without storing files. The default synthetic attachment suite also passed. See the [attachment guide](OPSDESK_ATTACHMENTS.md) and [validation record](OPSDESK_VALIDATION.md). Production scanner operation, recurring signature monitoring and retention approval remain open.

## Synthetic recovery follow-up

The logical recovery rehearsal now checks that a truncated synthetic archive fails after table creation begins, leaves the disposable target empty, and allows an intact retry in that same database. Hosted CI runs the rehearsal through the existing recovery step. Review the exact validation before merging. Approved staging restore, backup storage and retention, recovery targets and on-call ownership remain pending. Continue the independent classifier and spoken accessibility reviews with human evidence. Deployment remains paused. [Recovery guide](OPSDESK_RECOVERY.md)

## Reproduce locally

Use Node.js **22.23.x**, `npm ci`, and `npm run ops:preview`. Keep the demo isolated and credential-free. This checkout used PostgreSQL port **55439**, API **3141**, and frontend **3140** because default ports were occupied. Local env files are ignored and were not committed. `LOCAL_POSTGRES_PORT` now supports an isolated database port; the preview derives the web port from `FRONTEND_URL`.

For these custom ports, set `OPSDESK_TEST_URL=http://127.0.0.1:3141` and `OPSDESK_BROWSER_URL=http://127.0.0.1:3140` before tests. Run `npm run ops:test` and then `npm run ops:test:browser` **sequentially**, since policy-mutating suites interfere when run together. The latter includes the new booking browser flow. Hosted CI exercises Chromium and Firefox. Local Playwright Firefox failed to launch on this Windows host (`spawn UNKNOWN`) even after reinstalling; do not count that as a local Firefox pass.

The preview generates a temporary attachment signing key if none is set; restarting invalidates old links. Live use requires an independent secret and configured scanner. Never commit credentials or enable live sending as part of a demo.

## Copy-ready next-teammate message

> Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support. Fetch main and check open PRs and CI first. This accessibility increment starts from main 84aa88e with PRs #45/#46 merged and combined post-merge CI passing. Review PR #47 (https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/47; implementation commit 50b83b6) and its latest CI before basing further work on it. Local preview services were stopped after verification. It fixes header/notification reflow, notification Escape/focus return and intake pagination overflow. Read docs/OPSDESK_NEXT_TEAMMATE.md first, then the handoff, backlog, validation, booking and attachment guides and README. Use the exact new results in the validation record; do not treat historical counts as new runs. Next verify actual screen-reader announcements and browser zoom, then broaden manual acceptance across roles. Announcements were explicitly left unverified at the user's request; viewport checks do not prove actual zoom. Real ClamAV acceptance passed in PR #46; production monitoring and retention approval remain open. No booking provider is selected. Live booking/email acceptance, independent AI evaluation, representative load and operational recovery remain open. Use Node 22.23.x, npm ci and the isolated synthetic preview, and run API/browser fixtures sequentially. Preserve unrelated work, authorization, agency isolation, sessions, saved deadlines and audit history. Commit verified changes and open a PR targeting main for collaborators to merge. Deployment remains paused.

## Expanded load continuation

PR #57 is merged at `0310cd5` with passing PR and post-merge validation. PRs #58 and #59 passed hosted Chromium and Firefox and remain available for collaborator review. This independent follow-up extends `npm run ops:load` to 12 seeded identities across five roles with per-identity counts. [Run options](OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal) · [Evidence](OPSDESK_VALIDATION.md#expanded-load-identity-rehearsal)

> Fetch latest main and check open PRs and CI. Continue with a human-labelled and adjudicated classifier export and observable spoken screen-reader review. Use Node 22.23.x and the isolated synthetic preview. Run mutating fixtures sequentially. Representative booking/identity populations, controlled caches, performance targets, live provider acceptance and operational recovery remain open. Keep deployment paused and leave merging to collaborators.
