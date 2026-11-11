# Booking approval workflow

The Booking reviews button opens the manager request and decision screen. A proposed booking stays pending until a manager approves or rejects it with a reason. Approval rechecks the agency, active customer membership, supplier, booking-reference uniqueness and UTC/timezone fields. Successful synthetic creation saves the booking and its `synthetic-review` provider identity in the same transaction as the decision and audit.

Cancellation requests save a fingerprint of the booking and its accepted provider version. If any booking detail changes before approval, the manager must reject the stale request and submit a new one. Approved cancellation marks the synthetic provider state `CANCELLED` and adds one audit event to each linked case. Cases stay open with their saved deadlines; staff must review the effect on each complaint. The booking directory shows cancelled state. This workflow does not issue refunds, calculate cancellation fees, erase history, or send a live provider command.

Backend access:

- Active managers can submit and review requests and read the paged request queue.
- Active agency users can submit creation or cancellation requests within their agency and read that agency's requests.
- Active customers can request cancellation of their own agency-linked bookings and read requests they submitted.
- Agents and suppliers cannot use these endpoints.

Creation and cancellation approvals are enabled only when `OPSDESK_DEMO=true` and `NODE_ENV` is not `production`. Provider-managed bookings cannot be cancelled through the synthetic adapter. No live provider is selected. Agency users open **Booking requests** to propose a booking or request a cancellation and track agency requests. Customers use the same button for their own cancellations and request history. Approval controls appear in **Booking reviews** for managers.

The creation form loads paged active customer names and IDs for the selected agency and supplier names and IDs. An agency user starts with their own agency. Retrying the same form payload after a failed response reuses its UUID while the panel is open.

API:

- `GET /ops/booking-requests/customers/:agencyId` and `GET /ops/booking-requests/suppliers` provide search and paging for manager and agency creation forms.

- `GET /ops/booking-requests?page=1`: twenty scoped requests per page, with customer, agency and supplier names for review.
- `POST /ops/booking-requests`: a creation proposal, including a caller-generated UUID `requestId`, trusted local identity IDs, reference, destination, region, service, UTC check-in, IANA timezone and reason. Departure and cancellation cutoff are optional UTC instants.
- `POST /ops/bookings/:id/cancellation-requests`: `requestId` and reason.
- `POST /ops/booking-requests/:id/review`: `decision` (`APPROVED` or `REJECTED`) and reason.

All reasons require at least ten meaningful characters. Repeating the same request ID and payload returns the stored request; changing its payload conflicts. Review retries return the existing matching decision and do not create another booking, cancellation or audit. An opposing decision conflicts. The existing routing advisory lock serializes requests and decisions with booking intake/export writes. Approval rechecks the requester's active scope. A manager can review a request they submitted; separate-person approval is not enforced in this prototype.

Run `npm run ops:test:booking-requests` against the isolated preview. The harness covers concurrent approvals, exact audit counts, wrong-agency access, invalid timezone, changed-booking rejection and preservation of existing case status/deadlines. Run `npm run ops:test:booking-requests:browser` for the agency request, customer cancellation and manager decision flow, including a retry after a dropped response. Standard API and browser test commands include both harnesses. Do not run policy-mutating suites simultaneously.

## Synthetic load rehearsal

Optional supplied-target checks are available through `OPSDESK_LOAD_TARGETS`: [schema, examples and limitations](OPSDESK_LOAD_TARGETS.md). Without configuration, reports explicitly say `not-configured`. A configured target failure exits nonzero after write verification and cleanup; no owner-approved targets or production acceptance are implied.

Run `npm run ops:load` against the isolated synthetic preview. The default sends 200 mixed queue, booking, history and Insights reads and internal-note writes with eight concurrent workers. Each run creates uniquely named cases and verifies that every acknowledged note is stored exactly once on its intended case. The fixtures are removed on completion.

To run a sustained rehearsal with a larger dataset and a shared, long message thread, set the following variables before running the same command.

```powershell
$env:OPSDESK_LOAD_DURATION_SECONDS = '60'
$env:OPSDESK_LOAD_CASES = '3000'
$env:OPSDESK_LOAD_HISTORY = '1200'
$env:OPSDESK_LOAD_CONCURRENCY = '12'
npm run ops:load
```

Duration mode keeps the workers active for up to 180 seconds and drains in-flight requests. Without a duration, `OPSDESK_LOAD_REQUESTS` selects 20–10,000 requests. Case and history options accept up to 18,000 and 5,000 rows respectively. Concurrency accepts 1–32 workers. The harness verifies deep queue and history pages, directs most writes to the same case, and reports aggregate and per-operation p50, p95, p99 and maximum latency. Set `OPSDESK_TEST_URL` when using a custom API port. Run it separately from fixture-mutating suites.

The default workload uses one synthetic manager and one local host. To distribute reads across five authenticated roles, set positive integer weights before running the same command:

```powershell
$env:OPSDESK_LOAD_ROLE_WEIGHTS = '{"manager":1,"agency":1,"customer":1,"agent":1,"supplier":1}'
npm run ops:load
```

Weights apply to the **read requests only**. One in every five measured operations remains a manager-authored internal note; all acknowledged writes must be stored exactly once. Omitted roles have weight zero. Supported keys are `manager`, `agency`, `customer`, `agent` and `supplier`; weights must be integers from 0 to 100 with a total from 1 to 100. Clear `OPSDESK_LOAD_ROLE_WEIGHTS` to restore manager-only reads. The schedule is deterministic and interleaves roles according to their weights. The report includes declared read weights, actual per-role/per-operation counts and p50/p95/p99/max latencies, Node version and an explicit uncontrolled-cache declaration. Per-operation names now include the role. Setup, authentication and preflight requests are excluded from measured counts.

Agency, customer and agent traffic rotates through their scoped queue, bookings, case messages and booking history. Supplier traffic alternates the supplier's conversation list and a disposable shared thread. The harness creates that thread and a supplier-visible context message on its own fixture case; case deletion cascades to both. No supplier/customer write capability is introduced. Manager deep queue/history and Insights reads, concentrated note contention and write verification remain available.

Set `OPSDESK_LOAD_IDENTITIES=expanded` to rotate reads within each active role. The expanded fixture uses one manager, two agencies, three customers, four agents and two suppliers. Manager writes retain one identity. Per-role read weights still determine the mix. The report adds measured request counts by seeded identity. Supplier conversations are linked to matching synthetic bookings. With both suppliers active, preflight checks that each can read its own thread and receives HTTP 404 for the other thread. Temporary tickets and conversations are removed after the run.

Clear `OPSDESK_LOAD_IDENTITIES` or set it to `single` to use one account per role. The five-role CI smoke uses the expanded profile. The equal-weight example uses synthetic identities and a single host. Representative account and booking distributions, controlled-cache runs, and agreed latency and throughput targets remain open. Run `npm run ops:test:load-profile` for the profile guards. [Observed expanded-load results](OPSDESK_VALIDATION.md#expanded-load-identity-rehearsal)
