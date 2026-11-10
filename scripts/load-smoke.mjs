import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import pg from 'pg';
const env = dotenv.parse(readFileSync(new URL('../backend/.env', import.meta.url)));
assert.equal(env.OPSDESK_DEMO, 'true', 'Use an isolated synthetic preview.');
assert.equal(new URL(env.DATABASE_URL).hostname, '127.0.0.1');
const base = process.env.OPSDESK_TEST_URL || 'http://127.0.0.1:3001';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const total = Number(process.env.OPSDESK_LOAD_REQUESTS || 200);
const concurrency = Number(process.env.OPSDESK_LOAD_CONCURRENCY || 8);
assert(Number.isInteger(total) && total >= 20 && total <= 10000);
assert(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 32);
const pool = new pg.Pool({connectionString: env.DATABASE_URL});
const ids = Array.from({length: concurrency}, () => randomUUID());
const latencies = [];
let next = 0;
let writes = 0;
try {
  const login = await fetch(base + '/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'manager@opsdesk.demo', password: 'OpsDeskDemo!2026'})});
  assert.equal(login.status, 200);
  const token = (await login.json()).accessToken;
  const baseline = (await pool.query(`SELECT (SELECT COUNT(*) FROM "TravelTicket")::int cases, (SELECT COUNT(*) FROM "TravelMessage")::int messages`)).rows[0];
  for (const id of ids) await pool.query(`INSERT INTO "TravelTicket" SELECT (jsonb_populate_record(NULL::"TravelTicket", to_jsonb(t) || jsonb_build_object('id',$1::text,'reference',$2::text))).* FROM "TravelTicket" t WHERE reference='OPS-1042'`, [id, 'LOAD-' + id]);
  const started = performance.now();
  const results = await Promise.allSettled(ids.map(async (id) => {
    while (true) {
      const index = next++;
      if (index >= total) break;
      const write = index % 5 === 0;
      const path = write ? `/tickets/${id}/messages` : [
        '/queue?page=1', '/bookings?page=1', `/tickets/${id}/messages?page=1`, '/insights',
      ][index % 4];
      const before = performance.now();
      const response = await fetch(base + '/ops' + path, {method: write ? 'POST' : 'GET',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        ...(write ? {body: JSON.stringify({content: `Synthetic load message ${index}`, visibility: 'INTERNAL'})} : {})});
      const body = await response.json();
      assert.equal(response.status, write ? 201 : 200, `${path}: ${JSON.stringify(body)}`);
      latencies.push(performance.now() - before);
      if (write) writes++;
    }
  }));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  const elapsedMs = performance.now() - started;
  const stored = (await pool.query(`SELECT COUNT(*)::int n FROM "TravelMessage" WHERE "ticketId"=ANY($1::text[])`, [ids])).rows[0].n;
  assert.equal(stored, writes, 'Every acknowledged write must persist exactly once.');
  assert.equal(latencies.length, total);
  latencies.sort((a,b) => a-b);
  const percentile = (p) => Math.round(latencies[Math.ceil(latencies.length * p) - 1]);
  console.log(JSON.stringify({scenario: 'isolated synthetic mixed read/write', baseline, requests: total, concurrency,
    writes, elapsedMs: Math.round(elapsedMs), requestsPerSecond: +(total / elapsedMs * 1000).toFixed(1),
    latencyMs: {p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: percentile(1)},
    acceptance: 'Exploratory evidence only; representative data, workload and owner-approved targets are still required.'}, null, 2));
} finally {
  await pool.query(`DELETE FROM "TravelTicket" WHERE id=ANY($1::text[])`, [ids]);
  await pool.end();
}
