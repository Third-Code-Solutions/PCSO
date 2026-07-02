/**
 * Workforce Reports Server Actions
 * PRD PIM-019 through PIM-028
 *
 * Reports:
 * 1. Retirement Eligibility (PIM-019)
 * 2. Loyalty Award Eligibility (PIM-020)
 * 3. PDS Submission Tracking (PIM-023)
 * 4. Office Clearance Processing (PIM-024)
 * 5. Employee Qualifications (PIM-027)
 */

"use server";

import { db } from "@/lib/db";
import {
  documentRequests,
  employeeDocuments,
  employees,
  pdsUpdateRequests,
  personnelMovementRequests,
  trainingParticipants,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guards";

// ─── Validation Schemas ──────────────────────────────────────────────────────

const RetirementReportFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  eligibilityType: z.enum(["optional", "compulsory", "all"]).default("all"),
  monthsAhead: z.number().min(1).max(60).default(12), // Look ahead window
});

const LoyaltyReportFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  milestone: z
    .enum(["10", "15", "20", "25", "30", "35", "40", "45", "all"])
    .default("all"),
  yearFilter: z.number().optional(), // Filter by specific year
});

const PDSReportFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  submissionStatus: z
    .enum(["submitted", "not_submitted", "all"])
    .default("all"),
});

const ClearanceReportFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  status: z.enum(["active", "resigned", "retired", "all"]).default("all"),
});

const QualificationsReportFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  educationLevel: z.string().optional(),
  eligibility: z.string().optional(),
});

// ─── Report Data Types ───────────────────────────────────────────────────────

interface RetirementEligibility {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  office: string;
  birthDate: string;
  dateHired: string;
  currentAge: number;
  yearsOfService: number;
  eligibilityType: "optional" | "compulsory" | "not_eligible";
  monthsUntilEligible: number;
  eligibilityDate: string;
}

interface LoyaltyAwardEligibility {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  office: string;
  dateHired: string;
  yearsOfService: number;
  milestone: number;
  eligibleYear: number;
}

interface PDSSubmission {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  office: string;
  pdsSubmitted: boolean;
  lastSubmissionDate: string | null;
}

interface ClearanceRecord {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  office: string;
  status: string;
  dateHired: string;
  dateOfSeparation: string | null;
  clearanceStatus: "pending" | "completed" | "not_applicable";
}

interface EmployeeQualification {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  office: string;
  educationLevel: string | null;
  eligibilities: string[]; // Array of eligibility names
  trainings: number; // Count of trainings attended
  yearsOfExperience: number;
}

// ─── Retirement Eligibility Report (PIM-019) ─────────────────────────────────

