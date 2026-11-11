import assert from "node:assert/strict";
import { test } from "node:test";
import {
  startupConfig,
  startupDatabase,
  startupEnvironment,
} from "./startup-profile.mjs";

const local = {
  OPSDESK_STARTUP_DATABASE_URL:
    "postgresql://fixture:synthetic@127.0.0.1:55449/postgres",
};
test("requires a loopback maintenance database and bounded distinct role samples", () => {
  assert.deepEqual(startupConfig(local).roles, [
    "manager",
    "agency",
    "customer",
    "agent",
    "supplier",
  ]);
  assert.deepEqual(
    startupConfig({ ...local, OPSDESK_STARTUP_ROLES: "supplier-history" })
      .roles,
    ["supplier-history"],
  );
  for (const url of [
    undefined,
    "invalid",
    "https://127.0.0.1/postgres",
    "postgresql://remote.example/postgres",
    "postgresql://127.0.0.1/opsdesk",
    "postgresql://127.0.0.1/postgres?options=x",
    "postgresql://127.0.0.1/postgres#x",
  ])
    assert.throws(() =>
      startupConfig({ ...local, OPSDESK_STARTUP_DATABASE_URL: url }),
    );
  for (const [key, value] of [
    ["OPSDESK_STARTUP_ROUNDS", "0"],
    ["OPSDESK_STARTUP_ROUNDS", "6"],
    ["OPSDESK_STARTUP_READY_SECONDS", "0"],
    ["OPSDESK_STARTUP_READY_SECONDS", "181"],
    ["OPSDESK_STARTUP_REPEATS", "51"],
    ["OPSDESK_STARTUP_REPEATS", "1.5"],
    ["OPSDESK_STARTUP_ROLES", "manager,manager"],
    ["OPSDESK_STARTUP_ROLES", "admin"],
    ["OPSDESK_STARTUP_ROLES", ""],
  ])
    assert.throws(() => startupConfig({ ...local, [key]: value }));
});
test("database names cannot escape the run-specific synthetic namespace", () => {
  const run = "a".repeat(32);
  assert.equal(
    startupDatabase(run, "template"),
    `opsdesk_startup_${run}_template`,
  );
  assert(startupDatabase(run, "probe_29").length <= 63);
  for (const [id, slot] of [
    ["invalid", "template"],
    [run, "opsdesk"],
    [run, 'probe_0";DROP DATABASE opsdesk;--'],
    [run, "probe_100"],
  ])
    assert.throws(() => startupDatabase(id, slot));
});
test("owned APIs get generated secrets and synthetic settings without inherited provider credentials", () => {
  const env = startupEnvironment(
    {
      PATH: "runtime",
      SystemRoot: "system",
      GEMINI_API_KEY: "must-not-copy",
      RESEND_API_KEY: "must-not-copy",
      NODE_ENV: "production",
      NODE_OPTIONS: "--inspect",
      OPSDESK_MAIL_SYNTHETIC: "true",
    },
    "postgresql://127.0.0.1/probe",
    3456,
  );
  assert.equal(env.PATH, "runtime");
  assert.equal(env.PORT, "3456");
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.HOST, "127.0.0.1");
  assert.equal(env.OPSDESK_DEMO, "true");
  assert.equal(env.OPSDESK_MAIL_SYNTHETIC, "false");
  assert.equal(env.GEMINI_API_KEY, undefined);
  assert.equal(env.RESEND_API_KEY, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.JWT_SECRET.length, 64);
  assert.notEqual(env.JWT_SECRET, env.JWT_REFRESH_SECRET);
});
