# Attachment increment validation

## Booking approval follow-up

On Node 22.23.0, both builds and changed-file lint passed. Two booking migrations applied to the isolated PostgreSQL 18 database (28 migrations total). The full `ops:test` suite passed, and all six standard Chromium flows passed sequentially, including the new manager booking-review flow. The final focused booking harness passed 31 checks, including request/review retries, three concurrent approvals, exactly one audit record, cross-agency rejection, changed-booking rejection, database decision constraints, cancelled directory state, and preservation of linked case status/deadlines with one cancellation event. Synthetic classifier checks passed at 27/30 development and 17/18 holdout examples; those are not independent evaluation. Exploratory mixed-load results and production limits are recorded in [booking approval guide](OPSDESK_BOOKING_APPROVALS.md). Hosted validation for this follow-up is pending.

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
