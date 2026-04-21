/**
 * SALN PDF Template — CSC Form CS-SALN-1
 *
 * Renders a printable / PDF-exportable version of the SALN submission
 * using standard HTML + inline styles (compatible with window.print() and
 * headless PDF renderers like Puppeteer / @react-pdf/renderer).
 *
 * NOTE: This component is intentionally NOT a Server Component to allow
 * it to be used in both server and client rendering contexts.
 * It receives fully hydrated data — no data fetching.
 */

import * as React from "react";
import { formatPeso } from "@/lib/utils/saln/net-worth";
import type {
  RealAsset,
  PersonalProperty,
  Investment,
  Liability,
  BusinessInterest,
  RelativeInGovernment,
  FilingType,
  SalnStatus,
} from "@/lib/validations/saln";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SalnPdfData {
  // Header
  submissionId: string;
  year: number;
  filingType: FilingType;
  status: SalnStatus;
  dateFiled: string | null;

  // Employee
  employeeNo: string;
  fullName: string;
  positionTitle: string;
  officeName: string | null;
  gsisNo: string | null;
  tin: string | null;

  // SALN data
  realAssets: RealAsset[];
  personalProperties: PersonalProperty[];
  investments: Investment[];
  liabilities: Liability[];
  businessInterests: BusinessInterest[];
  relatives: RelativeInGovernment[];

  // Computed
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = {
  page: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "10px",
    color: "#000",
    padding: "20mm 15mm",
    maxWidth: "210mm",
    margin: "0 auto",
    backgroundColor: "#fff",
  } satisfies React.CSSProperties,

  header: {
    textAlign: "center" as const,
    borderBottom: "2px solid #000",
    paddingBottom: "8px",
    marginBottom: "12px",
  },

  title: {
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },

  subtitle: {
    fontSize: "10px",
    marginTop: "2px",
  },

  sectionHeading: {
    fontSize: "10px",
    fontWeight: "bold",
    backgroundColor: "#d0d0d0",
    padding: "3px 6px",
    borderTop: "1px solid #000",
    borderBottom: "1px solid #000",
    marginTop: "10px",
    textTransform: "uppercase" as const,
  } satisfies React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginTop: "4px",
    fontSize: "9px",
  },

  th: {
    border: "1px solid #aaa",
    padding: "3px 5px",
    backgroundColor: "#f0f0f0",
    textAlign: "left" as const,
    fontWeight: "bold",
  } satisfies React.CSSProperties,

  td: {
    border: "1px solid #aaa",
    padding: "3px 5px",
    verticalAlign: "top" as const,
  } satisfies React.CSSProperties,

  tdRight: {
    border: "1px solid #aaa",
    padding: "3px 5px",
    textAlign: "right" as const,
  } satisfies React.CSSProperties,

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #ddd",
    padding: "3px 0",
  } satisfies React.CSSProperties,

  certText: {
    fontSize: "9px",
    fontStyle: "italic" as const,
    marginTop: "8px",
    lineHeight: "1.4",
    border: "1px solid #aaa",
    padding: "6px",
    backgroundColor: "#f9f9f9",
  },

  signatureBlock: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "16px",
  } satisfies React.CSSProperties,

  signatureLine: {
    borderTop: "1px solid #000",
    marginTop: "24px",
    paddingTop: "3px",
    textAlign: "center" as const,
    fontSize: "9px",
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILING_TYPE_LABELS: Record<FilingType, string> = {
  annual: "Annual (Calendar Year)",
  initial: "Initial (Upon Entry)",
  upon_assumption: "Upon Assumption of Office",
  upon_separation: "Upon Separation from Service",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SalnFormPdf({
  data,
}: {
  data: SalnPdfData;
}): React.ReactElement {
  return (
    <div style={STYLES.page}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={STYLES.header}>
        <p style={{ fontSize: "9px", margin: 0 }}>
          Republic of the Philippines
        </p>
        <p style={{ fontSize: "9px", margin: 0 }}>
          Philippine Charity Sweepstakes Office
        </p>
        <p style={{ ...STYLES.title, margin: "4px 0 0" }}>
          Statement of Assets, Liabilities and Net Worth
        </p>
        <p style={STYLES.subtitle}>
          (CSC Form No. 1 — Pursuant to R.A. 6713 and E.O. No. 17)
        </p>
        <p style={{ ...STYLES.subtitle, marginTop: "2px" }}>
          For the Year Ended December 31, {data.year}
        </p>
      </div>

      {/* ── Personal Information ────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div>
          <p style={{ margin: 0 }}>
            <strong>Name:</strong> {data.fullName}
          </p>
          <p style={{ margin: "2px 0 0" }}>
            <strong>Position:</strong> {data.positionTitle}
          </p>
          <p style={{ margin: "2px 0 0" }}>
            <strong>Office:</strong> {data.officeName ?? "N/A"}
          </p>
        </div>
        <div>
          <p style={{ margin: 0 }}>
            <strong>Employee No.:</strong> {data.employeeNo}
          </p>
          <p style={{ margin: "2px 0 0" }}>
            <strong>GSIS No.:</strong> {data.gsisNo ?? "N/A"}
          </p>
          <p style={{ margin: "2px 0 0" }}>
            <strong>TIN:</strong> {data.tin ?? "N/A"}
          </p>
        </div>
      </div>

      <p style={{ margin: "0 0 8px", fontSize: "9px" }}>
        <strong>Filing Type:</strong> {FILING_TYPE_LABELS[data.filingType]}
        &emsp;
        <strong>Date Filed:</strong> {data.dateFiled ?? "—"}
        &emsp;
        <strong>Status:</strong> {data.status.toUpperCase()}
      </p>

      {/* ── I. ASSETS ───────────────────────────────────────────── */}
      <div style={STYLES.sectionHeading}>I. ASSETS</div>

      {/* A. Real Properties */}
      <p style={{ margin: "6px 0 2px", fontWeight: "bold", fontSize: "9px" }}>
        A. Real Properties
      </p>
      {data.realAssets.length === 0 ? (
        <p style={{ fontSize: "9px", fontStyle: "italic" }}>None</p>
      ) : (
        <table style={STYLES.table}>
          <thead>
            <tr>
              <th style={STYLES.th}>Description</th>
              <th style={STYLES.th}>Kind</th>
              <th style={STYLES.th}>Location</th>
              <th style={STYLES.th}>Yr Acqd</th>
              <th style={STYLES.th}>Mode</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>Cost</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>Assessed</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>Market Value</th>
            </tr>
          </thead>
          <tbody>
            {data.realAssets.map((item, i) => (
              <tr key={i}>
                <td style={STYLES.td}>{item.description}</td>
                <td style={STYLES.td}>{item.kind}</td>
                <td style={STYLES.td}>{item.location}</td>
                <td style={STYLES.td}>{item.yearAcquired}</td>
                <td style={STYLES.td}>{item.mode}</td>
                <td style={STYLES.tdRight}>{formatPeso(item.cost)}</td>
                <td style={STYLES.tdRight}>{formatPeso(item.assessedValue)}</td>
                <td style={STYLES.tdRight}>{formatPeso(item.marketValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* B. Personal Properties */}
      <p style={{ margin: "6px 0 2px", fontWeight: "bold", fontSize: "9px" }}>
        B. Personal Properties
      </p>
      {data.personalProperties.length === 0 ? (
        <p style={{ fontSize: "9px", fontStyle: "italic" }}>None</p>
      ) : (
        <table style={STYLES.table}>
          <thead>
            <tr>
              <th style={STYLES.th}>Description</th>
              <th style={STYLES.th}>Yr Acqd</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>Cost</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>Market Value</th>
            </tr>
          </thead>
          <tbody>
            {data.personalProperties.map((item, i) => (
              <tr key={i}>
                <td style={STYLES.td}>{item.description}</td>
                <td style={STYLES.td}>{item.yearAcquired}</td>
                <td style={STYLES.tdRight}>{formatPeso(item.cost)}</td>
                <td style={STYLES.tdRight}>
                  {formatPeso(item.currentFairMarketValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* C. Investments */}
      <p style={{ margin: "6px 0 2px", fontWeight: "bold", fontSize: "9px" }}>
        C. Investments / Financial Assets
      </p>
      {data.investments.length === 0 ? (
        <p style={{ fontSize: "9px", fontStyle: "italic" }}>None</p>
      ) : (
        <table style={STYLES.table}>
          <thead>
            <tr>
              <th style={STYLES.th}>Institution</th>
              <th style={STYLES.th}>Type</th>
              <th style={STYLES.th}>Year</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.investments.map((item, i) => (
              <tr key={i}>
                <td style={STYLES.td}>{item.institution}</td>
                <td style={STYLES.td}>{item.type}</td>
                <td style={STYLES.td}>{item.year}</td>
                <td style={STYLES.tdRight}>{formatPeso(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── II. LIABILITIES ─────────────────────────────────────── */}
      <div style={STYLES.sectionHeading}>II. LIABILITIES</div>
      {data.liabilities.length === 0 ? (
        <p style={{ fontSize: "9px", fontStyle: "italic", marginTop: "4px" }}>
          None
        </p>
      ) : (
        <table style={{ ...STYLES.table, marginTop: "4px" }}>
          <thead>
            <tr>
              <th style={STYLES.th}>Nature</th>
              <th style={STYLES.th}>Creditor</th>
              <th style={{ ...STYLES.th, textAlign: "right" }}>
                Outstanding Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {data.liabilities.map((item, i) => (
              <tr key={i}>
                <td style={STYLES.td}>{item.nature}</td>
                <td style={STYLES.td}>{item.creditor}</td>
                <td style={STYLES.tdRight}>
                  {formatPeso(item.outstandingBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Net Worth Summary ────────────────────────────────────── */}
      <div style={{ ...STYLES.sectionHeading, marginTop: "10px" }}>
        NET WORTH SUMMARY
      </div>
      <div style={{ padding: "6px 0", fontSize: "10px" }}>
        <div style={STYLES.summaryRow}>
          <span>Total Assets</span>
          <span style={{ fontFamily: "monospace" }}>
            {formatPeso(data.totalAssets)}
          </span>
        </div>
        <div style={STYLES.summaryRow}>
          <span>Total Liabilities</span>
          <span style={{ fontFamily: "monospace" }}>
            ({formatPeso(data.totalLiabilities)})
          </span>
        </div>
        <div
          style={{
            ...STYLES.summaryRow,
            fontWeight: "bold",
            borderTop: "2px solid #000",
            marginTop: "4px",
          }}
        >
          <span>NET WORTH</span>
          <span style={{ fontFamily: "monospace" }}>
            {formatPeso(data.netWorth)}
          </span>
        </div>
      </div>

      {/* ── III. Business Interests ──────────────────────────────── */}
      <div style={STYLES.sectionHeading}>
        III. BUSINESS INTERESTS AND FINANCIAL CONNECTIONS
      </div>
      {data.businessInterests.length === 0 ? (
        <p style={{ fontSize: "9px", fontStyle: "italic", marginTop: "4px" }}>
          None
        </p>
      ) : (
        <table style={{ ...STYLES.table, marginTop: "4px" }}>
          <thead>
            <tr>
              <th style={STYLES.th}>Entity Name</th>
              <th style={STYLES.th}>Address</th>
              <th style={STYLES.th}>Nature</th>
              <th style={STYLES.th}>Date Acquired</th>
            </tr>
          </thead>
          <tbody>
            {data.businessInterests.map((item, i) => (
              <tr key={i}>
                <td style={STYLES.td}>{item.entityName}</td>
                <td style={STYLES.td}>{item.businessAddress}</td>
                <td style={STYLES.td}>{item.nature}</td>
                <td style={STYLES.td}>{item.dateAcquired}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── IV. Relatives in Government ──────────────────────────── */}
      <div style={STYLES.sectionHeading}>
        IV. RELATIVES IN GOVERNMENT SERVICE (Within 4th Civil Degree)
      </div>
      {data.relatives.length === 0 ? (
        <p style={{ fontSize: "9px", fontStyle: "italic", marginTop: "4px" }}>
          None
        </p>
      ) : (
        <table style={{ ...STYLES.table, marginTop: "4px" }}>
          <thead>
            <tr>
              <th style={STYLES.th}>Name</th>
              <th style={STYLES.th}>Relationship</th>
              <th style={STYLES.th}>Position</th>
              <th style={STYLES.th}>Agency and Address</th>
            </tr>
          </thead>
          <tbody>
            {data.relatives.map((item, i) => (
              <tr key={i}>
                <td style={STYLES.td}>{item.name}</td>
                <td style={STYLES.td}>{item.relationship}</td>
                <td style={STYLES.td}>{item.position}</td>
                <td style={STYLES.td}>{item.agencyAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Certification ────────────────────────────────────────── */}
      <div style={STYLES.certText}>
        <p style={{ margin: 0 }}>
          I hereby certify that I have truly disclosed, for the purpose of
          complying with the provisions of Republic Act No. 6713 (The Code of
          Conduct and Ethical Standards for Public Officials and Employees) and
          Executive Order No. 17 (Directing All Government Officials and
          Employees to File and Submit Their Sworn Statement of Assets,
          Liabilities and Net Worth), to the best of my knowledge and
          information, all my assets, liabilities, net worth, business interests
          and financial connections, including those of my spouse and unmarried
          children below eighteen (18) years of age living in my household.
        </p>
      </div>

      {/* ── Signatures ───────────────────────────────────────────── */}
      <div style={STYLES.signatureBlock}>
        <div>
          <div style={STYLES.signatureLine}>
            <p style={{ margin: 0, fontWeight: "bold" }}>{data.fullName}</p>
            <p style={{ margin: "1px 0 0" }}>Signature of Filer</p>
          </div>
        </div>
        <div>
          <div style={STYLES.signatureLine}>
            <p style={{ margin: 0, fontWeight: "bold" }}>&nbsp;</p>
            <p style={{ margin: "1px 0 0" }}>Administering Officer</p>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <p
        style={{
          marginTop: "16px",
          fontSize: "8px",
          textAlign: "center" as const,
          color: "#666",
        }}
      >
        CSC Form CS-SALN-1 · PCSO HRIS · Generated:{" "}
        {new Date().toLocaleDateString("en-PH")} · Submission ID:{" "}
        {data.submissionId.slice(0, 8).toUpperCase()}
      </p>
    </div>
  );
}
