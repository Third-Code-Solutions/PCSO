/**
 * Payslip email template — HTML email with payslip summary.
 * Sent via Resend with the PDF payslip as an attachment.
 */
import React from 'react';
import type { PayrollRecord, PayrollPeriod } from '@/lib/db/schema';

interface PayslipEmailTemplateProps {
  employeeName: string;
  period: PayrollPeriod;
  record: PayrollRecord;
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return '₱0.00';
  const num = parseFloat(value);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * React component compatible with Resend's `react` parameter.
 * The PDF payslip is attached separately as `attachments` in the Resend API call.
 */
export function PayslipEmailTemplate({
  employeeName,
  period,
  record,
}: PayslipEmailTemplateProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Payslip — {period.name}</title>
      </head>
      <body
        style={{
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: 0,
          backgroundColor: '#F3F4F6',
        }}
      >
        <table
          cellPadding={0}
          cellSpacing={0}
          width="100%"
          style={{ maxWidth: 600, margin: '32px auto' }}
        >
          {/* Header */}
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: '#0B2545',
                  padding: '24px 32px',
                  borderRadius: '8px 8px 0 0',
                }}
              >
                <p
                  style={{
                    color: '#C8A84B',
                    margin: 0,
                    fontSize: 12,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Senate of the Philippines
                </p>
                <p
                  style={{
                    color: '#FFFFFF',
                    margin: '4px 0 0',
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  Your Payslip is Ready
                </p>
              </td>
            </tr>

            {/* Body */}
            <tr>
              <td
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '28px 32px',
                }}
              >
                <p style={{ color: '#374151', fontSize: 15, margin: '0 0 16px' }}>
                  Dear <strong>{employeeName}</strong>,
                </p>
                <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
                  Your payslip for <strong>{period.name}</strong> is attached to this email.
                  Please review the details below.
                </p>

                {/* Summary Card */}
                <table
                  cellPadding={0}
                  cellSpacing={0}
                  width="100%"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                    marginBottom: 24,
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          backgroundColor: '#F9FAFB',
                          padding: '10px 16px',
                          borderBottom: '1px solid #E5E7EB',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#0B2545',
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          Pay Summary
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#6B7280',
                          fontSize: 13,
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        Period
                      </td>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#111827',
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: 'right',
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        {period.name}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#6B7280',
                          fontSize: 13,
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        Pay Date
                      </td>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#111827',
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: 'right',
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        {formatDate(period.payDate)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#6B7280',
                          fontSize: 13,
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        Gross Pay
                      </td>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#111827',
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: 'right',
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        {formatPeso(record.grossPay)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#6B7280',
                          fontSize: 13,
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        Total Deductions
                      </td>
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#DC2626',
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: 'right',
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        ({formatPeso(record.totalDeductions)})
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#0B2545',
                          color: '#C8A84B',
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        NET PAY
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#0B2545',
                          color: '#FFFFFF',
                          fontSize: 16,
                          fontWeight: 700,
                          textAlign: 'right',
                        }}
                      >
                        {formatPeso(record.netPay)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ color: '#9CA3AF', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                  The official payslip PDF is attached. Please keep it for your records.
                  For questions, contact the Financial Services Department.
                </p>
              </td>
            </tr>

            {/* Footer */}
            <tr>
              <td
                style={{
                  backgroundColor: '#F9FAFB',
                  padding: '16px 32px',
                  borderTop: '1px solid #E5E7EB',
                  borderRadius: '0 0 8px 8px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: '#9CA3AF', fontSize: 11, margin: 0, fontStyle: 'italic' }}>
                  This is a system-generated email from Senate HRIS. Do not reply to this message.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
