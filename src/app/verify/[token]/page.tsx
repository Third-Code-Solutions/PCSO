/**
 * LDM-010 — Public QR verification landing page.
 *
 * Anyone with the QR-encoded token can land here to confirm a certificate's
 * authenticity. We intentionally render a minimal, PII-safe view:
 *   - Document type
 *   - Serial number
 *   - Issue date
 *   - Issuer system user id
 *
 * The employee name is deliberately NOT exposed. The token embeds a truncated
 * SHA-256 hash of the employee id for audit correlation only.
 *
 * Invalid / expired tokens render a 404 via `notFound()` so crawlers and
 * attackers cannot distinguish between a malformed token and a revoked one.
 */
import { notFound } from "next/navigation";
import { verifyCertificateToken } from "@/lib/utils/ldm/certificate-jwt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface VerifyPageProps {
  params: Promise<{ token: string }>;
}

function formatIssuedAt(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function VerifyTokenPage({
  params,
}: VerifyPageProps): Promise<React.ReactElement> {
  const { token } = await params;
  const payload = verifyCertificateToken(token);
  if (!payload) {
    notFound();
  }

  const issuedOn = formatIssuedAt(payload.issuedAt);

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "#111827",
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <p
          style={{
            letterSpacing: 4,
            fontSize: 12,
            color: "#C8A84B",
            margin: 0,
          }}
        >
          PCSO · DOCUMENT VERIFICATION
        </p>
        <h1
          style={{
            fontSize: 32,
            marginTop: 8,
            marginBottom: 0,
            color: "#0B2545",
          }}
        >
          Certificate verified
        </h1>
        <p style={{ color: "#6B7280", marginTop: 8 }}>
          This document was issued by the Philippine Charity Sweepstakes Office
          and its digital signature is valid.
        </p>
      </header>

      <section
        aria-labelledby="cert-details"
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 24,
          background: "#FAFAF7",
        }}
      >
        <h2
          id="cert-details"
          style={{
            fontSize: 14,
            letterSpacing: 2,
            color: "#6B7280",
            textTransform: "uppercase",
            marginTop: 0,
          }}
        >
          Document details
        </h2>
        <dl style={{ margin: 0 }}>
          <DetailRow label="Document type" value="Certificate of Training" />
          <DetailRow label="Serial number" value={payload.serialNumber} />
          <DetailRow label="Issued on" value={issuedOn} />
          <DetailRow label="Issued by" value={payload.issuedBy} />
        </dl>
      </section>

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          color: "#6B7280",
        }}
      >
        For privacy, the recipient&rsquo;s name is not shown on this public
        verification page. Employees and authorised HR staff can retrieve the
        full record from the internal portal.
      </p>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: "1px solid #EEEAE0",
      }}
    >
      <dt
        style={{
          fontSize: 12,
          color: "#6B7280",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "#0B2545",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
