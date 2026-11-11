# Supplied load targets — 12 November 2026

Started from fetched main `e699fd33ef1d29e815f6b664e7f37fb7ab554da9`, with PRs #58–#63 merged and no open PRs. PR #58 run `43088904262` and #59 run `43088962237` passed historically. The recorded #60 (`43090996154`), #61 (`43095738307`), #62 (`43096512227`) and combined main (`43098403977`) workflows were still **queued**, not passed, at this continuation's checks. The latest combined main run exposed no jobs yet. No cause for that queue state was established. Hosted Firefox acceptance for this combined checkpoint remains unverified.

The user confirmed **“No targets yet; add configurable checks.”** This increment adds strict version-1 `OPSDESK_LOAD_TARGETS` parsing and aggregate/per-role sample and latency checks, optional throughput/duration checks, a named configuration digest and explicit unconfigured/pass/fail states. Thresholds use unrounded measurements. Missing samples or metrics fail their configured checks. The harness reports only after cleanup; an unmet target then exits nonzero. HTTP/persistence/scope/cleanup failures remain fatal independently. No application policy, UI, database migration, provider integration or deployment behavior changed. [Procedure and schema](OPSDESK_LOAD_TARGETS.md).

## Completed local checks

Windows, Node **22.23.0**, isolated PostgreSQL **18.6**, API **3153**, frontend **3152**, database **55451**. Fresh ignored configuration and a separate worktree preserved unrelated branches and local data.

| Check | Result |
| --- | --- |
| `npm ci` | Passed: 1,166 packages added / 1,170 audited. Existing audit output: 28 vulnerabilities (5 low, 23 moderate); no dependency changes were made. |
| `npm run ops:preview` | Shared, backend and frontend builds passed. All 28 migrations applied to the new synthetic database; seed and readiness passed. |
| Load-profile/target unit tests | **10 passed**: 4 existing schedule/identity tests and 6 new target tests. Covers boundary equality, unrounded rejection, missing/undersampled roles, duration/throughput, absent metrics, strict config and no default pass. |
| Startup / classifier tooling tests | **3 / 6 passed** respectively. |
| Backend Jest | **91 tests in 10 suites passed**. |
| Core / pagination / directory HTTP checks | **121 / 124 / 177 passed**. |
| Lock concurrency | **13 checks passed**; 154ms controlled shared-lock wait and 15ms independent-message observation, not a throughput target. |
| Membership / SLA | **80 membership HTTP checks**; **56 SLA HTTP + 6 concurrency/reconnect checks** passed. |
| Workload / supplier calendars | **33 workload policy/multi-worker/pause checks**; **20 supplier-calendar HTTP checks plus policy assertions** passed. |
| Contracts / rotations | **52 contract HTTP checks plus policy/concurrency/snapshot/FK assertions**; **63 rotation HTTP + 54 policy/concurrency/state assertions** passed. |
| Signed inbound mail | Customer and supplier fixture summaries passed; harness reports scenarios without a numeric count. No live mail acceptance. |
| Attachments / booking requests | **23 synthetic attachment / 40 booking HTTP checks passed**. No fresh real scanner or live booking acceptance. |
| New real-HTTP target integration | **3 scenarios passed**: `not-configured` (child exit 0), broad test targets satisfied (exit 0), and deliberate `minRequests=201` against 200 operations (expected exit 1). Each exercised **200 measured requests, 40 exactly-once verified writes and 12 identities**, and restored original case/message/conversation counts. Total: **600 measured requests / 120 verified writes**. The failed-target child was the expected assertion, not a product failure. Test limits are wiring fixtures, not approved targets. |
| Formatting / syntax / whitespace | Prettier passed for all four changed/new load scripts and package.json. Node syntax and `git diff --check` passed. |
| Standard Chromium browser command | All **6 workflow scripts**, **26 axe states**, five viewport reflow widths, keyboard dialog/notification checks across all five roles and **2 blind-review-form tests** passed. |
| Standard Firefox browser command | The same **6 workflow scripts**, **26 axe states**, five reflow widths, five-role keyboard checks and **2 blind-review-form tests** passed. Both browser commands exited **0**, sequentially after the API/load tests. |

The full `npm run ops:test` command, now including the three target integration scenarios at the end, exited **0**. Mutating tests ran sequentially.

Local preview API, frontend and database services were stopped after the completed verification. No local check was interrupted or counted as passed before completion. Hosted CI remains separate and must be checked on the actual PR head before merging.

## Failures, corrections and unfinished acceptance

The first pre-implementation target-test run failed as expected because the new module did not exist (one test-file failure); after implementation all six new cases and four existing cases passed. The first package formatting check failed; Prettier corrected it and the final check passed. An early readiness probe received connection refused while the API was still booting; a later probe returned 200, and all API/load workflows completed successfully. These attempts are not described as passing checks.

No approved performance targets, representative dataset/traffic, controlled cold caches, human classifier labels/adjudication or new screen-reader speech were produced. The frozen reviewer export still needs human input. Live booking/provider selection, mail delivery, production scanner monitoring, retention and an authorized staging restore with owners/recovery targets remain unfinished. Deployment remains paused. Do not infer any of these acceptances from synthetic target passes or a valid report.

# Supplier message-history startup

The local manager, supplier-list and supplier-history run used Node 22.23.4 and loopback PostgreSQL 18.6 with one round, two repeats and a 150-second readiness limit. Three new processes completed nine timed GETs. Page 12 returned 20 of 240 messages, all in the selected supplier thread. A separate request after timing returned HTTP 404 for the other supplier thread. The first history read took 54.53 ms, with repeats of 21.81 and 27.83 ms.

The template held 37 conversations and 433 messages. A separate maintenance query found zero remaining profiler databases and verified the original counts of 60 cases, 192 messages and 12 conversations. Three startup guard tests, script formatting and syntax, workflow YAML parsing and Git whitespace checks passed. The local run used a longer readiness limit than CI. Cache state and representative performance acceptance remain open.

# Populated supplier startup follow-up

Main `0310cd5463428c467a9f7e470eea89496a5dc288` contains merged PR #57. The PR and main workflows both passed startup smoke, API and recovery, five-role load, Chromium, Firefox and the dependency audit. [PR validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43075807792) · [Main validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43076744463)

On Windows with Node 22.23.4 and loopback PostgreSQL 18.6, the first pre-fix probe timed out at 30 seconds before API readiness. With a temporary longer readiness limit, the same pre-fix assertion reached the API and rejected the empty supplier page. The updated manager/supplier run with a 150-second limit completed two fresh API starts and six scoped workload GETs. Manager returned 20 of 60 cases. Supplier returned 20 of 24 conversations, all in scope, with a separate supplier fixture in the database. Supplier first read took 58.34 ms, with two repeats at 16.32 and 21.72 ms. All owned processes and databases were cleaned up.

The CI-equivalent rerun passed with the default 30-second readiness limit. Supplier first read took 42.05 ms and repeats took 11.48 and 18.58 ms. A separate maintenance query found zero profiler databases. The original database retained 60 cases, 192 messages and 12 conversations. The CI workflow YAML parsed and selected manager and supplier.

The three startup guard tests and six classifier tooling tests passed. Syntax, formatting and whitespace checks passed. The loopback blind review form served 18 unlabelled examples. Human labels and spoken screen-reader acceptance remain pending. The populated probe exercises the supplier list. Representative traffic, supplier history reads and controlled caches remain open. Deployment remains paused.

# API process-start profile - 11 November 2026

Started from main `8c1d546925ff67400f59d1c946ab57ff1ab96d1f` after PR #56 merged. Both its [PR validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43071338763) and [post-merge main run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43071756560) passed, including Chromium, Firefox, the reviewer form, API/recovery/load and audit.

The new `ops:startup-profile` command creates a migrated/seeded disposable template, clones it per role/round, starts a fresh API on an available port and separates readiness/login/first-workload/repeat timings. API processes use generated secrets and an explicit synthetic environment in a directory without a caller `.env`. Model/mail credentials and caller runtime flags are not inherited. Only generated run-owned databases are removed, after stopping the owned API processes. A success report is emitted only after namespace cleanup passes. [Procedure, options and limits](OPSDESK_STARTUP_PROFILE.md)

## Local results

Node **22.23.0**, PostgreSQL **18.6** on loopback port **55449**, using the already-built current application backend. The profiler applied all 28 migrations and seeded its own template with **30 bookings, 60 cases and 192 messages**. It did not profile or mutate the existing application database.

A one-manager smoke completed readiness in **3,195.36 ms**, login in **386.39 ms**, first workload GET in **116.02 ms** and two repeats in **37.33 / 42.87 ms**, with both disposable databases removed. The full experiment then completed **two rounds × five roles**, each with a new API PID/database clone and **ten repeat reads**:

| Role | First GET, rounds 1 / 2 (ms) | Repeat p50, rounds 1 / 2 (ms) | Scoped total items |
| --- | --- | --- | ---: |
| Manager queue | 50.15 / 54.40 | 40.80 / 25.40 | 60 |
| Agency bookings | 142.66 / 350.71 | 18.22 / 26.54 | 11 |
| Customer bookings | 116.71 / 139.99 | 21.54 / 25.73 | 2 |
| Agent queue | 46.00 / 55.96 | 18.96 / 22.38 | 22 |
| Supplier conversations | 34.64 / 23.53 | 14.07 / 13.54 | 0 |

Across the full experiment, process-to-readiness ranged **2,421.61–2,670.01 ms** and login **225.14–270.36 ms**. All **110 measured workload GETs** passed and retained stable scoped totals. Ten observed PIDs were distinct. The ten probe databases and template were removed. Supplier results are explicitly empty-list observations; they do not establish populated supplier performance.

An interruption rehearsal emitted SIGINT after observing a connection from an owned API to its probe database. The profiler rejected with the expected interruption, stopped its process and removed its databases. A separate maintenance query found **zero profiler databases** remaining; the original application retained **60 cases, 192 messages and 12 conversations**. The first setup attempt exposed Prisma's non-CLI default export; resolving its explicit `prisma/build/index.js` CLI fixed it, and that failed attempt also cleaned up its template.

Three focused tests passed for loopback maintenance URLs, role/sample bounds, namespace construction and exclusion of inherited model/mail credentials/runtime flags. Prettier, syntax, actionlint and whitespace checks passed. CI now runs these guards in `ops:test` and a bounded one-manager integration smoke before browser suites. The full API/browser suites were not rerun locally for this harness/workflow change; check its hosted result separately.

PR #57 merged at `0310cd5`. The OpsDesk validation workflow passed on the PR and on the merged main commit. The [current handoff](OPSDESK_HANDOFF.md#current-merged-checkpoint) records the validation status of merged follow-ups #58–#62. [PR validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43075807792) · [Main validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43076744463)

These are **fresh API process** results, not full cold-cache acceptance: database/OS caches are not reset, readiness/authentication run first, frontend/TLS are absent, and sample/population sizes are small. No latency target is accepted. Human classifier labels/adjudication, spoken-output review, representative performance, live integrations and operational acceptance remain open. Deployment stays paused.

# Blind review form - 11 November 2026

Rebased onto main `9503315d239c3f41d8cb327a56b7f717c84110f9` after PR #55 merged. [PR #55 validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43069170073), including dynamic database-port setup, API/recovery, the five-role load smoke, both browsers and audit. Its [post-merge run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43070421350) was still active when this checkpoint was checked; inspect its final result separately.

