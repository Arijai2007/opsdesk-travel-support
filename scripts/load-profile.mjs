import assert from "node:assert/strict";

export const loadRoles = ["manager", "agency", "customer", "agent", "supplier"];

// A deterministic read schedule. Manager writes are scheduled separately.
export function readRoleProfile(raw) {
  const input = raw === undefined ? { manager: 1 } : JSON.parse(raw);
  assert(
    input && typeof input === "object" && !Array.isArray(input),
    "OPSDESK_LOAD_ROLE_WEIGHTS must be a JSON object.",
  );
  assert(
    Object.keys(input).every((role) => loadRoles.includes(role)),
    "Unknown load role. Use manager, agency, customer, agent or supplier.",
  );
  const weights = Object.fromEntries(
    loadRoles.map((role) => [
      role,
      Object.hasOwn(input, role) ? input[role] : 0,
    ]),
  );
  assert(
    Object.values(weights).every(
      (weight) => Number.isInteger(weight) && weight >= 0 && weight <= 100,
    ),
    "Read role weights must be integers from 0 to 100.",
  );
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  assert(
    total >= 1 && total <= 100,
    "Read role weights must sum to 1 through 100.",
  );
  const active = loadRoles.filter((role) => weights[role] > 0);
  const scores = Object.fromEntries(active.map((role) => [role, 0]));
  const schedule = [];
  for (let i = 0; i < total; i++) {
    for (const role of active) scores[role] += weights[role];
    const selected = active.reduce((best, role) =>
      scores[role] > scores[best] ? role : best,
    );
    scores[selected] -= total;
    schedule.push(selected);
  }
  return { weights, schedule };
}