export async function getRetirementEligibilityReport(
  filters: z.infer<typeof RetirementReportFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = RetirementReportFiltersSchema.parse(filters);

    // Build WHERE conditions
    const conditions = [
      eq(employees.status, "active"), // Only active employees
    ];

    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    // Fetch all active employees with office data
    const allEmployees = await db.query.employees.findMany({
      where: and(...conditions),
      with: {
        office: {
          columns: {
            name: true,
          },
        },
      },
    });

    const today = new Date();
    const lookAheadDate = new Date();
    lookAheadDate.setMonth(lookAheadDate.getMonth() + validated.monthsAhead);

    const results: RetirementEligibility[] = [];

    for (const emp of allEmployees) {
      const birthDate = new Date(emp.birthDate);
      const hireDate = new Date(emp.dateHired);

      // Calculate current age
      const ageMs = today.getTime() - birthDate.getTime();
      const ageYears = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));

      // Calculate years of service
      const serviceMs = today.getTime() - hireDate.getTime();
      const serviceYears = Math.floor(
        serviceMs / (1000 * 60 * 60 * 24 * 365.25),
      );

      // Calculate age at lookAheadDate
      const futureAgeMs = lookAheadDate.getTime() - birthDate.getTime();
      const futureAgeYears = Math.floor(
        futureAgeMs / (1000 * 60 * 60 * 24 * 365.25),
      );

      // Calculate service at lookAheadDate
      const futureServiceMs = lookAheadDate.getTime() - hireDate.getTime();
      const futureServiceYears = Math.floor(
        futureServiceMs / (1000 * 60 * 60 * 24 * 365.25),
      );

      // Determine eligibility type
      let eligibilityType: "optional" | "compulsory" | "not_eligible" =
        "not_eligible";
      let eligibilityDate = "";
      let monthsUntilEligible = 0;

      // Compulsory retirement: age ≥ 65
      const compulsoryRetirementDate = new Date(birthDate);
      compulsoryRetirementDate.setFullYear(
        compulsoryRetirementDate.getFullYear() + 65,
      );

      // Optional retirement: age ≥ 60 AND ≥ 15 years service
      const optionalRetirementByAge = new Date(birthDate);
      optionalRetirementByAge.setFullYear(
        optionalRetirementByAge.getFullYear() + 60,
      );

      const optionalRetirementByService = new Date(hireDate);
      optionalRetirementByService.setFullYear(
        optionalRetirementByService.getFullYear() + 15,
      );

      const optionalRetirementDate = new Date(
        Math.max(
          optionalRetirementByAge.getTime(),
          optionalRetirementByService.getTime(),
        ),
      );

      // Check if currently eligible
      if (ageYears >= 65) {
        eligibilityType = "compulsory";
        eligibilityDate =
          compulsoryRetirementDate.toISOString().split("T")[0] ?? "";
        monthsUntilEligible = 0;
      } else if (ageYears >= 60 && serviceYears >= 15) {
        eligibilityType = "optional";
        eligibilityDate =
          optionalRetirementDate.toISOString().split("T")[0] ?? "";
        monthsUntilEligible = 0;
      } else if (compulsoryRetirementDate <= lookAheadDate) {
        // Will reach compulsory within look-ahead window
        eligibilityType = "compulsory";
        eligibilityDate =
          compulsoryRetirementDate.toISOString().split("T")[0] ?? "";
        monthsUntilEligible = Math.ceil(
          (compulsoryRetirementDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        );
      } else if (optionalRetirementDate <= lookAheadDate) {
        // Will reach optional within look-ahead window
        eligibilityType = "optional";
        eligibilityDate =
          optionalRetirementDate.toISOString().split("T")[0] ?? "";
        monthsUntilEligible = Math.ceil(
          (optionalRetirementDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        );
      }

      // Apply eligibility type filter
      if (
        validated.eligibilityType !== "all" &&
        eligibilityType !== validated.eligibilityType
      ) {
        continue;
      }

      // Only include if eligible now or within look-ahead window
      if (eligibilityType !== "not_eligible") {
        results.push({
          id: emp.id,
          employeeNo: emp.employeeNo,
          fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
          position: emp.positionTitle,
          office: emp.office?.name || "N/A",
          birthDate: emp.birthDate,
          dateHired: emp.dateHired,
          currentAge: ageYears,
          yearsOfService: serviceYears,
          eligibilityType,
          monthsUntilEligible,
          eligibilityDate,
        });
      }
    }

    // Sort by eligibility date (earliest first)
    results.sort(
      (a, b) =>
        new Date(a.eligibilityDate).getTime() -
        new Date(b.eligibilityDate).getTime(),
    );

    return {
      data: results,
      total: results.length,
      filters: validated,
    };
  } catch (error) {
    console.error("Retirement eligibility report error:", error);
    throw error;
  }
}

// ─── Loyalty Award Eligibility Report (PIM-020) ──────────────────────────────

