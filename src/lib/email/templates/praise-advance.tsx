/**
 * Email template — N-032 PRAISE advance notice.
 * Sent to the PRAISE committee chair in advance of a scheduled awards event.
 */

import * as React from "react";

export interface PraiseAdvanceEmailProps {
  recipientName: string;
  /** Human event name (e.g., "Q2 Service Excellence Awards"). */
  eventName: string;
  /** ISO date for the event. */
  eventDate: string;
  praiseDashboardUrl: string;
}

function dateFmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function PraiseAdvanceEmail(
  props: PraiseAdvanceEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>PRAISE advance notice</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>PRAISE — advance advisory</h1>
        <p>Dear {props.recipientName},</p>
        <p>
          Please begin coordinating for <strong>{props.eventName}</strong>{" "}
          scheduled on <strong>{dateFmt(props.eventDate)}</strong>.
        </p>
        <p>
          <a href={props.praiseDashboardUrl} style={{ color: "#0B2545" }}>
            Open PRAISE dashboard
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default PraiseAdvanceEmail;
