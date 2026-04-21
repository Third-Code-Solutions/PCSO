/**
 * LDM-010 — HS256 JWT issuer / verifier for QR-embedded verification tokens.
 *
 * Requirements (CLAUDE.md §6.1):
 *   - Algorithm: HS256
 *   - Expiry: 5 years from `issuedAt`
 *   - Secret: `DOCUMENT_JWT_SECRET` (fallback: `NEXTAUTH_SECRET`)
 *   - Public landing page: `/verify/[token]`
 *   - Payload must not leak PII — employee is identified by a short hash only.
 *
 * Implementation notes:
 *   - Built on Node's `crypto` so it does not introduce a runtime dependency on
 *     `jsonwebtoken` (which is not present in package.json).
 *   - Signing and verification are constant-time where it matters (HMAC compare).
 */
import { createHmac, timingSafeEqual, createHash } from "node:crypto";

const FIVE_YEARS_SECONDS = 60 * 60 * 24 * 365 * 5;

export interface CertificateTokenPayload {
  /** Always `certificate_of_training` for this helper. */
  documentType: "certificate_of_training";
  /** The `CT-YYYY-NNNNNN` serial. */
  serialNumber: string;
  /** SHA-256 prefix hash of the employee id — never the raw UUID. */
  employeeIdHash: string;
  /** Unix seconds at issuance. */
  issuedAt: number;
  /** system_users.id of the issuer (HRMO). */
  issuedBy: string;
}

interface SignedPayload extends CertificateTokenPayload {
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

function resolveSecret(): string {
  const primary = process.env.DOCUMENT_JWT_SECRET;
  const fallback = process.env.NEXTAUTH_SECRET;
  const secret = primary || fallback;
  if (!secret) {
    throw new Error(
      "Missing env: DOCUMENT_JWT_SECRET (or NEXTAUTH_SECRET fallback). " +
        "Cannot sign or verify certificate tokens without a secret.",
    );
  }
  return secret;
}

function sign(headerB64: string, payloadB64: string, secret: string): string {
  const signingInput = `${headerB64}.${payloadB64}`;
  const mac = createHmac("sha256", secret).update(signingInput).digest();
  return base64UrlEncode(mac);
}

/** SHA-256 of the employee id, truncated to 16 hex chars — enough for display
 *  uniqueness, not enough to reverse back to a UUID. */
export function hashEmployeeId(employeeId: string): string {
  return createHash("sha256").update(employeeId).digest("hex").slice(0, 16);
}

/**
 * Sign a certificate verification JWT (HS256, 5-year expiry).
 *
 * @param payload PII-safe token payload. `issuedAt` is the unix-seconds
 *                timestamp of issuance (also used to derive `exp`).
 */
export function signCertificateToken(payload: CertificateTokenPayload): string {
  const secret = resolveSecret();
  const signed: SignedPayload = {
    ...payload,
    iat: payload.issuedAt,
    exp: payload.issuedAt + FIVE_YEARS_SECONDS,
  };
  const headerB64 = base64UrlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  );
  const payloadB64 = base64UrlEncode(JSON.stringify(signed));
  const sig = sign(headerB64, payloadB64, secret);
  return `${headerB64}.${payloadB64}.${sig}`;
}

function parseSignedPayload(raw: unknown): SignedPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.documentType !== "certificate_of_training") return null;
  if (typeof obj.serialNumber !== "string") return null;
  if (typeof obj.employeeIdHash !== "string") return null;
  if (typeof obj.issuedAt !== "number") return null;
  if (typeof obj.issuedBy !== "string") return null;
  if (typeof obj.iat !== "number") return null;
  if (typeof obj.exp !== "number") return null;
  return {
    documentType: obj.documentType,
    serialNumber: obj.serialNumber,
    employeeIdHash: obj.employeeIdHash,
    issuedAt: obj.issuedAt,
    issuedBy: obj.issuedBy,
    iat: obj.iat,
    exp: obj.exp,
  };
}

/**
 * Verify a certificate JWT. Returns `null` if the token is malformed, has a
 * bad signature, uses the wrong algorithm, or has expired.
 */
export function verifyCertificateToken(
  token: string,
): CertificateTokenPayload | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof header !== "object" ||
    header === null ||
    (header as Record<string, unknown>).alg !== "HS256"
  ) {
    return null;
  }

  const secret = resolveSecret();
  const expected = base64UrlDecode(sign(headerB64, payloadB64, secret));
  const actual = base64UrlDecode(sigB64);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  const parsed = parseSignedPayload(payload);
  if (!parsed) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (parsed.exp < nowSeconds) return null;

  return {
    documentType: parsed.documentType,
    serialNumber: parsed.serialNumber,
    employeeIdHash: parsed.employeeIdHash,
    issuedAt: parsed.issuedAt,
    issuedBy: parsed.issuedBy,
  };
}
