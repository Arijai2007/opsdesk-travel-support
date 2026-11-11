import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const supplierHistory = {
  conversation: "startup-supplier-user-1",
  otherConversation: "startup-supplier-other-1",
  total: 240,
  page: 12,
};

const scenarios = {
  manager: ["manager", "/ops/queue?tab=all&page=1"],
  agency: ["agency", "/ops/bookings?page=1"],
  customer: ["maya", "/ops/bookings?page=1"],
  agent: ["asia", "/ops/queue?tab=all&page=1"],
  supplier: ["supplier", "/ops/conversations?page=1"],
  "supplier-history": [
    "supplier",
    `/ops/conversations/${supplierHistory.conversation}/messages?page=${supplierHistory.page}`,
  ],
};

export function startupConfig(env) {
  let maintenance;
  try {
    maintenance = new URL(env.OPSDESK_STARTUP_DATABASE_URL);
  } catch {
    throw new Error(
      "Set OPSDESK_STARTUP_DATABASE_URL to a local /postgres maintenance connection.",
    );
  }
  assert(
    ["postgres:", "postgresql:"].includes(maintenance.protocol),
    "Use PostgreSQL.",
  );
  assert(
    ["127.0.0.1", "localhost"].includes(maintenance.hostname),
    "Use local PostgreSQL only.",
  );
  assert.equal(
    maintenance.pathname,
    "/postgres",
    "Use the /postgres maintenance database.",
  );
  assert(
    !maintenance.search && !maintenance.hash,
    "Connection options/fragments are not permitted.",
  );
  const integer = (name, fallback, max) => {
    const value = Number(env[name] ?? fallback);
    assert(
      Number.isInteger(value) && value >= 1 && value <= max,
      `${name} must be 1 through ${max}.`,
    );
    return value;
  };
  const roles =
    env.OPSDESK_STARTUP_ROLES === undefined
      ? Object.keys(scenarios).filter((role) => role !== "supplier-history")
      : env.OPSDESK_STARTUP_ROLES.split(",").map((role) => role.trim());
  assert(
    roles.length &&
      roles.every((role) => Object.hasOwn(scenarios, role)) &&
      new Set(roles).size === roles.length,
    "Choose unique startup roles: manager, agency, customer, agent, supplier, supplier-history.",
  );
  return {
    maintenance,
    roles,
    rounds: integer("OPSDESK_STARTUP_ROUNDS", 2, 5),
    repeats: integer("OPSDESK_STARTUP_REPEATS", 10, 50),
    readySeconds: integer("OPSDESK_STARTUP_READY_SECONDS", 30, 180),
  };
}

export function startupDatabase(run, slot) {
  assert(/^[a-f0-9]{32}$/.test(run), "Invalid profiler run ID.");
  assert(
    /^(template|probe_\d{1,2})$/.test(slot),
    "Invalid profiler database slot.",
  );
  return `opsdesk_startup_${run}_${slot}`;
}

export function startupEnvironment(inherited, databaseUrl, port) {
  // Preserve OS plumbing, never provider credentials or caller runtime settings.
  const env = Object.fromEntries(
    [
      "PATH",
      "Path",
      "SystemRoot",
      "WINDIR",
      "ComSpec",
      "COMSPEC",
      "PATHEXT",
      "TEMP",
      "TMP",
      "HOME",
      "USERPROFILE",
    ]
      .filter((key) => inherited[key] !== undefined)
      .map((key) => [key, inherited[key]]),
  );
  return {
    ...env,
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    FRONTEND_URL: "http://127.0.0.1:3000",
    OPSDESK_DEMO: "true",
    OPSDESK_LOCAL_COUNTERS: "true",
    OPSDESK_MAIL_SYNTHETIC: "false",
    JWT_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  };
}

