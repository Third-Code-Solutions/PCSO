import "server-only";

/**
 * Public API v1 authentication + rate limiting — TOR 3.3.2 / 3.3.3 / API-001,
 * API-005.
 *
 * Two credential styles, both carried in the `Authorization` header:
 *
 *   1. Static API key:  `Authorization: Bearer pcso_<clientId>.<secret>`
 *      The secret is compared as SHA-256 (timing-safe) against
 *      `api_clients.secret_hash` — plaintext is never stored.
 *
 *   2. OAuth 2.0 client-credentials access token (HS256 JWT minted by
 *      POST /api/v1/oauth/token): `Authorization: Bearer <jwt>`.
 *      Requires `API_JWT_SECRET`; when unset the OAuth path answers 503 so
 *      deployments that only use static keys keep working.
 *
 * Every failure path returns an RFC 7807 problem response (TOR 3.3.14).
 *
 * Per-client rate limiting (API-005) reuses the in-memory fixed-window
 * limiter in `src/lib/utils/rate-limit.ts`, keyed by clientId with the
 * client's own `rate_limit_per_minute`. SERVERLESS CAVEAT: the window store
 * is per-process, so on a multi-instance / serverless deployment each
 * instance counts independently — the effective ceiling is
 * `limit × instances`. Swap the store for Redis/Upstash before horizontal
 * scaling matters (same caveat as the existing RPM limiter).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { apiClients, type ApiClient } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/utils/rate-limit";
import { problem } from "./problem";
import {
  hasRequiredScopes,
  intersectScopes,
  missingScopes,
  parseScopeParam,
} from "./scopes";

// ─── Token constants (shared with the /oauth/token route) ───────────────────

export const API_KEY_PREFIX = "pcso_";
export const OAUTH_TOKEN_ISSUER = "pcso-hris";
export const OAUTH_TOKEN_AUDIENCE = "pcso-api-v1";
export const OAUTH_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

// ─── Result types ────────────────────────────────────────────────────────────

export interface ApiAuthContext {
  /** api_clients.id (uuid) — FK target for api_jobs.api_client_id. */
  clientRowId: string;
  /** Public client identifier (the `pcso_<clientId>` prefix part). */
  clientId: string;
  name: string;
  /** Effective scopes for THIS request (token ∩ client grants). */
  scopes: string[];
  authMethod: "api_key" | "oauth2";
  rateLimitPerMinute: number;
}

export type ApiAuthResult =
  | { ok: true; ctx: ApiAuthContext }
  | { ok: false; response: NextResponse };

