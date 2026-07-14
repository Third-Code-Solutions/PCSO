/**
 * Email template — No Filed Leave (NFL) Notice
 * TOR 1.4.6 / PRD N-008 (lwop_notice).
 *
 * Sent to an employee when a working day passes with no attendance log and
 * no approved leave application covering the date. The absence is treated as
 * LWOP for payroll unless a leave application is filed and approved.
 *
 * Uses Resend's React email renderer.
 */

import * as React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NflNoticeEmailProps {
  /** Full name of the employee. */
  employeeName: string;
  /** Employee number. */
  employeeNo: string;
  /** ISO 8601 date (YYYY-MM-DD) of the unauthorized absence. */
  absenceDate: string;
  /** Base URL of the application (e.g., https://hris.pcso.gov.ph). */
  appUrl: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * React email component for NFL (No Filed Leave) notices.
 * Rendered server-side by Resend before delivery.
 */
export function NflNoticeEmail({
  employeeName,
  employeeNo,
  absenceDate,
  appUrl,
}: NflNoticeEmailProps): React.ReactElement {
  const applyUrl = `${appUrl}/leave/apply`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>No Filed Leave — Action Required</title>
      </head>
      <body
        style={{
          backgroundColor: "#f8f5ee",
          fontFamily: "'Inter', Arial, sans-serif",
          margin: 0,
          padding: "24px",
        }}
      >
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ maxWidth: "600px", margin: "0 auto" }}
        >
          <tbody>
            {/* Header */}
            <tr>
              <td
                style={{
                  backgroundColor: "#0B2545",
                  borderRadius: "8px 8px 0 0",
                  padding: "24px 32px",
                }}
              >
                <p
                  style={{
                    color: "#C8A84B",
                    fontSize: "11px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    margin: "0 0 4px",
                  }}
                >
                  Philippine Charity Sweepstakes Office
                </p>
                <h1
                  style={{
                    color: "#FAF4E6",
                    fontSize: "20px",
                    fontWeight: 600,
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Absence Without Filed Leave
                </h1>
              </td>
            </tr>

            {/* Body */}
            <tr>
              <td
                style={{
                  backgroundColor: "#ffffff",
                  padding: "32px",
                  borderLeft: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                <p
                  style={{
                    margin: "0 0 20px",
                    color: "#374151",
                    fontSize: "15px",
                  }}
                >
                  Dear <strong>{employeeName}</strong> ({employeeNo}),
                </p>
                <p
                  style={{
                    margin: "0 0 16px",
                    color: "#374151",
                    fontSize: "15px",
                  }}
                >
                  Our records show no attendance log and no approved leave
                  application for:
                </p>

                <table
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    marginBottom: "24px",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "16px 20px" }}>
                        <p
                          style={{
                            color: "#991b1b",
                            fontSize: "15px",
                            fontWeight: 600,
                            margin: 0,
                          }}
                        >
                          {formatDate(absenceDate)}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p
                  style={{
                    margin: "0 0 24px",
                    color: "#374151",
                    fontSize: "14px",
                    lineHeight: 1.6,
                  }}
                >
                  Per CSC Omnibus Rules on Leave, an absence without an approved
                  leave application is recorded as{" "}
                  <strong>Leave Without Pay (LWOP)</strong> and endorsed to the
                  Payroll Section for salary deduction. If this absence is
                  covered by a leave you intend to file, please submit a leave
                  application (with supporting documents where required) as soon
                  as possible. If you believe this notice is an error (e.g., a
                  missing biometric log), please file a DTR correction request.
                </p>

                {/* CTA */}
                <table width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: "24px" }}>
                        <a
                          href={applyUrl}
                          style={{
                            backgroundColor: "#0B2545",
                            borderRadius: "6px",
                            color: "#FAF4E6",
                            display: "inline-block",
                            fontSize: "14px",
                            fontWeight: 600,
                            padding: "12px 24px",
                            textDecoration: "none",
                          }}
                        >
                          File a Leave Application
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>
                  Or copy this link:{" "}
                  <a
                    href={applyUrl}
                    style={{ color: "#0B2545", wordBreak: "break-all" }}
                  >
                    {applyUrl}
                  </a>
                </p>
              </td>
            </tr>

            {/* Footer */}
            <tr>
              <td
                style={{
                  backgroundColor: "#f3f4f6",
                  borderRadius: "0 0 8px 8px",
                  borderLeft: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                  borderBottom: "1px solid #e5e7eb",
                  padding: "16px 32px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    margin: 0,
                  }}
                >
                  This is an automated message from the PCSO HRIS. Do not reply
                  to this email.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

// ---------------------------------------------------------------------------
// Plain-text fallback
// ---------------------------------------------------------------------------

export function nflNoticePlainText({
  employeeName,
  employeeNo,
  absenceDate,
  appUrl,
}: NflNoticeEmailProps): string {
  return [
    `Dear ${employeeName} (${employeeNo}),`,
    "",
    "Our records show no attendance log and no approved leave application for:",
    "",
    `  ${formatDate(absenceDate)}`,
    "",
    "Per CSC Omnibus Rules on Leave, an absence without an approved leave",
    "application is recorded as Leave Without Pay (LWOP) and endorsed to the",
    "Payroll Section for salary deduction.",
    "",
    "If this absence is covered by a leave you intend to file, please submit",
    "a leave application as soon as possible. If you believe this notice is",
    "an error (e.g., a missing biometric log), file a DTR correction request.",
    "",
    `File a leave application here: ${appUrl}/leave/apply`,
    "",
    "---",
    "This is an automated message from the PCSO HRIS.",
  ].join("\n");
}
