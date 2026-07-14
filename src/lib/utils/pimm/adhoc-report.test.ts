/**
 * PIMM ad hoc report shaping tests — TOR 1.3.26 / 1.2.29.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import {
  resolveAdhocColumns,
  shapeAdhocReport,
  buildCsvFromTable,
  buildAdhocCsv,
  escapeCsvCell,
  appointmentCategoryLabel,
  appointmentTypeLabel,
  highestEducationLabel,
  applicantNameFromPersonalInfo,
  EMPLOYEE_ADHOC_CATALOG,
  APPLICATION_ADHOC_CATALOG,
  type EmployeeAdhocRow,
  type ApplicationAdhocRow,
} from "./adhoc-report";

function makeEmployeeRow(
  overrides: Partial<EmployeeAdhocRow> = {},
): EmployeeAdhocRow {
  return {
    employeeNo: "PCSO-2024-0001",
    fullName: "Dela Cruz, Juan",
    officeName: "Charity Sector",
    positionTitle: "Administrative Officer II",
    appointmentType: "Permanent",
    appointmentCategory: "Organic",
    salaryGrade: "11",
    step: "3",
    status: "active",
    dateHired: "2015-06-01",
    gender: "male",
    email: "juan.delacruz@pcso.gov.ph",
    highestEducation: "College — BS Information Technology",
    eligibilities: "CSC Professional",
    externalTrainings: "2",
    ...overrides,
  };
}

function makeApplicationRow(
  overrides: Partial<ApplicationAdhocRow> = {},
): ApplicationAdhocRow {
  return {
    applicationNo: "APP-2026-000123",
    applicantName: "Santos, Maria",
    vacancyPosition: "Administrative Assistant I",
    vacancyItemNo: "PCSO-AA1-001",
    status: "qualified",
    matchScore: "87.50",
    submittedDate: "2026-05-10",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveAdhocColumns
// ---------------------------------------------------------------------------

describe("resolveAdhocColumns", () => {
  it("always leads with the fixed identity columns", () => {
    const columns = resolveAdhocColumns(EMPLOYEE_ADHOC_CATALOG, ["dateHired"]);

    expect(columns.slice(0, EMPLOYEE_ADHOC_CATALOG.fixed.length)).toEqual([
      ...EMPLOYEE_ADHOC_CATALOG.fixed,
    ]);
    expect(columns.at(-1)!.key).toBe("dateHired");
  });

  it("falls back to the default columns when selection is empty", () => {
    const columns = resolveAdhocColumns(EMPLOYEE_ADHOC_CATALOG, []);
    const selectableKeys = columns
      .slice(EMPLOYEE_ADHOC_CATALOG.fixed.length)
      .map((c) => c.key);

    expect(selectableKeys).toEqual([...EMPLOYEE_ADHOC_CATALOG.defaultKeys]);
  });

  it("ignores unknown keys and preserves catalog order", () => {
    const columns = resolveAdhocColumns(EMPLOYEE_ADHOC_CATALOG, [
      "dateHired",
      "bogus_column",
      "officeName",
    ]);
    const selectableKeys = columns
      .slice(EMPLOYEE_ADHOC_CATALOG.fixed.length)
      .map((c) => c.key);

    // Catalog order: officeName comes before dateHired regardless of input.
    expect(selectableKeys).toEqual(["officeName", "dateHired"]);
  });

  it("falls back to defaults when only unknown keys are selected", () => {
    const columns = resolveAdhocColumns(APPLICATION_ADHOC_CATALOG, [
      "nonsense",
    ]);
    const selectableKeys = columns
      .slice(APPLICATION_ADHOC_CATALOG.fixed.length)
      .map((c) => c.key);

    expect(selectableKeys).toEqual([...APPLICATION_ADHOC_CATALOG.defaultKeys]);
  });

  it("every catalog column has a non-empty label", () => {
    for (const catalog of [EMPLOYEE_ADHOC_CATALOG, APPLICATION_ADHOC_CATALOG]) {
      for (const col of [...catalog.fixed, ...catalog.selectable]) {
        expect(col.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("default keys all exist in the selectable catalog", () => {
    for (const catalog of [EMPLOYEE_ADHOC_CATALOG, APPLICATION_ADHOC_CATALOG]) {
      const selectableKeys = new Set(catalog.selectable.map((c) => c.key));
      for (const key of catalog.defaultKeys) {
        expect(selectableKeys.has(key)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// shapeAdhocReport
// ---------------------------------------------------------------------------

describe("shapeAdhocReport", () => {
  it("shapes rows in column order with fixed identity cells first", () => {
    const report = shapeAdhocReport(
      EMPLOYEE_ADHOC_CATALOG,
      [makeEmployeeRow()],
      ["salaryGrade", "step"],
    );

    expect(report.columns.map((c) => c.key)).toEqual([
      "employeeNo",
      "fullName",
      "salaryGrade",
      "step",
    ]);
    expect(report.rows).toEqual([
      ["PCSO-2024-0001", "Dela Cruz, Juan", "11", "3"],
    ]);
    expect(report.total).toBe(1);
  });

  it("shapes application rows against the application catalog", () => {
    const report = shapeAdhocReport(
      APPLICATION_ADHOC_CATALOG,
      [makeApplicationRow()],
      ["status", "matchScore"],
    );

    expect(report.columns.map((c) => c.key)).toEqual([
      "applicationNo",
      "applicantName",
      "status",
      "matchScore",
    ]);
    expect(report.rows[0]).toEqual([
      "APP-2026-000123",
      "Santos, Maria",
      "qualified",
      "87.50",
    ]);
  });

  it("returns zero rows and total 0 for an empty record set", () => {
    const report = shapeAdhocReport(EMPLOYEE_ADHOC_CATALOG, [], []);

    expect(report.rows).toEqual([]);
    expect(report.total).toBe(0);
    // Columns still resolve (defaults) so an empty CSV keeps its header.
    expect(report.columns.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CSV serialization
// ---------------------------------------------------------------------------

describe("escapeCsvCell", () => {
  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(escapeCsvCell("Dela Cruz, Juan")).toBe('"Dela Cruz, Juan"');
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("passes plain cells through unchanged", () => {
    expect(escapeCsvCell("PCSO-2024-0001")).toBe("PCSO-2024-0001");
  });
});

describe("buildCsvFromTable / buildAdhocCsv", () => {
  it("serializes header + rows with a trailing newline", () => {
    const csv = buildCsvFromTable(
      ["A", "B"],
      [
        ["1", "2"],
        ["3", "4,x"],
      ],
    );

    expect(csv).toBe('A,B\n1,2\n3,"4,x"\n');
  });

  it("serializes a shaped report using column labels as the header", () => {
    const report = shapeAdhocReport(
      APPLICATION_ADHOC_CATALOG,
      [makeApplicationRow({ applicantName: "Santos, Maria" })],
      ["status"],
    );
    const csv = buildAdhocCsv(report);
    const lines = csv.trimEnd().split("\n");

    expect(lines[0]).toBe("Application No.,Applicant Name,Application Status");
    expect(lines[1]).toBe('APP-2026-000123,"Santos, Maria",qualified');
  });
});

// ---------------------------------------------------------------------------
// Appointment category / type labels
// ---------------------------------------------------------------------------

describe("appointmentCategoryLabel", () => {
  it("labels the five organic appointment types as Organic (TOR 1.3.3)", () => {
    for (const type of [
      "permanent",
      "temporary",
      "coterminous",
      "casual",
      "cti",
    ] as const) {
      expect(appointmentCategoryLabel(type)).toBe("Organic");
    }
  });

  it("labels JO/COS/consultant/confidential agent as Non-Organic", () => {
    for (const type of [
      "job_order",
      "contract_of_service",
      "consultant",
      "confidential_agent",
    ] as const) {
      expect(appointmentCategoryLabel(type)).toBe("Non-Organic");
    }
  });
});

describe("appointmentTypeLabel", () => {
  it("maps enum values to human labels and falls back to the raw value", () => {
    expect(appointmentTypeLabel("permanent")).toBe("Permanent");
    expect(appointmentTypeLabel("job_order")).toBe("Job Order (JO)");
    expect(appointmentTypeLabel("mystery_type")).toBe("mystery_type");
  });
});

// ---------------------------------------------------------------------------
// highestEducationLabel
// ---------------------------------------------------------------------------

describe("highestEducationLabel", () => {
  it("picks the highest attainment level regardless of record order", () => {
    const label = highestEducationLabel([
      { level: "college", degreeCourse: "BS Information Technology" },
      { level: "graduate_studies", degreeCourse: "MPA" },
      { level: "secondary", degreeCourse: null },
    ]);

    expect(label).toBe("Graduate Studies — MPA");
  });

  it("omits the degree suffix when degreeCourse is absent", () => {
    expect(highestEducationLabel([{ level: "secondary" }])).toBe("Secondary");
  });

  it("returns empty string for no records", () => {
    expect(highestEducationLabel([])).toBe("");
  });

  it("still returns unknown levels (raw) rather than dropping them", () => {
    expect(highestEducationLabel([{ level: "post_doctoral" }])).toBe(
      "post_doctoral",
    );
  });
});

// ---------------------------------------------------------------------------
// applicantNameFromPersonalInfo
// ---------------------------------------------------------------------------

describe("applicantNameFromPersonalInfo", () => {
  it("formats Last, First Middle from a full personal_info payload", () => {
    expect(
      applicantNameFromPersonalInfo({
        firstName: "Maria",
        middleName: "Reyes",
        lastName: "Santos",
      }),
    ).toBe("Santos, Maria Reyes");
  });

  it("handles a missing middle name", () => {
    expect(
      applicantNameFromPersonalInfo({ firstName: "Maria", lastName: "Santos" }),
    ).toBe("Santos, Maria");
  });

  it("degrades gracefully on partial payloads", () => {
    expect(applicantNameFromPersonalInfo({ lastName: "Santos" })).toBe(
      "Santos",
    );
    expect(applicantNameFromPersonalInfo({ firstName: "Maria" })).toBe("Maria");
  });

  it("returns empty string for non-object or empty payloads", () => {
    expect(applicantNameFromPersonalInfo(null)).toBe("");
    expect(applicantNameFromPersonalInfo("Santos")).toBe("");
    expect(applicantNameFromPersonalInfo([])).toBe("");
    expect(applicantNameFromPersonalInfo({})).toBe("");
    expect(applicantNameFromPersonalInfo({ firstName: 42 })).toBe("");
  });
});
