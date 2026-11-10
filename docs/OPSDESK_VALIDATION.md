# Prototype validation


## Query profiling follow-up - 10 November 2026

Initially reviewed open PR #15 and main `a5455a4`. PR #15 merged during validation; fetched/reviewed latest main `f865ea9` and rebased onto it. Its source tree matches the tested directory baseline. Validation used the pinned Node.js 22.23.0 runtime on Windows and a separate fresh PostgreSQL 18.6 database. Both production builds, Prisma generation and the new index migration passed. The 9 unit tests and all 400 HTTP checks passed, including extended directory fixtures for an unbooked case customer and a supplier-thread-only author. The five-role Chromium flow and directory page-selection browser checks passed. Changed-file ESLint and git whitespace checks passed. The known inherited full-backend lint errors remain outside this change.

`npm run ops:profile` calls compiled TravelService reads against disposable synthetic databases, captures actual query plans and timings, checks pre/post-index result equality, and probes global advisory lock waiting with two connections. It requires an explicit local maintenance URL and removes its randomly named database in finally. A run added 6,000 bookings, 18,000 cases and 54,000 messages on top of the demo seed. See [profile evidence and reproduction](OPSDESK_QUERY_PROFILE.md) for measured changes, warm-cache/vacuum caveats and remaining load work. Neither production throughput nor safe lock replacement is established by this evidence.

## Directory pagination follow-up - 10 November 2026

Reviewed merged PR #14 and latest main `a5455a4` before changes. Local validation used Windows, Node.js 24.21.0, npm 11.19.0 and a fresh embedded PostgreSQL 18 database. The repository still specifies Node.js 22.23.x; this run does not certify that pinned runtime.

- Next.js and NestJS production builds passed. Prisma generation and all existing migrations applied; no schema change is required.
- 9 unit tests, 99 core HTTP checks, 124 history-pagination HTTP checks and 177 directory HTTP checks passed (400 HTTP checks total).
- Directory fixtures create 45 bookings, 45 customers and 45 agents, then clean up. Checks cover all seven seeded account scopes, bounded/nonoverlapping pages, out-of-range clamping, invalid pages/kinds/search, unauthorized requests, filtered totals, manager-only specialties and empty compact directory arrays.
- The five-role Chromium flow passed, including intake, supplier replies, case resolution, message pagination and privacy. The browser selector test passed booking/owner search, page-two selection and selection retention across page navigation. Use `OPSDESK_DIRECTORY_BROWSER=1 node scripts/directory-smoke.mjs` with the preview running to repeat that test.
- Frontend lint and changed backend travel-file ESLint passed. Full backend lint reports existing unsafe-type errors in `src/ai/ai.service.ts` and `src/auth/guards/roles.guard.ts`; unrelated autoformat edits were discarded. Git whitespace check passed.

`GET /ops/bookings` and `GET /ops/people` accept validated `page` and bounded `search`; people also accepts `kind`. Counts and rows share server-side authorization predicates. Bookings order by reference/ID; people by first name/user ID. People visibility retains self, staff and participants/customers in authorized booking/case/thread context using parameterized database EXISTS queries, without materializing the whole directory. Only the current page's user names are fetched. Mutation endpoints continue to validate booking and assignment access independently.

Compact workspace metadata returns empty booking/people arrays; legacy full snapshots remain compatible for tests and older clients. Queue and detail responses supply bounded names/booking context. Agencies remain metadata lists. Counts are live rather than snapshot-isolated, so concurrent writes can shift offset pages. Search/count cost, deep offsets, realistic-volume EXPLAIN evidence, global lock contention, compatibility retirement and broader load/accessibility/security reviews remain open. Production deployment and live-data readiness are not claimed.


