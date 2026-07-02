/**
 * In-memory fixed-window rate limiter for public API routes (API-005).
 *
 * CONSTRAINT: state lives in a per-process Map, so limits are per-instance.
 * In a serverless / multi-instance deployment each instance counts
 * independently — swap the Map for a shared store (e.g. Redis/Upstash)
 * before horizontal scaling matters.
 */

interface WindowEntry {
  count: number;
  /** Epoch ms when this fixed window expires. */
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

const PRUNE_INTERVAL_MS = 60_000;
/** Safety valve: force a sweep if the store grows unexpectedly large. */
const PRUNE_SIZE_THRESHOLD = 10_000;
/**
 * Hard upper bound on live keys. Reaping only expired entries is not enough:
 * a spoofable limiter key (e.g. an attacker-rotated IP) lets the Map grow
 * without bound while every entry is still inside its window — a memory DoS.
 * Once live keys exceed this cap we evict the oldest entries regardless of
 * expiry.
 */
export const MAX_KEYS = 50_000;

let lastPruneAt = 0;

function maybePrune(now: number): void {
  const intervalElapsed = now - lastPruneAt >= PRUNE_INTERVAL_MS;
  if (!intervalElapsed && store.size < PRUNE_SIZE_THRESHOLD) return;
  lastPruneAt = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
  // Hard cap: if expired-only reaping still left us over the cap (all keys
  // live), evict the oldest entries. Map preserves insertion order, so the
  // first keys iterated are the oldest. O(excess), non-blocking.
  if (store.size > MAX_KEYS) {
    let excess = store.size - MAX_KEYS;
    for (const key of store.keys()) {
      if (excess <= 0) break;
      store.delete(key);
      excess -= 1;
    }
  }
}

export interface RateLimitOptions {
  /** Full limiter key, e.g. `rpm:login:203.0.113.7`. */
  key: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets (0 when allowed). */
  retryAfterSeconds: number;
}

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { key, limit, windowMs } = options;
  const now = Date.now();
  maybePrune(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return {
      allowed: true,
      remaining: limit - entry.count,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/** Test-only: clear all limiter state. */
export function resetRateLimitStore(): void {
  store.clear();
  lastPruneAt = 0;
}

/** Test-only: number of tracked keys (observes pruning). */
export function rateLimitStoreSize(): number {
  return store.size;
}

/** Test-only: whether a given limiter key is currently tracked. */
export function rateLimitStoreHas(key: string): boolean {
  return store.has(key);
}

/**
 * Test-only: seed `count` live entries directly, bypassing per-call pruning,
 * so the hard-cap eviction path can be exercised without driving MAX_KEYS
 * requests through `rateLimit`.
 */
export function seedRateLimitStore(count: number, resetAt: number): void {
  for (let i = 0; i < count; i += 1) {
    store.set(`seed:${i}`, { count: 1, resetAt });
  }
}

/**
 * Number of trusted reverse proxies in front of the app, read from
 * `TRUSTED_PROXY_HOPS`. Defaults to 1 (a single edge proxy such as Vercel).
 * Non-numeric values fall back to the default; negatives clamp to 0.
 */
function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.max(0, parsed);
}

/**
 * Best-effort client IP extraction with an explicit proxy trust model.
 *
 * `x-forwarded-for` is `client, proxy1, ..., proxyN`, where every proxy
 * APPENDS the peer it received the connection from (e.g. Nginx
 * `proxy_add_x_forwarded_for`). The LEFTMOST entry is therefore fully
 * attacker-controlled — a client can inject arbitrary hops — so it must
 * never be used as the rate-limit key. Trusting it lets an attacker rotate
 * the value to dodge the per-IP limit.
 *
 * Instead we anchor from the RIGHT: `TRUSTED_PROXY_HOPS` declares how many
 * trusted proxies sit in front of the app, and we select the entry that many
 * positions left of the rightmost (which the innermost trusted proxy wrote),
 * falling back to the rightmost when the chain is shorter than configured.
 * Falls back to `x-real-ip` (platform-provided real IP), then a shared
 * "unknown" bucket.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const hops = getTrustedProxyHops();
      const ip = parts[parts.length - 1 - hops] ?? parts[parts.length - 1];
      if (ip) return ip;
    }
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

/** RFC 7807 problem+json response for a blocked request. */
export function rateLimitProblemResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: `Rate limit exceeded. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/problem+json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export interface EnforceRateLimitOptions {
  /** Logical bucket name, e.g. `rpm:login`. Combined with the client IP. */
  bucket: string;
  limit: number;
  windowMs: number;
}

/**
 * Convenience guard for route handlers: returns a 429 problem+json
 * Response when the (bucket, ip) pair is over its limit, or null when
 * the request may proceed.
 */
export function enforceRateLimit(
  request: Request,
  options: EnforceRateLimitOptions,
): Response | null {
  const ip = getClientIp(request);
  const result = rateLimit({
    key: `${options.bucket}:${ip}`,
    limit: options.limit,
    windowMs: options.windowMs,
  });
  if (result.allowed) return null;
  return rateLimitProblemResponse(result.retryAfterSeconds);
}
