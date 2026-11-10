"use client";
import { useState } from "react";
import type { Workspace, Person, Ticket } from "@/lib/opsdesk-types";
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
          ? `Applied policy v${ticket.slaSnapshot.version}: ${ticket.slaSnapshot.hours} ${ticket.slaSnapshot.calendar ? `business hours in ${ticket.slaSnapshot.calendar.timeZone}` : "elapsed hours"}.`
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
