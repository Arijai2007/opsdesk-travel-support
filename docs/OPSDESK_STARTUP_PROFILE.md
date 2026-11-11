# Synthetic API process-start profiling

`npm run ops:startup-profile` compares the first authenticated workload GET after a new API process starts with repeat reads in that same process. It is an application process-start experiment, not a full cold-cache test. PostgreSQL buffers, OS page caches and network effects are not controlled; login and readiness requests happen before the measured workload GET. The frontend is not measured.

## Run locally

Use Node 22.23.x and a dedicated loopback PostgreSQL test instance. Install dependencies, generate Prisma and build the backend from the current checkout first. The profiler checks that the built entry exists; it does not rebuild stale artifacts automatically.

```text
npm ci
npm run prisma:generate
npm run build --workspace=packages/shared
npm run build --workspace=backend
```

For the existing embedded development instance, `npm run ops:setup` prepares ignored local configuration and `npm run ops:db` starts PostgreSQL in a separate terminal. Set the following maintenance URL using that instance's actual local user, URL-encoded password and port from `backend/.env`. Change the database path to `/postgres`.

```powershell
$env:OPSDESK_STARTUP_DATABASE_URL = 'postgresql://opsdesk:<local-password>@127.0.0.1:55432/postgres'
npm run ops:startup-profile
```

The role needs permission to create databases. The command rejects non-PostgreSQL URLs, non-loopback hosts, database paths other than `/postgres`, and query/fragment options. It does not overwrite `.env` or use the existing application database. Run benchmarks sequentially to avoid resource contention affecting interpretation.

## Procedure and controls

1. Create one uniquely named disposable template database, apply the repository migrations and seed the standard synthetic data.
2. For each selected role/round, clone the template into a separate run-owned database and launch a new backend process on an available loopback port. The process starts in an empty run directory, with generated JWT secrets, demo/local-counter settings and no inherited provider credentials or caller runtime flags.
3. Poll `/health/ready` every 100 ms, then log in as the seeded role. Record spawn-to-readiness and login times separately. No workload preflight is performed.
4. Measure the first scoped workload GET and the configured sequential repeat reads. Validate HTTP success, paged output and stable scoped totals. Record the role/path, PID, returned/total item counts and repeat p50/p95/max.
5. Stop only the API process started for that probe, then drop its database. After all probes, remove the template and verify the run's database namespace is empty. Only then print/write a success report. Interruption requests trigger the same cleanup; failures do not publish a success report.

The profiler never terminates other PostgreSQL clients or drops a caller-selected database. Cleanup accepts only names generated inside that run's namespace. Existing application records are not used as fixtures. Logs and the success `report.json` remain under ignored `.opsdesk/startup/<run>/`; reports contain timings/counts, not credentials or complaint rows. Keep diagnostic logs out of Git.

| Variable | Default | Supported values |
| --- | --- | --- |
| `OPSDESK_STARTUP_ROLES` | all five roles | Unique comma-separated selection from `manager,agency,customer,agent,supplier,supplier-history`. The default runs the first five. |
| `OPSDESK_STARTUP_ROUNDS` | 2 | Integer 1–5. Each role gets a new process/database per round. |
| `OPSDESK_STARTUP_REPEATS` | 10 | Integer 1–50, after the first measured GET. |
| `OPSDESK_STARTUP_READY_SECONDS` | 30 | Integer 1–180. Increase on slower local hosts and report the configured timeout. |

Manager and agent probe their scoped queue; agency and customer probe scoped bookings; supplier probes its conversation list. When the supplier role is selected, the disposable template adds 24 conversations for the seeded Aster supplier and one for another supplier. Each measured read must return a full first page, the expected scoped total, and only Aster records. This measures a populated supplier list. Select `supplier-history` to start a separate API process and read page 12 of a 240-message supplier thread. The profiler checks the page, total, message visibility and thread membership on each timed read. After timing, it checks that requesting the other supplier history returns HTTP 404.

Readiness timing includes process/module initialization, local connection setup, readiness SQL and polling delay. Authentication warms some application/database state before the first workload GET. Repeat samples reuse the same API and authenticated session. Background initialization and shared host activity can affect observations. Small samples and two rounds cannot establish performance targets, percentiles at production scale or a causal cache improvement. Representative booking and identity distributions, controlled database and OS caches, and approved targets remain separate acceptance work.

`npm run ops:test:startup-profile` checks URL/sample bounds, generated database names and runtime environment isolation. It also runs in the standard API command. CI runs a bounded manager, supplier-list and supplier-history integration smoke with one round and two repeats after the existing API/load fixtures. See [recorded local evidence](OPSDESK_VALIDATION.md#api-process-start-profile---11-november-2026). Deployment remains paused.
