import assert from "node:assert/strict";
import { test } from "node:test";
import { readLoadTargets, evaluateLoadTargets } from "./load-targets.mjs";

const config = {
  version: 1,
  name: "Synthetic tooling test only",
  minRequests: 20,
  maxP95Ms: 100,
  maxP99Ms: 150,
  minRequestsPerSecond: 10,
  minDurationSeconds: 2,
  byRole: { supplier: { minRequests: 5, maxP95Ms: 90 } },
};
const report = {
  requests: 20,
  elapsedMs: 2000,
  requestsPerSecond: 10,
  latencyMs: { p95: 100, p99: 150 },
  byRole: { supplier: { requests: 5, latencyMs: { p95: 90, p99: 120 } } },
};
const targets = () => readLoadTargets(JSON.stringify(config));

test("no configuration is explicitly unassessed, never a target pass", () => {
  assert.equal(readLoadTargets(), undefined);
  assert.equal(evaluateLoadTargets(undefined, report).status, "not-configured");
});

test("inclusive boundaries pass and report target identity and every check", () => {
  const result = evaluateLoadTargets(targets(), report);
  assert.equal(result.status, "passed");
  assert.equal(result.name, config.name);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.checks.length, 7);
  assert(result.checks.every((check) => check.passed));
});

test("fails raw latency above the boundary instead of rounding it into a pass", () => {
  const result = evaluateLoadTargets(targets(), {
    ...report,
    latencyMs: { p95: 100.01, p99: 150.01 },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.checks.filter((check) => !check.passed).length, 2);
});

test("missing roles and inadequate sample sizes cannot pass", () => {
  for (const byRole of [
    {},
    { supplier: { requests: 4, latencyMs: { p95: 1 } } },
  ]) {
    const result = evaluateLoadTargets(targets(), {
      ...report,
      requests: 19,
      byRole,
    });
    assert.equal(result.status, "failed");
    assert(
      result.checks.some(
        (check) => check.metric === "requests" && !check.passed,
      ),
    );
  }
});

test("duration and throughput fail independently and missing metrics fail closed", () => {
  const result = evaluateLoadTargets(targets(), {
    ...report,
    elapsedMs: 1000,
    requestsPerSecond: 9,
  });
  assert.equal(result.checks.filter((check) => !check.passed).length, 2);
  assert.equal(
    evaluateLoadTargets(targets(), { ...report, latencyMs: {} }).status,
    "failed",
  );
});

test("rejects malformed, incomplete, unknown, negative and nonfinite target configuration", () => {
  for (const value of [
    null,
    [],
    {},
    { ...config, version: 2 },
    { ...config, name: " " },
    { ...config, minRequests: 0 },
    { ...config, minRequests: 1.5 },
    { ...config, maxP95Ms: "100" },
    { ...config, maxP95Ms: -1 },
    { ...config, maxP99Ms: null },
    { ...config, maxP9Ms: 4 },
    { ...config, byRole: { admin: { minRequests: 1, maxP95Ms: 1 } } },
    { ...config, byRole: { supplier: { maxP95Ms: 1 } } },
    {
      ...config,
      byRole: { supplier: { minRequests: 1, maxP95Ms: 1, typo: 1 } },
    },
  ]) {
    assert.throws(() => readLoadTargets(JSON.stringify(value)));
  }
  for (const raw of [
    "",
    "invalid",
    JSON.stringify(config).replace('"maxP95Ms":100', '"maxP95Ms":1e999'),
  ]) {
    assert.throws(() => readLoadTargets(raw));
  }
});
