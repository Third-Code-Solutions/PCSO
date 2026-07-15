# Load Testing — Methodology & Acceptance Mapping

**TOR references:** 3.5.14 (load testing), PERF-001 (900+ concurrent users,
< 3 s average response), PERF-002 (5,000 TPS database throughput), PRD §9.2
(technical acceptance).

**Harness:** [k6](https://k6.io) scripts in [`scripts/load-test/`](../scripts/load-test/README.md).
k6 is an external binary and is not a package.json dependency.

## Test profiles

| Profile    | Script        | Shape                                         | Purpose                                          |
| ---------- | ------------- | --------------------------------------------- | ------------------------------------------------ |
| Smoke      | `k6-smoke.js` | 5 VUs × 1 min                                 | Pre-flight: routes respond, thresholds plausible |
| Acceptance | `k6-load.js`  | 0→900 VUs over 5 min, hold 10 min, down 1 min | TOR PERF-001 evidence run                        |

Both drive the unauthenticated surface — `/login` (full RSC render), `/`
(middleware auth gate + redirect), `/verify/[token]` (public, DB-backed
PIM-017 endpoint). This exercises middleware, server rendering, and database
reads at target concurrency without requiring 900 seeded sessions. An
authenticated-journey extension is documented in the harness README.

## Thresholds (encoded in the scripts)

| Metric                      | Threshold                | Source                                              |
| --------------------------- | ------------------------ | --------------------------------------------------- |
| `http_req_duration` p95     | < 3,000 ms               | PERF-001 — p95 is stricter than the TOR's "average" |
| Per-route p95 (`route` tag) | < 3,000 ms               | prevents one route masking another                  |
| `http_req_failed`           | < 1%                     | PRD §9.2                                            |
| `checks` pass rate          | > 99%                    | functional correctness under load                   |
| Concurrency                 | 900 VUs sustained 10 min | PERF-001                                            |

A run is **accepted** only when k6 exits 0 (all thresholds green) at
`MAX_VUS=900` with the default sustain window.

## Database throughput (PERF-002)

k6 measures HTTP, not DB transactions. During the sustain window, capture DB
TPS from either:

- Supabase Dashboard → Reports → Database (queries per second), or
- `SELECT xact_commit FROM pg_stat_database WHERE datname = 'postgres';`
  sampled at the start and end of the sustain window: `TPS = Δxact_commit / seconds`.

Record the figure in the report. The 5,000 TPS criterion requires a
**Supabase Pro/Enterprise** project — free-tier limits make the number
unattainable and the run invalid.

## Environment rules

1. Target a staging deployment that mirrors production hosting (same Vercel
   plan/region, same Supabase tier). Never load-test production in business hours.
2. Generate load from a cloud runner near the target region — not a laptop.
3. Pin and record the deployed git SHA before the run.
4. Warm-up is intentionally NOT performed beyond the 5-minute ramp; serverless
   cold starts are real user experience and stay in the data.

## Acceptance evidence pack (PRD §9.2)

1. k6 stdout capture + `load-test-summary.json` from the acceptance run.
2. DB TPS measurement (dashboard export or `pg_stat_database` samples).
3. Environment sheet: hosting tier, Supabase tier, regions, runner location,
   commit SHA, date/time window.
4. Narrative: anomalies observed (cold-start spike shape, pooler saturation,
   rate-limit hits) and their resolution.

## Report template

```
PCSO HRIS Load Test Report
Date/window:            2026-MM-DD HH:MM–HH:MM (+08)
Deployed commit:        <sha>
App hosting:            <Vercel plan / region>
Database:               Supabase <tier> / <region>
Load generator:         <machine, region, k6 version>

Results
  Max concurrent VUs:   900
  Total requests:       <n>
  Requests/s (avg):     <n>
  Avg duration:         <n> ms
  p95 duration:         <n> ms        (threshold < 3000 — PASS/FAIL)
  Error rate:           <n> %         (threshold < 1%  — PASS/FAIL)
  DB TPS (sustain avg): <n>           (threshold ≥ 5000 — PASS/FAIL)

Verdict: PASS / FAIL against TOR 3.5.14 + PERF-001/002 (PRD §9.2)
Attachments: load-test-summary.json, k6 stdout, Supabase report export
```