export async function getLoyaltyAwardEligibilityReport(
  filters: z.infer<typeof LoyaltyReportFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = LoyaltyReportFiltersSchema.parse(filters);

    const conditions = [eq(employees.status, "active")];

    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    const allEmployees = await db.query.employees.findMany({
      where: and(...conditions),
      with: {
        office: {
          columns: {
            name: true,
          },
        },
      },
    });

    const today = new Date();
    const currentYear = today.getFullYear();
    const targetYear = validated.yearFilter || currentYear;

    const results: LoyaltyAwardEligibility[] = [];
    const milestones = [10, 15, 20, 25, 30, 35, 40, 45];

    for (const emp of allEmployees) {
      const hireDate = new Date(emp.dateHired);
      const serviceMs = today.getTime() - hireDate.getTime();
      const serviceYears = Math.floor(
        serviceMs / (1000 * 60 * 60 * 24 * 365.25),
      );

      for (const milestone of milestones) {
        // Skip if milestone filter specified and doesn't match
        if (
          validated.milestone !== "all" &&
          milestone !== parseInt(validated.milestone)
        ) {
          continue;
        }

        // Calculate the year this employee reaches this milestone
        const milestoneDate = new Date(hireDate);
        milestoneDate.setFullYear(milestoneDate.getFullYear() + milestone);
        const milestoneYear = milestoneDate.getFullYear();

        // Include if:
        // 1. Already reached this milestone (serviceYears >= milestone)
        // 2. Will reach this milestone in the target year (milestoneYear === targetYear)
        if (serviceYears >= milestone || milestoneYear === targetYear) {
          results.push({
            id: emp.id,
            employeeNo: emp.employeeNo,
            fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
            position: emp.positionTitle,
            office: emp.office?.name || "N/A",
            dateHired: emp.dateHired,
            yearsOfService: serviceYears,
            milestone,
            eligibleYear: milestoneYear,
          });
        }
      }
    }

    // Sort by milestone (ascending), then by eligible year
    results.sort((a, b) => {
      if (a.milestone !== b.milestone) return a.milestone - b.milestone;
      return a.eligibleYear - b.eligibleYear;
    });

    return {
      data: results,
      total: results.length,
      filters: validated,
    };
  } catch (error) {
    console.error("Loyalty award eligibility report error:", error);
    throw error;
  }
}

// ─── PDS Submission Tracking Report (PIM-023) ────────────────────────────────

export async function getPDSSubmissionReport(
  filters: z.infer<typeof PDSReportFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = PDSReportFiltersSchema.parse(filters);

    const conditions = [eq(employees.status, "active")];

    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    const allEmployees = await db.query.employees.findMany({
      where: and(...conditions),
      with: {
        office: {
          columns: {
            name: true,
          },
        },
      },
    });

    // PIM-023: an employee's PDS counts as submitted when they have either
    //   (a) an HRD-approved PDS document in their 201 file (PIM-004), or
    //   (b) an HR-approved/processed PDS update request (EPM-012).
    const [pdsDocRows, pdsUpdateRows] = await Promise.all([
      db
        .select({
          employeeId: employeeDocuments.employeeId,
          approvedAt: employeeDocuments.approvedAt,
          uploadedAt: employeeDocuments.uploadedAt,
        })
        .from(employeeDocuments)
        .where(
          and(
            eq(employeeDocuments.documentTypeCode, "PDS"),
            eq(employeeDocuments.status, "approved"),
          ),
        ),
      db
        .select({
          employeeId: pdsUpdateRequests.employeeId,
          appliedAt: pdsUpdateRequests.appliedAt,
          hrApprovedAt: pdsUpdateRequests.hrApprovedAt,
        })
        .from(pdsUpdateRequests)
        .where(inArray(pdsUpdateRequests.status, ["approved", "processed"])),
    ]);

    // has entry = submitted; value = latest known submission timestamp.
    const lastSubmissionByEmployee = new Map<string, Date | null>();
    const noteSubmission = (employeeId: string, at: Date | null) => {
      const current = lastSubmissionByEmployee.get(employeeId);
      if (current === undefined) {
        lastSubmissionByEmployee.set(employeeId, at);
        return;
      }
      if (at && (current === null || at > current)) {
        lastSubmissionByEmployee.set(employeeId, at);
      }
    };
    for (const row of pdsDocRows) {
      noteSubmission(row.employeeId, row.approvedAt ?? row.uploadedAt);
    }
    for (const row of pdsUpdateRows) {
      noteSubmission(row.employeeId, row.appliedAt ?? row.hrApprovedAt);
    }

    const results: PDSSubmission[] = allEmployees.map((emp) => {
      const submission = lastSubmissionByEmployee.get(emp.id);
      return {
        id: emp.id,
        employeeNo: emp.employeeNo,
        fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
        position: emp.positionTitle,
        office: emp.office?.name || "N/A",
        pdsSubmitted: submission !== undefined,
        lastSubmissionDate: submission
          ? (submission.toISOString().split("T")[0] ?? null)
          : null,
      };
    });

    // Apply submission status filter
    const filteredResults =
      validated.submissionStatus === "all"
        ? results
        : results.filter((r) =>
            validated.submissionStatus === "submitted"
              ? r.pdsSubmitted
              : !r.pdsSubmitted,
          );

    return {
      data: filteredResults,
      total: filteredResults.length,
      filters: validated,
    };
  } catch (error) {
    console.error("PDS submission report error:", error);
    throw error;
  }
}

