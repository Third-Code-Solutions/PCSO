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
import type { DocumentSignatureBlock } from "@/lib/signing/document-signer";

const FIVE_YEARS_SECONDS = 60 * 60 * 24 * 365 * 5;

export interface CertificateTokenPayload {
  /**
   * Document type slug, e.g. `certificate_of_training` (LDM-010) or
   * `certificate_of_employment` (PIM-010). Any generator adopting the
   * PIM-017 QR verification flow mints tokens through this helper.
   */
  documentType: string;
  /** The document serial, e.g. `CT-YYYY-NNNNNN` / `COE-YYYY-NNNNNN`. */
  serialNumber: string;
  /** SHA-256 prefix hash of the employee id — never the raw UUID. */
  employeeIdHash: string;
  /** Unix seconds at issuance. */
  issuedAt: number;
  /** system_users.id of the issuer (HRMO). */
  issuedBy: string;
  /**
   * Optional detached digital signature metadata (TOR 3.5.11/12). Present
   * only when `DOCUMENT_SIGNING_PRIVATE_KEY` was configured at issuance.
   * The full detached signature lives in the audit log — this block carries
   * QR-safe metadata that binds the token to the exact signed PDF bytes.
   */
  signature?: DocumentSignatureBlock;
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

/**
 * Parses the optional detached-signature block. Returns `undefined` when the
 * field is absent, `null` when it is present but malformed (the token was
 * minted incorrectly — reject it rather than show a broken signature).
 */
function parseSignatureBlock(
  raw: unknown,
): DocumentSignatureBlock | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.alg !== "string") return null;
  if (typeof obj.pdfSha256 !== "string") return null;
  if (typeof obj.certFingerprint !== "string") return null;
  if (typeof obj.keyId !== "string") return null;
  if (typeof obj.signedAt !== "number") return null;
  return {
    alg: obj.alg,
    pdfSha256: obj.pdfSha256,
    certFingerprint: obj.certFingerprint,
    keyId: obj.keyId,
    signedAt: obj.signedAt,
  };
}

function parseSignedPayload(raw: unknown): SignedPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.documentType !== "string" || obj.documentType.length === 0) {
    return null;
  }
  if (typeof obj.serialNumber !== "string") return null;
  if (typeof obj.employeeIdHash !== "string") return null;
  if (typeof obj.issuedAt !== "number") return null;
  if (typeof obj.issuedBy !== "string") return null;
  if (typeof obj.iat !== "number") return null;
  if (typeof obj.exp !== "number") return null;
  const signature = parseSignatureBlock(obj.signature);
  if (signature === null) return null;
  return {
    documentType: obj.documentType,
    serialNumber: obj.serialNumber,
    employeeIdHash: obj.employeeIdHash,
    issuedAt: obj.issuedAt,
    issuedBy: obj.issuedBy,
    ...(signature ? { signature } : {}),
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
    ...(parsed.signature ? { signature: parsed.signature } : {}),
  };
}
