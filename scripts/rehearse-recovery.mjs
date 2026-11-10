import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { verifyWorkerRestart } from "./worker-restart.mjs";

// A rehearsal, never a command for backing up or replacing operational databases.
assert(
  process.env.OPSDESK_RECOVERY_DATABASE_URL,
  "Set OPSDESK_RECOVERY_DATABASE_URL to a local /postgres maintenance connection",
);
const maintenance = new URL(process.env.OPSDESK_RECOVERY_DATABASE_URL || "");
assert(
  ["127.0.0.1", "localhost"].includes(maintenance.hostname),
  "Use local PostgreSQL only",
);
assert.equal(maintenance.pathname, "/postgres", "Use the maintenance database");
assert(
  ["postgres:", "postgresql:"].includes(maintenance.protocol),
  "Use a PostgreSQL connection URL",
);
assert.equal(
  maintenance.search,
  "",
  "Connection URL options are not permitted",
);
assert.equal(
  maintenance.hash,
  "",
  "Connection URL fragments are not permitted",
);
const container = process.env.OPSDESK_RECOVERY_CONTAINER;
if (container)
  assert(
    /^[a-f0-9]{12,64}$/.test(container),
    "Expected a Docker service container ID",
  );
const token = randomUUID().replaceAll("-", "");
const source = `opsdesk_recovery_source_${token}`,
  target = `opsdesk_recovery_target_${token}`;
const created = [];
const admin = new pg.Pool({ connectionString: maintenance.href });
let sourcePool, targetPool;
const directory = resolve(".opsdesk/recovery");
mkdirSync(directory, { recursive: true });
const archive = resolve(directory, `${token}.dump`);
let archiveCreated = false;
const started = performance.now();
const report = {
  node: process.version,
  kind: "synthetic-logical-recovery",
  checks: [],
};
const check = (name) => report.checks.push(name);
function connection(database) {
  const value = new URL(maintenance);
  value.pathname = `/${database}`;
  return value.href;
}
function runNode(args, database) {
  const r = spawnSync(process.execPath, args, {
    cwd: new URL("../backend/", import.meta.url),
    env: {
      ...process.env,
      DATABASE_URL: connection(database),
      NODE_ENV: "development",
    },
    encoding: "utf8",
    timeout: 120000,
  });
  assert.equal(
    r.status,
    0,
    "Fixture migration/seed failed; inspect the disposable database locally",
  );
}
function tool(name, database, input) {
  const args = [
    "--host=127.0.0.1",
    `--port=${container ? "5432" : maintenance.port || "5432"}`,
    `--username=${decodeURIComponent(maintenance.username)}`,
    `--dbname=${database}`,
  ];
  if (name === "pg_dump") args.push("--format=custom", "--no-acl");
  else
    args.push(
      "--single-transaction",
      "--exit-on-error",
      "--no-owner",
      "--no-acl",
    );
  const executable = container
    ? "docker"
    : process.env[
        name === "pg_dump" ? "OPSDESK_PG_DUMP" : "OPSDESK_PG_RESTORE"
      ] || name;
  const commandArgs = container
    ? [
        "exec",
        ...(input ? ["-i"] : []),
        "-e",
        "PGPASSWORD",
        container,
        name,
        ...args,
      ]
    : args;
  const result = spawnSync(executable, commandArgs, {
    input,
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(maintenance.password),
    },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120000,
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `${name} failed; install matching PostgreSQL clients or use the CI service container`,
  );
  return result.stdout;
}
async function snapshot(pool) {
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const result = {};
  for (const { tablename } of tables.rows) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = await pool.query(
      `SELECT to_jsonb(t)::text AS row FROM public.${quoted} t ORDER BY 1`,
    );
    const hash = createHash("sha256");
    for (const row of rows.rows) hash.update(row.row + "\n");
    result[tablename] = { count: rows.rowCount, sha256: hash.digest("hex") };
  }
  const constraints = await pool.query(
    "SELECT c.conname, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY 1,2",
  );
  const indexes = await pool.query(
    "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1",
  );
  return {
    tables: result,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
}
try {
  // Check client availability before creating fixtures, without exposing connection strings.
  for (const name of ["pg_dump", "pg_restore"]) {
    const exe = container
      ? "docker"
      : process.env[
          name === "pg_dump" ? "OPSDESK_PG_DUMP" : "OPSDESK_PG_RESTORE"
        ] || name;
    const args = container
      ? ["exec", container, name, "--version"]
      : ["--version"];
    assert.equal(
      spawnSync(exe, args, { windowsHide: true, timeout: 15000 }).status,
      0,
      `Missing ${name}; see docs/OPSDESK_RECOVERY.md`,
    );
  }
  for (const name of [source, target]) {
    await admin.query(`CREATE DATABASE "${name}"`);
    created.push(name);
  }
  sourcePool = new pg.Pool({ connectionString: connection(source) });
  targetPool = new pg.Pool({ connectionString: connection(target) });
  runNode(
    ["../node_modules/prisma/build/index.js", "migrate", "deploy"],
    source,
  );
  runNode(["--import", "tsx", "prisma/seed-travel.ts"], source);
  const before = await snapshot(sourcePool);
  assert.equal(before.tables.TravelTicket.count, 60);
  check("fresh migrations and 60-case synthetic seed");
  const dumpStarted = performance.now();
  const bytes = tool("pg_dump", source);
  assert(bytes.length > 0);
  writeFileSync(archive, bytes, { flag: "wx", mode: 0o600 });
  archiveCreated = true;
  report.dumpMs = Math.round(performance.now() - dumpStarted);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const saved = readFileSync(archive);
  assert.equal(createHash("sha256").update(saved).digest("hex"), digest);
  check("archive readback checksum");
  const restoreStarted = performance.now();
  tool("pg_restore", target, saved);
  report.restoreMs = Math.round(performance.now() - restoreStarted);
  assert.deepEqual(await snapshot(targetPool), before);
  check("all public table contents, indexes and constraints match");
  await assert.rejects(
    targetPool.query(
      `INSERT INTO "TravelAgency" (id,name,code) VALUES ('recovery-duplicate','Synthetic duplicate','ATL')`,
    ),
    (e) => e.code === "23505",
  );
  check("restored unique constraint rejects duplicate agency code");
  await assert.rejects(
    targetPool.query(
      `INSERT INTO "TravelMessage" (id,"ticketId","senderId",visibility,content) VALUES ('recovery-orphan','missing','manager','INTERNAL','Synthetic orphan')`,
    ),
    (e) => e.code === "23503",
  );
  check("restored foreign key rejects orphan message");
  assert.deepEqual(await snapshot(targetPool), before);
  check("rejected writes leave restored contents unchanged");
  await verifyWorkerRestart(targetPool, connection(target));
  check(
    "worker process termination rolls back the interrupted ticket and restart completes both exactly once",
  );
  report.elapsedMs = Math.round(performance.now() - started);
  report.tables = Object.fromEntries(
    Object.entries(before.tables).map(([name, value]) => [name, value.count]),
  );
  // No credentials, row contents or password hashes are written to the report.
  writeFileSync(
    resolve(directory, "latest-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await Promise.all([sourcePool?.end(), targetPool?.end()]);
  try {
    for (const name of created) {
      assert(/^opsdesk_recovery_(source|target)_[a-f0-9]{32}$/.test(name));
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
    if (archiveCreated) unlinkSync(archive);
  }
}
