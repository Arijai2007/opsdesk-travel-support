import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../backend/dist/generated/prisma/client.js";
import { TravelService } from "../backend/dist/src/travel/travel.service.js";

// Dedicated disposable database only: never populate the application database.
assert(
  process.env.OPSDESK_PROFILE_DATABASE_URL,
  "Set OPSDESK_PROFILE_DATABASE_URL to a local /postgres maintenance connection",
);
const adminUrl = new URL(process.env.OPSDESK_PROFILE_DATABASE_URL);
assert(
  ["127.0.0.1", "localhost"].includes(adminUrl.hostname),
  "Profiling requires local PostgreSQL",
);
assert.equal(
  adminUrl.pathname,
  "/postgres",
  "Connect to the maintenance database",
);
const size = Number(process.env.OPSDESK_PROFILE_BOOKINGS || 6000);
assert(Number.isInteger(size) && size >= 100 && size <= 100000);
const database = `opsdesk_profile_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: adminUrl.href });
const url = new URL(adminUrl);
url.pathname = `/${database}`;
let pool, db;
const output = {
  node: process.version,
  bookings: size,
  cases: size * 3,
  messages: size * 9,
  scenarios: [],
  locks: null,
};
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new pg.Pool({ connectionString: url.href });
  for (const dir of readdirSync(
    new URL("../backend/prisma/migrations/", import.meta.url),
  ).sort()) {
    if (!/^\d/.test(dir) || dir === "20261110021000_profiled_message_reads")
      continue;
    await pool.query(
      readFileSync(
        new URL(
          `../backend/prisma/migrations/${dir}/migration.sql`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  const seed = spawnSync(
    process.execPath,
    ["--import", "tsx", "prisma/seed-travel.ts"],
    {
      cwd: new URL("../backend/", import.meta.url),
      env: { ...process.env, DATABASE_URL: url.href, NODE_ENV: "development" },
      encoding: "utf8",
    },
  );
  assert.equal(seed.status, 0, seed.stderr);
  await pool.query(
    `INSERT INTO "User" (id,email,"passwordHash","firstName","lastName",role,"updatedAt") SELECT 'profile-user-'||i, 'profile-'||i||'@example.invalid','unused','Synthetic',lpad(i::text,6,'0'),'CUSTOMER',NOW() FROM generate_series(1,$1::int) i`,
    [size],
  );
  await pool.query(
    `INSERT INTO "TravelProfile" ("userId",kind,"agencyId",available,specialties) SELECT 'profile-user-'||i,'CUSTOMER',CASE WHEN i%3=0 THEN 'horizon' ELSE 'atlas' END,true,'{}' FROM generate_series(1,$1::int) i`,
    [size],
  );
  await pool.query(
    `INSERT INTO "TravelBooking" (id,reference,"agencyId","customerId","supplierId",destination,region,service,"checkInAt",timezone) SELECT 'profile-booking-'||i,'PROFILE-'||lpad(i::text,6,'0'),CASE WHEN i%3=0 THEN 'horizon' ELSE 'atlas' END,'profile-user-'||i,(SELECT id FROM "TravelSupplier" LIMIT 1),'Synthetic destination',CASE WHEN i%3=0 THEN 'EUROPE' ELSE 'ASIA' END,'Flight',NOW()+interval '1 year','UTC' FROM generate_series(1,$1::int) i`,
    [size],
  );
  await pool.query(
    `INSERT INTO "TravelTicket" (id,reference,title,description,"agencyId","customerId","bookingId",category,status,priority,region,deadline,"createdAt","updatedAt","resolvedAt") SELECT 'profile-ticket-'||i,'PROFILE-CASE-'||i,'Synthetic refund','Synthetic profiling data',b."agencyId",b."customerId",b.id,'REFUND',CASE WHEN i%4=0 THEN 'OPEN' ELSE 'RESOLVED' END,CASE WHEN i%8=0 THEN 'HIGH' ELSE 'LOW' END,b.region,NOW()+interval '1 year',NOW()-interval '2 days',NOW(),CASE WHEN i%4=0 THEN NULL ELSE NOW()-interval '1 day' END FROM generate_series(1,$1::int) i JOIN "TravelBooking" b ON b.id='profile-booking-'||(((i-1)%$2::int)+1)`,
    [size * 3, size],
  );
  await pool.query(
    `INSERT INTO "TravelMessage" (id,"ticketId","senderId",visibility,content,"createdAt") SELECT t.id||'-m-'||i,t.id,CASE WHEN i=1 THEN t."customerId" ELSE 'agent-asia' END,'CUSTOMER','Synthetic message',t."createdAt"+i*interval '1 hour' FROM "TravelTicket" t CROSS JOIN generate_series(1,3) i WHERE t.id LIKE 'profile-ticket-%'`,
  );
  await pool.query("VACUUM ANALYZE");
  db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.href }),
    log: [{ emit: "event", level: "query" }],
  });
  const service = new TravelService(db);
  let queries = [];
  db.$on("query", (event) =>
    queries.push({
      sql: event.query,
      params: JSON.parse(event.params),
      duration: event.duration,
    }),
  );
  output.postgres = (
    await pool.query("SELECT version() AS version")
  ).rows[0].version;
  const scenarios = [
    ["bookings-region", () => service.bookings("agent-asia", {})],
    ["bookings-customer", () => service.bookings("customer-0", {})],
    ["people-manager", () => service.people("manager", {})],
    ["people-regional", () => service.people("agent-asia", {})],
    ["people-supplier", () => service.people("supplier-user", {})],
    ["queue-region", () => service.queue("agent-asia", { tab: "all" })],
    [
      "queue-search",
      () =>
        service.queue("agent-asia", { tab: "all", search: "PROFILE-CASE-100" }),
    ],
    ["insights-region", () => service.insights("agent-asia")],
  ];
  async function measure(label) {
    for (const [name, run] of scenarios) {
      const times = [];
      let sample, captured;
      for (let repeat = 0; repeat < 4; repeat++) {
        queries = [];
        const start = performance.now();
        const value = await run();
        const ms = performance.now() - start;
        if (repeat) times.push(ms);
        sample = value;
        captured = queries;
      }
      const plans = [];
      for (const query of captured) {
        if (
          !query.sql.startsWith("SELECT") &&
          !query.sql.trimStart().startsWith("WITH")
        )
          continue;
        const plan = (
          await pool.query(
            "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query.sql,
            query.params,
          )
        ).rows[0]["QUERY PLAN"][0];
        plans.push({ sql: query.sql, params: query.params, plan });
      }
      output.scenarios.push({
        phase: label,
        name,
        medianMs: times.sort((a, b) => a - b)[1],
        sample,
        plans,
      });
      console.log(label, name, Math.round(times[1]) + "ms");
    }
  }
  await measure("before");
  // Candidate indexes are created only in this disposable database.
  await pool.query(
    readFileSync(
      new URL(
        "../backend/prisma/migrations/20261110021000_profiled_message_reads/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pool.query("VACUUM ANALYZE");
  await measure("after");
  for (const before of output.scenarios.filter((s) => s.phase === "before")) {
    const after = output.scenarios.find(
      (s) => s.phase === "after" && s.name === before.name,
    );
    assert.deepEqual(
      after.sample,
      before.sample,
      `${before.name}: indexes must preserve results`,
    );
  }
  const first = await pool.connect(),
    second = await pool.connect();
  try {
    await first.query("BEGIN");
    await second.query("BEGIN");
    await first.query("SELECT pg_advisory_xact_lock(804204)");
    const started = performance.now();
    const wait = second.query("SELECT pg_advisory_xact_lock(804204)");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await first.query("COMMIT");
    await wait;
    output.locks = {
      globalLockWaitMs: performance.now() - started,
      heldMs: 100,
    };
    await second.query("ROLLBACK");
  } finally {
    first.release();
    second.release();
  }
  const destination =
    process.env.OPSDESK_PROFILE_OUTPUT || ".opsdesk/query-profile.json";
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(output, null, 2));
  console.log("Saved", destination);
} finally {
  await db?.$disconnect();
  await pool?.end();
  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.end();
}
