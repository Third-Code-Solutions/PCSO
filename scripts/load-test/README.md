# Load-Test Harness (k6) — TOR 3.5.14 / PERF-001

k6 scripts backing the PRD §9.2 technical acceptance criterion:

> Load test result: 900+ concurrent users, < 3 second average response time,
> 5,000 TPS minimum. Test report with k6 or Locust output submitted.

k6 is an **external binary** — it is deliberately NOT in `package.json`.

## Install k6

- Windows: `winget install k6 --source winget` (or `choco install k6`)
- macOS: `brew install k6`
- Linux: <https://grafana.com/docs/k6/latest/set-up/install-k6/>
- Docker: `docker run --rm -i grafana/k6 run - < k6-smoke.js`

## Scripts

| Script        | Purpose                                            | Profile                          |
| ------------- | -------------------------------------------------- | -------------------------------- |
| `k6-smoke.js` | Pre-flight sanity: routes up, thresholds plausible | 5 VUs, 1 minute                  |
| `k6-load.js`  | TOR acceptance run: 900 concurrent users           | 0→900 over 5m, hold 10m, down 1m |

Both exercise the unauthenticated surface — login page render, middleware
redirect on `/`, and the public `/verify/[token]` endpoint — which covers the
full Next.js middleware + RSC render + database read path without needing 900
seeded sessions.

## How to run

```bash
# 1. Always smoke first
k6 run -e BASE_URL=https://<staging-host> scripts/load-test/k6-smoke.js

# 2. Full acceptance run
k6 run -e BASE_URL=https://<staging-host> scripts/load-test/k6-load.js

# Optional: real verify token so the verify route returns 200 instead of 404
k6 run -e BASE_URL=https://<staging-host> -e VERIFY_TOKEN=<jwt> scripts/load-test/k6-load.js

# Dry run at reduced scale (e.g. before paying for a load runner)
k6 run -e BASE_URL=https://<staging-host> -e MAX_VUS=100 -e SUSTAIN=2m scripts/load-test/k6-load.js
```

`k6-load.js` writes `load-test-summary.json` to the working directory — attach
it to the acceptance evidence pack.

## What to measure

| Metric                      | Threshold (encoded in scripts) | TOR mapping                                                                                                                                      |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `http_req_duration` p95     | < 3000 ms                      | PERF-001 / PRD §9.2                                                                                                                              |
| `http_req_failed` rate      | < 1%                           | PRD §9.2                                                                                                                                         |
| `vus_max`                   | ≥ 900                          | PERF-001 (900+ users)                                                                                                                            |
| Per-route p95 (tag `route`) | < 3000 ms each                 | no route hides behind another                                                                                                                    |
| DB transactions per second  | ≥ 5,000 TPS                    | PERF-002 — **not measured by k6**; read from the Supabase dashboard (Reports → Database) or `pg_stat_database.xact_commit` deltas during the run |

## Environment requirements & Supabase tier caveats

- **Target a staging deployment that mirrors production** (Vercel/Railway +
  Supabase). Never run 900 VUs against production during business hours.
- **Supabase free tier invalidates the test** (PERF-002): its connection and
  compute ceilings throttle far below 5,000 TPS. Upgrade the target project to
  **Pro/Enterprise** before the acceptance run and record the tier in the
  report. Watch the connection pooler (port 6543) — client-connection
  exhaustion shows up as 5xx spikes, not slow responses.
- **Load-generator capacity**: a single laptop cannot reliably hold 900
  concurrent connections. Use a cloud VM close to (but not inside) the target
  region, or Grafana Cloud k6 distributed runners.
- Vercel serverless will cold-start during the ramp — that is real user
  experience and stays in the numbers; note it in the report narrative.

## Authenticated scenarios (extension)

The TOR criterion is concurrency + latency, which the public surface
satisfies. To additionally load authenticated journeys (dashboard, leave
apply, payslip view):

1. Seed N test users (`npm run db:seed-auth`) in staging.
2. In a `setup()` phase, POST the Supabase token endpoint
   (`/auth/v1/token?grant_type=password`) per user and collect access tokens.
3. Attach `Cookie`/`Authorization` headers in the VU loop and hit
   `/dashboard`, `/leave`, `/payroll/payslips`.
4. Keep the same thresholds; tag routes accordingly.

Do NOT commit seeded credentials; pass them via `-e` or environment files
excluded from git.

## Mapping to TOR 9.2 acceptance

Submit as evidence:

1. `load-test-summary.json` + the k6 stdout capture (thresholds all green).
2. Supabase dashboard screenshot/export showing DB TPS during the window.
3. Environment description: app hosting tier, Supabase tier, regions,
   load-generator location, git commit SHA of the deployed build.
4. See `docs/LOAD-TESTING.md` for the full methodology + report template.
