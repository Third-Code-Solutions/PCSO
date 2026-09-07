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
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants } from "@/lib/db/schema/recruitment";

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
export const APPLICANT_TOKEN_COOKIE = "pcso_applicant_token";

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

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

/** Extract, verify, and re-check the active applicant record. */
export async function authenticateApplicantRequest(
  request: Request,
): Promise<ApplicantTokenPayload | null> {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  const token = match?.[1] ?? readCookie(request, APPLICANT_TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyApplicantToken(token);
  if (!payload) return null;

  try {
    const [applicant] = await db
      .select({ status: applicants.status })
      .from(applicants)
      .where(
        and(
          eq(applicants.id, payload.applicantId),
          isNull(applicants.deletedAt),
        ),
      )
      .limit(1);
    if (!applicant || applicant.status === "inactive") return null;
    return payload;
  } catch {
    return null;
  }
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
