# SLA calendars, shifts and escalation ownership

## Multiple agency contracts

Managers create and edit independent contracts under **Needs attention > SLA calendars and duty coverage > Agency contracts**. Each contract has its own name, active state, 1-168 response service hours, optional business calendar and monotonically increasing policy version. A reason is required; changed saves produce one membership audit record. Identical normalized PATCH requests, including concurrent retries, preserve the version and create no additional audit event. POST creates a distinct contract; clients must retain the returned ID and use PATCH for subsequent changes.

`GET /ops/contracts?agencyId=...&search=...&page=...` returns at most 20 active contracts, stable name/ID ordering and `selectionRequired`. Customers and agency members can read only their persisted agency; suppliers are denied. Staff may read agency policies, but existing regional/customer case authorization still governs intake and case access. `includeInactive=1` is manager-only. Contract access follows existing agency membership; there are no additional per-contract user grants in this increment.

Manager routes are `POST /ops/agencies/:id/contracts` and `PATCH /ops/agencies/:id/contracts/:contractId`. Both accept `{name, active, responseTargetHours, calendar, reason}`. Agency identity is immutable. There is no delete or ticket contract-reassignment endpoint. Retirement blocks new selection while retaining historical references. A composite foreign key prevents a case from referencing a contract in another agency and restricts deletion of referenced contracts.

New cases accept an explicit `contractId`. An agency with any contract record requires selection of an active contract, even if all its contracts are retired; it never silently falls back. Agencies with no contracts retain the existing agency default. Existing cases remain unchanged and keep null contract references; migration never rewrites deadlines or snapshots. The UI resets contract selection when the booking agency changes, and the API independently verifies agency/customer/region and contract ownership.

A selected contract saves its ID/name plus calendar, hours and version in each response-cycle snapshot. Editing/retiring a policy preserves active deadlines, paused budgets, supplier cycles and history. Reopening keeps the original contract (including a retired one) and starts a new cycle with that contract's current policy. Legacy cases continue to reopen under the agency default, even after contracts are added. Intake, reopen and policy writers share the existing capacity lock so snapshots cannot mix versions. Response pause/resume and travel deadline rules continue unchanged.

Targeted checks: `node scripts/contracts-smoke.mjs` and `node scripts/contracts-browser.mjs`. Both are included in the standard test commands; browser engine selection works as for the existing suites. Richer escalation rotations and override policies remain next.

## Supplier response cycles

The manager endpoint `PATCH /ops/suppliers/:id/calendar` accepts a calendar (or null), an integer responseTargetHours from 1 through 168 and a reason. Saving changed hours or a changed schedule increments the supplier's policy version and records the actor and reason. Submitting the same normalized policy preserves its version. Null selects elapsed hours. Weekly intervals, holidays and time zones use the same service-time calculator as agency calendars.

Opening a supplier thread, sending a staff follow-up or reopening a closed thread starts a response cycle. The transaction reads the supplier policy under a shared supplier-row lock and stores the calculated due date and the applied hours, calendar and version on the thread. Each new cycle replaces that snapshot. Supplier replies and repeated status requests preserve the existing deadline. Migration leaves existing due dates intact. Supplier escalation continues to use the saved due date even when the case response clock is paused.

Deployment remains paused. This feature starts from main `6e97b6f`, the merge of PR #28 (`3b07fa4`). The PR's hosted `validate` check passed on [run 42812617605](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42812617605). Old uncommitted work in another checkout was preserved; this implementation uses a separate worktree.

## Calendar contract

Agency response targets retain elapsed-hour behavior until a manager explicitly enables a business calendar. A calendar contains an IANA time zone, 1-28 non-overlapping weekly intervals and up to 100 local holiday dates. Weekdays are Sunday=0 through Saturday=6. Intervals include their start and exclude their end, use whole minutes from 0 to 1440, and cannot cross midnight: represent overnight coverage with two intervals. Holidays are explicit local YYYY-MM-DD dates, not annually repeating rules.

Business budgets consume actual elapsed time only while the local calendar is open. A skipped DST minute contributes no time; both real occurrences of a repeated minute contribute time. Half-hour zones and local holiday dates across UTC midnight are covered. Budgets preserve millisecond precision. Calculations search at most 366 days; insufficient coverage is rejected rather than silently using an elapsed fallback. Configuration verifies coverage for the largest supported 168-hour target. This bounded minute-based calculator is suitable for this prototype; sparse-calendar CPU cost and a more efficient interval engine need separate load measurement.

The migration adds nullable agency/profile calendars and ticket snapshot/pause/owner fields without rewriting existing deadlines. New and reopened cases save the full applied calendar, hours and policy version. Editing agency calendar/hours affects future cycles, not active snapshots. Reopening retains the existing case owner but starts a fresh current-policy response cycle. Agency defaults remain supported alongside independent agency contracts and supplier-specific business calendars; see the current sections above.

## Pause and travel behavior

Authorized staff may explicitly pause/resume an active case's response clock with a reason. Waiting statuses do not pause it automatically, and messages do not resume it automatically. Pause records the remaining service-time budget under the applied snapshot; resume consumes that budget from the new effective time. Repeating the same state is idempotent under the existing capacity-then-ticket lock order. Closed/resolved cases reject pause/resume; reopening resets the pause state. An already breached response target cannot be paused to hide the breach.

