/**
 * Email template — N-027 RPM application result.
 * Sent to an applicant when their application outcome is decided.
 */

import * as React from "react";

export interface RpmApplicationResultEmailProps {
  applicantName: string;
  positionTitle: string;
  outcome: "appointed" | "shortlisted" | "not_selected" | "withdrawn";
  /** Optional message from HR / chair of BoD. */
  remarks?: string;
  statusUrl: string;
}

const HEADLINE: Record<RpmApplicationResultEmailProps["outcome"], string> = {
  appointed: "Congratulations — Appointment Confirmed",
  shortlisted: "You have been shortlisted",
  not_selected: "Application Update",
  withdrawn: "Application Withdrawn",
};

export function RpmApplicationResultEmail(
  props: RpmApplicationResultEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{HEADLINE[props.outcome]}</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>{HEADLINE[props.outcome]}</h1>
        <p>Dear {props.applicantName},</p>
        <p>
          This is an update regarding your application for{" "}
          <strong>{props.positionTitle}</strong>.
        </p>
        {props.remarks ? (
          <blockquote style={{ color: "#374151" }}>{props.remarks}</blockquote>
        ) : null}
        <p>
          <a href={props.statusUrl} style={{ color: "#0B2545" }}>
            View application
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default RpmApplicationResultEmail;
