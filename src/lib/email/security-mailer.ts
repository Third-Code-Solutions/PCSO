import "server-only";

/**
 * Security-alert email dispatch — TOR 3.4.1 / 3.6.8 / N-037.
 *
 * Mirrors the applicant-mailer Resend pattern: sending is best-effort and
 * NEVER throws. Callers record delivery failures in the transaction log
 * without rolling back the alert (the in-app notification is the primary
 * channel; email is secondary).
 */

import * as React from "react";
import { Resend } from "resend";
import { env } from "@/lib/env";
import {
  SecurityAlertEmail,
  securityAlertPlainText,
  type SecurityAlertEmailProps,
} from "./templates/security-alert";

const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";

export type SecurityEmailResult =
  | { sent: true }
  | { sent: false; reason: string };

/**
 * Sends one security-alert email to the given Super Admin recipients.
 * Returns `{ sent: false }` (never throws) when RESEND_API_KEY is absent
 * (dev/test) or delivery fails.
 */
export async function sendSecurityAlertEmail(
  to: string[],
  props: SecurityAlertEmailProps,
): Promise<SecurityEmailResult> {
  if (to.length === 0) {
    return { sent: false, reason: "No recipients" };
  }
  if (!env.RESEND_API_KEY) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `PCSO HRIS Security <${FROM_EMAIL}>`,
      to,
      subject: `[Security Alert] ${props.findings.length} flagged event${props.findings.length === 1 ? "" : "s"} — PCSO HRIS`,
      react: React.createElement(SecurityAlertEmail, props),
      text: securityAlertPlainText(props),
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
