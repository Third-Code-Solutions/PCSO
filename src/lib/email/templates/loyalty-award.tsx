/**
 * Email template — N-033 Loyalty award notice.
 * Sent to an employee when they qualify for a loyalty milestone (5/10/15/20/25/30 yrs).
 */

import * as React from "react";

export interface LoyaltyAwardEmailProps {
  employeeName: string;
  /** Years-of-service milestone reached. */
  milestoneYears: number;
  /** ISO date when the milestone vested. */
  vestedOn: string;
  /** Cash/gift entitlement summary (already formatted). */
  entitlementSummary: string;
  loyaltyDashboardUrl: string;
}

function dateFmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LoyaltyAwardEmail(
  props: LoyaltyAwardEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Loyalty award — {props.milestoneYears} years</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>
          Loyalty Award — {props.milestoneYears} years of service
        </h1>
        <p>Dear {props.employeeName},</p>
        <p>
          Congratulations! You have reached{" "}
          <strong>{props.milestoneYears} years</strong> of service as of{" "}
          <strong>{dateFmt(props.vestedOn)}</strong>.
        </p>
        <p>
          <strong>Entitlement:</strong> {props.entitlementSummary}
        </p>
        <p>
          <a href={props.loyaltyDashboardUrl} style={{ color: "#0B2545" }}>
            View details
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default LoyaltyAwardEmail;
