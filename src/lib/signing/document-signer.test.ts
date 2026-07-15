/// <reference types="vitest/globals" />
/**
 * Unit tests for the detached PDF signature module (TOR 3.5.11/12).
 *
 * Uses an ephemeral RSA keypair generated in the test — no fixtures, no env
 * files, no database. The env-driven entry points are exercised by stubbing
 * `process.env.DOCUMENT_SIGNING_PRIVATE_KEY` around each test.
 */

import { generateKeyPairSync } from "node:crypto";
import {
  DOCUMENT_SIGNATURE_ALGORITHM,
  documentSigningPublicKeyPem,
  isDocumentSigningConfigured,
  publicKeyFingerprint,
  publicKeyPemFromPrivate,
  sha256Hex,
  signPdfBytes,
  signPdfBytesWithKey,
  toSignatureBlock,
  verifyPdfSignature,
} from "./document-signer";

function makeKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    privateKeyPem: privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const SAMPLE_PDF = new TextEncoder().encode(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

const ORIGINAL_ENV = process.env.DOCUMENT_SIGNING_PRIVATE_KEY;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.DOCUMENT_SIGNING_PRIVATE_KEY;
  } else {
    process.env.DOCUMENT_SIGNING_PRIVATE_KEY = ORIGINAL_ENV;
  }
});

// ─── Pure sign / verify round-trip ───────────────────────────────────────────

