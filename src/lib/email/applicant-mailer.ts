import "server-only";

/**
 * Applicant-facing email dispatch helper (RPM notifications N-026 / N-027,
 * TOR 1.2.15 / 1.2.16 / 1.2.18 / 1.2.20 / 1.2.24).
 *
 * Wraps the same Resend pattern used by the document-request and leave
 * modules so RPM server actions never hand-roll SMTP. Sending is always
 * best-effort: this helper NEVER throws — callers receive a discriminated
 * result and are expected to audit-log failures (severity: warn) without
 * rolling back the primary mutation.
 */

import type * as React from "react";
import { Resend } from "resend";

import { env } from "@/lib/env";

const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";

export type ApplicantEmailResult =
  | { sent: true }
  | { sent: false; reason: string };

export interface ApplicantEmailInput {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Plain-text fallback body. */
  text: string;
}

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

/**
 * Send one transactional email to an applicant. Returns `{ sent: false }`
 * (never throws) when the API key is absent (dev/test) or delivery fails.
 */
export async function sendApplicantEmail(
  input: ApplicantEmailInput,
): Promise<ApplicantEmailResult> {
  const resend = getResend();
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: `PCSO HRIS <${FROM_EMAIL}>`,
      to: input.to,
      subject: input.subject,
      react: input.react,
      text: input.text,
    });
    if (error) {
      return { sent: false, reason: error.message ?? "Resend delivery error" };
    }
    return { sent: true };
  } catch (err: unknown) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

/** Applicant-portal deep link for a single application. */
export function applicantStatusUrl(applicationId: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/applicant/applications/${applicationId}`;
}

// Shared outcome mapping + plain-text builders live in a pure module (no
// server-only import) so they remain unit-testable; re-exported here to keep
// a single import surface for the RPM server actions.
export {
  applicationResultPlainText,
  examSchedulePlainText,
  mapStatusToResultOutcome,
  type ApplicationResultOutcome,
} from "./applicant-mailer-content";
