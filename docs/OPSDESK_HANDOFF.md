# OpsDesk — project handoff

Prepared 9 November 2026. This document is the entry point for the next developer. It describes the delivered localhost prototype, the implementation boundaries, and the work required to turn it into an operational travel-support product.

## 1. Repository and review order

- Repository: https://github.com/DhruvKhanna7777/opsdesk-travel-support.
- Implementation PR: https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/1.
- Handoff PR: https://github.com/DhruvKhanna7777/opsdesk-travel-support/pull/10.
- Remaining-work issues: https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues (issues #2–#9).
- Both PRs have merged. Start from `main` for the current implementation and handoff.
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
| Assignment | Region coverage, agent availability, least-open-workload selection, global fallback, manager reassignment and unassigned queue | No shifts, skills matrix, configurable capacity, round-robin contracts or agent provisioning UI |
| Supplier collaboration | Separate persistent supplier threads, scoped supplier login, replies, close/reopen, due dates | Messages stay inside the app; no real email, WhatsApp or supplier API delivery |
| Travel urgency | Response deadline, check-in urgency, overdue supplier attention queue, manager notifications | Default policies are code-based, not per-contract SLAs or business-hour calendars |
| Escalation | 15-second sweep, durable events, unique escalation keys, transaction lock, manager-only persistent demo clock | No external alert delivery, acknowledgment workflow or dedicated job service |
| Insights | Category and 7-day volume charts, resolution rate, median first response, repeat bookings, supplier counts, CSV export | Calculated from loaded authorized demo records; not a scalable analytics pipeline |
| Access roles | Manager, regional/global agent, agency, customer and supplier | Single shared support organization; no organization-admin or SSO onboarding |
| Assistance | Rules-based category suggestions and source-labelled briefs from saved records | No connected LLM, model training or measured classification accuracy |
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
| GET | `/ops/workspace` | Authorized tickets, people, bookings, supplier threads and configuration |
| POST | `/ops/tickets` | Create and link/classify/route a case |
| PATCH | `/ops/tickets/:id` | Status, priority, assignment and booking verification |
| POST | `/ops/tickets/:id/messages` | Customer-visible response or private staff note |
| POST | `/ops/tickets/:id/conversations` | Start supplier side conversation |
| POST | `/ops/conversations/:id/reply` | Reply as authorized staff or matching supplier |
| PATCH | `/ops/conversations/:id` | Staff close/reopen supplier thread |
| PATCH | `/ops/availability` | Set own support availability |
| POST | `/ops/clock/advance` | Manager-only demo time advance |

See DTOs for exact fields. Do not bypass the service authorization with direct UI role checks. New integrations must authenticate their own webhook source and map identities to existing authorized records.

## 10. Current business rules

- Keyword rules suggest one of the supported travel issue categories; they are not an LLM classifier.
- Routing picks an available eligible regional/global support agent with the lowest active-case workload. No eligible agent leaves the case unassigned.
- Non-refund service issues use the earlier relevant travel/response deadline. Imminent check-in raises priority: within 24 hours High, within 6 hours Urgent. Missed response targets are Urgent. Refund follow-ups use response deadlines independently of check-in.
- Urgency automation does not lower an existing higher priority. Default timing is encoded in `travel.rules.ts` and supplier-thread creation, not a customer-configurable SLA module.
- A supplier reply returns work to support. Closed threads reject replies until staff reopen them.
- Case briefs are assembled from authorized saved facts and source references. Supplier text and complaint examples are not policy truth.
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
npm audit --omit=dev
git diff --check
```

For a standalone compile check: `npm run build` after Prisma generation/local setup. The preview launcher already builds the shared package, NestJS and Next.js.

Validated locally: 7 backend unit tests, including 6 travel-policy tests; 47 real HTTP checks against PostgreSQL; optimized Next.js build and TypeScript checks; NestJS compilation; production dependency audit with 0 known advisories at the time checked. Browser checks covered login, new case, related-history linking, assignment, supplier thread creation, insights totals, desktop/mobile layout and persistence across restart. See `OPSDESK_VALIDATION.md` and `assets/opsdesk-preview.jpg`.

The smoke suite uses an isolated seeded demo: creates and deletes only its own temporary cases, restores its clock/availability changes, checks role/agency/supplier isolation, and verifies repeat-safe escalation. It does not represent load testing, complete penetration testing, automated browser coverage or production readiness. Do not point it at a real operational database. Development-tool advisories remain; upgrades across major versions require separate validation.

GitHub CI uses a fresh Linux runner, an official PostgreSQL 18 service and synthetic data, builds/starts the preview, executes the same test command and audits production packages. The initial hosted Windows run could not start embedded PostgreSQL; local Windows startup passed, but hosted Windows packaging remains unverified. CI uses `--external-db` to test the application against a service database. Database startup failures retain diagnostics. Check the actual PR runs before merging; a committed workflow file alone is not evidence of a successful cloud run. The inherited release and reset jobs are restricted to the original upstream repository and do not deploy/reset this project.

On the build machine, the bundled Git runtime has no Bash executable for Husky's shell wrapper. The equivalent staged frontend/backend ESLint checks were run directly through `npx lint-staged` and passed after fixing typed PostgreSQL results, unknown error handling and asynchronous workspace loading. The commit wrapper was skipped for that local commit only; repository hooks were retained. Install Git for Windows with Bash on a receiving Windows development machine.

## 13. Remaining work, in priority order

These are not implemented promises. Start with product acceptance and production foundations before external AI. See `OPSDESK_BACKLOG.md` for concrete acceptance criteria and GitHub issue links.

1. **P0 — Product acceptance and authorization hardening.** Obtain the original six business-problem acceptance statements (the supplied summary does not enumerate them), map each to a demo, define support organization/agency boundaries, audit inherited generic endpoints/admin/account deletion and ensure travel data cannot be orphaned or exposed. Add focused negative-access tests for new paths.
2. **P0 — Production runtime and operations.** Managed PostgreSQL and Redis, real secrets, HTTPS, correct proxy/CORS/cookie settings, no demo accounts or demo clock, reviewed migrations/restore plan, monitoring, job health and retention. Decide actual deployment target; inherited GCP/Neon files are not a ready OpsDesk deployment.
3. **P1 — Real conversations and attachments.** Select provider, implement verified inbound webhooks and outbound messages, idempotent message IDs, correct thread routing, retry/outbox, attachment scanning/storage and redaction. Supplier email must never include internal notes or unrelated bookings.
4. **P1 — Booking/supplier integration.** Read real bookings through a provider adapter, map stable agency/customer IDs, synchronize check-in/timezones, validate ownership and reconciliation; add supplier identity verification. Current records are seed data only.
5. **P1 — Configurable operations.** SLA contracts, business hours, regional shifts, skills/capacity, escalation ownership/acknowledgment, holiday calendars, agent/agency/customer membership management and controlled reopening policies.
6. **P1 — Scale and reporting.** Paginated APIs, server-side search/aggregations, indexes from query plans, narrower locks, robust background queue/outbox, larger-dataset and concurrency tests. Current `/ops/workspace` loads the full authorized dataset and client reports aggregate it.
7. **P2 — Optional AI with evaluation.** Choose Claude, Gemini or another provider only after specifying the task. Ground summaries in authorized records, require source references, reject injected instructions, validate output schemas, redact PII, set spend limits and evaluate on held-out labeled travel cases. Keep access/routing/deadlines deterministic. Add a real API key only when implementing that adapter.
8. **P2 — Quality and release process.** Automated browser tests for all roles, accessibility audit, Windows fresh-clone setup coverage, broader integration/load tests, development dependency cleanup and source/data license review. Decide maintenance ownership and incident response before live use.

## 14. Troubleshooting

| Symptom | Check / recovery |
| --- | --- |
| Port already in use | Stop the previous launcher; inspect listeners on 3000, 3001 and 55432. Do not delete the database directory to free a port. |
| PostgreSQL authentication fails | Compare local `.env` credentials to the existing cluster. Setup preserves files and cannot rotate an existing database password automatically. |
| No travel access after registration | Add a valid travel profile through a reviewed provisioning path; generic registration does not create one. Use seeded accounts for the demo. |
| Many overdue cases after a break | Persisted seed dates and demo offset are still in effect; inspect actual check-in/response deadlines. This is not a reseed on every start. |
| Login throttled during repeated tests | Wait for the local rate-limit window; do not weaken production rate limiting. The smoke suite authenticates multiple distinct accounts. |
| Build after moving the repository fails | Workspace dependency links can contain old absolute paths. Use a fresh clone plus `npm ci`, regenerate Prisma and build the shared package. |
| Development React eval/CSP warning | Use `ops:preview` for the optimized demo. Do not broadly weaken the inherited CSP to quiet development tooling. |
| Shutdown leaves a Windows process | Check the listener's owning process and stop only the identified OpsDesk child process; preserve local data. |
| Need to change Prisma schema | Back up data, generate a new migration in development, review SQL, test restore and apply with migrate deploy. Never edit an already-applied migration on a shared environment. |

## 15. Transfer checklist

- [ ] Owner grants the named recipient write access if they will publish or merge changes.
- [ ] Recipient clones `main` and runs the complete demo from a clean checkout.
- [ ] Recipient reads this document, setup README, validation report, sources and prioritized backlog.
- [ ] Both PRs and actual CI results are reviewed, including documented lint/tooling exceptions.
- [ ] Recipient repeats the customer/agency/supplier privacy demonstration and main booking workflow.
- [ ] Owner decides whether to transfer synthetic local records via verified logical backup; a clean seed is enough for development.
- [ ] Product owner provides full acceptance brief and chooses the next milestone.
- [ ] Before live use, complete P0 items and review all external integrations and data-handling requirements.

No API purchase, external supplier communication, production deployment, repository transfer or reviewer invitation is implied by this code handoff.
