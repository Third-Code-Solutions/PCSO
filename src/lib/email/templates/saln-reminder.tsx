/**
 * Email template — SALN Filing Reminder
 * Sent to employees who have not filed their SALN before the April 30 deadline.
 *
 * Uses Resend's React email renderer.
 * Basis: RA 6713 Section 8 — annual SALN filing requirement.
 */

import * as React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SalnReminderEmailProps {
  /** Full name of the recipient employee. */
  employeeName: string;
  /** Employee number. */
  employeeNo: string;
  /** SALN coverage year (e.g. 2024). */
  coverageYear: number;
  /** Filing deadline (formatted, e.g. "April 30, 2025"). */
  deadlineFormatted: string;
  /** Base URL of the application. */
  appUrl: string;
  /** Number of days remaining until deadline. Negative means overdue. */
  daysRemaining: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urgencyLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return "OVERDUE";
  if (daysRemaining <= 7) return "URGENT";
  if (daysRemaining <= 14) return "ACTION REQUIRED";
  return "REMINDER";
}

function urgencyColor(daysRemaining: number): string {
  if (daysRemaining < 0) return "#dc2626";
  if (daysRemaining <= 7) return "#ea580c";
  if (daysRemaining <= 14) return "#d97706";
  return "#0B2545";
}

// ---------------------------------------------------------------------------
// React Email component
// ---------------------------------------------------------------------------

export function SalnReminderEmail({
  employeeName,
  employeeNo,
  coverageYear,
  deadlineFormatted,
  appUrl,
  daysRemaining,
}: SalnReminderEmailProps): React.ReactElement {
  const label = urgencyLabel(daysRemaining);
  const color = urgencyColor(daysRemaining);
  const filingUrl = `${appUrl}/saln/new`;

  return (
    <div
      style={{
        fontFamily: "Georgia, serif",
        maxWidth: "600px",
        margin: "0 auto",
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0B2545",
          padding: "24px 32px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "#C8A84B",
            fontSize: "11px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: "0 0 8px 0",
          }}
        >
          Philippine Charity Sweepstakes Office
        </p>
        <h1
          style={{
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: "700",
            margin: "0",
          }}
        >
          Human Resource Information System
        </h1>
      </div>

      {/* Urgency banner */}
      <div
        style={{
          backgroundColor: color,
          padding: "10px 32px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: "700",
            letterSpacing: "2px",
            margin: "0",
          }}
        >
          {label} — SALN FILING {coverageYear}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: "32px" }}>
        <p style={{ color: "#374151", margin: "0 0 16px 0" }}>
          Dear {employeeName},
        </p>

        <p
          style={{ color: "#374151", margin: "0 0 16px 0", lineHeight: "1.6" }}
        >
          This is an official notice from the PCSO Human Resource Management
          Office regarding your obligation under{" "}
          <strong>Republic Act No. 6713</strong> (Code of Conduct and Ethical
          Standards for Public Officials and Employees) to file your{" "}
          <strong>
            Statement of Assets, Liabilities, and Net Worth (SALN) for Calendar
            Year {coverageYear}
          </strong>
          .
        </p>

        {/* Key info box */}
        <div
          style={{
            backgroundColor: "#FAF4E6",
            border: "1px solid #C8A84B",
            borderRadius: "4px",
            padding: "16px 20px",
            margin: "20px 0",
          }}
        >
          <p style={{ margin: "0 0 8px 0", color: "#374151" }}>
            <strong>Employee No.:</strong> {employeeNo}
          </p>
          <p style={{ margin: "0 0 8px 0", color: "#374151" }}>
            <strong>Coverage Year:</strong> {coverageYear}
          </p>
          <p style={{ margin: "0", color: color, fontWeight: "700" }}>
            <strong>Filing Deadline:</strong> {deadlineFormatted}
            {daysRemaining >= 0
              ? ` (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining)`
              : ` (${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} overdue)`}
          </p>
        </div>

        <p
          style={{ color: "#374151", margin: "0 0 24px 0", lineHeight: "1.6" }}
        >
          Please log in to the PCSO HRIS portal and complete your SALN filing at
          your earliest convenience. Non-filing is a violation of RA 6713 and
          may result in administrative sanctions.
        </p>

        {/* CTA button */}
        <div style={{ textAlign: "center", margin: "24px 0" }}>
          <a
            href={filingUrl}
            style={{
              backgroundColor: "#0B2545",
              color: "#ffffff",
              padding: "12px 28px",
              textDecoration: "none",
              borderRadius: "4px",
              fontWeight: "700",
              fontSize: "14px",
              display: "inline-block",
            }}
          >
            File My SALN Now
          </a>
        </div>

        <p
          style={{
            color: "#6b7280",
            fontSize: "13px",
            margin: "24px 0 0 0",
            lineHeight: "1.5",
          }}
        >
          If you have already filed your SALN through another channel, please
          ensure your submission is recorded in the HRIS system by contacting
          the HRMO. For technical assistance, reply to this email or contact the
          IT Division.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#f9fafb",
          borderTop: "1px solid #e5e7eb",
          padding: "16px 32px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#9ca3af", fontSize: "11px", margin: "0" }}>
          This is an automated message from the PCSO HRIS. Do not reply directly
          to this email.
          <br />
          Human Resource Management Office · Philippine Charity Sweepstakes
          Office · Pasay City, Metro Manila
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plain text fallback
// ---------------------------------------------------------------------------

export function salnReminderPlainText({
  employeeName,
  employeeNo,
  coverageYear,
  deadlineFormatted,
  appUrl,
  daysRemaining,
}: SalnReminderEmailProps): string {
  const status =
    daysRemaining >= 0
      ? `${daysRemaining} day(s) remaining`
      : `${Math.abs(daysRemaining)} day(s) overdue`;

  return [
    `Dear ${employeeName},`,
    "",
    `This is an official notice from the PCSO HRMO regarding your SALN filing`,
    `obligation under Republic Act No. 6713.`,
    "",
    `SALN FILING DETAILS`,
    `-------------------`,
    `Employee No.: ${employeeNo}`,
    `Coverage Year: ${coverageYear}`,
    `Deadline: ${deadlineFormatted} (${status})`,
    "",
    `Please file your SALN at: ${appUrl}/saln/new`,
    "",
    `Non-filing is a violation of RA 6713 and may result in administrative sanctions.`,
    "",
    `Human Resource Management Office`,
    `Philippine Charity Sweepstakes Office`,
  ].join("\n");
}
