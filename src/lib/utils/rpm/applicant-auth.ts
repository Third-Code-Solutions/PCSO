/**
 * Applicant-side authentication primitives.
 *
 * Keeps the applicant identity completely separate from internal HRD staff
 * (who authenticate via Supabase). Applicants use a stateless JWT (HS256) so
 * the public RPM endpoints do not touch the HRD session layer.
 *
 * Password hashing: uses node:crypto scrypt with a per-record salt — no new
 * npm dependency required (bcryptjs is not installed).
 */

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// ── Secret resolution ────────────────────────────────────────────────────────

function getSecret(): string {
  const explicit = process.env.APPLICANT_JWT_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  const fallback = process.env.NEXTAUTH_SECRET;
  if (fallback && fallback.length >= 16) return fallback;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- dev-only warning.
    console.warn(
      "[applicant-auth] APPLICANT_JWT_SECRET not set — using dev fallback. Do NOT ship this to production.",
    );
    return "dev-secret-dev-secret-dev-secret-";
  }
  throw new Error(
    "[applicant-auth] APPLICANT_JWT_SECRET (or NEXTAUTH_SECRET) must be set in production.",
  );
}

// ── Base64URL helpers ────────────────────────────────────────────────────────

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

// ── JWT (HS256) ──────────────────────────────────────────────────────────────

export interface ApplicantTokenPayload {
  applicantId: string;
  /** Issued at (seconds since epoch) */
  iat: number;
  /** Expires at (seconds since epoch) */
  exp: number;
}

const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h

function sign(data: string, secret: string): string {
  return base64UrlEncode(createHmac("sha256", secret).update(data).digest());
}

export function signApplicantToken(params: { applicantId: string }): string {
  const secret = getSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: ApplicantTokenPayload = {
    applicantId: params.applicantId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput, secret);
  return `${signingInput}.${signature}`;
}

export function verifyApplicantToken(
  token: string,
): ApplicantTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    if (!encodedHeader || !encodedPayload || !signature) return null;

    const secret = getSecret();
    const expected = sign(`${encodedHeader}.${encodedPayload}`, secret);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const payloadJson = base64UrlDecode(encodedPayload).toString("utf8");
    const parsed = JSON.parse(payloadJson) as Partial<ApplicantTokenPayload>;
    if (
      typeof parsed.applicantId !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) return null;
    return parsed as ApplicantTokenPayload;
  } catch {
    return null;
  }
}

/** Extract + verify bearer token from an Authorization header. */
export function authenticateApplicantRequest(
  request: Request,
): ApplicantTokenPayload | null {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token) return null;
  return verifyApplicantToken(token);
}

// ── Password hashing (scrypt) ────────────────────────────────────────────────

const SCRYPT_KEY_LEN = 64;
const SCRYPT_SALT_LEN = 16;

export function hashPassword(password: string): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const derived = scryptSync(password, salt, SCRYPT_KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const [scheme, saltHex, hashHex] = parts;
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = scryptSync(password, salt, expected.length);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ── Email verification tokens ────────────────────────────────────────────────

/** URL-safe random token for email verification (≈32 bytes of entropy). */
export function generateVerificationToken(): string {
  return base64UrlEncode(randomBytes(32));
}
