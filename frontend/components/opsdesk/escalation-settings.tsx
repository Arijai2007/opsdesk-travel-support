"use client";
import { useState } from "react";
import type { Person } from "@/lib/opsdesk-types";
import { DirectorySelect } from "./directory-select";
import { useOpsResource } from "./paged-data";
import type { Mutation } from "./ui";

type Member = { id: string; name: string; status?: string };
type Rotation = {
  region: string;
  enabled: boolean;
  slotHours: number;
  anchorAt: string;
  version: number;
  members: Member[];
};

function RotationEditor({
  region,
  policy,
  now,
  busy,
  mutate,
  saved,
}: {
  region: string;
  policy?: Rotation;
  now: string;
  busy: boolean;
  mutate: Mutation;
  saved: (policy: Rotation) => void;
}) {
  const [enabled, setEnabled] = useState(policy?.enabled ?? true);
  const [hours, setHours] = useState(policy?.slotHours ?? 24);
  const [anchor, setAnchor] = useState(
    policy?.anchorAt.slice(0, 16) ?? `${now.slice(0, 10)}T00:00`,
  );
  const [members, setMembers] = useState<Member[]>(policy?.members ?? []);
  const [candidate, setCandidate] = useState<Person>();
  const [reason, setReason] = useState("");
  function move(index: number, delta: number) {
    const reordered = [...members];
    [reordered[index], reordered[index + delta]] = [
      reordered[index + delta],
      reordered[index],
    ];
    setMembers(reordered);
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void mutate(
          `escalation-rotations/${region}`,
          {
            enabled,
            slotHours: hours,
            anchorAt: `${anchor}:00Z`,
            managerIds: members.map((m) => m.id),
            reason,
          },
          "Escalation rotation saved.",
          "PATCH",
        )
          .then((result) =>
            saved({
              region,
              enabled,
              slotHours: hours,
              anchorAt: `${anchor}:00Z`,
              version: Number(result.version),
              members,
            }),
          )
          .catch(() => {});
      }}
    >
      <p>
        {policy
          ? `Saved rotation v${policy.version}.`
          : "No saved rotation. Existing manager coverage applies until a rotation is enabled."}
      </p>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable this rotation
      </label>
      <label>
        Rotation slot hours
        <input
          required
          type="number"
          disabled={busy}
          min={1}
          max={168}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
      </label>
      <label>
        Rotation anchor (UTC)
        <input
          required
          type="datetime-local"
          disabled={busy}
          min="1970-01-01T00:00"
          max="2100-12-31T23:59"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
        />
      </label>
      <DirectorySelect<Person>
        path="people?kind=MANAGER"
        label="Rotation manager"
        refresh={now}
        value={candidate?.id ?? ""}
        disabled={busy}
        onSelect={(_, p) => setCandidate(p)}
        text={(p) => p.name}
      >
        <option value="">Choose a manager to add</option>
      </DirectorySelect>
      <button
        type="button"
        className="od-secondary"
        disabled={
          busy ||
          !candidate ||
          members.length >= 50 ||
          members.some((m) => m.id === candidate.id)
        }
        onClick={() => {
          if (candidate)
            setMembers([
              ...members,
              { id: candidate.id, name: candidate.name },
            ]);
          setCandidate(undefined);
        }}
      >
        Add rotation manager
      </button>
      <ol aria-label="Ordered rotation roster">
        {members.map((m, i) => (
          <li key={m.id}>
            <span>
              {m.name}
              {m.status && m.status !== "ACTIVE"
                ? ` (${m.status.toLowerCase()})`
                : ""}
            </span>{" "}
            <button
              type="button"
              className="od-text-button"
              aria-label={`Move ${m.name} earlier`}
              disabled={busy || i === 0}
              onClick={() => move(i, -1)}
            >
              Earlier
            </button>{" "}
            <button
              type="button"
              className="od-text-button"
              aria-label={`Move ${m.name} later`}
              disabled={busy || i === members.length - 1}
              onClick={() => move(i, 1)}
            >
              Later
            </button>{" "}
            <button
              type="button"
              className="od-text-button"
              aria-label={`Remove ${m.name} from rotation`}
              disabled={busy}
              onClick={() => setMembers(members.filter((v) => v.id !== m.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <label>
        Rotation change reason
        <input
          required
          minLength={3}
          disabled={busy}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button className="od-secondary" disabled={busy || members.length === 0}>
        Save escalation rotation
      </button>
    </form>
  );
}

export function EscalationSettings({
  refresh,
  busy,
  mutate,
}: {
  refresh: string;
  busy: boolean;
  mutate: Mutation;
}) {
  const [region, setRegion] = useState("GLOBAL"),
    [revision, setRevision] = useState(0);
  const [savedPolicies, setSavedPolicies] = useState<Record<string, Rotation>>(
    {},
  );
  const resource = useOpsResource<{ items: Rotation[] }>(
    "escalation-rotations",
    `${refresh}:${revision}`,
  );
  const fetchedPolicy = resource.data?.items.find((p) => p.region === region);
  const savedPolicy = savedPolicies[region];
  // A completed save is authoritative while the directory refresh is in flight.
  // Otherwise changing regions can briefly expose an empty/default editor.
  const policy =
    savedPolicy && savedPolicy.version > (fetchedPolicy?.version ?? 0)
      ? savedPolicy
      : fetchedPolicy;
  return (
    <section className="od-panel">
      <h4>Escalation rotations</h4>
      <p>
        Each UTC slot advances the primary through the ordered roster. Other
        roster members provide backups in order when the primary is unavailable
        or off duty. An enabled regional rotation takes precedence over Global;
        missing regional coverage stays visibly unowned.
      </p>
      <label>
        Rotation region
        <select
          aria-label="Rotation region"
          disabled={busy}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {["GLOBAL", "ASIA", "EUROPE", "AMERICAS"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      {resource.error ? (
        <p role="alert">
          {resource.error}
          <button type="button" onClick={resource.retry}>
            Retry rotations
          </button>
        </p>
      ) : !resource.data ? (
        <p role="status">Loading rotations...</p>
      ) : (
        <RotationEditor
          key={`${region}:${policy?.version}:${revision}`}
          region={region}
          policy={policy}
          now={refresh}
          busy={busy}
          mutate={mutate}
          saved={(updated) => {
            setSavedPolicies((policies) => ({
              ...policies,
              [updated.region]: updated,
            }));
            setRevision((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}
