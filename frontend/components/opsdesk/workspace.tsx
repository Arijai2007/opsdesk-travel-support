"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SlaSettings } from "./sla-settings";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Inbox,
  Layers3,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  TicketCheck,
  X,
} from "lucide-react";
import { DirectorySelect } from "./directory-select";
import type { Workspace, Person } from "@/lib/opsdesk-types";
import {
  active,
  Badge,
  date,
  human,
  initials,
  Modal,
  remaining,
  request,
  type Mutation,
} from "./ui";
import { OpsLogin } from "./login";
import { Membership } from "./membership";
import { NewTicket, OnDemandTicket, SupplierDesk } from "./ticket-detail";
import { useTravelQueue } from "./use-travel-queue";
import { MailOutbox } from "./mail-outbox";
import { BookingRequests } from "./booking-requests";
import {
  AgencyResponseSettings,
  Bookings,
  Insights,
  RoutingSettings,
} from "./reports";
export function OpsDeskWorkspace() {
  const noticesButton = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<Workspace | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  const [view, setView] = useState("inbox"),
    [selected, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState("active"),
    [search, setSearch] = useState(""),
    [priority, setPriority] = useState("ALL"),
    [region, setRegion] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [owner, setOwner] = useState("ALL"),
    [deadline, setDeadline] = useState("ALL"),
    [showNew, setShowNew] = useState(false),
    [showNotices, setShowNotices] = useState(false),
    [showClock, setShowClock] = useState(false),
    [showHelp, setShowHelp] = useState(false);
  const queue = useTravelQueue(
    data?.me.id,
    Boolean(
      data &&
      data.me.kind !== "SUPPLIER" &&
      !selected &&
      ["inbox", "manager"].includes(view),
    ),
    {
      search,
      tab,
      priority,
      region,
      status,
      owner,
      deadline,
      attention: view === "manager" ? "1" : "",
    },
    data?.now,
  );
  const load = useCallback(() => {
    return request("workspace?compact=1")
      .then((workspace: Workspace) => {
        setData(workspace);
        setError("");
      })
      .catch((e: unknown) => {
        if ((e as { status?: number }).status === 401) setData(null);
        else setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const mutate: Mutation = async (path, body, message, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      const value = await request(path, body, method);
      await load();
      setToast(message);
      return value;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return (
      <div className="od-loading">
        <Layers3 size={35} />
        <h2>Opening your workspace</h2>
        <p>Connecting bookings, conversations and deadlines…</p>
      </div>
    );
  if (!data)
    return (
      <>
        {error && (
          <div className="od-global-error" role="alert">
            {error}
          </div>
        )}
        <OpsLogin onLogin={load} />
      </>
    );
  const staff = ["AGENT", "MANAGER"].includes(data.me.kind),
    manager = data.me.kind === "MANAGER",
    supplier = data.me.kind === "SUPPLIER";
  const counts = data.counts;
  const person = (id: string | null) =>
    data.people.find((p) => p.id === id)?.name || "Unassigned";
  const agency = (id: string) =>
    data.agencies.find((a) => a.id === id)?.name || "Agency";
  const rows = queue.data?.items ?? [];
  const currentPage = queue.data?.page ?? 1;
  function navigate(next: string) {
    setView(next);
    setSelected(null);
    setSearch("");
    setTab("active");
    setPriority("ALL");
    setRegion("ALL");
    setStatus("ALL");
    setOwner("ALL");
    setDeadline("ALL");
  }
  const nav = [
    {
      id: "inbox",
      label: "All conversations",
      icon: Inbox,
      count: counts.open,
    },
    ...(staff
      ? [
          {
            id: "manager",
            label: "Needs attention",
            icon: Clock3,
            count: counts.attention,
          },
        ]
      : []),
    {
      id: "bookings",
      label: "Bookings",
      icon: BookOpen,
      count: 0,
    },
    ...(staff
      ? [{ id: "insights", label: "Insights", icon: LayoutDashboard, count: 0 }]
      : []),
  ];
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setData(null);
    setSelected(null);
    setView("inbox");
  }
  function exportCsv() {
    const values = [
      [
        "Reference",
        "Subject",
        "Booking",
        "Region",
        "Category",
        "Priority",
        "Status",
        "Deadline",
      ],
      ...rows.map((t) => [
        t.reference,
        t.title,
        t.booking?.reference || "",
        t.region,
        t.category,
        t.priority,
        t.status,
        t.deadline,
      ]),
    ];
    const csv = values
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              (/^[=+@-]/.test(v) ? "'" : "") +
              v.replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "opsdesk-current-page.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="od-app">
      <aside className="od-sidebar">
        <Link href="/" className="od-brand">
          <span className="od-brandmark">
            <Layers3 size={22} />
          </span>
          opsdesk<span className="od-brand-dot">.</span>
        </Link>
        <div className="od-workspace-switch">
          <span className="od-workspace-icon">O</span>
          <div>
            <b>Travel operations</b>
            <small>{human(data.me.kind)} workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="od-nav-label">WORKSPACE</span>
        <nav>
          {supplier ? (
            <button className="active">
              <MessageSquare size={18} />
              Supplier conversations<span>{counts.supplierThreads}</span>
            </button>
          ) : (
            nav.map((n) => (
              <button
                key={n.id}
                className={view === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={18} />
                {n.label}
                {n.count > 0 && <span>{n.count}</span>}
              </button>
            ))
          )}
        </nav>
        <div className="od-sidebar-note">
          <span className="od-connection">
            <i />
            All the context, connected
          </span>
          <p>
            Every booking has a story.
            <br />
            Keep yours in one place.
          </p>
          <span className="od-mini-line" />
          <small>
            Records-based summaries
            <br />
            No external AI connection required
          </small>
        </div>
        <div className="od-sidebar-bottom">
          <button onClick={() => setShowHelp(true)}>
            <CircleHelp size={17} />
            Workspace guide
            <ArrowUpRight size={14} />
          </button>
          <div className="od-user">
            <span className="od-avatar">{initials(data.me.name)}</span>
            <div>
              <b>{data.me.name}</b>
              <small>{human(data.me.kind)}</small>
            </div>
            <button
              className="od-icon"
              onClick={() => void logout()}
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="od-shell">
        <header className="od-topbar">
          <div className="od-breadcrumb">
            Workspace <ChevronRight size={14} />
            <b>
              {supplier
                ? "Supplier desk"
                : view === "manager"
                  ? "Needs attention"
                  : human(view)}
            </b>
          </div>
          <div className="od-topbar-actions">
            <span className="od-demo-badge">
              <i />
              Demo workspace
            </span>
            {manager && data.demoClockEnabled && (
              <button className="od-quiet" onClick={() => setShowClock(true)}>
                <Clock3 size={15} />
                Demo clock
                {data.clockOffsetMinutes > 0
                  ? ` +${data.clockOffsetMinutes < 60 ? data.clockOffsetMinutes + "m" : (data.clockOffsetMinutes / 60).toFixed(1) + "h"}`
                  : ""}
              </button>
            )}
            {manager && <MailOutbox />}
            {manager && <BookingRequests data={data} />}
            <div className="od-notification-wrap">
              <button
                className="od-icon"
                ref={noticesButton}
                onClick={() => setShowNotices(!showNotices)}
                aria-label="Notifications"
                aria-expanded={showNotices}
              >
                <Bell size={19} />
                {data.notifications.length > 0 && (
                  <i className="od-notice-dot" />
                )}
              </button>
              {showNotices && (
                <div className="od-notices">
                  <h3>Needs your attention</h3>
                  {data.notifications.length ? (
                    data.notifications.slice(0, 8).map((n) => (
                      <div className="od-notice-row" key={n.id}>
                        <button
                          onClick={() => {
                            setSelected(n.ticketId);
                            setView("inbox");
                            setShowNotices(false);
                          }}
                        >
                          <Clock3 size={15} />
                          <span>
                            {n.text}
                            <small>{date(n.createdAt)}</small>
                          </span>
                        </button>
                        {data.me.kind === "MANAGER" && (
                          <button
                            className="od-acknowledge-alert"
                            aria-label={`Acknowledge: ${n.text}`}
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                `tickets/${n.ticketId}/alerts/${n.id}/acknowledge`,
                                {},
                                "Alert acknowledged.",
                              )
                                .then(() => {
                                  setShowNotices(false);
                                  noticesButton.current?.focus();
                                })
                                .catch(() => {})
                            }
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>You’re all caught up.</p>
                  )}
                </div>
              )}
            </div>
            <span className="od-avatar small">{initials(data.me.name)}</span>
          </div>
        </header>
        <main className="od-main">
          {error && (
            <div className="od-error od-inline-error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {supplier ? (
            <SupplierDesk data={data} busy={busy} mutate={mutate} />
          ) : selected ? (
            <OnDemandTicket
              key={selected}
              id={selected}
              data={data}
              onBack={() => setSelected(null)}
              onSelect={setSelected}
              mutate={mutate}
              busy={busy}
            />
          ) : (
            <>
              <div className="od-page-heading">
                <div>
                  <div className="od-eyebrow">
                    {view === "insights"
                      ? "THE BIGGER PICTURE"
                      : view === "bookings"
                        ? "EVERY JOURNEY, CONNECTED"
                        : "YOUR TRAVEL SUPPORT, IN SYNC"}
                  </div>
                  <h1>
                    {view === "insights"
                      ? "Operational insights"
                      : view === "bookings"
                        ? "Booking directory"
                        : view === "manager"
                          ? "A little attention. A big difference."
                          : "Every conversation. Full context."}
                  </h1>
                  <p>
                    {view === "insights"
                      ? "Understand the patterns behind the cases, not just the queue."
                      : view === "bookings"
                        ? "One reference connects the traveler, supplier and every conversation."
                        : view === "manager"
                          ? "Keep time-sensitive journeys and unassigned cases moving."
                          : "A clear view of your travelers, their bookings, and what needs to happen next."}
                  </p>
                </div>
                <div className="od-flex">
                  {staff && ["inbox", "manager"].includes(view) && (
                    <button
                      className="od-secondary"
                      onClick={exportCsv}
                      disabled={!queue.data}
                    >
                      <ArrowDownToLine size={16} />
                      Export page
                    </button>
                  )}
                  <button
                    className="od-primary"
                    onClick={() => setShowNew(true)}
                  >
                    <Plus size={17} />
                    New ticket
                  </button>
                </div>
              </div>
              {view === "bookings" ? (
                <Bookings
                  data={data}
                  search={search}
                  setSearch={setSearch}
                  onSelect={setSelected}
                />
              ) : view === "insights" ? (
                <Insights />
              ) : (
                <>
                  {view === "manager" && data.me.kind === "MANAGER" && (
                    <>
                      <Membership actorId={data.me.id} />
                      <RoutingSettings
                        data={data}
                        busy={busy}
                        mutate={mutate}
                      />
                      <SlaSettings data={data} busy={busy} mutate={mutate} />
                      <AgencyResponseSettings
                        data={data}
                        busy={busy}
                        mutate={mutate}
                      />
                    </>
                  )}
                  <div className="od-stats">
                    {[
                      {
                        label: "Open conversations",
                        value: counts.open,
                        icon: Inbox,
                        note: "Across your authorized workspace",
                        color: "green",
                      },
                      {
                        label: "Urgent cases",
                        value: counts.urgent,
                        icon: Clock3,
                        note: "A timely response matters",
                        color: "orange",
                      },
                      {
                        label: "Awaiting supplier",
                        value: counts.waiting,
                        icon: MessageSquare,
                        note: "Keep the conversation moving",
                        color: "blue",
                      },
                      {
                        label: "Resolved cases",
                        value: counts.total - counts.open,
                        icon: TicketCheck,
                        note: "Travelers back on track",
                        color: "purple",
                      },
                    ].map((s) => (
                      <div className="od-stat" key={s.label}>
                        <div className="od-stat-label">
                          {s.label}
                          <span className={s.color}>
                            <s.icon size={17} />
                          </span>
                        </div>
                        <b>{s.value}</b>
                        <small>{s.note}</small>
                      </div>
                    ))}
                  </div>
                  {counts.urgent > 0 && (
                    <div className="od-urgent-banner">
                      <span className="od-banner-icon">
                        <Clock3 size={20} />
                      </span>
                      <div>
                        <b>Some journeys can’t wait.</b>
                        <span>
                          {counts.urgent} active case
                          {counts.urgent === 1 ? "" : "s"} need an urgent
                          response. Check the booking deadline before your next
                          step.
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setPriority("URGENT");
                          setTab("active");
                        }}
                      >
                        View urgent cases <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <section className="od-panel od-inbox">
                    <div className="od-tabs">
                      {[
                        ["active", "Active", counts.open],
                        ["waiting", "Awaiting supplier", counts.waiting],
                        ...(staff
                          ? [["mine", "Assigned to me", counts.mine]]
                          : []),
                        ["resolved", "Resolved", counts.total - counts.open],
                        ["all", "All cases", counts.total],
                      ].map(([id, label, count]) => (
                        <button
                          key={id}
                          className={tab === id ? "active" : ""}
                          onClick={() => {
                            setTab(String(id));
                            setStatus("ALL");
                          }}
                        >
                          {label}
                          <span>{count}</span>
                        </button>
                      ))}
                      <span className="od-updated">
                        <i />
                        Live workspace
                      </span>
                    </div>
                    <div className="od-filters">
                      <label className="od-search">
                        <Search size={17} />
                        <input
                          aria-label="Search conversations"
                          placeholder="Search traveler, booking or conversation…"
                          maxLength={180}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filter priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="ALL">All priorities</option>
                        {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                      >
                        <option value="ALL">All regions</option>
                        {["ASIA", "EUROPE", "AMERICAS"].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      {staff && (
                        <button
                          className={`od-availability ${data.me.available ? "on" : ""}`}
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              "availability",
                              { available: !data.me.available },
                              "Availability updated.",
                              "PATCH",
                            ).catch(() => {})
                          }
                        >
                          <i />
                          {data.me.available ? "Available" : "Away"}
                        </button>
                      )}
                    </div>
                    {staff && (
                      <div className="od-filters">
                        <select
                          aria-label="Filter status"
                          value={status}
                          onChange={(e) => {
                            setStatus(e.target.value);
                            setTab("all");
                          }}
                        >
                          <option value="ALL">All statuses</option>
                          {[
                            "OPEN",
                            "IN_PROGRESS",
                            "WAITING_SUPPLIER",
                            "WAITING_CUSTOMER",
                            "RESOLVED",
                            "CLOSED",
                          ].map((value) => (
                            <option value={value} key={value}>
                              {human(value)}
                            </option>
                          ))}
                        </select>
                        <DirectorySelect<Person>
                          path="people?kind=AGENT"
                          label="Filter owner"
                          value={owner}
                          refresh={data.now}
                          text={(p) => p.name}
                          onSelect={setOwner}
                        >
                          <option value="ALL">All owners</option>
                          <option value="UNASSIGNED">Unassigned</option>
                        </DirectorySelect>
                        <select
                          aria-label="Filter deadline"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                        >
                          <option value="ALL">All deadlines</option>
                          <option value="OVERDUE">Overdue</option>
                          <option value="NEXT_DAY">Due within 24 hours</option>
                        </select>
                      </div>
                    )}
                    <div className="od-table-wrap">
                      <table className="od-table">
                        <thead>
                          <tr>
                            <th>CONVERSATION</th>
                            <th>TRAVELER / AGENCY</th>
                            <th>PRIORITY</th>
                            <th>STATUS</th>
                            <th>DEADLINE</th>
                            <th>OWNER</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((t) => (
                            <tr key={t.id} onClick={() => setSelected(t.id)}>
                              <td>
                                <button
                                  className="od-ticket-title"
                                  onClick={() => setSelected(t.id)}
                                >
                                  {t.title}
                                </button>
                                <div className="od-ticket-sub">
                                  <span>{t.reference}</span>
                                  <span>·</span>
                                  <span>
                                    <BookOpen size={12} />
                                    {t.booking?.reference || "Needs booking"}
                                  </span>
                                  {(t.relatedCount ?? 0) > 0 && (
                                    <span className="od-repeat">
                                      <Layers3 size={11} />
                                      {t.relatedCount ?? 0} linked
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <b>{t.customerName || person(t.customerId)}</b>
                                <small>{agency(t.agencyId)}</small>
                              </td>
                              <td>
                                <Badge value={t.priority} />
                              </td>
                              <td>
                                <Badge value={t.status} />
                              </td>
                              <td>
                                <span
                                  className={
                                    +new Date(t.deadline) < +new Date(data.now)
                                      ? "od-overdue"
                                      : "od-deadline"
                                  }
                                >
                                  <Clock3 size={13} />
                                  {active(t)
                                    ? remaining(t.deadline, data.now)
                                    : "Completed"}
                                </span>
                                <small>{human(t.region)}</small>
                              </td>
                              <td>
                                <span
                                  title={t.ownerName || person(t.agentId)}
                                  className={`od-avatar small ${t.agentId ? "" : "empty"}`}
                                >
                                  {t.agentId
                                    ? initials(t.ownerName || person(t.agentId))
                                    : "—"}
                                </span>
                              </td>
                              <td>
                                <ChevronRight size={15} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {queue.error && (
                        <p role="alert" className="od-error">
                          {queue.error}
                        </p>
                      )}
                      {!queue.data && !queue.error && (
                        <p role="status">Loading conversations…</p>
                      )}
                      {queue.data && queue.data.total === 0 && (
                        <div className="od-empty">
                          <Inbox size={30} />
                          <h3>No conversations here</h3>
                          <p>Try another filter or create a new ticket.</p>
                          <button
                            className="od-secondary"
                            onClick={() => {
                              setPriority("ALL");
                              setRegion("ALL");
                              setStatus("ALL");
                              setOwner("ALL");
                              setDeadline("ALL");
                              setSearch("");
                              setTab("all");
                            }}
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="od-table-footer">
                      <span>
                        {queue.data
                          ? `Showing ${rows.length} of ${queue.data.total} matching conversations`
                          : "Conversations"}
                      </span>
                      {queue.data && queue.data.totalPages > 1 && (
                        <nav className="od-flex" aria-label="Inbox pages">
                          <button
                            className="od-secondary"
                            disabled={currentPage === 1}
                            onClick={() => queue.goToPage(currentPage - 1)}
                          >
                            Previous page
                          </button>
                          <span>
                            Page {currentPage} of {queue.data.totalPages}
                          </span>
                          <button
                            className="od-secondary"
                            disabled={currentPage >= queue.data.totalPages}
                            onClick={() => queue.goToPage(currentPage + 1)}
                          >
                            Next page
                          </button>
                        </nav>
                      )}
                      <span>
                        <ShieldCheck size={13} />
                        Visibility follows your workspace role
                      </span>
                    </div>
                  </section>
                  <div className="od-bottom-note">
                    <ShieldCheck size={15} />
                    <span>
                      Connected context. Clear ownership. Better journeys.
                    </span>
                    <span>All records in this workspace are synthetic.</span>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="od-toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {showNew && (
        <NewTicket
          data={data}
          busy={busy}
          onClose={() => setShowNew(false)}
          onCreate={async (body) => {
            const t = await mutate(
              "tickets",
              body,
              "Ticket saved, linked and routed.",
            );
            setShowNew(false);
            setView("inbox");
            setSelected(String(t.id));
          }}
        />
      )}
      {showClock && (
        <Modal title="Move the demo clock" onClose={() => setShowClock(false)}>
          <p>
            Advance time to show approaching check-ins and overdue supplier
            replies. The clock is persisted and shared across demo accounts.
          </p>
          <p className="od-info">
            Current demo time: {date(data.now)} · offset +
            {data.clockOffsetMinutes / 60} hours
          </p>
          <div className="od-clock-options">
            {[1, 4, 16, 24].map((hours) => (
              <button
                className="od-secondary"
                disabled={busy}
                key={hours}
                onClick={() =>
                  void mutate(
                    "clock/advance",
                    { minutes: hours * 60 },
                    `Clock advanced ${hours} hours; deadlines checked.`,
                  )
                    .then(() => setShowClock(false))
                    .catch(() => {})
                }
              >
                Advance {hours}h <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {showHelp && (
        <Modal
          title="Your connected travel desk"
          onClose={() => setShowHelp(false)}
        >
          <p>
            Open a ticket to see its verified booking, previous cases, messages
            and a records-based case brief.
          </p>
          <h3>Keep conversations separate</h3>
          <p>
            Customer replies, internal notes and supplier threads have separate
            visibility rules. Suppliers only see threads shared with their
            supplier account.
          </p>
          <h3>Show the end-to-end scenario</h3>
          <p>
            Open OPS-1042, contact Aster Hotels, then sign in as the supplier to
            reply. Return as manager and advance the demo clock to show
            escalation.
          </p>
          <p className="od-info">
            Synthetic data · PostgreSQL persistence · No live emails are sent.
            External AI is not connected; case briefs use saved records.
          </p>
        </Modal>
      )}
    </div>
  );
}
