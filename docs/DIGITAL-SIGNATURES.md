# Digital Signatures — Detached RSA Scheme (TOR 3.5.11 / 3.5.12)

**Status:** PAdES-compatible fallback implemented; full PAdES pending PCSO PKI.
**Code:** [`src/lib/signing/document-signer.ts`](../src/lib/signing/document-signer.ts)
**Reference wiring:** COE generator ([`src/lib/actions/documents/coe-generator.tsx`](../src/lib/actions/documents/coe-generator.tsx))
**Public verification:** `/verify/[token]` + [`src/lib/utils/ldm/certificate-jwt.ts`](../src/lib/utils/ldm/certificate-jwt.ts)

## 1. Current scheme — detached RSA-SHA256

The TOR requires digital signature support on approval documents, integrating
PCSO's existing PKI when available and providing a PAdES-compatible fallback
otherwise (PRD CLI-003). PCSO has not yet provided PKI material, so the
system ships the fallback: a **detached RSA-SHA256 signature over the exact
rendered PDF bytes**.

Flow (as wired in the COE generator):

```
render PDF ──► bytes B
                │
                ├─► signPdfBytes(B)          RSA-SHA256(PKCS#1 v1.5) over B
                │     └─ null when DOCUMENT_SIGNING_PRIVATE_KEY unset
                │
                ├─► mint /verify JWT         payload += signature metadata block
                │     { alg, pdfSha256(B), certFingerprint, keyId, signedAt }
                │
                ├─► upload B to storage      (the signed bytes, unmodified)
                │
                └─► audit log                FULL detached signature (signatureB64)
                                             + metadata + verification URL
```

Key properties:

- **Detached**: the signature never modifies the PDF, so the stored bytes are
  exactly the signed bytes. No circular "QR inside the signed content" problem.
- **Bound**: the verify token carries `pdfSha256` — anyone holding a copy of
  the PDF can hash it and compare against the public verify page.
- **Degrades safely**: when no key is provisioned, `signPdfBytes` returns
  `null`, the token is minted without a signature block, and generation
  continues. Signing is additive, never a hard dependency.
- **Auditable**: the full base64 signature is written to `audit_logs`
  (`action = document.coe.issue`), satisfying COA evidence needs.

### Verifying a document end-to-end

1. Scan the QR / open the `/verify/<token>` URL → confirms the token is
   authentic (HS256) and shows the signature block.
2. `sha256sum document.pdf` → must equal the `pdfSha256` on the verify page.
3. Full cryptographic check (auditors / tooling):

```ts
import { verifyPdfSignature } from "@/lib/signing/document-signer";
// signatureB64 from the audit log row; publicKeyPem from the ops key registry
verifyPdfSignature(pdfBytes, signatureB64, publicKeyPem); // → true
```

Or with OpenSSL, no application code required:

```bash
base64 -d signature.b64 > signature.bin
openssl dgst -sha256 -verify public.pem -signature signature.bin document.pdf
```

## 2. How this maps to PAdES

| PAdES concept (ETSI EN 319 142)             | This scheme                                               | Gap                                                                           |
| ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Signature over document content             | RSA-SHA256 over the full PDF bytes                        | none (stronger: covers 100% of bytes; PAdES excludes the signature container) |
| Embedded CMS/CAdES container in `/Contents` | Detached — stored in audit log + metadata in verify token | signature not visible inside Acrobat                                          |
| Signer identity via X.509 certificate       | SPKI fingerprint of the raw keypair (`certFingerprint`)   | no CA-chained identity until PCSO PKI issues certs                            |
| Signing time attribute                      | `signedAt` in signature + token                           | not RFC 3161 timestamped                                                      |
| Long-term validation (LTV/archival)         | 5-year verify-token expiry + immutable audit log          | no OCSP/CRL embedding                                                         |
| Visual signature appearance                 | Footer line "protected by a detached digital signature"   | no signature widget/annotation                                                |

