/**
 * Email template — N-031 Retirement annual notice.
 * Sent 12, 6, and 3 months before projected retirement date.
 */

import * as React from "react";

export interface RetirementAnnualEmailProps {
  employeeName: string;
  /** Computed retirement date in ISO format. */
  retirementDate: string;
  /** Months-until-retirement the notice represents (12 | 6 | 3). */
  monthsOut: 12 | 6 | 3;
  dashboardUrl: string;
}

function dateFmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function RetirementAnnualEmail(
  props: RetirementAnnualEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Retirement notice</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>
          Retirement — {props.monthsOut}-month advisory
        </h1>
        <p>Dear {props.employeeName},</p>
        <p>
          Your projected retirement date is{" "}
          <strong>{dateFmt(props.retirementDate)}</strong>. Please
          begin/continue your pre-retirement preparations with HR.
        </p>
        <p>
          <a href={props.dashboardUrl} style={{ color: "#0B2545" }}>
            View retirement dashboard
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default RetirementAnnualEmail;
