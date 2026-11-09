"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Ticket } from "@/lib/opsdesk-types";
export const active = (t: Ticket) => !["RESOLVED", "CLOSED"].includes(t.status);
export const human = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const initials = (s: string) =>
  s
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
export const date = (s: string) =>
  new Date(s).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const remaining = (s: string, now: string) => {
  const h = (+new Date(s) - +new Date(now)) / 3600000;
  return h < 0
    ? `${Math.ceil(-h)}h overdue`
    : h < 1
      ? `${Math.max(1, Math.round(h * 60))}m left`
      : `${Math.ceil(h)}h left`;
};
export async function request(path: string, body?: unknown, method = "POST") {
  const r = await fetch(`/api/backend/ops/${path}`, {
    method: body === undefined ? "GET" : method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json();
  if (!r.ok)
    throw Object.assign(
      new Error(
        Array.isArray(d.message)
          ? d.message.join(". ")
          : d.message || "Request failed",
      ),
      { status: r.status },
    );
  return d;
}
export type Mutation = (
  path: string,
  body: unknown,
  message: string,
  method?: string,
) => Promise<Record<string, unknown>>;
export function Badge({ value }: { value: string }) {
  return (
    <span className={`od-badge ${value.toLowerCase()}`}>
      <i />
      {human(value)}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="od-modal" ref={ref} onCancel={onClose}>
      <div className="od-modal-head">
        <div>
          <span className="od-eyebrow">OPSDESK WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button className="od-icon" onClick={onClose} aria-label="Close dialog">
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
