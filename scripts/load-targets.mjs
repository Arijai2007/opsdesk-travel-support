import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadRoles } from "./load-profile.mjs";

function object(value, allowed, description) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${description} must be an object.`,
  );
  assert(
    Object.keys(value).every((key) => allowed.includes(key)),
    `${description} contains an unknown field.`,
  );
}

function limits(value, description) {
  assert(
    Number.isSafeInteger(value.minRequests) && value.minRequests > 0,
    `${description}.minRequests must be a positive safe integer.`,
  );
  assert(
    typeof value.maxP95Ms === "number" &&
      Number.isFinite(value.maxP95Ms) &&
      value.maxP95Ms > 0,
    `${description}.maxP95Ms must be a positive finite number.`,
  );
  for (const key of [
    "maxP99Ms",
    "minRequestsPerSecond",
    "minDurationSeconds",
  ]) {
    if (Object.hasOwn(value, key))
      assert(
        typeof value[key] === "number" &&
          Number.isFinite(value[key]) &&
          value[key] > 0,
        `${description}.${key} must be a positive finite number.`,
      );
  }
}

export function readLoadTargets(raw) {
  if (raw === undefined) return undefined;
  const value = JSON.parse(raw);
  object(
    value,
    [
      "version",
      "name",
      "minRequests",
      "maxP95Ms",
      "maxP99Ms",
      "minRequestsPerSecond",
      "minDurationSeconds",
      "byRole",
    ],
    "Load targets",
  );
  assert.equal(value.version, 1, "Load targets version must be 1.");
  assert(
    typeof value.name === "string" &&
      value.name.trim().length > 0 &&
      value.name.length <= 120,
    "Load targets name must contain 1–120 characters.",
  );
  limits(value, "Load targets");
  if (Object.hasOwn(value, "byRole")) {
    object(value.byRole, loadRoles, "byRole");
    for (const [role, rule] of Object.entries(value.byRole)) {
      object(rule, ["minRequests", "maxP95Ms", "maxP99Ms"], `byRole.${role}`);
      limits(rule, `byRole.${role}`);
    }
  }
  return value;
}

// This assesses only a supplied synthetic-run target, not owner approval or
// representative traffic, controlled caches, frontend latency or readiness.
export function evaluateLoadTargets(targets, report) {
  if (!targets) return { status: "not-configured", checks: [] };
  const checks = [];
  function check(scope, metric, actual, operator, target) {
    checks.push({
      scope,
      metric,
      actual: Number.isFinite(actual) ? actual : null,
      operator,
      target,
      passed:
        Number.isFinite(actual) &&
        (operator === ">=" ? actual >= target : actual <= target),
    });
  }
  function latency(scope, rule, measured) {
    check(scope, "requests", measured?.requests ?? 0, ">=", rule.minRequests);
    check(scope, "p95Ms", measured?.latencyMs?.p95, "<=", rule.maxP95Ms);
    if (rule.maxP99Ms !== undefined)
      check(scope, "p99Ms", measured?.latencyMs?.p99, "<=", rule.maxP99Ms);
  }
  latency("all", targets, report);
  if (targets.minRequestsPerSecond !== undefined) {
    check(
      "all",
      "requestsPerSecond",
      report.requestsPerSecond,
      ">=",
      targets.minRequestsPerSecond,
    );
  }
  if (targets.minDurationSeconds !== undefined) {
    check(
      "all",
      "durationSeconds",
      report.elapsedMs / 1000,
      ">=",
      targets.minDurationSeconds,
    );
  }
  for (const [role, rule] of Object.entries(targets.byRole ?? {}))
    latency(role, rule, report.byRole?.[role]);
  return {
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    name: targets.name,
    sha256: createHash("sha256").update(JSON.stringify(targets)).digest("hex"),
    scope:
      "Supplied synthetic-run targets only; approval and representative acceptance remain external.",
    checks,
  };
}
