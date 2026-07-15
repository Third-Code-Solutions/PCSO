/**
 * Detached digital signatures for generated PDFs — TOR 3.5.11 / 3.5.12.
 *
 * PAdES-compatible fallback scheme (see docs/DIGITAL-SIGNATURES.md): until
 * PCSO provides its PKI, documents are signed with a detached RSA-SHA256
 * signature over the EXACT rendered PDF bytes. The signature and key
 * metadata travel alongside the document (QR/JWT verify payload + audit
 * log), never inside it, so the signed bytes stay stable.
 *
 * Key material comes from the optional `DOCUMENT_SIGNING_PRIVATE_KEY` env
 * var (PKCS#8 PEM, RSA ≥ 2048). When it is unset the module degrades
 * gracefully: `signPdfBytes` returns `null` and callers skip the signature
 * block — document generation must NEVER fail because signing is not
 * provisioned (mirrors how `certificate-jwt.ts` reads its secret).
 *
 * This module is intentionally free of `@/lib/db`, `@/lib/env`, and
 * `server-only` imports so its pure helpers are unit-testable with an
 * ephemeral keypair.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  type KeyObject,
} from "node:crypto";

export const DOCUMENT_SIGNATURE_ALGORITHM = "RSA-SHA256" as const;

/** Detached signature produced over a PDF's exact byte content. */
export interface DetachedPdfSignature {
  /** Base64 RSA-SHA256 (PKCS#1 v1.5) signature over the PDF bytes. */
  signatureB64: string;
  /**
   * SHA-256 fingerprint (lowercase hex) of the signing public key in SPKI
   * DER form. Stands in for an X.509 certificate fingerprint until PCSO PKI
   * issues real certificates.
   */
  certFingerprint: string;
  /** Short key identifier — first 16 hex chars of the fingerprint. */
  keyId: string;
  /** ISO-8601 timestamp at which the signature was produced. */
  signedAt: string;
  /** Lowercase hex SHA-256 of the signed PDF bytes (integrity binding). */
  pdfSha256: string;
  /** Signature algorithm identifier. */
  algorithm: typeof DOCUMENT_SIGNATURE_ALGORITHM;
}

/**
 * Compact, QR-safe signature metadata embedded in the verification JWT
 * (PIM-017). The full `signatureB64` is deliberately excluded — it lives in
 * the audit log — to keep QR payloads scannable.
 */
export interface DocumentSignatureBlock {
  alg: string;
  pdfSha256: string;
  certFingerprint: string;
  keyId: string;
  /** Unix seconds when the detached signature was produced. */
  signedAt: number;
}

// ─── Pure helpers (env-free — unit-tested with ephemeral keypairs) ───────────

/** Lowercase hex SHA-256 of arbitrary bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * SHA-256 fingerprint (lowercase hex) of a public key's SPKI DER encoding.
 * Accepts a public OR private PEM (public key is derived from the latter).
 */
export function publicKeyFingerprint(pem: string): string {
  const publicKey = createPublicKey(pem);
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex");
}

/** Derives the public key PEM (SPKI) from a private key PEM. */
export function publicKeyPemFromPrivate(privateKeyPem: string): string {
  const publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

/**
 * Signs `pdf` with the given private key PEM. Pure — throws on invalid key
 * material (callers that must not throw use `signPdfBytes`).
 */
export function signPdfBytesWithKey(
  pdf: Uint8Array,
  privateKeyPem: string,
): DetachedPdfSignature {
  const privateKey: KeyObject = createPrivateKey(privateKeyPem);
  const signer = createSign("RSA-SHA256");
  signer.update(pdf);
  const signatureB64 = signer.sign(privateKey).toString("base64");

  const fingerprint = publicKeyFingerprint(privateKeyPem);
  return {
    signatureB64,
    certFingerprint: fingerprint,
    keyId: fingerprint.slice(0, 16),
    signedAt: new Date().toISOString(),
    pdfSha256: sha256Hex(pdf),
    algorithm: DOCUMENT_SIGNATURE_ALGORITHM,
  };
}

/**
 * Verifies a detached signature over `pdf` against a public key PEM.
 * Returns `false` (never throws) on malformed keys, signatures, or input.
 */
export function verifyPdfSignature(
  pdf: Uint8Array,
  signatureB64: string,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(pdf);
    return verifier.verify(
      createPublicKey(publicKeyPem),
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}

/** Maps a detached signature to the compact QR/JWT metadata block. */
export function toSignatureBlock(
  signature: DetachedPdfSignature,
): DocumentSignatureBlock {
  return {
    alg: `${signature.algorithm}-detached`,
    pdfSha256: signature.pdfSha256,
    certFingerprint: signature.certFingerprint,
    keyId: signature.keyId,
    signedAt: Math.floor(new Date(signature.signedAt).getTime() / 1000),
  };
}

// ─── Env-driven entry points (used by document generators) ───────────────────

/**
 * Reads the configured signing key PEM. Env vars flatten newlines on some
 * platforms (Vercel dashboard pastes), so literal `\n` sequences are
 * restored before parsing.
 */
function configuredPrivateKeyPem(): string | null {
  const raw = process.env.DOCUMENT_SIGNING_PRIVATE_KEY;
  if (!raw || raw.trim().length === 0) return null;
  return raw.replace(/\\n/g, "\n");
}

/** True when a document signing key is provisioned. */
export function isDocumentSigningConfigured(): boolean {
  return configuredPrivateKeyPem() !== null;
}

/**
 * Signs a rendered PDF with the provisioned key.
 *
 * Returns `null` — never throws — when the key is unset or invalid, so
 * document generation continues unsigned. Callers should treat a `null`
 * result as "signing not provisioned".
 */
export function signPdfBytes(pdf: Uint8Array): DetachedPdfSignature | null {
  const pem = configuredPrivateKeyPem();
  if (!pem) return null;
  try {
    return signPdfBytesWithKey(pdf, pem);
  } catch (error) {
    // Invalid key material must not break generators; surfaced for ops.
    console.error("[signing] Failed to sign PDF bytes:", error);
    return null;
  }
}

/**
 * Public key PEM matching the provisioned signing key, for verification
 * tooling and the ops runbook. `null` when signing is not configured.
 */
export function documentSigningPublicKeyPem(): string | null {
  const pem = configuredPrivateKeyPem();
  if (!pem) return null;
  try {
    return publicKeyPemFromPrivate(pem);
  } catch {
    return null;
  }
}
