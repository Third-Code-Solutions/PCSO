/**
 * Email template — N-037 / TOR 3.4.1 security event alert.
 * Sent to Super Admins when the hourly security scan detects anomalies.
 */

import * as React from "react";

export interface SecurityAlertFinding {
  /** Category: 'failed_login_burst' | 'off_hours_admin_write' | 'unusual_export_volume' */
  category: string;
  /** One-line human-readable summary of the finding. */
  summary: string;
  /** Supporting detail (counts, actor, window). Never raw PII. */
  detail: string;
}

export interface SecurityAlertEmailProps {
  findings: SecurityAlertFinding[];
  /** Human-readable scan window, e.g. "last 70 minutes". */
  windowLabel: string;
  /** ISO timestamp of the scan run. */
  generatedAt: string;
  auditLogUrl: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  failed_login_burst: "Failed-action burst",
  off_hours_admin_write: "Off-hours admin write",
  unusual_export_volume: "Unusual export volume",
};

export function SecurityAlertEmail(
  props: SecurityAlertEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Security alert</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#B91C1C" }}>PCSO HRIS — security alert</h1>
        <p>
          The automated security scan ({props.windowLabel}) flagged{" "}
          <strong>{props.findings.length}</strong> event
          {props.findings.length === 1 ? "" : "s"} requiring review:
        </p>
        <ul>
          {props.findings.map((finding, index) => (
            <li key={index} style={{ marginBottom: 12 }}>
              <strong>
                {CATEGORY_LABELS[finding.category] ?? finding.category}:
              </strong>{" "}
              {finding.summary}
              <br />
              <span style={{ color: "#6b7280", fontSize: 13 }}>
                {finding.detail}
              </span>
            </li>
          ))}
        </ul>
        <p>
          <a href={props.auditLogUrl} style={{ color: "#0B2545" }}>
            Review the audit log
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          Generated {props.generatedAt}. PCSO HRIS — automated security
          monitoring (TOR 3.4.1 / N-037).
        </p>
      </body>
    </html>
  );
}

/** Plain-text fallback body (kept in sync with the React template). */
export function securityAlertPlainText(props: SecurityAlertEmailProps): string {
  const lines = props.findings.map(
    (f) =>
      `- ${CATEGORY_LABELS[f.category] ?? f.category}: ${f.summary} (${f.detail})`,
  );
  return [
    `PCSO HRIS security alert — ${props.findings.length} event(s) in ${props.windowLabel}:`,
    ...lines,
    ``,
    `Review: ${props.auditLogUrl}`,
    `Generated ${props.generatedAt}.`,
  ].join("\n");
}
