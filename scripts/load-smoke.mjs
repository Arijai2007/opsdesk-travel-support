import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import pg from "pg";
import { loadAccounts, readRoleProfile } from "./load-profile.mjs";
import { readLoadTargets, evaluateLoadTargets } from "./load-targets.mjs";

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
const readProfile = readRoleProfile(process.env.OPSDESK_LOAD_ROLE_WEIGHTS);
const identityMode = process.env.OPSDESK_LOAD_IDENTITIES ?? "single";
const accounts = loadAccounts(identityMode);
const targets = readLoadTargets(process.env.OPSDESK_LOAD_TARGETS);
const prefix = "LOAD-" + randomUUID() + "-";
const ids = Array.from({ length: concurrency }, (_, index) => prefix + index);
const hot = ids[0];
const supplierConversations = new Map();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const stats = new Map();
const roleStats = new Map();
const expectedWrites = new Map();
let createdCases = 0;
let next = 0;
let nextRead = 0;
let token;
let report;

async function request(path, expectedStatus, body, authToken = token) {
  const response = await fetch(new URL(path, api), {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
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

function summarize(values, round = true) {
  const sorted = values.toSorted((a, b) => a - b);
  const percentile = (p) =>
    round
      ? Math.round(sorted[Math.ceil(sorted.length * p) - 1])
      : sorted[Math.ceil(sorted.length * p) - 1];
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
  createdCases = inserted.rowCount;
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
  if (readProfile.weights.supplier) {
    for (const account of accounts.supplier) {
      const ticketId = prefix + account + "-ticket";
      const conversationId = prefix + account + "-conversation";
      const insertedMessage = await pool.query(
        `
        WITH source AS (
          SELECT t.*, p."supplierId" AS supplier
          FROM "TravelTicket" t
          JOIN "TravelBooking" b ON b.id = t."bookingId"
          JOIN "TravelProfile" p ON p."supplierId" = b."supplierId"
          JOIN "User" u ON u.id = p."userId"
          WHERE u.email = $1 AND p.kind = 'SUPPLIER' AND p.status = 'ACTIVE'
            AND t.id NOT LIKE 'LOAD-%'
          ORDER BY t.id LIMIT 1
        ), copied AS (
          INSERT INTO "TravelTicket"
          SELECT (jsonb_populate_record(NULL::"TravelTicket", to_jsonb(source) ||
            jsonb_build_object('id', $2::text, 'reference', $2::text,
              'deadline', now() + interval '1 year', 'responseDeadline', NULL,
              'autoHandoff', false))).*
          FROM source RETURNING id
        ), conversation AS (
          INSERT INTO "TravelConversation" (id, "ticketId", "supplierId", subject, "dueAt")
          SELECT $3, copied.id, source.supplier, 'Disposable supplier load thread',
                 now() + interval '1 year'
          FROM copied CROSS JOIN source RETURNING id, "ticketId"
        )
        INSERT INTO "TravelMessage" (id, "ticketId", "conversationId", "senderId", visibility, content)
        SELECT $3::text || '-message', "ticketId", id, 'manager', 'SUPPLIER', 'Disposable supplier load context.'
        FROM conversation
      `,
        [`${account}@opsdesk.demo`, ticketId, conversationId],
      );
      assert.equal(
        insertedMessage.rowCount,
        1,
        "Missing booking-linked synthetic supplier context.",
      );
      createdCases++;
      supplierConversations.set(account, conversationId);
    }
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

  const operations = [
    ["queue", `/ops/queue?tab=all&page=${deepQueue}`],
    ["bookings", "/ops/bookings?page=1"],
    ["hot history", `/ops/tickets/${hot}/messages?page=${deepHistory}`],
    ["insights", "/ops/insights"],
  ];
  const manager = {
    account: "manager",
    token,
    operations,
    nextRead: 0,
    requests: 0,
  };
  const actors = new Map([["manager", { accounts: [manager], next: 0 }]]);
  for (const role of new Set(readProfile.schedule)) {
    if (role === "manager") continue;
    const members = [];
    for (const account of accounts[role]) {
      const session = await request(
        "/auth/login",
        200,
        {
          email: `${account}@opsdesk.demo`,
          password: "OpsDeskDemo!2026",
        },
        null,
      );
      const actorToken = session.accessToken;
      let routes;
      if (role === "supplier") {
        const conversationId = supplierConversations.get(account);
        const conversations = await request(
          "/ops/conversations?page=1",
          200,
          undefined,
          actorToken,
        );
        assert(
          conversations.items.some(
            (conversation) => conversation.id === conversationId,
          ),
          "Supplier must see its disposable thread in the same synthetic database.",
        );
        for (const [other, otherConversation] of supplierConversations) {
          if (other !== account) {
            await request(
              `/ops/conversations/${otherConversation}/messages?page=1`,
              404,
              undefined,
              actorToken,
            );
          }
        }
        routes = [
          ["conversations", "/ops/conversations?page=1"],
          [
            "supplier history",
            `/ops/conversations/${conversationId}/messages?page=1`,
          ],
        ];
      } else {
        const scopedQueue = await request(
          "/ops/queue?tab=all&page=1",
          200,
          undefined,
          actorToken,
        );
        const ticket = scopedQueue.items.find((item) => item.bookingId);
        assert(
          ticket,
          `Seeded ${account} needs a scoped booking-linked case for load reads.`,
        );
        routes = [
          ["queue", "/ops/queue?tab=all&page=1"],
          ["bookings", "/ops/bookings?page=1"],
          ["case history", `/ops/tickets/${ticket.id}/messages?page=1`],
          [
            "booking history",
            `/ops/bookings/${ticket.bookingId}/tickets?page=1`,
          ],
        ];
      }
      for (const [, route] of routes)
        await request(route, 200, undefined, actorToken);
      members.push({
        account,
        token: actorToken,
        operations: routes,
        nextRead: 0,
        requests: 0,
      });
    }
    actors.set(role, { accounts: members, next: 0 });
  }
  const started = performance.now();
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
        const role = write
          ? "manager"
          : readProfile.schedule[nextRead++ % readProfile.schedule.length];
        const group = actors.get(role);
        const actor = write
          ? manager
          : group.accounts[group.next++ % group.accounts.length];
        const [operation, route] = write
          ? ["internal note", `/ops/tickets/${target}/messages`]
          : actor.operations[actor.nextRead++ % actor.operations.length];
        const content = prefix + "write-" + index;
        const before = performance.now();
        await request(
          route,
          write ? 201 : 200,
          write ? { content, visibility: "INTERNAL" } : undefined,
          actor.token,
        );
        const elapsed = performance.now() - before;
        actor.requests++;
        const operationKey = `${role}: ${operation}`;
        const times = stats.get(operationKey) ?? [];
        times.push(elapsed);
        stats.set(operationKey, times);
        const roleTimes = roleStats.get(role) ?? [];
        roleTimes.push(elapsed);
        roleStats.set(role, roleTimes);
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
  for (const [role, group] of actors) {
    const counts = group.accounts.map((actor) => actor.requests);
    assert(
      Math.max(...counts) - Math.min(...counts) <= 1,
      `Measured requests were not evenly rotated within ${role}.`,
    );
  }
  const all = summarize([...stats.values()].flat());
  if (!duration) assert.equal(all.requests, total);
  const targetAssessment = evaluateLoadTargets(targets, {
    ...summarize([...stats.values()].flat(), false),
    elapsedMs,
    requestsPerSecond: (all.requests / elapsedMs) * 1000,
    byRole: Object.fromEntries(
      [...roleStats].map(([role, times]) => [role, summarize(times, false)]),
    ),
  });
  report = {
    scenario: "isolated synthetic mixed read/write",
    node: process.version,
    cacheState: "not controlled; preflight reads excluded from timings",
    targetAssessment,
    readRoleWeights: readProfile.weights,
    identityMode,
    requestsByIdentity: Object.fromEntries(
      [...actors.values()].flatMap(({ accounts }) =>
        accounts.map(({ account, requests }) => [account, requests]),
      ),
    ),
    writeRole: "manager",
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
    byRole: Object.fromEntries(
      [...roleStats].map(([role, times]) => [role, summarize(times)]),
    ),
    byOperation: Object.fromEntries(
      [...stats].map(([name, times]) => [name, summarize(times)]),
    ),
  };
} finally {
  try {
    if (createdCases) {
      const removed = await pool.query(
        'DELETE FROM "TravelTicket" WHERE id LIKE $1',
        [prefix + "%"],
      );
      assert.equal(
        removed.rowCount,
        createdCases,
        "Fixture cleanup was incomplete.",
      );
    }
  } finally {
    await pool.end();
  }
}
console.log(JSON.stringify(report, null, 2));
assert.notEqual(
  report.targetAssessment.status,
  "failed",
  "Supplied synthetic load targets failed; see targetAssessment.",
);
