"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Layers3 } from "lucide-react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@helpdesk/shared";
import { password as passwordSchema } from "@/lib/validation/auth-schemas";

export default function ActivatePage() {
  const captured = useRef(false);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setToken(/^[a-f0-9]{64}$/.test(value) ? value : "");
    setReady(true);
  }, []);
  async function accept(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 400
            ? "This invitation is invalid or has expired. Ask your manager for a replacement link."
            : response.status === 429
              ? "Too many attempts. Please try again later."
              : "Activation is unavailable. Please try again.",
        );
      setAccepted(true);
      setPassword("");
      setConfirmation("");
      setToken("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not activate your membership.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="od-login">
      <section className="od-login-story">
        <Link href="/" className="od-brand">
          <span className="od-brandmark">
            <Layers3 size={23} />
          </span>
          opsdesk<span className="od-brand-dot">.</span>
        </Link>
        <div>
          <span className="od-eyebrow">YOUR TRAVEL OPERATIONS WORKSPACE</span>
          <h1>
            Your team is
            <br />
            ready for you.
          </h1>
          <p>Choose your own password to activate your membership.</p>
        </div>
        <small>Connected support for every journey.</small>
      </section>
      <section className="od-login-form" aria-labelledby="activate-title">
        <h2 id="activate-title">Activate your membership</h2>
        {!ready ? (
          <p role="status">Checking invitation…</p>
        ) : accepted ? (
          <>
            <p role="status">
              Your membership is active. You can now sign in with your email and
              password.
            </p>
            <Link className="od-primary" href="/">
              Go to sign in
            </Link>
          </>
        ) : !token ? (
          <>
            <p role="alert" className="od-error">
              No valid invitation was found. Open the full invitation link from
              your manager, or request a replacement.
            </p>
            <Link href="/">Go to sign in</Link>
          </>
        ) : (
          <>
            <p>
              This invitation can be used once. Your manager will never see your
              password.
            </p>
            <form onSubmit={accept}>
              <label>
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  aria-describedby="password-requirements"
                  required
                  disabled={busy}
                />
              </label>
              <p id="password-requirements">
                Use 8–64 characters, with uppercase and lowercase letters, a
                number and a special character. No emoji.
              </p>
              <label>
                Confirm password
                <input
                  type="password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  required
                  disabled={busy}
                />
              </label>
              {error && (
                <p role="alert" className="od-error">
                  {error}
                </p>
              )}
              <button className="od-primary" disabled={busy} type="submit">
                {busy ? "Activating…" : "Activate membership"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