// ─── Office Clearance Processing Report (PIM-024) ────────────────────────────

export async function getClearanceReport(
  filters: z.infer<typeof ClearanceReportFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = ClearanceReportFiltersSchema.parse(filters);

    const conditions = [];

    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    // Status filter
    if (validated.status !== "all") {
      conditions.push(eq(employees.status, validated.status));
    }

    const allEmployees = await db.query.employees.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        office: {
          columns: {
            name: true,
          },
        },
      },
    });

    // PIM-024: clearance state comes from CLEARANCE document requests
    // (Section 12.4); separation date comes from approved/processed
    // resignation and optional-retirement movement requests (EPM-011).
    const [clearanceRequests, separationMovements] = await Promise.all([
      db
        .select({
          employeeId: documentRequests.employeeId,
          status: documentRequests.status,
        })
        .from(documentRequests)
        .where(eq(documentRequests.documentType, "CLEARANCE")),
      db
        .select({
          employeeId: personnelMovementRequests.employeeId,
          effectiveDate: personnelMovementRequests.effectiveDate,
        })
        .from(personnelMovementRequests)
        .where(
          and(
            inArray(personnelMovementRequests.movementType, [
              "resignation",
              "optional_retirement",
            ]),
            inArray(personnelMovementRequests.status, [
              "approved",
              "processed",
            ]),
          ),
        ),
    ]);

    // A released clearance request = completed; any other non-disapproved
    // request = clearance in progress (pending).
    const clearanceStateByEmployee = new Map<string, "pending" | "completed">();
    for (const req of clearanceRequests) {
      if (req.status === "released") {
        clearanceStateByEmployee.set(req.employeeId, "completed");
      } else if (
        req.status !== "disapproved" &&
        clearanceStateByEmployee.get(req.employeeId) !== "completed"
      ) {
        clearanceStateByEmployee.set(req.employeeId, "pending");
      }
    }

    // Latest effective separation date per employee (date columns are
    // ISO strings, so string comparison is chronological).
    const separationDateByEmployee = new Map<string, string>();
    for (const mv of separationMovements) {
      const existing = separationDateByEmployee.get(mv.employeeId);
      if (!existing || mv.effectiveDate > existing) {
        separationDateByEmployee.set(mv.employeeId, mv.effectiveDate);
      }
    }

    const results: ClearanceRecord[] = allEmployees.map((emp) => {
      const isSeparated =
        emp.status === "resigned" ||
        emp.status === "retired" ||
        emp.status === "terminated";

      const trackedState = clearanceStateByEmployee.get(emp.id);
      const clearanceStatus: "pending" | "completed" | "not_applicable" =
        trackedState ?? (isSeparated ? "pending" : "not_applicable");

      return {
        id: emp.id,
        employeeNo: emp.employeeNo,
        fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
        position: emp.positionTitle,
        office: emp.office?.name || "N/A",
        status: emp.status,
        dateHired: emp.dateHired,
        dateOfSeparation: separationDateByEmployee.get(emp.id) ?? null,
        clearanceStatus,
      };
    });

    return {
      data: results,
      total: results.length,
      filters: validated,
    };
  } catch (error) {
    console.error("Clearance report error:", error);
    throw error;
  }
}

