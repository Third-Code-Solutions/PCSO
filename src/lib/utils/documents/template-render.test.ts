import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  extractPlaceholders,
  buildEmployeePlaceholderValues,
  composeFullName,
  formatPhp,
  formatLongDate,
} from "./template-render";

describe("extractPlaceholders", () => {
  it("returns distinct placeholder names in first-seen order", () => {
    // Arrange
    const template = "Hi {{full_name}}, {{position}} — again {{full_name}}.";

    // Act
    const names = extractPlaceholders(template);

    // Assert
    expect(names).toEqual(["full_name", "position"]);
  });

  it("returns empty array when template has no placeholders", () => {
    expect(extractPlaceholders("Plain text only.")).toEqual([]);
  });

  it("tolerates whitespace inside braces", () => {
    expect(extractPlaceholders("{{ full_name }} and {{position }}")).toEqual([
      "full_name",
      "position",
    ]);
  });
});

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    // Arrange
    const template = "This certifies that {{full_name}} is a {{position}}.";

    // Act
    const result = renderTemplate(template, {
      full_name: "Juan D. Cruz",
      position: "Administrative Officer V",
    });

    // Assert
    expect(result.text).toBe(
      "This certifies that Juan D. Cruz is a Administrative Officer V.",
    );
    expect(result.missing).toEqual([]);
  });

  it("collects unknown placeholders into the missing list and leaves them verbatim", () => {
    const result = renderTemplate("{{full_name}} — {{unknown_field}}", {
      full_name: "Juan D. Cruz",
    });

    expect(result.text).toBe("Juan D. Cruz — {{unknown_field}}");
    expect(result.missing).toEqual(["unknown_field"]);
  });

  it("treats null and empty string values as missing", () => {
    const result = renderTemplate("{{a}} {{b}} {{c}}", {
      a: null,
      b: "",
      c: "ok",
    });

    expect(result.missing).toEqual(["a", "b"]);
    expect(result.text).toBe("{{a}} {{b}} ok");
  });

  it("deduplicates repeated missing placeholders", () => {
    const result = renderTemplate("{{x}} and {{x}}", {});
    expect(result.missing).toEqual(["x"]);
  });

  it("substitutes numeric values", () => {
    const result = renderTemplate("SG {{salary_grade}}", { salary_grade: 18 });
    expect(result.text).toBe("SG 18");
  });

  it("substitutes placeholders written with inner whitespace", () => {
    const result = renderTemplate("Hello {{ full_name }}", {
      full_name: "Juan D. Cruz",
    });
    expect(result.text).toBe("Hello Juan D. Cruz");
  });
});

describe("composeFullName", () => {
  it("abbreviates the middle name and appends the suffix", () => {
    expect(
      composeFullName({
        firstName: "Juan",
        middleName: "Dela",
        lastName: "Cruz",
        suffix: "Jr.",
      }),
    ).toBe("Juan D. Cruz Jr.");
  });

  it("skips absent middle name and suffix", () => {
    expect(composeFullName({ firstName: "Ana", lastName: "Reyes" })).toBe(
      "Ana Reyes",
    );
  });
});

describe("formatters", () => {
  it("formats PHP amounts with two decimals and thousands separators", () => {
    expect(formatPhp(51357)).toBe("PHP 51,357.00");
    expect(formatPhp(1234567.5)).toBe("PHP 1,234,567.50");
  });

  it("formats long dates and passes through invalid input", () => {
    expect(formatLongDate("2026-07-05")).toContain("2026");
    expect(formatLongDate("not-a-date")).toBe("not-a-date");
  });
});

describe("buildEmployeePlaceholderValues", () => {
  const employee = {
    firstName: "Juan",
    middleName: "Dela",
    lastName: "Cruz",
    suffix: null,
    employeeNo: "PCSO-2026-0001",
    positionTitle: "Administrative Officer V",
    officeName: "Human Resources Department",
    salaryGrade: 18,
    step: 3,
    monthlySalary: 55200,
    dateHired: "2016-03-14",
    appointmentType: "permanent",
    civilStatus: "married",
  };

  it("builds the full vocabulary from a 201 snapshot", () => {
    // Arrange
    const now = new Date(2026, 6, 5); // July 5, 2026 (local)

    // Act
    const values = buildEmployeePlaceholderValues(employee, {
      agencyName: "Philippine Charity Sweepstakes Office",
      purpose: "loan application",
      now,
    });

    // Assert
    expect(values.full_name).toBe("Juan D. Cruz");
    expect(values.position).toBe("Administrative Officer V");
    expect(values.office).toBe("Human Resources Department");
    expect(values.employee_number).toBe("PCSO-2026-0001");
    expect(values.salary).toBe("PHP 55,200.00");
    expect(values.salary_grade).toBe("18");
    expect(values.step).toBe("3");
    expect(values.appointment_type).toBe("Permanent");
    expect(values.civil_status).toBe("Married");
    expect(values.agency_name).toBe("Philippine Charity Sweepstakes Office");
    expect(values.purpose).toBe("loan application");
    expect(values.current_date).toContain("2026");
    expect(values.date_hired).toContain("2016");
  });

  it("renders a seed-style template end to end without missing placeholders", () => {
    // Arrange
    const template =
      "This is to certify that {{full_name}}, {{position}} of the {{office}}, " +
      "{{agency_name}}, has no pending administrative case as of {{current_date}}.\n\n" +
      "Issued upon the request of {{full_name}} ({{employee_number}}) for {{purpose}}.";
    const values = buildEmployeePlaceholderValues(employee, {
      agencyName: "PCSO",
      purpose: "travel abroad",
    });

    // Act
    const result = renderTemplate(template, values);

    // Assert
    expect(result.missing).toEqual([]);
    expect(result.text).toContain("Juan D. Cruz");
    expect(result.text).toContain("PCSO");
    expect(result.text).toContain("travel abroad");
  });

  it("leaves optional fields blank so the renderer can flag them as missing", () => {
    const values = buildEmployeePlaceholderValues({
      firstName: "Ana",
      lastName: "Reyes",
      employeeNo: "PCSO-2026-0002",
      positionTitle: "Clerk II",
    });

    const result = renderTemplate("{{salary}}", values);
    expect(result.missing).toEqual(["salary"]);
  });
});
