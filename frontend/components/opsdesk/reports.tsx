"use client";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import type { Workspace } from "@/lib/opsdesk-types";
import { active, date, human } from "./ui";
export function Bookings({
  data,
  search,
  setSearch,
  onSelect,
}: {
  data: Workspace;
  search: string;
  setSearch: (s: string) => void;
  onSelect: (s: string) => void;
}) {
  const filtered = data.bookings.filter((b) =>
    `${b.reference} ${b.destination} ${b.agency.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="od-panel">
      <div className="od-filters">
        <label className="od-search">
          <Search size={17} />
          <input
            aria-label="Search bookings"
            placeholder="Search booking, destination or agency…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span>{filtered.length} connected bookings</span>
      </div>
      <div className="od-table-wrap">
        <table className="od-table">
          <thead>
            <tr>
              <th>BOOKING</th>
              <th>TRAVELER</th>
              <th>AGENCY / SUPPLIER</th>
              <th>TRAVEL DATE</th>
              <th>CONVERSATIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const related = data.tickets.filter((t) => t.bookingId === b.id);
              return (
                <tr key={b.id}>
                  <td>
                    <b className="od-booking-ref">{b.reference}</b>
                    <small>
                      {b.destination} · {human(b.region)}
                    </small>
                  </td>
                  <td>
                    {data.people.find((p) => p.id === b.customerId)?.name ||
                      "Traveler"}
                  </td>
                  <td>
                    <b>{b.agency.name}</b>
                    <small>{b.supplier.name}</small>
                  </td>
                  <td>
                    {date(b.checkInAt)}
                    <small>{b.timezone}</small>
                  </td>
                  <td>
                    {related.map((t) => (
                      <button
                        className="od-text-button"
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                      >
                        {t.reference}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="od-empty">
            <BookOpen size={28} />
            <h3>No matching bookings</h3>
            <p>Try another booking reference or destination.</p>
          </div>
        )}
      </div>
    </section>
  );
}
export function Insights({ data }: { data: Workspace }) {
  const open = data.tickets.filter(active),
    closed = data.tickets.filter((t) => !active(t));
  const median = (a: number[]) => {
    const s = a.sort((a, b) => a - b);
    return s.length
      ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) /
          2
      : 0;
  };
  const responseHours = data.tickets
    .map((t) => {
      // The intake message is not a response, even when staff filed it for a traveler.
      const first = t.messages
        .slice(1)
        .find(
          (m) =>
            m.visibility === "CUSTOMER" &&
            data.people.some(
              (p) =>
                p.id === m.senderId && ["AGENT", "MANAGER"].includes(p.kind),
            ),
        );
      return first
        ? (+new Date(first.createdAt) - +new Date(t.createdAt)) / 3600000
        : null;
    })
    .filter((n): n is number => n !== null && n >= 0);
  const repeatBookings = data.bookings.filter(
    (b) => data.tickets.filter((t) => t.bookingId === b.id).length > 1,
  ).length;
  const categories = [
    "REFUND",
    "CANCELLATION",
    "BOOKING_CHANGE",
    "CHECK_IN",
    "BAGGAGE",
    "OTHER",
  ].map((c) => ({
    label: human(c),
    value: data.tickets.filter((t) => t.category === c).length,
  }));
  const supplierRows = [
    ...new Set(data.bookings.map((b) => b.supplier.name)),
  ].map((name) => {
    const ids = data.bookings
      .filter((b) => b.supplier.name === name)
      .map((b) => b.id);
    const cases = data.tickets.filter(
      (t) => t.bookingId && ids.includes(t.bookingId),
    );
    const threads = data.conversations.filter((c) => c.supplier.name === name);
    return {
      name,
      cases: cases.length,
      open: cases.filter(active).length,
      overdue: threads.filter(
        (c) =>
          c.status === "AWAITING_REPLY" &&
          +new Date(c.dueAt) <= +new Date(data.now),
      ).length,
    };
  });
  const trends = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(+new Date(data.now) - (6 - i) * 86400000);
    const key = day.toISOString().slice(0, 10);
    return {
      label: day.toLocaleDateString("en-GB", { weekday: "short" }),
      value: data.tickets.filter((t) => t.createdAt.slice(0, 10) === key)
        .length,
    };
  });
  return (
    <>
      <div className="od-stats">
        {[
          {
            label: "Median first response",
            value: responseHours.length
              ? `${median(responseHours).toFixed(1)}h`
              : "—",
            note: "Customer-visible agent replies only",
          },
          {
            label: "Resolution rate",
            value: data.tickets.length
              ? `${Math.round((closed.length / data.tickets.length) * 100)}%`
              : "—",
            note: `${closed.length} of ${data.tickets.length} cases completed`,
          },
          {
            label: "Repeat-contact bookings",
            value: repeatBookings,
            note: "Bookings linked to multiple cases",
          },
          {
            label: "Response targets breached",
            value: open.filter(
              (t) => +new Date(t.deadline) <= +new Date(data.now),
            ).length,
            note: "Unresolved cases past response deadline",
          },
        ].map((s) => (
          <div className="od-stat" key={s.label}>
            <div className="od-stat-label">{s.label}</div>
            <b>{s.value}</b>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="od-insight-grid">
        <section className="od-panel od-chart">
          <h3>What travelers need help with</h3>
          <p>All authorized cases, grouped by issue category.</p>
          {categories.map((c) => (
            <div className="od-bar-row" key={c.label}>
              <span>{c.label}</span>
              <div>
                <i
                  style={{
                    width: `${(c.value / Math.max(1, ...categories.map((x) => x.value))) * 100}%`,
                  }}
                />
              </div>
              <b>{c.value}</b>
            </div>
          ))}
        </section>
        <section className="od-panel od-chart">
          <h3>Conversations over time</h3>
          <p>New cases in the last 7 days, using the workspace clock.</p>
          <div className="od-column-chart">
            {trends.map((v, i) => (
              <div key={i}>
                <b>{v.value}</b>
                <span
                  style={{
                    height: `${Math.max(3, (v.value / Math.max(1, ...trends.map((x) => x.value))) * 120)}px`,
                  }}
                />
                <small>{v.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="od-panel">
        <div className="od-section-title">
          <div>
            <h3>Supplier performance</h3>
            <p>
              Identify where follow-ups and repeat issues need a closer look.
            </p>
          </div>
          <span className="od-pill">From persisted case records</span>
        </div>
        <div className="od-table-wrap">
          <table className="od-table">
            <thead>
              <tr>
                <th>SUPPLIER</th>
                <th>TOTAL CASES</th>
                <th>ACTIVE CASES</th>
                <th>OVERDUE SUPPLIER REPLIES</th>
              </tr>
            </thead>
            <tbody>
              {supplierRows.map((s) => (
                <tr key={s.name}>
                  <td>
                    <b>{s.name}</b>
                  </td>
                  <td>{s.cases}</td>
                  <td>{s.open}</td>
                  <td>
                    {s.overdue ? (
                      <span className="od-overdue">
                        {s.overdue} need follow-up
                      </span>
                    ) : (
                      <span className="od-positive">On track</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="od-metrics-note">
        Metrics use visible database records. First response measures the first
        customer-visible staff reply; internal notes and supplier replies are
        excluded. All demo data is synthetic.
      </p>
    </>
  );
}
