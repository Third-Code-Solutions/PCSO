/// <reference types="vitest/globals" />
/**
 * Unit tests for the pure content helpers of the applicant mailer (RPM
 * notifications TOR 1.2.15 / 1.2.16 / 1.2.18 / 1.2.24).
 *
 * `sendApplicantEmail()` itself wraps Resend behind `server-only` and is
 * exercised only through integration flows; here we cover the outcome
 * mapping and the plain-text fallbacks, which carry the notification policy.
 */

import {
  applicationResultPlainText,
  examSchedulePlainText,
  mapStatusToResultOutcome,
} from "./applicant-mailer-content";

// ─── mapStatusToResultOutcome ────────────────────────────────────────────────

describe("mapStatusToResultOutcome", () => {
  it("maps appointed to the appointed headline", () => {
    expect(mapStatusToResultOutcome("appointed")).toBe("appointed");
  });

  it("maps results_released (Board-confirmed selection) to appointed", () => {
    expect(mapStatusToResultOutcome("results_released")).toBe("appointed");
  });

  it("maps not_selected to not_selected", () => {
    expect(mapStatusToResultOutcome("not_selected")).toBe("not_selected");
  });

  it("maps shortlisted and for_interview to shortlisted", () => {
    expect(mapStatusToResultOutcome("shortlisted")).toBe("shortlisted");
    expect(mapStatusToResultOutcome("for_interview")).toBe("shortlisted");
  });

  it("maps withdrawn to withdrawn", () => {
    expect(mapStatusToResultOutcome("withdrawn")).toBe("withdrawn");
  });

  it("falls back to the neutral not_selected headline for in-flight statuses", () => {
    for (const status of [
      "qualified",
      "not_qualified",
      "under_review",
      "submitted",
      "totally-unknown-status",
    ]) {
      expect(mapStatusToResultOutcome(status)).toBe("not_selected");
    }
  });
});

// ─── plain-text builders ─────────────────────────────────────────────────────

describe("applicationResultPlainText", () => {
  it("includes the applicant name, position, remarks, and status URL", () => {
    const text = applicationResultPlainText({
      applicantName: "Juan dela Cruz",
      positionTitle: "Administrative Officer II",
      remarks: "Reason for disqualification: incomplete transcript",
      statusUrl: "https://hris.example/applicant/applications/abc",
    });
    expect(text).toContain("Dear Juan dela Cruz,");
    expect(text).toContain("Administrative Officer II");
    expect(text).toContain(
      "Reason for disqualification: incomplete transcript",
    );
    expect(text).toContain("https://hris.example/applicant/applications/abc");
  });

  it("omits the remarks block when none are provided", () => {
    const text = applicationResultPlainText({
      applicantName: "Juan",
      positionTitle: "Clerk III",
      statusUrl: "https://x/y",
    });
    expect(text).not.toContain("Reason");
    expect(text).toContain("Clerk III");
  });
});

describe("examSchedulePlainText", () => {
  it("includes the schedule details and venue", () => {
    const text = examSchedulePlainText({
      applicantName: "Maria Clara",
      positionTitle: "Accountant I",
      assessmentLabel: "Written Examination",
      scheduledAt: "2026-08-10T01:00:00.000Z",
      venue: "PCSO Main Office Training Room",
      statusUrl: "https://x/status",
    });
    expect(text).toContain("Dear Maria Clara,");
    expect(text).toContain("Written Examination");
    expect(text).toContain("PCSO Main Office Training Room");
    expect(text).toContain("https://x/status");
  });
});