describe("signPdfBytesWithKey / verifyPdfSignature", () => {
  it("produces a signature that verifies against the matching public key", () => {
    const { privateKeyPem, publicKeyPem } = makeKeyPair();

    const signature = signPdfBytesWithKey(SAMPLE_PDF, privateKeyPem);

    expect(signature.algorithm).toBe(DOCUMENT_SIGNATURE_ALGORITHM);
    expect(signature.signatureB64.length).toBeGreaterThan(0);
    expect(
      verifyPdfSignature(SAMPLE_PDF, signature.signatureB64, publicKeyPem),
    ).toBe(true);
  });

  it("fails verification when the PDF bytes are tampered with", () => {
    const { privateKeyPem, publicKeyPem } = makeKeyPair();
    const signature = signPdfBytesWithKey(SAMPLE_PDF, privateKeyPem);

    const tampered = new Uint8Array(SAMPLE_PDF);
    tampered[10] = (tampered[10] ?? 0) ^ 0xff;

    expect(
      verifyPdfSignature(tampered, signature.signatureB64, publicKeyPem),
    ).toBe(false);
  });

  it("fails verification against a different public key", () => {
    const signer = makeKeyPair();
    const other = makeKeyPair();
    const signature = signPdfBytesWithKey(SAMPLE_PDF, signer.privateKeyPem);

    expect(
      verifyPdfSignature(
        SAMPLE_PDF,
        signature.signatureB64,
        other.publicKeyPem,
      ),
    ).toBe(false);
  });

  it("returns false (never throws) on malformed signature or key input", () => {
    const { publicKeyPem } = makeKeyPair();

    expect(
      verifyPdfSignature(SAMPLE_PDF, "not-base64-!!!!", publicKeyPem),
    ).toBe(false);
    expect(
      verifyPdfSignature(SAMPLE_PDF, "QUJD", "-----BEGIN NONSENSE-----"),
    ).toBe(false);
  });

  it("binds the payload hash: pdfSha256 matches the signed bytes", () => {
    const { privateKeyPem } = makeKeyPair();
    const signature = signPdfBytesWithKey(SAMPLE_PDF, privateKeyPem);

    expect(signature.pdfSha256).toBe(sha256Hex(SAMPLE_PDF));
    expect(signature.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws on invalid private key material (pure variant)", () => {
    expect(() =>
      signPdfBytesWithKey(SAMPLE_PDF, "-----BEGIN GARBAGE-----"),
    ).toThrow();
  });
});

// ─── Fingerprints and key identity ───────────────────────────────────────────

describe("publicKeyFingerprint / keyId", () => {
  it("computes the same fingerprint from the private and public PEM", () => {
    const { privateKeyPem, publicKeyPem } = makeKeyPair();

    expect(publicKeyFingerprint(privateKeyPem)).toBe(
      publicKeyFingerprint(publicKeyPem),
    );
  });

  it("derives keyId as the first 16 hex chars of the fingerprint", () => {
    const { privateKeyPem } = makeKeyPair();
    const signature = signPdfBytesWithKey(SAMPLE_PDF, privateKeyPem);

    expect(signature.keyId).toBe(signature.certFingerprint.slice(0, 16));
    expect(signature.certFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives a public PEM from a private PEM that verifies signatures", () => {
    const { privateKeyPem } = makeKeyPair();
    const derivedPublicPem = publicKeyPemFromPrivate(privateKeyPem);
    const signature = signPdfBytesWithKey(SAMPLE_PDF, privateKeyPem);

    expect(derivedPublicPem).toContain("BEGIN PUBLIC KEY");
    expect(
      verifyPdfSignature(SAMPLE_PDF, signature.signatureB64, derivedPublicPem),
    ).toBe(true);
  });
});

// ─── QR/JWT signature block mapping ──────────────────────────────────────────

describe("toSignatureBlock", () => {
  it("maps to a compact metadata block without the raw signature", () => {
    const { privateKeyPem } = makeKeyPair();
    const signature = signPdfBytesWithKey(SAMPLE_PDF, privateKeyPem);

    const block = toSignatureBlock(signature);

    expect(block.alg).toBe("RSA-SHA256-detached");
    expect(block.pdfSha256).toBe(signature.pdfSha256);
    expect(block.certFingerprint).toBe(signature.certFingerprint);
    expect(block.keyId).toBe(signature.keyId);
    expect(block.signedAt).toBe(
      Math.floor(new Date(signature.signedAt).getTime() / 1000),
    );
    expect("signatureB64" in block).toBe(false);
  });
});

// ─── Env-driven entry points ─────────────────────────────────────────────────

describe("signPdfBytes (env-driven)", () => {
  it("returns null and reports unconfigured when the env var is unset", () => {
    delete process.env.DOCUMENT_SIGNING_PRIVATE_KEY;

    expect(isDocumentSigningConfigured()).toBe(false);
    expect(signPdfBytes(SAMPLE_PDF)).toBeNull();
    expect(documentSigningPublicKeyPem()).toBeNull();
  });

  it("signs with the env-provisioned key and verifies round-trip", () => {
    const { privateKeyPem, publicKeyPem } = makeKeyPair();
    process.env.DOCUMENT_SIGNING_PRIVATE_KEY = privateKeyPem;

    expect(isDocumentSigningConfigured()).toBe(true);
    const signature = signPdfBytes(SAMPLE_PDF);
    expect(signature).not.toBeNull();
    expect(
      verifyPdfSignature(SAMPLE_PDF, signature!.signatureB64, publicKeyPem),
    ).toBe(true);
    expect(documentSigningPublicKeyPem()).toContain("BEGIN PUBLIC KEY");
  });

  it("restores escaped newlines from single-line env values", () => {
    const { privateKeyPem, publicKeyPem } = makeKeyPair();
    process.env.DOCUMENT_SIGNING_PRIVATE_KEY = privateKeyPem.replace(
      /\n/g,
      "\\n",
    );

    const signature = signPdfBytes(SAMPLE_PDF);
    expect(signature).not.toBeNull();
    expect(
      verifyPdfSignature(SAMPLE_PDF, signature!.signatureB64, publicKeyPem),
    ).toBe(true);
  });

  it("returns null (never throws) on invalid key material", () => {
    process.env.DOCUMENT_SIGNING_PRIVATE_KEY = "-----BEGIN GARBAGE-----";
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => signPdfBytes(SAMPLE_PDF)).not.toThrow();
    expect(signPdfBytes(SAMPLE_PDF)).toBeNull();

    errorSpy.mockRestore();
  });
});
