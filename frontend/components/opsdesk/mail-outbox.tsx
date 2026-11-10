"use client";

import { useEffect, useState } from "react";
import { date, human, Modal, request } from "./ui";

type Outbox = {
  mode: "PAUSED" | "SYNTHETIC" | "RESEND";
  jobs: {
    id: string;
    status: string;
    attempts: number;
    retryable: boolean;
    receipts: { id: string; kind: string; occurredAt: string }[];
    message: { ticket: { reference: string } };
    history: { id: string; outcome: string; createdAt: string }[];
  }[];
};

export function MailOutbox() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="od-secondary" onClick={() => setOpen(true)}>
        Mail outbox
      </button>
      {open && <MailJobs onClose={() => setOpen(false)} />}
    </>
  );
}

function MailJobs({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Outbox>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void request("mail")
      .then((value: Outbox) => {
        if (mounted) setData(value);
      })
      .catch(() => {
        if (mounted) setError("Could not load the mail outbox.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function update(id?: string, action?: "retry" | "cancel") {
    setBusy(true);
    setError("");
    try {
      if (id && action) await request(`mail/${id}/${action}`, {});
      const next: Outbox = await request("mail");
      setData(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the mail outbox.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Mail outbox" onClose={onClose}>
      {error && <p role="alert">{error}</p>}
      {data ? (
        <>
          <p role="status">
            {data.mode === "RESEND"
              ? "Resend pilot delivery enabled for configured recipients."
              : data.mode === "PAUSED"
                ? "Delivery paused. No external email is sent."
                : "Synthetic delivery enabled. No external email is sent."}
          </p>
          <button
            className="od-secondary"
            disabled={busy}
            onClick={() => void update()}
          >
            Refresh jobs
          </button>
          {data.jobs.length === 0 && <p>No mail jobs.</p>}
          <ul aria-label="Recent mail jobs">
            {data.jobs.map((job) => (
              <li key={job.id}>
                <p>
                  {job.message.ticket.reference} · {human(job.status)} ·
                  Attempts: {job.attempts}
                </p>
                {job.history.map((attempt) => (
                  <small key={attempt.id}>
                    {human(attempt.outcome)} · {date(attempt.createdAt)}{" "}
                  </small>
                ))}
                {job.receipts.map((receipt) => (
                  <small key={receipt.id}>
                    {human(receipt.kind)} · {date(receipt.occurredAt)}{" "}
                  </small>
                ))}
                {job.retryable && (
                  <button
                    className="od-secondary"
                    disabled={busy}
                    onClick={() => void update(job.id, "retry")}
                  >
                    Retry job
                  </button>
                )}
                {["QUEUED", "FAILED"].includes(job.status) && (
                  <button
                    className="od-secondary"
                    disabled={busy}
                    onClick={() => void update(job.id, "cancel")}
                  >
                    Cancel job
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        !error && <p role="status">Loading mail jobs…</p>
      )}
    </Modal>
  );
}
