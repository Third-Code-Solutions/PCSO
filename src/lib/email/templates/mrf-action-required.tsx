/**
 * Email template — N-025 Manpower Request Form (MRF) action required.
 * Sent to HR Admin / approver when a Dept Head submits an MRF for review.
 */

import * as React from "react";

export interface MrfActionRequiredEmailProps {
  /** Full name of the recipient (HR Admin / approver). */
  recipientName: string;
  /** Dept Head that filed the MRF. */
  requesterName: string;
  /** MRF-YYYY-NNNNNN serial. */
  mrfNumber: string;
  /** Requested position title. */
  positionTitle: string;
  /** Number of vacancies being requested. */
  vacancyCount: number;
  /** UUID of the MRF record — used in the action URL. */
  mrfId: string;
  /** Base URL of the application (e.g., https://hris.pcso.gov.ph). */
  appUrl: string;
}

export function MrfActionRequiredEmail(
  props: MrfActionRequiredEmailProps,
): React.ReactElement {
  const actionUrl = `${props.appUrl}/recruitment/mrf/${props.mrfId}`;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>MRF awaiting your action</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>Manpower Request — Action Required</h1>
        <p>Dear {props.recipientName},</p>
        <p>
          {props.requesterName} has submitted MRF{" "}
          <strong>{props.mrfNumber}</strong> for{" "}
          <strong>{props.vacancyCount}</strong>{" "}
          <strong>{props.positionTitle}</strong> vacancy(ies).
        </p>
        <p>
          <a href={actionUrl} style={{ color: "#0B2545" }}>
            Open request
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message. Do not reply.
        </p>
      </body>
    </html>
  );
}

export default MrfActionRequiredEmail;
