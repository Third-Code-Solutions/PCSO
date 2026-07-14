/**
 * Pure content helpers for applicant-facing RPM emails — outcome mapping and
 * plain-text fallbacks (TOR 1.2.15 / 1.2.16 / 1.2.18 / 1.2.24).
 *
 * No imports and no server dependencies so these stay unit-testable in
 * isolation (same split as `src/lib/audit/diff.ts`). Dispatch lives in
 * `applicant-mailer.ts`, which re-exports this module.
 */

export type ApplicationResultOutcome =
  | "appointed"
  | "shortlisted"
  | "not_selected"
  | "withdrawn";

/**
 * Map an `applications.status` value onto the four outcome headlines of the
 * rpm-application-result template. Unknown / in-flight statuses fall back to
 * "not_selected", whose headline is the neutral "Application Update".
 */
export function mapStatusToResultOutcome(
  status: string,
): ApplicationResultOutcome {
  switch (status) {
    case "appointed":
      return "appointed";
    case "shortlisted":
    case "for_interview":
      return "shortlisted";
    case "withdrawn":
      return "withdrawn";
    default:
      return "not_selected";
  }
}

export function applicationResultPlainText(params: {
  applicantName: string;
  positionTitle: string;
  remarks?: string | null;
  statusUrl: string;
}): string {
  return [
    `Dear ${params.applicantName},`,
    "",
    `This is an update regarding your application for ${params.positionTitle}.`,
    ...(params.remarks ? ["", params.remarks] : []),
    "",
    `View your application: ${params.statusUrl}`,
    "",
    "---",
    "PCSO HRIS - automated message.",
  ].join("\n");
}

export function examSchedulePlainText(params: {
  applicantName: string;
  positionTitle: string;
  assessmentLabel: string;
  scheduledAt: string;
  venue: string;
  statusUrl: string;
}): string {
  return [
    `Dear ${params.applicantName},`,
    "",
    `You have been scheduled for a ${params.assessmentLabel} for the position of ${params.positionTitle}.`,
    "",
    `Date & Time: ${new Date(params.scheduledAt).toLocaleString("en-PH", {
      dateStyle: "full",
      timeStyle: "short",
    })}`,
    `Venue: ${params.venue}`,
    "",
    `View your application status: ${params.statusUrl}`,
    "",
    "---",
    "PCSO HRIS - automated message.",
  ].join("\n");
}
