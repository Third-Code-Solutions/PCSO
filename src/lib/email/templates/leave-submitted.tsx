/**
 * Email template — Leave Application Submitted
 * Sent to the approver when an employee submits a new leave application.
 *
 * Uses Resend's React email renderer.
 */

import * as React from 'react';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveSubmittedEmailProps {
  /** Full name of the employee who applied. */
  applicantName: string;
  /** Employee number of the applicant. */
  employeeNo: string;
  /** Leave type code (e.g., 'VL', 'SL'). */
  leaveTypeCode: LeaveTypeCode;
  /** ISO 8601 date string — start of leave. */
  startDate: string;
  /** ISO 8601 date string — end of leave. */
  endDate: string;
  /** Number of working days applied for. */
  workingDays: number;
  /** Optional reason provided by the employee. */
  reason: string | null;
  /** UUID of the leave application — used to build the approval link. */
  leaveApplicationId: string;
  /** Full name of the approver receiving this email. */
  approverName: string;
  /** Base URL of the application (e.g., https://hris.senate.gov.ph). */
  appUrl: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * React email component for new leave application notifications.
 * Rendered server-side by Resend before delivery.
 */
export function LeaveSubmittedEmail({
  applicantName,
  employeeNo,
  leaveTypeCode,
  startDate,
  endDate,
  workingDays,
  reason,
  leaveApplicationId,
  approverName,
  appUrl,
}: LeaveSubmittedEmailProps): React.ReactElement {
  const leaveTypeName = LEAVE_TYPES[leaveTypeCode]?.name ?? leaveTypeCode;
  const approvalUrl = `${appUrl}/leave/approvals/${leaveApplicationId}`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Leave Application — Action Required</title>
      </head>
      <body
        style={{
          backgroundColor: '#f8f5ee',
          fontFamily: "'Inter', Arial, sans-serif",
          margin: 0,
          padding: '24px',
        }}
      >
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ maxWidth: '600px', margin: '0 auto' }}
        >
          {/* Header */}
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: '#0B2545',
                  borderRadius: '8px 8px 0 0',
                  padding: '24px 32px',
                }}
              >
                <p
                  style={{
                    color: '#C8A84B',
                    fontSize: '11px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    margin: '0 0 4px',
                  }}
                >
                  Senate of the Philippines
                </p>
                <h1
                  style={{
                    color: '#FAF4E6',
                    fontSize: '20px',
                    fontWeight: 600,
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Leave Application Requires Your Action
                </h1>
              </td>
            </tr>

            {/* Body */}
            <tr>
              <td
                style={{
                  backgroundColor: '#ffffff',
                  padding: '32px',
                  borderLeft: '1px solid #e5e7eb',
                  borderRight: '1px solid #e5e7eb',
                }}
              >
                <p style={{ margin: '0 0 20px', color: '#374151', fontSize: '15px' }}>
                  Dear <strong>{approverName}</strong>,
                </p>
                <p style={{ margin: '0 0 24px', color: '#374151', fontSize: '15px' }}>
                  A leave application has been submitted and is pending your review.
                </p>

                {/* Application Details Card */}
                <table
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '24px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: '20px' }}>
                        <h2
                          style={{
                            color: '#0B2545',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            margin: '0 0 16px',
                          }}
                        >
                          Application Details
                        </h2>

                        {[
                          ['Employee', `${applicantName} (${employeeNo})`],
                          ['Leave Type', leaveTypeName],
                          ['Date From', formatDate(startDate)],
                          ['Date To', formatDate(endDate)],
                          ['Working Days', String(workingDays)],
                          ...(reason ? [['Reason', reason]] : []),
                        ].map(([label, value]) => (
                          <table
                            key={label}
                            width="100%"
                            cellPadding={0}
                            cellSpacing={0}
                            style={{ marginBottom: '12px' }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  style={{
                                    color: '#6b7280',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    width: '130px',
                                    verticalAlign: 'top',
                                    paddingTop: '2px',
                                  }}
                                >
                                  {label}
                                </td>
                                <td
                                  style={{
                                    color: '#111827',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                  }}
                                >
                                  {value}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* CTA */}
                <table width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: '24px' }}>
                        <a
                          href={approvalUrl}
                          style={{
                            backgroundColor: '#0B2545',
                            borderRadius: '6px',
                            color: '#FAF4E6',
                            display: 'inline-block',
                            fontSize: '14px',
                            fontWeight: 600,
                            padding: '12px 24px',
                            textDecoration: 'none',
                          }}
                        >
                          Review Application
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
                  Or copy this link:{' '}
                  <a
                    href={approvalUrl}
                    style={{ color: '#0B2545', wordBreak: 'break-all' }}
                  >
                    {approvalUrl}
                  </a>
                </p>
              </td>
            </tr>

            {/* Footer */}
            <tr>
              <td
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: '0 0 8px 8px',
                  borderLeft: '1px solid #e5e7eb',
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  padding: '16px 32px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    color: '#9ca3af',
                    fontSize: '12px',
                    margin: 0,
                  }}
                >
                  This is an automated message from the Senate HRIS. Do not reply to this email.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

// ---------------------------------------------------------------------------
// Plain-text fallback
// ---------------------------------------------------------------------------

export function leaveSubmittedPlainText({
  applicantName,
  employeeNo,
  leaveTypeCode,
  startDate,
  endDate,
  workingDays,
  reason,
  approverName,
  appUrl,
  leaveApplicationId,
}: LeaveSubmittedEmailProps): string {
  const leaveTypeName = LEAVE_TYPES[leaveTypeCode]?.name ?? leaveTypeCode;
  const approvalUrl = `${appUrl}/leave/approvals/${leaveApplicationId}`;

  return [
    `Dear ${approverName},`,
    '',
    'A leave application has been submitted and requires your review.',
    '',
    `Employee:      ${applicantName} (${employeeNo})`,
    `Leave Type:    ${leaveTypeName}`,
    `Date From:     ${formatDate(startDate)}`,
    `Date To:       ${formatDate(endDate)}`,
    `Working Days:  ${workingDays}`,
    ...(reason ? [`Reason:        ${reason}`] : []),
    '',
    `Review the application here: ${approvalUrl}`,
    '',
    '---',
    'This is an automated message from the Senate HRIS.',
  ].join('\n');
}
