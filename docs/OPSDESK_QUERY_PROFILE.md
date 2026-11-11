# OpsDesk query profile - 10 November 2026

## Scope and method

Reviewed PR #15 (`d75efbb`) and upstream main before implementation. PR #15 merged during validation; latest main `f865ea9` was fetched and reviewed, and this follow-up was rebased onto it. The merge adds no source changes beyond the tested directory baseline. No production deployment is included.

Measured locally on Windows, Node.js 22.23.0 and embedded PostgreSQL 18.6. Every run creates a separate randomly named database on explicitly supplied local PostgreSQL, applies migrations, seeds demo records, then adds 6,000 customers/bookings, 18,000 cases and 54,000 customer-visible messages. Cases have three messages each, two thirds are ASIA, and one quarter remain open. The demo's original 30 bookings, 60 cases and other history remain too. This is a repeatable medium synthetic workload, not representative production traffic or a throughput certification.

The harness calls the actual compiled TravelService directory, queue and reporting methods. One warm-up plus three timed reads per scenario produce the medians below. It captures each SQL statement/parameters and EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), and compares complete before/after index results. VACUUM ANALYZE makes the final comparison a read-heavy steady-state run. Counts, people page IDs and report values remain unchanged by index installation. The full HTTP suite separately checks the rewritten authorization against legacy directory results for seven seeded account scopes.

## Measurements

Service-read medians in milliseconds, excluding HTTP/auth transport. Baseline and final are separate runs, so small differences are noise rather than claimed improvements.

| Scenario | Baseline PR #15 | Final query + index |
| --- | ---: | ---: |
| bookings-region | 13.4 | 6.0 |
| bookings-customer | 6.3 | 3.9 |
| people-manager | 67.8 | 28.8 |
| people-regional | 197.9 | 26.4 |
| people-supplier | 29.6 | 13.4 |
| queue-region | 19.4 | 15.0 |
| queue-search | 27.1 | 22.0 |
| insights-region | 164.4 | 75.8 |

The regional people count/page plans previously repeated supplier/case checks for each of roughly 6,000 profiles: the observed thread branch scanned conversations 2,017 times and checked tickets 24,204 times per query. Replacing correlated OR/EXISTS with a materialized UNION of authorized IDs reduced plan shared-buffer hits from 152,906 to 879 per count/page query. Separate runs measured approximately 198 ms before and 27 ms after the query rewrite. The exact same self, staff, scoped booking/customer and supplier-thread participant rules remain in place; UNION removes duplicate IDs before paging. Name/kind filters, count and rows all use that authorized set.

For reporting, a same-run vacuumed index comparison measured 135 ms before and 76 ms after adding `(ticketId, visibility, createdAt, id, senderId)` on TravelMessage. It supports ordered customer-message reads and covers the sender lookup key. The original ticket/time index remains because other visibility-free reads still use it. This adds storage and write cost; no write-throughput improvement is claimed. Index creation takes a table write lock with this ordinary migration: rehearse duration and schedule an appropriate migration window on a staging restore before live use.

Queue search still scans the authorized regional cases and joined names/references; substring searches and live counts remain linear. No queue index was added without evidence that it would help these predicates. Reporting still examines the scoped history and issues one first-reply lookup per case. Incremental reporting, deeper history and heavily updated visibility maps need further measurement.

## Lock assessment

The routing/escalation helper acquires global advisory transaction lock 804204. A controlled two-connection probe held it for 100 ms; the second connection waited about 104 ms in the baseline run. This demonstrates shared serialization, not measured production contention. No lock scope changed. A replacement needs multi-worker tests for capacity assignment, simultaneous bookings and escalation idempotency, plus a consistent lock ordering/retry policy. Splitting this lock casually could violate routing capacity or duplicate alerts.

## Repeat

Use the pinned Node.js 22.23.x runtime. Install dependencies, generate Prisma and build backend first (`npm ci`, `npm run prisma:generate`, `npm run build --workspace=backend`). Start a local PostgreSQL server. Set `OPSDESK_PROFILE_DATABASE_URL` to its maintenance `/postgres` connection using a local account with CREATE DATABASE permission; remote hosts and non-maintenance URLs are rejected. Then run `npm run ops:profile`.

The script runs no HTTP server and never populates the application database. Its disposable database is dropped in finally. An interrupted/killed process may leave a database named `opsdesk_profile_<random UUID>` for manual cleanup. Set `OPSDESK_PROFILE_BOOKINGS` (100-100000; default 6000) to change volume, and `OPSDESK_PROFILE_OUTPUT` to choose the JSON output (default `.opsdesk/query-profile.json`). Reports contain synthetic SQL parameters/results; do not repurpose this harness with real data. It deliberately installs the new covering index between its before/after phases, so the before phase uses the current people query without that index. To reproduce the old people query baseline, run the harness with the backend built from PR #15 before applying the query rewrite.

The detailed JSON traces from this investigation were saved as local profiling artifacts. Re-run on target hardware with representative skew, longer message histories, deep pages, cold caches and concurrent readers/writers before choosing latency or throughput targets.

## Message shared-buffer experiment

On a local PostgreSQL 18 instance with the bundled `pg_buffercache` extension, use a superuser maintenance connection to run the optional experiment. Start with the setup above.

```powershell
$env:OPSDESK_PROFILE_MESSAGE_BUFFERS = '1'
npm run ops:profile
```

The profiler adds 1,200 messages to one disposable synthetic case and captures the actual manager page-60 SQL after installing the current covering index. For each of three pairs it evicts only the message table and its indexes in that generated database, checks that a second eviction removes zero blocks, and explains the same SQL twice. The JSON report includes shared reads, hits, row counts and execution time. It records the number of skipped and flushed buffers. A skipped eviction or an evicted run with no shared reads fails the experiment.

The operating-system page cache and unrelated PostgreSQL relations stay outside this measurement. Query capture and fixture preparation happen before eviction. Execution timing covers one SQL statement and excludes authentication, HTTP and the rest of the application workload. [PostgreSQL buffer eviction](https://www.postgresql.org/docs/18/pgbuffercache.html) · [Observed results](OPSDESK_VALIDATION.md#message-shared-buffer-experiment)
