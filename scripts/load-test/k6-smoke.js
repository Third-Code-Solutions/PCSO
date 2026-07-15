/**
 * PCSO HRIS — k6 smoke test (TOR 3.5.14 / PERF-001 pre-flight).
 *
 * Small, fast sanity run against the public no-auth surface. Run this BEFORE
 * k6-load.js to confirm the target environment is reachable and the routes
 * under test respond correctly — a failing smoke means the full 900-VU run
 * would only measure errors.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://staging.example.gov.ph scripts/load-test/k6-smoke.js
 *
 * Routes exercised (all unauthenticated GETs):
 *   - /login             — login page (full RSC render path)
 *   - /                  — root, follows the redirect chain to /login
 *   - /verify/<token>    — public QR verification endpoint (PIM-017).
 *                          Pass -e VERIFY_TOKEN=<real token> to assert 200;
 *                          without it a probe token is used and 404 is the
 *                          expected (and accepted) response.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const VERIFY_TOKEN = __ENV.VERIFY_TOKEN || "";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    // TOR 9.2 / PERF-001: sub-3-second average response — enforced at p95
    // which is stricter than the mean.
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{route:login}": ["p(95)<3000"],
    "http_req_duration{route:root}": ["p(95)<3000"],
    "http_req_duration{route:verify}": ["p(95)<3000"],
  },
};

export default function () {
  group("login page", () => {
    const res = http.get(`${BASE_URL}/login`, { tags: { route: "login" } });
    check(res, {
      "login: status 200": (r) => r.status === 200,
      "login: renders html": (r) =>
        String(r.headers["Content-Type"] || "").includes("text/html"),
    });
  });

  group("root redirect", () => {
    // Anonymous hit on / must land on the login page (middleware gate).
    const res = http.get(`${BASE_URL}/`, { tags: { route: "root" } });
    check(res, {
      "root: final status 200": (r) => r.status === 200,
      "root: resolved to login": (r) => String(r.url).includes("/login"),
    });
  });

  group("public verify endpoint", () => {
    const token = VERIFY_TOKEN || "smoke-probe-invalid-token";
    const res = http.get(`${BASE_URL}/verify/${token}`, {
      tags: { route: "verify" },
      // An invalid probe token legitimately 404s — do not count it as a
      // failed request (http_req_failed treats 4xx as failure by default).
      responseCallback: http.expectedStatuses(200, 404),
    });
    check(res, {
      "verify: expected status": (r) =>
        VERIFY_TOKEN ? r.status === 200 : r.status === 404 || r.status === 200,
    });
  });

  sleep(1);
}
