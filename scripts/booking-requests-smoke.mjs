import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
const env = dotenv.parse(readFileSync(new URL('../backend/.env', import.meta.url)));
assert.equal(env.OPSDESK_DEMO, 'true');
assert.equal(new URL(env.DATABASE_URL).hostname, '127.0.0.1');
const base = process.env.OPSDESK_TEST_URL || 'http://127.0.0.1:3001';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const ids = Array.from({ length: 5 }, () => randomUUID());
const reference = ('APPROVAL-' + ids[0]).toUpperCase();
let createdBooking;
const ticketId = randomUUID();
let checks = 0;
async function call(path, token, body, expected = 200) {
  const r = await fetch(base + '/ops/' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}) });
  const d = await r.json(); assert.equal(r.status, expected, `${path}: ${JSON.stringify(d)}`); checks++; return d;
}
async function login(name) {
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: `${name}@opsdesk.demo`, password: 'OpsDeskDemo!2026'}) });
  assert.equal(r.status, 200); return (await r.json()).accessToken;
}
try {
  const manager = await login('manager');
  const customer = await login('maya');
  const supplier = await login('supplier');
  const otherAgency = await login('horizon');
  const { rows: [seed] } = await pool.query(`SELECT * FROM "TravelBooking" WHERE reference='BK-1042'`);
  const proposal = { requestId: ids[0], agencyId: seed.agencyId, customerId: seed.customerId, supplierId: seed.supplierId,
    reference, destination: seed.destination, region: seed.region, service: seed.service,
    checkInAt: '2027-02-01T10:00:00.000Z', timezone: 'Asia/Kolkata', reason: 'Synthetic booking approval rehearsal' };
  await call('booking-requests', null, undefined, 401);
  await call('booking-requests', supplier, undefined, 403);
  await call('booking-requests', customer, proposal, 403);
  await call('booking-requests', manager, {...proposal, requestId: ids[4], timezone: 'Unknown/Zone'}, 400);
  const pending = await call('booking-requests', manager, proposal, 201);
  assert.equal(pending.status, 'PENDING'); checks++;
  await assert.rejects(pool.query(`UPDATE "TravelBookingRequest" SET status='APPROVED' WHERE id=$1`, [ids[0]]), (e) => e.code === '23514'); checks++;
  await call('booking-requests', manager, proposal, 201);
  await call('booking-requests', manager, {...proposal, destination: 'Changed destination'}, 409);
  const decision = { decision: 'APPROVED', reason: 'Manager verified synthetic booking ownership' };
  await call(`booking-requests/${ids[0]}/review`, customer, decision, 403);
  const approvals = await Promise.all(Array.from({length: 3}, () => call(`booking-requests/${ids[0]}/review`, manager, decision, 201)));
  createdBooking = approvals[0].bookingId;
  assert(approvals.every((a) => a.bookingId === createdBooking)); checks++;
  const { rows: [count] } = await pool.query(`SELECT COUNT(*)::int n FROM "MembershipAudit" WHERE "entityId"=$1`, [ids[0]]);
  assert.equal(count.n, 1); checks++;
  await call(`bookings/${createdBooking}/cancellation-requests`, otherAgency, {requestId: ids[4], reason: 'Wrong agency must never access this booking'}, 404);
  await pool.query(`INSERT INTO "TravelTicket" SELECT (jsonb_populate_record(NULL::"TravelTicket", to_jsonb(t) || jsonb_build_object('id',$1::text,'reference',$2::text,'bookingId',$3::text))).* FROM "TravelTicket" t WHERE reference='OPS-1042'`, [ticketId, 'TEST-' + ticketId, createdBooking]);
  const {rows: [before]} = await pool.query(`SELECT status,deadline,"responseDeadline" FROM "TravelTicket" WHERE id=$1`, [ticketId]);
  await call(`bookings/${createdBooking}/cancellation-requests`, manager, { requestId: ids[1], reason: 'Synthetic cancellation requiring manager review' }, 201);
  await pool.query(`UPDATE "TravelBooking" SET destination=destination || ' updated' WHERE id=$1`, [createdBooking]);
  await call(`booking-requests/${ids[1]}/review`, manager, decision, 409);
  await call(`booking-requests/${ids[1]}/review`, manager, {...decision, decision: 'REJECTED'}, 201);
  const cancellation = {requestId: ids[2], reason: 'Reconfirmed synthetic cancellation after update'};
  await call(`bookings/${createdBooking}/cancellation-requests`, manager, cancellation, 201);
  await Promise.all(Array.from({length: 3}, () => call(`booking-requests/${ids[2]}/review`, manager, decision, 201)));
  const { rows: [state] } = await pool.query(`SELECT "providerStatus" FROM "TravelBookingImport" WHERE "bookingId"=$1`, [createdBooking]);
  assert.equal(state.providerStatus, 'CANCELLED'); checks++;
  const directory = await call(`bookings?search=${encodeURIComponent(reference)}`, manager);
  assert.equal(directory.items[0].bookingStatus, 'CANCELLED'); checks++;
  const {rows: [after]} = await pool.query(`SELECT status,deadline,"responseDeadline" FROM "TravelTicket" WHERE id=$1`, [ticketId]);
  assert.deepEqual(after, before); checks++;
  const {rows: [events]} = await pool.query(`SELECT COUNT(*)::int n FROM "TravelEvent" WHERE "ticketId"=$1 AND kind='BOOKING_CANCELLED'`, [ticketId]);
  assert.equal(events.n, 1); checks++;
  await call(`bookings/${createdBooking}/cancellation-requests`, manager, cancellation, 201);
  await call(`bookings/${createdBooking}/cancellation-requests`, manager, {...cancellation, requestId: ids[3]}, 409);
  await call(`booking-requests/${ids[2]}/review`, manager, {...decision, decision: 'REJECTED'}, 409);
  console.log(`Booking approval smoke passed: ${checks} checks.`);
} finally {
  await pool.query(`DELETE FROM "TravelTicket" WHERE id=$1`, [ticketId]);
  await pool.query(`DELETE FROM "MembershipAudit" WHERE "entityId"=ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM "TravelBookingRequest" WHERE id=ANY($1::text[])`, [ids]);
  await pool.query(`DELETE FROM "TravelBooking" WHERE reference=$1`, [reference]);
  await pool.end();
}
