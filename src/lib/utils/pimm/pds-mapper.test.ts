/**
 * PDS mapper tests — pure 201-row → PdsFormPdf props mapping.
 *
 * No DB required; the mapper is a pure function (all PDF component imports
 * are type-only).
 */

import { describe, it, expect } from "vitest";
import {
  buildPdsFormProps,
  formatCitizenship,
  mapEducation,
  mapFamilyMembers,
  mapQuestionnaire,
  mapTrainings,
  mapWorkExperience,
  type PdsEmployeeSource,
} from "./pds-mapper";
import { PDS_QUESTIONS } from "./pds-questions";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseEmployee: PdsEmployeeSource = {
  lastName: "Dela Cruz",
  firstName: "Juan",
  middleName: "Santos",
  employeeNo: "PCSO-2024-0001",
  nationality: "Filipino",
};

const emptyParams = {
  employee: baseEmployee,
  agencyName: "Philippine Charity Sweepstakes Office",
  familyMembers: [],
  education: [],
  eligibilities: [],
  externalWorkExperiences: [],
  appointments: [],
  voluntaryWorks: [],
  externalTrainings: [],
  ldmTrainings: [],
};

// ---------------------------------------------------------------------------
// formatCitizenship
// ---------------------------------------------------------------------------

describe("formatCitizenship", () => {
  it("returns plain nationality when not a dual citizen", () => {
    expect(formatCitizenship({ nationality: "Filipino" })).toBe("Filipino");
  });

  it("defaults to Filipino when nationality is missing", () => {
    expect(formatCitizenship({})).toBe("Filipino");
  });

  it("appends dual citizenship by birth with country", () => {
    expect(
      formatCitizenship({
        nationality: "Filipino",
        dualCitizenshipType: "by_birth",
        dualCitizenshipCountry: "United States",
      }),
    ).toBe("Filipino / Dual Citizenship (by birth) — United States");
  });

  it("appends dual citizenship by naturalization without country", () => {
    expect(
      formatCitizenship({
        nationality: "Filipino",
        dualCitizenshipType: "by_naturalization",
      }),
    ).toBe("Filipino / Dual Citizenship (by naturalization)");
  });
});

// ---------------------------------------------------------------------------
// mapFamilyMembers
// ---------------------------------------------------------------------------

