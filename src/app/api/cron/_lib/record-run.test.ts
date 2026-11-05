import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLog, logTransaction, logError } = vi.hoisted(() => ({
  auditLog: vi.fn(),
  logTransaction: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ auditLog, logTransaction }));
vi.mock("@/lib/logging/error-log", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/logging/error-log")>();
  return { ...actual, logError };
});

import { cronOutcome, recordCronRun } from "./record-run";

beforeEach(() => {
  auditLog.mockReset();
  logTransaction.mockReset();
  logError.mockReset();
});

describe("cronOutcome (H-35)", () => {
  it("maps runs to status, HTTP code and severity", () => {
    expect(cronOutcome(0, false)).toEqual({
      status: "success",
      httpStatus: 200,
      severity: "info",
    });
    expect(cronOutcome(3, false)).toEqual({
      status: "partial",
      httpStatus: 500,
      severity: "warn",
    });
    expect(cronOutcome(0, true)).toEqual({
      status: "failure",
      httpStatus: 500,
      severity: "critical",
    });
  });
});

describe("recordCronRun (H-35)", () => {
  it("records a thrown job as failure across audit, transaction and error logs", async () => {
    const status = await recordCronRun({
      job: "monthly_accrual",
      table: "leave_credits",
      startedAtMs: Date.now(),
      error: new Error("db down"),
    });

    expect(status).toBe(500);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cron.monthly_accrual",
        outcome: "failure",
        severity: "critical",
        reason: "db down",
      }),
    );
    expect(logTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        errorInfo: "db down",
        source: "cron",
      }),
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "CRON_MONTHLY_ACCRUAL_FAILED",
        source: "api/cron/monthly-accrual",
      }),
    );
  });

  it("records item-level errors as a non-2xx partial run", async () => {
    const status = await recordCronRun({
      job: "biometric_pull",
      table: "attendance_logs",
      startedAtMs: Date.now(),
      errorCount: 2,
    });
    expect(status).toBe(500);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failure", severity: "warn" }),
    );
    expect(logTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ status: "partial" }),
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it("records a clean run as success with 200", async () => {
    const status = await recordCronRun({
      job: "annual_retirement_notices",
      table: "retirement_notices",
      startedAtMs: Date.now(),
      summary: { generated: 4 },
    });
    expect(status).toBe(200);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "success" }),
    );
  });
});
