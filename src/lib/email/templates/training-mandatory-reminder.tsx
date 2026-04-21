/**
 * Email template — N-030 Mandatory training reminder.
 * Sent to employees whose mandatory training compliance is overdue or at risk.
 */

import * as React from "react";

export interface TrainingMandatoryReminderEmailProps {
  employeeName: string;
  missingPrograms: ReadonlyArray<{
    code: string;
    title: string;
    dueBy?: string;
  }>;
  catalogUrl: string;
}

export function TrainingMandatoryReminderEmail(
  props: TrainingMandatoryReminderEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Mandatory training reminder</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>Outstanding mandatory training</h1>
        <p>Dear {props.employeeName},</p>
        <p>
          Please complete the following mandatory training{" "}
          {props.missingPrograms.length === 1 ? "course" : "courses"} at the
          earliest opportunity:
        </p>
        <ul>
          {props.missingPrograms.map((p) => (
            <li key={p.code}>
              <strong>{p.code}</strong> — {p.title}
              {p.dueBy ? ` (due ${p.dueBy})` : ""}
            </li>
          ))}
        </ul>
        <p>
          <a href={props.catalogUrl} style={{ color: "#0B2545" }}>
            Open L&D catalog
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default TrainingMandatoryReminderEmail;
