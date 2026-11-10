"use client";
import { useState } from "react";
import type {
  Workspace,
  Person,
  Ticket,
  AgencyContract,
} from "@/lib/opsdesk-types";
import { DirectorySelect } from "./directory-select";
import type { Mutation } from "./ui";
export type ServiceCalendar = {
  timeZone: string;
  week: { day: number; start: number; end: number }[];
  holidays: string[];
};
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const initial: ServiceCalendar = {
  timeZone: "UTC",
  week: [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 })),
  holidays: [],
};
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minute = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
function CalendarFields({
  value,
  onChange,
}: {
  value: ServiceCalendar | null;
  onChange: (value: ServiceCalendar | null) => void;
}) {
  const calendar = value ?? initial;
  return (
    <fieldset>
      <label>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? initial : null)}
        />
        Use scheduled hours
      </label>
      {value && (
        <>
          <label>
            Calendar time zone
            <input
              required
              value={calendar.timeZone}
              onChange={(e) =>
                onChange({ ...calendar, timeZone: e.target.value })
              }
              placeholder="Europe/London"
            />
          </label>
          <p>
            Intervals include the start and exclude the end. Split overnight
            coverage into two days. Use 24:00 for midnight at the end of a day.
          </p>
          {calendar.week.map((w, i) => (
            <div className="od-flex" key={`${i}:${w.day}:${w.start}:${w.end}`}>
              <label>
                Day
                <select
                  value={w.day}
                  onChange={(e) =>
                    onChange({
                      ...calendar,
                      week: calendar.week.map((v, j) =>
                        j === i ? { ...v, day: Number(e.target.value) } : v,
                      ),
                    })
                  }
                >
                  {days.map((day, n) => (
                    <option value={n} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start
                <input
                  required
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                  defaultValue={time(w.start)}
                  onBlur={(e) =>
                    onChange({
                      ...calendar,
                      week: calendar.week.map((v, j) =>
                        j === i ? { ...v, start: minute(e.target.value) } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                End
                <input
                  required
                  pattern="(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
                  defaultValue={time(w.end)}
                  onBlur={(e) =>
                    onChange({
                      ...calendar,
                      week: calendar.week.map((v, j) =>
                        j === i ? { ...v, end: minute(e.target.value) } : v,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="od-secondary"
                onClick={() =>
                  onChange({
                    ...calendar,
                    week: calendar.week.filter((_, j) => i !== j),
                  })
                }
              >
                Remove interval
              </button>
            </div>
          ))}
          <button
            type="button"
            className="od-secondary"
            disabled={calendar.week.length >= 28}
            onClick={() =>
              onChange({
                ...calendar,
                week: [...calendar.week, { day: 1, start: 540, end: 1020 }],
              })
            }
          >
            Add interval
          </button>
          <label>
            Holidays (one YYYY-MM-DD date per line)
            <textarea
              value={calendar.holidays.join("\n")}
              onChange={(e) =>
                onChange({ ...calendar, holidays: e.target.value.split("\n") })
              }
              onBlur={() =>
                onChange({
                  ...calendar,
                  holidays: calendar.holidays.filter(Boolean),
                })
              }
            />
          </label>
        </>
      )}
    </fieldset>
  );
}
function AgencyCalendar({
  agency,
  busy,
  mutate,
}: {
  agency: Workspace["agencies"][number];
  busy: boolean;
  mutate: Mutation;
}) {
  const [calendar, setCalendar] = useState<ServiceCalendar | null>(
    agency.slaCalendar ?? null,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const reason = String(new FormData(e.currentTarget).get("reason"));
        void mutate(
          `agencies/${agency.id}/calendar`,
          { calendar, reason },
          "Calendar saved for future case cycles.",
          "PATCH",
        ).catch(() => {});
      }}
    >
      <h4>{agency.name} business calendar</h4>
      <CalendarFields value={calendar} onChange={setCalendar} />
      <label>
        Calendar change reason
        <input name="reason" required minLength={3} maxLength={1000} />
      </label>
      <button className="od-secondary" disabled={busy}>
        Save calendar
      </button>
    </form>
  );
}
function ShiftCalendar({
  member,
  refresh,
  busy,
  mutate,
}: {
  member: Person;
  refresh: string;
  busy: boolean;
  mutate: Mutation;
}) {
  const [calendar, setCalendar] = useState<ServiceCalendar | null>(
    member.shiftCalendar ?? null,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const reason = String(new FormData(e.currentTarget).get("reason"));
        void mutate(
          `members/${member.id}/shift`,
          { calendar, reason },
          "Coverage saved. Existing agent assignments are preserved.",
          "PATCH",
        ).catch(() => {});
      }}
    >
      <h4>Coverage for {member.name}</h4>
      <small>
        Workspace refreshed {new Date(refresh).toLocaleTimeString()}
      </small>
      <CalendarFields value={calendar} onChange={setCalendar} />
      <label>
        Shift change reason
        <input name="reason" required minLength={3} maxLength={1000} />
      </label>
      <button className="od-secondary" disabled={busy}>
        Save shift
      </button>
    </form>
  );
}
export function SlaSettings({
  data,
  busy,
  mutate,
}: {
  data: Workspace;
  busy: boolean;
  mutate: Mutation;
}) {
  const [kind, setKind] = useState("AGENT"),
    [member, setMember] = useState<Person>();
  return (
    <details className="od-panel">
      <summary>SLA calendars and duty coverage</summary>
      <p>
        Calendars apply to new and reopened cases. Existing cases keep their
        policy snapshot. No schedule means elapsed hours for agency targets and
        continuous coverage for members. Availability and suspension still
        apply.
      </p>
      {data.agencies.map((a) => (
        <AgencyCalendar
          key={`${a.id}:${a.responsePolicyVersion}`}
          agency={a}
          busy={busy}
          mutate={mutate}
        />
      ))}
      <ContractSettings data={data} busy={busy} mutate={mutate} />
      <SupplierCalendarSettings
        refresh={data.now}
        busy={busy}
        mutate={mutate}
      />
      <h4>Agent and escalation-manager shifts</h4>
      <label>
        Coverage role
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setMember(undefined);
          }}
        >
          <option value="AGENT">Agent</option>
          <option value="MANAGER">Manager</option>
        </select>
      </label>
      <DirectorySelect<Person>
        path={`people?kind=${kind}`}
        label="Coverage member"
        refresh={data.now}
        value={member?.id ?? ""}
        onSelect={(_, p) => setMember(p)}
        text={(p) => p.name}
      >
        <option value="">Choose a member</option>
      </DirectorySelect>
      {member && (
        <ShiftCalendar
          key={`${member.id}:${JSON.stringify(member.shiftCalendar)}`}
          member={member}
          refresh={data.now}
          busy={busy}
          mutate={mutate}
        />
      )}
    </details>
  );
}
function ContractEditor({
  agencyId,
  contract,
  busy,
  mutate,
  saved,
}: {
  agencyId: string;
  contract?: AgencyContract;
  busy: boolean;
  mutate: Mutation;
  saved: () => void;
}) {
  const [name, setName] = useState(contract?.name ?? "");
  const [hours, setHours] = useState(contract?.responseTargetHours ?? 24);
  const [calendar, setCalendar] = useState<ServiceCalendar | null>(
    contract?.slaCalendar ?? null,
  );
  const [enabled, setEnabled] = useState(contract?.active ?? true);
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void mutate(
          `agencies/${agencyId}/contracts${contract ? `/${contract.id}` : ""}`,
          {
            name,
            responseTargetHours: hours,
            calendar,
            active: enabled,
            reason,
          },
          "Agency contract saved.",
          contract ? "PATCH" : "POST",
        )
          .then(saved)
          .catch(() => {});
      }}
    >
      <h4>{contract ? "Edit agency contract" : "Create agency contract"}</h4>
      <label>
        Contract name
        <input
          required
          minLength={3}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Contract response hours
        <input
          required
          type="number"
          min={1}
          max={168}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Active for new cases
      </label>
      <CalendarFields value={calendar} onChange={setCalendar} />
      <label>
        Contract change reason
        <input
          required
          minLength={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button className="od-secondary" disabled={busy}>
        Save contract
      </button>
    </form>
  );
}
function ContractSettings({
  data,
  busy,
  mutate,
}: {
  data: Workspace;
  busy: boolean;
  mutate: Mutation;
}) {
  const [agencyId, setAgencyId] = useState(data.agencies[0]?.id ?? "");
  const [contract, setContract] = useState<AgencyContract>();
  const [revision, setRevision] = useState(0);
  return (
    <section>
      <h4>Agency contracts</h4>
      <p>
        Each contract has independent response hours and a calendar. Retiring
        one prevents new selection; existing cases keep their reference.
        Reopening uses the current policy for the same contract.
      </p>
      <label>
        Contract agency
        <select
          aria-label="Contract agency"
          value={agencyId}
          disabled={busy}
          onChange={(e) => {
            setAgencyId(e.target.value);
            setContract(undefined);
          }}
        >
          {data.agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {agencyId && (
        <>
          <DirectorySelect<AgencyContract>
            key={agencyId}
            path={`contracts?agencyId=${encodeURIComponent(agencyId)}&includeInactive=1`}
            label="Contract to edit"
            refresh={`${data.now}:${revision}`}
            value={contract?.id ?? ""}
            disabled={busy}
            onSelect={(_, item) => setContract(item)}
            text={(c) =>
              `${c.name}${c.active ? "" : " (retired)"}  -  v${c.responsePolicyVersion}`
            }
          >
            <option value="">Create a new contract</option>
          </DirectorySelect>
          <ContractEditor
            key={`${agencyId}:${contract?.id}:${contract?.responsePolicyVersion}:${revision}`}
            agencyId={agencyId}
            contract={contract}
            busy={busy}
            mutate={mutate}
            saved={() => {
              setContract(undefined);
              setRevision((v) => v + 1);
            }}
          />
        </>
      )}
    </section>
  );
}
type SupplierPolicy = {
  id: string;
  name: string;
  slaCalendar: ServiceCalendar | null;
  responseTargetHours: number;
  responsePolicyVersion: number;
};
function SupplierCalendar({
  supplier,
  busy,
  mutate,
}: {
  supplier: SupplierPolicy;
  busy: boolean;
  mutate: Mutation;
}) {
  const [calendar, setCalendar] = useState(supplier.slaCalendar);
  const [hours, setHours] = useState(supplier.responseTargetHours);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get("reason"));
        void mutate(
          `suppliers/${supplier.id}/calendar`,
          { calendar, responseTargetHours: hours, reason },
          "Supplier policy saved for future response cycles.",
          "PATCH",
        ).catch(() => {});
      }}
    >
      <h4>{supplier.name} response calendar</h4>
      <label>
        Supplier response hours
        <input
          type="number"
          min={1}
          max={168}
          required
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
        />
      </label>
      <CalendarFields value={calendar} onChange={setCalendar} />
      <label>
        Supplier policy reason
        <input name="reason" required minLength={3} maxLength={1000} />
      </label>
      <button className="od-secondary" disabled={busy}>
        Save supplier policy
      </button>
    </form>
  );
}
function SupplierCalendarSettings({
  refresh,
  busy,
  mutate,
}: {
  refresh: string;
  busy: boolean;
  mutate: Mutation;
}) {
  const [supplier, setSupplier] = useState<SupplierPolicy>();
  return (
    <>
      <h4>Supplier response calendars</h4>
      <DirectorySelect<SupplierPolicy>
        key={refresh}
        disabled={busy}
        path="admin/suppliers"
        label="Supplier calendar"
        refresh={refresh}
        value={supplier?.id ?? ""}
        onSelect={(_, item) => setSupplier(item)}
        text={(item) => item.name}
      >
        <option value="">Choose a supplier</option>
      </DirectorySelect>
      {supplier && (
        <SupplierCalendar
          key={supplier.id}
          supplier={supplier}
          busy={busy}
          mutate={mutate}
        />
      )}
    </>
  );
}
export function TicketSlaControls({
  ticket,
  manager,
  refresh,
  busy,
  mutate,
}: {
  ticket: Ticket;
  manager: boolean;
  refresh: string;
  busy: boolean;
  mutate: Mutation;
}) {
  const [owner, setOwner] = useState(ticket.escalationOwnerId ?? "");
  return (
    <section className="od-panel">
      <h4>SLA and escalation coverage</h4>
      <p>
        {ticket.slaSnapshot
          ? `${ticket.slaSnapshot.contractName ? `Contract ${ticket.slaSnapshot.contractName}  -  ` : "Agency "}Applied policy v${ticket.slaSnapshot.version}: ${ticket.slaSnapshot.hours} ${ticket.slaSnapshot.calendar ? `business hours in ${ticket.slaSnapshot.calendar.timeZone}` : "elapsed hours"}.`
          : "Legacy elapsed-hour response target."}
      </p>
      <p>
        {ticket.slaPausedAt
          ? "Response clock paused. Travel and supplier deadlines remain active."
          : "Response clock running."}
      </p>
      <p>
        Escalation owner:{" "}
        {ticket.escalationOwnerName ||
          (ticket.escalationOwnerId
            ? "Assigned manager"
            : "Unowned - requires manager coverage")}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const reason = String(new FormData(e.currentTarget).get("reason"));
          void mutate(
            `tickets/${ticket.id}/sla-pause`,
            { paused: !ticket.slaPausedAt, reason },
            ticket.slaPausedAt
              ? "Response clock resumed."
              : "Response clock paused.",
            "PATCH",
          ).catch(() => {});
        }}
      >
        <label>
          SLA pause or resume reason
          <input required name="reason" minLength={3} maxLength={1000} />
        </label>
        <button
          className="od-secondary"
          disabled={busy || ["CLOSED", "RESOLVED"].includes(ticket.status)}
        >
          {ticket.slaPausedAt
            ? "Resume response clock"
            : "Pause response clock"}
        </button>
      </form>
      {manager && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const reason = String(
              new FormData(event.currentTarget).get("reason"),
            );
            void mutate(
              `tickets/${ticket.id}/handoff-policy`,
              { enabled: !ticket.autoHandoff, reason },
              "Workload handoff policy updated.",
              "PATCH",
            ).catch(() => {});
          }}
        >
          <p>
            Automatic workload handoff{" "}
            {ticket.autoHandoff ? "enabled" : "disabled"}.
          </p>
          <label>
            Workload handoff reason
            <input required name="reason" minLength={3} maxLength={1000} />
          </label>
          <button
            className="od-secondary"
            disabled={busy || ["CLOSED", "RESOLVED"].includes(ticket.status)}
          >
            {ticket.autoHandoff
              ? "Disable automatic handoff"
              : "Enable automatic handoff"}
          </button>
        </form>
      )}
      {manager && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason"));
            void mutate(
              `tickets/${ticket.id}/escalation-owner`,
              { ownerId: owner || null, reason },
              "Escalation ownership updated.",
              "PATCH",
            ).catch(() => {});
          }}
        >
          <DirectorySelect<Person>
            path="people?kind=MANAGER"
            label="Escalation manager"
            refresh={refresh}
            value={owner}
            onSelect={setOwner}
            text={(p) => p.name}
          >
            <option value="">Release to automatic coverage</option>
          </DirectorySelect>
          <label>
            Ownership change reason
            <input required name="reason" minLength={3} maxLength={1000} />
          </label>
          <button className="od-secondary" disabled={busy}>
            Save escalation owner
          </button>
        </form>
      )}
    </section>
  );
}
