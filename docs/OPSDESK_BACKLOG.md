# OpsDesk — prioritized remaining work

These are open implementation tasks, not completed features. Review P0 items before using live data. No external API is required for the current demo.

## [P0] Confirm acceptance criteria and harden travel access boundaries

[GitHub issue #2](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/2)

The six demo scenarios are mapped in the [validation guide](OPSDESK_VALIDATION.md). Travel accounts are isolated from inherited ticket and AI routes, generic deletion/reset is guarded, and the demo suite checks agency, customer, regional agent and supplier access.

Acceptance:
- Obtain product owner sign-off on the demo scenarios and confirm production organization and agency boundaries.
- Design account provisioning, closure and retention so historical references are preserved or anonymized as required.
- Extend the authorization audit and negative-access tests as production routes and roles are added.

Start: backend/src/travel/travel.service.ts, travel.dto.ts, Prisma schema, scripts/smoke-test.mjs. Required before live data.

## [P0] Prepare production runtime, deployment and recovery

[GitHub issue #3](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/3)

The delivered launcher is a localhost synthetic demo. No production environment is configured.

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

All booking and supplier operational records are synthetic seed data.

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
- Define per-contract SLA/business-hour/holiday calendars and escalation ownership/acknowledgment.
- Add shifts and more detailed manual override policies.
- Add manager administration for agencies, suppliers, agents, customers and travel memberships.
- Specify reopen behavior and routing when coverage is unavailable.
- Version policy changes and retain an auditable reason for priority/assignment.
- Test boundary times, missing coverage and simultaneous assignments.

Start: backend/src/travel/travel.rules.ts, service locks, profiles and ticket-detail controls.

## [P1] Scale workspace queries, reporting and background work

[GitHub issue #7](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/7)

The inbox returns authorized case rows, and Insights, assignment load counts and deadline candidate filtering run in PostgreSQL. The case-read follow-up loads individual cases on demand and pages messages, activity, related cases and supplier threads. The browser uses compact workspace metadata instead of the complete case snapshot. Booking and people directories now use server-filtered 20-row pages with search and deterministic ID tie breakers; selectors and routing settings page independently. A global advisory lock still serializes routing and escalation.

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

Current category suggestions are keyword rules and briefs use saved records. OpsDesk has no connected external LLM.

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

The case-read follow-up passed 9 unit tests, the original 99 HTTP checks, 124 additional pagination/access HTTP checks, and the five-role Chromium browser flow. Load testing and a production security review remain open.

Acceptance:
- Extend the automated five-role booking-to-supplier-to-resolution flow to cover failure recovery and additional browsers.
- Audit keyboard navigation, focus, screen reader labels and contrast.
- Exercise clean-clone Windows setup and process shutdown, then supported alternate platforms.
- Review inherited app surfaces and remaining development-tool advisories without unvalidated force upgrades.
- Review source/data licenses and attribution before redistribution.
- Define release ownership, staging gates and an operational incident runbook.

Start: .github/workflows/opsdesk-ci.yml, docs/OPSDESK_VALIDATION.md and scripts/smoke-test.mjs.



## Ticket lock validation - 10 November 2026

Rebuilt from merged main `fcd75fa` (PR #16 is merged; there is no unmerged PR dependency). The handoff's uncommitted `codex/narrow-travel-locks` checkout was unavailable, so this implementation was reconstructed independently.

Messages and supplier operations acquire the parent ticket row with `FOR UPDATE` before reading mutable case/thread state. Case updates retain the capacity lock, then acquire the same ticket row. Booking schedule updates retain the capacity lock and acquire affected ticket rows in ascending ID order before changing the booking. Availability and specialty changes share the routing lock. Ticket-only paths never acquire the routing lock; this prevents reverse ordering. Automatic routing/capacity selection is unchanged. Manual assignment remains the existing authorized override, rather than being redefined as automatic routing.

Escalation selects keyset batches of at most 100 eligible IDs. Each candidate gets a separate transaction, row lock, fresh clock/status/booking/thread reads and an eligibility recheck. A concurrent close or supplier reply can invalidate a candidate without creating an obsolete alert. Persistent unique event keys remain authoritative across independent workers and reconnections. Each transaction releases its row lock before moving to the next ticket. Newly eligible IDs behind a batch cursor are handled on the next sweep; the sweep is not one globally atomic snapshot.

The new `node scripts/lock-concurrency.mjs` harness is included in `npm run ops:test`. It uses separate database pools/connections, a held capacity lock, a held ticket row, overlapping service instances, 104 overdue fixtures spanning a batch boundary, closure/reply races, reassignment/schedule/reply overlap, demo-clock/worker overlap, and a new Prisma/service instance after disconnect. The restart check establishes durable idempotency after reconnect, not OS kill/recovery or database crash recovery. Temporary fixtures are removed; use only an isolated seeded local demo.

A controlled 150ms blocker measured about 165ms for a shared-lock control query and 21ms for an unrelated message while the routing lock remained held. These are local synthetic observations, not production throughput or load targets. Broad skewed-load benchmarks, process-kill fault injection, starvation/backpressure, row-lock timeouts and production worker monitoring remain open. Schedule changes affecting many tickets still take the capacity lock and can block routing; high-volume booking changes need separate measurement. Profile/access membership administration must follow compatible locking if introduced later.
