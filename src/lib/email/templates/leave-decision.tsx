/**
 * Email template — Leave Application Decision (Approved / Disapproved)
 * Sent to the applicant when their leave application is acted upon.
 */

import * as React from "react";
import { LEAVE_TYPES } from "@/lib/constants/leave-types";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveDecisionEmailProps {
  /** Full name of the employee applicant. */
  applicantName: string;
  /** Leave type code. */
  leaveTypeCode: LeaveTypeCode;
  /** ISO 8601 — start date. */
  startDate: string;
  /** ISO 8601 — end date. */
  endDate: string;
  /** Working days. */
  workingDays: number;
  /** 'approved' or 'disapproved'. */
  decision: "approved" | "disapproved";
  /** Full name of the approver who made the decision. */
  approverName: string;
  /** Optional remarks from the approver. */
  remarks: string | null;
  /** UUID of the leave application. */
  leaveApplicationId: string;
  /** Base URL of the application. */
  appUrl: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function LeaveDecisionEmail({
  applicantName,
  leaveTypeCode,
  startDate,
  endDate,
  workingDays,
  decision,
  approverName,
  remarks,
  leaveApplicationId,
  appUrl,
}: LeaveDecisionEmailProps): React.ReactElement {
  const leaveTypeName = LEAVE_TYPES[leaveTypeCode]?.name ?? leaveTypeCode;
  const isApproved = decision === "approved";
  const statusColor = isApproved ? "#059669" : "#dc2626";
  const statusLabel = isApproved ? "APPROVED" : "DISAPPROVED";
  const detailUrl = `${appUrl}/leave`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`Leave Application ${isApproved ? "Approved" : "Disapproved"}`}</title>
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
                  Your Leave Application Has Been{" "}
                  <span style={{ color: isApproved ? "#6ee7b7" : "#fca5a5" }}>
                    {isApproved ? "Approved" : "Disapproved"}
                  </span>
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
                  Dear <strong>{applicantName}</strong>,
                </p>
                <p
                  style={{
                    margin: "0 0 24px",
                    color: "#374151",
                    fontSize: "15px",
                  }}
                >
                  Your leave application has been reviewed by{" "}
                  <strong>{approverName}</strong> and has been:
                </p>

                {/* Status Badge */}
                <div
                  style={{
                    backgroundColor: isApproved ? "#ecfdf5" : "#fef2f2",
                    border: `2px solid ${statusColor}`,
                    borderRadius: "8px",
                    padding: "12px 20px",
                    marginBottom: "24px",
                    display: "inline-block",
                  }}
                >
                  <span
                    style={{
                      color: statusColor,
                      fontSize: "16px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Application Details */}
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
                          Application Reference (
                          {leaveApplicationId.slice(0, 8).toUpperCase()})
                        </h2>
                        {[
                          ["Leave Type", leaveTypeName],
                          ["Date From", formatDate(startDate)],
                          ["Date To", formatDate(endDate)],
                          ["Working Days", String(workingDays)],
                          ...(remarks ? [["Approver Remarks", remarks]] : []),
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
                          View My Leave Applications
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

export function leaveDecisionPlainText({
  applicantName,
  leaveTypeCode,
  startDate,
  endDate,
  workingDays,
  decision,
  approverName,
  remarks,
  leaveApplicationId,
  appUrl,
}: LeaveDecisionEmailProps): string {
  const leaveTypeName = LEAVE_TYPES[leaveTypeCode]?.name ?? leaveTypeCode;
  const statusLabel = decision === "approved" ? "APPROVED" : "DISAPPROVED";

  return [
    `Dear ${applicantName},`,
    "",
    `Your leave application has been ${statusLabel} by ${approverName}.`,
    "",
    `Reference:     ${leaveApplicationId.slice(0, 8).toUpperCase()}`,
    `Leave Type:    ${leaveTypeName}`,
    `Date From:     ${formatDate(startDate)}`,
    `Date To:       ${formatDate(endDate)}`,
    `Working Days:  ${workingDays}`,
    ...(remarks ? [`Remarks:       ${remarks}`] : []),
    "",
    `View your applications: ${appUrl}/leave`,
    "",
    "---",
    "This is an automated message from the PCSO HRIS.",
  ].join("\n");
}
