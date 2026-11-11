import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(config.OPSDESK_DEMO, "true", "Use an isolated synthetic preview.");
assert.equal(new URL(config.DATABASE_URL).hostname, "127.0.0.1");
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const roles = ["manager", "agency", "customer", "agent", "supplier"];
const target = {
  version: 1,
  name: "Integration tooling test only; not approved",
  minRequests: 200,
  maxP95Ms: 60000,
  maxP99Ms: 60000,
  byRole: Object.fromEntries(
    roles.map((role) => [role, { minRequests: 1, maxP95Ms: 60000 }]),
  ),
};
async function counts() {
  return (
    await pool.query(`SELECT
    (SELECT count(*)::int FROM "TravelTicket") AS cases,
    (SELECT count(*)::int FROM "TravelMessage") AS messages,
    (SELECT count(*)::int FROM "TravelConversation") AS conversations`)
  ).rows[0];
}

try {
  const baseline = await counts();
  for (const status of ["not-configured", "passed", "failed"]) {
    const env = {
      ...process.env,
      OPSDESK_LOAD_REQUESTS: "200",
      OPSDESK_LOAD_CONCURRENCY: "4",
      OPSDESK_LOAD_DURATION_SECONDS: "0",
      OPSDESK_LOAD_CASES: "0",
      OPSDESK_LOAD_HISTORY: "0",
      OPSDESK_LOAD_IDENTITIES: "expanded",
      OPSDESK_LOAD_ROLE_WEIGHTS: JSON.stringify(
        Object.fromEntries(roles.map((role) => [role, 1])),
      ),
    };
    delete env.OPSDESK_LOAD_TARGETS;
    if (status !== "not-configured")
      env.OPSDESK_LOAD_TARGETS = JSON.stringify({
        ...target,
        minRequests: status === "failed" ? 201 : 200,
      });
    const result = spawnSync(process.execPath, ["scripts/load-smoke.mjs"], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 90000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, status === "failed" ? 1 : 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.targetAssessment.status, status);
    assert.equal(report.requests, 200);
    assert.equal(report.writes, 40);
    assert.equal(Object.keys(report.requestsByIdentity).length, 12);
    assert.deepEqual(
      await counts(),
      baseline,
      `${status}: fixture counts were not restored`,
    );
    if (status === "failed") {
      const failures = report.targetAssessment.checks.filter(
        (check) => !check.passed,
      );
      assert.equal(failures.length, 1);
      assert.equal(failures[0].metric, "requests");
      assert.equal(failures[0].actual, 200);
      assert.equal(failures[0].target, 201);
    }
    console.log(
      `PASS ${status}: 200 measured requests, 40 verified writes, 12 identities, original case/message/conversation counts restored.`,
    );
  }
} finally {
  await pool.end();
}
