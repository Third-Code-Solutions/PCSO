/**
 * Email template — N-029 Training run approval pending.
 * Sent to the next approver in the chain (HRD Manager, then AGM).
 */

import * as React from "react";

export interface TrainingApprovalEmailProps {
  approverName: string;
  approverRole: string;
  programTitle: string;
  runNumber: string;
  totalBudget: string;
  actionUrl: string;
}

export function TrainingApprovalEmail(
  props: TrainingApprovalEmailProps,
): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Training run awaiting approval</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>Training run needs your approval</h1>
        <p>Dear {props.approverName},</p>
        <p>
          Run <strong>{props.runNumber}</strong> ({props.programTitle}) is
          awaiting your <strong>{props.approverRole}</strong> decision.
        </p>
        <p>
          <strong>Total proposed budget:</strong> PHP {props.totalBudget}
        </p>
        <p>
          <a href={props.actionUrl} style={{ color: "#0B2545" }}>
            Review run
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export default TrainingApprovalEmail;
