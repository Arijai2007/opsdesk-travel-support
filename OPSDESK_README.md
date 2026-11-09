# OpsDesk - connected travel support

A working local prototype built on [Molnar-Zoltan/it-helpdesk](https://github.com/Molnar-Zoltan/it-helpdesk). The original application and its documentation remain in the repository. OpsDesk's entry point is `/`; its API is `/ops/*`.

## Run locally

Requirements: Node.js 22 and npm. No Docker, paid API, email provider or external database account is required for the local demo.

On Windows, open **Start-OpsDesk.cmd**. For any supported host:

```sh
npm ci
npm run ops:preview
```

The launcher generates local-only secrets, starts embedded PostgreSQL on `127.0.0.1:55432`, applies migrations, seeds an empty travel workspace, builds both applications, and starts the API and optimized web preview. Open **http://127.0.0.1:3000**. First startup takes longer because packages and database binaries must install. For frontend development with live reload, use `npm run ops:dev` instead.

Run one launcher at a time. Existing records and `.env` files are preserved. Database files live in `.opsdesk/postgres`, are ignored by Git, and must be backed up if you want to retain your local cases. Closing the app does not delete records. The embedded database package supports Windows x64, Linux and macOS; this build was exercised on Windows x64.

## Demo accounts

All accounts use **OpsDeskDemo!2026**. These are explicit synthetic demo accounts, not an authentication bypass.

| Email | Role and access |
| --- | --- |
| manager@opsdesk.demo | Manager; all travel teams and agencies |
| asia@opsdesk.demo | Asia regional support agent |
| europe@opsdesk.demo | Europe regional support agent |
| americas@opsdesk.demo | Americas regional support agent |
| global@opsdesk.demo | Agent with global coverage |
| agency@opsdesk.demo | Atlas Travel agency cases |
| horizon@opsdesk.demo | Horizon agency cases |
| maya@opsdesk.demo | Maya's own bookings and customer-visible messages |
| supplier@opsdesk.demo | Aster Hotels' explicitly shared supplier threads |
| skyline@opsdesk.demo | Skyline's shared threads; cannot access Aster threads |

## What works

- Persistent tickets and messages; separate complaints remain separate records.
- Exact booking-reference linking within authorized agency/customer boundaries, plus manual verification for missing references.
- Regional queues, availability, least-loaded eligible-agent assignment, manager reassignment and an unassigned queue.
- Customer replies, staff-only notes and separate supplier conversations with dedicated supplier login.
- Response deadlines, check-in urgency, manager notifications, idempotent escalation and a persistent manager-only demo clock.
- Connected booking history, source-labelled record briefs and event timelines.
- Booking directory, operational insights, search, filters and CSV export.
- Responsive interface, server-side validation, JWT/HTTP-only-cookie login and inherited token rotation/revocation.

The demo starts with 3 agencies, 20 travelers, 30 bookings, 60 cases, 4 agents, 1 manager and 5 suppliers. All operational records are synthetic. The seeder does not reset an existing workspace.

## Show the main scenario

1. Sign in as the manager. Search **OPS-1042** and open the hotel-voucher case for **BK-1042**.
2. Read the earlier linked case, booking context, customer thread and internal handover note.
3. Open **Supplier threads**, then **Contact supplier**. Send a question to Aster Hotels.
4. Sign out and sign in as **supplier@opsdesk.demo**. Only Aster's shared conversations are visible. Reply with a confirmation.
5. Return as manager. The case moves back to In progress; the supplier response stays in its own thread.
6. Open **Demo clock**, then advance **16h**. The seeded booking begins about 20 hours after initial seeding, so the unresolved case enters the six-hour urgent window. If the seed is old, it may already be overdue; the queue shows the actual persisted deadlines.
7. Record the resolution, then open **Insights** and export the case list.
8. Sign in as Maya or the agency to verify that supplier threads and internal notes are hidden.

The demo clock affects every account and persists across restarts. New tickets use the current workspace time. The worker checks deadlines every 15 seconds and after clock changes. PostgreSQL transactions serialize routing/escalation decisions and unique event keys prevent duplicate escalation notifications. Urgency rules cannot lower an existing higher priority.

## AI and dataset boundary

No external AI is needed to run this build. Category suggestions use transparent keyword rules. Case briefs combine authorized saved facts and cite related case references; the interface labels them **From saved records**, not as LLM output. The upstream Gemini intake integration is retained but is not presented as connected in OpsDesk. A future AI adapter can replace the suggestions without changing authorization, deadlines or routing.

The New ticket form includes **Load a travel example**, backed by 66 attributed Bitext Travel instructions across 33 intents. These are wording examples, not actual bookings or supplier policies. See `frontend/public/data/travel-examples.json` and `docs/OPSDESK_SOURCES.md`.

Regenerate the sample with Python's standard library:

```sh
python scripts/import-bitext.py
```

The broader Bitext Customer Support dataset is an optional general-intent evaluation source; it was not used to claim model training or measured classification accuracy. Keep held-out evaluation records separate if you add a model.

## Validate

With the app running:

```sh
npm run ops:test
npm run build
```

`ops:test` runs policy unit tests and real HTTP checks against the local API. The smoke script creates its own temporary cases, cleans those cases up, restores the demo clock and agent availability, and checks isolation, validation, routing, supplier privacy, workflow transitions and duplicate-free escalation. It is intended for the isolated seeded demo, not a production database.

## Deployment boundary

This delivery runs on localhost and sends no real supplier/customer emails. It has not been published. Production deployment needs managed PostgreSQL, Redis, secure runtime secrets, HTTPS, real user onboarding, appropriately scoped teams, an email integration, monitoring, backups and a review of inherited account-management behavior against travel data retention requirements. Do not seed shared demo accounts into production; the travel seeder rejects `NODE_ENV=production`.

In the local demo, rate limits and revoked-session markers use a durable PostgreSQL adapter because Redis is unavailable on this machine. Production rejects this development mode and retains the upstream Redis client. The demo clock is disabled unless `OPSDESK_DEMO=true`.
