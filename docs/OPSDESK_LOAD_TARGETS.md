# Supplied targets for synthetic load runs

No performance targets are approved or enabled by default. `npm run ops:load` reports `targetAssessment.status: "not-configured"` unless `OPSDESK_LOAD_TARGETS` contains version-1 JSON. This tool compares a run with supplied limits; it does not establish owner approval, representative traffic or production readiness. Deployment remains paused.

Use the isolated preview and the existing [load procedure](OPSDESK_BOOKING_APPROVALS.md#synthetic-load-rehearsal). Run mutating API, browser and load fixtures sequentially. Obtain a reviewed workload and target file before using results for acceptance. Keep private target notes and reports under ignored `.opsdesk/`.

## Configuration

The following values demonstrate the format only. They are **not recommended or approved service targets**:

```json
{
  "version": 1,
  "name": "Illustrative tooling check; not approved",
  "minRequests": 200,
  "maxP95Ms": 1000,
  "maxP99Ms": 2000,
  "minRequestsPerSecond": 1,
  "minDurationSeconds": 10,
  "byRole": {
    "supplier": {"minRequests": 20, "maxP95Ms": 1000}
  }
}
```

Save your reviewed JSON in `.opsdesk/load-targets.json`, then set:

```powershell
$env:OPSDESK_LOAD_TARGETS = Get-Content -Raw .opsdesk/load-targets.json
npm run ops:load
Remove-Item Env:OPSDESK_LOAD_TARGETS
```

`version`, nonblank `name` (at most 120 characters), positive integer `minRequests` and positive finite numeric `maxP95Ms` are required. `maxP99Ms`, `minRequestsPerSecond`, `minDurationSeconds` and `byRole` are optional. Unknown fields, invalid types, nonpositive/nonfinite values and unknown roles are rejected before fixture creation. Each role rule requires its own `minRequests` and `maxP95Ms`, with optional `maxP99Ms`. Supported roles are manager, agency, customer, agent and supplier. Weights and identities are configured separately using the existing load options; a target does not enable a role automatically.

## Results and limits

- Results include the target name, SHA-256 of its parsed JSON serialization, each actual value, inclusive comparison (`>=` or `<=`) and pass/fail. Preserve the original file too: the digest identifies serialized configuration and is not an approval signature.
- Latency checks use unrounded nearest-rank measured percentiles; throughput uses the unrounded measured request count divided by workload elapsed time. Rounded display summaries do not decide a threshold result.
- Duration is measured from workload start through draining in-flight requests, excluding setup, authentication, preflight, post-run write verification and cleanup. This is a closed-loop worker harness, not an offered-arrival-rate generator or a frontend/TLS timing test.
- Missing role measurements, absent/nonfinite metrics, insufficient samples and violated limits fail the assessment. Request counts are measured operations, including manager writes in the manager role. Roles not named in `byRole` have no separate role target.
- Any HTTP, timeout, persistence, scope or cleanup error still fails the harness independently. No configurable error budget relaxes those checks. Target failure does not skip exactly-once write verification or fixture cleanup.
- A completed report is printed only after fixture cleanup succeeds. A failed target prints its report and exits nonzero. No configuration produces `not-configured`, not a target pass. Always check the process exit status, not a JSON field in isolation.

Synthetic fixtures, uncontrolled OS/database caches, per-role sample sizes and observed traffic still need review. A supplied-target pass alone is not representative performance acceptance. Independent classifier labels, spoken accessibility evidence, live integrations and operational recovery remain separate unfinished work.

## Verification commands

`npm run ops:test:load-profile` runs the schedule/identity and target-unit tests without a database. Against an isolated preview, `npm run ops:test:load-targets` sequentially exercises unconfigured, passing and deliberately failing targets with 12 synthetic identities. Each scenario verifies 200 measured requests, 40 exactly-once writes, expected exit status and restoration of case/message/conversation counts. The broad test limits are wiring fixtures, not performance acceptance. Never run this alongside other mutating suites.
