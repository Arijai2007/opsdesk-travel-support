# Booking approval workflow

The Booking reviews button opens the manager request and decision screen. A proposed booking stays pending until a manager approves or rejects it with a reason. Approval rechecks the agency, active customer membership, supplier, booking-reference uniqueness and UTC/timezone fields. Successful synthetic creation saves the booking and its `synthetic-review` provider identity in the same transaction as the decision and audit.

Cancellation requests save a fingerprint of the booking and its accepted provider version. If any booking detail changes before approval, the manager must reject the stale request and submit a new one. Approved cancellation marks the synthetic provider state `CANCELLED` and adds one audit event to each linked case. Cases stay open with their saved deadlines; staff must review the effect on each complaint. The booking directory shows cancelled state. This workflow does not issue refunds, calculate cancellation fees, erase history, or send a live provider command.

Backend access:

- Active managers can submit and review requests and read the paged request queue.
- Active agency users can submit creation or cancellation requests within their agency and read that agency's requests.
- Active customers can request cancellation of their own agency-linked bookings and read requests they submitted.
- Agents and suppliers cannot use these endpoints.

Creation and cancellation approvals are enabled only when `OPSDESK_DEMO=true` and `NODE_ENV` is not `production`. Provider-managed bookings cannot be cancelled through the synthetic adapter. No live provider is selected. The frontend currently exposes the manager flow; agency/customer submission uses the authenticated API.

API:

- `GET /ops/booking-requests?page=1`: twenty scoped requests per page, with customer, agency and supplier names for review.
- `POST /ops/booking-requests`: a creation proposal, including a caller-generated UUID `requestId`, trusted local identity IDs, reference, destination, region, service, UTC check-in, IANA timezone and reason. Departure and cancellation cutoff are optional UTC instants.
- `POST /ops/bookings/:id/cancellation-requests`: `requestId` and reason.
- `POST /ops/booking-requests/:id/review`: `decision` (`APPROVED` or `REJECTED`) and reason.

All reasons require at least ten meaningful characters. Repeating the same request ID and payload returns the stored request; changing its payload conflicts. Review retries return the existing matching decision and do not create another booking, cancellation or audit. An opposing decision conflicts. The existing routing advisory lock serializes requests and decisions with booking intake/export writes. Approval rechecks the requester's active scope. A manager can review a request they submitted; separate-person approval is not enforced in this prototype.

Run `npm run ops:test:booking-requests` against the isolated preview. The harness covers concurrent approvals, exact audit counts, wrong-agency access, invalid timezone, changed-booking rejection and preservation of existing case status/deadlines. Run `npm run ops:test:booking-requests:browser` for the full manager flow. Standard API and browser test commands include both harnesses. Do not run policy-mutating suites simultaneously.

## Exploratory load harness

`npm run ops:load` runs 200 mixed queue, booking, thread and Insights reads with internal-note writes at concurrency eight. It creates and removes its own case fixtures and checks that every acknowledged write persists exactly once. `OPSDESK_LOAD_REQUESTS` (20–10000) and `OPSDESK_LOAD_CONCURRENCY` (1–32) control the run. The target must be a local synthetic preview. Output includes baseline row counts, throughput and latency percentiles.

One local run on 60 seeded cases and 192 messages completed 200 requests and 40 writes in 1383 ms, with p50 49 ms, p95 95 ms and p99 179 ms. This is exploratory evidence. Representative volumes, long threads, workload skew, cold caches, sustained traffic and owner-approved acceptance targets remain open.
