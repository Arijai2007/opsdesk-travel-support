# OpsDesk logical recovery rehearsal

This is an automated synthetic rehearsal for issue #3. It does not back up, modify or restore an existing application database, and it does not certify production disaster recovery.

## Run

Use Node.js 22.23.x, installed project dependencies and a local PostgreSQL maintenance account with CREATE DATABASE permission. Install PostgreSQL client utilities compatible with the server (PostgreSQL 18 for the current demo). The embedded server package does not include pg_dump or pg_restore.

Set `OPSDESK_RECOVERY_DATABASE_URL` to a local `/postgres` maintenance connection. Keep credentials in your local shell or secret storage; do not paste them into tickets or commit them. Then run:

```text
npm run prisma:generate --workspace=backend
npm run build --workspace=backend
node --test scripts/recovery-safety.test.mjs
npm run ops:recovery
```

Use `OPSDESK_PG_DUMP` and `OPSDESK_PG_RESTORE` for explicit executable paths when the tools are not on PATH. CI sets `OPSDESK_RECOVERY_CONTAINER` to its PostgreSQL service's exact container ID and runs the matching utilities inside that container. This optional container mode still uses a localhost maintenance connection for SQL. The password is passed through environment variables rather than command arguments.

The script rejects non-local hosts, non-maintenance databases, non-PostgreSQL URLs, query options and URL fragments before attempting a connection. It creates only two randomly named databases with the `opsdesk_recovery_` prefix, applies all Prisma migrations to the source and seeds the standard synthetic workspace. It never reads the application `.env` or selects an existing application database.

## Checks performed

1. Validate prerequisites before creating databases.
2. Apply migrations and confirm the synthetic source has 60 cases.
3. Create a custom-format logical archive using pg_dump.
4. Read back the saved archive and verify SHA-256.
5. Restore into the separate empty target with pg_restore using one transaction and exit-on-error.
6. Compare every public table's row count and canonical row-content checksum, plus index definitions and constraints.
7. Confirm restored unique and foreign-key constraints reject invalid writes, and that the rejected writes leave the target contents unchanged.
8. On the disposable restored target, interrupt a worker after one ticket commits and the next has an uncommitted event. Kill the process, verify rollback, then start a replacement and require one committed escalation per ticket.
9. Close connections and drop only databases created by this invocation; delete its temporary archive.

A summary without connection strings, row contents or password hashes is saved at `.opsdesk/recovery/latest-report.json` (ignored by Git). It includes table counts and timings. The temporary archive is private to the local filesystem and deleted after the test. It is not a retained operational backup. A forced process termination can leave generated databases or an archive: inspect the exact generated names before removing leftovers; never replace a real database with a rehearsal target.

## Production recovery work still required

- Select and configure a real backup service, encrypted backup storage, restricted access, retention and alerting.
- Define recovery-point and recovery-time targets with the owner; observed fixture timings are not service commitments.
- Rehearse restore using authorized staging data and the actual production roles, extensions, configuration, size and restore destination.
- Account for roles, server configuration, external files/attachments and secrets. This rehearsal compares public application tables, indexes and constraints; it is not cluster-wide recovery, point-in-time recovery or crash recovery.
- Independently test backup corruption, unavailable storage, insufficient disk, interruption and recovery procedures. The current checksum check establishes archive readback integrity, not resilience to every failure.
- Put the restored service behind a controlled cutover, verify access boundaries and end-to-end workflows, and assign recovery/incident ownership.
- Never use this disposable-fixture command as an operational restore command.

PostgreSQL references: [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html). Custom archives require pg_restore; restore options deliberately omit ownership/ACL recreation for the disposable target.
