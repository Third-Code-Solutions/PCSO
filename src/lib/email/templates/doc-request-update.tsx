/**
 * Email template — Document Request Status Update (N-018, template doc_request_update)
 * Sent to the requesting employee whenever their document request transitions
 * to a new state (received, in process, on hold, released, disapproved).
 */

import * as React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocRequestUpdateEmailProps {
  /** Full name of the requesting employee. */
  employeeName: string;
  /** Human-readable document type (e.g. "Certificate of Employment"). */
  documentLabel: string;
  /** Human-readable new status (e.g. "In Process", "On Hold"). */
  statusLabel: string;
  /** Optional detail line — hold reason, disapproval reason, etc. */
  detail: string | null;
  /** UUID of the document request. */
  requestId: string;
  /** Base URL of the application. */
  appUrl: string;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function DocRequestUpdateEmail({
  employeeName,
  documentLabel,
  statusLabel,
  detail,
  requestId,
  appUrl,
}: DocRequestUpdateEmailProps): React.ReactElement {
  const detailUrl = `${appUrl}/portal/document-requests`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document Request Update</title>
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
                  PCSO HRIS
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
                  Document Request Update
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
                  Dear <strong>{employeeName}</strong>,
                </p>
                <p
                  style={{
                    margin: "0 0 24px",
                    color: "#374151",
                    fontSize: "15px",
                  }}
                >
                  Your request for a <strong>{documentLabel}</strong> has a new
                  status:
                </p>

                {/* Status Badge */}
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    border: "2px solid #0B2545",
                    borderRadius: "8px",
                    padding: "12px 20px",
                    marginBottom: "24px",
                    display: "inline-block",
                  }}
                >
                  <span
                    style={{
                      color: "#0B2545",
                      fontSize: "16px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Request Details */}
                <table
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    marginBottom: "24px",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "20px" }}>
                        <h2
                          style={{
                            color: "#0B2545",
                            fontSize: "13px",
                            fontWeight: 600,
                            letterSpacing: "1px",
                            textTransform: "uppercase",
                            margin: "0 0 16px",
                          }}
                        >
                          Request Reference (
                          {requestId.slice(0, 8).toUpperCase()})
                        </h2>
                        {[
                          ["Document", documentLabel],
                          ["Status", statusLabel],
                          ...(detail ? [["Remarks", detail]] : []),
                        ].map(([label, value]) => (
                          <table
                            key={label}
                            width="100%"
                            cellPadding={0}
                            cellSpacing={0}
                            style={{ marginBottom: "12px" }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  style={{
                                    color: "#6b7280",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    width: "140px",
                                    verticalAlign: "top",
                                    paddingTop: "2px",
                                  }}
                                >
                                  {label}
                                </td>
                                <td
                                  style={{ color: "#111827", fontSize: "14px" }}
                                >
                                  {value}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* CTA */}
                <table width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td>
                        <a
                          href={detailUrl}
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
                          View My Document Requests
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
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

export function docRequestUpdatePlainText({
  employeeName,
  documentLabel,
  statusLabel,
  detail,
  requestId,
  appUrl,
}: DocRequestUpdateEmailProps): string {
  return [
    `Dear ${employeeName},`,
    "",
    `Your request for a ${documentLabel} has a new status: ${statusLabel.toUpperCase()}.`,
    "",
    `Reference: ${requestId.slice(0, 8).toUpperCase()}`,
    `Document:  ${documentLabel}`,
    `Status:    ${statusLabel}`,
    ...(detail ? [`Remarks:   ${detail}`] : []),
    "",
    `View your document requests: ${appUrl}/portal/document-requests`,
    "",
    "---",
    "This is an automated message from the PCSO HRIS.",
  ].join("\n");
}
