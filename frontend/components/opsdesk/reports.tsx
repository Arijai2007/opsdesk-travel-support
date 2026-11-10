"use client";
import { useOpsPage, PageControls } from "./paged-data";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { TravelInsights } from "@helpdesk/shared";
import type { Workspace, Booking, Person } from "@/lib/opsdesk-types";
import { date, human, request, type Mutation } from "./ui";

const categories = [
  "REFUND",
  "CANCELLATION",
  "BOOKING_CHANGE",
  "CHECK_IN",
  "BAGGAGE",
  "OTHER",
];

export function RoutingSettings({
  data,
  busy,
  mutate,
}: {
  data: Workspace;
  busy: boolean;
  mutate: Mutation;
}) {
  const agents = useOpsPage<Person>("people?kind=AGENT", data.now);
  return (
    <details className="od-panel">
      <summary>Agent specialties</summary>
      <p>Leave an agent’s categories empty for general coverage.</p>
      <PageControls resource={agents} label="agents" />
      {(agents.data?.items ?? []).map((agent) => (
        <form
          key={`${agent.id}:${agent.specialties?.join(",")}:${agent.maxActiveCases}`}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const specialties = form.getAll("specialties");
            const capacity = form.get("maxActiveCases");
            void mutate(
              `agents/${agent.id}/specialties`,
              {
                specialties,
                maxActiveCases: capacity ? Number(capacity) : null,
              },
              `Routing preferences saved for ${agent.name}.`,
              "PATCH",
            ).catch(() => {});
          }}
        >
          <fieldset>
            <legend>
              {agent.name} · {human(agent.region ?? "Unassigned")}
            </legend>
            {categories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  name="specialties"
                  value={category}
                  defaultChecked={agent.specialties?.includes(category)}
                />
                {human(category)}
              </label>
            ))}
            <label>
              Maximum active cases (optional)
              <input
                type="number"
                name="maxActiveCases"
                min={1}
                max={500}
                defaultValue={agent.maxActiveCases ?? ""}
              />
            </label>
            <button className="od-secondary" disabled={busy}>
              Save specialties
            </button>
          </fieldset>
        </form>
      ))}
    </details>
  );
}

export function AgencyResponseSettings({
  data,
  busy,
  mutate,
}: {
  data: Workspace;
  busy: boolean;
  mutate: Mutation;
}) {
  return (
    <details className="od-panel">
      <summary>Agency response targets</summary>
      <p>
        Targets use elapsed hours unless a business calendar is configured. They
        apply to new or reopened cases.
      </p>
      {data.agencies.map((agency) => (
        <form
          key={`${agency.id}:${agency.responsePolicyVersion}`}
          onSubmit={(event) => {
            event.preventDefault();
            const hours = new FormData(event.currentTarget).get("hours");
            void mutate(
              `agencies/${agency.id}/response-policy`,
              { responseTargetHours: Number(hours) },
              `Response target saved for ${agency.name}.`,
              "PATCH",
            ).catch(() => {});
          }}
        >
          <label>
            {agency.name} (hours)
            <input
              type="number"
              name="hours"
              min={1}
              max={168}
              defaultValue={agency.responseTargetHours}
              required
            />
          </label>
          <button className="od-secondary" disabled={busy}>
            Save response target
          </button>
        </form>
      ))}
    </details>
  );
}
function BookingHistory({
  id,
  data,
  onSelect,
}: {
  id: string;
  data: Workspace;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const history = useOpsPage<{ id: string; reference: string }>(
    open ? `bookings/${id}/tickets` : null,
    data.now,
  );
  return (
    <>
      <button className="od-text-button" onClick={() => setOpen(!open)}>
        {open ? "Hide case history" : "View case history"}
      </button>
      {open && (
        <>
          <PageControls resource={history} label="booking cases" />
          {history.data?.items.map((t) => (
            <button
              className="od-text-button"
              key={t.id}
              onClick={() => onSelect(t.id)}
            >
              {t.reference}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </>
      )}
    </>
  );
}
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
  const bookings = useOpsPage<Booking>(
    `bookings?search=${encodeURIComponent(search)}`,
    data.now,
  );
  const filtered = bookings.data?.items ?? [];
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
        <PageControls resource={bookings} label="bookings" />
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
              return (
                <tr key={b.id}>
                  <td>
                    <b className="od-booking-ref">{b.reference}</b>
                    {b.bookingStatus === "CANCELLED" && <small>Cancelled booking · support cases remain separate</small>}
                    <small>
                      {b.destination} · {human(b.region)}
                    </small>
                  </td>
                  <td>{b.customerName || "Traveler"}</td>
                  <td>
                    <b>{b.agency.name}</b>
                    <small>{b.supplier.name}</small>
                  </td>
                  <td>
                    {date(b.checkInAt)}
                    <small>{b.timezone}</small>
                  </td>
                  <td>
                    <BookingHistory id={b.id} data={data} onSelect={onSelect} />
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
export function Insights() {
  const [report, setReport] = useState<TravelInsights | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const next: TravelInsights = await request("insights");
        if (!disposed) {
          setReport(next);
          setError("");
        }
      } catch (cause) {
        if (!disposed)
          setError(
            cause instanceof Error ? cause.message : "Could not load Insights.",
          );
      }
    }
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);
  if (error)
    return (
      <p role="alert" className="od-error">
        {error}
      </p>
    );
  if (!report) return <p role="status">Loading insights…</p>;
  const categoryCounts = categories.map((category) => ({
    label: human(category),
    value:
      report.categories.find((item) => item.category === category)?.count ?? 0,
  }));
  const supplierRows = report.suppliers;
  const trends = report.days.map(({ date, count }) => ({
    label: new Date(date).toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }),
    value: count,
  }));
  return (
    <>
      <div className="od-stats">
        {[
          {
            label: "Median first response",
            value:
              report.medianFirstResponseHours !== null
                ? `${report.medianFirstResponseHours.toFixed(1)}h`
                : "—",
            note: "Customer-visible agent replies only",
          },
          {
            label: "Resolution rate",
            value: report.total
              ? `${Math.round((report.closed / report.total) * 100)}%`
              : "—",
            note: `${report.closed} of ${report.total} cases completed`,
          },
          {
            label: "Median time to resolution",
            value:
              report.medianResolutionHours !== null
                ? `${report.medianResolutionHours.toFixed(1)}h`
                : "—",
            note: "From intake to latest completion",
          },
          {
            label: "Backlog",
            value: report.backlog,
            note: "Cases awaiting completion",
          },
          {
            label: "Repeat-contact bookings",
            value: report.repeatBookings,
            note: "Bookings linked to multiple cases",
          },
          {
            label: "Case deadlines breached",
            value: report.breached,
            note: "Unresolved cases past their earliest deadline",
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
          {categoryCounts.map((c) => (
            <div className="od-bar-row" key={c.label}>
              <span>{c.label}</span>
              <div>
                <i
                  style={{
                    width: `${(c.value / Math.max(1, ...categoryCounts.map((x) => x.value))) * 100}%`,
                  }}
                />
              </div>
              <b>{c.value}</b>
            </div>
          ))}
        </section>
        <section className="od-panel od-chart">
          <h3>Conversations over time</h3>
          <p>New cases in the last 7 UTC days, using the workspace clock.</p>
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
                <tr key={s.id}>
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