The scheme is _PAdES-compatible_ in the sense that it preserves the two
guarantees PAdES exists for — document integrity and signer attribution — and
the upgrade below embeds the same signature material into the PDF proper
without changing key management, storage, or the verify flow.

## 3. Upgrade path to full PAdES (when PCSO PKI arrives)

1. **Obtain PKI material**: signing certificate (with CA chain) issued by the
   PCSO PKI to a document-signing service identity, delivered as PKCS#12 or
   PEM. Store the private key exactly like the current key (env/secret
   manager); add the cert chain alongside.
2. **Embed instead of detach**: post-process the rendered PDF with `pdf-lib`
   (already a dependency) to add a signature field: `ByteRange` placeholder,
   `/SubFilter ETSI.CAdES.detached`, then produce the CMS SignedData with
   WebCrypto/node:crypto over the ByteRange digest and inject it into
   `/Contents`. (`@signpdf/signpdf` + a CAdES placeholder helper covers this
   if hand-rolling CMS is not desired — evaluate before adding.)
3. **Keep the existing block**: continue emitting the verify-token signature
   block (hash of the FINAL signed PDF) and audit-log entry — external
   verification via QR stays intact for people without PDF tooling.
4. **Timestamping (PAdES-T)**: add an RFC 3161 TSA request over the signature
   value; PCSO/DICT to nominate the TSA endpoint.
5. **Roll forward, not back**: previously issued detached-signature documents
   remain verifiable forever via the audit log — do not re-issue.

Interface stability: `signPdfBytes(bytes)` keeps its signature; only its
internals change from "sign bytes" to "embed CMS + return metadata", so the
COE reference wiring and any generator that copies it will not need edits.

## 4. Key provisioning runbook

### 4.1 Generate the keypair (Super Admin / IT-MIS)

```bash
# 3072-bit RSA, PKCS#8 — done on a trusted workstation, never in the repo
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out signing-key.pem
openssl pkey -in signing-key.pem -pubout -out signing-pub.pem

# Record the fingerprint for the key registry (matches `certFingerprint`)
openssl pkey -pubin -in signing-pub.pem -outform DER | openssl dgst -sha256
```

### 4.2 Provision

- Set `DOCUMENT_SIGNING_PRIVATE_KEY` in the hosting platform's secret store
  (Vercel/Railway → environment variables). Multi-line PEM is accepted; if
  the platform flattens newlines, paste with literal `\n` separators — the
  loader restores them.
- Never commit the PEM. `.env.example` documents the variable name only.
- Publish `signing-pub.pem` + fingerprint to the internal ops key registry
  (and to COA/auditors on request). The app can also emit it via
  `documentSigningPublicKeyPem()` for tooling.

### 4.3 Verify provisioning

1. Generate a COE from **Employees → Documents** (or via a document request).
2. Result shows `digitallySigned: true`; the PDF footer reads "protected by a
   detached digital signature".
3. Open the `verificationUrl` — the "Digital signature" section renders with
   the expected key fingerprint.
4. `audit_logs` row `document.coe.issue` contains the `signature` object.

### 4.4 Rotation

1. Generate a new keypair (4.1) and record the new fingerprint + rotation date
   in the key registry.
2. Replace `DOCUMENT_SIGNING_PRIVATE_KEY`; redeploy/restart.
3. Old documents stay valid: verification uses the public key matching the
   `keyId`/`certFingerprint` captured at issuance — keep ALL retired public
   keys in the registry permanently (private keys may be destroyed after
   rotation; they are never needed for verification).
4. On suspected compromise: rotate immediately, then treat every signature
   made after the compromise window as unverified pending re-issue; the audit
   log's `signedAt` + `keyId` identifies the affected set.

### 4.5 Adopting signing in another generator

Copy the COE pattern (`coe-generator.tsx` steps 8–13):

1. Render → `Uint8Array` bytes.
2. `const signature = signPdfBytes(bytes)` (null-safe).
3. Mint the verify token with `...(signature ? { signature: toSignatureBlock(signature) } : {})`.
4. Upload the SAME bytes you signed.
5. Audit-log the full `signature` object.
