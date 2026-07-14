/**
 * Email template — RPM interview schedule notification (TOR 1.2.20).
 * Sent to an applicant when HRD assigns them to an interview batch, and again
 * (variant "cancelled") when a scheduled interview is called off.
 *
 * Structure mirrors rpm-exam-schedule.tsx (N-026).
 */

import * as React from "react";

export interface RpmInterviewScheduleEmailProps {
  applicantName: string;
  positionTitle: string;
  /** ISO datetime string. */
  scheduledAt: string;
  venue: string;
  mode: "in_person" | "online" | "phone";
  /** Free-text panel composition (optional). */
  panel?: string | null;
  /** Extra instructions for the applicant (optional). */
  notes?: string | null;
  variant: "scheduled" | "cancelled";
  /** Applicant portal status URL. */
  statusUrl: string;
}

const MODE_LABEL: Record<RpmInterviewScheduleEmailProps["mode"], string> = {
  in_person: "In person",
  online: "Online (video call)",
  phone: "Phone call",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export function RpmInterviewScheduleEmail(
  props: RpmInterviewScheduleEmailProps,
): React.ReactElement {
  const isCancelled = props.variant === "cancelled";
  const headline = isCancelled
    ? `Interview Cancelled — ${props.positionTitle}`
    : `Interview Schedule — ${props.positionTitle}`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{headline}</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>{headline}</h1>
        <p>Dear {props.applicantName},</p>
        {isCancelled ? (
          <p>
            The interview below has been <strong>cancelled</strong>. PCSO HRD
            will notify you if it is re-scheduled.
          </p>
        ) : (
          <p>
            You have been scheduled for an <strong>interview</strong>.
          </p>
        )}
        <ul>
          <li>
            <strong>Date &amp; Time:</strong> {formatDate(props.scheduledAt)}
          </li>
          <li>
            <strong>Venue:</strong> {props.venue}
          </li>
          <li>
            <strong>Mode:</strong> {MODE_LABEL[props.mode]}
          </li>
          {props.panel ? (
            <li>
              <strong>Panel:</strong> {props.panel}
            </li>
          ) : null}
          {props.notes ? (
            <li>
              <strong>Notes:</strong> {props.notes}
            </li>
          ) : null}
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

export function rpmInterviewSchedulePlainText(
  props: RpmInterviewScheduleEmailProps,
): string {
  const isCancelled = props.variant === "cancelled";
  return [
    `Dear ${props.applicantName},`,
    "",
    isCancelled
      ? `The interview below for ${props.positionTitle} has been CANCELLED. PCSO HRD will notify you if it is re-scheduled.`
      : `You have been scheduled for an interview for the position of ${props.positionTitle}.`,
    "",
    `Date & Time: ${formatDate(props.scheduledAt)}`,
    `Venue: ${props.venue}`,
    `Mode: ${MODE_LABEL[props.mode]}`,
    ...(props.panel ? [`Panel: ${props.panel}`] : []),
    ...(props.notes ? [`Notes: ${props.notes}`] : []),
    "",
    `View your application status: ${props.statusUrl}`,
    "",
    "---",
    "PCSO HRIS - automated message.",
  ].join("\n");
}

export default RpmInterviewScheduleEmail;
