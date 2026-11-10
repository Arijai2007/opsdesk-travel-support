"use client";
import { useState } from "react";
import { Modal, request } from "./ui";
import { DirectorySelect } from "./directory-select";
import { useOpsPage, PageControls } from "./paged-data";
import type { Booking, Person, Workspace } from "@/lib/opsdesk-types";
type Proposal = {
  id: string;
  kind: string;
  status: string;
  reason: string;
  decisionReason: string | null;
  payload: Record<string, string>;
  agencyName?: string;
  customerName?: string;
  supplierName?: string;
};
export function BookingRequests({ data }: { data: Workspace }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="od-secondary" onClick={() => setOpen(true)}>
        Booking reviews
      </button>
      {open && <ReviewPanel data={data} close={() => setOpen(false)} />}
    </>
  );
}
function ReviewPanel({ data, close }: { data: Workspace; close: () => void }) {
  const [refresh, setRefresh] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState("CREATE");
  const [agencyId, setAgency] = useState("");
  const [customerId, setCustomer] = useState("");
  const [supplierId, setSupplier] = useState("");
  const [bookingId, setBooking] = useState("");
  const [decisionReasons, setDecisionReasons] = useState<
    Record<string, string>
  >({});
  const page = useOpsPage<Proposal>("booking-requests", refresh);
  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setRefresh(String(Date.now()));
      setNotice("Booking review saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Booking reviews" onClose={close}>
      <p>
        Requests need a manager decision. Approvals change synthetic bookings
        only. Cancelling a booking keeps its support cases open.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const reason = String(form.get("reason"));
          void act(() =>
            kind === "CANCEL"
              ? request(`bookings/${bookingId}/cancellation-requests`, {
                  requestId: crypto.randomUUID(),
                  reason,
                })
              : request("booking-requests", {
                  requestId: crypto.randomUUID(),
                  agencyId,
                  customerId,
                  supplierId,
                  reason,
                  reference: form.get("reference"),
                  destination: form.get("destination"),
                  region: form.get("region"),
                  service: form.get("service"),
                  checkInAt: new Date(
                    String(form.get("checkInAt")) + "Z",
                  ).toISOString(),
                  timezone: form.get("timezone"),
                }),
          );
        }}
      >
        <label>
          Request type
          <select
            aria-label="Request type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="CREATE">New booking</option>
            <option value="CANCEL">Cancel booking</option>
          </select>
        </label>
        {kind === "CREATE" ? (
          <>
            <label>
              Booking agency
              <select
                aria-label="Booking agency"
                required
                value={agencyId}
                onChange={(e) => setAgency(e.target.value)}
              >
                <option value="">Select agency</option>
                {data.agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <DirectorySelect<Person>
              path="people?kind=CUSTOMER"
              label="Booking customer"
              value={customerId}
              onSelect={setCustomer}
              text={(p) => p.name}
              refresh={refresh}
              required
            >
              <option value="">Select customer in this agency</option>
            </DirectorySelect>
            <DirectorySelect<{ id: string; name: string }>
              path="admin/suppliers"
              label="Booking supplier"
              value={supplierId}
              onSelect={setSupplier}
              text={(p) => p.name}
              refresh={refresh}
              required
            >
              <option value="">Select supplier</option>
            </DirectorySelect>
            <label>
              Booking reference
              <input name="reference" required minLength={2} maxLength={80} />
            </label>
            <label>
              Destination
              <input
                name="destination"
                required
                minLength={2}
                maxLength={150}
              />
            </label>
            <label>
              Region
              <select name="region">
                <option>ASIA</option>
                <option>EUROPE</option>
                <option>AMERICAS</option>
              </select>
            </label>
            <label>
              Service
              <input
                name="service"
                required
                minLength={2}
                maxLength={100}
                placeholder="Hotel or flight"
              />
            </label>
            <label>
              Check-in (UTC)
              <input name="checkInAt" type="datetime-local" required />
            </label>
            <label>
              Display timezone
              <input
                name="timezone"
                required
                defaultValue="UTC"
                maxLength={80}
              />
            </label>
          </>
        ) : (
          <DirectorySelect<Booking>
            path="bookings"
            label="Booking to cancel"
            value={bookingId}
            onSelect={setBooking}
            text={(b) => `${b.reference} — ${b.destination}`}
            refresh={refresh}
            required
          >
            <option value="">Select booking</option>
          </DirectorySelect>
        )}
        <label>
          Request reason
          <textarea name="reason" required minLength={10} maxLength={1000} />
        </label>
        <button className="od-primary" disabled={busy}>
          Submit booking request
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {page.error && <p role="alert">{page.error}</p>}
      {page.data?.items.map((p) => (
        <article key={p.id} className="od-message">
          <b>
            {p.kind}: {p.payload.reference} — {p.status}
          </b>
          <p>{p.reason}</p>
          <p>
            {p.agencyName} · {p.customerName} · {p.supplierName}
          </p>
          {p.kind === "CREATE" && (
            <p>
              {p.payload.destination} · {p.payload.service} ·{" "}
              {p.payload.checkInAt} · {p.payload.timezone}
            </p>
          )}
          {p.status === "PENDING" ? (
            <>
              <label>
                Decision reason for {p.payload.reference}
                <textarea
                  minLength={10}
                  maxLength={1000}
                  value={decisionReasons[p.id] || ""}
                  onChange={(e) =>
                    setDecisionReasons({
                      ...decisionReasons,
                      [p.id]: e.target.value,
                    })
                  }
                />
              </label>
              {(["APPROVED", "REJECTED"] as const).map((decision) => (
                <button
                  key={decision}
                  disabled={
                    busy || (decisionReasons[p.id]?.trim().length || 0) < 10
                  }
                  onClick={() =>
                    act(() =>
                      request(`booking-requests/${p.id}/review`, {
                        decision,
                        reason: decisionReasons[p.id],
                      }),
                    )
                  }
                >
                  {decision === "APPROVED"
                    ? "Approve request"
                    : "Reject request"}
                </button>
              ))}
            </>
          ) : (
            <p>{p.decisionReason}</p>
          )}
        </article>
      ))}
      <PageControls resource={page} label="booking reviews" />
    </Modal>
  );
}
