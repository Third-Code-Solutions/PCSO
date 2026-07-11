import { describe, it, expect } from "vitest";
import {
  buildServiceHistory,
  dayBefore,
  type BuildServiceHistoryInput,
} from "./service-history";

const baseEmployee = {
  positionTitle: "Administrative Officer V",
  appointmentType: "permanent",
  dateHired: "2016-03-14",
  monthlySalary: 51886,
  officeName: "Human Resources Department",
  status: "active",
} satisfies BuildServiceHistoryInput["employee"];

describe("dayBefore", () => {
  it("returns the previous calendar day", () => {
    expect(dayBefore("2026-07-05")).toBe("2026-07-04");
  });

  it("crosses month and year boundaries", () => {
    expect(dayBefore("2026-01-01")).toBe("2025-12-31");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
  });

  it("passes through invalid input unchanged", () => {
    expect(dayBefore("not-a-date")).toBe("not-a-date");
  });
});

describe("buildServiceHistory — fallback path", () => {
  it("renders the current appointment as a single Present row when no history exists", () => {
    // Arrange + Act
    const rows = buildServiceHistory({ employee: baseEmployee });

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dateFrom: "2016-03-14",
      dateTo: null,
      designation: "Administrative Officer V",
      statusLabel: "Permanent",
      salary: 51886,
      station: "Human Resources Department",
      remarks: "Original Appointment",
    });
  });

  it("closes the final row on separation", () => {
    const rows = buildServiceHistory({
      employee: {
        ...baseEmployee,
        status: "retired",
        separationDate: "2026-06-30",
      },
    });

    expect(rows[0]!.dateTo).toBe("2026-06-30");
    expect(rows[0]!.remarks).toContain("Retired");
  });
});

describe("buildServiceHistory — event folding", () => {
  it("splits an appointment period when a step increment takes effect", () => {
    // Arrange
    const input: BuildServiceHistoryInput = {
      employee: baseEmployee,
      appointments: [
        {
          effectivityDate: "2016-03-14",
          positionTitle: "Administrative Officer IV",
          appointmentType: "permanent",
          monthlySalary: 46005,
          officeName: "Human Resources Department",
        },
      ],
      stepIncrements: [
        {
          effectivityDate: "2019-03-14",
          fromStep: 1,
          toStep: 2,
          monthlySalary: 47450,
        },
      ],
    };

    // Act
    const rows = buildServiceHistory(input);

    // Assert
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      dateFrom: "2016-03-14",
      dateTo: "2019-03-13",
      salary: 46005,
    });
    expect(rows[1]).toMatchObject({
      dateFrom: "2019-03-14",
      dateTo: null,
      designation: "Administrative Officer IV", // carried forward
      statusLabel: "Permanent",
      salary: 47450,
      station: "Human Resources Department",
    });
    expect(rows[1]!.remarks).toContain("Step Increment");
  });

  it("orders appointments, increments, and adjustments chronologically", () => {
    const rows = buildServiceHistory({
      employee: baseEmployee,
      appointments: [
        {
          effectivityDate: "2016-03-14",
          positionTitle: "Clerk III",
          appointmentType: "permanent",
          monthlySalary: 20000,
          officeName: "Records Division",
        },
        {
          effectivityDate: "2022-01-01",
          positionTitle: "Administrative Officer V",
          appointmentType: "permanent",
          monthlySalary: 51886,
          officeName: "Human Resources Department",
        },
      ],
      stepIncrements: [
        {
          effectivityDate: "2019-04-01",
          fromStep: 1,
          toStep: 2,
          monthlySalary: 20727,
        },
      ],
      salaryAdjustments: [
        {
          effectiveDate: "2024-06-01",
          adjustmentType: "salary_increase",
          newSalary: 53516,
        },
      ],
    });

    expect(rows.map((r) => r.dateFrom)).toEqual([
      "2016-03-14",
      "2019-04-01",
      "2022-01-01",
      "2024-06-01",
    ]);
    // Increment keeps the Clerk III designation; new appointment replaces it.
    expect(rows[1]!.designation).toBe("Clerk III");
    expect(rows[2]!.designation).toBe("Administrative Officer V");
    expect(rows[3]!.salary).toBe(53516);
    // Contiguous periods
    expect(rows[0]!.dateTo).toBe("2019-03-31");
    expect(rows[1]!.dateTo).toBe("2021-12-31");
    expect(rows[2]!.dateTo).toBe("2024-05-31");
    expect(rows[3]!.dateTo).toBeNull();
  });

  it("ignores events dated before the first appointment", () => {
    const rows = buildServiceHistory({
      employee: baseEmployee,
      stepIncrements: [
        {
          effectivityDate: "2010-01-01", // before dateHired
          fromStep: 1,
          toStep: 2,
        },
      ],
    });

    expect(rows).toHaveLength(1);
  });

  it("collapses a same-day appointment + adjustment into one row", () => {
    const rows = buildServiceHistory({
      employee: baseEmployee,
      appointments: [
        {
          effectivityDate: "2016-03-14",
          positionTitle: "Clerk III",
          appointmentType: "permanent",
          monthlySalary: 20000,
        },
      ],
      salaryAdjustments: [
        {
          effectiveDate: "2016-03-14",
          adjustmentType: "correction",
          newSalary: 20500,
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.salary).toBe(20500);
    expect(rows[0]!.designation).toBe("Clerk III");
  });

  it("carries salary forward when an event does not supply one", () => {
    const rows = buildServiceHistory({
      employee: baseEmployee,
      appointments: [
        {
          effectivityDate: "2016-03-14",
          positionTitle: "Clerk III",
          appointmentType: "permanent",
          monthlySalary: 20000,
        },
      ],
      stepIncrements: [
        { effectivityDate: "2019-03-14", fromStep: 1, toStep: 2 },
      ],
    });

    expect(rows[1]!.salary).toBe(20000);
  });
});
