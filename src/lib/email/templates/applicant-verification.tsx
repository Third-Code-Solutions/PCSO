/**
 * Email template — applicant portal email verification.
 * Sent right after registration (RPM-006); the applicant must open the link
 * before they can sign in.
 */

import * as React from "react";

export interface ApplicantVerificationEmailProps {
  /** First name of the newly registered applicant. */
  firstName: string;
  /** Absolute verification URL (contains the one-time token). */
  verifyUrl: string;
  /** Hours until the verification token expires. */
  expiresInHours: number;
}

export function ApplicantVerificationEmail({
  firstName,
  verifyUrl,
  expiresInHours,
}: ApplicantVerificationEmailProps): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Verify your email</title>
      </head>
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
        <h1 style={{ color: "#0B2545" }}>Verify your email address</h1>
        <p>Dear {firstName},</p>
        <p>
          Thank you for registering with the PCSO applicant portal. Please
          confirm your email address to activate your account:
        </p>
        <p>
          <a
            href={verifyUrl}
            style={{
              backgroundColor: "#0B2545",
              borderRadius: 6,
              color: "#FAF4E6",
              display: "inline-block",
              fontWeight: 600,
              padding: "12px 24px",
              textDecoration: "none",
            }}
          >
            Verify my email
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          Or copy this link:{" "}
          <a href={verifyUrl} style={{ color: "#0B2545", wordBreak: "break-all" }}>
            {verifyUrl}
          </a>
        </p>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          This link expires in {expiresInHours} hours. If you did not create
          this account, you can ignore this email.
        </p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          PCSO HRIS — automated message.
        </p>
      </body>
    </html>
  );
}

export function applicantVerificationPlainText({
  firstName,
  verifyUrl,
  expiresInHours,
}: ApplicantVerificationEmailProps): string {
  return [
    `Dear ${firstName},`,
    "",
    "Thank you for registering with the PCSO applicant portal.",
    "Please confirm your email address to activate your account:",
    "",
    verifyUrl,
    "",
    `This link expires in ${expiresInHours} hours. If you did not create this account, you can ignore this email.`,
    "",
    "---",
    "PCSO HRIS — automated message.",
  ].join("\n");
}

export default ApplicantVerificationEmail;
