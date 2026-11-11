import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import pg from "pg";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(env.OPSDESK_DEMO, "true", "Use an isolated synthetic preview.");
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
const api = new URL(process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001");
assert(["127.0.0.1", "localhost"].includes(api.hostname));
assert.equal(
  api.port,
  env.PORT || "3001",
  "Target the configured synthetic API.",
);

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  assert(
    Number.isInteger(value) && value >= min && value <= max,
    `${name} must be an integer from ${min} to ${max}.`,
  );
  return value;
}

const total = integer("OPSDESK_LOAD_REQUESTS", 200, 20, 10_000);
const concurrency = integer("OPSDESK_LOAD_CONCURRENCY", 8, 1, 32);
const duration = integer("OPSDESK_LOAD_DURATION_SECONDS", 0, 0, 180);
const backgroundCases = integer("OPSDESK_LOAD_CASES", 0, 0, 18_000);
const historyLength = integer("OPSDESK_LOAD_HISTORY", 0, 0, 5_000);
const prefix = "LOAD-" + randomUUID() + "-";
const ids = Array.from({ length: concurrency }, (_, index) => prefix + index);
const hot = ids[0];
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const stats = new Map();
const expectedWrites = new Map();
let fixturesCreated = false;
let next = 0;
let token;

async function request(path, expectedStatus, body) {
  const response = await fetch(new URL(path, api), {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(
    response.status,
    expectedStatus,
    `${path} returned HTTP ${response.status}`,
  );
  return response.json();
}

async function rowCounts() {
  return (
    await pool.query(`
    SELECT (SELECT count(*) FROM "TravelTicket")::int cases,
           (SELECT count(*) FROM "TravelMessage")::int messages
  `)
  ).rows[0];
}

function summarize(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const percentile = (p) =>
    Math.round(sorted[Math.ceil(sorted.length * p) - 1]);
  return {
    requests: sorted.length,
    latencyMs: {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: percentile(1),
    },
  };
}

try {
  const login = await request("/auth/login", 200, {
    email: "manager@opsdesk.demo",
    password: "OpsDeskDemo!2026",
  });
  token = login.accessToken;
  const baseline = await rowCounts();

  const inserted = await pool.query(
    `
    WITH templates AS (
      SELECT t.*, row_number() OVER (ORDER BY id) AS slot,
             count(*) OVER () AS slots
      FROM "TravelTicket" t
      WHERE "bookingId" IS NOT NULL AND id NOT LIKE 'LOAD-%'
    )
    INSERT INTO "TravelTicket"
    SELECT (jsonb_populate_record(NULL::"TravelTicket", to_jsonb(t) ||
      jsonb_build_object(
        'id', $1::text || i::text, 'reference', $1::text || i::text,
        'deadline', now() + interval '1 year', 'responseDeadline', NULL,
        'autoHandoff', false
      ))).*
    FROM generate_series(0, $2::int - 1) i
    JOIN templates t ON t.slot = (i % t.slots) + 1
  `,
    [prefix, concurrency + backgroundCases],
  );
  fixturesCreated = true;
  assert.equal(
    inserted.rowCount,
    concurrency + backgroundCases,
    "Missing booking-linked synthetic case templates.",
  );
  if (historyLength) {
    await pool.query(
      `
      INSERT INTO "TravelMessage" (id, "ticketId", "senderId", visibility, content, "createdAt")
      SELECT $1::text || '-history-' || i, $1, 'manager', 'INTERNAL',
             'Synthetic history ' || i, now() - i * interval '1 minute'
      FROM generate_series(1, $2::int) i
    `,
      [hot, historyLength],
    );
  }
  const loaded = await rowCounts();
  const deepHistory = Math.max(1, Math.ceil(historyLength / 20));
  const deepQueue = backgroundCases
    ? Math.max(1, Math.floor(backgroundCases / 20))
    : 1;
  const history = await request(
    `/ops/tickets/${hot}/messages?page=${deepHistory}`,
    200,
  );
  assert.equal(
    history.total,
    historyLength,
    "The HTTP server must use the same synthetic database.",
  );
  assert.equal(history.page, deepHistory);
  const queue = await request(`/ops/queue?tab=all&page=${deepQueue}`, 200);
  assert.equal(queue.page, deepQueue);

  const started = performance.now();
  const operations = [
    ["queue", `/ops/queue?tab=all&page=${deepQueue}`],
    ["bookings", "/ops/bookings?page=1"],
    ["hot history", `/ops/tickets/${hot}/messages?page=${deepHistory}`],
    ["insights", "/ops/insights"],
  ];
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      while (true) {
        const index = next++;
        if (
          duration
            ? performance.now() - started >= duration * 1000
            : index >= total
        )
          break;
        const write = index % 5 === 0;
        const target = index % 4 === 0 ? id : hot;
        const [operation, route] = write
          ? ["internal note", `/ops/tickets/${target}/messages`]
          : operations[index % operations.length];
        const content = prefix + "write-" + index;
        const before = performance.now();
        await request(
          route,
          write ? 201 : 200,
          write ? { content, visibility: "INTERNAL" } : undefined,
        );
        const times = stats.get(operation) ?? [];
        times.push(performance.now() - before);
        stats.set(operation, times);
        if (write) expectedWrites.set(content, target);
      }
    }),
  );
  for (const result of results)
    if (result.status === "rejected") throw result.reason;

  const elapsedMs = performance.now() - started;
  const stored = (
    await pool.query(
      `
    SELECT "ticketId", content FROM "TravelMessage"
    WHERE "ticketId" = ANY($1::text[]) AND content LIKE $2
  `,
      [ids, prefix + "write-%"],
    )
  ).rows;
  assert.equal(
    stored.length,
    expectedWrites.size,
    "Write count differs from HTTP acknowledgments.",
  );
  for (const row of stored) {
    assert.equal(
      expectedWrites.get(row.content),
      row.ticketId,
      "Unexpected or duplicate persisted note.",
    );
    expectedWrites.delete(row.content);
  }
  assert.equal(expectedWrites.size, 0);
  const all = summarize([...stats.values()].flat());
  if (!duration) assert.equal(all.requests, total);
  console.log(
    JSON.stringify(
      {
        scenario: "isolated synthetic mixed read/write",
        baseline,
        loaded,
        concurrency,
        durationSeconds: duration || undefined,
        queuePage: deepQueue,
        historyPage: deepHistory,
        writes: stored.length,
        elapsedMs: Math.round(elapsedMs),
        requestsPerSecond: +((all.requests / elapsedMs) * 1000).toFixed(1),
        ...all,
        byOperation: Object.fromEntries(
          [...stats].map(([name, times]) => [name, summarize(times)]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  try {
    if (fixturesCreated) {
      const removed = await pool.query(
        'DELETE FROM "TravelTicket" WHERE id LIKE $1',
        [prefix + "%"],
      );
      assert.equal(
        removed.rowCount,
        concurrency + backgroundCases,
        "Fixture cleanup was incomplete.",
      );
    }
  } finally {
    await pool.end();
  }
}
