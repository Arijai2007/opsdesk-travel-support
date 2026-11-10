import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

function assertDisposable(url) {
  const db = new URL(url);
  assert(["localhost", "127.0.0.1"].includes(db.hostname));
  assert(/^\/opsdesk_recovery_target_[a-f0-9]{32}$/.test(db.pathname));
}

function startWorker(databaseUrl) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "--sweep"],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl, OPSDESK_DEMO: "false" },
      timeout: 30000,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  return { child, exited: once(child, "exit") };
}

export async function verifyWorkerRestart(pool, databaseUrl) {
  assertDisposable(databaseUrl);
  const identity = await pool.query("SELECT current_database() AS name");
  assert.equal(identity.rows[0].name, new URL(databaseUrl).pathname.slice(1));
  const { rows } = await pool.query(
    'SELECT id FROM "TravelTicket" ORDER BY id LIMIT 2',
  );
  assert.equal(rows.length, 2);
  const ids = rows.map(({ id }) => id);
  await pool.query(`UPDATE "TravelTicket" SET status='CLOSED'`);
  await pool.query(
    `DELETE FROM "TravelEvent" WHERE "ticketId" = ANY($1) AND kind='ESCALATED'`,
    [ids],
  );
  await pool.query(
    `UPDATE "TravelTicket" SET status='OPEN',priority='LOW',
    deadline=now()-interval '2 days',"responseDeadline"=now()-interval '2 days'
    WHERE id = ANY($1)`,
    [ids],
  );
  await pool.query("CREATE TABLE restart_gate (id text PRIMARY KEY)");
  await pool.query("INSERT INTO restart_gate VALUES ($1)", [ids[1]]);
  // The second ticket has inserted its event but has yet to commit its priority.
  await pool.query(`CREATE FUNCTION pause_priority() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT FROM restart_gate WHERE id=NEW.id) THEN
        PERFORM pg_advisory_xact_lock(804205);
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER pause_priority BEFORE UPDATE OF priority ON "TravelTicket"
    FOR EACH ROW EXECUTE FUNCTION pause_priority()`);
  const gate = await pool.connect();
  const state = async () =>
    (
      await pool.query(
        `
    SELECT t.priority, count(e.id)::int AS alerts FROM "TravelTicket" t
    LEFT JOIN "TravelEvent" e ON e."ticketId"=t.id AND e.kind='ESCALATED'
    WHERE t.id=ANY($1) GROUP BY t.id ORDER BY t.id`,
        [ids],
      )
    ).rows;
  const committed = { priority: "URGENT", alerts: 1 };
  const pending = { priority: "LOW", alerts: 0 };
  let worker;
  try {
    await gate.query("SELECT pg_advisory_lock(804205)");
    worker = startWorker(databaseUrl);
    const deadline = Date.now() + 15000;
    for (;;) {
      const result = await gate.query(`SELECT EXISTS (
        SELECT FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=804205
        AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND NOT granted
      ) AS waiting`);
      if (result.rows[0].waiting) break;
      assert(
        worker.child.exitCode === null && Date.now() < deadline,
        "Worker did not reach the interrupted transaction",
      );
      await delay(40);
    }
    assert.deepEqual(await state(), [committed, pending]);
    assert(worker.child.kill("SIGKILL"));
    await worker.exited;
  } finally {
    if (
      worker &&
      worker.child.exitCode === null &&
      worker.child.signalCode === null
    ) {
      worker.child.kill("SIGKILL");
      await worker.exited;
    }
    try {
      await gate.query("SELECT pg_advisory_unlock(804205)");
    } finally {
      gate.release();
    }
  }
  // Wait for the dead connection's row locks to clear before checking rollback.
  await pool.query('SELECT id FROM "TravelTicket" WHERE id=$1 FOR UPDATE', [
    ids[1],
  ]);
  assert.deepEqual(await state(), [committed, pending]);
  const [code] = await startWorker(databaseUrl).exited;
  assert.equal(code, 0, "Replacement worker failed");
  assert.deepEqual(await state(), [committed, committed]);
}

if (
  process.argv[2] === "--sweep" &&
  process.argv[1] === fileURLToPath(import.meta.url)
) {
  assertDisposable(process.env.DATABASE_URL);
  const { PrismaService } =
    await import("../backend/dist/prisma/prisma.service.js");
  const { TravelService } =
    await import("../backend/dist/src/travel/travel.service.js");
  const db = new PrismaService();
  try {
    await new TravelService(db).sweep();
  } finally {
    await db.$disconnect();
  }
}
