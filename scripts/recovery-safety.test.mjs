import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
for (const [name, url, expected] of [
  ["missing URL", "", "Set OPSDESK_RECOVERY_DATABASE_URL"],
  [
    "remote host",
    "postgresql://user:example@database.invalid/postgres",
    "Use local PostgreSQL only",
  ],
  [
    "application database",
    "postgresql://user:example@127.0.0.1/opsdesk",
    "Use the maintenance database",
  ],
  [
    "host override",
    "postgresql://user:example@127.0.0.1/postgres?host=database.invalid",
    "Connection URL options are not permitted",
  ],
  [
    "incorrect scheme",
    "http://127.0.0.1/postgres",
    "Use a PostgreSQL connection URL",
  ],
])
  test(`refuses ${name} before connecting`, () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/rehearse-recovery.mjs"],
      {
        encoding: "utf8",
        env: { ...process.env, OPSDESK_RECOVERY_DATABASE_URL: url },
        timeout: 10000,
      },
    );
    assert.notEqual(result.status, 0);
    assert(result.stderr.includes(expected), result.stderr);
  });
