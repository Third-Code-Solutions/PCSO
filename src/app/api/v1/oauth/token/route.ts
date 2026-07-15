import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { apiClients } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getClientIp, rateLimit } from "@/lib/utils/rate-limit";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import {
  OAUTH_TOKEN_AUDIENCE,
  OAUTH_TOKEN_ISSUER,
  OAUTH_TOKEN_TTL_SECONDS,
  checkClientUsable,
  sha256Hex,
} from "@/lib/api/v1/auth";
import { parseScopeParam } from "@/lib/api/v1/scopes";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/v1/oauth/token — OAuth 2.0 client-credentials grant (TOR 3.3.3
 * / API-001, RFC 6749 §4.4).
 *
 * Request (form-encoded or JSON body; client auth also accepted via HTTP
 * Basic per RFC 6749 §2.3.1):
 *   grant_type=client_credentials
 *   client_id=<clientId>
 *   client_secret=<secret>
 *   scope=employees:read leave:read        (optional, subset of grants)
 *
 * Success: { access_token, token_type: "Bearer", expires_in, scope }
 * Errors:  RFC 7807 problem+json carrying the OAuth error code in the
 *          `error` extension member (invalid_request, invalid_client,
 *          unsupported_grant_type, invalid_scope).
 */

interface TokenRequestBody {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
  scope?: string;
}

async function parseBody(request: Request): Promise<TokenRequestBody | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json: unknown = await request.json();
      if (typeof json !== "object" || json === null) return null;
      return json as TokenRequestBody;
    }
    // Default: application/x-www-form-urlencoded (RFC 6749's required format).
    const form = await request.formData();
    return {
      grant_type: stringOrUndefined(form.get("grant_type")),
      client_id: stringOrUndefined(form.get("client_id")),
      client_secret: stringOrUndefined(form.get("client_secret")),
      scope: stringOrUndefined(form.get("scope")),
    };
  } catch {
    return null;
  }
}

function stringOrUndefined(
  value: FormDataEntryValue | null,
): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** RFC 6749 §2.3.1 — HTTP Basic client authentication. */
function parseBasicAuth(
  request: Request,
): { clientId: string; clientSecret: string } | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Basic\s+(.+)$/i.exec(header.trim());
  if (!match || !match[1]) return null;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

function invalidClient(detail: string) {
  return problem({
    status: 401,
    title: "Unauthorized",
    detail,
    extensions: { error: "invalid_client" },
    headers: {
      "WWW-Authenticate": 'Basic realm="pcso-hris-api-v1"',
    },
  });
}

function hashesMatch(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

const DUMMY_HASH = sha256Hex("pcso-token-endpoint-dummy-secret");

export async function POST(request: Request) {
  try {
    // API-005: brute-force protection on the credential exchange itself,
    // keyed by caller IP (client is not yet authenticated at this point).
    const limited = rateLimit({
      key: `api:v1:oauth:token:${getClientIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.allowed) {
      return problem({
        status: 429,
        title: "Too Many Requests",
        detail: `Token endpoint rate limit exceeded. Try again in ${limited.retryAfterSeconds}s.`,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      });
    }

    if (!env.API_JWT_SECRET) {
      return problem({
        status: 503,
        title: "Service Unavailable",
        detail:
          "OAuth 2.0 access tokens are not enabled on this deployment (API_JWT_SECRET is not configured). Use a static API key instead.",
      });
    }

    const body = await parseBody(request);
    if (!body) {
      return validationProblem(
        { formErrors: ["Unreadable request body"], fieldErrors: {} },
        "Send application/x-www-form-urlencoded or application/json",
      );
    }

    if (body.grant_type !== "client_credentials") {
      return problem({
        status: 400,
        title: "Bad Request",
        detail: "Only the client_credentials grant type is supported.",
        extensions: { error: "unsupported_grant_type" },
      });
    }

    const basic = parseBasicAuth(request);
    const clientId = body.client_id ?? basic?.clientId;
    const clientSecret = body.client_secret ?? basic?.clientSecret;
    if (!clientId || !clientSecret) {
      return problem({
        status: 400,
        title: "Bad Request",
        detail:
          "client_id and client_secret are required (body parameters or HTTP Basic).",
        extensions: { error: "invalid_request" },
      });
    }

    const [client] = await db
      .select()
      .from(apiClients)
      .where(
        and(eq(apiClients.clientId, clientId), isNull(apiClients.deletedAt)),
      )
      .limit(1);

    const providedHash = sha256Hex(clientSecret);
    const matches = hashesMatch(client?.secretHash ?? DUMMY_HASH, providedHash);
    if (!client || !matches) {
      return invalidClient("Invalid client credentials.");
    }
    const unusable = checkClientUsable(client);
    if (unusable) return unusable;

    // Optional scope narrowing (RFC 6749 §3.3): requested ⊆ granted.
    const requested = parseScopeParam(body.scope);
    const grantedSet = new Set(client.scopes);
    const outOfGrant = requested.filter((scope) => !grantedSet.has(scope));
    if (outOfGrant.length > 0) {
      return problem({
        status: 400,
        title: "Bad Request",
        detail: "Requested scope exceeds the client's granted scopes.",
        extensions: { error: "invalid_scope", invalid_scopes: outOfGrant },
      });
    }
    const tokenScopes = requested.length > 0 ? requested : [...client.scopes];

    const accessToken = jwt.sign(
      { scope: tokenScopes.join(" ") },
      env.API_JWT_SECRET,
      {
        algorithm: "HS256",
        subject: client.clientId,
        issuer: OAUTH_TOKEN_ISSUER,
        audience: OAUTH_TOKEN_AUDIENCE,
        expiresIn: OAUTH_TOKEN_TTL_SECONDS,
      },
    );

    // Touch last_used_at (fire-and-forget — never blocks token issuance).
    void (async () => {
      try {
        await db
          .update(apiClients)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiClients.id, client.id));
      } catch {
        // Best-effort only.
      }
    })();

    // RFC 6749 §5.1 requires no-store + no-cache on token responses.
    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: OAUTH_TOKEN_TTL_SECONDS,
        scope: tokenScopes.join(" "),
      },
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
