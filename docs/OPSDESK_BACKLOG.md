# OpsDesk — prioritized remaining work

These are remaining implementation and acceptance tasks. **Deployment is paused: finish local features, verification and review first, as requested by the user.** P0 items remain gates before live data; no external API is required for the synthetic local demo. The free-demo deployment preparation is saved separately and is not part of this feature branch.

Immediate order: review and verify the current SLA-calendar/coverage feature; complete remaining contract and shift-handoff policies; add email/attachments; add a provider-neutral booking adapter with an explicit owner policy for creation/cancellation. Independent evaluation, accessibility, load and recovery acceptance remain open. Detailed entry files and acceptance steps are in [handoff section 13](OPSDESK_HANDOFF.md#13-remaining-work-in-priority-order).

## Current local SLA/coverage increment

PR #28 is merged at `6e97b6f` and its hosted validation passed. This follow-up implements agency-level business calendars, local holidays/timezones, per-cycle snapshots, explicit remaining-budget pause/resume, profile shifts for new assignments and audited escalation ownership/handoff. See [scope and limits](OPSDESK_SLA_CALENDARS.md) and the validation report. Calendar/shift configuration is manager-only; paused cases retain real travel/supplier deadlines. Missing coverage leaves intake unassigned and escalations unowned.

Remaining feature acceptance: multiple independent contracts per agency, supplier business calendars, automatic existing-agent workload handoff and richer escalation rotations. Then continue live email/outbox/inbound signatures, secure attachments and provider-neutral booking integration. Independent evaluation, broad accessibility/concurrency/load checks and live-data access/retention/recovery decisions remain unfinished. Deployment is paused.

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
- Review the current agency calendar/shift/ownership implementation and its tests. Add multiple contracts within an agency and supplier business calendars; managers can already acknowledge alerts.
- Complete automatic handoff of existing agent workload at shift boundaries and richer escalation rotations/manual override policies.
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
- Initial 6,000-booking/18,000-case/54,000-message profiles and a covering message index are implemented; extend to representative skew, deep pages, long threads, cold caches and concurrent readers/writers. See [query profile](OPSDESK_QUERY_PROFILE.md).
- Replace global contention with appropriately scoped locks and robust worker/outbox scheduling.
- Define reporting metrics/timezones and incremental data updates.
- Measure concurrent assignment, repeated escalation and worker-restart behavior.
- Establish latency/throughput targets and load-test evidence.

Keep privacy filtering server-side. Case and conversation pages are capped at 20 rows; composite indexes support booking and supplier history reads, but realistic-volume query-plan evidence is still needed.

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



## Current issue status after integration

The merged application checkpoint is `6e97b6f`, including PRs #25-#28. [PR #28 CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42812617605). Membership administration merged in PR #28. Current local feature work is SLA calendars, duty coverage and escalation ownership, pending collaborator review. See [current branch evidence](OPSDESK_VALIDATION.md#current-membership-branch-validation-10-november-2026); passing historical/main checks do not establish this branch’s final result.

| Issue | Completed and verified | Remaining acceptance work |
| --- | --- | --- |
| #2 | Six demo scenarios mapped, server-side role/privacy checks, account deletion guard and single-use token rotation | Obtain owner acceptance, define account closure, retention and production tenant boundaries |
| #3 | Startup configuration checks, dependency and worker health probes, synthetic logical restore and integrity checks | Deployment paused; later configure approved hosting, secrets/managed services, incident ownership, staging restoration and operational retention |
| #4 | Supplier and customer conversations persist with scoped visibility | Live mail provider, signatures, delivery outbox, retries, threading and secure attachments |
| #5 | Seeded booking links and editable schedules. Merged [PR #27](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/27) adds export preflight, PostgreSQL ownership verification and transactional apply for approved changes to existing synthetic bookings. | Provider-specific adapter, approved booking creation and production case handling for cancellations and schedule changes |
| #6 | Agent specialties, capacities, versioned response targets and manager alert acknowledgment | Review current calendar/shift/ownership work; multi-contract calendars, automatic agent workload handoff and any future scope-change policy |
| #7 | Paged queries, query-plan measurements, per-ticket locking, multi-connection and process termination/restart checks | Skewed load benchmarks, service targets, reporting timezone and incremental updates, production worker monitoring |
| #8 | Deterministic record-based briefs and a reproducible synthetic classification baseline | Provider choice, redaction, structured grounded outputs and independent held-out evaluation |
| #9 | End-to-end five-role Chromium and Firefox flows, dialog keyboard checks and release/incident procedure | Screen readers, full contrast audit, platform setup/release qualification, inherited dependency review and named owners |

See the [handoff](OPSDESK_HANDOFF.md) for the developer transfer message and the [validation guide](OPSDESK_VALIDATION.md) for measurements and known limits.