The new `npm run ops:review-classifier` command serves a local-only browser form for the already merged blind pack. It preserves partial labels/rationales in downloadable drafts, imports JSON locally, displays text without HTML interpretation, and exports a schema-validated labelled dataset only after required fields/category coverage and the reviewer declaration are complete. It never imports classifier rules or generates predictions. Export timestamps and reviewer notes are provenance declarations, not independent acceptance.

Local verification on Node **22.23.0** passed in **Chromium and Firefox** through `npm run ops:test:review-form` (two tests per engine):

- The server serves only its fixed GET assets with no-store/CSP headers, returns 404 for environment/rules paths, and rejects POST with 405. The starter still has 18 examples with blank labels/rationales.
- Browser tests exercised category/rationale persistence, Previous/Next heading-focus return, draft download/re-import, rejected malformed import without data loss, cancellation of an unsaved-work replacement, required metadata/declaration/category-coverage gating, and reviewed JSON accepted by the shared evaluator validator. Artificial automated-test labels were used only on separate synthetic test strings; no human labels or independent scores were produced.
- An imported HTML-looking string remained literal text and created no image element. Observed browser requests were exclusively same-origin GETs; imported content was not submitted and no external host was contacted.
- Axe WCAG A/AA checks passed at the initial desktop state and narrow review state in both engines. The 375-pixel state had no document-level horizontal overflow. Rendered 1280-pixel desktop and 375-pixel mobile screenshots were visually inspected. These scans/focus checks do not establish spoken screen-reader acceptance.

The first axe test used Playwright's implicit page context and failed with an explicit-context requirement. It was corrected to create a browser context, after which both engines passed. Prettier, script syntax and whitespace checks are recorded with the final local checks. No application/API code, database, runtime credentials or classifier rules changed; full application/API/browser suites were not rerun locally for this standalone tool. The new tests are appended to the standard browser command so hosted Chromium and Firefox exercise the form too. Check this PR's hosted result separately.

Human labels/adjudication and spoken screen-reader output remain pending. Representative/cold-cache performance, live integrations and operational acceptance remain open. Deployment remains paused.

# Five-role load and CI port isolation - 11 November 2026

Started from main `64c5245223cab2913f5e07ab6c8f6b4543da72d6` after PR #54 merged. Its [PR workflow passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43064821827), including the pinned-runtime browser steps. The [post-merge run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43065054837) failed before checkout at PostgreSQL container startup: `failed to bind host port 0.0.0.0:55432/tcp: address already in use`. That run supplies no application test result. This follow-up requests a dynamic PostgreSQL host port and passes the assigned port to both the preview database URL and recovery maintenance URL. Browser host networking and all loopback guards remain intact.

The load harness now supports declared read weights for manager, agency, customer, agent and supplier identities. Manager note writes remain one in five measured operations, with existing exact-once storage checks. Supplier reads use a disposable shared thread/context message; setup and fixture cleanup remain separate from measured timing. Per-role and per-operation latency/count reports make the actual traffic visible. No application authorization, session or classifier behavior changed.

## Local verification

Node **22.23.0**, a newly initialized embedded PostgreSQL **18.6** instance on port **55449**, API **3241** and frontend **3240**. The isolated preview generated Prisma, applied all **28 migrations**, seeded synthetic records and built the shared package, backend and optimized frontend successfully. No live credentials or external service were used.

| Scenario | Measured requests | Exact-once writes | Observed results |
| --- | ---: | ---: | --- |
| Default manager, 8 workers | 200 | 40 | p50 54 ms, p95 119 ms, p99 408 ms; 117.3 requests/s. |
| Equal five-role reads, 8 workers | 200 | 40 | 32 reads per role plus 40 manager writes; p50 72 ms, p95 213 ms, p99 381 ms; 85.6 requests/s. |
| Equal five-role reads, 60 seconds, 12 workers, 3,000 background cases and 1,200 history messages | 8,035 | 1,607 | 60,116 ms including drain; p50 67 ms, p95 271 ms, p99 394 ms, max 671 ms; 133.7 requests/s. Queue page 150 and manager history page 60 were exercised. |
| Supplier-only reads, 4 workers | 20 | 4 | 16 supplier reads plus 4 manager writes; verifies manager writes remain enabled with zero manager read weight. |

The sustained run loaded **3,072 cases / 1,393 messages**. Its measured role totals (manager includes writes) were manager **2,893**, agency **1,286**, customer **1,286**, agent **1,285** and supplier **1,285**. Their respective p95 latencies were **350, 110, 112, 114 and 92 ms**. These timings are single-host synthetic observations, not targets or a comparison against a controlled earlier environment.

After all runs, a direct database check confirmed **60 cases, 192 messages and 12 conversations**, with zero `LOAD-` cases, messages or conversations remaining. An initial five-role preflight found no seeded Aster supplier conversation; the harness now provisions and verifies its own disposable thread rather than relying on incidental seed state. The failed setup also cleaned up its fixture cases.

Three profile tests passed for legacy defaults, equal five-role cycles, weighted quotas/zero manager reads and malformed/unknown/noninteger/negative/null/excessive weights. Prettier, actionlint 1.7.12 (external shellcheck/pyflakes unavailable) and `git diff --check` passed. Actionlint initially rejected numeric indexing of service-port metadata; the final workflow uses the string key `ports['5432']`. The new short five-role HTTP rehearsal is included in CI after API fixtures and before browser fixtures. This branch's hosted result must be checked separately; the full local API/browser suites were not rerun for this harness/workflow change.

## Remaining limits

Read weights are explicit test inputs, not owner-approved representative traffic. There is one seeded identity per active role, no newly generated booking distribution, no controlled cold-cache procedure, and no agreed performance threshold. Setup/authentication/preflights are excluded from timing. Independent human labels, observable spoken screen-reader acceptance, live booking/mail, scanner monitoring, retention and operational recovery acceptance remain open. Deployment remains paused.

# CI browser runtime follow-up - 11 November 2026

Started from main `b7bfa3a0197614ccbc432eeee516a4f17ab4a945` after PR #53 merged. Its [PR validation run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43059552387) ended cancelled at the 20-minute job limit. The browser installation logs repeatedly reported `Temporary failure resolving` for Ubuntu's Azure, archive and security package hosts while installing OS dependencies. Neither browser suite ran. The [post-merge run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43063889002) was still active when this follow-up began; do not infer its final result from the earlier failure.

The workflow now pulls the official Playwright **1.62.1 noble** image, pinned to manifest digest `sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e`, instead of downloading OS packages during validation. Chromium and Firefox still run as separate sequential steps after recovery and API fixtures. Each container uses host networking so the existing API/database `127.0.0.1` guards stay intact. The repository and setup-node's Node 22.23.x executable are mounted into the disposable runtime; each browser step prints its actual Node version. Browser processes use host IPC as recommended by the [Playwright container guide](https://playwright.dev/docs/docker). API/recovery and the dependency audit remain on the runner. The image pull and browser steps have explicit time limits and no fallback that skips a failed suite.

Registry verification returned HTTP 200 for the pinned version, confirmed linux/amd64 and linux/arm64 manifests, and confirmed `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` in its config. The image version matches the repository's exact Playwright dependency. Local workflow validation uses actionlint 1.7.12, downloaded from its official release and checked against the published SHA-256; external shellcheck/pyflakes are unavailable and disabled for that lint invocation. No Docker runtime is installed on this Windows host, so actual container/browser acceptance requires this PR's hosted run. No local browser, API, load or application build result is claimed for this workflow-only change. Deployment remains paused.

# Validation continuation - 11 November 2026

## Base main CI and access limits

Started from main `f29ce705d4cb1ced1a3d9440b43e872336994d60`, with no open PRs at the initial GitHub check.

- [Combined application run 43044393887](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43044393887), at `b667d12`, ended cancelled during browser installation.
- [Base main run 43045613008](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43045613008), at `f29ce70`, also ended cancelled during Playwright installation. Checkout, Node setup, install, booking-export checks, synthetic classifier regressions, isolated build/start, recovery safety/rehearsal, `ops:test` and booking ownership steps passed. Chromium, Firefox and the final production dependency audit were skipped.
- The base's separate release workflow was skipped. It is not validation evidence.
- Re-running validate job `130608803004` through the GitHub connector returned **HTTP 403, Resource not accessible by integration**. No retry was started and no workflow file was modified.

The historical statement below that combined main CI was still installing browsers is superseded by these observed final states. A cancelled job does not establish hosted browser acceptance.

## Classifier evaluation tooling

The new `--dataset PATH [--json]` mode evaluates reviewed local JSON without changing `classify`. It validates version/provenance, labels, rationales, all-category coverage and duplicate/fixture overlap; reports dataset and rule SHA-256, accuracy, macro F1, per-category support/precision/recall/F1, confusion matrix and error IDs. The existing fixed fixtures and thresholds are preserved. Metadata is a reviewer declaration, not proof of independence. There is no agreed acceptance threshold for custom datasets.

The 18-row starter pack has blank human labels/rationales and provenance fields. It was authored synthetically in this continuation and was not scored as independent evidence. [Review instructions and remaining acceptance](OPSDESK_ACCEPTANCE_REVIEW.md)

Local checks on Node **22.23.0**: `npm ci` installed 1,175 packages and built shared types; six evaluator tests passed, including known confusion-matrix arithmetic, incomplete/invalid inputs, normalized duplicates, fixture overlap, CLI JSON/hash generation and incompatible flags. Synthetic development regression remained **27/30**; synthetic holdout remained **17/18**. These are new runs of the existing synthetic fixtures, not new independent evaluation results.

No preview or API/browser suite was run for this scripts/documentation change. Application builds, browser runs and load counts in older sections are historical evidence. New hosted PR results must be checked separately.

## Screen-reader observation

The Windows app inventory showed no NVDA entry. Built-in Narrator initially returned no targetable window; a refreshed window inventory found its process window. Capture then reported: "Accessibility is limited because the target window has higher Windows integrity than the Computer Use helper." No OpsDesk spoken-output transcript/audio was observed. No security setting was changed. Spoken screen-reader acceptance remains **unverified**; the new cross-role checklist is a review plan only. Previous customer Chrome zoom acceptance is retained as historical evidence.

Deployment remains paused. Independently labelled evaluation, representative/cold-cache load with agreed targets, live booking/mail, production scanner monitoring, approved retention and operational recovery remain open.

# Merged customer portal and load checkpoint

