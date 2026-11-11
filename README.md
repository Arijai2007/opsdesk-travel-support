# OpsDesk - connected travel support

The load rehearsal can check supplied latency, throughput, duration and per-role sample targets using `OPSDESK_LOAD_TARGETS`. No targets are enabled or approved by default. [Configuration, failure behavior and acceptance limits](docs/OPSDESK_LOAD_TARGETS.md).

Use `npm run ops:startup-profile` for isolated fresh-API process experiments with first/repeat read timings, a populated supplier conversation list, a deep supplier-history probe and verified cleanup. [Setup, observations and cache limits](docs/OPSDESK_STARTUP_PROFILE.md). Database/OS cold-cache acceptance and performance targets remain open.

Use `npm run ops:review-classifier` to review the blind classifier pack in a local browser form, save drafts and export reviewer-labelled JSON. It runs without the application/database or model credentials and shows no classifier predictions. [Reviewer instructions](docs/OPSDESK_ACCEPTANCE_REVIEW.md#local-blind-review-form). Human acceptance remains pending.

The synthetic load rehearsal now supports five-role read weights, opt-in rotation across seeded identities, manager writes and per-role latency reports. [Run options and scope](docs/OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal) · [Expanded-load evidence](docs/OPSDESK_VALIDATION.md#expanded-load-identity-rehearsal). Representative traffic, cold-cache acceptance and agreed performance targets remain open.

The classifier evaluator now accepts a reviewer-labelled local dataset with provenance/hashes, per-category metrics and a confusion matrix. A blank synthetic review pack and spoken screen-reader checklist are in the [acceptance review guide](docs/OPSDESK_ACCEPTANCE_REVIEW.md). Independent evaluation and spoken-output acceptance remain open. An earlier main run was cancelled at browser installation; that historical run skipped hosted browsers and its final audit. [Current validation evidence](docs/OPSDESK_VALIDATION.md#validation-continuation---11-november-2026). Deployment remains paused.

Customers can view their case summary and browse their authenticated bookings as cards. Each card opens the existing scoped case history. New tickets and booking cancellation requests remain available through their existing controls. [Customer portal validation](docs/OPSDESK_VALIDATION.md)

Case detail now shows a four-step journey from saved case state; Insights shows isometric issue columns from authorized category counts. These extend the supplied reference design without importing its fictional flight, provider, voucher or financial data. The existing conversation, supplier, audit and report controls remain available. [Current validation and remaining accessibility acceptance](docs/OPSDESK_VALIDATION.md#case-detail-and-insights-reference-follow-up--11-november-2026). Deployment remains paused.

The workspace now adopts the supplied travel-operations design's cobalt palette and manager dashboard hierarchy. A decorative 3D route globe appears on the manager view, and the header offers a persistent Light/Dark switch. The design uses real role-scoped records; reference-screen figures and unsupported actions are not live features. Cross-role keyboard and dark-theme axe checks are documented in the [current validation record](docs/OPSDESK_VALIDATION.md#stitch-workspace-and-cross-role-accessibility-follow-up--11-november-2026). Actual Chrome zoom at 200% and 400% passed on the customer workspace. Spoken screen-reader acceptance remains open. Deployment remains paused.

The workspace header and Notifications panel now reflow on narrow screens, Notifications supports Escape with focus return, and paginated form controls wrap inside dialogs. [Accessibility checks and remaining manual acceptance](docs/OPSDESK_VALIDATION.md#manual-accessibility-follow-up--11-november-2026). Spoken screen-reader acceptance remains open. Deployment remains paused.

Agency users can open **Booking requests** to propose a booking or request a cancellation. Customers can request cancellation for their own bookings. Managers decide in **Booking reviews**. [Booking workflow](docs/OPSDESK_BOOKING_APPROVALS.md)

The [synthetic mail outbox](docs/OPSDESK_MAIL_OUTBOX.md) starts paused. Managers can inspect and manage queued staff replies. The optional synthetic worker sends no external mail.

Managers can configure ordered **Escalation rotations** for each region, with a Global fallback, UTC slot cadence and on-duty backup managers. Case controls support manual coverage holds and explicit timed expiry; coverage loss always ends a hold. Existing response policies and deadlines are preserved. [Rotation, fallback and override behavior](docs/OPSDESK_SLA_CALENDARS.md#escalation-rotations-and-manual-holds)

Managers can now create independent **Agency contracts** under **Needs attention > SLA calendars and duty coverage**. Each has versioned response hours and a calendar. Intake explicitly selects an active contract once an agency has contracts. Existing cases retain their references and saved deadlines; retiring a contract blocks new selection. [Contract authorization, reopen behavior and API](docs/OPSDESK_SLA_CALENDARS.md#multiple-agency-contracts)

Managers can configure supplier response hours, weekly schedules, local holidays and time zones in **Needs attention → SLA calendars and duty coverage → Supplier response calendars**. New supplier requests, staff follow-ups and reopened threads use the supplier policy in effect when that response cycle starts. The default target is four elapsed hours. [Supplier calendar behavior](docs/OPSDESK_SLA_CALENDARS.md#supplier-response-cycles)

A local travel-support prototype that connects complaints to agencies, customers, bookings, earlier cases and private supplier conversations. Built with Next.js, NestJS, Prisma and PostgreSQL on the [IT Helpdesk foundation](https://github.com/Molnar-Zoltan/it-helpdesk).

Start with the [next-teammate checkpoint](docs/OPSDESK_NEXT_TEAMMATE.md), [developer handoff](docs/OPSDESK_HANDOFF.md), [full setup and demo guide](OPSDESK_README.md), and [prioritized backlog](docs/OPSDESK_BACKLOG.md). Development and pull requests belong to [DhruvKhanna7777/opsdesk-travel-support](https://github.com/DhruvKhanna7777/opsdesk-travel-support).

## Screenshots

Real local screenshots using synthetic records. Select an image to open it at full size. Membership administration is merged in PR #28; SLA controls are the current feature follow-up.

| Shared inbox | Booking-linked case |
| :---: | :---: |
| [<img src="docs/assets/inbox-overview.png" width="400" alt="OpsDesk inbox with case filters, priorities and owners">](docs/assets/inbox-overview.png) | [<img src="docs/assets/connected-case.png" width="400" alt="A support case with booking context and connected history">](docs/assets/connected-case.png) |
| **Operational Insights** | **New membership administration** |
| [<img src="docs/assets/insights-overview.png" width="400" alt="Response metrics, issue categories and operational trends">](docs/assets/insights-overview.png) | [<img src="docs/assets/membership-overview.png" width="400" alt="Manager membership directory, invitations and access controls">](docs/assets/membership-overview.png) |

## Run locally

Use **Node.js 22.23.x** and npm. The local demo uses embedded PostgreSQL; Docker, an external database account and an AI API key are not required.

```sh
git clone https://github.com/DhruvKhanna7777/opsdesk-travel-support.git
cd opsdesk-travel-support
npm ci
npm run ops:preview
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). On Windows, `Start-OpsDesk.cmd` also starts the demo. Use `npm run ops:dev` for frontend live reload.

The launcher creates local configuration, starts PostgreSQL on `127.0.0.1:55432`, applies migrations, seeds an empty travel workspace, builds the apps and starts the API on port 3001 and web app on port 3000. Run one launcher at a time. Existing configuration and records are preserved; database files live in the ignored `.opsdesk/postgres` directory. Initial startup takes longer while dependencies and database binaries install.

For your own dedicated development PostgreSQL instance, run `npm run ops:setup`, set `DATABASE_URL` in `backend/.env`, then use `npm run ops:preview -- --external-db`. This still applies migrations and seeds an empty demo; use a separate development database.

## Demo accounts

All seeded accounts use **`OpsDeskDemo!2026`**. Every operational record is synthetic.

| Email | Access |
| --- | --- |
| `manager@opsdesk.demo` | Manager across travel teams and agencies |
| `asia@opsdesk.demo` | Asia support agent |
| `europe@opsdesk.demo` | Europe support agent |
| `americas@opsdesk.demo` | Americas support agent |
| `global@opsdesk.demo` | Agent with global coverage |
| `agency@opsdesk.demo` | Atlas Travel agency |
| `horizon@opsdesk.demo` | Horizon agency |
| `maya@opsdesk.demo` | Maya's own bookings and customer-visible cases |
| `supplier@opsdesk.demo` | Aster Hotels' shared supplier conversations |
| `skyline@opsdesk.demo` | Skyline's shared supplier conversations |

The initial seed includes 3 agencies, 20 travelers, 30 bookings, 60 cases, 4 agents, 1 manager and 5 suppliers. It does not reset an existing workspace.

## What works

- Booking-linked complaints and authorized connected history, with separate records for separate cases.
- Regional queues, availability, agent specialties and capacity, automatic routing and manager reassignment.
- Customer replies, internal notes and separate supplier threads with role and agency boundaries enforced by the API.
- Travel deadlines, agency response targets, repeat-safe escalation and a persistent manager-only demo clock.
- Server-side Insights, searchable inbox filters and current-page case CSV export.
- On-demand case details and 20-row pages for messages, activity, related cases, booking history, supplier threads, bookings and people. Booking and staff selectors support search and paging.
- Compact workspace metadata, plus a compatibility full-workspace endpoint for older callers and tests.
- Records-based case briefs and editable reply drafts. External AI and real email delivery are not configured.

The application opens at `/`; travel API routes use `/ops/*`. The browser reaches the API through Next.js server routes. The local demo uses PostgreSQL-backed rate-limit and session-revocation counters; production requires Redis and rejects that local counter mode.

## Try the workflow

1. Sign in as the manager and open case **OPS-1042**, linked to booking **BK-1042**.
2. Review the booking, earlier cases, customer messages and internal notes.
3. Contact the supplier in a separate thread; sign in as `supplier@opsdesk.demo` to reply.
4. Return as manager, review the reply and record the case outcome.
5. Inspect Insights, then sign in as Maya to check that internal notes and supplier threads stay private.

The [full demo guide](OPSDESK_README.md#show-the-main-scenario) also covers deadline escalation with the demo clock.

## Validation and query profiling

The optional PostgreSQL 18 query profiler compares targeted message-buffer eviction with warm repeats on a deep synthetic message page. [Procedure and limits](docs/OPSDESK_QUERY_PROFILE.md#message-shared-buffer-experiment)

Run the local sustained-load rehearsal with `npm run ops:load`. [Options and fixture scope](docs/OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal)

Run checks in a second terminal against the isolated seeded demo:

```sh
npm run ops:test
npx playwright install chromium
npm run ops:test:browser
```

The contract increment passed both builds, 62 unit tests, the full API/concurrency regression command (including 52 contract HTTP checks), and the existing browser suites in Chromium and Firefox. Current rotation evidence is recorded separately in the validation guide. Exact failures, fixes, interrupted history and not-run checks are recorded in the [validation report](docs/OPSDESK_VALIDATION.md). `ops:test` includes unit, existing API/membership/concurrency, and new SLA suites. `ops:test:browser` runs the original five-role, membership, SLA manager, agency-contract and escalation-rotation flows. `ops:test` also includes the agency-contract API/concurrency regression suite. Select Firefox with `OPSDESK_BROWSER_ENGINE=firefox` after installing the matching browser. The final local browser sequence before PR #28 publication was interrupted at the user's request; its historical result has not been relabeled as a pass or a failure. New feature checks are reported separately. Run only against the isolated synthetic demo, and stop the preview before standalone builds.

The query-scaling follow-up adds `npm run ops:profile`. It requires an explicit `OPSDESK_PROFILE_DATABASE_URL` pointing to a local PostgreSQL maintenance `/postgres` database and an account allowed to create databases. Generate Prisma and build the backend first. The harness creates a disposable database, captures actual query plans and compares results before/after the reporting index. See [profiling method, timings and limits](docs/OPSDESK_QUERY_PROFILE.md) for configuration and reproduction.

Historical query-scaling local validation used Windows, Node.js 22.23.0 and PostgreSQL 18.6. Both builds, the migration, unit/HTTP/browser checks and changed-file lint passed. Existing full-backend lint errors in inherited files remain documented in the [validation notes](docs/OPSDESK_VALIDATION.md). Query timings are local synthetic measurements, not production performance targets.

## Project status and next work

The [mail outbox guide](docs/OPSDESK_MAIL_OUTBOX.md) covers the synthetic demo and the disabled-by-default Resend pilot adapter.

**Deployment is paused at the user’s instruction: complete local features, verification and review first.** Saved free-demo deployment preparation is separate from this feature branch; no hosted service or live email is enabled.

The feature branch starts from latest main `31cd21f` with PRs through #32 merged. The [supplier checkpoint CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42840920345); current contract-increment results are recorded separately in the validation guide.

PR #28 merged manager invitations, public single-use activation, suspension/reactivation, session invalidation, agency/supplier creation and paged membership/audit controls. Invitation delivery remains manual; identity scopes are immutable and historical records are preserved.

Merged PR #29 added opt-in agency business-hour/holiday/timezone calendars, saved case policy snapshots, explicit response-clock pause/resume, on-duty assignment and audited manager escalation handoffs. Travel and supplier deadlines continue during a response pause; missing manager coverage is visibly unowned. See the [SLA policy contract](docs/OPSDESK_SLA_CALENDARS.md) for exact behavior, limits and tests. The SLA-calendar feature merged in PR #29; deployment remains paused.

Agency/supplier calendars and opt-in automatic workload handoff are merged through PR #32; this follow-up adds multiple agency contracts. The current follow-up adds escalation rotations and override policies. Next implement email outbox/inbound webhooks and secure attachments, and a provider-neutral booking adapter with owner-approved creation/cancellation policy. Independent evaluation, accessibility, realistic concurrent load, recovery ownership and P0 live-data acceptance remain open. The [handoff](docs/OPSDESK_HANDOFF.md#13-remaining-work-in-priority-order) identifies entry files and acceptance checks.

Before live data, confirm production access rules, choose staging, rehearse backup/restore and configure monitoring. Live email, secure attachments, booking/supplier integrations, external AI evaluation and broader accessibility/security reviews remain pending. This repository documents a localhost prototype; it does not provide a production deployment.

## Documentation and source

| Guide | Contents |
| --- | --- |
| [Setup and demo](OPSDESK_README.md) | Launcher, accounts, full scenario and environment boundaries |
| [Developer handoff](docs/OPSDESK_HANDOFF.md) | Architecture, completed work and transfer notes |
| [Backlog](docs/OPSDESK_BACKLOG.md) | Prioritized remaining work and acceptance criteria |
| [Validation](docs/OPSDESK_VALIDATION.md) | Checks, evidence and known limitations |
| [SLA calendars and coverage](docs/OPSDESK_SLA_CALENDARS.md) | Business calendars, pause/resume, shifts, ownership and limits |
| [Query profile](docs/OPSDESK_QUERY_PROFILE.md) | Synthetic-volume measurements and reproduction |
| [Sources](docs/OPSDESK_SOURCES.md) | Dataset attribution and reference material |
| [Upstream README](docs/IT_HELPDESK_README.md) | Historical IT Helpdesk documentation |

The original repository history and authorship are retained. The included Bitext Travel examples are complaint wording samples, not actual bookings or supplier policies; their attribution and terms are recorded in the sources guide.


Lock contention follow-up: ticket messages and supplier operations now serialize per ticket; routing retains its capacity lock. Escalation uses fresh-state transactions in batches of 100 candidates. `npm run ops:test` includes the multi-connection lock regression harness. See [lock protocol and limitations](docs/OPSDESK_VALIDATION.md).

## Historical synthetic recovery rehearsal - 10 November 2026

The current rehearsal rejects a truncated synthetic archive, verifies rollback, and restores the intact archive in the same disposable database. [Run the recovery rehearsal](docs/OPSDESK_RECOVERY.md)

Added `npm run ops:recovery` and five connection-safety tests. The rehearsal creates two disposable local databases, migrates/seeds the source, dumps/restores a custom archive, compares all public row data/indexes/constraints and tests restored integrity enforcement. See [runbook and limitations](docs/OPSDESK_RECOVERY.md). Local safety tests passed on Node 22.23.0; full archive/restore validation runs in CI using PostgreSQL 18 client tools because this Windows machine has only the embedded server binaries. CI results must be checked before claiming recovery validation. This is partial progress on issue #3; operational backups, retention, staging restore and production recovery ownership remain open. The branch is based on merged main and has no dependency on unmerged PR #17.

## Historical production configuration follow-up - 10 November 2026

Added early production startup validation for disabled demo/local-counter modes, separate non-placeholder JWT secrets, exact HTTPS frontend origins, PostgreSQL/Redis URL schemes, and non-test Turnstile settings. Environment typos fail explicitly and configuration errors do not echo secret values. See [settings and limits](docs/OPSDESK_PRODUCTION_CONFIG.md). Local validation includes 28 unit tests, changed-file lint, backend compilation and a real bootstrap rejection of the generated local-demo environment under NODE_ENV=production. These are sanity checks, not provider credential verification, automatic account cleanup or production deployment. This issue #3 follow-up is independent of unmerged PRs #17 and #18 and based on main fcd75fa.

Workspace dialogs support keyboard navigation with Tab, Shift+Tab and Escape. Closing a dialog returns focus to its launcher when it is still on the page.

For Firefox coverage, install the matching browser with `npx playwright install firefox`, set `OPSDESK_BROWSER_ENGINE=firefox` in your shell and run `npm run ops:test:browser`. Chromium is the default.

Session refresh tokens are single-use. The HTTP smoke suite forces overlapping requests for the same token, and the browser suite checks that a stale response preserves the replacement cookies.

## Reconstructed automatic workload handoff

PR #29 is merged into main 12114c6. The uncommitted Arihant checkout referenced by the transfer message was unavailable on this ASUS machine. This follow-up was reconstructed from that message in a separate worktree; its validation results apply only to this implementation. Deployment remains paused.

Managers may opt an active case into automatic handoff with a recorded reason. New and existing cases default to disabled. The sweep preserves an eligible current owner, regardless of their existing capacity load. When coverage ends through shift, availability, membership or eligibility changes, the sweep selects an on-duty replacement using the existing regional/category and capacity policy. With no capacity, it clears the owner and retries on later sweeps. Repeated unchanged decisions add no audit event. Waiting and SLA-paused cases participate, while closed/resolved cases are excluded. Manual assignment disables automation, including a manager reaffirming the same owner. Paused budgets, travel deadlines and supplier threads keep their existing state.

Each candidate runs under the shared capacity lock followed by the parent ticket lock and fresh reads. Workers page opted-in active case IDs in batches of 100. The pass still visits all opted-in active cases each sweep, so large-volume scheduling needs further measurement. Existing assignment and membership writers use the same capacity protocol. No external provider is required.
