"use client";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Layers3, LoaderCircle } from "lucide-react";
export function OpsLogin({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState("manager@opsdesk.demo"),
    [password, setPassword] = useState("OpsDeskDemo!2026"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Unable to sign in.");
      await onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="od-login">
      <section className="od-login-story">
        <div className="od-brand">
          <span className="od-brandmark">
            <Layers3 size={23} />
          </span>
          opsdesk<span className="od-brand-dot">.</span>
        </div>
        <div>
          <span className="od-eyebrow">EVERY JOURNEY. ONE CONVERSATION.</span>
          <h1>
            Great trips deserve
            <br />
            connected support.
          </h1>
          <p>
            The booking, the backstory, the next step.
            <br />
            Give every traveler a team that knows the whole story.
          </p>
          <div className="od-login-card">
            <div className="od-flex">
              <span className="od-avatar">MS</span>
              <div>
                <b>Maya Sen</b>
                <small>Bali · Booking BK-1042</small>
              </div>
              <span className="od-pill">Connected history</span>
            </div>
            <p>“We arrive tomorrow. Has the hotel confirmed our booking?”</p>
            <div className="od-login-timeline">
              <CheckCircle2 size={16} /> Previous conversations linked{" "}
              <span>→</span> Right team assigned
            </div>
          </div>
        </div>
        <small>Built for the moments that matter.</small>
      </section>
      <section className="od-login-form">
        <span className="od-pill">Synthetic demo workspace</span>
        <h2>Welcome to OpsDesk</h2>
        <p>Sign in to your travel operations workspace.</p>
        <form onSubmit={login}>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="od-error" role="alert">
              {error}
            </p>
          )}
          <button className="od-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="od-spin" />
            ) : (
              <>
                Sign in to workspace <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <div className="od-demo-accounts">
          <span className="od-eyebrow">EXPLORE A ROLE</span>
          <div>
            {[
              ["Manager", "manager"],
              ["Asia agent", "asia"],
              ["Agency", "agency"],
              ["Traveler", "maya"],
              ["Supplier", "supplier"],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => {
                  setEmail(`${id}@opsdesk.demo`);
                  setPassword("OpsDeskDemo!2026");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <small>
            Demo password: OpsDeskDemo!2026
            <br />
            Each account has server-enforced access to its own workspace.
          </small>
        </div>
      </section>
    </div>
  );
}
