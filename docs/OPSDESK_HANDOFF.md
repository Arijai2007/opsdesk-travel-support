# OpsDesk — project handoff

Prepared 10 November 2026. This document is the entry point for the next developer. It describes the delivered localhost prototype, the implementation boundaries, and the work required to turn it into an operational travel-support product.


## Current checkpoint on main

PRs #15 through #24 are merged. The merged checkpoint for this handoff is `efbcb49`. Clone `main` for the merged implementation. The [combined CI run for PR #23](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42774645178) covers logical recovery, 28 backend unit tests, 403 HTTP checks, 13 concurrency checks, both browser engines and the production dependency audit.

| Review | Change |
| --- | --- |
| [#17](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/17) | Per-ticket locks, bounded escalation sweeps, concurrency and reconnect checks |
| [#18](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/18) | Rehearsal of a synthetic PostgreSQL backup and restore |
| [#19](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/19) | Production startup configuration checks |
| [#20](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/20) | Keyboard navigation, dialog names and focus restoration |
| [#21](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/21) | Firefox coverage for all five roles, built on #20 |
| [#22](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/22) | Atomic session rotation and safe handling of late browser responses |
| [#24](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/24) | Worker process termination and restart rehearsal with durable escalation checks |

### Follow-up work in review

These checkpoints are on GitHub in open PRs. They were outside the merged `main` baseline when this handoff was updated.

| PR | Ready for review | Still open |
| --- | --- | --- |
| [#25](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/25) | Offline classifier evaluation, revised keyword rules and CI regression checks. [CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42796372823). | Independently labeled evaluation, redaction and any external AI provider |
| [#26](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/26) | Manager acknowledgment clears the notification while preserving the original escalation and audit event. [CI passed](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42798095400). | Escalation ownership, external delivery, SLA calendars and membership administration |
| [#27](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/27) | [Booking export validation and read-only reconciliation](OPSDESK_BOOKING_EXPORT.md) flag stale updates, cancellations and conflicts. Optional PostgreSQL verification detects ownership, reference and schedule conflicts. Twelve local tests and the PostgreSQL integration check passed. | Choose a provider adapter, persist provider versions and cancellation state, and apply approved changes with transaction and retry protection |

Use Node 22.23.x. Run the seeded preview, then `npm run ops:test` and `npm run ops:test:browser`. Repeat the browser command with `OPSDESK_BROWSER_ENGINE=firefox`. For recovery, follow the [isolated recovery runbook](OPSDESK_RECOVERY.md). The hosted workflow runs recovery, both builds, the API suites, multi-connection checks, both browsers and the production dependency audit.

**Next owner actions.** Reproduce the demo from a clean clone and record the acceptance decision for each of the six scenarios in the validation guide. For a live pilot, settle account provisioning and history retention (#2), deployment ownership, managed services, backup retention and monitoring (#3). The [backlog](OPSDESK_BACKLOG.md) also tracks email and attachments (#4), booking integrations (#5), SLA calendars and memberships (#6), performance and worker fault testing (#7), optional AI (#8) and accessibility/release qualification (#9). All demo data is synthetic.

### Historical query-scaling baseline (10 November 2026)

PR #15 is merged. This follow-up was rebased onto latest main `f865ea9` after reviewing that merge; its source matches the tested `d75efbb` directory baseline. Profiling now covers 6,000 extra bookings, 18,000 cases and 54,000 messages using the real directory, inbox and Insights queries. People authorization now materializes the scoped ID set once rather than repeating correlated checks for every profile. A covering customer-message index improves first-response reporting. See [query plans, timings, reproduction and limits](OPSDESK_QUERY_PROFILE.md).

Validation on pinned Node.js 22.23.0 passed both builds, 9 unit tests, 400 HTTP checks and browser flows. The directory tests now include people visible only through an unbooked case or supplier-thread message. Full backend lint errors in inherited files remain; changed-file lint passes. Global lock behavior was measured but locking is unchanged. Staging, real-world data distributions, read/write load targets and live-data readiness remain open.

## 1. Repository and review order

- Repository: https://github.com/DhruvKhanna7777/opsdesk-travel-support.
- Implementation PR: https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/1.
- Handoff PR: https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/10.
- Remaining-work issues: https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues (issues #2–#9).
- [Access and intake hardening (#11)](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/11) and [travel policies, Insights and inbox pagination (#12)](https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/12) are merged. Start from `main`. PR #14 is also merged. This directory follow-up starts from latest main, `a5455a4`, reviewed before implementation.
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
| Assignment | Region and category coverage, availability, configurable capacity, least-open workload, generalist fallback, manager overrides and an unassigned queue | Shifts, round-robin policies and agent provisioning remain pending |
| Supplier collaboration | Separate persistent supplier threads, scoped supplier login, replies, close/reopen, due dates | Messages stay inside the app; no real email, WhatsApp or supplier API delivery |
| Travel urgency | Versioned agency response targets in elapsed hours, separate travel deadlines, manager schedule edits, check-in urgency, supplier due dates and manager notifications | Contract SLAs, business-hour calendars and external alerts remain pending |
| Escalation | 15-second sweep, durable events, unique escalation keys, transaction lock, manager-only persistent demo clock | No external alert delivery, acknowledgment workflow or dedicated job service |
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

New generic registrations do not automatically gain a travel profile. Operational user creation and membership management are pending. Do not use generic upstream roles as a substitute for `TravelProfile.kind` authorization.

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
- Agency response targets use elapsed hours and default to 24. Policy changes apply to new and reopened cases. Case activity records the policy version and duration used. Existing active cases retain their response target. Reopening starts a new response cycle and preserves ownership.
- Non-refund cases use the earliest applicable response, check-in or departure deadline. Cancellation cases also consider the cancellation cutoff. Imminent check-in raises priority to High within 24 hours and Urgent within 6 hours. A missed case deadline is Urgent. Refunds keep their independent response target.
- Managers can edit the booking schedule from a linked case. The form accepts UTC timestamps and the context panel displays dates in the booking timezone. Schedule edits recalculate active case deadlines and record changes without extending the response target. Previously stored case deadlines serve as the response target until a separate one is stored. Existing bookings can have unset departure and cancellation dates.
- Urgency automation does not lower an existing higher priority. Default timing is encoded in `travel.rules.ts` and supplier-thread creation, not a customer-configurable SLA module.
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

These are not implemented promises. Start with product acceptance and production foundations before external AI. See `OPSDESK_BACKLOG.md` for concrete acceptance criteria and GitHub issue links.

1. **P0 — Product acceptance and authorization hardening.** Review the six demo scenarios with the product owner. Travel accounts are isolated from inherited helpdesk routes and protected from generic deletion/reset. Confirm production organization boundaries and design account closure, retention and provisioning before using live data.
2. **P0 — Production runtime and operations.** Select a deployment target, configure managed PostgreSQL and Redis, secrets, HTTPS, proxy and cookie settings, and remove demo access from the live environment. Rehearse migration and recovery on staging. Connect the existing readiness and worker probes to monitoring and assign on-call ownership.
3. **P1 — Real conversations and attachments.** Select provider, implement verified inbound webhooks and outbound messages, idempotent message IDs, correct thread routing, retry/outbox, attachment scanning/storage and redaction. Supplier email must never include internal notes or unrelated bookings.
4. **P1 — Booking/supplier integration.** Read real bookings through a provider adapter, map stable agency/customer IDs, synchronize check-in/timezones, validate ownership and reconciliation; add supplier identity verification. Current records are seed data only.
5. **P1 — Configurable operations.** Extend the existing agency response targets and specialty/capacity routing with contract calendars, regional shifts, escalation acknowledgment and membership administration.
6. **P1 — Scale and reporting.** Inbox rows and case histories are paginated, individual cases load on demand, and Insights aggregates in PostgreSQL. Next profile realistic-volume queries, paginate the remaining metadata directories, retire the legacy full-workspace route, narrow lock scope, and measure worker and API performance.
7. **P2 — Optional AI with evaluation.** Choose Claude, Gemini or another provider only after specifying the task. Ground summaries in authorized records, require source references, reject injected instructions, validate output schemas, redact PII, set spend limits and evaluate on held-out labeled travel cases. Keep access/routing/deadlines deterministic. Add a real API key only when implementing that adapter.
8. **P2 — Quality and release process.** Extend the existing five-role browser flow to failure recovery and more browsers. Complete accessibility, load, security and license reviews, and define release ownership and incident response.

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

## 16. Message to pass to the next developer

> Start on `main` in `DhruvKhanna7777/opsdesk-travel-support`. Use Node 22.23.x, run `npm ci` and `npm run ops:preview`, then open http://127.0.0.1:3000. Demonstrate the BK-1042 case across manager, agent, supplier, agency and customer accounts using sections 5 and 6 of this handoff. Review the saved case history, supplier privacy, routing, escalation and Insights. The demo uses synthetic data and requires no external API key.
>
> The merged work includes scoped ticket locks, restart-safe escalation, logical restore checks, production configuration checks, atomic token rotation, and Chromium and Firefox regression coverage. The recovery rehearsal now kills a worker mid-transaction and verifies the replacement completes the interrupted case with one durable escalation alert per case. See the validation and recovery guides for reproduction.
>
> Review PRs #25–#27 before relying on the classifier follow-up, escalation acknowledgment or booking preflight in `main`. The booking preflight can verify mapped ownership in PostgreSQL. The next step is transactional apply, including what existing cases should do when a booking is cancelled. The current planner writes nothing.
>
> Start the live-pilot work with #2 and #3. Get the owner's access and retention decisions, a staging target, monitored PostgreSQL and Redis, recovery objectives and a named incident owner. Exercise the six scenarios on staging with approved data. Then follow the backlog for provider integrations, operations, performance and release qualification. Record evidence in each issue before closing it.

## Release and incident checks

1. The release owner records the deployed commit, last known healthy commit, migration versions, backup location, recovery objectives and rollback authority before staging deployment. Contact names and hosting details still need an owner.
2. Poll `GET /health/ready` for database and counter-service readiness and `GET /health/worker` for a recent successful escalation sweep. Both return 200 when healthy and 503 when unavailable. Monitor each instance so a healthy peer cannot hide a stalled worker.
3. If readiness fails, take the affected instance out of rotation and check its database connectivity, counter service and configuration. If only the worker fails, inspect sweep errors and PostgreSQL lock waits. Capture timestamps, affected ticket IDs and release SHA while excluding secrets and traveler messages.
4. During recovery, drain incompatible worker versions before restarting. Verify one alert per deadline, supplier thread privacy, and both health probes. Use the recovery runbook on an isolated target. An operational cutover requires the deployment owner's verified backup and rollback plan.

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

## Dialog keyboard access

The shared workspace dialog uses its heading as its accessible name, wraps focus in both directions and restores the launcher on dismissal. Search and message fields have visible keyboard focus, and sign-in errors are announced as alerts. Run npm run ops:test:browser against the seeded preview to reproduce the keyboard checks. The remaining accessibility work in issue #9 includes assistive technology, contrast, and additional browsers.

The five-role flow now also passes in Playwright Firefox on Windows. CI runs the same workflow sequentially in Chromium and Firefox. A Chromium channel override must be cleared before selecting Firefox.

## Concurrent session refresh

A conditional PostgreSQL update consumes each valid token once. The replacement session is created in the same transaction. Access-token denial through the existing revocation service follows commit. A stale browser refresh returns 401 without emitting cookie deletions. Explicit logout still clears the browser cookies. No migration or provider credentials are required.
