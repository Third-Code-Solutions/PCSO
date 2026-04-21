/**
 * Email template — N-028 Training assignment.
 * Sent to an employee when they are confirmed as a participant for a run.
 */

import * as React from "react";

export interface TrainingAssignedEmailProps {
  employeeName: string;
  programTitle: string;
  /** TRUN-YYYY-NNNNNN run number. */
  runNumber: string;
  /** ISO date strings. */
  startDate: string;
  endDate: string;
  venue: string;
  scheduleUrl: string;
}

function d(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function TrainingAssignedEmail(
  props: TrainingAssignedEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Training Confirmed</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>You are confirmed for a training</h1>
        <p>Dear {props.employeeName},</p>
        <p>
          You are confirmed as a participant for{" "}
          <strong>{props.programTitle}</strong> ({props.runNumber}).
        </p>
        <ul>
          <li>
            <strong>When:</strong> {d(props.startDate)} – {d(props.endDate)}
          </li>
          <li>
            <strong>Where:</strong> {props.venue}
          </li>
        </ul>
        <p>
          <a href={props.scheduleUrl} style={{ color: "#0B2545" }}>
            View schedule
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default TrainingAssignedEmail;
