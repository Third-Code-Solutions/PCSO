/**
 * Unit tests for the in-memory fixed-window rate limiter (API-005).
 * Tests: rateLimit, getClientIp, rateLimitProblemResponse, enforceRateLimit,
 *        store pruning.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rateLimit,
  resetRateLimitStore,
  rateLimitStoreSize,
  rateLimitStoreHas,
  seedRateLimitStore,
  getClientIp,
  rateLimitProblemResponse,
  enforceRateLimit,
  MAX_KEYS,
} from "./rate-limit";

const ORIGINAL_HOPS = process.env.TRUSTED_PROXY_HOPS;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-03T08:00:00Z"));
  resetRateLimitStore();
  // Ensure the single-edge-proxy default unless a test overrides it.
  delete process.env.TRUSTED_PROXY_HOPS;
});

afterEach(() => {
  vi.useRealTimers();
  if (ORIGINAL_HOPS === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = ORIGINAL_HOPS;
});

// ---------------------------------------------------------------------------
// rateLimit
// ---------------------------------------------------------------------------

describe("rateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    for (let i = 0; i < 5; i += 1) {
      const result = rateLimit({ key: "t:1.1.1.1", limit: 5, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - (i + 1));
      expect(result.retryAfterSeconds).toBe(0);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < 3; i += 1) {
      rateLimit({ key: "t:1.1.1.1", limit: 3, windowMs: 60_000 });
    }
    const blocked = rateLimit({ key: "t:1.1.1.1", limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("reports a decreasing retryAfterSeconds as the window ages", () => {
    rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 });
    vi.advanceTimersByTime(45_000);
    const blocked = rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(15);
  });

  it("reports at least 1 second retry-after even at the window edge", () => {
    rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 });
    vi.advanceTimersByTime(59_900);
    const blocked = rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it("resets the counter after the window elapses", () => {
    rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 });
    expect(
      rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 }).allowed,
    ).toBe(false);

    vi.advanceTimersByTime(60_001);

    const fresh = rateLimit({ key: "t:1.1.1.1", limit: 1, windowMs: 60_000 });
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(0);
  });

  it("tracks independent keys separately", () => {
    rateLimit({ key: "login:1.1.1.1", limit: 1, windowMs: 60_000 });
    const otherIp = rateLimit({
      key: "login:2.2.2.2",
      limit: 1,
      windowMs: 60_000,
    });
    const otherBucket = rateLimit({
      key: "register:1.1.1.1",
      limit: 1,
      windowMs: 60_000,
    });
    expect(otherIp.allowed).toBe(true);
    expect(otherBucket.allowed).toBe(true);
    expect(
      rateLimit({ key: "login:1.1.1.1", limit: 1, windowMs: 60_000 }).allowed,
    ).toBe(false);
  });

  it("prunes expired entries after the prune interval", () => {
    rateLimit({ key: "a", limit: 5, windowMs: 10_000 });
    rateLimit({ key: "b", limit: 5, windowMs: 10_000 });
    expect(rateLimitStoreSize()).toBe(2);

    // Both windows expire; next call after the prune interval sweeps them.
    vi.advanceTimersByTime(70_000);
    rateLimit({ key: "c", limit: 5, windowMs: 10_000 });
    expect(rateLimitStoreSize()).toBe(1);
  });

  it("does not prune live entries", () => {
    rateLimit({ key: "long", limit: 5, windowMs: 600_000 });
    vi.advanceTimersByTime(70_000);
    rateLimit({ key: "other", limit: 5, windowMs: 600_000 });
    expect(rateLimitStoreSize()).toBe(2);
  });

  it("hard-caps live keys when the store exceeds MAX_KEYS", () => {
    // All entries are live (well within their window), so expired-only
    // reaping cannot help — the hard cap must still bound the store.
    const resetAt = Date.now() + 600_000;
    seedRateLimitStore(MAX_KEYS + 100, resetAt);
    expect(rateLimitStoreSize()).toBe(MAX_KEYS + 100);

    // A single call triggers maybePrune, which evicts down to the cap and
    // then inserts the new key.
    rateLimit({ key: "trigger", limit: 5, windowMs: 600_000 });

    expect(rateLimitStoreSize()).toBe(MAX_KEYS + 1);
    expect(rateLimitStoreHas("trigger")).toBe(true);
  });

  it("evicts the oldest keys first when over the hard cap", () => {
    const resetAt = Date.now() + 600_000;
    seedRateLimitStore(MAX_KEYS + 10, resetAt); // 10 keys over the cap
    rateLimit({ key: "trigger", limit: 5, windowMs: 600_000 });

    // The 10 oldest seeded keys are evicted; newer ones survive.
    expect(rateLimitStoreHas("seed:0")).toBe(false);
    expect(rateLimitStoreHas("seed:9")).toBe(false);
    expect(rateLimitStoreHas("seed:10")).toBe(true);
    expect(rateLimitStoreHas(`seed:${MAX_KEYS + 9}`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

describe("getClientIp", () => {
  function requestWithXff(value: string): Request {
    return new Request("http://localhost/api", {
      headers: { "x-forwarded-for": value },
    });
  }

  it("returns the single forwarded entry behind one edge proxy (default hops)", () => {
    // Honest single-edge case (e.g. Vercel): XFF holds only the client IP.
    expect(getClientIp(requestWithXff("203.0.113.5"))).toBe("203.0.113.5");
  });

  it("ignores an attacker-spoofed leftmost entry and anchors from the right", () => {
    // Attacker injects a leftmost hop; the trusted proxy appends real hops to
    // the right. With the default single trusted hop the spoofed leftmost is
    // never selected.
    const spoofed = "6.6.6.6, 203.0.113.9, 10.0.0.1";
    const ip = getClientIp(requestWithXff(spoofed));
    expect(ip).not.toBe("6.6.6.6");
    expect(ip).toBe("203.0.113.9");
  });

  it("selects the entry TRUSTED_PROXY_HOPS positions left of the rightmost", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const chain = "1.1.1.1, 2.2.2.2, 3.3.3.3, 4.4.4.4";
    // length 4, index 4 - 1 - 2 = 1 -> "2.2.2.2".
    expect(getClientIp(requestWithXff(chain))).toBe("2.2.2.2");
  });

  it("treats hops=0 as the app terminating the client connection (rightmost)", () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    // Nginx proxy_add_x_forwarded_for appends the real socket peer last.
    expect(getClientIp(requestWithXff("6.6.6.6, 203.0.113.20"))).toBe(
      "203.0.113.20",
    );
  });

  it("clamps a negative TRUSTED_PROXY_HOPS to 0", () => {
    process.env.TRUSTED_PROXY_HOPS = "-5";
    expect(getClientIp(requestWithXff("6.6.6.6, 203.0.113.21"))).toBe(
      "203.0.113.21",
    );
  });

  it("falls back to the default hop count for a non-numeric value", () => {
    process.env.TRUSTED_PROXY_HOPS = "not-a-number";
    // Default hops = 1: length 2, index 0 -> leftmost is still selected here,
    // but the important property is it does not throw and stays deterministic.
    expect(getClientIp(requestWithXff("203.0.113.30, 10.0.0.1"))).toBe(
      "203.0.113.30",
    );
  });

  it("falls back to the rightmost entry when hops exceeds the chain length", () => {
    process.env.TRUSTED_PROXY_HOPS = "10";
    expect(getClientIp(requestWithXff("6.6.6.6, 203.0.113.40"))).toBe(
      "203.0.113.40",
    );
  });

  it("falls back to x-real-ip when there is no x-forwarded-for", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "198.51.100.4" },
    });
    expect(getClientIp(request)).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip for a whitespace-only x-forwarded-for", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "  ", "x-real-ip": "198.51.100.9" },
    });
    expect(getClientIp(request)).toBe("198.51.100.9");
  });

  it('returns "unknown" when no forwarding headers exist', () => {
    const request = new Request("http://localhost/api");
    expect(getClientIp(request)).toBe("unknown");
  });

  it('returns "unknown" for a whitespace-only x-forwarded-for with no real-ip', () => {
    expect(getClientIp(requestWithXff("  "))).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// rateLimitProblemResponse
// ---------------------------------------------------------------------------

describe("rateLimitProblemResponse", () => {
  it("returns an RFC 7807 problem+json 429 with Retry-After", async () => {
    const response = rateLimitProblemResponse(42);
    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toBe(
      "application/problem+json",
    );
    expect(response.headers.get("Retry-After")).toBe("42");

    const body = (await response.json()) as {
      type: string;
      title: string;
      status: number;
      detail: string;
    };
    expect(body.type).toBe("about:blank");
    expect(body.title).toBe("Too Many Requests");
    expect(body.status).toBe(429);
    expect(body.detail).toContain("42 seconds");
  });

  it("uses singular wording for a 1-second retry", async () => {
    const response = rateLimitProblemResponse(1);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toContain("1 second.");
  });
});

// ---------------------------------------------------------------------------
// enforceRateLimit
// ---------------------------------------------------------------------------

describe("enforceRateLimit", () => {
  function requestFrom(ip: string): Request {
    return new Request("http://localhost/api", {
      headers: { "x-forwarded-for": ip },
    });
  }

  it("returns null while under the limit", () => {
    const result = enforceRateLimit(requestFrom("1.2.3.4"), {
      bucket: "test",
      limit: 2,
      windowMs: 60_000,
    });
    expect(result).toBeNull();
  });

  it("returns a 429 Response once the (bucket, ip) pair is exhausted", () => {
    const options = { bucket: "test", limit: 2, windowMs: 60_000 };
    expect(enforceRateLimit(requestFrom("1.2.3.4"), options)).toBeNull();
    expect(enforceRateLimit(requestFrom("1.2.3.4"), options)).toBeNull();

    const blocked = enforceRateLimit(requestFrom("1.2.3.4"), options);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it("does not block a different IP in the same bucket", () => {
    const options = { bucket: "test", limit: 1, windowMs: 60_000 };
    expect(enforceRateLimit(requestFrom("1.2.3.4"), options)).toBeNull();
    expect(enforceRateLimit(requestFrom("5.6.7.8"), options)).toBeNull();
  });
});