The prior merged implementation baseline is `13873d4`. [CI passed for the merged PR #12 head](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42668187410). The original Windows baseline below used Node.js 22.19.0, npm 10.9.3, PostgreSQL 18 (embedded), Next.js 16.4.5 and NestJS 11. Use Node.js 22.23.x for a fresh setup.

## Case-read pagination follow-up

Validated locally on Windows with Node.js 22.23.0 and a fresh embedded PostgreSQL database:

- Both production builds and all 9 unit tests passed.
- The original 99 HTTP workflow checks and 124 new pagination/access HTTP checks passed (`npm run ops:test`).
- `scripts/pagination-smoke.mjs` creates and removes isolated fixtures with 45 identical-timestamp records per collection. It checks page size, complete traversal without overlap, page clamping, invalid input, case and booking history, internal-note filtering, private status reasons, supplier ownership and regional/agency/customer access boundaries.
- The five-role Chromium browser flow passed, including older/newer message navigation. It asserts all browser workspace reads use `compact=1`, and checks separate case-message and supplier-message requests.
- The composite-index migration applied to a fresh database. Realistic-volume query-plan and load testing remain open.
- `npm audit --omit=dev` reported zero vulnerabilities.

The browser uses the compact metadata endpoint; the legacy full-workspace endpoint remains for compatibility with existing API workflow tests. Booking and people directories are still returned as authorized metadata lists.

## Original prototype checks

- Backend unit suite: 7 tests passed, including 6 travel policy tests.
- Real HTTP workflow suite: 47 checks passed against the actual NestJS API and PostgreSQL database. Covers authentication, agency/customer/region isolation, payload validation, linking, missing references, private notes, supplier-specific access, supplier-thread closure/reopening, status transitions, least-load/availability routing and idempotent escalation.
- Next.js optimized build and TypeScript checks passed; NestJS compilation passed.
- Staged frontend/backend ESLint checks passed via `npx lint-staged`; fixes were applied before publishing. The bundled Git shell lacked Bash for the Husky wrapper, so equivalent checks were run directly and the wrapper was skipped for the local commit only.
- `git diff --check` passed.
- `npm audit --omit=dev` reported 0 known production dependency vulnerabilities at validation time. Development-tool advisories remain; no force-upgrade across major tooling versions was applied.

## Browser checks

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


## Ticket lock validation - 10 November 2026

Rebuilt from merged main `fcd75fa` (PR #16 is merged; there is no unmerged PR dependency). The handoff's uncommitted `codex/narrow-travel-locks` checkout was unavailable, so this implementation was reconstructed independently.

Messages and supplier operations acquire the parent ticket row with `FOR UPDATE` before reading mutable case/thread state. Case updates retain the capacity lock, then acquire the same ticket row. Booking schedule updates retain the capacity lock and acquire affected ticket rows in ascending ID order before changing the booking. Availability and specialty changes share the routing lock. Ticket-only paths never acquire the routing lock; this prevents reverse ordering. Automatic routing/capacity selection is unchanged. Manual assignment remains the existing authorized override, rather than being redefined as automatic routing.

Escalation selects keyset batches of at most 100 eligible IDs. Each candidate gets a separate transaction, row lock, fresh clock/status/booking/thread reads and an eligibility recheck. A concurrent close or supplier reply can invalidate a candidate without creating an obsolete alert. Persistent unique event keys remain authoritative across independent workers and reconnections. Each transaction releases its row lock before moving to the next ticket. Newly eligible IDs behind a batch cursor are handled on the next sweep; the sweep is not one globally atomic snapshot.

The new `node scripts/lock-concurrency.mjs` harness is included in `npm run ops:test`. It uses separate database pools/connections, a held capacity lock, a held ticket row, overlapping service instances, 104 overdue fixtures spanning a batch boundary, closure/reply races, reassignment/schedule/reply overlap, demo-clock/worker overlap, and a new Prisma/service instance after disconnect. The restart check establishes durable idempotency after reconnect, not OS kill/recovery or database crash recovery. Temporary fixtures are removed; use only an isolated seeded local demo.

A controlled 150ms blocker measured about 165ms for a shared-lock control query and 21ms for an unrelated message while the routing lock remained held. These are local synthetic observations, not production throughput or load targets. Broad skewed-load benchmarks, process-kill fault injection, starvation/backpressure, row-lock timeouts and production worker monitoring remain open. Schedule changes affecting many tickets still take the capacity lock and can block routing; high-volume booking changes need separate measurement. Profile/access membership administration must follow compatible locking if introduced later.

Validation completed on Node.js 22.23.0 / Windows / PostgreSQL 18.6: backend and optimized frontend builds passed; 9 unit tests, 400 HTTP checks (99 workflow + 124 pagination + 177 directory), 13 multi-connection concurrency checks and the five-role Chromium browser suite passed. Changed backend-file ESLint and whitespace checks passed. These results apply to the rebuilt branch, not the unavailable uncommitted work. Drain old-version workers before deploying the new protocol; mixed legacy global-lock workers and new row-lock workers were not validated. No issue is declared production-complete by these tests.

## Synthetic recovery rehearsal - 10 November 2026

Added `npm run ops:recovery` and five connection-safety tests. The rehearsal creates two disposable local databases, migrates/seeds the source, dumps/restores a custom archive, compares all public row data/indexes/constraints and tests restored integrity enforcement. See [runbook and limitations](OPSDESK_RECOVERY.md). Local safety tests passed on Node 22.23.0; full archive/restore validation runs in CI using PostgreSQL 18 client tools because this Windows machine has only the embedded server binaries. CI results must be checked before claiming recovery validation. This is partial progress on issue #3; operational backups, retention, staging restore and production recovery ownership remain open. The branch is based on merged main and has no dependency on unmerged PR #17.

## Production configuration follow-up - 10 November 2026

Added early production startup validation for disabled demo/local-counter modes, separate non-placeholder JWT secrets, exact HTTPS frontend origins, PostgreSQL/Redis URL schemes, and non-test Turnstile settings. Environment typos fail explicitly and configuration errors do not echo secret values. See [settings and limits](OPSDESK_PRODUCTION_CONFIG.md). Local validation includes 28 unit tests, changed-file lint, backend compilation and a real bootstrap rejection of the generated local-demo environment under NODE_ENV=production. These are sanity checks, not provider credential verification, automatic account cleanup or production deployment. This issue #3 follow-up is independent of unmerged PRs #17 and #18 and based on main fcd75fa.

## Dialog keyboard regression

On Node 22.23.0, the optimized frontend build and five-role Chromium smoke suite passed. The new-ticket flow locates the dialog by name, crosses both Tab boundaries, dismisses with Escape and the close button, and verifies focus returns to the launcher after each dismissal. The suite can target a second local frontend using OPSDESK_BROWSER_URL. Screen-reader announcements and non-Chromium keyboard behavior still need manual validation.

The same seeded five-role flow and keyboard regression passed locally in Firefox 153 on Windows with Node 22.23.0. CI installs both pinned Playwright engines and runs each suite against the same isolated preview, with a fresh case per run.

## Single-use session rotation

On Node 22.23.0 both builds, 9 backend unit tests, HTTP suites (102, 124 and 177 checks), and the five-role Chromium flow passed locally. Holding the session row until two API connections blocked reproduced two successful rotations before the fix. With the fix, six overlapping requests produced one 200 and five 401s. The successor accessed the workspace and a later replay failed. Browser coverage replays a stale cookie after rotation and verifies the rejection emits no Set-Cookie header.

## Worker process termination checkpoint

On Windows, a compiled worker completed the first ticket and blocked on the second ticket inside its PostgreSQL transaction. Terminating the worker rolled back that ticket. A fresh process completed the sweep with exactly one escalation event per ticket. CI runs the same check in the disposable restored database after snapshot comparisons. Database server crash recovery and multi-host failover remain separate operational tests.

The first post-merge main run restored the fixture successfully, then failed during forced database deletion while a pooled socket was closing. The checkpoint uses ordinary DROP DATABASE after ending the pools and writes the success report only after database and archive cleanup.
