# OpsDesk — prioritized remaining work

## Supplied load-target follow-up — 12 November 2026

Latest fetched main is `e699fd3` through merged PR #63; no PRs were open at the initial check. PRs #60–#62 and combined main CI were still queued, not passed. The user confirmed there are no agreed performance targets and requested configurable checks. The load harness now supports supplied aggregate/per-role latency and sample limits, aggregate duration/throughput checks, explicit `not-configured` status and nonzero failure after verified cleanup. [Procedure](OPSDESK_LOAD_TARGETS.md).

Next agree representative traffic, datasets and named approval of targets before any acceptance claim. Human classifier labelling/adjudication and spoken screen-reader output remain pending. Live booking/mail, scanner monitoring, retention and approved staging recovery remain open. Deployment remains paused. Earlier checkpoints below are historical.

## Supplier history startup rehearsal

The synthetic profiler covers page 12 of a populated supplier history and verifies that another supplier thread is denied. Representative traffic, controlled-cache runs, agreed thresholds, human classifier labels and spoken screen-reader evidence remain open. [Validation](OPSDESK_VALIDATION.md#supplier-message-history-startup)

## Supplier startup and reviewer acceptance

The populated supplier startup probe covers the first conversation page with a separate supplier fixture to verify scope. Supplier message-history performance, representative populations, controlled cache testing and agreed thresholds remain open. Human classifier labels and spoken screen-reader evidence are the next acceptance inputs. [Procedure](OPSDESK_STARTUP_PROFILE.md) · [Review guide](OPSDESK_ACCEPTANCE_REVIEW.md)

## API process-start continuation

PR #56 and its post-merge CI passed. Fresh-API process profiling is now reproducible with isolated synthetic database copies, per-role first/repeat timings and verified cleanup. [Run and interpret it](OPSDESK_STARTUP_PROFILE.md). True database/OS cold-cache procedures, populated/representative booking and identity workloads and owner-approved performance targets remain open; a process restart does not satisfy them. Human classifier labels and observable spoken-output review remain pending. Check this follow-up's hosted result; deployment stays paused. Earlier priorities below are historical where superseded.

## Blind review form continuation

PR #55 merged with passing PR validation. A local-only review form now makes the merged blind pack usable without editing JSON by hand; draft import/export, per-example reasoning and reviewed-schema validation are implemented and tested in Chromium/Firefox. [Run the reviewer form](OPSDESK_ACCEPTANCE_REVIEW.md#local-blind-review-form). Actual human labels/adjudication and independently reviewed evaluation remain open, as does observable spoken screen-reader acceptance. Check current PR and post-merge main CI before claiming their results. Representative/cold-cache performance, live integrations and operational acceptance remain open; deployment stays paused. Earlier priorities below are historical where superseded.

## Five-role load continuation

PR #54's pinned-browser workflow passed before merge. Its post-merge run failed before checkout due to PostgreSQL host port 55432 being occupied; this follow-up assigns the port dynamically. Check the new hosted run before reporting combined main validation.

Synthetic load now covers configurable read weights across all five roles with manager writes and per-role metrics. A local 60-second run completed 8,035 requests and verified 1,607 writes exactly once. [Evidence and limits](OPSDESK_VALIDATION.md#five-role-load-and-ci-port-isolation---11-november-2026). Representative booking distributions/concurrent identities, owner-approved role weights, cold-cache procedures and performance targets remain open. Human labels and spoken screen-reader acceptance remain next reviewer-dependent work; live integrations and operational acceptance are unchanged. Deployment remains paused. Older priorities below are historical where superseded.

## Validation continuation - 11 November 2026

1. Check the continuation PR's hosted CI. Base main `f29ce70` and the combined application run both ended cancelled during browser installation. Hosted Chromium/Firefox and the final audit were skipped; an Actions retry returned HTTP 403. [Exact evidence](OPSDESK_VALIDATION.md#validation-continuation---11-november-2026)
2. Obtain observable spoken screen-reader evidence across roles. Narrator launched here but exposed a Windows integrity restriction; no spoken acceptance was observed. Use the [review checklist](OPSDESK_ACCEPTANCE_REVIEW.md#observable-screen-reader-review).
3. Obtain independently assigned labels, freeze the dataset and run the new evaluator's `--dataset` mode. Input validation, provenance/hashes, per-category metrics and a blank synthetic review pack are implemented; independent evaluation remains open. [Procedure and limits](OPSDESK_ACCEPTANCE_REVIEW.md#reviewer-labelled-classifier-evaluation)
4. Keep representative/cold-cache load and targets, live booking/mail, scanner monitoring, retention approval and operational recovery pending. Deployment remains paused.

The earlier priorities below are historical where they conflict with this continuation.

## Priorities after the customer portal and load rehearsal

PRs #50 and #51 are merged. Customer portal implementation, its local Chromium and Firefox checks, and customer Chrome zoom at 200% and 400% are complete. The local load harness now covers sustained concurrent reads and writes, deep pages and a long shared thread. [Recorded evidence](OPSDESK_VALIDATION.md#merged-customer-portal-and-load-checkpoint)

1. Confirm combined main CI and obtain observable spoken screen-reader acceptance.
2. Run an independent classifier evaluation with independently labelled holdout examples.
3. Agree representative booking and role distributions, cold-cache procedures and performance targets.
4. Complete live booking and mail acceptance, production scanner monitoring, retention approval and operational recovery. No booking provider is selected. Deployment remains paused.

## Customer portal follow-up

The customer workspace now presents authenticated booking records as cards and provides direct access to case history and existing support actions. Obtain observable spoken screen-reader acceptance and broaden human workflow review. Use the [validation record](OPSDESK_VALIDATION.md) for exact browser zoom and automation results. Live booking and email acceptance, scanner monitoring, retention approval, independent AI evaluation, representative sustained load and operational recovery remain open.

## Case detail and Insights follow-up — 11 November 2026

PR #48 and post-merge CI passed. This branch adds a record-driven isometric case journey and issue-category Insights columns, plus light/dark accessibility checks for both screens. It retains actual case and report scopes. [Verification](OPSDESK_VALIDATION.md#case-detail-and-insights-reference-follow-up--11-november-2026).

Next implement the supplied customer portal visual language using current authenticated customer bookings/cases and existing actions, without importing the reference's fictional rebooking, voucher, compensation or provider guarantees. Then obtain observable browser zoom at 200%/400%, spoken screen-reader announcements and human workflow review. Local Firefox launch remains blocked; check hosted CI. The existing open items also remain: booking provider selection and live acceptance, credentialed email acceptance, production scanner monitoring, file/backup retention approval, independent AI evaluation, representative load and operational recovery. Deployment remains paused. The older checkpoints below are historical.

## Stitch UI continuation — 11 November 2026

After PR #47 merged, the supplied Stitch reference was adapted to the functional manager workspace with a cobalt/navy style, a decorative 3D route globe, a queue-first layout and a persistent light/dark switch. Cross-role keyboard and dark-theme axe checks were added. The reference's fabricated operational figures and unsupported controls were excluded. See the [current validation record](OPSDESK_VALIDATION.md#stitch-workspace-and-cross-role-accessibility-follow-up--11-november-2026).

Still open: observable 200%/400% browser zoom and spoken screen-reader announcements, broader human workflow review, production scanner monitoring and retention approval, live booking-provider selection/acceptance, live email acceptance, independent AI evaluation, representative sustained load and operational recovery. Deployment remains paused. The older checkpoints below are historical.

## Current checkpoint — 11 November 2026

PRs #45 (requester booking forms) and #46 (configured real ClamAV preview) are merged into main `84aa88e`; combined post-merge CI passed. The current accessibility increment fixes header/notification reflow, notification Escape/focus return and wrapped pagination. Keyboard checks and viewport regressions are recorded in [validation](OPSDESK_VALIDATION.md#manual-accessibility-follow-up--11-november-2026).

Next obtain actual screen-reader announcements and browser zoom acceptance, then broaden manual role/workflow acceptance. These checks remain unfinished; the user authorized proceeding with announcements unverified. Real ClamAV acceptance is recorded from PR #46, while production scanner monitoring and file/backup retention approval remain open. No booking provider is selected. Live booking and email acceptance, independent AI evaluation, representative sustained load and operational recovery remain open. Deployment is paused. The implementation checkpoints below are historical and do not reopen features already merged.

The requester forms follow-up adds agency and customer booking requests to the existing manager-reviewed synthetic workflow. Remaining booking work includes selecting a provider, live reconciliation, provider commands, fees and refunds.

The [synthetic mail outbox](OPSDESK_MAIL_OUTBOX.md) now queues staff replies transactionally and supports manager retry and cancellation. The disabled-by-default Resend pilot adds outbound sending and signed delivery receipts. Verified sender setup, credentialed acceptance, secure attachments remain open under #4. Opt-in customer and supplier replies use private per-job addresses and the existing scoped conversations.

**Current increment: escalation rotations and manual holds (issue #6).** Ordered regional/global UTC rotations, on-duty backups, explicit coverage gaps and coverage-only/timed overrides are implemented. Existing agency contracts are merged in PR #33 with passing hosted validation. See the [policy contract](OPSDESK_SLA_CALENDARS.md#escalation-rotations-and-manual-holds) and [exact validation](OPSDESK_VALIDATION.md). Deployment remains paused.

Next: transactional email outbox/retries, signed inbound webhooks and secure attachments; provider-neutral booking integration; independent AI evaluation, accessibility, realistic load and operational recovery acceptance.

The following older checkpoint notes are retained for context. Their multi-contract/supplier/workload remaining-work statements are superseded by the current handoff.

**Supplier calendar progress on issue #6.** Manager-managed supplier business hours and per-cycle deadline snapshots are implemented on top of merged workload-handoff PR #30. Multiple agency contracts are implemented in this follow-up; richer manager escalation rotations remain outstanding. The existing email and attachment, booking adapter, evaluation, accessibility and load milestones follow those policy features.

These are remaining implementation and acceptance tasks. **Deployment is paused: finish local features, verification and review first, as requested by the user.** P0 items remain gates before live data; no external API is required for the synthetic local demo. The free-demo deployment preparation is saved separately and is not part of this feature branch.

Immediate order: review the current rotation/override increment, then add email/attachments; add a provider-neutral booking adapter with an explicit owner policy for creation/cancellation. Independent evaluation, accessibility, load and recovery acceptance remain open. Detailed entry files and acceptance steps are in [handoff section 13](OPSDESK_HANDOFF.md#13-remaining-work-in-priority-order).

## Merged SLA and coverage features

PRs #29–#31 are merged. Agency and supplier calendars, response snapshots, pause/resume, duty coverage, audited escalation ownership and opt-in existing-workload handoff are delivered and verified. Review the current agency-contract increment, then continue with richer escalation rotations, email, attachments and provider adapters. See the current handoff for exact evidence and production acceptance work.

## [P0] Confirm acceptance criteria and harden travel access boundaries

[GitHub issue #2](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/2)

The six demo scenarios are mapped in the [validation guide](OPSDESK_VALIDATION.md). Travel accounts are isolated from inherited ticket and AI routes, generic deletion/reset is guarded, and the demo suite checks agency, customer, regional agent and supplier access.

Acceptance:
- Obtain product owner sign-off on the demo scenarios and confirm production organization and agency boundaries.
- Verify/review/merge invitation provisioning and reversible suspension on `codex/opsdesk-membership-admin`; define closure, retention and any future identity-scope change so historical references remain protected.
- Extend the authorization audit and negative-access tests as production routes and roles are added.

Start: backend/src/travel/travel.service.ts, travel.dto.ts, Prisma schema, scripts/smoke-test.mjs. Required before live data.

## [P0] Prepare production runtime, deployment and recovery

[GitHub issue #3](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/3)

The logical recovery rehearsal checks that a truncated synthetic archive leaves an empty target and that the intact archive restores successfully in the same database. Staging restore, managed backups, retention, recovery targets and on-call ownership remain open. [Recovery procedure](OPSDESK_RECOVERY.md)

The delivered launcher is a localhost synthetic demo. No production environment is configured. Deployment is explicitly paused while features are completed; the selected free-demo stack and its saved preparation are not an active deployment.

Acceptance:
- Configure managed PostgreSQL and Redis, secret manager, HTTPS, correct HOST/proxy/CORS/cookie settings and production captcha/auth.
- Remove demo accounts and disable demo clock; keep OPSDESK_LOCAL_COUNTERS disabled in production.
- Provision users/travel profiles through a reviewed operational path.
- Review migrations on a staging restore; prove backup/restore and define retention.
- Connect the readiness and worker probes to deployment monitoring and assign on-call ownership.
- Select deployment target; inherited infrastructure is reference material, not a ready OpsDesk deployment.

Start: scripts/local-setup.mjs, backend/src/main.ts, RedisService, infra/, docs/OPSDESK_HANDOFF.md.

## [P1] Connect real email and secure attachments

Local ClamAV acceptance covers clean upload, EICAR detection with official databases verified by FreshClam and fail-closed outages. Production scanner operation and retention remain open. [Attachment guide](OPSDESK_ATTACHMENTS.md)

[GitHub issue #4](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/4)

Supplier and customer messages currently persist inside OpsDesk only.

Acceptance:
- Select provider; verify inbound webhook signatures and authorize sender-to-agency/supplier mapping.
- Implement outbound delivery, provider message IDs, reply threading, outbox/retry and idempotent ingestion.
- Supplier messages must not contain staff notes or unrelated booking/customer data.
- Store attachments with access control, scanning, size/type limits, expiring downloads and retention.
- Test duplicate/out-of-order webhook events and delivery failures.

Provider credentials become necessary only when this integration is selected. Start with travel conversation/message methods and the BFF/API boundaries.

## [P1] Add booking and supplier system adapters

[GitHub issue #5](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/5)

All booking and supplier operational records are synthetic seed data. Merged PR #27 provides [booking export tooling](OPSDESK_BOOKING_EXPORT.md) that validates versioned batches, verifies local ownership and can apply approved updates to existing synthetic bookings. Creation and changes affecting active cases require review.

Acceptance:
- Add a provider interface and a read-only adapter for the chosen booking API or export.
- Map stable external agency/customer/supplier IDs without cross-agency reference collisions.
- Synchronize check-in/timezones and reconcile changed/cancelled bookings.
- Verify supplier identity before granting thread access.
- Keep unmatched references pending manual verification; never guess a costly ownership match.
- Cover provider failures, stale updates, duplicate IDs and timezone boundaries.

Start: TravelBooking, TravelProfile, ticket create/update logic and seed-travel.ts. Do not treat Bitext complaint text as booking data.

## [P1] Make SLA, assignment and membership policies configurable

[GitHub issue #6](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/6)

Managers can edit booking schedules, agent specialties and capacity, and elapsed-hour agency response targets. Automatic routing considers category, region, availability, capacity and workload. New and reopened cases record the response policy applied.

Acceptance:
- Review the current agency calendar/shift/ownership implementation and its tests. Multiple agency contracts and supplier business calendars are implemented; retain their authorization, snapshot and concurrency regressions. Managers can already acknowledge alerts.
- Automatic opt-in workload handoff is merged. Regional/global rotations and explicit coverage/timed manual holds are implemented in the current follow-up; retain their concurrency and access tests. Full policy revision archives, multi-level acknowledgment escalation and external paging remain future extensions.
- Preserve the merged manager membership panel and its regression coverage: 24-hour manual invitations, single-use activation, agency/supplier creation, reasoned suspension/reactivation, paged searchable directory and audit. Prove historical preservation, immutable scopes, session invalidation, five-role boundaries and self/last-manager protection. This membership work merged in PR #28; retain its regression checks.
- Leave role/agency/supplier/region reassignment and deletion outside this increment; define their historical-data policy before adding them.
- Specify reopen behavior and routing when coverage is unavailable.
- Version policy changes and retain an auditable reason for priority/assignment.
- Test boundary times, missing coverage and simultaneous assignments.

Start: backend/src/travel/travel.rules.ts, service locks, profiles and ticket-detail controls.

## [P1] Scale workspace queries, reporting and background work

[GitHub issue #7](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/7)

The inbox returns authorized case rows, and Insights, assignment load counts and deadline candidate filtering run in PostgreSQL. The case-read follow-up loads individual cases on demand and pages messages, activity, related cases and supplier threads. The browser uses compact workspace metadata instead of the complete case snapshot. Booking and people directories now use server-filtered 20-row pages with search and deterministic ID tie breakers; selectors and routing settings page independently. Automatic routing retains its capacity lock. Ticket-local operations and escalation use per-ticket row locks.

Acceptance:
- Retire the legacy full-workspace endpoint after migrating compatibility/test callers. Booking and people directory pagination is implemented; realistic-volume query plans and load measurements remain open.
- The query profile and covering message index are implemented. The synthetic HTTP rehearsal now covers sustained concurrent reads and writes, skew toward a shared case, deep pages and a long thread. Representative booking diversity, a cold-cache run and owner-approved performance targets remain open. See [query profile](OPSDESK_QUERY_PROFILE.md).
- Replace global contention with appropriately scoped locks and robust worker/outbox scheduling.
- Define reporting metrics/timezones and incremental data updates.
- Measure concurrent assignment, repeated escalation and worker-restart behavior.
- Establish latency/throughput targets and load-test evidence.

Keep privacy filtering server-side. Case and conversation pages are capped at 20 rows; composite indexes support booking and supplier history reads, but realistic-volume query-plan evidence is still needed.

### Message buffer experiment

The optional query profiler now compares targeted PostgreSQL shared-buffer eviction with immediate warm repeats for a deep synthetic message page. OS-cache control, representative traffic and owner-approved performance targets remain open. [Procedure](OPSDESK_QUERY_PROFILE.md#message-shared-buffer-experiment)

## [P2] Add grounded optional AI with a measured evaluation

[GitHub issue #8](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/8)

Current category suggestions are keyword rules and briefs use saved records. The [offline classifier baseline](OPSDESK_CLASSIFIER_EVALUATION.md) measures those rules against synthetic complaints. OpsDesk has no connected external LLM.

Acceptance:
- Choose an explicit task/provider (Claude, Gemini or another API) and a provider-neutral adapter.
- Ground outputs only in records the current user can access; require source references and structured output validation.
- Redact sensitive data, resist instructions inside customer/supplier content, add cost/time limits and deterministic fallback.
- Evaluate against held-out labeled travel cases with false-link/privacy criteria.
- Preserve deterministic authorization, matching verification, deadlines and escalation.
- Document dataset licensing; Bitext examples alone are not an operational history corpus.

API key needed only once this work begins. Do not claim model accuracy before measuring it.

## [P2] Expand browser, accessibility, security and release validation

[GitHub issue #9](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/9)

Historical case-read validation passed 9 unit tests, the original 99 HTTP checks, 124 additional pagination/access HTTP checks, and the five-role Chromium browser flow. Load testing and a production security review remain open.

Acceptance:
- Extend the automated five-role booking-to-supplier-to-resolution flow to cover failure recovery and additional browsers.
- Audit keyboard navigation, focus, screen reader labels and contrast.
- Exercise clean-clone Windows setup and process shutdown, then supported alternate platforms.
- Review inherited app surfaces and remaining development-tool advisories without unvalidated force upgrades.
- Review source/data licenses and attribution before redistribution.
- Define release ownership, staging gates and an operational incident runbook.

Start: .github/workflows/opsdesk-ci.yml, docs/OPSDESK_VALIDATION.md and scripts/smoke-test.mjs.



## Historical issue status after PR #28 integration

The merged application checkpoint is `6e97b6f`, including PRs #25-#28. [PR #28 CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42812617605). Membership administration merged in PR #28. Current local feature work is SLA calendars, duty coverage and escalation ownership, pending collaborator review. See [current branch evidence](OPSDESK_VALIDATION.md#current-membership-branch-validation-10-november-2026); passing historical/main checks do not establish this branch’s final result.

| Issue | Completed and verified | Remaining acceptance work |
| --- | --- | --- |
| #2 | Six demo scenarios mapped, server-side role/privacy checks, account deletion guard and single-use token rotation | Obtain owner acceptance, define account closure, retention and production tenant boundaries |
| #3 | Startup configuration checks, dependency and worker health probes, synthetic logical restore and integrity checks | Deployment paused; later configure approved hosting, secrets/managed services, incident ownership, staging restoration and operational retention |
| #4 | Supplier and customer conversations persist with scoped visibility | Live mail provider, signatures, delivery outbox, retries, threading and secure attachments |
| #5 | Seeded booking links and editable schedules. Merged [PR #27](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/27) adds export preflight, PostgreSQL ownership verification and transactional apply for approved changes to existing synthetic bookings. | Provider-specific adapter, approved booking creation and production case handling for cancellations and schedule changes |
| #6 | Agent specialties, capacities, versioned response targets and manager alert acknowledgment | Review current calendar/shift/ownership work; multi-contract calendars, escalation rotations and any future scope-change policy |
| #7 | Paged queries, query-plan measurements, per-ticket locking, multi-connection and process termination/restart checks | Skewed load benchmarks, service targets, reporting timezone and incremental updates, production worker monitoring |
| #8 | Deterministic record-based briefs and a reproducible synthetic classification baseline | Provider choice, redaction, structured grounded outputs and independent held-out evaluation |
| #9 | End-to-end five-role Chromium and Firefox flows, dialog keyboard checks and release/incident procedure | Screen readers, full contrast audit, platform setup/release qualification, inherited dependency review and named owners |

See the [handoff](OPSDESK_HANDOFF.md) for the developer transfer message and the [validation guide](OPSDESK_VALIDATION.md) for measurements and known limits.

Workload-handoff follow-up reconstructed from the missing-checkout handoff is in progress. Local builds, 62 unit tests, 548 existing HTTP checks, 19 existing concurrency checks, 33 workload checks, six browser flows, offline regressions and changed-file lint passed. Publication and hosted checks are tracked separately. Multi-contract and supplier calendars, rotations, live email, attachments and provider adapters remain open.

## Expanded load coverage

The synthetic load harness now supports multiple seeded accounts per role. Representative booking and account distributions, controlled-cache runs and performance targets remain open. Independent classifier evaluation and spoken screen-reader acceptance still require human input. [Evidence](OPSDESK_VALIDATION.md#expanded-load-identity-rehearsal)