Pausing never stops booking check-in, departure, cancellation or supplier-thread deadlines. The effective case deadline continues to use travel constraints; refunds retain their existing independent response-target behavior. If a paused refund has no travel constraint, its effective deadline uses a far-future sentinel and the interface displays `Response SLA paused`. The original response target remains stored for audit. Resume and schedule/link edits preserve the relevant travel deadline. Priority automation still never lowers a higher priority.

## Coverage and ownership

A manager may configure an agent or manager's shift using the same calendar format. No shift means continuous coverage, preserving prior behavior. Availability, active membership, regional/category eligibility and automatic capacity limits still apply. Automatic intake leaves a case unassigned when no eligible agent is on duty. A new manual assignment to an off-duty member is rejected. Existing assignments are preserved unless automatic workload handoff is explicitly enabled; reopening retains the current owner. See the workload-handoff section below.

For an active case with an unacknowledged escalation or supplier-overdue alert, the sweep preserves an active, available, on-duty escalation manager. If that manager loses coverage, it selects another eligible manager in stable user-ID order. With no coverage it clears ownership, and the case displays an explicit unowned state for the manager queue. When coverage returns, the next sweep assigns an owner. Managers may explicitly change ownership with a reason; releasing ownership returns it to automatic coverage on the next sweep. Acknowledgment continues to preserve the original alert and audit history; no alert is acknowledged automatically by an ownership change.

Ownership changes are serialized under the parent ticket row, with fresh persisted state read before each change. Workers take shared manager-profile locks in ID order and reread coverage after pending membership/availability changes commit; profile writers do not acquire ticket locks, preserving lock ordering. Duplicate workers do not duplicate handoff or escalation events. They do not acquire the capacity lock after taking a ticket lock. Calendar and shift administration share the capacity lock used by membership/assignment changes. No changes are made to invitation secrets, immutable identity scopes, token/session checks, membership suspension or active-case preservation.

## API and UI

All routes require JWT authentication and active persisted membership:

| Route | Access and effect |
| --- | --- |
| `PATCH /ops/agencies/:id/calendar` | Manager; `{calendar: object or null, reason}`; versioned, idempotent future-cycle calendar |
| `PATCH /ops/members/:id/shift` | Manager; `{calendar: object or null, reason}`; agent/manager duty coverage |
| `PATCH /ops/tickets/:id/sla-pause` | Authorized staff; `{paused: boolean, reason}`; explicit response budget pause/resume |
| `PATCH /ops/tickets/:id/escalation-owner` | Manager; `{ownerId: active on-duty manager ID or null, reason}`; audited ownership |

Managers use **Needs attention > SLA calendars and duty coverage**. Case staff see the applied snapshot and response-clock controls; managers also see an ownership selector. Shift metadata is included only in manager directory responses. Policy/shift changes use the existing paginated membership audit; case pause/resume/ownership use the private case activity history. Invitation credentials and customer/supplier message contents are not included in policy audits.

## Verification and remaining work

`sla-calendar.spec.ts` was added before implementation. Its first executable run failed because the module did not exist; calendar rules were then implemented. Initial execution while dependencies were still installing separately failed to load TypeScript and ran zero tests; that is a toolchain failure, not a red product test. Real HTTP tests subsequently exposed JSONB key-order idempotency and insufficient-coverage error handling, both fixed and rechecked. See the validation report for exact current counts and browser results.

`scripts/sla-smoke.mjs` uses a temporary agency, customer, manager, booking and cases, restores calendars/clock and removes fixtures. It compares deadlines to the applied snapshot, checks endpoint denials, off-duty assignment, immutable active targets, reopen, overlapping pause/resume and worker handoffs, and durable alerts after disconnect/reconnect. This reconnect check does not claim OS process-kill or database crash recovery. The existing concurrency, membership and worker-restart suites remain intact.

`scripts/sla-browser.mjs` exercises calendar/holiday configuration, duty coverage, pause/resume and ownership through the actual manager UI. The combined browser command runs the original five-role, membership and SLA flows in the selected engine.

Remaining feature work includes richer escalation rotations, live email/outbox/inbound signatures, authorized/scanned attachments, provider-neutral booking integration and independent AI evaluation. Broader assistive-technology, skewed read/write load and failure-injection checks remain open. Hosting, staging/live-data policy work and deployment preparation remain paused.

## Reconstructed automatic workload handoff

PR #29 is merged into main 12114c6. The uncommitted Arihant checkout referenced by the transfer message was unavailable on this ASUS machine. This follow-up was reconstructed from that message in a separate worktree; its validation results apply only to this implementation. Deployment remains paused.

Managers may opt an active case into automatic handoff with a recorded reason. New and existing cases default to disabled. The sweep preserves an eligible current owner, regardless of their existing capacity load. When coverage ends through shift, availability, membership or eligibility changes, the sweep selects an on-duty replacement using the existing regional/category and capacity policy. With no capacity, it clears the owner and retries on later sweeps. Repeated unchanged decisions add no audit event. Waiting and SLA-paused cases participate, while closed/resolved cases are excluded. Manual assignment disables automation, including a manager reaffirming the same owner. Paused budgets, travel deadlines and supplier threads keep their existing state.

Each candidate runs under the shared capacity lock followed by the parent ticket lock and fresh reads. Workers page opted-in active case IDs in batches of 100. The pass still visits all opted-in active cases each sweep, so large-volume scheduling needs further measurement. Existing assignment and membership writers use the same capacity protocol. No external provider is required.