function summarize(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const at = (fraction) =>
    +sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2);
  return {
    samples: sorted.length,
    p50Ms: at(0.5),
    p95Ms: at(0.95),
    maxMs: at(1),
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function profileStartup(env = process.env) {
  const config = startupConfig(env);
  const entry = fileURLToPath(
    new URL("../backend/dist/src/main.js", import.meta.url),
  );
  assert(existsSync(entry), "Build the backend before profiling startup.");
  const require = createRequire(
    new URL("../backend/package.json", import.meta.url),
  );
  const run = randomUUID().replaceAll("-", "");
  const template = startupDatabase(run, "template");
  const directory = fileURLToPath(
    new URL(`../.opsdesk/startup/${run}/`, import.meta.url),
  );
  mkdirSync(directory, { recursive: true });
  const admin = new pg.Pool({
    connectionString: config.maintenance.href,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  const created = new Set();
  const processes = new Set();
  const abort = new AbortController();
  const interrupt = () =>
    abort.abort(new Error("Startup profiling interrupted."));
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const connection = (name) => {
    const url = new URL(config.maintenance);
    url.pathname = `/${name}`;
    return url.href;
  };
  const report = {
    kind: "synthetic-api-process-startup",
    node: process.version,
    cacheState: {
      api: "new process for every probe",
      postgres: "not reset or controlled",
      os: "not reset or controlled",
      authentication: "performed before the first measured workload GET",
      frontend: "not measured",
    },
    rounds: config.rounds,
    repeatReads: config.repeats,
    readinessEndpoint: "/health/ready",
    readinessPollMs: 100,
    readinessTimeoutSeconds: config.readySeconds,
    roles: config.roles,
    probes: [],
    acceptance:
      "Observations only; no cold-cache or performance-target acceptance.",
  };
  async function drop(name) {
    assert(
      name === template ||
        Array.from({ length: config.roles.length * config.rounds }, (_, i) =>
          startupDatabase(run, `probe_${i}`),
        ).includes(name),
      "Refusing to drop an unowned database.",
    );
    for (let attempt = 0; ; attempt++) {
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
        created.delete(name);
        return;
      } catch (error) {
        if (error.code !== "55006" || attempt === 4) throw error;
        await delay(250);
      }
    }
  }
  async function stop(owned) {
    if (!owned.exited) owned.child.kill("SIGTERM");
    await Promise.race([owned.stopped, delay(5000, undefined, { ref: false })]);
    if (!owned.exited) {
      owned.child.kill("SIGKILL");
      await Promise.race([
        owned.stopped,
        delay(5000, undefined, { ref: false }),
      ]);
    }
    assert(
      owned.exited,
      "An owned API process did not stop; cleanup is incomplete.",
    );
    processes.delete(owned);
  }
  function fixtureCommand(args, label) {
    abort.signal.throwIfAborted();
    const result = spawnSync(process.execPath, args, {
      cwd: new URL("../backend/", import.meta.url),
      env: startupEnvironment(env, connection(template), 0),
      encoding: "utf8",
      timeout: 120000,
      windowsHide: true,
    });
    writeFileSync(
      resolve(directory, `${label}.log`),
      (result.stdout || "") + (result.stderr || ""),
    );
    assert.equal(
      result.status,
      0,
      `Synthetic ${label} failed; inspect the ignored startup log.`,
    );
  }
  let failure;
  try {
    await admin.query(`CREATE DATABASE "${template}"`);
    created.add(template);
    fixtureCommand(
      [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
      "migrate",
    );
    fixtureCommand(
      [require.resolve("tsx/cli"), "prisma/seed-travel.ts"],
      "seed",
    );
    let supplierScope;
    const fixture = new pg.Pool({ connectionString: connection(template) });
    try {
      if (
        config.roles.includes("supplier") ||
        config.roles.includes("supplier-history")
      ) {
        const inserted = await fixture.query(`
          INSERT INTO "TravelConversation"
            (id, "ticketId", "supplierId", subject, "dueAt", "createdAt")
          SELECT 'startup-' || p."userId" || '-' || i, linked.id, p."supplierId",
                 'Synthetic startup conversation ' || i,
                 now() + interval '1 year', now() - i * interval '1 minute'
          FROM "TravelProfile" p
          JOIN LATERAL (
            SELECT t.id FROM "TravelTicket" t
            JOIN "TravelBooking" b ON b.id = t."bookingId"
            WHERE b."supplierId" = p."supplierId"
            ORDER BY t.id
            LIMIT 1
          ) linked ON true
          CROSS JOIN LATERAL generate_series(
            1, CASE WHEN p."userId" = 'supplier-user' THEN 24 ELSE 1 END
          ) i
          WHERE p.kind = 'SUPPLIER' AND p.status = 'ACTIVE'
            AND p."userId" IN ('supplier-user', 'supplier-other')
        `);
        assert.equal(
          inserted.rowCount,
          25,
          "Expected 24 supplier conversations and one other-supplier fixture.",
        );
        supplierScope = (
          await fixture.query(`
          SELECT p."supplierId", count(c.id)::int total
          FROM "TravelProfile" p
          JOIN "TravelConversation" c ON c."supplierId" = p."supplierId"
          WHERE p."userId" = 'supplier-user'
          GROUP BY p."supplierId"
        `)
        ).rows[0];
      }
      if (config.roles.includes("supplier-history")) {
        const messages = await fixture.query(
          `
          INSERT INTO "TravelMessage"
            (id, "ticketId", "conversationId", "senderId", visibility, content, "createdAt")
          SELECT c.id || '-message-' || i, c."ticketId", c.id, 'manager', 'SUPPLIER',
                 'Synthetic startup history ' || i, now() - i * interval '1 minute'
          FROM "TravelConversation" c
          CROSS JOIN LATERAL generate_series(1, CASE WHEN c.id = $1 THEN $3::int ELSE 1 END) i
          WHERE c.id IN ($1, $2)
        `,
          [
            supplierHistory.conversation,
            supplierHistory.otherConversation,
            supplierHistory.total,
          ],
        );
        assert.equal(
          messages.rowCount,
          supplierHistory.total + 1,
          "Expected supplier history and a separate supplier message.",
        );
      }
      report.dataset = (
        await fixture.query(
          `SELECT (SELECT count(*) FROM "TravelBooking")::int bookings, (SELECT count(*) FROM "TravelTicket")::int cases, (SELECT count(*) FROM "TravelMessage")::int messages, (SELECT count(*) FROM "TravelConversation")::int conversations`,
        )
      ).rows[0];
      report.postgres = (
        await fixture.query("SHOW server_version")
      ).rows[0].server_version;
    } finally {
      await fixture.end();
    }
    let sequence = 0;
    for (let round = 1; round <= config.rounds; round++)
      for (const role of config.roles) {
        abort.signal.throwIfAborted();
        const database = startupDatabase(run, `probe_${sequence++}`);
        for (let attempt = 0; ; attempt++) {
          try {
            await admin.query(
              `CREATE DATABASE "${database}" TEMPLATE "${template}"`,
            );
            break;
          } catch (error) {
            if (error.code !== "55006" || attempt === 4) throw error;
            await delay(250);
          }
        }
        created.add(database);
        const port = await freePort();
        const base = `http://127.0.0.1:${port}`;
        const started = performance.now();
        // Empty cwd prevents ConfigModule from reading a caller's backend/.env.
        const child = spawn(process.execPath, [entry], {
          cwd: directory,
          env: startupEnvironment(env, connection(database), port),
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
        const owned = { child, exited: false };
        owned.stopped = new Promise((resolve) => {
          child.once("exit", () => {
            owned.exited = true;
            resolve();
          });
          child.once("error", () => {
            owned.exited = true;
            resolve();
          });
        });
        processes.add(owned);
        let logs = "";
        const capture = (chunk) => {
          logs = (logs + chunk.toString()).slice(-64000);
        };
        child.stdout.on("data", capture);
        child.stderr.on("data", capture);
        try {
          let ready = false;
          while (performance.now() - started < config.readySeconds * 1000) {
            abort.signal.throwIfAborted();
            assert(
              !owned.exited,
              "Owned API exited before readiness; inspect the ignored startup log.",
            );
            try {
              const response = await fetch(base + "/health/ready", {
                signal: AbortSignal.any([
                  abort.signal,
                  AbortSignal.timeout(1000),
                ]),
              });
              if (response.status === 200) {
                await response.json();
                ready = true;
                break;
              }
              await response.arrayBuffer();
            } catch {
              abort.signal.throwIfAborted();
            }
            await delay(100);
          }
          assert(
            ready && !owned.exited,
            `Owned API did not become ready in ${config.readySeconds} seconds.`,
          );
          const readyMs = performance.now() - started;
          const [account, path] = scenarios[role];
          const loginStarted = performance.now();
          const login = await fetch(base + "/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: `${account}@opsdesk.demo`,
              password: "OpsDeskDemo!2026",
            }),
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
          });
          assert.equal(login.status, 200, "Synthetic login failed.");
          const { accessToken } = await login.json();
          const loginMs = performance.now() - loginStarted;
          let total;
          const read = async () => {
            abort.signal.throwIfAborted();
            assert(!owned.exited, "Owned API exited during the probe.");
            const before = performance.now();
            const response = await fetch(base + path, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.any([
                abort.signal,
                AbortSignal.timeout(10000),
              ]),
            });
            assert.equal(response.status, 200, `${role} workload GET failed.`);
            const body = await response.json();
            assert(
              Array.isArray(body.items),
              "Expected a paged scoped workload response.",
            );
            if (role === "supplier") {
              assert.equal(
                body.total,
                supplierScope.total,
                "Unexpected supplier conversation total.",
              );
              assert.equal(
                body.items.length,
                20,
                "Expected a full first supplier page.",
              );
              assert(
                body.items.every(
                  (item) => item.supplierId === supplierScope.supplierId,
                ),
                "Supplier startup returned a conversation from another supplier.",
              );
            }
            if (role === "supplier-history") {
              assert.equal(
                body.total,
                supplierHistory.total,
                "Unexpected supplier history total.",
              );
              assert.equal(
                body.page,
                supplierHistory.page,
                "Expected the deep supplier history page.",
              );
              assert.equal(
                body.items.length,
                20,
                "Expected a full supplier history page.",
              );
              assert(
                body.items.every(
                  (item) =>
                    item.conversationId === supplierHistory.conversation &&
                    item.visibility === "SUPPLIER",
                ),
                "Supplier history returned a message outside the measured conversation.",
              );
              assert.equal(
                new Set(body.items.map((item) => item.id)).size,
                body.items.length,
                "Duplicate supplier messages on the measured page.",
              );
            }
            if (total === undefined) total = body.total;
            assert.equal(
              body.total,
              total,
              "Scoped totals changed between sequential reads.",
            );
            return { ms: performance.now() - before, items: body.items.length };
          };
          const first = await read();
          const repeats = [];
          for (let sample = 0; sample < config.repeats; sample++)
            repeats.push((await read()).ms);
          let otherSupplierStatus;
          if (role === "supplier-history") {
            const denied = await fetch(
              base +
                `/ops/conversations/${supplierHistory.otherConversation}/messages?page=1`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.any([
                  abort.signal,
                  AbortSignal.timeout(10000),
                ]),
              },
            );
            otherSupplierStatus = denied.status;
            await denied.arrayBuffer();
            assert.equal(
              otherSupplierStatus,
              404,
              "Supplier history from another supplier must be denied.",
            );
          }
          report.probes.push({
            round,
            role,
            path,
            processId: child.pid,
            readyMs: +readyMs.toFixed(2),
            loginMs: +loginMs.toFixed(2),
            firstReadMs: +first.ms.toFixed(2),
            returnedItems: first.items,
            totalItems: total,
            otherSupplierStatus,
            repeatReads: summarize(repeats),
          });
        } finally {
          await stop(owned);
          writeFileSync(resolve(directory, `${round}-${role}.log`), logs);
          await drop(database);
        }
      }
  } catch (error) {
    failure = error;
  } finally {
    const cleanupErrors = [];
    for (const owned of processes)
      try {
        await stop(owned);
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const name of [...created].reverse())
      try {
        await drop(name);
      } catch (error) {
        cleanupErrors.push(error);
      }
    try {
      const remaining = await admin.query(
        "SELECT count(*)::int count FROM pg_database WHERE left(datname, length($1))=$1",
        [`opsdesk_startup_${run}_`],
      );
      assert.equal(
        remaining.rows[0].count,
        0,
        "Profiler database cleanup was incomplete.",
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await admin.end();
    } finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
    if (cleanupErrors.length)
      failure = new Error(
        `Profiler cleanup failed (${cleanupErrors.length} errors). Inspect the run-owned resources; no success report was published.`,
      );
  }
  if (failure) throw failure;
  assert.equal(
    report.probes.length,
    config.rounds * config.roles.length,
    "A requested API process-start probe was not completed.",
  );
  report.cleanup =
    "All owned API processes stopped and disposable databases removed.";
  writeFileSync(
    resolve(directory, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  try {
    await profileStartup();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
