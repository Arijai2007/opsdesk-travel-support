"use client";
import { DirectorySelect } from "./directory-select";
import { TicketSlaControls } from "./sla-settings";
import { useState } from "react";
import { useOpsResource, useOpsPage, PageControls } from "./paged-data";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Globe2,
  Layers3,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  AgencyContract,
  Booking,
  Person,
  CaseEvent,
  Conversation,
  Message,
  Ticket,
  Workspace,
} from "@/lib/opsdesk-types";
import {
  active,
  Badge,
  date,
  human,
  initials,
  Modal,
  remaining,
  type Mutation,
} from "./ui";

const scheduleFields = [
  ["checkInAt", "Check-in"],
  ["departureAt", "Departure"],
  ["cancellationCutoffAt", "Cancellation cutoff"],
] as const;

function BookingSchedule({
  booking,
  manager,
  busy,
  mutate,
}: {
  booking: NonNullable<Ticket["booking"]>;
  manager: boolean;
  busy: boolean;
  mutate: Mutation;
}) {
  const localTime = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      timeZone: booking.timezone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <>
      {scheduleFields.map(([field, label]) => {
        const value = booking[field];
        return (
          <div className="od-context-line" key={field}>
            <CalendarDays size={15} />
            <span>
              {label}
              <b>{value ? localTime(value) : "Not recorded"}</b>
              {value && <small>{booking.timezone}</small>}
            </span>
          </div>
        );
      })}
      {manager && (
        <details>
          <summary>Edit booking schedule</summary>
          <form
            key={scheduleFields.map(([field]) => booking[field]).join("|")}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const changes = Object.fromEntries(
                scheduleFields.flatMap(([field]) => {
                  const value = String(form.get(field) ?? "");
                  if (value === (booking[field]?.slice(0, 16) ?? "")) return [];
                  return [[field, value ? `${value}:00Z` : null]];
                }),
              );
              if (Object.keys(changes).length)
                void mutate(
                  `bookings/${booking.id}/schedule`,
                  changes,
                  "Booking schedule updated.",
                  "PATCH",
                ).catch(() => {});
            }}
          >
            {scheduleFields.map(([field, label]) => (
              <label key={field}>
                {label} (UTC)
                <input
                  name={field}
                  type="datetime-local"
                  defaultValue={booking[field]?.slice(0, 16)}
                  required={field === "checkInAt"}
                />
              </label>
            ))}
            <button className="od-secondary" disabled={busy}>
              Save schedule
            </button>
          </form>
        </details>
      )}
    </>
  );
}
function IntakeContract({
  agencyId,
  refresh,
  value,
  onSelect,
}: {
  agencyId: string;
  refresh: string;
  value: string;
  onSelect: (id: string) => void;
}) {
  const path = `contracts?agencyId=${encodeURIComponent(agencyId)}`;
  const result = useOpsResource<{ selectionRequired: boolean }>(path, refresh);
  if (result.error)
    return (
      <p role="alert">
        {result.error}
        <button type="button" onClick={result.retry}>
          Retry contracts
        </button>
      </p>
    );
  if (!result.data) return <p role="status">Loading agency contracts...</p>;
  if (!result.data.selectionRequired)
    return <p>Agency default response policy applies.</p>;
  return (
    <div>
      <DirectorySelect<AgencyContract>
        path={path}
        label="Agency contract"
        refresh={refresh}
        value={value}
        onSelect={onSelect}
        required
        text={(c) => `${c.name}  -  ${c.responseTargetHours} service hours`}
      >
        <option value="">Select an active contract</option>
      </DirectorySelect>
      <small>
        A contract is required. Contact support if no active contract is
        available.
      </small>
    </div>
  );
}
export function NewTicket({
  data,
  busy,
  onClose,
  onCreate,
}: {
  data: Workspace;
  busy: boolean;
  onClose: () => void;
  onCreate: (body: unknown) => Promise<void>;
}) {
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [bookingId, setBookingId] = useState(""),
    [contractId, setContractId] = useState(""),
    [submittedReference, setSubmittedReference] = useState(""),
    [error, setError] = useState(""),
    [exampleUsed, setExampleUsed] = useState(false);
  async function sample() {
    try {
      const r = await fetch("/data/travel-examples.json");
      if (!r.ok)
        throw new Error(
          "Sample data is unavailable. You can write your own complaint.",
        );
      const d = await r.json();
      const options = (
        d.examples as { instruction: string; intent: string }[]
      ).filter((v) =>
        ["get_refund", "cancel_flight", "change_trip", "check_in"].includes(
          v.intent,
        ),
      );
      const example = options[Math.floor(Math.random() * options.length)];
      setTitle(example.instruction);
      setDescription(example.instruction);
      setExampleUsed(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const [booking, setBooking] = useState<Booking>();
  return (
    <Modal title="Start a conversation" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          void onCreate({
            title,
            description,
            contractId: contractId || undefined,
            ...(booking
              ? {
                  bookingReference: booking.reference,
                  agencyId: booking.agencyId,
                  customerId: booking.customerId,
                }
              : { bookingReference: submittedReference.trim() || undefined }),
          }).catch((e) => setError(e.message));
        }}
      >
        <div>
          Booking
          <DirectorySelect<Booking>
            path="bookings"
            label="Booking"
            refresh={data.now}
            value={bookingId}
            required={data.me.kind !== "CUSTOMER"}
            onSelect={(id, item) => {
              setBookingId(id);
              setBooking(item);
              if (item?.agencyId !== booking?.agencyId) setContractId("");
            }}
            text={(b) =>
              `${b.reference}  -  ${b.destination}  -  ${b.customerName || ""}`
            }
          >
            <option value="">
              {data.me.kind === "CUSTOMER"
                ? "My booking is not listed"
                : "Select a verified booking"}
            </option>
          </DirectorySelect>
        </div>
        {data.me.kind === "CUSTOMER" && !booking && (
          <label>
            Booking reference (optional)
            <input
              maxLength={60}
              value={submittedReference}
              onChange={(e) => setSubmittedReference(e.target.value)}
            />
            <small>Support will review references we can’t match.</small>
          </label>
        )}
        {(booking?.agencyId || data.me.agencyId) && (
          <IntakeContract
            key={booking?.agencyId || data.me.agencyId}
            agencyId={(booking?.agencyId || data.me.agencyId)!}
            refresh={data.now}
            value={contractId}
            onSelect={setContractId}
          />
        )}
        <div className="od-flex od-space">
          <span className="od-eyebrow">DESCRIBE THE ISSUE</span>
          <button
            type="button"
            className="od-text-button"
            onClick={() => void sample()}
          >
            Load a travel example
          </button>
        </div>
        {exampleUsed && (
          <p className="od-info">
            Example wording from Bitext Travel, CDLA-Sharing-1.0. Review it
            before creating a ticket.
          </p>
        )}
        <label>
          Subject
          <input
            minLength={5}
            maxLength={180}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="What can we help with?"
          />
        </label>
        <label>
          Tell us what happened
          <textarea
            minLength={10}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            placeholder="Include the issue and the outcome you need."
          />
        </label>
        {booking && (
          <p className="od-info">
            <Layers3 size={16} />
            Earlier cases for {booking.reference} will be linked automatically.
            Routing uses {human(booking.region)} team availability.
          </p>
        )}
        {error && (
          <p role="alert" className="od-error">
            {error}
          </p>
        )}
        <div className="od-modal-actions">
          <button type="button" className="od-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="od-primary" disabled={busy}>
            {busy ? "Saving…" : "Create & route ticket"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Thread({ messages, data }: { messages: Message[]; data: Workspace }) {
  return (
    <div className="od-thread">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`od-message ${m.visibility === "INTERNAL" ? "internal" : ""}`}
        >
          <div className="od-flex">
            <span className="od-avatar small">
              {initials(
                m.senderName ||
                  data.people.find((p) => p.id === m.senderId)?.name ||
                  "Support team",
              )}
            </span>
            <b>
              {m.senderName ||
                data.people.find((p) => p.id === m.senderId)?.name ||
                "Support team"}
            </b>
            {m.visibility === "INTERNAL" && (
              <span className="od-pill">Internal note</span>
            )}
            <time>{date(m.createdAt)}</time>
          </div>
          <p>{m.content}</p>
        </div>
      ))}
    </div>
  );
}
export function OnDemandTicket({
  id,
  data,
  ...props
}: Omit<Parameters<typeof TicketDetail>[0], "ticket"> & { id: string }) {
  const detail = useOpsResource<Ticket>(`tickets/${id}`, data.now);
  if (detail.error)
    return (
      <p role="alert">
        {detail.error} <button onClick={detail.retry}>Retry case</button>
        <button onClick={props.onBack}>Back to conversations</button>
      </p>
    );
  if (!detail.data) return <p role="status">Loading case…</p>;
  return (
    <TicketDetail
      ticket={detail.data}
      data={{
        ...data,
        people: detail.data.people ?? [],
        bookings: detail.data.booking ? [detail.data.booking as Booking] : [],
      }}
      {...props}
    />
  );
}
export function TicketDetail({
  ticket: t,
  data,
  onBack,
  onSelect,
  mutate,
  busy,
}: {
  ticket: Ticket;
  data: Workspace;
  onBack: () => void;
  onSelect: (id: string) => void;
  mutate: Mutation;
  busy: boolean;
}) {
  const [tab, setTab] = useState("conversation"),
    [content, setContent] = useState(""),
    [visibility, setVisibility] = useState("CUSTOMER"),
    [supplierContent, setSupplierContent] = useState(""),
    [reason, setReason] = useState(""),
    [resolutionStatus, setResolutionStatus] = useState("RESOLVED"),
    [showResolve, setShowResolve] = useState(false),
    [newThread, setNewThread] = useState(false),
    [verifiedRef, setVerifiedRef] = useState("");
  const staff = ["AGENT", "MANAGER"].includes(data.me.kind),
    manager = data.me.kind === "MANAGER";
  const messages = useOpsPage<Message>(
    tab === "conversation" ? `tickets/${t.id}/messages` : null,
    data.now,
  );
  const activity = useOpsPage<CaseEvent>(
    tab === "activity" ? `tickets/${t.id}/events` : null,
    data.now,
  );
  const conversations = useOpsPage<Conversation>(
    staff && tab === "supplier" ? `tickets/${t.id}/conversations` : null,
    data.now,
  );
  const history = useOpsPage<Ticket>(`tickets/${t.id}/related`, data.now);
  const threads = conversations.data?.items ?? [],
    related = history.data?.items ?? [];
  const owner = data.people.find((p) => p.id === t.agentId),
    booking = data.bookings.find((b) => b.id === t.bookingId);
  const needsDraftDetails =
    visibility === "CUSTOMER" && content.includes("[add the confirmed details");
  function draftReply() {
    const supplierUpdate = t.supplierReplied;
    const reference = t.booking ? ` for booking ${t.booking.reference}` : "";
    setContent(
      [
        `Hello, thank you for contacting us about case ${t.reference}${reference}.`,
        !active(t)
          ? "Our records show this case is complete. Please let us know if anything still needs attention."
          : supplierUpdate
            ? "We received an update from the supplier. Here is what we can confirm: [add the confirmed details]."
            : "Here is the current status: [add the confirmed details and next steps].",
      ].join("\n\n"),
    );
  }
  return (
    <>
      <button className="od-back" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to conversations
      </button>
      <div className="od-detail-heading">
        <div>
          <div className="od-ticket-sub">
            <span>{t.reference}</span>
            <span>·</span>
            <span>{human(t.category)}</span>
            <Badge value={t.priority} />
          </div>
          <h1>{t.title}</h1>
          <p>
            {data.people.find((p) => p.id === t.customerId)?.name}{" "}
            <span>via</span>{" "}
            {data.agencies.find((a) => a.id === t.agencyId)?.name}
          </p>
        </div>
        <button
          className="od-primary"
          onClick={() => {
            setResolutionStatus(staff ? "RESOLVED" : "CLOSED");
            setShowResolve(true);
          }}
        >
          <CheckCircle2 size={16} />
          {active(t) ? (staff ? "Resolve case" : "Close case") : "Reopen case"}
        </button>
      </div>
      <div className="od-detail-grid">
        <div>
          <section className="od-case-brief">
            <div className="od-flex">
              <Sparkles size={17} />
              <b>The story so far</b>
              <span className="od-pill">From saved records</span>
            </div>
            <p>{t.summary}</p>
            <small>
              Sources: {t.reference}
              {related.length > 0
                ? ` + ${related.map((v) => v.reference).join(", ")}`
                : ""}
              . No external AI generated this brief.
            </small>
          </section>
          <section className="od-panel">
            <div className="od-tabs">
              <button
                className={tab === "conversation" ? "active" : ""}
                onClick={() => setTab("conversation")}
              >
                Conversation
              </button>
              {staff && (
                <button
                  className={tab === "supplier" ? "active" : ""}
                  onClick={() => setTab("supplier")}
                >
                  Supplier threads
                </button>
              )}
              <button
                className={tab === "activity" ? "active" : ""}
                onClick={() => setTab("activity")}
              >
                Activity
              </button>
            </div>
            {tab === "conversation" ? (
              <>
                <PageControls resource={messages} label="messages" />
                <Thread
                  messages={[...(messages.data?.items ?? [])].reverse()}
                  data={data}
                />
                <form
                  className="od-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (needsDraftDetails) return;
                    void mutate(
                      `tickets/${t.id}/messages`,
                      { content, visibility },
                      visibility === "INTERNAL"
                        ? "Internal note saved."
                        : "Reply saved to the customer thread.",
                    )
                      .then(() => setContent(""))
                      .catch(() => {});
                  }}
                >
                  <div className="od-flex">
                    <MessageSquare size={16} />
                    {staff ? (
                      <select
                        aria-label="Message visibility"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                      >
                        <option value="CUSTOMER">Customer reply</option>
                        <option value="INTERNAL">Internal note</option>
                      </select>
                    ) : (
                      <b>Reply to support</b>
                    )}
                    <span className="od-composer-hint">
                      {visibility === "INTERNAL"
                        ? "Only your support team can see this"
                        : "Visible to the customer and agency"}
                    </span>
                  </div>
                  <textarea
                    aria-label="Message content"
                    placeholder={
                      visibility === "INTERNAL"
                        ? "Leave a handover note for the team…"
                        : "Write a thoughtful reply…"
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    maxLength={10000}
                    rows={4}
                  />
                  <div className="od-composer-footer">
                    {staff && visibility === "CUSTOMER" && (
                      <button
                        type="button"
                        className="od-secondary"
                        disabled={busy || Boolean(content.trim())}
                        onClick={draftReply}
                      >
                        Draft reply
                      </button>
                    )}
                    <small>
                      {needsDraftDetails
                        ? "Replace the draft placeholder with confirmed details before sending."
                        : "Messages stay in this case. No external email is sent."}
                    </small>
                    <button
                      className="od-primary"
                      disabled={busy || !content.trim() || needsDraftDetails}
                    >
                      <Send size={14} />
                      Send reply
                    </button>
                  </div>
                </form>
              </>
            ) : tab === "activity" ? (
              <div className="od-activity">
                <PageControls resource={activity} label="events" />
                {(activity.data?.items ?? []).map((e) => (
                  <div key={e.id}>
                    <span className="od-event-dot" />
                    <div>
                      <b>{human(e.kind)}</b>
                      <p>{e.text}</p>
                      <small>
                        {date(e.createdAt)} ·{" "}
                        {e.actorId === "system"
                          ? "Deadline monitor"
                          : data.people.find((p) => p.id === e.actorId)?.name ||
                            "Support team"}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="od-supplier-panel">
                <div className="od-flex od-space">
                  <p>Separate conversations with your booking supplier.</p>
                  <button
                    className="od-secondary"
                    disabled={!t.bookingId || !active(t)}
                    onClick={() => setNewThread(true)}
                  >
                    <Plus size={15} />
                    Contact supplier
                  </button>
                </div>
                <PageControls resource={conversations} label="threads" />
                {threads.length ? (
                  threads.map((c) => (
                    <SupplierConversation
                      key={c.id}
                      conversation={c}
                      data={data}
                      mutate={mutate}
                      busy={busy}
                    />
                  ))
                ) : (
                  <div className="od-empty">
                    <MessageSquare size={28} />
                    <h3>No supplier conversations yet</h3>
                    <p>
                      Contact the supplier to keep their updates connected to
                      this case.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
        <aside className="od-context">
          <section className="od-panel">
            <h3>Case details</h3>
            <label>
              Status
              {staff ? (
                <select
                  aria-label="Ticket status"
                  value={t.status}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (["RESOLVED", "CLOSED"].includes(next)) {
                      setResolutionStatus(next);
                      setShowResolve(true);
                    } else
                      void mutate(
                        `tickets/${t.id}`,
                        { status: next },
                        "Case status updated.",
                        "PATCH",
                      ).catch(() => {});
                  }}
                >
                  {[
                    "OPEN",
                    "IN_PROGRESS",
                    "WAITING_SUPPLIER",
                    "WAITING_CUSTOMER",
                    "RESOLVED",
                    "CLOSED",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Badge value={t.status} />
              )}
            </label>
            <label>
              Priority
              {staff ? (
                <select
                  aria-label="Ticket priority"
                  value={t.priority}
                  disabled={busy}
                  onChange={(e) =>
                    void mutate(
                      `tickets/${t.id}`,
                      {
                        priority: e.target.value,
                        reason: "Agent review from case workspace.",
                      },
                      "Priority updated.",
                      "PATCH",
                    ).catch(() => {})
                  }
                >
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Badge value={t.priority} />
              )}
            </label>
            <label>
              Owner
              {manager ? (
                <DirectorySelect<Person>
                  path="people?kind=AGENT"
                  label="Assign agent"
                  refresh={data.now}
                  disabled={busy}
                  value={t.agentId || ""}
                  text={(p) =>
                    `${p.name}  -  ${p.region || ""}${p.available ? "" : " (unavailable)"}`
                  }
                  onSelect={(id) =>
                    void mutate(
                      `tickets/${t.id}`,
                      { agentId: id, reason: "Manager reassignment." },
                      "Assignment updated.",
                      "PATCH",
                    ).catch(() => {})
                  }
                >
                  <option value="">Unassigned</option>
                </DirectorySelect>
              ) : (
                <span>
                  {owner?.name || "Unassigned"}
                  {staff && !t.agentId && (
                    <button
                      className="od-text-button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `tickets/${t.id}`,
                          { agentId: data.me.id },
                          "Case assigned to you.",
                          "PATCH",
                        ).catch(() => {})
                      }
                    >
                      Assign to me
                    </button>
                  )}
                </span>
              )}
            </label>
            <div className="od-detail-deadline">
              <Clock3 size={17} />
              <div>
                <b>
                  {active(t)
                    ? remaining(t.deadline, data.now)
                    : "Case completed"}
                </b>
                <small>Case deadline · {date(t.deadline)}</small>
                {t.responseDeadline && t.responseDeadline !== t.deadline && (
                  <small>Response target · {date(t.responseDeadline)}</small>
                )}
              </div>
            </div>
          </section>
          <section className="od-panel">
            <h3>
              <BookOpen size={16} />
              Booking context
            </h3>
            {t.booking ? (
              <>
                <span className="od-booking-ref">
                  {t.booking.reference}
                  <ShieldCheck size={14} />
                </span>
                <h4>{t.booking.destination}</h4>
                <p>
                  {t.booking.service} · {human(t.booking.region)}
                </p>
                <BookingSchedule
                  booking={t.booking}
                  manager={data.me.kind === "MANAGER"}
                  busy={busy}
                  mutate={mutate}
                />
                {booking && (
                  <div className="od-context-line">
                    <Globe2 size={15} />
                    <span>
                      Supplier<b>{booking.supplier.name}</b>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <p>This case needs a verified booking reference.</p>
                {staff && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mutate(
                        `tickets/${t.id}`,
                        { bookingReference: verifiedRef },
                        "Booking linked.",
                        "PATCH",
                      ).catch(() => {});
                    }}
                  >
                    <input
                      aria-label="Verify booking reference"
                      value={verifiedRef}
                      onChange={(e) => setVerifiedRef(e.target.value)}
                      placeholder="BK-1042"
                      required
                    />
                    <button className="od-secondary" disabled={busy}>
                      Verify booking
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
          <section className="od-panel">
            <h3>
              <Layers3 size={16} />
              Connected history{" "}
              <span className="od-count">{history.data?.total ?? 0}</span>
            </h3>
            <PageControls resource={history} label="related cases" />
            {related.length ? (
              related.map((v) => (
                <button
                  className="od-related"
                  key={v.id}
                  onClick={() => onSelect(v.id)}
                >
                  <small>
                    {v.reference} · {human(v.status)}
                  </small>
                  <b>{v.title}</b>
                  <span>
                    {date(v.createdAt)}
                    <ArrowUpRight size={14} />
                  </span>
                </button>
              ))
            ) : (
              <p>No other linked cases in your authorized history.</p>
            )}
          </section>
        </aside>
      </div>
      {staff && (
        <TicketSlaControls
          key={`${t.id}:${t.escalationOwnerId}:${t.escalationManual}:${t.escalationOverrideUntil}`}
          ticket={t}
          manager={manager}
          refresh={data.now}
          busy={busy}
          mutate={mutate}
        />
      )}
      {showResolve && (
        <Modal
          title={active(t) ? "Record the outcome" : "Reopen this case"}
          onClose={() => setShowResolve(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                `tickets/${t.id}`,
                { status: active(t) ? resolutionStatus : "OPEN", reason },
                "Case updated and outcome recorded.",
                "PATCH",
              )
                .then(() => {
                  setShowResolve(false);
                  setReason("");
                })
                .catch(() => {});
            }}
          >
            <label>
              {active(t)
                ? "What was resolved?"
                : "Why does this need another look?"}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={3}
                maxLength={1000}
                rows={4}
              />
            </label>
            <div className="od-modal-actions">
              <button className="od-primary" disabled={busy}>
                Save outcome
              </button>
            </div>
          </form>
        </Modal>
      )}
      {newThread && (
        <Modal title="Contact the supplier" onClose={() => setNewThread(false)}>
          <p>
            This starts a separate thread with {booking?.supplier.name}.
            Customer messages and internal notes are not included.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                `tickets/${t.id}/conversations`,
                {
                  subject: `${t.booking?.reference}: ${t.title}`,
                  content: supplierContent,
                },
                "Supplier conversation opened.",
              )
                .then(() => {
                  setNewThread(false);
                  setSupplierContent("");
                  setTab("supplier");
                })
                .catch(() => {});
            }}
          >
            <label>
              Message
              <textarea
                value={supplierContent}
                onChange={(e) => setSupplierContent(e.target.value)}
                required
                rows={5}
              />
            </label>
            <div className="od-modal-actions">
              <button className="od-primary" disabled={busy}>
                <Send size={15} />
                Send to supplier thread
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SupplierConversation({
  conversation: c,
  data,
  mutate,
  busy,
}: {
  conversation: Conversation;
  data: Workspace;
  mutate: Mutation;
  busy: boolean;
}) {
  const [content, setContent] = useState("");
  const messages = useOpsPage<Message>(
    `conversations/${c.id}/messages`,
    data.now,
  );
  return (
    <article className="od-supplier-conversation">
      <div className="od-flex od-space">
        <div>
          <span className="od-eyebrow">{c.supplier.name}</span>
          <h3>{c.subject}</h3>
        </div>
        <Badge value={c.status} />
        {data.me.kind !== "SUPPLIER" && (
          <button
            className="od-text-button"
            disabled={busy}
            onClick={() =>
              void mutate(
                `conversations/${c.id}`,
                { status: c.status === "CLOSED" ? "AWAITING_REPLY" : "CLOSED" },
                "Supplier conversation updated.",
                "PATCH",
              ).catch(() => {})
            }
          >
            {c.status === "CLOSED" ? "Reopen thread" : "Close thread"}
          </button>
        )}
      </div>
      <small className="od-flex">
        <Clock3 size={12} /> Reply target: {date(c.dueAt)} ·{" "}
        {c.status === "CLOSED"
          ? "Conversation closed"
          : c.status === "REPLIED"
            ? "Reply received"
            : remaining(c.dueAt, data.now)}
      </small>
      <PageControls resource={messages} label="supplier messages" />
      <Thread
        messages={[...(messages.data?.items ?? [])].reverse()}
        data={data}
      />
      {c.status !== "CLOSED" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(
              `conversations/${c.id}/reply`,
              { content },
              "Supplier thread updated.",
            )
              .then(() => setContent(""))
              .catch(() => {});
          }}
        >
          <textarea
            aria-label="Supplier reply"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              data.me.kind === "SUPPLIER"
                ? "Reply to the support team…"
                : "Follow up with the supplier…"
            }
            required
            maxLength={10000}
          />
          <button className="od-primary" disabled={busy || !content.trim()}>
            <Send size={14} />
            Send reply
          </button>
        </form>
      )}
    </article>
  );
}
export function SupplierDesk({
  data,
  busy,
  mutate,
}: {
  data: Workspace;
  busy: boolean;
  mutate: Mutation;
}) {
  const conversations = useOpsPage<Conversation>("conversations", data.now);
  const threads = conversations.data?.items ?? [];
  return (
    <>
      <div className="od-page-heading">
        <div>
          <span className="od-eyebrow">A DIRECT LINE TO THE SUPPORT TEAM</span>
          <h1>Your supplier conversations</h1>
          <p>
            Reply to the booking conversations shared with your supplier
            account.
          </p>
        </div>
        <span className="od-pill">
          <ShieldCheck size={14} />
          Shared threads only
        </span>
      </div>
      <div className="od-supplier-desk">
        <PageControls resource={conversations} label="threads" />
        {threads.length ? (
          threads.map((c) => (
            <SupplierConversation
              key={c.id}
              conversation={c}
              data={data}
              mutate={mutate}
              busy={busy}
            />
          ))
        ) : (
          <div className="od-panel od-empty">
            <MessageSquare size={32} />
            <h3>No conversations shared yet</h3>
            <p>
              Support agents can contact your supplier from their booking
              workspace.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