Verified main `b667d12a24c3dc091000f7a5d703a19b463888b1` contains both PR commits. [PR #50](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/50) passed local Chromium and Firefox and actual customer Chrome tab zoom. [PR #51](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/51) passed its 200-request and 60-second local rehearsals. Detailed local results appear in the customer portal and sustained synthetic load sections.

GitHub merged both PRs while hosted browser installation was stalled. The #51 hosted run ended canceled during installation. The #50 rerun and combined main run were still at browser installation when this handoff was checked. Review the current steps before reporting a hosted browser result. [PR #50 CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43038919698) · [PR #51 CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43041641077) · [Combined main CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43044393887)

# Customer portal follow-up

Base main `5956e1f` includes PR #49. Both its [PR workflow](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43025515042) and [post-merge workflow](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43025626009) passed, including each Firefox step. GitHub showed zero open PRs before this work.

A fresh Windows worktree used Node.js 22.23.4 and `npm ci --no-audit` (1,166 packages). The isolated preview used PostgreSQL 55447, API 3151, and frontend 3150 on loopback. An initial database startup ran before dependency installation finished and failed on a missing PostgreSQL configuration template. The retry started successfully, applied all 28 migrations, seeded synthetic records and built the shared package and both apps. Changed frontend ESLint, script syntax and Git whitespace checks passed.

`npm run ops:test` passed 91 unit tests, 121 main HTTP checks, 124 pagination, 177 directory, 13 lock, 80 membership, 56 SLA plus 6 concurrency, 33 workload, 20 supplier-calendar, 52 contract, 63 rotation plus 54 policy/state, 23 synthetic attachment and 40 booking approval checks. Signed customer and supplier reply fixtures passed. API and browser fixtures ran sequentially.

Chromium and Firefox each passed all six browser workflows, 26 axe WCAG A/AA states, five reflow widths, and cross-role keyboard checks. Firefox used a separate Playwright browser cache. New assertions compare the visible customer booking references with the authenticated page, scan the cards in both themes, and check narrow-card layout, keyboard expansion and the existing booking request and ticket dialogs.

Actual browser zoom passed at **200% and 400%** in Chrome for Testing 151.0.7922.34. A temporary local extension set and read tab zoom with `chrome.tabs.setZoom` and `chrome.tabs.getZoom`. At 200%, the tab reported factor 2, DPR 2 and a 631 CSS-pixel viewport. At 400%, it reported factor 3.9999999999999996, DPR 4 and 315 CSS pixels. The support view and the bookings view with expanded history had no horizontal document or main-content overflow. Both zoom levels passed heading focus on booking navigation, keyboard expansion of case history, and opening and dismissing Booking requests and New ticket with focus return. The first full-browser launch failed with `spawn UNKNOWN`, and a fresh separate browser installation resolved it. A strict floating-point comparison and a reused signed-in profile interrupted two attempts. The final run used a fresh profile and a tolerance for the reported factor.

Windows Narrator started, but its window ran at a higher integrity level than the computer-use helper. The helper could not inspect the window or observe spoken output. Spoken acceptance remains open. Live provider acceptance, production scanner monitoring, retention approval, independent AI evaluation, sustained representative load and operational recovery remain open. Deployment remains paused.

# Expanded load identity rehearsal

Based on merged PR #57 at `0310cd5`. The existing startup PRs passed hosted Chromium and Firefox. [PR #58 CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43088904262) · [PR #59 CI](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43088962237)

Local Windows and Node.js 22.23.4. The isolated synthetic preview built both applications. Four load profile guard tests, syntax, formatting, workflow YAML and Git whitespace checks passed. The default run completed 200 manager requests and verified 40 writes. The expanded 200-request smoke ran all 12 identities and verified 40 writes. Both supplier accounts successfully read their own temporary histories and received HTTP 404 for each other's histories before timing.

The 60-second expanded rehearsal used 12 workers, 3,074 total cases and 1,394 starting messages. It completed 4,605 requests in 60.194 seconds at 76.5 requests/second, with p50/p95/p99 of 105/500/681 ms. The manager handled 1,658 requests including 921 writes. Each write persisted exactly once on its intended case. Agency, customer and agent each handled 737 reads, and supplier handled 736. Every identity received traffic. A separate database query confirmed restoration of the baseline 60 cases, 192 messages and 12 conversations. After adding the per-role rotation assertion, the expanded 200-request smoke passed again.

These are local synthetic observations. Real booking and account distributions, traffic targets and controlled-cache performance remain open. Human classifier labels and spoken screen-reader acceptance remain pending. Deployment remains paused.

# Case detail and Insights reference follow-up — 11 November 2026

Base: merged main `a2d65cd440fabf1e9c268b6888dcdab01e4317e4`, after PR #48. [PR validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43018682596) and [post-merge validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43018765372) both succeeded. No PRs were open when this branch started. A separate worktree used Node 22.23.0, `npm ci` (1,166 packages added, 1,170 audited, 28 existing advisories), and a fresh isolated synthetic `ops:preview` database. Both application builds passed on startup.

The user-provided Stitch case-detail and Insights screens were visual reference material. A four-step case journey panel now reflects the saved case, owner, supplier reply and current outcome. An isometric three-column Insights figure uses the existing authorized issue counts. No fictional flight, voucher, compensation, provider status or operational telemetry was added. Existing access, conversation, supplier, booking, audit, deadlines, idempotency and manager controls remain in place. The message-visibility select has a 30px target.

The expanded browser regression first failed on dark Insights and case-detail contrast (chart labels, context text, badges and status text) and the message-visibility target size. After the first fixes, it still found low-contrast supplier success, metric-note, journey and context text; targeted colors addressed those findings. A first attempted run timed out signing in because it started before the backend was ready; the next run reached the new assertions. The final focused Chromium run passed **24 axe WCAG A/AA states**, five reflow widths, cross-role keyboard/focus checks, the three data-driven Insights columns and four saved-state journey steps. Final `npm run ops:test:browser` passed all **six Chromium workflows** and repeated the **24 axe states** and five widths. `npm run ops:test` passed **91 backend unit tests**, then 121 main HTTP, 124 pagination, 177 directory, 13 lock, 80 membership, 56 SLA plus 6 concurrency, 33 workload, 20 supplier-calendar, 52 contract, 63 rotation plus 54 policy/state, 23 synthetic attachment and 40 booking checks. Signed inbound mail scenarios passed. API and browser suites ran sequentially.

Actual spoken screen-reader announcements and 200%/400% browser zoom remain unverified; prior viewport scans and key probes do not establish them. Local Firefox still cannot launch with `spawn UNKNOWN`; hosted Firefox CI must be checked after PR publication. Live integrations, scanner operations, retention approval, independent AI evaluation, representative load, operational recovery and deployment were not tested here. Deployment remains paused.

# Message shared-buffer experiment

On Windows with Node 22.23.4 and PostgreSQL 18.6, the query profiler passed at 100 and 6,000 generated bookings. In both disposable datasets it captured the actual manager query for page 60 of a 1,203-message case. The query returned 20 rows in every explain run. Each of the three pairs evicted the message table and four indexes only. No eviction was skipped, and each verification pass found zero additional message buffers to evict.

| Generated bookings | Shared reads after eviction, three runs | Shared reads on warm repeats | SQL time after eviction (ms) | Warm SQL time (ms) |
| ---: | --- | --- | --- | --- |
| 100 | 38, 38, 38 | 0, 0, 0 | 2.262, 1.040, 1.719 | 0.679, 0.479, 0.759 |
| 6,000 | 37, 37, 37 | 0, 0, 0 | 1.626, 1.277, 0.966 | 0.852, 0.626, 0.393 |

The 100-booking control with the option disabled completed the standard query profile and omitted the experiment from its report. After the three runs, no disposable profile databases remained. The source database retained 60 cases, 192 messages and 12 supplier conversations. The application and browser suites were not rerun locally for this profiler-only change.

The experiment leaves the OS cache uncontrolled and measures one SQL statement. Neither the timings nor the difference establish application-level cold-cache or production acceptance. [Reproduction and scope](OPSDESK_QUERY_PROFILE.md#message-shared-buffer-experiment)

# Historical Stitch workspace and cross-role accessibility follow-up — 11 November 2026

Base: clean main `bc5f69630b7ddf78685e58d7de248c1d8ddbbae2`. PR #47 was merged, no PRs were open, and its [post-merge run succeeded](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42995341740). Work used an isolated clone and synthetic PostgreSQL preview on Node 22.23.0. The user-provided Stitch ZIP was treated as design reference. Its invented case counts, provider status, automated rebooking and unsupported controls were not imported. No backend, migration, live integration or deployment changes were made.

## Implementation and verification

- Cobalt/navy workspace treatment, manager queue before administrative settings, a decorative CSS 3D route globe, and a Light/Dark switch that saves the choice in browser storage. The globe does not claim live flight telemetry.
- `npm ci` succeeded: 1,166 packages installed, 1,170 audited; npm reported 28 existing advisories (5 low, 23 moderate). Preview rebuilt shared, backend and frontend apps and used only seeded synthetic records.
- `npm run ops:test` completed before browser fixtures: **91/91 backend tests**, then **121 main HTTP**, **124 pagination**, **177 directory**, **13 lock**, **80 membership**, **56 SLA plus 6 concurrency/reconnect**, **33 workload**, **20 supplier-calendar**, **52 contract**, **63 rotation plus 54 policy/state**, **23 synthetic attachment**, and **40 booking approval** checks passed. Signed inbound mail scenarios also passed; that harness prints no numeric count. This was not a new real ClamAV run.
- Final `npm run ops:test:browser` in Chromium passed all **six workflow scripts**, five reflow/keyboard widths (**320, 375, 640, 900, 1024 CSS pixels**), five-role dialog/notification keyboard checks, theme persistence after reload, and **21 axe WCAG A/AA states** across light/dark workspaces and dialogs. A focused 21-state run also passed. Frontend production build and `git diff --check` passed. Hosted Firefox validation for this branch must be checked separately.
- Visual inspection used 1440×900 Chromium screenshots of the manager view in both themes; the displayed figures came from the synthetic preview. Manager admin controls remain below the live queue and remain available.

## Failing regressions and unresolved acceptance

The dark-theme axe regression failed first on numerous inherited green text colors against navy surfaces. After targeted text fixes, it failed on the linked-case chip's light background, then a broadened supplier-guide scan found the `.od-info` contrast defect. Each defect was fixed and the final 21-state scan passed. The first lint invocation ran from the repository root without the frontend ESLint config. The correctly scoped run then caught synchronous state restoration in an effect; it was changed to a scheduled restoration and changed-file lint passed. A page-level Chromium `Control++` probe and a native Edge-window key attempt both left measured `innerWidth`, `devicePixelRatio` and `visualViewport.width` unchanged; **actual 200%/400% browser zoom is unverified**. The computer-use bridge failed to initialize, so it could not provide an observable browser zoom path. Viewport reflow is not zoom acceptance.

Local Playwright Firefox again failed before tests with `browserType.launch: spawn UNKNOWN`; no local Firefox pass is claimed. Actual spoken screen-reader announcements remain **unverified** because no observable setup was available, consistent with the earlier user direction. Neither axe nor DOM focus checks establish spoken output. No live booking provider is selected. Live booking/email, independent AI evaluation, sustained representative load, operational recovery, production scanner monitoring and retention approval remain open. Deployment remains paused.

# Historical manual accessibility follow-up — 11 November 2026

Base: main `84aa88e037ad1f1310b1d40d83ff5cb7cc5f620a`, after PRs #45/#46 merged. No open PRs existed at start. Their combined [post-merge run completed successfully](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42989735456). Work used a separate clean worktree, Node **22.23.0**, isolated PostgreSQL 18, API `127.0.0.1:3143` and frontend `127.0.0.1:3142`. Other branches and uncommitted work were preserved. No deployment changes or migration were added.

## Implemented and directed manual checks

- Header actions wrap at narrow widths, and Notifications is anchored inside the available workspace rather than outside the viewport or over navigation.
- Escape in the notification controls/panel dismisses it and returns focus to Notifications. Pagination controls wrap rather than widening intake dialogs.
- In connected Edge, keyboard login traversed Email, Password and Sign in. Manager navigation reached New ticket and Booking reviews. Both dialogs opened with Close dialog focused; Shift+Tab wrapped to the last enabled form control. The ticket dialog's forward Tab wrapped back to Close dialog, and Escape restored New ticket. Booking reviews Escape restored its launcher.
- At a **320 CSS-pixel viewport**, the corrected ticket dialog had `clientWidth = scrollWidth = 256` in the observed Edge window. Its pagination wrapped visibly. Notifications stayed within the workspace (observed bounds approximately x=69 to x=291); Escape restored its button. Temporary viewport overrides were reset. This was viewport reflow testing, **not browser zoom acceptance**.

## Completed automated checks

| Check | Exact result |
| --- | --- |
| `npm ci` | Passed; 1,166 packages added / 1,170 audited. Existing audit report: 28 vulnerabilities (5 low, 23 moderate); no dependency upgrade was applied in this UI increment. |
| `npm run ops:preview` | Shared package, backend and frontend production builds passed; all 28 migrations applied/checked on the synthetic database, seed and local services started. |
| Backend Jest | **91 tests in 10 suites passed**, 0 failed. |
| Main HTTP / pagination / directories | **121 / 124 / 177 checks passed** respectively. |
| Lock concurrency | **13 checks passed**; controlled lock wait 160ms, independent message under held routing lock 18ms. Synthetic evidence, not a throughput claim. |
| Membership / SLA | **80 membership HTTP checks**; **56 SLA HTTP checks + 6 concurrency/reconnect checks** passed. |
| Workload / supplier calendars | **33 workload policy, multi-worker and pause checks**; **20 supplier-calendar HTTP checks plus deadline/snapshot/idempotency assertions** passed. |
| Agency contracts / rotations | **52 contract HTTP checks plus policy/concurrency/snapshot/FK assertions**; **63 rotation HTTP checks + 54 policy/concurrency/state assertions** passed. |
| Signed inbound mail | Customer and supplier signature/address/scope/replay/expiry/privacy/deadline/audit scenarios passed; harness prints scenario summaries without a numeric count. No live delivery was tested. |
| Attachments / booking approvals | **23 synthetic-scanner checks / 40 booking HTTP checks passed**. This increment did not rerun real ClamAV acceptance; see PR #46 evidence below. |
| Standard Chromium browser suite | All **six workflow scripts passed**: five-role core, membership, SLA, agency contracts, rotations and booking requests. Then all **10 axe states passed**, 0 violations under configured WCAG A/AA tags. |
| Standard Firefox browser suite | The same **six workflow scripts**, all **five reflow/keyboard widths** and **10 axe states passed** sequentially after Chromium. |
| Added reflow/keyboard regression | Passed at **320, 375, 640, 900 and 1024px**: header button bounds, notification bounds/Escape/focus return, booking-review focus return and intake pagination width. Included in the standard accessibility/browser command. |
| Changed-file lint / script syntax / whitespace | Both changed TSX files passed ESLint from the frontend directory. `node --check scripts/accessibility-smoke.mjs` and `git diff --check` passed. |

The complete API command finished successfully before the standard browser command began. API and browser fixtures were not run concurrently. Browser suites also run sequentially.

## Observed failures and fixes

Failing regressions were added before each fix: Mail outbox extended to x≈347 at 320px; the notification panel started at x≈−7; Escape left the notification panel open; intake needed 325px of scroll width with only 286px available in the Chromium dialog. Header wrapping, workspace-relative panel placement, Escape/focus handling and wrapped pagination fixed these failures. The final Chromium run passed all of them.

An intermediate harness timed out looking for Notifications on its second width because Escape had left the first panel open and the next click toggled it closed. The Escape fix and explicit hidden-state wait resolved that sequence. One focused run started during a preview rebuild and failed with connection refused; the completed rerun waited for readiness. An initial lint invocation used an incorrect path, then passed after running from the frontend directory; an earlier root-directory lint invocation exited 0 with the existing missing-pages-directory warning. These setup/harness failures are not recorded as product passes.

## Unverified and not run

Implementation commit `50b83b6` is published through [PR #47](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/47), targeting main. Local preview services were stopped after verification. Hosted validation is separate from the local results above; inspect the latest PR-head run before merging. Commit hooks (changed-file lint and commit-message checks) passed.

Actual screen-reader announcements are **unverified**. Automatic approval blocked portable NVDA setup, the built-in Narrator launch timed out, and an earlier native browser inspection stopped when it could not identify the browser URL. Browser-specific controls subsequently worked. The user explicitly instructed: **“Continue; record announcements as unverified.”** Accessibility-tree/DOM inspection and axe do not prove spoken announcements.

Actual 200%/400% browser zoom is **unverified**: browser-control shortcuts produced no observable viewport/scale change. The five viewport sizes above establish only the stated layout regression checks. Complete zoom, screen-reader announcements and broader manual role/workflow acceptance using an observable setup. No check interrupted during this increment is claimed as passed; failed attempts above remain recorded. The much earlier PR #28 user-stopped combined browser run remains historical and is not reclassified.

Live email delivery, live booking-provider acceptance (none selected), fresh real ClamAV testing, retention/deletion approval, scanner operations/monitoring, independent AI evaluation, representative sustained load, production policy and recovery acceptance were not run in this UI increment. Deployment remains paused.

# ClamAV preview validation

On Windows with Node 22.23.0 and isolated PostgreSQL 18, both builds, all 91 backend unit tests and changed-file lint passed. The verified ClamAV 1.5.4 Windows archive ran with a loopback TCP listener and a private EICAR test signature. All 23 attachment HTTP checks passed through the real daemon, including detection, clean upload and byte-for-byte download. The daemon log recorded `OpsDesk.Acceptance.Eicar.UNOFFICIAL FOUND`. With the daemon stopped, the same API returned 503 and stored no file. All 23 attachment checks also passed on a separate local API using the default synthetic scanner.

The first full archive download stalled. Verified byte ranges yielded the official release SHA-256. An early outage probe ran before the API started and received connection refused. The completed probes ran after the API became ready. FreshClam subsequently verified and installed the official daily (28180), main (63) and bytecode (339) databases in an isolated directory. The full 23-check attachment suite passed again with only those databases loaded. The daemon logged `Eicar-Test-Signature FOUND`. No production configuration or migration was required.

# Accessibility contrast follow-up

## Requester booking forms

Started from main `66b43b8` with PRs #43 and #44 merged and [main CI passing](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42896535687). On Windows with Node 22.23.0 and isolated PostgreSQL 18, both production builds, all 90 backend unit tests, changed-file lint and 40 booking HTTP checks passed. The existing database applied its eight outstanding migrations to reach 28. This increment adds no migration.

The booking browser flow passed locally in Chromium and Firefox. It covers agency creation, a lost response and same-ID retry, manager approval, customer cancellation, decision control visibility, the customer's scoped request list and persisted cancellation. All ten existing Chromium axe states passed. Full integrated validation runs in hosted CI. Live provider and manual accessibility acceptance remain open.

Seven foreground colors in `frontend/app/globals.css` were darkened without changing the palette or disabling rules. Both application builds passed on the isolated Node 22.23.0 preview. `npm run ops:test:a11y` passed all ten Chromium states with axe WCAG A/AA tags. The scan is now included in `ops:test:browser`, so hosted browser runs exercise it. Manual keyboard/screen-reader/zoom acceptance and latest hosted validation remain open.

# Attachment increment validation

## Booking approval follow-up

On Node 22.23.0, both builds and changed-file lint passed. Two booking migrations applied to the isolated PostgreSQL 18 database (28 migrations total). The full `ops:test` suite passed, and all six standard Chromium flows passed sequentially, including the new manager booking-review flow. The final focused booking harness passed 31 checks, including request/review retries, three concurrent approvals, exactly one audit record, cross-agency rejection, changed-booking rejection, database decision constraints, cancelled directory state, and preservation of linked case status/deadlines with one cancellation event. Synthetic classifier checks passed at 27/30 development and 17/18 holdout examples; those are not independent evaluation. Exploratory mixed-load results and production limits are recorded in [booking approval guide](OPSDESK_BOOKING_APPROVALS.md). [Hosted validation for booking PR #41 passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42892893653).

Attachment PR #40 separately passed [hosted validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42889371405), including Firefox; the Windows launch limitation below remains a local runtime issue.

On Node.js 22.23.0, Prisma client generation, both application builds and all 90 backend tests passed (10 suites, including four attachment tests). The 26 migrations applied to a fresh isolated PostgreSQL 18 database on port 55439. `npm run ops:test` passed. The attachment harness passed 23 checks for byte integrity, metadata, scopes, filename/type rejection, synthetic EICAR rejection, tampered signature, expiry and concurrent per-message limits. All five Chromium browser flows passed sequentially; the main flow uploads a file and verifies the downloaded filename and bytes through the browser proxy. Running policy-mutating API and browser suites simultaneously caused an SLA test collision; sequential Chromium execution passed. Firefox failed before executing a test with Windows `spawn UNKNOWN`, including after a fresh Playwright Firefox download; hosted Firefox acceptance remains required. `git diff --check` passed. Real ClamAV acceptance, hosted validation and deployment are not claimed.

# Supplier email reply validation

Started from merged PRs #36 and #37 at `fb5ffea7c1f0cb34202dd175fdcc071700b924e8`. The backend and optimized frontend builds passed on Windows with Node.js 22.23.4. The existing isolated database had no pending migrations.

The signed reply harness passed against PostgreSQL with mocked provider retrieval. Supplier checks covered separate opt-in, the current active mailbox, changed booking and closed conversation rejection, private visibility, unchanged deadline, the existing case transition, three concurrent copies yielding one message and audit event, and no outbound loop. The standard API suite includes this harness. It removes the temporary case and restores the seeded mailbox.

Credentialed send and receive acceptance and secure attachments remain open. Deployment stays paused.

---

# Customer email reply validation

Started from the Resend pilot in PR #36 at `3f6646bb99b72408f97a23b03455ae1db5e61093`. On Windows with Node 22.23.4, Prisma applied the inbound-reply migration to the isolated synthetic database, the backend build passed, and Jest passed 86 tests across 9 suites.

The signed reply harness passed against real PostgreSQL with mocked provider retrieval. It checked invalid signatures and reply addresses, mismatched and stale customers, expired and closed cases, concurrent duplicate provider IDs, the customer author and visibility, and absence of any outbound job for the reply. The harness removed its fixture rows and restored case state. It runs as part of `npm run ops:test`.

The optimized frontend build, changed-file ESLint, 693 HTTP checks, concurrency suites and all five browser flows in both Chromium and Firefox passed locally. The first API run stopped on a preview connection reset. The full rerun passed against the same isolated preview.

A verified receiving domain, real provider send/receive acceptance, supplier replies and secure attachments remain open. Deployment stays paused.

---

# Resend mail pilot validation

Started from merged PR #35 at `5661ba79477a41d5a7d36c8ecaa4de87226e51a9`. On Windows with Node 22.23.4, the backend and optimized frontend builds passed and the pilot migration applied to the existing isolated synthetic database. Jest passed 83 tests in 8 suites. New coverage uses mocked provider HTTP and verifies mode isolation, the recipient allowlist, stable request keys, the retry cutoff, signature and timestamp checks, and receipt deduplication.

The standard API and concurrency suite passed, including 693 counted HTTP checks and the disabled webhook check in the demo. All five standard browser flows passed in both Chromium and Firefox. Changed-file ESLint and Git whitespace checks passed.

A separate local HTTP run with a fixture signing secret verified that the real Nest route rejects altered raw bytes, accepts three simultaneous deliveries of the same signed event, records out-of-order sent and delivered events once each in PostgreSQL, and ignores incoming-email events. The fixture job and its receipts were removed. Provider credentials, external delivery, and deployment remain pending.

---

# Synthetic mail outbox validation

Reconstructed on merged main `cb00be2a0d3a2487abaa1250f06f567b6e3f70a6` (PR #34). The prior unpublished implementation and its test results are separate from this increment.

- Windows and Node.js 22.23.4. A fresh isolated PostgreSQL database applied all 23 migrations and loaded the synthetic seed. The backend and optimized frontend builds passed.
- The full API and concurrency command passed. Jest passed 78 tests across 7 suites. There were 692 counted HTTP checks: 120 workflow, 124 pagination, 177 directory, 80 membership, 56 SLA, 20 supplier calendar, 52 agency contracts and 63 escalation rotations. Workflow coverage includes outbox privacy, the default pause and manager controls.
- The command also passed 13 routing-lock checks, 6 SLA concurrency and reconnect checks, 33 workload policy, multi-worker and pause checks, and 54 rotation policy, concurrency and state assertions. Supplier-calendar and agency-contract suites passed their additional state assertions.
- All five standard browser flows passed on Chromium and Firefox, including the outbox manager controls in the five-role flow. The first Firefox launch failed before reaching the app because the Windows installation lacked its mozglue assembly. A fresh Playwright install in a separate cache resolved the launch failure.
- The pre-commit checks passed changed-file backend and frontend ESLint. Git whitespace checks passed.
- Local startup initially timed out while embedded PostgreSQL initialized. Starting PostgreSQL separately before the preview resolved it. The first concurrency run exposed direct service construction without the outbox dependency. The harnesses now supply the same synthetic implementation explicitly.

The standard `npm run ops:test` and `npm run ops:test:browser` commands include outbox coverage. Run browser tests for both values of `OPSDESK_BROWSER_ENGINE` (`chromium` and `firefox`) against the isolated preview. The worker transport in this increment is in-process synthetic. Live-provider acceptance and deployment remain pending.

---

# Escalation-rotation validation - 10 November 2026

Started from merged main `ca3ae28faedbb081c5231c69d3accba812a82b43` (PR #33). Its [hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42848596124) for head `e419367819de224325d583c40deb4a830b4364d0`; that historical result is separate from this increment. Deployment remains paused.

## Current local evidence

Windows, pinned Node.js **22.23.0**, npm **10.9.4**, PostgreSQL **18.6**, private dependencies and the existing isolated synthetic workspace:

| Check | Observed result |
| --- | --- |
| Migration and builds | New migration applied to the existing 21-migration database; all **22 migrations** are current. Prisma generation, backend and optimized frontend builds passed; repeated startup preserved records |
| Unit tests | **73 passed in six suites**, including 11 new UTC rotation cases |
| Existing API/concurrency | **548 baseline HTTP checks** and **19 concurrency/reconnect checks** passed |
| Existing feature regressions | **33 workload checks**, **20 supplier HTTP checks**, **52 agency-contract HTTP checks** and associated assertions passed |
| New rotations | **63 HTTP checks and 54 policy/concurrency/state assertions** passed |
| Chromium and Firefox | All **five browser suites per engine** passed: five-role workflow, membership, SLA controls, contracts and rotations; delayed readback and 390px controls included |
| Offline checks | All **17** booking-export/recovery-safety tests passed |
| Booking integration | Both PostgreSQL ownership and transactional reconciliation checks passed |
| Production dependency audit | **Zero vulnerabilities** |
| Changed-file checks | Backend/frontend ESLint, commitlint and whitespace checks passed. Used direct checks and disabled the local hook wrapper for commit because the previously documented bundled Git/npm shell limitation remains |

The new API suite covers role and stale-session denials, roster validation and order, idempotent version/audit saves, UTC slot boundaries, regional precedence, Global fallback, explicit unowned gaps, primary recovery, coverage-only and timed holds, exact-absolute-expiry retries, off-duty rejection, suspension/reactivation, hold expiry on quiet cases, paused budgets, closed/reopened cases, non-staff metadata masking on details/queue/legacy workspace, policy-update and membership-update blocking, overlapping workers and reconnect durability. Existing response deadlines and snapshots remain equal through rotation changes. Fixture policies, profiles, case ownership, clock and test-created audit events are restored in the dedicated synthetic workspace.

## Failures and corrections

- The first browser harness used a relative Playwright request URL and stopped with `Invalid URL`. An absolute request then returned 401. Replaced that clock-advance shortcut with the actual manager Demo clock dialog; the targeted Chromium flow passed.
- A full browser pass exposed saved hours temporarily reading as **24 instead of 1** after quickly switching regions while the post-save directory request was pending. The editor now keeps the confirmed saved policy/version until the authoritative directory catches up, and disables fields during save. The regression deliberately delays the readback by 800ms; both final engine runs passed.
- Review identified that holds should expire on quiet active cases too. The worker now visits active manual holds and clears expired/lost-coverage holds even without a pending alert, while preserving the historical owner until an alert requires automatic routing. The expanded final API suite above passed.
- Ownership controls remount when persisted owner/hold state changes, preventing an automatic handoff from leaving an old manager selected in the editor. Shared policy forms now have visible input borders, spacing and mobile wrapping.

## Reproduce and boundaries

Use Node 22.23.x, `npm ci`, `npm run ops:preview`, then `npm run ops:test`. Install matching Chromium/Firefox and run `npm run ops:test:browser` for each `OPSDESK_BROWSER_ENGINE`. Targeted scripts are `scripts/rotation-smoke.mjs` and `scripts/rotation-browser.mjs`; both are included in the standard commands. Run against a dedicated isolated seeded workspace only: these harnesses temporarily change global/region policies, clock and synthetic managers, then restore their fixtures. Stop the preview before standalone builds.

Full inherited backend lint, screen-reader/contrast audit, skewed read/write load, live integrations and deployment were not run. Local reconnect/transaction checks do not establish OS crash recovery. Archive/restore and worker-termination validation remain enabled in hosted CI and must be checked for this feature head independently. Drain older workers before deploying rotation semantics when deployment is authorized. Full rotation policy revision archives, multi-level acknowledgment escalation and external paging remain future extensions; see the [policy contract](OPSDESK_SLA_CALENDARS.md#escalation-rotations-and-manual-holds).

Earlier sections below retain historical evidence.

# Agency-contract validation - 10 November 2026

Started from latest main `31cd21f42e7a1e9d5f8efbdc8f019ddb3f756d62` in a fresh private clone. Used Windows, Node.js **22.23.0**, npm **10.9.4** and embedded PostgreSQL **18.6** with isolated synthetic records. Deployment remains paused; older worktrees were untouched.

## Completed local checks for this increment

| Check | Observed result |
| --- | --- |
| Clean installation | `npm ci` passed using Node 22.23.0; private dependencies, no reused junctions |
| Migration/builds | Prisma generation and all 21 migrations applied to a fresh database; backend and optimized frontend production builds passed; a second startup preserved records |
| Backend unit tests | All **62 tests in five suites** passed |
| Existing API and concurrency | **548 HTTP checks** (111 workflow, 124 pagination, 177 directory, 80 membership, 56 SLA) and **19 lock/concurrency/reconnect checks** passed |
| Workload and supplier regressions | **33 workload checks** and **20 supplier-calendar HTTP checks** plus their policy assertions passed |
| Agency-contract regressions | **52 HTTP checks** plus snapshot, FK, version, pagination and concurrency assertions passed |
| Chromium and Firefox | All **four suites per engine** passed: five-role workflow, membership, SLA manager and new agency contracts |
| Offline checks | **17 passed**: 12 booking-export and five recovery connection-safety tests |
| Booking integration | Both PostgreSQL checks passed: ownership/collisions/schedule drift and transactional apply/replay/rollback/cancellation guards |
| Production audit | `npm audit --omit=dev` reported **zero vulnerabilities** |
| Changed-file checks | ESLint passed for changed backend/frontend TypeScript; `git diff --check` passed |

The contract harness checks role denials, persisted agency scope despite spoofed agency input, foreign/missing/retired contract rejection, mandatory selection even with all contracts retired, independent contract targets, business-calendar snapshots, policy edits preserving active deadlines, pause/resume under saved policy, same-contract reopen including retirement, legacy default reopen, forbidden contract reassignment, referenced-contract deletion restrictions and database-enforced agency matching. Concurrent identical PATCH saves add one version/audit change; overlapping intake/policy edits save one coherent version. A 23-contract tied-name fixture proves bounded, complete, nonoverlapping pages. Browser coverage creates a contract through manager controls, reads it back, explicitly selects it for booking-linked intake and verifies the saved snapshot; the same dialog is exercised at 390px width. Screenshots were inspected locally. Fixtures and audit records are removed in finally blocks.

## Observed failures and corrections

- The initial frontend build rejected two source files after an editing helper wrote non-UTF-8 punctuation. Converted the edits to UTF-8, corrected replacement characters and repeated both builds successfully.
- The first referenced-contract deletion assertion expected only PostgreSQL `23503`; PostgreSQL 18 returned `23001` for the intended RESTRICT rejection. The assertion now accepts both integrity-violation codes; final API checks passed.
- The first contract browser attempt could not find the exact wrapped select label because option text affected its accessible name. Added an explicit `aria-label` to the agency selector; Chromium and Firefox rechecks passed.
- Early lint/formatting invocations used the wrong monorepo dependency path and did not run. Corrected paths; final changed-file ESLint and formatting completed successfully.
- Commit hooks could not find `npx`; adding the existing npm bin path then exposed missing Bash and an incompatible npm-wrapper layout. Direct staged-hook attempts restored their temporary stash cleanly. Ran equivalent changed-file ESLint and commitlint directly, then disabled only the hook wrapper for the local commit. Repository hook files were preserved.

## Reproduce and limits

Use Node 22.23.x, `npm ci`, and `npm run ops:preview` in a fresh isolated synthetic workspace. Run `npm run ops:test`. Install matching Playwright Chromium/Firefox, then run `npm run ops:test:browser` once per `OPSDESK_BROWSER_ENGINE`. Targeted commands are `node scripts/contracts-smoke.mjs` and `node scripts/contracts-browser.mjs`. Baseline suites expect seed agency policies without operator-created contracts; run on a dedicated test workspace, never shared/live data. Stop the preview before independent builds.

Full archive/restore and OS worker-termination rehearsals were not repeated locally; their existing hosted CI steps remain enabled. Full inherited backend lint, screen-reader/contrast audits, skewed load, live providers and deployment were not run. Development installation reports 29 development advisories (five low, 24 moderate); no unvalidated force upgrade was applied. Hosted validation for the published PR must be read independently from these local results. Richer escalation rotations and override policies remain next.

The following sections retain historical checkpoint evidence.

Publication resolved: direct upstream push returned HTTP 403 for `mehakgupta0406`. After the user supplied the earlier PR #14 publishing workflow, used the same existing project fork, `mehakgupta0406/opsdesk-travel-support`. GitHub initially rejected inherited workflow commits because the CLI lacked `workflow` scope; the user completed authorization and the branch push succeeded. [PR #33](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/33) is open against the requested repository's `main`, with collaborator edits enabled. The validated code commit is `acac059e8c6761a33147f9228ad8a57597bc7178`; this follow-up updates publication evidence only. Hosted checks have not yet reported a result. The PR was not merged and deployment remains paused.

# Workload handoff validation - 10 November 2026

Final checkpoint verification passed in [hosted run 42840920345](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42840920345) for supplier code head 2b77f073b17f7e32c4e4f1d8d389405630bacccf, merged into main cdd7d35. The final handoff PR changes documentation only.

## Supplier response calendar checks

On Windows with Node 22.23.0, the supplier migration applied, both production builds passed, all 62 backend unit tests passed and changed backend/frontend lint passed. The dedicated suite passed 20 real HTTP checks and associated assertions covering role denial, a one-hour weekly schedule with a one-hour target, hour limits, unchanged-policy retries, four elapsed hours, skipping a weekend and local holiday, saved deadlines after edits and supplier replies, and fresh targets on staff follow-up and reopening. Chromium and Firefox passed the updated SLA manager flow, including saving a supplier target and reading it again from the directory.

An early HTTP attempt reached the API before startup completed. A fixture assertion then interpreted a timezone-free PostgreSQL value in the Windows local zone. The corrected check compares the UTC deadline returned by the API. A browser check reproduced stale hours after reselecting a supplier. The editor now disables selection while saving and reloads the directory on refresh. Both engine rechecks passed. The full integrated workflow, recovery and dependency audit run in hosted CI. Deployment remains paused.

Reconstructed on ASUS from the pasted policy because the Arihant worktree was unavailable. Main 12114c6 includes merged PR #29. The supplied 15-unit/16-HTTP/13-policy results belong to that unavailable implementation and are not reported as results of this branch. The user explicitly requested continuation after the earlier 19:00 IST cutoff. Deployment remains paused.

On Windows with Node 22.23.0 and a fresh PostgreSQL 18.6 synthetic database:

- Prisma generation, all 19 migrations, backend build and optimized frontend build passed.
- All 62 existing backend unit tests passed.
- All 548 existing HTTP checks and 19 existing concurrency/reconnect checks passed.
- The new workload suite passed 33 checks, including 12 real HTTP authentication/policy checks and 21 policy, overlapping-worker, capacity, manual-decision, pause and reconnect checks. This suite is part of ops:test.
- Original five-role, membership and updated SLA browser flows passed in Chromium and Firefox. The SLA flow enables and disables automatic handoff using the manager controls.
- All 17 offline booking/recovery-safety tests and both PostgreSQL booking-integration checks passed.
- Changed backend/frontend ESLint and git whitespace checks passed.

Observed setup failures were corrected. Reused dependency junctions caused a missing Nest CLI and Turbopack package-root rejection. A private dependency installation resolved those build issues. An initial lint invocation used the wrong working directory and was rerun successfully. The expanded workload harness initially imported an uncompiled generated Prisma path and stopped before running checks; switching to the compiled path resolved it. The first completed targeted run passed 14 checks; later expanded runs passed 30 and then 33. No current product failure remains observed in completed local checks.

Full logical recovery and worker-kill rehearsal were not repeated locally; their CI steps remain enabled. Full inherited backend lint, assistive-technology/contrast testing, skewed concurrent load, real provider integrations and deployment were not run. Hosted results must be checked for this feature head separately.

Reproduce with Node 22.23.x, npm ci and npm run ops:preview in an isolated synthetic workspace. Run npm run ops:test, then install matching Chromium/Firefox and run npm run ops:test:browser for each engine. The workload-only command is node scripts/workload-handoff-smoke.mjs. The harness restores profile settings and removes its cases. Keep it away from shared or live data.

# Prototype validation

## Current SLA calendar / coverage validation - 10 November 2026

Deployment remains paused. Read all four requested project documents before implementation; inspected the existing deadline, routing, membership and lock paths. PR #28 is merged into main `6e97b6f`; its head `3b07fa4` has a successful hosted `validate` check ([run 42812617605](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42812617605)). This follow-up uses an isolated worktree; older uncommitted work was not overwritten.

Implemented opt-in agency business calendars (local holidays, IANA time zones, DST and service-hour budgets), immutable applied-policy snapshots, explicit staff pause/resume, member duty calendars, on-duty new assignments and audited escalation-manager ownership/handoff with an unowned fallback. Existing elapsed-hour targets, invitation/session guards and immutable identity scopes remain. See [policy contract, UI/API routes and limits](OPSDESK_SLA_CALENDARS.md).

### Completed local checks

Windows with explicit Node.js 22.23.0, PostgreSQL 18.6 and the isolated synthetic demo:

| Check | Exact observed result |
| --- | --- |
| Backend unit tests | **62 passed**, five suites: 42 existing plus 20 new calendar/coverage cases |
| Real HTTP checks | **548 passed**: 111 workflow + 124 pagination + 177 directory + 80 membership + 56 SLA checks |
| Concurrency / reconnect | **19 passed**: 13 existing lock checks plus 6 new overlapping pause/resume, multi-worker alert/ownership, coverage-update blocking and disconnect/reconnect checks |
| Chromium | Original five-role workflow, membership flow and SLA manager flow all passed |
| Firefox | Original five-role workflow, membership flow and SLA manager flow all passed |
| Offline regressions | **17 passed**: 12 booking-export and 5 recovery connection-safety tests |
| Booking integration | Both reported checks passed: ownership/collisions/schedule drift and transactional updates/replays/rollback/guarded cancellation |
| Builds and migration | Backend and optimized frontend builds passed; Prisma generation and the new nullable-field migration applied successfully to a fresh local database |
| Lint and whitespace | Changed backend/frontend file ESLint passed; frontend invocation from the repository root emitted the existing Pages-directory configuration notice, with no lint errors. Whitespace check passed. |

The full two-engine browser run was repeated after the profile-lock race fix. The last small paused-date formatting change was compiled and its SLA browser flows repeated separately. Older npm-shell runs sometimes selected the host Node 24 runtime; the reported final regression scripts and build commands were invoked directly with the pinned Node 22.23.0 executable.

### Failures observed and fixes

| Observed failure | Cause / change | Recheck |
| --- | --- | --- |
| Initial test invocation could not load TypeScript; zero tests ran | Dependency installation was still running | Retried after installation; not treated as a product red test |
| New SLA unit suite could not resolve `./sla-calendar` | Tests were added before the implementation | Implemented the calendar module; all 20 new cases passed |
| Unchanged calendar save incremented policy version (`3 !== 2`) | JSONB reordered object keys | Compare normalized calendars; idempotent-save HTTP regression passed |
| Sparse calendar returned HTTP 500 rather than 400 | Coverage horizon error escaped the API boundary | Convert calculation failure to a validation error and authorize before expensive configuration calculation; HTTP regression passed |
| Changed-file lint rejected an unnecessary assertion | Owner DTO narrowing already established the type | Removed the assertion; changed-file lint passed |
| SLA browser fixture request had an invalid relative URL, then received 401 | Harness API fixture setup did not establish a usable authenticated request | Replaced it with the real New ticket form; both engine flows passed |
| Worker finished before an in-flight manager-profile update committed (`early !== waiting`) | Eligibility was read without waiting for concurrent profile writes | Ordered shared manager-profile locks, then fresh eligibility read; deterministic two-connection regression passed |

A final code review also ensured paused travel breaches use the travel reason even when the original response target is earlier, non-staff responses do not expose escalation-owner metadata, audit cleanup is limited to this test's unique reason prefix, and paused date/countdown labels do not render a fake far-future due date.

### Interrupted and not-run checks

No current final unit/HTTP/browser run was interrupted. The final local Chromium/Firefox sequence before PR #28 publication was stopped at the user's request; that historical run still has no completed result and has not been reclassified as a pass or a product failure. New passing runs above are separate evidence.

Full logical backup/restore and OS worker-kill rehearsal were **not rerun locally** in this increment; their existing CI commands remain intact. Recovery connection-safety tests did run (5 passed). New SLA worker checks establish transaction concurrency and reconnect durability, not OS kill/crash recovery. Full inherited backend lint, independent production security review, assistive-technology/contrast audit, cold-cache and skewed concurrent load, hosting and live external integrations were not run or claimed. The new branch's hosted CI result must be checked independently after publication.

### Reproduce and remaining action

Use Node.js 22.23.x; install dependencies, run `npm run ops:preview` against the isolated synthetic demo, then `npm run ops:test`. Install matching Chromium/Firefox and run `npm run ops:test:browser` for each `OPSDESK_BROWSER_ENGINE`. The commands now include the SLA HTTP and browser scripts. Targeted commands are `node scripts/sla-smoke.mjs` and `node scripts/sla-browser.mjs`. The scripts restore temporary policy/shift/clock state and remove their fixtures/audit records. Do not run them on shared or live data. Stop the preview before separate builds.

Next review this PR and run hosted checks, then complete multiple contract/supplier calendars, automatic existing-agent workload handoff and richer escalation rotations. Live email/outbox/inbound signatures, scoped/scanned attachments, provider-neutral booking integration, independent AI evaluation and broader accessibility/load tests remain unfinished. Deployment, saved hosting preparation and live-data policy work remain paused.


<a id="current-membership-branch-validation-10-november-2026"></a>

## Historical membership branch validation 10 November 2026

Deployment is paused at the user’s instruction. The merged baseline is `f71b284487e0adad74a91ff15ac2da6554a2f525`, including PRs #25–#27; [main CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42805941972) builds, recovery, `ops:test`, booking integration, Chromium, Firefox and the production dependency audit. The following evidence concerns the unmerged `codex/opsdesk-membership-admin` feature and must not be conflated with that baseline.

| Check | Observed result / remaining gate |
| --- | --- |
| Backend unit tests | 42 tests across four suites passed. |
| Compilation and lint | Backend/frontend builds and changed-file lint passed. |
| Membership HTTP regression | 80 real PostgreSQL HTTP checks passed with the final quota change, including independent invitation budgets, unknown-token handling, manager-only selectors and unchanged case ownership/content. |
| Existing API and concurrency | The final `ops:test` run passed 111 workflow + 124 pagination + 177 directory + 80 membership = 492 HTTP checks, plus 13 concurrency checks and all 42 unit tests. |
| Browser checkpoint | The membership invitation/activation/suspension/reactivation flow passed with the Chromium-based `msedge` channel before the final quota change and added keyboard assertions. |
| Final local Chromium/Firefox sequence | Started, then stopped at the user's request to prioritize GitHub publication. No completed final pinned-browser result is claimed. The new keyboard assertions have not completed a run. |
| Independent review | One material issue found: a shared proxy-IP activation quota could block unrelated invitations. Fixed with separate valid-invitation/IP budgets; unit tests and the 80-check HTTP run passed. No other material defect was reported. |

### Failures observed and fixes

| Observed failure | Cause and fix | Evidence after the fix |
| --- | --- | --- |
| Suspended agent selected; suspended password login accepted; stale JWT accepted | Added active-membership checks, routing exclusion and live session-version validation | Backend policy tests passed; real HTTP suspension/reactivation checks passed |
| `Expected overlapping refresh transactions` in the existing HTTP suite | A global capacity lock serialized refresh requests. Replaced it with a per-profile shared row lock before token claim | Final 111-check workflow suite passed, including concurrent single-use rotation |
| Expired-invitation fixture unexpectedly accepted | The SQL fixture used a local timestamp while Prisma dates are UTC. Made the fixture explicitly UTC | Expired-invitation API check passed |
| Initial member directory did not appear | The UI sent an empty `kind` filter that the DTO rejects. Empty filters are now omitted | Membership browser flow passed in `msedge` |
| Browser could not locate the Role select by its label | Wrapped select names included option text. Added stable explicit accessible names | Membership browser flow passed in `msedge`; lint passed |
| Shared acceptance quota and unknown-token counter allocation | Initial quota grouped all invitations behind the same server IP. Valid invitations now use independent invitation/IP budgets; invalid tokens stop before counters/bcrypt | Two regression tests observed failing, then passed; final 80-check HTTP suite passed |

There is no known failing backend unit/API test in the completed final run. The stopped final browser sequence has no completed outcome; it must not be described as a pass or a product failure. Provider/hosted/live-data behavior was not tested, and no deployment was performed.

The acceptance quota is 20 attempts per valid invitation and connection IP over 15 minutes. Lookup precedes counter allocation, so invalid token values do not allocate counters or trigger expensive password work. The connection address is used without blindly trusting a caller-supplied forwarded header. This bounded invitation quota does not claim a general network abuse perimeter.

Reproduce from a clean feature checkout with Node.js 22.23.x. First terminal:

```powershell
npm ci
npm run ops:preview
```

The launcher generates Prisma, applies committed migrations and seeds only an empty isolated local synthetic workspace. Keep it running. In a second terminal run:

```powershell
npm run ops:test
npx playwright install chromium firefox
Remove-Item Env:OPSDESK_BROWSER_CHANNEL -ErrorAction SilentlyContinue
$env:OPSDESK_BROWSER_ENGINE = 'chromium'
npm run ops:test:browser
$env:OPSDESK_BROWSER_ENGINE = 'firefox'
npm run ops:test:browser
Remove-Item Env:OPSDESK_BROWSER_ENGINE
```

Stop on a failure and retain a secret-free report. `ops:test` includes the membership HTTP suite; `ops:test:browser` includes the original and membership browser scripts. The membership-only commands are `npm run ops:test:membership` and `npm run ops:test:membership:browser`. They require the isolated loopback PostgreSQL synthetic demo and clean up temporary fixtures. Do not run them on shared/live data. Stop the preview before a separate `npm run build`. Consult the [recovery runbook](OPSDESK_RECOVERY.md) for isolated recovery checks.

Review membership coverage for manager-only administration, bounded/paged selectors and audit, scope validation, invitation expiry/reissue/concurrent single-use acceptance, self/last-manager guards, session invalidation, suspended assignment exclusion and historical preservation. Browser checks should exercise the fragment activation screen, manual link handling, non-manager invisibility and keyboard access. Do not retain invitation links, passwords, token hashes or secrets in reports or screenshots.

The feature does not implement email delivery, contract calendars, shifts, escalation ownership, provider booking creation/cancellation policy, general identity-scope reassignment or deletion. Screen-reader/contrast audits, realistic load and operational live-data/recovery ownership remain acceptance work. No production-readiness claim is made.



## Historical query profiling follow-up - 10 November 2026

Initially reviewed open PR #15 and main `a5455a4`. PR #15 merged during validation; fetched/reviewed latest main `f865ea9` and rebased onto it. Its source tree matches the tested directory baseline. Validation used the pinned Node.js 22.23.0 runtime on Windows and a separate fresh PostgreSQL 18.6 database. Both production builds, Prisma generation and the new index migration passed. The 9 unit tests and all 400 HTTP checks passed, including extended directory fixtures for an unbooked case customer and a supplier-thread-only author. The five-role Chromium flow and directory page-selection browser checks passed. Changed-file ESLint and git whitespace checks passed. The known inherited full-backend lint errors remain outside this change.

`npm run ops:profile` calls compiled TravelService reads against disposable synthetic databases, captures actual query plans and timings, checks pre/post-index result equality, and probes global advisory lock waiting with two connections. It requires an explicit local maintenance URL and removes its randomly named database in finally. A run added 6,000 bookings, 18,000 cases and 54,000 messages on top of the demo seed. See [profile evidence and reproduction](OPSDESK_QUERY_PROFILE.md) for measured changes, warm-cache/vacuum caveats and remaining load work. Neither production throughput nor safe lock replacement is established by this evidence.

## Historical directory pagination follow-up - 10 November 2026

Reviewed merged PR #14 and latest main `a5455a4` before changes. Local validation used Windows, Node.js 24.21.0, npm 11.19.0 and a fresh embedded PostgreSQL 18 database. The repository still specifies Node.js 22.23.x; this run does not certify that pinned runtime.

- Next.js and NestJS production builds passed. Prisma generation and all existing migrations applied; no schema change is required.
- 9 unit tests, 99 core HTTP checks, 124 history-pagination HTTP checks and 177 directory HTTP checks passed (400 HTTP checks total).
- Directory fixtures create 45 bookings, 45 customers and 45 agents, then clean up. Checks cover all seven seeded account scopes, bounded/nonoverlapping pages, out-of-range clamping, invalid pages/kinds/search, unauthorized requests, filtered totals, manager-only specialties and empty compact directory arrays.
- The five-role Chromium flow passed, including intake, supplier replies, case resolution, message pagination and privacy. The browser selector test passed booking/owner search, page-two selection and selection retention across page navigation. Use `OPSDESK_DIRECTORY_BROWSER=1 node scripts/directory-smoke.mjs` with the preview running to repeat that test.
- Frontend lint and changed backend travel-file ESLint passed. Full backend lint reports existing unsafe-type errors in `src/ai/ai.service.ts` and `src/auth/guards/roles.guard.ts`; unrelated autoformat edits were discarded. Git whitespace check passed.

`GET /ops/bookings` and `GET /ops/people` accept validated `page` and bounded `search`; people also accepts `kind`. Counts and rows share server-side authorization predicates. Bookings order by reference/ID; people by first name/user ID. People visibility retains self, staff and participants/customers in authorized booking/case/thread context using parameterized database EXISTS queries, without materializing the whole directory. Only the current page's user names are fetched. Mutation endpoints continue to validate booking and assignment access independently.

Compact workspace metadata returns empty booking/people arrays; legacy full snapshots remain compatible for tests and older clients. Queue and detail responses supply bounded names/booking context. Agencies remain metadata lists. Counts are live rather than snapshot-isolated, so concurrent writes can shift offset pages. Search/count cost, deep offsets, realistic-volume EXPLAIN evidence, global lock contention, compatibility retirement and broader load/accessibility/security reviews remain open. Production deployment and live-data readiness are not claimed.


The prior merged implementation baseline is `13873d4`. [CI passed for the merged PR #12 head](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42668187410). The original Windows baseline below used Node.js 22.19.0, npm 10.9.3, PostgreSQL 18 (embedded), Next.js 16.4.5 and NestJS 11. Use Node.js 22.23.x for a fresh setup.

## Historical case-read pagination follow-up

Validated locally on Windows with Node.js 22.23.0 and a fresh embedded PostgreSQL database:

- Both production builds and all 9 unit tests passed.
- The original 99 HTTP workflow checks and 124 new pagination/access HTTP checks passed (`npm run ops:test`).
- `scripts/pagination-smoke.mjs` creates and removes isolated fixtures with 45 identical-timestamp records per collection. It checks page size, complete traversal without overlap, page clamping, invalid input, case and booking history, internal-note filtering, private status reasons, supplier ownership and regional/agency/customer access boundaries.
- The five-role Chromium browser flow passed, including older/newer message navigation. It asserts all browser workspace reads use `compact=1`, and checks separate case-message and supplier-message requests.
- The composite-index migration applied to a fresh database. Realistic-volume query-plan and load testing remain open.
- `npm audit --omit=dev` reported zero vulnerabilities.

The browser uses the compact metadata endpoint; the legacy full-workspace endpoint remains for compatibility with existing API workflow tests. Booking and people directories are still returned as authorized metadata lists.

## Historical original prototype checks

- Backend unit suite: 7 tests passed, including 6 travel policy tests.
- Real HTTP workflow suite: 47 checks passed against the actual NestJS API and PostgreSQL database. Covers authentication, agency/customer/region isolation, payload validation, linking, missing references, private notes, supplier-specific access, supplier-thread closure/reopening, status transitions, least-load/availability routing and idempotent escalation.
- Next.js optimized build and TypeScript checks passed; NestJS compilation passed.
- Staged frontend/backend ESLint checks passed via `npx lint-staged`; fixes were applied before publishing. The bundled Git shell lacked Bash for the Husky wrapper, so equivalent checks were run directly and the wrapper was skipped for the local commit only.
- `git diff --check` passed.
- `npm audit --omit=dev` reported 0 known production dependency vulnerabilities at validation time. Development-tool advisories remain; no force-upgrade across major tooling versions was applied.

## Historical browser checks

`npm run ops:test:browser` runs the booking-to-supplier-to-resolution flow across manager, regional agent, agency, customer and supplier browser sessions. Run it with the isolated demo preview active. Install Chromium with `npx playwright install chromium`, or set `OPSDESK_BROWSER_CHANNEL=msedge` to use a locally installed Microsoft Edge. The test deletes the temporary case it creates. The Linux CI job runs it in Chromium.

- Signed in through the HTTP-only-cookie proxy.
- Created a new refund case for BK-1042 using the browser form. Verified two related cases, automatic agent selection and saved booking context.
- Opened a separate supplier conversation from that case. Verified it changed the ticket to Waiting supplier and appeared as its own thread.
- Opened Insights and verified the new case was reflected in case totals, issue categories and supplier counts.
- Inspected desktop and 390px mobile layouts; charts and controls reflow and wide tables retain horizontal scrolling.
- Restarted the database/application from the final output folder; existing records were preserved rather than reseeded. The interactive browser example adds one case to the initial 60-case dataset.

## Workflow acceptance map

The workflow follow-up passed 7 unit tests and 52 HTTP checks on Windows with Node.js 22.23.4 and an isolated PostgreSQL 18 database. The new migration applied on a fresh database. NestJS compilation, the optimized Next.js build and the production dependency audit passed. The initial preview timed out waiting for PostgreSQL, so validation started the database separately.

The schedule and routing follow-up passed 9 unit tests, 63 HTTP checks and the five-role browser flow in Microsoft Edge on Windows. Prisma reported no schema drift, and the preview built and started both applications with existing data preserved.

The final local pass passed 9 unit tests, 70 HTTP checks and the five-role browser flow. The HTTP suite covers parallel supplier threads, unchanged reply deadlines on retries and deduplicated case and supplier alerts. The browser flow verifies that a draft remains private until staff edit and send a customer reply.

The policy and readiness follow-up passed 9 unit tests, 83 HTTP checks and the five-role browser flow. The API checks cover simultaneous intake with one capacity slot remaining, preservation of existing targets after a policy change, and health probes after a preview restart. The migration applied to the existing database and Prisma reported no schema drift.

The deadline candidate filter brought the HTTP suite to 85 checks. It still detects overdue response and supplier targets and skips future refund cases that have no supplier deadline due.

The reporting and inbox follow-up passed 9 unit tests, 99 HTTP checks and the five-role browser flow. The checks reconcile PostgreSQL reports against authorized case records and verify that pagination has no overlap, honors filters and cannot reveal cross-agency booking matches. The browser flow opens Insights and navigates between inbox pages.

| Workflow area | Scenario to verify | Remaining scope |
| --- | --- | --- |
| Connected history | Submit another complaint for BK-1042 and confirm earlier cases appear as separate records. Submit an unmatched reference and confirm the complaint and review event are saved without a booking link. | Live booking synchronization and fuzzy matching remain separate work. |
| Assignment | Configure agent specialties and capacity from Needs attention. Verify that matching specialists take precedence, general coverage remains available, and simultaneous intake cannot claim the same last slot. Check the inbox filters for status, owner and deadline. | Shifts and separate category teams remain pending. |
| Supplier conversations | Open an Aster thread, verify a Skyline account cannot reply, then reply as Aster and confirm the main ticket returns to support. Verify the customer cannot read the thread or private resolution reason. | The prototype uses in-app replies. |
| Travel deadlines | Set a departure and cancellation cutoff on a booking. Verify a cancellation uses the earlier cutoff, clearing it recalculates the active case deadline, and refunds retain their separate response target. | Live schedule synchronization and contract SLA calendars remain pending. |
| Escalation | Advance the demo clock, inspect the manager queue, and repeat the sweep to verify a single event per rule and deadline. | External alerts and a separately deployed worker are pending. |
| Insights | Reconcile server totals, medians, repeat contacts and breaches with authorized cases. Confirm managers and regional agents see only their respective totals and non-staff cannot access the report. | Incremental reports and performance targets are pending. |

## Boundaries

GitHub validation: the initial hosted Windows run could not start embedded PostgreSQL and did not reach application tests. CI now uses Linux with an isolated PostgreSQL 18 service and `--external-db`. Hosted Windows embedded-package compatibility remains unverified. Check the actual [implementation PR](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/1/checks) and [handoff PR](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/10/checks) results. Local Windows builds, lint, unit/API tests and production dependency audit passed separately.

This is a localhost prototype, not a production release. External LLM summaries, live email delivery, attachments and live supplier/booking-system integration were not exercised or presented as connected. All operational demo data is synthetic. The Bitext sample supplies complaint wording only.

The test script is for an isolated seeded demo. It creates and removes only its temporary cases, and restores the clock and agent availability used by the test scenario. It does not delete the interactive browser example.


## Historical ticket lock validation - 10 November 2026

Rebuilt from merged main `fcd75fa` (PR #16 is merged; there is no unmerged PR dependency). The handoff's uncommitted `codex/narrow-travel-locks` checkout was unavailable, so this implementation was reconstructed independently.

Messages and supplier operations acquire the parent ticket row with `FOR UPDATE` before reading mutable case/thread state. Case updates retain the capacity lock, then acquire the same ticket row. Booking schedule updates retain the capacity lock and acquire affected ticket rows in ascending ID order before changing the booking. Availability and specialty changes share the routing lock. Ticket-only paths never acquire the routing lock; this prevents reverse ordering. Automatic routing/capacity selection is unchanged. Manual assignment remains the existing authorized override, rather than being redefined as automatic routing.

Escalation selects keyset batches of at most 100 eligible IDs. Each candidate gets a separate transaction, row lock, fresh clock/status/booking/thread reads and an eligibility recheck. A concurrent close or supplier reply can invalidate a candidate without creating an obsolete alert. Persistent unique event keys remain authoritative across independent workers and reconnections. Each transaction releases its row lock before moving to the next ticket. Newly eligible IDs behind a batch cursor are handled on the next sweep; the sweep is not one globally atomic snapshot.

The new `node scripts/lock-concurrency.mjs` harness is included in `npm run ops:test`. It uses separate database pools/connections, a held capacity lock, a held ticket row, overlapping service instances, 104 overdue fixtures spanning a batch boundary, closure/reply races, reassignment/schedule/reply overlap, demo-clock/worker overlap, and a new Prisma/service instance after disconnect. The restart check establishes durable idempotency after reconnect, not OS kill/recovery or database crash recovery. Temporary fixtures are removed; use only an isolated seeded local demo.

A controlled 150ms blocker measured about 165ms for a shared-lock control query and 21ms for an unrelated message while the routing lock remained held. These are local synthetic observations, not production throughput or load targets. Broad skewed-load benchmarks, process-kill fault injection, starvation/backpressure, row-lock timeouts and production worker monitoring remain open. Schedule changes affecting many tickets still take the capacity lock and can block routing; high-volume booking changes need separate measurement. Profile/access membership administration must follow compatible locking if introduced later.

Validation completed on Node.js 22.23.0 / Windows / PostgreSQL 18.6: backend and optimized frontend builds passed; 9 unit tests, 400 HTTP checks (99 workflow + 124 pagination + 177 directory), 13 multi-connection concurrency checks and the five-role Chromium browser suite passed. Changed backend-file ESLint and whitespace checks passed. These results apply to the rebuilt branch, not the unavailable uncommitted work. Drain old-version workers before deploying the new protocol; mixed legacy global-lock workers and new row-lock workers were not validated. No issue is declared production-complete by these tests.

## Truncated archive recovery rehearsal

Started from main `0310cd5` after PR #57. On Windows with Node 22.23.4 and PostgreSQL 18.6 server and client tools, all five recovery connection-safety tests and all nine logical recovery checks passed. The rehearsal removed the final byte from a newly generated synthetic archive. PostgreSQL rejected the truncated stream after table creation began, and the target matched its original public catalog snapshot. Restoring the intact archive in the same database matched the source across 26 public tables, including 60 cases and 192 messages, plus indexes, constraints and type names. Unique and foreign-key rejection, worker termination rollback and exactly-once completion after restart passed.

A control run without single-transaction restore failed the rollback assertion because committed objects remained. After the control and the passing run, a separate check found zero rehearsal databases and zero temporary dump files. Syntax, formatting and whitespace checks passed. The application and browser suites were not rerun locally. The rehearsal uses local synthetic data and covers one truncation failure. Approved staging restore, backup storage and retention, recovery targets and operational ownership remain open. [Recovery procedure](OPSDESK_RECOVERY.md)

## Historical synthetic recovery rehearsal - 10 November 2026

Added `npm run ops:recovery` and five connection-safety tests. The rehearsal creates two disposable local databases, migrates/seeds the source, dumps/restores a custom archive, compares all public row data/indexes/constraints and tests restored integrity enforcement. See [runbook and limitations](OPSDESK_RECOVERY.md). Local safety tests passed on Node 22.23.0; full archive/restore validation runs in CI using PostgreSQL 18 client tools because this Windows machine has only the embedded server binaries. CI results must be checked before claiming recovery validation. This is partial progress on issue #3; operational backups, retention, staging restore and production recovery ownership remain open. The branch is based on merged main and has no dependency on unmerged PR #17.

## Historical production configuration follow-up - 10 November 2026

Added early production startup validation for disabled demo/local-counter modes, separate non-placeholder JWT secrets, exact HTTPS frontend origins, PostgreSQL/Redis URL schemes, and non-test Turnstile settings. Environment typos fail explicitly and configuration errors do not echo secret values. See [settings and limits](OPSDESK_PRODUCTION_CONFIG.md). Local validation includes 28 unit tests, changed-file lint, backend compilation and a real bootstrap rejection of the generated local-demo environment under NODE_ENV=production. These are sanity checks, not provider credential verification, automatic account cleanup or production deployment. This issue #3 follow-up is independent of unmerged PRs #17 and #18 and based on main fcd75fa.

## Historical dialog keyboard regression

On Node 22.23.0, the optimized frontend build and five-role Chromium smoke suite passed. The new-ticket flow locates the dialog by name, crosses both Tab boundaries, dismisses with Escape and the close button, and verifies focus returns to the launcher after each dismissal. The suite can target a second local frontend using OPSDESK_BROWSER_URL. Screen-reader announcements and non-Chromium keyboard behavior still need manual validation.

The same seeded five-role flow and keyboard regression passed locally in Firefox 153 on Windows with Node 22.23.0. CI installs both pinned Playwright engines and runs each suite against the same isolated preview, with a fresh case per run.

## Historical single-use session rotation

On Node 22.23.0 both builds, 9 backend unit tests, HTTP suites (102, 124 and 177 checks), and the five-role Chromium flow passed locally. Holding the session row until two API connections blocked reproduced two successful rotations before the fix. With the fix, six overlapping requests produced one 200 and five 401s. The successor accessed the workspace and a later replay failed. Browser coverage replays a stale cookie after rotation and verifies the rejection emits no Set-Cookie header.

## Historical worker process termination checkpoint

On Windows, a compiled worker completed the first ticket and blocked on the second ticket inside its PostgreSQL transaction. Terminating the worker rolled back that ticket. A fresh process completed the sweep with exactly one escalation event per ticket. CI runs the same check in the disposable restored database after snapshot comparisons. Database server crash recovery and multi-host failover remain separate operational tests.

The first post-merge main run restored the fixture successfully, then failed during forced database deletion while a pooled socket was closing. The checkpoint uses ordinary DROP DATABASE after ending the pools and writes the success report only after database and archive cleanup.
## Sustained synthetic load

Ran `npm run ops:load`'s script on Windows with Node.js 22.23.4 against the isolated preview on loopback. The backend and optimized frontend built successfully. Both scenarios started from 60 cases and 192 messages. The default finished 200 requests with eight workers in 3.624 seconds, including 40 verified writes. Its p50/p95/p99 were 112/348/440 ms.

The sustained scenario used 12 workers, 3,000 background cases and 1,200 existing messages in a shared thread. It loaded 3,072 total cases and 1,392 total messages before measurement. It verified queue page 150 and thread page 60, then completed 3,904 requests in 60.167 seconds at 64.9 requests per second. All 781 acknowledged notes were persisted exactly once on the intended case. Both runs removed their fixtures. An out-of-range duration was rejected before connecting.

| Operation | Requests | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| All | 3,904 | 120 | 625 | 913 | 1,542 |
| Booking directory | 781 | 86 | 136 | 165 | 206 |
| Internal note | 781 | 468 | 913 | 1,247 | 1,542 |
| Shared case history | 781 | 93 | 139 | 175 | 223 |
| Deep queue | 780 | 127 | 193 | 223 | 263 |
| Insights | 781 | 137 | 204 | 225 | 293 |

These figures come from a single local host, a synthetic manager session and duplicated case fixtures. The harness made initial queue and history reads before measurement. Cold-cache performance, representative booking and role distributions, sustained production traffic and owner-approved latency and throughput targets remain open. Reproduce the run with the [load rehearsal options](OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal).

## Blind review import test timing

PR #58's first hosted Chromium run read the last example's rationale immediately after uploading a draft. The browser was still processing the asynchronous file read. The assertion expected the first example's saved rationale and failed. Hosted Firefox was skipped. The test now waits for the imported completion count and for the canceled replacement dialog and input reset. The two focused tests passed locally in both Chromium and Firefox on Node 22.23.4. [Initial hosted run](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/43086250976)
