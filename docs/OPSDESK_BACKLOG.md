# OpsDesk — prioritized remaining work

These are open implementation tasks, not completed features. Review P0 items before using live data. No external API is required for the current demo.

## [P0] Confirm acceptance criteria and harden travel access boundaries

[GitHub issue #2](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/2)

The prototype implements the supplied project summary. The original six business-problem acceptance statements were not provided individually.

Acceptance:
- Map all six statements to working scenarios and explicit gaps.
- Define organization, agency, customer, regional agent and supplier access rules.
- Audit inherited generic ticket/admin/demo-reset/account deletion endpoints alongside travel profiles.
- Preserve historical references on user deletion; review string identity fields and tenant boundaries.
- Add negative-access regression tests for every new path; customer/supplier responses cannot reveal private notes or unrelated records.

Start: backend/src/travel/travel.service.ts, travel.dto.ts, Prisma schema, scripts/smoke-test.mjs. Required before live data.

## [P0] Prepare production runtime, deployment and recovery

[GitHub issue #3](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/3)

The delivered launcher is a localhost synthetic demo. No production environment is configured.

Acceptance:
- Configure managed PostgreSQL and Redis, secret manager, HTTPS, correct HOST/proxy/CORS/cookie settings and production captcha/auth.
- Remove demo accounts and disable demo clock; keep OPSDESK_LOCAL_COUNTERS disabled in production.
- Provision users/travel profiles through a reviewed operational path.
- Review migrations on a staging restore; prove backup/restore and define retention.
- Add health/worker monitoring, logging and ownership/on-call runbook.
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

The prototype uses code-defined deadlines and available-agent least-workload routing.

Acceptance:
- Define per-contract SLA/business-hour/holiday calendars and escalation ownership/acknowledgment.
- Add shifts, skills, capacities and controlled manual override policies.
- Add manager administration for agencies, suppliers, agents, customers and travel memberships.
- Specify reopen behavior and routing when coverage is unavailable.
- Version policy changes and retain an auditable reason for priority/assignment.
- Test boundary times, missing coverage and simultaneous assignments.

Start: backend/src/travel/travel.rules.ts, service locks, profiles and ticket-detail controls.

## [P1] Scale workspace queries, reporting and background work

[GitHub issue #7](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/7)

GET /ops/workspace loads the complete authorized dataset; the browser computes demo reports. A global advisory lock serializes routing/escalation.

Acceptance:
- Add paginated cases/messages/threads and server-side search/filter/report aggregates.
- Review indexes with query plans on realistic synthetic volume.
- Replace global contention with appropriately scoped locks and robust worker/outbox scheduling.
- Define reporting metrics/timezones and incremental data updates.
- Measure concurrent assignment, repeated escalation and worker-restart behavior.
- Establish latency/throughput targets and load-test evidence.

Keep privacy filtering server-side while splitting the current workspace response.

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

Local validation covers 7 unit tests, 47 real HTTP checks and manual desktop/mobile workflows. This does not establish complete browser, load or production-security coverage.

Acceptance:
- Add automated end-to-end tests for all travel roles and the main booking-to-supplier-to-resolution scenario.
- Audit keyboard navigation, focus, screen reader labels and contrast.
- Exercise clean-clone Windows setup and process shutdown, then supported alternate platforms.
- Review inherited app surfaces and remaining development-tool advisories without unvalidated force upgrades.
- Review source/data licenses and attribution before redistribution.
- Define release ownership, staging gates and an operational incident runbook.

Start: .github/workflows/opsdesk-ci.yml, docs/OPSDESK_VALIDATION.md and scripts/smoke-test.mjs.

