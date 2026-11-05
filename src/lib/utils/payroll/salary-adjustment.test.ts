/**
 * Salary adjustment validation & target resolution tests — TOR 1.8.11–1.8.13.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import {
  CreateSalaryAdjustmentSchema,
  ApproveSalaryAdjustmentSchema,
  DisapproveSalaryAdjustmentSchema,
  ListSalaryAdjustmentsSchema,
  resolveAdjustmentTarget,
  isSalaryAdjustableAppointmentType,
  formatGradeStep,
  SALARY_ADJUSTMENT_TYPE_VALUES,
  SALARY_ADJUSTMENT_TYPE_LABELS,
  MAX_ADJUSTMENT_SALARY,
  manilaToday,
  isAdjustmentDue,
  resolveAdjustedSalary,
  salaryAdjustmentSegregationError,
  type EffectedAdjustmentRow,
} from "./salary-adjustment";

const EMPLOYEE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ADJUSTMENT_ID = "16fd2706-8baf-433b-82eb-8c7fada847da";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: EMPLOYEE_ID,
    adjustmentType: "promotion",
    effectiveDate: "2026-08-01",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CreateSalaryAdjustmentSchema
// ---------------------------------------------------------------------------

describe("CreateSalaryAdjustmentSchema", () => {
  it("accepts a grade/step target without an explicit salary", () => {
    const parsed = CreateSalaryAdjustmentSchema.parse(
      baseInput({ newGrade: 15, newStep: 2 }),
    );
    expect(parsed.newGrade).toBe(15);
    expect(parsed.newStep).toBe(2);
    expect(parsed.newSalary).toBeUndefined();
  });

  it("accepts an amount-only target", () => {
    const parsed = CreateSalaryAdjustmentSchema.parse(
      baseInput({ newSalary: "45000.50" }),
    );
    expect(parsed.newSalary).toBeCloseTo(45000.5);
    expect(parsed.newGrade).toBeUndefined();
    expect(parsed.newStep).toBeUndefined();
  });

  it("coerces string form values (UI sends strings)", () => {
    const parsed = CreateSalaryAdjustmentSchema.parse(
      baseInput({ newGrade: "18", newStep: "3", newSalary: "" }),
    );
    expect(parsed.newGrade).toBe(18);
    expect(parsed.newStep).toBe(3);
    expect(parsed.newSalary).toBeUndefined();
  });

  it("treats empty strings as unset optional fields", () => {
    const parsed = CreateSalaryAdjustmentSchema.parse(
      baseInput({ newGrade: "", newStep: "", newSalary: "38000", reason: "" }),
    );
    expect(parsed.newGrade).toBeUndefined();
    expect(parsed.newStep).toBeUndefined();
    expect(parsed.reason).toBeUndefined();
  });

  it("rejects a grade without a step (and vice versa)", () => {
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(baseInput({ newGrade: 15 })),
    ).toThrow(/together/i);
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(baseInput({ newStep: 4 })),
    ).toThrow(/together/i);
  });

  it("rejects when neither grade/step nor salary is provided", () => {
    expect(() => CreateSalaryAdjustmentSchema.parse(baseInput())).toThrow(
      /new grade \+ step|new monthly salary/i,
    );
  });

  it("rejects out-of-range grade and step", () => {
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(
        baseInput({ newGrade: 34, newStep: 1 }),
      ),
    ).toThrow(/1–33/);
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(
        baseInput({ newGrade: 10, newStep: 9 }),
      ),
    ).toThrow(/1–8/);
  });

  it("rejects a non-positive or absurd salary", () => {
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(baseInput({ newSalary: 0 })),
    ).toThrow(/greater than zero/i);
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(
        baseInput({ newSalary: MAX_ADJUSTMENT_SALARY + 1 }),
      ),
    ).toThrow(/sanity limit/i);
  });

  it("rejects malformed dates and unknown adjustment types", () => {
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(
        baseInput({ newSalary: 1000, effectiveDate: "08/01/2026" }),
      ),
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      CreateSalaryAdjustmentSchema.parse(
        baseInput({ newSalary: 1000, adjustmentType: "demotion" }),
      ),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Approve / Disapprove / List schemas
// ---------------------------------------------------------------------------

describe("workflow schemas", () => {
  it("approve requires a UUID", () => {
    expect(
      ApproveSalaryAdjustmentSchema.parse({ adjustmentId: ADJUSTMENT_ID }),
    ).toEqual({ adjustmentId: ADJUSTMENT_ID });
    expect(() =>
      ApproveSalaryAdjustmentSchema.parse({ adjustmentId: "nope" }),
    ).toThrow();
  });

  it("disapprove requires a reason of at least 5 characters", () => {
    expect(() =>
      DisapproveSalaryAdjustmentSchema.parse({
        adjustmentId: ADJUSTMENT_ID,
        reason: "  no ",
      }),
    ).toThrow(/at least 5 characters/i);

    const parsed = DisapproveSalaryAdjustmentSchema.parse({
      adjustmentId: ADJUSTMENT_ID,
      reason: "  Incorrect basis document attached  ",
    });
    expect(parsed.reason).toBe("Incorrect basis document attached");
  });

  it("list filters treat empty strings as unset", () => {
    const parsed = ListSalaryAdjustmentsSchema.parse({
      status: "",
      employeeId: "",
    });
    expect(parsed.status).toBeUndefined();
    expect(parsed.employeeId).toBeUndefined();

    const withStatus = ListSalaryAdjustmentsSchema.parse({ status: "pending" });
    expect(withStatus.status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// resolveAdjustmentTarget
// ---------------------------------------------------------------------------

describe("resolveAdjustmentTarget", () => {
  const current = { salaryGrade: 15, step: 1 };

  it("resolves the authorized salary for a grade/step target", () => {
    const target = resolveAdjustmentTarget(
      { newGrade: 15, newStep: 2, newSalary: undefined },
      current,
      (grade, step) => (grade === 15 && step === 2 ? 38639 : undefined),
    );
    expect(target).toEqual({ newGrade: 15, newStep: 2, newSalary: 38639 });
  });

  it("prefers an explicit salary override over the resolved amount", () => {
    const target = resolveAdjustmentTarget(
      { newGrade: 15, newStep: 2, newSalary: 40000 },
      current,
      () => 38639,
    );
    expect(target.newSalary).toBe(40000);
  });

  it("returns null grade/step for amount-only adjustments", () => {
    const target = resolveAdjustmentTarget(
      { newGrade: undefined, newStep: undefined, newSalary: 52000 },
      current,
      () => {
        throw new Error("resolver must not be called for amount-only targets");
      },
    );
    expect(target).toEqual({ newGrade: null, newStep: null, newSalary: 52000 });
  });

  it("rejects a no-op target (same grade/step, no override)", () => {
    expect(() =>
      resolveAdjustmentTarget(
        { newGrade: 15, newStep: 1, newSalary: undefined },
        current,
        () => 37492,
      ),
    ).toThrow(/already at SG 15, Step 1/);
  });

  it("allows same grade/step when an override amount is supplied (correction)", () => {
    const target = resolveAdjustmentTarget(
      { newGrade: 15, newStep: 1, newSalary: 37500 },
      current,
      () => undefined,
    );
    expect(target).toEqual({ newGrade: 15, newStep: 1, newSalary: 37500 });
  });

  it("throws when the salary cannot be resolved anywhere", () => {
    expect(() =>
      resolveAdjustmentTarget(
        { newGrade: 20, newStep: 5, newSalary: undefined },
        current,
        () => undefined,
      ),
    ).toThrow(/No authorized salary found for SG 20, Step 5/);
  });

  it("throws when nothing is provided at all", () => {
    expect(() =>
      resolveAdjustmentTarget(
        { newGrade: undefined, newStep: undefined, newSalary: undefined },
        current,
        () => undefined,
      ),
    ).toThrow(/new grade \+ step/i);
  });
});

// ---------------------------------------------------------------------------
// Catalog + display helpers
// ---------------------------------------------------------------------------

describe("catalog and display helpers", () => {
  it("every adjustment type has a label", () => {
    for (const type of SALARY_ADJUSTMENT_TYPE_VALUES) {
      expect(SALARY_ADJUSTMENT_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("organic allowlist admits plantilla types and rejects contract types", () => {
    expect(isSalaryAdjustableAppointmentType("permanent")).toBe(true);
    expect(isSalaryAdjustableAppointmentType("temporary")).toBe(true);
    expect(isSalaryAdjustableAppointmentType("coterminous")).toBe(true);
    expect(isSalaryAdjustableAppointmentType("casual")).toBe(true);
    // Fail-safe: everything not on the allowlist is rejected.
    expect(isSalaryAdjustableAppointmentType("job_order")).toBe(false);
    expect(isSalaryAdjustableAppointmentType("contract_of_service")).toBe(
      false,
    );
    expect(isSalaryAdjustableAppointmentType("consultant")).toBe(false);
    expect(isSalaryAdjustableAppointmentType("confidential_agent")).toBe(false);
    expect(isSalaryAdjustableAppointmentType("anything_new")).toBe(false);
  });

  it("formats grade/step combinations", () => {
    expect(formatGradeStep(15, 2)).toBe("SG 15, Step 2");
    expect(formatGradeStep(15, null)).toBe("SG 15");
    expect(formatGradeStep(null, 2)).toBe("Step 2");
    expect(formatGradeStep(null, null)).toBeNull();
    expect(formatGradeStep(undefined, undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// H-17: effective-date gating and adjusted salary resolution
// ---------------------------------------------------------------------------

describe("manilaToday / isAdjustmentDue", () => {
  it("uses the Manila calendar date (UTC+8)", () => {
    // 2026-11-04T17:30Z is already 2026-11-05 01:30 in Manila.
    expect(manilaToday(new Date("2026-11-04T17:30:00Z"))).toBe("2026-11-05");
    expect(manilaToday(new Date("2026-11-04T15:59:00Z"))).toBe("2026-11-04");
  });

  it("is due on or after the effective date only", () => {
    expect(isAdjustmentDue("2026-11-05", "2026-11-05")).toBe(true);
    expect(isAdjustmentDue("2026-11-01", "2026-11-05")).toBe(true);
    expect(isAdjustmentDue("2026-12-01", "2026-11-05")).toBe(false);
  });
});

describe("resolveAdjustedSalary", () => {
  const amountOnly: EffectedAdjustmentRow = {
    effectiveDate: "2026-07-01",
    newSalary: "31000.00",
    oldGrade: 15,
    oldStep: 2,
    newGrade: null,
    newStep: null,
  };
  const schedule = [
    {
      grade: 15,
      step: 2,
      monthlySalary: "30000.00",
      effectiveDate: "2026-01-01",
    },
  ];

  it("applies an amount-only adjustment to the unchanged grade/step", () => {
    expect(
      resolveAdjustedSalary([amountOnly], schedule, 15, 2, "2026-11-30"),
    ).toBe(31000);
  });

  it("ignores an adjustment not yet effective for the period", () => {
    expect(
      resolveAdjustedSalary([amountOnly], schedule, 15, 2, "2026-06-30"),
    ).toBeUndefined();
  });

  it("is superseded by a later grade/step change", () => {
    expect(
      resolveAdjustedSalary([amountOnly], schedule, 15, 3, "2026-11-30"),
    ).toBeUndefined();
  });

  it("is superseded by a newer salary schedule tranche", () => {
    const newer = [
      ...schedule,
      {
        grade: 15,
        step: 2,
        monthlySalary: "32000.00",
        effectiveDate: "2026-10-01",
      },
    ];
    expect(
      resolveAdjustedSalary([amountOnly], newer, 15, 2, "2026-11-30"),
    ).toBeUndefined();
  });

  it("uses the latest effective adjustment", () => {
    const later = {
      ...amountOnly,
      effectiveDate: "2026-09-01",
      newSalary: "31500.00",
    };
    expect(
      resolveAdjustedSalary([amountOnly, later], schedule, 15, 2, "2026-11-30"),
    ).toBe(31500);
  });

  it("matches promotions on the new grade/step", () => {
    const promotion = {
      ...amountOnly,
      newGrade: 16,
      newStep: 1,
      newSalary: "34000.00",
    };
    expect(
      resolveAdjustedSalary([promotion], schedule, 16, 1, "2026-11-30"),
    ).toBe(34000);
  });
});

describe("salaryAdjustmentSegregationError", () => {
  const actor = { id: "user-a", employeeId: "emp-a" };

  it("blocks creating an adjustment for your own record", () => {
    expect(
      salaryAdjustmentSegregationError(actor, { employeeId: "emp-a" }),
    ).toMatch(/your own employee record/);
  });

  it("blocks approving your own record even if someone else requested it", () => {
    expect(
      salaryAdjustmentSegregationError(actor, {
        employeeId: "emp-a",
        requestedBy: "user-b",
      }),
    ).toMatch(/your own employee record/);
  });

  it("blocks the requester from approving", () => {
    expect(
      salaryAdjustmentSegregationError(actor, {
        employeeId: "emp-b",
        requestedBy: "user-a",
      }),
    ).toMatch(/another authorized officer/);
  });

  it("allows a different officer on someone else's record", () => {
    expect(
      salaryAdjustmentSegregationError(actor, {
        employeeId: "emp-b",
        requestedBy: "user-b",
      }),
    ).toBeNull();
    expect(
      salaryAdjustmentSegregationError(
        { id: "user-a", employeeId: null },
        { employeeId: "emp-b" },
      ),
    ).toBeNull();
  });
});