describe("mapFamilyMembers", () => {
  it("splits spouse, parents, and children into their PDS slots", () => {
    const result = mapFamilyMembers([
      {
        memberType: "child",
        lastName: "Dela Cruz",
        firstName: "Ana",
        birthDate: "2015-04-01",
        sortOrder: 1,
      },
      {
        memberType: "spouse",
        lastName: "Dela Cruz",
        firstName: "Maria",
        middleName: "Reyes",
        occupation: "Teacher",
        employerName: "DepEd",
        telephoneNo: "8888-1234",
      },
      {
        memberType: "father",
        lastName: "Dela Cruz",
        firstName: "Pedro",
        extensionName: "Sr.",
      },
      { memberType: "mother", lastName: "Santos", firstName: "Josefa" },
      {
        memberType: "child",
        lastName: "Dela Cruz",
        firstName: "Ben",
        birthDate: "2018-09-15",
        sortOrder: 2,
      },
    ]);

    expect(result.spouse).toEqual({
      fullName: "Maria Reyes Dela Cruz",
      occupation: "Teacher",
      employerName: "DepEd",
      employerAddress: null,
      telephoneNo: "8888-1234",
    });
    expect(result.fatherName).toBe("Pedro Dela Cruz, Sr.");
    expect(result.motherName).toBe("Josefa Santos");
    expect(result.children).toEqual([
      { fullName: "Ana Dela Cruz", birthDate: "2015-04-01" },
      { fullName: "Ben Dela Cruz", birthDate: "2018-09-15" },
    ]);
  });

  it("orders children by sortOrder", () => {
    const result = mapFamilyMembers([
      {
        memberType: "child",
        lastName: "X",
        firstName: "Second",
        sortOrder: 2,
      },
      { memberType: "child", lastName: "X", firstName: "First", sortOrder: 1 },
    ]);
    expect(result.children.map((c) => c.fullName)).toEqual([
      "First X",
      "Second X",
    ]);
  });

  it("returns nulls and empty children when no rows exist", () => {
    const result = mapFamilyMembers([]);
    expect(result.spouse).toBeNull();
    expect(result.fatherName).toBeNull();
    expect(result.motherName).toBeNull();
    expect(result.children).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapEducation
// ---------------------------------------------------------------------------

describe("mapEducation", () => {
  it("emits one labeled blank row per level when empty", () => {
    const rows = mapEducation([]);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.level)).toEqual([
      "Elementary",
      "Secondary",
      "Vocational / Trade Course",
      "College",
      "Graduate Studies",
    ]);
    expect(rows.every((r) => r.schoolName === null)).toBe(true);
  });

  it("groups records in official level order regardless of input order", () => {
    const rows = mapEducation([
      {
        level: "college",
        schoolName: "UP Diliman",
        degreeCourse: "BS Computer Science",
        yearGraduated: "2005",
      },
      { level: "elementary", schoolName: "Central School" },
    ]);
    expect(rows[0]).toMatchObject({
      level: "Elementary",
      schoolName: "Central School",
    });
    // Secondary and Vocational stay as labeled blanks.
    expect(rows[1]).toMatchObject({ level: "Secondary", schoolName: null });
    expect(rows[3]).toMatchObject({
      level: "College",
      schoolName: "UP Diliman",
      degreeCourse: "BS Computer Science",
      yearGraduated: "2005",
    });
  });

  it("keeps multiple records within a level ordered by sortOrder", () => {
    const rows = mapEducation([
      { level: "college", schoolName: "Second College", sortOrder: 2 },
      { level: "college", schoolName: "First College", sortOrder: 1 },
    ]);
    const college = rows.filter((r) => r.level === "College");
    expect(college.map((r) => r.schoolName)).toEqual([
      "First College",
      "Second College",
    ]);
    // 4 blank levels + 2 college rows
    expect(rows).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// mapWorkExperience
// ---------------------------------------------------------------------------

describe("mapWorkExperience", () => {
  it("merges external rows and PCSO appointments, most recent first", () => {
    const rows = mapWorkExperience(
      [
        {
          dateFrom: "2010-01-01",
          dateTo: "2015-12-31",
          positionTitle: "Analyst",
          companyName: "Private Corp",
          monthlySalary: "25000.00",
          statusOfAppointment: "Regular",
          isGovernmentService: false,
        },
      ],
      [
        {
          effectivityDate: "2016-01-01",
          endDate: null,
          positionTitle: "Administrative Officer III",
          salaryGrade: 14,
          step: 2,
          monthlySalary: "32000.00",
          appointmentType: "permanent",
        },
      ],
      "Philippine Charity Sweepstakes Office",
    );

    expect(rows).toHaveLength(2);
    // PCSO appointment (2016) sorts before the older external row (2010).
    expect(rows[0]).toEqual({
      from: "2016-01-01",
      to: null,
      positionTitle: "Administrative Officer III",
      agency: "Philippine Charity Sweepstakes Office",
      monthlySalary: 32000,
      gradeStep: "14-2",
      statusOfAppointment: "Permanent",
      isGovService: true,
    });
    expect(rows[1]).toMatchObject({
      from: "2010-01-01",
      agency: "Private Corp",
      monthlySalary: 25000,
      isGovService: false,
    });
  });

  it("converts non-numeric salary strings to null", () => {
    const rows = mapWorkExperience(
      [
        {
          dateFrom: "2010-01-01",
          positionTitle: "Clerk",
          companyName: "Shop",
          monthlySalary: "confidential",
        },
      ],
      [],
      "PCSO",
    );
    expect(rows[0]?.monthlySalary).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapTrainings
// ---------------------------------------------------------------------------

describe("mapTrainings", () => {
  it("merges external + LDM rows, most recent first, nulls last", () => {
    const rows = mapTrainings(
      [
        {
          title: "External Seminar",
          dateFrom: "2020-05-01",
          dateTo: "2020-05-02",
          numberOfHours: "16.0",
          conductedBy: "CSC",
        },
        { title: "Undated Workshop" },
      ],
      [
        {
          title: "In-House Training",
          from: "2023-02-01",
          to: "2023-02-03",
          hours: null,
          conductedBy: "PCSO HRD",
        },
      ],
    );

    expect(rows.map((r) => r.title)).toEqual([
      "In-House Training",
      "External Seminar",
      "Undated Workshop",
    ]);
    expect(rows[1]?.hours).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// mapQuestionnaire
// ---------------------------------------------------------------------------

describe("mapQuestionnaire", () => {
  it("emits every canonical key with null answers when nothing stored", () => {
    const result = mapQuestionnaire(null);
    expect(Object.keys(result)).toHaveLength(PDS_QUESTIONS.length);
    for (const q of PDS_QUESTIONS) {
      expect(result[q.key]).toEqual({ answer: null, details: null });
    }
  });

  it("preserves stored answers and details", () => {
    const result = mapQuestionnaire({
      "35b": { answer: true, details: "Case pending since 2020" },
      "39": { answer: false },
    });
    expect(result["35b"]).toEqual({
      answer: true,
      details: "Case pending since 2020",
    });
    expect(result["39"]).toEqual({ answer: false, details: null });
    // Untouched keys stay unanswered.
    expect(result["34a"]).toEqual({ answer: null, details: null });
  });
});

// ---------------------------------------------------------------------------
// buildPdsFormProps (integration)
// ---------------------------------------------------------------------------

describe("buildPdsFormProps", () => {
  it("produces safe defaults from a minimal employee", () => {
    const props = buildPdsFormProps(emptyParams);

    expect(props.agencyName).toBe("Philippine Charity Sweepstakes Office");
    expect(props.employee.lastName).toBe("Dela Cruz");
    expect(props.employee.citizenshipDisplay).toBe("Filipino");
    expect(props.spouse).toBeNull();
    expect(props.children).toEqual([]);
    expect(props.education).toHaveLength(5);
    expect(props.eligibilities).toEqual([]);
    expect(props.workExperience).toEqual([]);
    expect(props.voluntaryWorks).toEqual([]);
    expect(props.trainings).toEqual([]);
    expect(props.skills).toEqual([]);
    expect(props.hobbies).toEqual([]);
    expect(props.distinctions).toEqual([]);
    expect(props.memberships).toEqual([]);
    expect(props.governmentId).toBeNull();
    expect(Object.keys(props.questionnaire ?? {})).toHaveLength(
      PDS_QUESTIONS.length,
    );
  });

  it("maps profile extras, jsonb sections, and the government ID", () => {
    const props = buildPdsFormProps({
      ...emptyParams,
      employee: {
        ...baseEmployee,
        placeOfBirth: "Manila",
        heightM: "1.70",
        weightKg: "65.00",
        sssNo: "34-1234567-8",
        telephoneNo: "8888-0000",
        dualCitizenshipType: "by_birth",
        dualCitizenshipCountry: "Canada",
        specialSkillsHobbies: { skills: ["Photography"], hobbies: ["Chess"] },
        nonAcademicDistinctions: ["Employee of the Year 2022"],
        organizationMemberships: ["Philippine Red Cross"],
        governmentIssuedId: {
          idType: "Driver's License",
          idNo: "N01-23-456789",
          dateIssued: "2023-01-15",
        },
      },
      voluntaryWorks: [
        {
          organizationName: "Red Cross",
          organizationAddress: "Manila",
          dateFrom: "2019-01-01",
          numberOfHours: 40,
          positionNature: "Volunteer",
        },
      ],
      eligibilities: [
        {
          eligibilityName: "Career Service Professional",
          rating: "85.20",
          examDate: "2008-10-19",
          examPlace: "Quezon City",
        },
      ],
    });

    expect(props.employee.placeOfBirth).toBe("Manila");
    expect(props.employee.heightM).toBe("1.70");
    expect(props.employee.citizenshipDisplay).toBe(
      "Filipino / Dual Citizenship (by birth) — Canada",
    );
    expect(props.skills).toEqual(["Photography"]);
    expect(props.hobbies).toEqual(["Chess"]);
    expect(props.distinctions).toEqual(["Employee of the Year 2022"]);
    expect(props.memberships).toEqual(["Philippine Red Cross"]);
    expect(props.governmentId).toEqual({
      idType: "Driver's License",
      idNo: "N01-23-456789",
      dateIssued: "2023-01-15",
      placeIssued: null,
    });
    expect(props.voluntaryWorks).toEqual([
      {
        organization: "Red Cross",
        address: "Manila",
        from: "2019-01-01",
        to: null,
        hours: 40,
        position: "Volunteer",
      },
    ]);
    expect(props.eligibilities).toEqual([
      {
        name: "Career Service Professional",
        rating: "85.20",
        examDate: "2008-10-19",
        examPlace: "Quezon City",
        licenseNo: null,
        licenseValidity: null,
      },
    ]);
  });

  it("treats an all-empty government ID object as null", () => {
    const props = buildPdsFormProps({
      ...emptyParams,
      employee: { ...baseEmployee, governmentIssuedId: {} },
    });
    expect(props.governmentId).toBeNull();
  });
});
