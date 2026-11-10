# SLA calendars, shifts and escalation ownership

Deployment remains paused. This feature starts from main `6e97b6f`, the merge of PR #28 (`3b07fa4`). The PR's hosted `validate` check passed on [run 42812617605](https://github.com/DhruvKhanna7777/opsdesk-travel-support/actions/runs/42812617605). Old uncommitted work in another checkout was preserved; this implementation uses a separate worktree.

## Calendar contract

Agency response targets retain elapsed-hour behavior until a manager explicitly enables a business calendar. A calendar contains an IANA time zone, 1-28 non-overlapping weekly intervals and up to 100 local holiday dates. Weekdays are Sunday=0 through Saturday=6. Intervals include their start and exclude their end, use whole minutes from 0 to 1440, and cannot cross midnight: represent overnight coverage with two intervals. Holidays are explicit local YYYY-MM-DD dates, not annually repeating rules.

Business budgets consume actual elapsed time only while the local calendar is open. A skipped DST minute contributes no time; both real occurrences of a repeated minute contribute time. Half-hour zones and local holiday dates across UTC midnight are covered. Budgets preserve millisecond precision. Calculations search at most 366 days; insufficient coverage is rejected rather than silently using an elapsed fallback. Configuration verifies coverage for the largest supported 168-hour target. This bounded minute-based calculator is suitable for this prototype; sparse-calendar CPU cost and a more efficient interval engine need separate load measurement.

The migration adds nullable agency/profile calendars and ticket snapshot/pause/owner fields without rewriting existing deadlines. New and reopened cases save the full applied calendar, hours and policy version. Editing agency calendar/hours affects future cycles, not active snapshots. Reopening retains the existing case owner but starts a fresh current-policy response cycle. One agency-level calendar is supported; multiple independent contracts inside one agency and supplier-specific business calendars are not implemented.

## Pause and travel behavior

Authorized staff may explicitly pause/resume an active case's response clock with a reason. Waiting statuses do not pause it automatically, and messages do not resume it automatically. Pause records the remaining service-time budget under the applied snapshot; resume consumes that budget from the new effective time. Repeating the same state is idempotent under the existing capacity-then-ticket lock order. Closed/resolved cases reject pause/resume; reopening resets the pause state. An already breached response target cannot be paused to hide the breach.

Pausing never stops booking check-in, departure, cancellation or supplier-thread deadlines. The effective case deadline continues to use travel constraints; refunds retain their existing independent response-target behavior. If a paused refund has no travel constraint, its effective deadline uses a far-future sentinel and the interface displays `Response SLA paused`. The original response target remains stored for audit. Resume and schedule/link edits preserve the relevant travel deadline. Priority automation still never lowers a higher priority.

## Coverage and ownership

A manager may configure an agent or manager's shift using the same calendar format. No shift means continuous coverage, preserving prior behavior. Availability, active membership, regional/category eligibility and automatic capacity limits still apply. Automatic intake leaves a case unassigned when no eligible agent is on duty. A new manual assignment to an off-duty member is rejected. Existing assignments are preserved at shift end, during suspension, and on reopen; automatic agent workload handoff is not implemented.

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

Remaining feature work includes multi-contract calendars, supplier business calendars, automatically handing existing agent workload to another shift, richer escalation rotations, live email/outbox/inbound signatures, authorized/scanned attachments, provider-neutral booking integration and independent AI evaluation. Broader assistive-technology, skewed read/write load and failure-injection checks remain open. Hosting, staging/live-data policy work and deployment preparation remain paused.
