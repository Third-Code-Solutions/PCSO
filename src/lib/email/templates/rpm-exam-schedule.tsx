/**
 * Email template — N-026 RPM exam/interview schedule notification.
 * Sent to a qualified applicant when they're scheduled for an assessment.
 */

import * as React from "react";

export interface RpmExamScheduleEmailProps {
  applicantName: string;
  positionTitle: string;
  assessmentType:
    | "written_exam"
    | "panel_interview"
    | "technical_exam"
    | "demonstration";
  /** ISO datetime string. */
  scheduledAt: string;
  venue: string;
  /** Applicant portal status URL. */
  statusUrl: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export function RpmExamScheduleEmail(
  props: RpmExamScheduleEmailProps,
): React.ReactElement {
  const label: Record<RpmExamScheduleEmailProps["assessmentType"], string> = {
    written_exam: "Written Examination",
    panel_interview: "Panel Interview",
    technical_exam: "Technical Examination",
    demonstration: "Demonstration",
  };
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Assessment Schedule</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>
          Assessment Schedule — {props.positionTitle}
        </h1>
        <p>Dear {props.applicantName},</p>
        <p>
          You have been scheduled for a{" "}
          <strong>{label[props.assessmentType]}</strong>.
        </p>
        <ul>
          <li>
            <strong>Date & Time:</strong> {formatDate(props.scheduledAt)}
          </li>
          <li>
            <strong>Venue:</strong> {props.venue}
          </li>
        </ul>
        <p>
          <a href={props.statusUrl} style={{ color: "#0B2545" }}>
            View application status
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default RpmExamScheduleEmail;