// ─── Employee Qualifications Report (PIM-027) ────────────────────────────────

export async function getEmployeeQualificationsReport(
  filters: z.infer<typeof QualificationsReportFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = QualificationsReportFiltersSchema.parse(filters);

    const conditions = [eq(employees.status, "active")];

    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    const allEmployees = await db.query.employees.findMany({
      where: and(...conditions),
      with: {
        office: {
          columns: {
            name: true,
          },
        },
      },
    });

    // PIM-027: trainings attended come from LDM participant records.
    // NOTE: per-employee education and eligibility records do not exist in
    // the schema yet (only FM lookup tables + applicant-level JSONB in
    // recruitment) — those columns stay null/empty until a 201-file
    // education/eligibility store lands.
    const participantRows = await db
      .select({ employeeId: trainingParticipants.employeeId })
      .from(trainingParticipants)
      .where(inArray(trainingParticipants.status, ["attended", "completed"]));

    const trainingCountByEmployee = new Map<string, number>();
    for (const row of participantRows) {
      trainingCountByEmployee.set(
        row.employeeId,
        (trainingCountByEmployee.get(row.employeeId) ?? 0) + 1,
      );
    }

    const today = new Date();

    const results: EmployeeQualification[] = allEmployees.map((emp) => {
      const hireDate = new Date(emp.dateHired);
      const serviceMs = today.getTime() - hireDate.getTime();
      const yearsOfExperience = Math.floor(
        serviceMs / (1000 * 60 * 60 * 24 * 365.25),
      );

      return {
        id: emp.id,
        employeeNo: emp.employeeNo,
        fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
        position: emp.positionTitle,
        office: emp.office?.name || "N/A",
        // No per-employee education/eligibility records yet — see note above.
        educationLevel: null,
        eligibilities: [],
        trainings: trainingCountByEmployee.get(emp.id) ?? 0,
        yearsOfExperience,
      };
    });

    // Education/eligibility filters operate on the (currently null/empty)
    // linked records so they become effective as soon as those data land.
    const educationFilter = validated.educationLevel;
    const eligibilityFilter = validated.eligibility;
    let filteredResults = results;
    if (educationFilter) {
      filteredResults = filteredResults.filter(
        (r) => r.educationLevel === educationFilter,
      );
    }
    if (eligibilityFilter) {
      filteredResults = filteredResults.filter((r) =>
        r.eligibilities.includes(eligibilityFilter),
      );
    }

    return {
      data: filteredResults,
      total: filteredResults.length,
      filters: validated,
    };
  } catch (error) {
    console.error("Employee qualifications report error:", error);
    throw error;
  }
}

// ─── Get All Offices for Filters ─────────────────────────────────────────────

export async function getOfficesForReportFilters() {
  try {
    await requirePermission("reports", "view");
    const allOffices = await db.query.offices.findMany({
      columns: {
        id: true,
        name: true,
      },
      orderBy: (offices, { asc }) => [asc(offices.name)],
    });

    return allOffices;
  } catch (error) {
    console.error("Get offices for filters error:", error);
    throw error;
  }
}
