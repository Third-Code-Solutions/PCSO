/**
 * PCSO HRIS — k6 load test (TOR 3.5.14 / PERF-001 / PRD §9.2 acceptance).
 *
 * Target: 900+ concurrent users at < 3 s average response time.
 * Profile: ramp 0 → 900 VUs over 5 minutes, sustain 900 VUs for 10 minutes,
 *          ramp down over 1 minute.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://staging.example.gov.ph scripts/load-test/k6-load.js
 *
 * Optional env:
 *   VERIFY_TOKEN   — a real /verify token so that route returns 200s
 *   MAX_VUS        — override the 900-VU target (e.g. 100 for a dry run)
 *   SUSTAIN        — override the 10m sustain window (e.g. "2m")
 *
 * IMPORTANT — read scripts/load-test/README.md before running:
 *   - Never point this at production during business hours.
 *   - The Supabase tier must be Pro/Enterprise (PERF-002); the free tier's
 *     connection ceiling invalidates results.
 *   - Run from a machine/network that can actually source 900 connections
 *     (a laptop on office Wi-Fi usually cannot — use a cloud runner).
 *
 * Scope: unauthenticated surface (login render, middleware redirect, public
 * verify). These exercise the full Next.js RSC render pipeline, middleware,
 * and database-backed verify path without needing 900 seeded sessions.
 * Authenticated-journey load (dashboard, leave, payroll) requires seeded
 * test users + session tokens; see README "Authenticated scenarios".
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const VERIFY_TOKEN = __ENV.VERIFY_TOKEN || "";
const MAX_VUS = Number(__ENV.MAX_VUS || 900);
const SUSTAIN = __ENV.SUSTAIN || "10m";

const loginTrend = new Trend("route_login_duration", true);
const rootTrend = new Trend("route_root_duration", true);
const verifyTrend = new Trend("route_verify_duration", true);

export const options = {
  scenarios: {
    ramp_900: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: MAX_VUS }, // ramp 0 → 900
        { duration: SUSTAIN, target: MAX_VUS }, // sustain
        { duration: "1m", target: 0 }, // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // PRD §9.2 acceptance: p95 < 3000 ms, error rate < 1%.
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
    // Per-route visibility so one slow surface cannot hide behind another.
    "http_req_duration{route:login}": ["p(95)<3000"],
    "http_req_duration{route:root}": ["p(95)<3000"],
    "http_req_duration{route:verify}": ["p(95)<3000"],
    checks: ["rate>0.99"],
  },
  // Do not reuse connections across iterations forever — mimic distinct users.
  noVUConnectionReuse: false,
  userAgent: "pcso-hris-k6-load/1.0 (TOR 3.5.14)",
};

export default function () {
  // 1. Login page — heaviest anonymous RSC render.
  const login = http.get(`${BASE_URL}/login`, { tags: { route: "login" } });
  loginTrend.add(login.timings.duration);
  check(login, { "login 200": (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1); // 1–3 s think time

  // 2. Root — middleware auth gate + redirect chain.
  const root = http.get(`${BASE_URL}/`, { tags: { route: "root" } });
  rootTrend.add(root.timings.duration);
  check(root, { "root resolves 200": (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);

  // 3. Public verify — DB-backed public endpoint (PIM-017).
  const token = VERIFY_TOKEN || `load-probe-${__VU}-${__ITER}`;
  const verify = http.get(`${BASE_URL}/verify/${token}`, {
    tags: { route: "verify" },
    responseCallback: http.expectedStatuses(200, 404),
  });
  verifyTrend.add(verify.timings.duration);
  check(verify, {
    "verify expected status": (r) => r.status === 200 || r.status === 404,
  });

  sleep(Math.random() * 3 + 2); // 2–5 s think time before next loop
}

export function handleSummary(data) {
  // Persist the raw summary for the TOR 9.2 acceptance evidence pack.
  return {
    stdout: textSummary(data),
    "load-test-summary.json": JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const line = (label, value) => `${label.padEnd(34)} ${value}\n`;
  let out = "\nPCSO HRIS load test — TOR 3.5.14 summary\n";
  out += "=".repeat(56) + "\n";
  if (m.vus_max) out += line("Max VUs", m.vus_max.values.max);
  if (m.http_reqs) {
    out += line("Total requests", m.http_reqs.values.count);
    out += line("Requests/s", m.http_reqs.values.rate.toFixed(1));
  }
  if (m.http_req_duration) {
    out += line("Avg duration (ms)", m.http_req_duration.values.avg.toFixed(0));
    out += line(
      "p95 duration (ms)",
      m.http_req_duration.values["p(95)"].toFixed(0),
    );
  }
  if (m.http_req_failed) {
    out += line(
      "Error rate",
      (m.http_req_failed.values.rate * 100).toFixed(2) + "%",
    );
  }
  out += "Acceptance: p95 < 3000 ms AND error rate < 1% (PRD §9.2)\n";
  return out;
}
