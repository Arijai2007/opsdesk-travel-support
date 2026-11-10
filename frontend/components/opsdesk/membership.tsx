"use client";

import { useState, type FormEvent } from "react";
import { ZodError } from "zod";
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from "@helpdesk/shared";
import { email, nameField } from "@/lib/validation/auth-schemas";
import type { Agency, Supplier } from "@/lib/opsdesk-types";
import { DirectorySelect } from "./directory-select";
import { PageControls, useOpsPage } from "./paged-data";
import { date, human, Modal, request } from "./ui";

const kinds = ["CUSTOMER", "AGENCY", "SUPPLIER", "AGENT", "MANAGER"];
type Member = {
  id: string;
  name: string;
  email: string;
  kind: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  agencyId: string | null;
  supplierId: string | null;
  region: string | null;
};
type Audit = {
  id: string;
  actorId: string;
  entityId: string;
  action: string;
  reason: string;
  createdAt: string;
};
type Invitation = { token: string; expiresAt: string; member: Member };
type Action = { member: Member; type: "invitation" | "ACTIVE" | "SUSPENDED" };

function Reason() {
  return (
    <label>
      Reason
      <textarea
        name="reason"
        required
        minLength={3}
        maxLength={500}
        rows={2}
        placeholder="Why is this change needed?"
      />
    </label>
  );
}
function reasonOf(form: FormData) {
  const reason = String(form.get("reason") || "").trim();
  if (reason.length < 3 || reason.length > 500)
    throw new Error("Enter a reason between 3 and 500 characters.");
  return reason;
}