// ─── Internals ───────────────────────────────────────────────────────────────

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Constant-time comparison of two sha256 hex digests. */
function hashesMatch(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

// Dummy digest compared when the client row does not exist, so "unknown
// client" and "wrong secret" take a similar amount of time.
const DUMMY_HASH = sha256Hex("pcso-dummy-secret-for-timing-equalization");

function unauthorized(detail: string, oauthError = "invalid_token") {
  return problem({
    status: 401,
    title: "Unauthorized",
    detail,
    extensions: { error: oauthError },
    headers: {
      "WWW-Authenticate": `Bearer realm="pcso-hris-api-v1", error="${oauthError}"`,
    },
  });
}

async function loadClientByClientId(
  clientId: string,
): Promise<ApiClient | null> {
  const [row] = await db
    .select()
    .from(apiClients)
    .where(and(eq(apiClients.clientId, clientId), isNull(apiClients.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Shared client-state validation for both credential styles. Returns a
 * problem response when the client may not be used, else null.
 */
export function checkClientUsable(client: ApiClient): NextResponse | null {
  if (!client.isActive) {
    return unauthorized("API client is deactivated.", "invalid_client");
  }
  if (client.expiresAt && client.expiresAt.getTime() <= Date.now()) {
    return unauthorized(
      "API client credentials have expired.",
      "invalid_client",
    );
  }
  return null;
}

/** Fire-and-forget `last_used_at` touch — never blocks or fails the request. */
function touchLastUsed(clientRowId: string): void {
  void (async () => {
    try {
      await db
        .update(apiClients)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiClients.id, clientRowId));
    } catch {
      // Best-effort only.
    }
  })();
}

/** Per-client fixed-window limit; problem 429 with Retry-After when blocked. */
function enforceClientRateLimit(client: ApiClient): NextResponse | null {
  const result = rateLimit({
    key: `api:v1:client:${client.clientId}`,
    limit: Math.max(1, client.rateLimitPerMinute),
    windowMs: 60_000,
  });
  if (result.allowed) return null;
  return problem({
    status: 429,
    title: "Too Many Requests",
    detail: `Rate limit of ${client.rateLimitPerMinute} requests/minute exceeded. Try again in ${result.retryAfterSeconds}s.`,
    extensions: { retry_after_seconds: result.retryAfterSeconds },
    headers: {
      "Retry-After": String(result.retryAfterSeconds),
      "X-RateLimit-Limit": String(client.rateLimitPerMinute),
      "X-RateLimit-Remaining": "0",
    },
  });
}

// ─── Static API key path ─────────────────────────────────────────────────────

async function authenticateApiKey(
  token: string,
): Promise<
  { ok: true; client: ApiClient } | { ok: false; response: NextResponse }
> {
  const rest = token.slice(API_KEY_PREFIX.length);
  const separator = rest.indexOf(".");
  const clientId = separator > 0 ? rest.slice(0, separator) : "";
  const secret = separator > 0 ? rest.slice(separator + 1) : "";

  if (!clientId || !secret) {
    return {
      ok: false,
      response: unauthorized(
        "Malformed API key. Expected format: pcso_<clientId>.<secret>.",
      ),
    };
  }

  const client = await loadClientByClientId(clientId);
  const providedHash = sha256Hex(secret);
  const matches = hashesMatch(client?.secretHash ?? DUMMY_HASH, providedHash);

  if (!client || !matches) {
    return { ok: false, response: unauthorized("Invalid API key.") };
  }

  const unusable = checkClientUsable(client);
  if (unusable) return { ok: false, response: unusable };

  return { ok: true, client };
}

// ─── OAuth 2.0 JWT path ──────────────────────────────────────────────────────

interface OauthTokenClaims {
  sub?: string;
  scope?: string;
}

async function authenticateOauthJwt(
  token: string,
): Promise<
  | { ok: true; client: ApiClient; tokenScopes: string[] }
  | { ok: false; response: NextResponse }
> {
  const secret = env.API_JWT_SECRET;
  if (!secret) {
    return {
      ok: false,
      response: problem({
        status: 503,
        title: "Service Unavailable",
        detail:
          "OAuth 2.0 access tokens are not enabled on this deployment (API_JWT_SECRET is not configured). Use a static API key instead.",
      }),
    };
  }

  let claims: OauthTokenClaims;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: OAUTH_TOKEN_ISSUER,
      audience: OAUTH_TOKEN_AUDIENCE,
    }) as OauthTokenClaims;
  } catch (error: unknown) {
    const detail =
      error instanceof jwt.TokenExpiredError
        ? "Access token has expired."
        : "Invalid access token.";
    return { ok: false, response: unauthorized(detail) };
  }

  if (!claims.sub) {
    return {
      ok: false,
      response: unauthorized("Access token has no subject."),
    };
  }

  const client = await loadClientByClientId(claims.sub);
  if (!client) {
    return {
      ok: false,
      response: unauthorized("Unknown API client.", "invalid_client"),
    };
  }
  const unusable = checkClientUsable(client);
  if (unusable) return { ok: false, response: unusable };

  return { ok: true, client, tokenScopes: parseScopeParam(claims.scope) };
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Authenticate a /api/v1 request and enforce `requiredScopes`.
 *
 * On failure returns `{ ok: false, response }` where `response` is a ready
 * RFC 7807 problem (401 / 403 / 429 / 503) the route handler must return
 * immediately. On success returns the authenticated client context.
 */
export async function authenticateApiRequest(
  request: Request,
  requiredScopes: string[],
): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !match[1]) {
    return {
      ok: false,
      response: unauthorized(
        "Missing bearer credentials. Send `Authorization: Bearer pcso_<clientId>.<secret>` or an OAuth 2.0 access token.",
        "invalid_request",
      ),
    };
  }
  const token = match[1].trim();

  let client: ApiClient;
  let authMethod: ApiAuthContext["authMethod"];
  let effectiveScopes: string[];

  if (token.startsWith(API_KEY_PREFIX)) {
    const result = await authenticateApiKey(token);
    if (!result.ok) return result;
    client = result.client;
    authMethod = "api_key";
    effectiveScopes = [...client.scopes];
  } else {
    const result = await authenticateOauthJwt(token);
    if (!result.ok) return result;
    client = result.client;
    authMethod = "oauth2";
    // Revocation-safe: a token can never exceed the client's CURRENT grants.
    effectiveScopes = intersectScopes(result.tokenScopes, client.scopes);
  }

  const limited = enforceClientRateLimit(client);
  if (limited) return { ok: false, response: limited };

  if (!hasRequiredScopes(effectiveScopes, requiredScopes)) {
    return {
      ok: false,
      response: problem({
        status: 403,
        title: "Forbidden",
        detail: "The authenticated client is missing required scopes.",
        extensions: {
          error: "insufficient_scope",
          required_scopes: requiredScopes,
          missing_scopes: missingScopes(effectiveScopes, requiredScopes),
        },
        headers: {
          "WWW-Authenticate": `Bearer realm="pcso-hris-api-v1", error="insufficient_scope", scope="${requiredScopes.join(" ")}"`,
        },
      }),
    };
  }

  touchLastUsed(client.id);

  return {
    ok: true,
    ctx: {
      clientRowId: client.id,
      clientId: client.clientId,
      name: client.name,
      scopes: effectiveScopes,
      authMethod,
      rateLimitPerMinute: client.rateLimitPerMinute,
    },
  };
}
