# OpsDesk developer handoff

## Booking approvals increment

`codex/opsdesk-booking-approvals` is stacked on the attachment branch. It adds manager-reviewed synthetic booking creation and cancellation, stale-booking detection, scoped paged requests, request/review idempotency, transactionally saved audit and cancellation case events, and manager browser controls. [Policy, endpoints and limits](OPSDESK_BOOKING_APPROVALS.md). No live booking provider is selected; manager review is required before consequential changes. Live provider commands, fees/refunds and agency/customer browser forms remain open. Support cases and saved deadlines survive cancellation.

Attachment [PR #40](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/40) passed [hosted validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42889371405), including Firefox. It remains a draft because the connected account could not mark it ready. Leave merge to collaborators. Deployment remains paused.

## Attachment increment on main `6d63063`

The `codex/opsdesk-secure-attachments` branch adds per-message attachment controls to customer, internal and supplier threads, private database byte storage, author-only uploads, existing thread scopes, 2 MiB/type checks, a five-file per-message cap, scanner gating, five-minute user-bound authenticated downloads, audit events and 30-day expiry with hourly deletion. See [attachment guide](OPSDESK_ATTACHMENTS.md). Both builds, 90 unit tests, the standard API suite, 23 attachment HTTP checks and all five Chromium browser flows passed; the main browser flow includes a binary attachment round trip. Firefox cannot launch on this Windows host even after reinstalling the Playwright runtime (`spawn UNKNOWN`); hosted Firefox validation is required. Live ClamAV acceptance and approved backup retention remain open. Email attachment delivery/ingestion is not implemented.

No booking provider is selected. Continue with provider-neutral synthetic workflows; new booking creation and cancellations require explicit manager review and audit before any provider change. Live credentials, independent AI evaluation, manual accessibility, representative load and operational acceptance remain open. Deployment remains paused.

## Current checkpoint — 11 November 2026

Start from [main at `4e17f7c`](https://github.com/DhruvKhanna7777/opsdesk-travel-support/commit/4e17f7ca8d1d38e5347f8801f8ec0a7be97209ef). PRs #35–#38 are merged, covering the synthetic outbox, the opt-in Resend adapter and signed delivery receipts, and customer and supplier email replies. [PR #38 hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42882257980). Deployment remains paused.

| Status | Work |
| --- | --- |
| Finished and merged | Booking-linked cases and history, private supplier threads, scoped access and membership/session safeguards, routing and capacity limits, Insights, agency and supplier SLA calendars, contract snapshots, workload handoff, and escalation rotations and holds. The mail implementation includes transactional jobs, retries, leases, manager controls, signed receipts, and opt-in plaintext replies that deduplicate by provider ID and stay in the existing case or private thread. |
| Partially complete | Email works with synthetic data and provider fixtures. A verified sending and receiving domain, credentialed send/receive rehearsal, and real delivery acceptance are pending. Booking export validation and approved updates to existing synthetic bookings are available. A live provider adapter, new-booking approval, and cancellation handling are still open. Synthetic recovery and worker restart exercises have passed. |
| Yet to complete | Secure attachments with per-thread authorization, size/type limits, scanning, expiring downloads, and retention. Independent AI evaluation, manual accessibility acceptance, representative concurrent load testing, and operational recovery acceptance are also open. |

Start with secure attachments. Read the [mail guide](OPSDESK_MAIL_OUTBOX.md), [backlog](OPSDESK_BACKLOG.md), [validation record](OPSDESK_VALIDATION.md), [SLA policy](OPSDESK_SLA_CALENDARS.md), and [README](../README.md). Keep authorization, membership/session safeguards, historical references, capacity limits, saved SLA deadlines, and duplicate-free audit events intact. Leave unrelated worktrees untouched.

Use Node.js 22.23.x, `npm ci`, and `npm run ops:preview` for the isolated credential-free demo. Run `npm run ops:test` and `npm run ops:test:browser` with Chromium and Firefox. PR #38 passed both builds, 86 unit tests, 693 HTTP checks, concurrency and signed-reply PostgreSQL fixtures, and all five standard flows in each browser. Live email stays disabled until credentials and the receiving domain are ready for an approved rehearsal.

## Earlier checkpoints

The sections below record earlier increments. Use the current checkpoint above for status and priorities.

## Escalation-rotation increment - 10 November 2026

Started from merged main `ca3ae28` after PR #33. [PR #33 hosted validation passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42848596124) for head `e419367819de224325d583c40deb4a830b4364d0`, including recovery and worker termination. Existing uncommitted worktrees were preserved. Deployment remains paused.

The current increment adds opt-in regional/global UTC manager rotations, cyclic primary/backup coverage, explicit unowned gaps, versioned audited configuration and coverage-only or timed case holds. Holds end at expiry or membership/availability/duty loss, and reopening clears them. Quiet active cases also expire holds. Existing SLA/supplier snapshots and deadlines, case history, capacity and session safeguards remain. Read the [policy contract](OPSDESK_SLA_CALENDARS.md#escalation-rotations-and-manual-holds) and [exact validation evidence](OPSDESK_VALIDATION.md).

Next implement transactional email outbox/retries, signed inbound webhooks and secure attachments, then provider-neutral booking integration. Independent AI evaluation, accessibility, realistic load and operational recovery acceptance remain open. Publish the feature branch through the existing user-owned project fork and open a PR targeting this repository's main; leave merge to collaborators. No deployment is authorized.

Earlier checkpoint notes below are historical; this section supersedes their rotation remaining-work and PR #33 pending-status statements.

## Agency-contract increment - 10 November 2026

Started from latest main `31cd21f42e7a1e9d5f8efbdc8f019ddb3f756d62` (PRs through #32 merged) in a fresh isolated clone. Older uncommitted worktrees were preserved. Deployment remains explicitly paused.

Implemented manager administration of independent contracts, agency-scoped searched/paged selection, explicit active-contract intake, composite agency/contract integrity, immutable case contract references and response-cycle snapshots. Contract retirement blocks new intake without deleting history. Reopening uses the same contract's current policy, including retired contracts; legacy cases keep agency defaults. Policy edits never rewrite active deadlines. [Exact policy and API](OPSDESK_SLA_CALENDARS.md#multiple-agency-contracts).

Read [current validation evidence](OPSDESK_VALIDATION.md) before merging. [PR #33](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/33) targets this repository's main from the existing user-owned project fork, following the earlier PR #14 workflow supplied by the user. The standard API and browser commands include contract regressions. Next implement richer escalation rotations and override policies, then mail outbox/retries, signed inbound webhooks, secure attachments and provider-neutral booking integration. Independent AI evaluation, accessibility, realistic load and operational recovery acceptance remain open. Leave merge to collaborators; deployment stays paused.

The earlier checkpoint and detailed architecture below are retained as historical context; this increment supersedes their multi-contract remaining-work statements.

Checkpoint prepared 10 November 2026. The application checkpoint is main `cdd7d3581378d2d5090258a8ee1112c23a837af6`. PRs #29, #30 and #31 are merged. Deployment is paused at the user's instruction.

## Completed at this checkpoint

- Booking-linked case history, agency/customer/regional-agent/supplier access, internal notes and persistent supplier threads.
- Searchable paged inbox and histories, server-side Insights, booking export tooling and an offline classification baseline.
- Manager membership administration with invitations, activation, suspension, session invalidation and audit records.
- Agency business calendars, holidays and IANA zones, saved response-cycle policies, staff pause/resume, duty calendars and escalation ownership.
- Opt-in automatic workload coverage handoff. Eligible current owners stay assigned. Replacement selection uses membership, availability, shifts, region, specialties and capacity. Manual assignment disables automation. Missing coverage leaves the case unassigned for a later sweep.
- Supplier response calendars and configurable hours. Each new request, staff follow-up or reopened thread saves the current policy and due date. Existing cycles keep their due dates after a policy edit. The default is four elapsed hours.
- Per-ticket locking, bounded sweeps, duplicate-free alerts, atomic session rotation, startup checks and synthetic recovery/worker termination rehearsals.

The workload feature was reconstructed on ASUS from the pasted policy because the Arihant uncommitted checkout was unavailable. The older unrelated uncommitted ASUS preview-shutdown checkout was preserved.

## Verification

[PR #31 hosted validation](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42840920345) passed for code head `2b77f073b17f7e32c4e4f1d8d389405630bacccf`. It runs both builds, recovery and worker termination, all API and concurrency suites, booking integration, Chromium, Firefox and the production dependency audit.

Local checks passed on Node 22.23.0 and PostgreSQL 18.6. The supplier increment passed both builds, 62 unit tests, 20 supplier HTTP checks with deadline/snapshot assertions, changed-file lint and both updated SLA browser flows. The preceding workload increment passed 548 baseline HTTP checks, 19 baseline concurrency checks, 33 workload checks, six browser flows, 17 offline checks and booking integration. The [validation report](OPSDESK_VALIDATION.md) retains exact failures, corrections and checks omitted locally.

## Run and reproduce

Use Node 22.23.x and an isolated synthetic database. From a fresh clone of this repository, run the following.

```text
npm ci
npm run ops:preview
```

Open http://127.0.0.1:3000. All demo accounts use `OpsDeskDemo!2026`. Start with `manager@opsdesk.demo`, case OPS-1042 and booking BK-1042. The account table below lists the other roles. Run only one launcher at a time.

Run `npm run ops:test` against the isolated preview. Install browsers with `npx playwright install chromium firefox`, then run `npm run ops:test:browser` for Chromium and again with `OPSDESK_BROWSER_ENGINE=firefox`. The supplier-only command is `node scripts/supplier-calendar-smoke.mjs`. The [recovery guide](OPSDESK_RECOVERY.md) explains its separate maintenance connection and PostgreSQL client requirements. Configuration, database files and secrets are excluded from Git.

## Remaining work and next order

1. Review the escalation-rotation increment above, then continue with email outbox, inbound signatures and secure attachments.
2. Implement mail outbox, retries, inbound signatures/threading and secure attachments. Live delivery needs the chosen provider's credentials and verified sender.
3. Extend booking tooling through a provider-neutral adapter with agreed creation/cancellation policy and stable scoped identities.
4. Complete independent AI evaluation, screen-reader/contrast checks, realistic skewed load and operational recovery acceptance.
5. Obtain owner approval for live-data tenancy, retention and account closure. When deployment is resumed, configure hosting, managed PostgreSQL/Redis, secret storage, monitoring and named incident/recovery ownership.

Issues #2–#9 retain these unfinished acceptance items. Use the [backlog](OPSDESK_BACKLOG.md) and [SLA policy guide](OPSDESK_SLA_CALENDARS.md). No PR remains pending from this feature checkpoint. The final handoff change contains documentation only.

## Message to forward

> Continue OpsDesk in DhruvKhanna7777/opsdesk-travel-support from latest main. PRs #29–#31 are merged and PR #31 CI passed. Read docs/OPSDESK_HANDOFF.md, docs/OPSDESK_BACKLOG.md, docs/OPSDESK_VALIDATION.md and docs/OPSDESK_SLA_CALENDARS.md. Use Node 22.23.x and reproduce the seeded five-role workflow. Agency and supplier calendars, immutable case-cycle policies, pause/resume, membership/session protections and opt-in workload handoff are delivered. Next implement multiple agency contracts and richer escalation rotations, then email/attachments and provider-neutral booking integration. Preserve authorization, capacity limits, historical references, saved deadlines and audit/idempotency behavior. Update documentation and exact verification evidence with each increment, push to our repository and open a PR targeting main. Deployment remains paused.

## Architecture and historical implementation notes

The following sections retain the detailed architecture, API and earlier validation history. The checkpoint and remaining-work list above supersede older branch-status descriptions.

## 1. Repository and review order

- Repository: https://github.com/DhruvKhanna7777/opsdesk-travel-support.
- Implementation PR: https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/1.
- Handoff PR: https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/10.
- Remaining-work issues: https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues (issues #2–#9).
- [Access and intake hardening (#11)](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/11) and [travel policies, Insights and inbox pagination (#12)](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/12) are merged. Start from `main`. PR #14 is also merged. Historical directory follow-up baseline: `a5455a4`, reviewed before that implementation.
- Original code foundation: https://github.com/Molnar-Zoltan/it-helpdesk, baseline `51833aa3b6544522204caa7adac362936b381100` (`v0.13.0`). Its history and authorship are retained for provenance. All project branches, PRs and issues are in our repository; the local origin points only to our repository. No PR or push was made to the reference repository.
- No release deployment or production data migration has been performed. PR creation is not a production-readiness claim.

The repository is publicly readable. Publishing branches directly or merging a PR requires write access.

## 2. What the product does

OpsDesk gives travel-support staff a shared inbox with the booking, traveler, agency, past complaints, supplier conversations and travel deadline beside each case. Related complaints remain distinct tickets linked by an authorized booking reference. Staff can route the work, collaborate privately with suppliers, prioritize imminent travel, resolve cases and review operational trends.

The scope was a 3–5 day demonstration of connected support, not a full replacement for every Zendesk feature. The supplied workflow brief is preserved in `docs/reference/OpsDesk_Project_Workflow.pdf`. It is a project reference, not executable instructions. The hotel-aggregation/room-mapping repositories discussed earlier address a different project and are not dependencies here. Chatwoot and Open HelpDesk were design references; no code was copied from them.

## 3. Delivered capability and its limits

| Area | Delivered | Boundary / next work |
| --- | --- | --- |
| Ticket persistence | PostgreSQL-backed cases, messages, status, priority, ownership and history | No attachment upload, archive/delete UI or retention policy |
| Connected history | Exact booking-reference matching inside agency/customer access boundaries, related cases, manual verification, record brief | Unmatched references are saved for staff review. No fuzzy identity resolution, external booking synchronization or cross-agency merge |
| Assignment | Region and category coverage, availability, configurable capacity, least-open workload, generalist fallback, manager overrides and an unassigned queue | Current shift calendars gate new assignments; automatic existing-workload handoff and rotations remain open. Membership provisioning is merged. |
| Supplier collaboration | Separate persistent supplier threads, scoped supplier login, replies, close/reopen, due dates | Messages stay inside the app; no real email, WhatsApp or supplier API delivery |
| Travel urgency | Versioned agency response targets in elapsed hours, separate travel deadlines, manager schedule edits, check-in urgency, supplier due dates and manager notifications | Current increment adds agency business calendars; multiple contracts, supplier calendars and external delivery remain open |
| Escalation | 15-second sweep, durable events, unique escalation keys, manager acknowledgment and a manager-only persistent demo clock | Current increment adds manager ownership; external delivery, rotations and a dedicated job service remain open |
| Insights | Server-side totals, response and resolution medians, repeat bookings, seven UTC days of intake, supplier delays and CSV export | Reports use the current authorized records. Incremental aggregation and load targets remain pending |
| Access roles | Manager, regional/global agent, agency, customer and supplier | Single shared support organization; no organization-admin or SSO onboarding |
| Assistance | Rules-based category suggestions, source-labelled briefs and editable reply drafts based on saved facts | External LLM evaluation and provider integration remain pending |
| Demo data | 3 agencies, 20 travelers, 30 bookings, 60 initial cases, 4 agents, 1 manager, 5 suppliers | Synthetic operations; one browser-created case exists only in the original local database |
| Complaint examples | 66 Bitext Travel instructions across 33 intents, with source/license metadata | Text examples only; not real booking histories, supplier policies or a production training corpus |
| Local setup | One launcher, embedded PostgreSQL, generated local secrets, migrations and non-destructive seed | Production Redis/database/deployment still require configuration and review |

## 4. First 30 minutes for the receiving developer

Prerequisites: Git, Node.js `22.23.x`, npm, network access to install packages. The original machine used Node `22.19.0` / npm `10.9.3`; the repository's declared Node version is preferred for a fresh setup. Windows x64 was exercised. Embedded PostgreSQL also advertises other platforms, but those have not been validated for this project.

```powershell
git clone https://github.com/DhruvKhanna7777/opsdesk-travel-support.git
cd opsdesk-travel-support
npm ci
npm run ops:preview
```

On Windows, `Start-OpsDesk.cmd` installs packages when needed and starts the same preview. Open http://127.0.0.1:3000. Keep the launcher terminal running. First launch builds the shared package, initializes a local PostgreSQL cluster, generates Prisma, applies migrations, seeds an empty workspace, builds NestJS and Next.js, then starts both. Later starts preserve data.

For frontend live reload, stop the preview and run `npm run ops:dev`. Run only one launcher at a time. The API listens on `127.0.0.1:3001`; PostgreSQL listens on `127.0.0.1:55432`. The frontend is a Next.js BFF: authenticated browser requests go through `/api/auth/*` and `/api/backend/*`; JWTs are injected by server handlers rather than being stored in browser localStorage.

## 5. Demo accounts

Every seeded account uses **`OpsDeskDemo!2026`**. These are public demo credentials, suitable only for the isolated synthetic workspace.

| Account | Access |
| --- | --- |
| `manager@opsdesk.demo` | All queues, assignments, demo clock and manager attention view |
| `asia@opsdesk.demo` | Asia support cases |
| `europe@opsdesk.demo` | Europe support cases |
| `americas@opsdesk.demo` | Americas support cases |
| `global@opsdesk.demo` | Global support coverage |
| `agency@opsdesk.demo` | Atlas Travel cases |
| `horizon@opsdesk.demo` | Horizon Journeys cases |
| `maya@opsdesk.demo` | Maya's own records and customer-visible messages |
| `supplier@opsdesk.demo` | Aster Hotels' explicitly shared supplier conversations |
| `skyline@opsdesk.demo` | Skyline supplier threads, separate from Aster |

New generic registrations do not automatically gain a travel profile. Merged PR #28 implements manager-controlled invitations and reversible suspension; scope reassignment, deletion and operational retention policy are not implemented. Do not use generic upstream roles as a substitute for `TravelProfile.kind` authorization.

## 6. Demonstration script

1. Sign in as manager and search `OPS-1042`. Open the voucher case for `BK-1042` / Maya Sen / Atlas Travel / Bali / Aster Hotels.
2. Read the saved-record brief, linked case, booking details, message history and staff note. The initial seed has two cases for this booking; exact counts change as more cases are added.
3. Create a refund follow-up using the same booking reference. Confirm related cases appear and an eligible agent is assigned automatically. A missing reference must remain unlinked until staff verification.
4. Open a supplier thread asking Aster for an update. Confirm the case moves to Waiting supplier.
5. Sign in as `supplier@opsdesk.demo`; reply in the shared thread. Confirm the supplier cannot browse the main ticket/booking workspace or staff notes.
6. Return as manager. Confirm the response appears separately and the case returns to In progress. Close/reopen the thread to demonstrate lifecycle controls.
7. Use Demo clock to advance time into the six-hour check-in window. The seed starts the primary booking about 20 hours after initial seeding; an old database may already be overdue. Show priority escalation and manager attention without repeatedly creating duplicate events.
8. Resolve the case, inspect Insights and export the visible case list. Sign in as Maya or the agency to verify private supplier/staff content is hidden.

The manager's demo clock changes the effective workspace time for every account and survives restarts. The backend uses real time when `OPSDESK_DEMO` is not `true`. Restore the offset after a demonstration if subsequent cases should use real time.

## 7. Architecture and file map

```text
Browser -> Next.js UI / cookie proxy -> NestJS /ops API -> Prisma -> PostgreSQL
                                           |
                                           +-- deadline sweep every 15 seconds
                                           +-- Redis in production
                                               PostgreSQL counters in local development
```

| Path | Responsibility |
| --- | --- |
| `frontend/app/page.tsx`, `layout.tsx`, `globals.css` | OpsDesk entry point, shell, responsive styling |
| `frontend/components/opsdesk/workspace.tsx` | Inbox, filters, navigation, new ticket, data refresh and notifications |
| `frontend/components/opsdesk/ticket-detail.tsx` | Connected history, messages, notes, supplier threads and mutations |
| `frontend/components/opsdesk/reports.tsx` | Booking directory and insights |
| `frontend/components/opsdesk/login.tsx`, `ui.tsx` | Demo login and shared presentation helpers |
| `frontend/lib/opsdesk-types.ts` | Frontend workspace contracts |
| `backend/src/travel/travel.controller.ts`, `travel.dto.ts` | Authenticated endpoints and validated request shapes |
| `backend/src/travel/travel.service.ts` | Scoping, linking, mutations, collaboration, events and escalation |
| `backend/src/travel/travel.rules.ts`, `.spec.ts` | Classification, deadlines, urgency and assignment policies |
| `backend/prisma/schema.prisma` | Original models plus normalized travel domain |
| `backend/prisma/seed-travel.ts` | Synthetic users, agencies, bookings, cases and threads |
| `backend/src/redis/postgres-counter.client.ts` | Durable development substitute for the used Redis operations |
| `backend/src/auth/auth.service.ts` | Inherited auth; refresh token now includes a unique JWT ID |
| `scripts/local-setup.mjs`, `local-db.mjs`, `run-local.mjs` | Generated local config, embedded PostgreSQL and app lifecycle |
| `scripts/smoke-test.mjs` | Real HTTP role/workflow checks with temporary test cases |
| `scripts/import-bitext.py` | Reproducible small complaint-text sample selection |
| `.github/workflows/opsdesk-ci.yml` | Linux CI with PostgreSQL service; builds, starts isolated demo, tests and audits |

The original IT Helpdesk app, generic endpoints, administration/reset logic, Gemini code, Docker files, infrastructure and old documentation remain in the repository. Travel accounts are blocked from the generic ticket and AI endpoints. The generic demo reset refuses databases with travel profiles, and inherited self-service deletion cannot delete a travel account. Contact support for travel account closure. Treat `OPSDESK_README.md` and this handoff as the current local startup instructions. The OpsDesk launcher uses `backend/dist/src/main.js`.

## 8. Data model and invariants

- `TravelAgency`: agency identity/code; `TravelSupplier`: supplier identity/contact.
- `TravelProfile`: maps inherited `User` to travel role, agency/supplier, region and availability.
- `TravelBooking`: agency-scoped unique reference, customer ID, supplier, service, destination, check-in, region and timezone.
- `TravelTicket`: distinct complaint, optional verified booking, agency/customer, category, status, priority, agent and deadlines.
- `TravelConversation`: ticket/supplier-specific side thread, status and due date.
- `TravelMessage`: ticket and optional conversation, sender, content, visibility and timestamp.
- `TravelEvent`: auditable case event; unique escalation key prevents repeated notices for the same deadline.
- `TravelClock`: optional demo offset. `OpsCounter`: durable development counters and session-revocation storage.

Apply migrations with `prisma migrate deploy`. The travel-profile foreign key prevents deleting the underlying user while the profile exists. Some travel identity and agent fields are still plain string IDs. A production account closure policy must explicitly preserve or anonymize historical references.

Core invariants: scope is derived from the persisted profile; verify agency/customer before booking linking; customer-facing history excludes internal and supplier content; suppliers see only their explicitly shared conversations; lock routing/escalation changes and keep unique escalation keys; use UTC in persistence and retain the booking timezone. The global advisory transaction lock is suitable for the small demo but serializes unrelated routing and escalation work.

## 9. API surface

All `/ops` routes use the inherited JWT guard; the service performs travel-profile and record-level checks. IDs in paths are database IDs, not display references such as `OPS-1042`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/ops/workspace?compact=1` | Browser metadata, authorized directories, server counts and notifications; no case/thread snapshot |
| GET | `/ops/workspace` | Legacy full authorized workspace; retained for API compatibility |
| GET | `/ops/queue` | Authorized inbox ordering, search, filters and 20 case rows/IDs per page |
| GET | `/ops/tickets/:id` | One authorized case and booking context, without message or activity history |
| GET | `/ops/tickets/:id/messages`, `/events`, `/related` | Authorized messages, activity and connected history, 20 rows per page |
| GET | `/ops/bookings/:id/tickets` | Authorized booking case history, 20 rows per page |
| GET | `/ops/tickets/:id/conversations` | Staff-only supplier threads for an authorized case, 20 rows per page |
| GET | `/ops/conversations` | Current supplier's shared threads, 20 rows per page |
| GET | `/ops/conversations/:id/messages` | Authorized supplier-thread messages, 20 rows per page |
| GET | `/ops/insights` | Staff-only aggregate report using the caller’s authorized case scope |
| POST | `/ops/tickets` | Create and link/classify/route a case |
| PATCH | `/ops/tickets/:id` | Status, priority, assignment and booking verification |
| POST | `/ops/tickets/:id/messages` | Customer-visible response or private staff note |
| POST | `/ops/tickets/:id/conversations` | Start supplier side conversation |
| POST | `/ops/tickets/:id/alerts/:alertId/acknowledge` | Manager acknowledges one escalation or supplier-overdue alert. Retrying returns the original acknowledgment timestamp |
| POST | `/ops/conversations/:id/reply` | Reply as authorized staff or matching supplier |
| PATCH | `/ops/conversations/:id` | Staff close/reopen supplier thread |
| PATCH | `/ops/availability` | Set own support availability |
| PATCH | `/ops/bookings/:id/schedule` | Manager edits check-in, departure and cancellation cutoff as UTC timestamps and recalculates active case deadlines |
| PATCH | `/ops/agents/:id/specialties` | Manager sets an agent’s supported categories. An empty list provides general coverage |
| PATCH | `/ops/agencies/:id/response-policy` | Manager sets a 1–168 hour response target for future case cycles |
| GET | `/health/ready` | Returns 200 when PostgreSQL and the counters backend are ready, otherwise 503 |
| GET | `/health/worker` | Returns 200 when a deadline sweep completed in the last minute, otherwise 503 |
| POST | `/ops/clock/advance` | Manager-only demo time advance |

See DTOs for exact fields. Do not bypass the service authorization with direct UI role checks. New integrations must authenticate their own webhook source and map identities to existing authorized records.

The browser requests compact workspace metadata and filtered inbox rows from PostgreSQL. Opening a case loads its details on demand. Messages, activity, related cases, booking history, supplier threads and supplier messages use separate authorized endpoints with validated `page` values and 20-row limits. Pages sort newest first with an ID tie breaker; message pages display chronologically. CSV export explicitly exports the current inbox page. Booking and people directories now use searched, authorized 20-row pages, including intake, owner filtering, reassignment and routing settings. Compact metadata contains no booking or people arrays; queue rows and case details supply bounded display context. the legacy full-workspace endpoint remains for compatibility and is no longer requested by the browser.

## 10. Current business rules

- Keyword rules suggest one of the supported travel issue categories; they are not an LLM classifier.
- Routing selects available regional or global agents, prefers the matching specialty and breaks ties by active workload. Generalists cover categories without an available specialist. If no eligible agent is available, the ticket stays unassigned. Managers edit specialties from Needs attention.
- Managers can set each agent’s maximum active cases from Needs attention. Automatic routing skips agents at capacity, including during simultaneous intake. Existing assignments are preserved and managers can still reassign deliberately.
- Agency response targets default to 24 elapsed hours; managers may opt into a business calendar. Policy changes apply to new and reopened cases. Case activity records the policy version and duration used. Existing active cases retain their response target. Reopening starts a new response cycle and preserves ownership.
- Non-refund cases use the earliest applicable response, check-in or departure deadline. Cancellation cases also consider the cancellation cutoff. Imminent check-in raises priority to High within 24 hours and Urgent within 6 hours. A missed case deadline is Urgent. Refunds keep their independent response target.
- Managers can edit the booking schedule from a linked case. The form accepts UTC timestamps and the context panel displays dates in the booking timezone. Schedule edits recalculate active case deadlines and record changes without extending the response target. Previously stored case deadlines serve as the response target until a separate one is stored. Existing bookings can have unset departure and cancellation dates.
- Urgency automation does not lower an existing higher priority. Agency response calendars and member shifts are manager-configurable; supplier response targets still use elapsed hours.
- A reply or closure returns the case to support when its last pending supplier thread is handled. Reopening a thread requests another reply and starts a new due date. Repeating the same status request preserves that due date.
- Case briefs are assembled from authorized saved facts and source references. Supplier text and complaint examples are not policy truth.
- Staff can start a customer reply from a draft that uses the case reference, verified booking reference and whether a supplier replied. The draft never quotes the supplier message. Add confirmed details before sending.
- The sweep runs every 15 seconds and after relevant clock changes; it persists events rather than delivering email or push messages.

## 11. Environment, secrets and local data

`npm run ops:setup` creates `backend/.env` and `frontend/.env.local` only when missing. It generates random database and JWT secrets. Existing files are preserved, so a pre-existing upstream `.env` may need manual correction. Source-control ignore rules and source ZIP packaging exclude these files and `.opsdesk`.

| Variable | Meaning / local expectation |
| --- | --- |
| `DATABASE_URL`, `LOCAL_POSTGRES_PASSWORD` | Generated matching credentials for embedded PostgreSQL |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Separate generated secrets; never reuse demo secrets for production |
| `HOST`, `PORT` | API `127.0.0.1`, `3001` locally |
| `FRONTEND_URL` | Required allowed frontend origin; default generated local config uses `http://localhost:3000` while BFF preview is opened at `127.0.0.1` |
| `BACKEND_API_URL` | Server-only Next.js setting, `http://127.0.0.1:3001` locally |
| `NODE_ENV` | Backend development for local counter mode; optimized Next preview runs its production build |
| `OPSDESK_LOCAL_COUNTERS` | `true` enables local PostgreSQL counters; explicitly rejected in production |
| `OPSDESK_DEMO` | `true` enables the synthetic workspace's effective demo clock |
| `REDIS_URL` | Production/session/rate-limit Redis when local counters are disabled |
| `GEMINI_API_KEY` | Optional inherited AI feature; not required or connected in OpsDesk |
| `TURNSTILE_SECRET_KEY` | Generated local test value for inherited registration; production requires real captcha configuration |

There are no live email, supplier, booking-system or external AI credentials in this implementation. Credentials are not included in the handoff or GitHub. A ChatGPT/Claude/Gemini consumer subscription does not configure this application.

The original machine's persistent database is `.opsdesk/postgres`. It contains 61 cases after the browser demo (60 seed cases plus `OPS-141932FA`, a BK-1042 refund follow-up and supplier thread). A new clone starts with 60. The operational data is synthetic and is intentionally not committed. To move a modified workspace, use a PostgreSQL logical backup/restore while connected; verify a restore on a separate database. Do not copy a running PostgreSQL data directory or commit database files. Closing the app does not delete records.

## 12. Validation and reproducibility

On this membership branch, `ops:test` includes the membership HTTP script and `ops:test:browser` includes both browser scripts. For a targeted run, use `npm run ops:test:membership` or `npm run ops:test:membership:browser` against the isolated seeded preview. Repeat browser coverage with `OPSDESK_BROWSER_ENGINE=firefox` and clear any Chromium channel override. The user requested stopping the final local browser sequence to publish the GitHub PR first. The validation guide records the actual results and the command sequence for completing browser verification before merge.

With the local preview running in terminal one, use terminal two:

```powershell
npm run ops:test
# With Chromium installed via npx playwright install chromium:
npm run ops:test:browser
npm audit --omit=dev
git diff --check
```

For a standalone compile check: `npm run build` after Prisma generation/local setup. The preview launcher already builds the shared package, NestJS and Next.js.

At the implementation baseline, local validation passed 9 unit tests, 99 PostgreSQL-backed HTTP checks, both builds and the five-role browser flow. [GitHub CI passed on the head of PR #12](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42668187410) before it merged. See [validation details](OPSDESK_VALIDATION.md).

Run the smoke suites against an isolated seeded demo. They create and clean up temporary records and restore the settings they change. Coverage includes role isolation, repeat-safe escalation, concurrent routing at capacity, scoped reports and inbox pagination. Load testing and production security review remain open. Development-tool advisories remain; upgrades across major versions require separate validation.

GitHub CI uses a fresh Linux runner, an official PostgreSQL 18 service and synthetic data, builds/starts the preview, executes the same test command and audits production packages. The initial hosted Windows run could not start embedded PostgreSQL; local Windows startup passed, but hosted Windows packaging remains unverified. CI uses `--external-db` to test the application against a service database. Database startup failures retain diagnostics. Check the actual PR runs before merging; a committed workflow file alone is not evidence of a successful cloud run. The inherited release and reset jobs are restricted to the original upstream repository and do not deploy/reset this project.

On the build machine, the bundled Git runtime has no Bash executable for Husky's shell wrapper. The equivalent staged frontend/backend ESLint checks were run directly through `npx lint-staged` and passed after fixing typed PostgreSQL results, unknown error handling and asynchronous workspace loading. The commit wrapper was skipped for that local commit only; repository hooks were retained. Install Git for Windows with Bash on a receiving Windows development machine.

## 13. Remaining work, in priority order

Continue in this order. P0 live-data gates remain mandatory before live use; deployment stays paused while local features are completed. See [backlog](OPSDESK_BACKLOG.md) for acceptance criteria and issues.

1. **Membership is merged in PR #28; retain its safeguards.** Run the commands in section 12 and the current validation section. Inspect `backend/src/travel/membership.service.ts`, `membership.controller.ts`, `membership.dto.ts`, `backend/src/auth/auth.service.ts`, the JWT strategy, `backend/prisma/migrations/20261110120000_membership_admin/migration.sql`, `frontend/components/opsdesk/membership.tsx`, `frontend/app/activate/page.tsx` and `frontend/app/api/invitations/accept/route.ts`. Verify invitation expiry/reissue/single-use races, five-role denial, suspended assignment exclusion, stale-token rejection after reactivation, self/last-manager guards, paged selectors/audit and unchanged history. Repeat existing refresh-concurrency and five-role browser regressions. Record final evidence, publish/review the PR and merge only after checks pass.
2. **Review the current calendar/coverage increment and finish remaining policy work (#6).** Start with `backend/src/travel/travel.rules.ts`, `travel.service.ts`, Prisma policy records and the manager controls in `frontend/components/opsdesk/workspace.tsx`. Define contract timezone, working intervals, holiday calendars, daylight-saving boundaries, no-coverage behavior and escalation owner with the product owner. Version the applied policy on each case; preserve current elapsed-hour behavior until an explicit policy applies. Test holiday/weekend boundaries, DST, reopen, simultaneous assignment and unavailable shifts.
3. **Email and secure attachments (#4).** Add a provider-neutral delivery interface and transactional outbox beside travel message creation; use provider IDs, retry/idempotency and scoped thread mapping. Implement signed inbound webhook verification before ingestion. Store attachments behind authorization with size/type limits, malware scanning, expiring downloads and retention. Test duplicate/out-of-order events and delivery failures; never expose internal notes to suppliers. Resend is a future adapter option; no provider is connected.
4. **Booking adapter and lifecycle policy (#5).** Extend the existing booking export contract/tooling and `TravelBooking` persistence with a provider-neutral read adapter. Map stable external identities inside agency boundaries, normalize timezone/version changes, and retain review for ambiguous matches. Before enabling creation or cancellation updates affecting active cases, obtain explicit owner decisions about case status, reassignment, deadlines and audit. Cover retries, stale exports, collisions and rollback; do not invent cancellation policy.
5. **Independent evaluation, accessibility and scale (#7–#9).** Extend the classifier’s synthetic baseline with independently labeled held-out cases before adding an external model. Audit keyboard/screen-reader/contrast behavior; measure skewed concurrent workloads, lock waits and worker recovery against agreed service targets. Keep authorization and ownership deterministic.
6. **P0 before live data (#2–#3).** Obtain product acceptance and retention/tenant decisions, review account closure, and rehearse verified backup/restore into isolated staging with named release/recovery owners and monitoring. Resume hosting only when the user requests it; configure secrets, HTTPS, exact origins and production Redis without weakening demo/seed guards.

## 14. Troubleshooting

| Symptom | Check / recovery |
| --- | --- |
| Port already in use | Stop the previous launcher; inspect listeners on 3000, 3001 and 55432. Do not delete the database directory to free a port. |
| PostgreSQL authentication fails | Compare local `.env` credentials to the existing cluster. Setup preserves files and cannot rotate an existing database password automatically. |
| No travel access after registration | Add a valid travel profile through a reviewed provisioning path; generic registration does not create one. Use seeded accounts for the demo. |
| Many overdue cases after a break | Persisted seed dates and demo offset are still in effect; inspect actual check-in/response deadlines. This is not a reseed on every start. |
| Login throttled during repeated tests | Wait for the local rate-limit window; do not weaken production rate limiting. The smoke suite authenticates multiple distinct accounts. |
| Readiness returns 503 | Check the PostgreSQL connection and migrations, then Redis connectivity or local counters startup. The public response omits connection details. |
| Worker probe returns 503 | Inspect deadline check errors in the backend log and verify PostgreSQL connectivity and transaction latency. After recovery, confirm a successful sweep and check the manager queue. Stored alerts remain protected by their unique keys. |
| Build after moving the repository fails | Workspace dependency links can contain old absolute paths. Use a fresh clone plus `npm ci`, regenerate Prisma and build the shared package. |
| Development React eval/CSP warning | Use `ops:preview` for the optimized demo. Do not broadly weaken the inherited CSP to quiet development tooling. |
| Shutdown leaves a Windows process | Check the listener's owning process and stop only the identified OpsDesk child process; preserve local data. |
| Need to change Prisma schema | Back up data, generate a new migration in development, review SQL, test restore and apply with migrate deploy. Never edit an already-applied migration on a shared environment. |

## 15. Transfer checklist

- [ ] Owner grants the named recipient write access if they will publish or merge changes.
- [ ] Recipient clones `main` and runs the complete demo from a clean checkout.
- [ ] Recipient reads this document, setup README, validation report, sources and prioritized backlog.
- [ ] Review the merged implementation PRs and the validation evidence linked above.
- [ ] Recipient repeats the customer/agency/supplier privacy demonstration and main booking workflow.
- [ ] Owner decides whether to transfer synthetic local records via verified logical backup; a clean seed is enough for development.
- [ ] Product owner provides full acceptance brief and chooses the next milestone.
- [ ] Before live use, complete P0 items and review all external integrations and data-handling requirements.

## 16. Messages to forward

> **Merged synthetic application baseline.** Start from `main` at `f71b284`. Use Node 22.23.x, run `npm ci` and `npm run ops:preview`, then follow the BK-1042 scenario in this handoff. Booking-linked intake, private supplier threads, routing, escalation, resolution, paged case history and scoped Insights are merged. The demo also has worker restart, database restore, and five-role Chromium and Firefox checks.

> **Also merged.** PR #25 improves the rules-based classifier and adds CI regression checks. PR #26 adds audited manager acknowledgment for alerts. PR #27 validates booking exports, verifies mapped ownership in PostgreSQL, and can transactionally apply approved updates to existing synthetic bookings. It skips stale versions, handles retries and rolls back a batch with a review item. Changes affecting active cases still require review.

> **Current and next.** Membership administration merged in PR #28 with passing hosted validation. The current local increment adds agency calendars, explicit pause/resume, duty coverage and manager escalation handoffs. Review its migration, test evidence and policy limits before merging. Next complete remaining contract/supplier calendars and workload-handoff policies, then email/attachments and a provider-neutral booking adapter with explicit owner policy for new bookings and cancellations. Independent evaluation, accessibility, load and live-data/recovery gates remain open. Deployment stays paused.

## Release and incident checks

1. The release owner records the deployed commit, last known healthy commit, migration versions, backup location, recovery objectives and rollback authority before staging deployment. Contact names and hosting details still need an owner.
2. Poll `GET /health/ready` for database and counter-service readiness and `GET /health/worker` for a recent successful escalation sweep. Both return 200 when healthy and 503 when unavailable. Monitor each instance so a healthy peer cannot hide a stalled worker.
3. If readiness fails, take the affected instance out of rotation and check its database connectivity, counter service and configuration. If only the worker fails, inspect sweep errors and PostgreSQL lock waits. Capture timestamps, affected ticket IDs and release SHA while excluding secrets and traveler messages.
4. During recovery, drain incompatible worker versions before restarting. Verify one alert per deadline, supplier thread privacy, and both health probes. Use the recovery runbook on an isolated target. An operational cutover requires the deployment owner's verified backup and rollback plan.

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

## Historical dialog keyboard access

The shared workspace dialog uses its heading as its accessible name, wraps focus in both directions and restores the launcher on dismissal. Search and message fields have visible keyboard focus, and sign-in errors are announced as alerts. Run npm run ops:test:browser against the seeded preview to reproduce the keyboard checks. The remaining accessibility work in issue #9 includes assistive technology, contrast, and additional browsers.

The five-role flow now also passes in Playwright Firefox on Windows. CI runs the same workflow sequentially in Chromium and Firefox. A Chromium channel override must be cleared before selecting Firefox.

## Historical concurrent session refresh

A conditional PostgreSQL update consumes each valid token once. The replacement session is created in the same transaction. Access-token denial through the existing revocation service follows commit. A stale browser refresh returns 401 without emitting cookie deletions. Explicit logout still clears the browser cookies. No migration or provider credentials are required.

## Reconstructed automatic workload handoff

PR #29 is merged into main 12114c6. The uncommitted Arihant checkout referenced by the transfer message was unavailable on this ASUS machine. This follow-up was reconstructed from that message in a separate worktree; its validation results apply only to this implementation. Deployment remains paused.

Managers may opt an active case into automatic handoff with a recorded reason. New and existing cases default to disabled. The sweep preserves an eligible current owner, regardless of their existing capacity load. When coverage ends through shift, availability, membership or eligibility changes, the sweep selects an on-duty replacement using the existing regional/category and capacity policy. With no capacity, it clears the owner and retries on later sweeps. Repeated unchanged decisions add no audit event. Waiting and SLA-paused cases participate, while closed/resolved cases are excluded. Manual assignment disables automation, including a manager reaffirming the same owner. Paused budgets, travel deadlines and supplier threads keep their existing state.

Each candidate runs under the shared capacity lock followed by the parent ticket lock and fresh reads. Workers page opted-in active case IDs in batches of 100. The pass still visits all opted-in active cases each sweep, so large-volume scheduling needs further measurement. Existing assignment and membership writers use the same capacity protocol. No external provider is required.