export function Membership({ actorId }: { actorId: string }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [inviteKind, setInviteKind] = useState("CUSTOMER");
  const [scope, setScope] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invitation, setInvitation] = useState<
    (Invitation & { link: string }) | null
  >(null);
  const [action, setAction] = useState<Action | null>(null);
  const memberQuery = new URLSearchParams();
  if (search) memberQuery.set("search", search);
  if (kind) memberQuery.set("kind", kind);
  const members = useOpsPage<Member>(
    `admin/members${memberQuery.size ? `?${memberQuery}` : ""}`,
    String(refresh),
  );
  const audit = useOpsPage<Audit>("admin/audit", String(refresh));

  async function change(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setRefresh((v) => v + 1);
    } catch (cause) {
      setError(
        cause instanceof ZodError
          ? cause.issues[0].message
          : cause instanceof Error
            ? cause.message
            : "Could not save this change.",
      );
    } finally {
      setBusy(false);
    }
  }
  function showInvitation(value: Invitation) {
    setInvitation({
      ...value,
      link: `${window.location.origin}/activate#token=${value.token}`,
    });
  }
  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void change(async () => {
      const firstName = nameField("First name").parse(
        String(values.get("firstName") || "").trim(),
      );
      const lastName = nameField("Last name").parse(
        String(values.get("lastName") || "").trim(),
      );
      const address = email.parse(
        String(values.get("email") || "")
          .trim()
          .toLowerCase(),
      );
      const scopes = ["CUSTOMER", "AGENCY"].includes(inviteKind)
        ? { agencyId: scope }
        : inviteKind === "SUPPLIER"
          ? { supplierId: scope }
          : { region: inviteKind === "MANAGER" ? "GLOBAL" : scope };
      if (inviteKind !== "MANAGER" && !scope)
        throw new Error("Choose the required membership scope.");
      showInvitation(
        await request("admin/invitations", {
          firstName,
          lastName,
          email: address,
          kind: inviteKind,
          ...scopes,
          reason: reasonOf(values),
        }),
      );
      form.reset();
      setScope("");
      setNotice("Invitation created. Save the link before dismissing it.");
    });
  }
  function createDirectory(
    event: FormEvent<HTMLFormElement>,
    type: "agencies" | "suppliers",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void change(async () => {
      const name = String(values.get("name") || "").trim();
      if (!name) throw new Error("Enter a name.");
      const detail =
        type === "agencies"
          ? {
              code: String(values.get("code") || "")
                .trim()
                .toUpperCase(),
            }
          : {
              email: email.parse(
                String(values.get("email") || "")
                  .trim()
                  .toLowerCase(),
              ),
            };
      await request(`admin/${type}`, {
        name,
        ...detail,
        reason: reasonOf(values),
      });
      form.reset();
      setNotice(type === "agencies" ? "Agency created." : "Supplier created.");
    });
  }
  return (
    <section
      className="od-panel od-membership"
      aria-labelledby="membership-title"
    >
      <div className="od-membership-heading">
        <div>
          <span className="od-eyebrow">MANAGER CONTROLS</span>
          <h2 id="membership-title">Membership administration</h2>
          <p>
            Invite people, manage access and review every administrative change.
            Roles and scopes stay fixed after invitation.
          </p>
        </div>
      </div>
      {error && (
        <p className="od-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {invitation && (
        <div className="od-info od-invitation" role="status">
          <h3>Save this invitation link now</h3>
          <p>
            For {invitation.member.email}. This link is shown once. Share it
            privately. Expires {date(invitation.expiresAt)}.
          </p>
          <label>
            One-time activation link
            <input
              readOnly
              value={invitation.link}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button
            className="od-secondary"
            type="button"
            onClick={() => setInvitation(null)}
          >
            Dismiss invitation link
          </button>
        </div>
      )}
      <div className="od-membership-forms">
        <details>
          <summary>Invite a member</summary>
          <form onSubmit={invite} className="od-membership-form">
            <fieldset disabled={busy || Boolean(invitation)}>
              <legend>New membership</legend>
              <label>
                First name
                <input
                  name="firstName"
                  required
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  required
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="family-name"
                />
              </label>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={EMAIL_MAX_LENGTH}
                  autoComplete="email"
                />
              </label>
              <label>
                Role
                <select
                  aria-label="Role"
                  value={inviteKind}
                  onChange={(e) => {
                    setInviteKind(e.target.value);
                    setScope("");
                  }}
                >
                  {kinds.map((value) => (
                    <option key={value} value={value}>
                      {human(value)}
                    </option>
                  ))}
                </select>
              </label>
              {["CUSTOMER", "AGENCY"].includes(inviteKind) && (
                <div>
                  <span>Agency scope (required)</span>
                  <DirectorySelect<Agency>
                    path="admin/agencies"
                    label="Invitation agency"
                    value={scope}
                    onSelect={setScope}
                    text={(v) => `${v.name} (${v.code})`}
                    refresh={String(refresh)}
                    required
                  >
                    <option value="">Choose agency</option>
                  </DirectorySelect>
                </div>
              )}
              {inviteKind === "SUPPLIER" && (
                <div>
                  <span>Supplier scope (required)</span>
                  <DirectorySelect<Supplier>
                    path="admin/suppliers"
                    label="Invitation supplier"
                    value={scope}
                    onSelect={setScope}
                    text={(v) => v.name}
                    refresh={String(refresh)}
                    required
                  >
                    <option value="">Choose supplier</option>
                  </DirectorySelect>
                </div>
              )}
              {inviteKind === "AGENT" && (
                <label>
                  Region
                  <select
                    aria-label="Region"
                    required
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="">Choose region</option>
                    {["ASIA", "EUROPE", "AMERICAS", "GLOBAL"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              )}
              {inviteKind === "MANAGER" && <p>Managers have global scope.</p>}
              <Reason />
              <button className="od-primary" type="submit">
                {busy ? "Saving…" : "Create invitation"}
              </button>
            </fieldset>
          </form>
        </details>
        {(["agencies", "suppliers"] as const).map((type) => (
          <details key={type}>
            <summary>
              Create {type === "agencies" ? "an agency" : "a supplier"}
            </summary>
            <form
              className="od-membership-form"
              onSubmit={(e) => createDirectory(e, type)}
            >
              <fieldset disabled={busy}>
                <legend>
                  {type === "agencies" ? "New agency" : "New supplier"}
                </legend>
                <label>
                  Name
                  <input name="name" required maxLength={150} />
                </label>
                {type === "agencies" ? (
                  <label>
                    Agency code
                    <input
                      name="code"
                      required
                      minLength={2}
                      maxLength={30}
                      pattern="[A-Za-z0-9_-]+"
                    />
                  </label>
                ) : (
                  <label>
                    Supplier email
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={EMAIL_MAX_LENGTH}
                    />
                  </label>
                )}
                <Reason />
                <button className="od-primary" type="submit">
                  {busy
                    ? "Saving…"
                    : type === "agencies"
                      ? "Create agency"
                      : "Create supplier"}
                </button>
              </fieldset>
            </form>
          </details>
        ))}
      </div>
      <h3>Member directory</h3>
      <div className="od-filters">
        <label className="od-membership-search">
          Search members
          <input
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <label>
          Filter role
          <select
            aria-label="Filter role"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All roles</option>
            {kinds.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="od-table-wrap">
        <table className="od-table">
          <caption className="od-sr-only">Member access and scope</caption>
          <thead>
            <tr>
              <th>MEMBER</th>
              <th>ROLE / SCOPE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {members.data?.items.map((member) => (
              <tr key={member.id}>
                <td>
                  <b>{member.name}</b>
                  <small>{member.email}</small>
                </td>
                <td>
                  {human(member.kind)}
                  <small>
                    {member.agencyId ||
                      member.supplierId ||
                      member.region ||
                      "—"}
                  </small>
                </td>
                <td>{human(member.status)}</td>
                <td>
                  <div className="od-flex">
                    {member.status !== "ACTIVE" && (
                      <button
                        type="button"
                        className="od-secondary"
                        disabled={busy || Boolean(invitation)}
                        onClick={() =>
                          setAction({ member, type: "invitation" })
                        }
                      >
                        Reissue invitation
                      </button>
                    )}
                    {member.status !== "INVITED" && (
                      <button
                        type="button"
                        className="od-secondary"
                        disabled={busy || member.id === actorId}
                        title={
                          member.id === actorId
                            ? "You cannot suspend your own membership."
                            : undefined
                        }
                        onClick={() =>
                          setAction({
                            member,
                            type:
                              member.status === "ACTIVE"
                                ? "SUSPENDED"
                                : "ACTIVE",
                          })
                        }
                      >
                        {member.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.data?.total === 0 && <p>No members match these filters.</p>}
      <PageControls resource={members} label="members" />
      <details>
        <summary>Administrative audit</summary>
        <div className="od-table-wrap">
          <table className="od-table">
            <thead>
              <tr>
                <th>WHEN / ACTOR</th>
                <th>ACTION / ENTITY</th>
                <th>REASON</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {date(item.createdAt)}
                    <small>{item.actorId}</small>
                  </td>
                  <td>
                    {human(item.action)}
                    <small>{item.entityId}</small>
                  </td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {audit.data?.total === 0 && <p>No administrative changes yet.</p>}
        <PageControls resource={audit} label="audit events" />
      </details>
      {action && (
        <Modal
          title={
            action.type === "invitation"
              ? "Reissue invitation"
              : action.type === "SUSPENDED"
                ? "Suspend membership"
                : "Reactivate membership"
          }
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <p>
            {action.member.name} · {action.member.email}
          </p>
          <p>
            {action.type === "SUSPENDED"
              ? "This revokes existing sessions. Historical cases and ownership are retained."
              : action.type === "invitation"
                ? "Previous invitations and sessions will be revoked. Save and share the replacement link privately."
                : "The member may sign in again with their existing password."}
          </p>
          <form
            className="od-membership-form"
            onSubmit={(e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              void change(async () => {
                const reason = reasonOf(values);
                const value = await request(
                  `admin/members/${encodeURIComponent(action.member.id)}/${action.type === "invitation" ? "invitation" : "status"}`,
                  action.type === "invitation"
                    ? { reason }
                    : { status: action.type, reason },
                  action.type === "invitation" ? "POST" : "PATCH",
                );
                if (action.type === "invitation") showInvitation(value);
                setAction(null);
                setNotice(
                  action.type === "invitation"
                    ? "Replacement invitation created."
                    : "Membership status updated.",
                );
              });
            }}
          >
            <fieldset disabled={busy}>
              <Reason />
              {error && (
                <p role="alert" className="od-error">
                  {error}
                </p>
              )}
              <button className="od-primary" type="submit">
                {busy ? "Saving…" : "Confirm change"}
              </button>
              <button
                className="od-secondary"
                type="button"
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
