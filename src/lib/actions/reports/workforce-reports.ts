/**
 * Workforce Reports Server Actions
 * PRD PIM-019 through PIM-028 · TOR 1.3.x / 1.2.29 PIMM reports
 *
 * Reports:
 * 1. Retirement Eligibility (PIM-019)
 * 2. Loyalty Award Eligibility (PIM-020)
 * 3. PDS Submission Tracking (PIM-023)
 * 4. Office Clearance Processing (PIM-024)
 * 5. Employee Qualifications (PIM-027 / TOR 1.3.4)
 * 6. Personnel Categories — organic vs non-organic listing (TOR 1.3.3)
 * 7. Personnel Complement (TOR 1.3.21)
 * 8. NAP Archival — separated employees (TOR 1.3.19)
 * 9. HR Accomplishments per processor (TOR 1.3.24)
 * 10. Step Increment Eligibility PIMM surface (TOR 1.3.15)
 * 11. Employee Ad Hoc Report Builder (TOR 1.3.26)
 * 12. RPM Applications Ad Hoc Report (TOR 1.2.29)
 */

"use server";

import { db } from "@/lib/db";
import {
  appointments,
  applications,
  documentRequests,
  employeeDocuments,
  employeeEducation,
  employeeEligibilities,
  employeeExternalTrainings,
  employees,
  offices,
  pdsUpdateRequests,
  personnelMovementRequests,
  plantillaPositions,
  trainingParticipants,
  vacancies,
} from "@/lib/db/schema";
import { eq, and, inArray, isNull, isNotNull, or, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import {
  ORGANIC_APPOINTMENT_TYPES,
  NON_ORGANIC_APPOINTMENT_TYPES,
} from "@/lib/constants/appointment-types";
import {
  shapeAdhocReport,
  resolveAdhocColumns,
  appointmentCategoryLabel,
  appointmentTypeLabel,
  highestEducationLabel,
  applicantNameFromPersonalInfo,
  EMPLOYEE_ADHOC_CATALOG,
  APPLICATION_ADHOC_CATALOG,
  type EmployeeAdhocRow,
  type ApplicationAdhocRow,
} from "@/lib/utils/pimm/adhoc-report";
import { getEligibleEmployeesForStepIncrement } from "@/app/(dashboard)/performance/queries";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function formatFullName(emp: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  return `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`;
}

/** Employee statuses that mean the person has separated from PCSO. */
const SEPARATED_STATUSES = [
  "resigned",
  "retired",
  "terminated",
  "deceased",
] as const;

/** TOR 1.3.20 / EWB-001 loyalty milestones (years of service). */
const LOYALTY_MILESTONES = [10, 15, 20, 25, 30, 35, 40, 45] as const;

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

const PersonnelCategoriesFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  category: z.enum(["organic", "non_organic", "all"]).default("all"),
  status: z.enum(["active", "all"]).default("active"),
});

const NapArchivalFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  separationMode: z
    .enum(["resigned", "retired", "terminated", "deceased", "archived", "all"])
    .default("all"),
});

const HRAccomplishmentFiltersSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

const StepIncrementReportFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
});

const EmployeeAdhocFiltersSchema = z.object({
  officeId: z.string().uuid().optional(),
  status: z
    .enum([
      "active",
      "on_leave",
      "suspended",
      "resigned",
      "retired",
      "terminated",
      "deceased",
      "all",
    ])
    .default("active"),
  category: z.enum(["organic", "non_organic", "all"]).default("all"),
  columns: z.array(z.string().max(50)).max(30).default([]),
});

const ApplicationsAdhocFiltersSchema = z.object({
  vacancyId: z.string().uuid().optional(),
  status: z
    .enum([
      "incomplete",
      "submitted",
      "under_review",
      "qualified",
      "not_qualified",
      "shortlisted",
      "for_exam",
      "for_interview",
      "results_released",
      "not_selected",
      "appointed",
      "withdrawn",
      "all",
    ])
    .default("all"),
  columns: z.array(z.string().max(50)).max(30).default([]),
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

interface PersonnelCategoryRecord {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  office: string;
  appointmentType: string; // raw enum value
  appointmentTypeLabel: string; // human label
  category: "Organic" | "Non-Organic";
  status: string;
  dateHired: string;
}

interface PersonnelComplementOfficeRow {
  officeId: string;
  officeName: string;
  officeGroup: "head_office" | "branch";
  totalEmployees: number;
  maleCount: number;
  femaleCount: number;
  otherGenderCount: number;
  plantillaTotal: number;
  plantillaFilled: number;
  plantillaVacant: number;
}

interface NapArchivalRecord {
  id: string;
  employeeNo: string;
  fullName: string;
  office: string;
  yearHired: number;
  yearSeparated: number | null;
  separationMode: string;
  lastPosition: string;
  salaryGrade: number;
  step: number;
  stepIncrementCount: number;
  loyaltyMilestonesReached: number[];
}

interface HRAccomplishmentRecord {
  processorId: string;
  processorName: string;
  docRequestsHandled: number;
  docRequestsReleased: number;
  docRequestsReady: number;
  docRequestsDisapproved: number;
  docRequestsByType: Record<string, number>;
  pdsUpdatesApproved: number;
  documentsValidated: number;
  totalActions: number;
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
            // FM-020 seeds the PDS scan as PDS_DOC; "PDS" kept for legacy rows.
            inArray(employeeDocuments.documentTypeCode, ["PDS_DOC", "PDS"]),
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

    const employeeIds = allEmployees.map((emp) => emp.id);

    // PIM-027 / TOR 1.3.4: trainings attended come from LDM participant
    // records plus externally-declared trainings (PDS Section VII);
    // education and eligibility come from the 201-file child tables
    // (employee_education / employee_eligibilities).
    const [participantRows, educationRows, eligibilityRows, externalRows] =
      await Promise.all([
        db
          .select({ employeeId: trainingParticipants.employeeId })
          .from(trainingParticipants)
          .where(
            inArray(trainingParticipants.status, ["attended", "completed"]),
          ),
        employeeIds.length > 0
          ? db
              .select({
                employeeId: employeeEducation.employeeId,
                level: employeeEducation.level,
                degreeCourse: employeeEducation.degreeCourse,
              })
              .from(employeeEducation)
              .where(
                and(
                  inArray(employeeEducation.employeeId, employeeIds),
                  isNull(employeeEducation.deletedAt),
                ),
              )
          : Promise.resolve([]),
        employeeIds.length > 0
          ? db
              .select({
                employeeId: employeeEligibilities.employeeId,
                eligibilityName: employeeEligibilities.eligibilityName,
              })
              .from(employeeEligibilities)
              .where(
                and(
                  inArray(employeeEligibilities.employeeId, employeeIds),
                  isNull(employeeEligibilities.deletedAt),
                ),
              )
          : Promise.resolve([]),
        employeeIds.length > 0
          ? db
              .select({ employeeId: employeeExternalTrainings.employeeId })
              .from(employeeExternalTrainings)
              .where(
                and(
                  inArray(employeeExternalTrainings.employeeId, employeeIds),
                  isNull(employeeExternalTrainings.deletedAt),
                ),
              )
          : Promise.resolve([]),
      ]);

    const trainingCountByEmployee = new Map<string, number>();
    for (const row of participantRows) {
      trainingCountByEmployee.set(
        row.employeeId,
        (trainingCountByEmployee.get(row.employeeId) ?? 0) + 1,
      );
    }
    for (const row of externalRows) {
      trainingCountByEmployee.set(
        row.employeeId,
        (trainingCountByEmployee.get(row.employeeId) ?? 0) + 1,
      );
    }

    const educationByEmployee = new Map<
      string,
      { level: string; degreeCourse: string | null }[]
    >();
    for (const row of educationRows) {
      const list = educationByEmployee.get(row.employeeId) ?? [];
      list.push({ level: row.level, degreeCourse: row.degreeCourse });
      educationByEmployee.set(row.employeeId, list);
    }

    const eligibilitiesByEmployee = new Map<string, string[]>();
    for (const row of eligibilityRows) {
      const list = eligibilitiesByEmployee.get(row.employeeId) ?? [];
      list.push(row.eligibilityName);
      eligibilitiesByEmployee.set(row.employeeId, list);
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
        educationLevel:
          highestEducationLabel(educationByEmployee.get(emp.id) ?? []) || null,
        eligibilities: eligibilitiesByEmployee.get(emp.id) ?? [],
        trainings: trainingCountByEmployee.get(emp.id) ?? 0,
        yearsOfExperience,
      };
    });

    // Case-insensitive matching so "college" matches "College — BSIT" and a
    // partial eligibility name matches any of the employee's eligibilities.
    const educationFilter = validated.educationLevel?.trim().toLowerCase();
    const eligibilityFilter = validated.eligibility?.trim().toLowerCase();
    let filteredResults = results;
    if (educationFilter) {
      filteredResults = filteredResults.filter((r) =>
        (r.educationLevel ?? "").toLowerCase().includes(educationFilter),
      );
    }
    if (eligibilityFilter) {
      filteredResults = filteredResults.filter((r) =>
        r.eligibilities.some((name) =>
          name.toLowerCase().includes(eligibilityFilter),
        ),
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

// ─── Get Published Vacancies for Filters (Ad Hoc RPM report) ─────────────────

export async function getVacanciesForReportFilters() {
  try {
    await requirePermission("reports", "view");
    const rows = await db
      .select({
        id: vacancies.id,
        cscForm9Number: vacancies.cscForm9Number,
        positionTitle: plantillaPositions.positionTitle,
      })
      .from(vacancies)
      .innerJoin(
        plantillaPositions,
        eq(vacancies.positionId, plantillaPositions.id),
      )
      .where(isNull(vacancies.deletedAt));

    return rows
      .map((v) => ({
        id: v.id,
        label: `${v.cscForm9Number} — ${v.positionTitle}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    console.error("Get vacancies for filters error:", error);
    throw error;
  }
}

// ─── Personnel Categories Report (TOR 1.3.3) ─────────────────────────────────
//
// Organic vs non-organic categorized employee listing. Category derivation
// uses the fail-safe organic ALLOWLIST from constants/appointment-types.ts.

export async function getPersonnelCategoriesReport(
  filters: z.infer<typeof PersonnelCategoriesFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = PersonnelCategoriesFiltersSchema.parse(filters);

    const conditions = [isNull(employees.deletedAt)];

    if (validated.status === "active") {
      conditions.push(eq(employees.status, "active"));
    }
    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }
    if (validated.category === "organic") {
      conditions.push(
        inArray(employees.appointmentType, [...ORGANIC_APPOINTMENT_TYPES]),
      );
    } else if (validated.category === "non_organic") {
      conditions.push(
        inArray(employees.appointmentType, [...NON_ORGANIC_APPOINTMENT_TYPES]),
      );
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

    const results: PersonnelCategoryRecord[] = allEmployees.map((emp) => ({
      id: emp.id,
      employeeNo: emp.employeeNo,
      fullName: formatFullName(emp),
      position: emp.positionTitle,
      office: emp.office?.name || "N/A",
      appointmentType: emp.appointmentType,
      appointmentTypeLabel: appointmentTypeLabel(emp.appointmentType),
      category: appointmentCategoryLabel(emp.appointmentType),
      status: emp.status,
      dateHired: emp.dateHired,
    }));

    // TOR 1.3.3 lists organic and non-organic personnel separately —
    // organic first, alphabetical within each category.
    results.sort((a, b) => {
      if (a.category !== b.category) return a.category === "Organic" ? -1 : 1;
      return a.fullName.localeCompare(b.fullName);
    });

    const countByTypeLabel = new Map<string, number>();
    let organicTotal = 0;
    for (const record of results) {
      countByTypeLabel.set(
        record.appointmentTypeLabel,
        (countByTypeLabel.get(record.appointmentTypeLabel) ?? 0) + 1,
      );
      if (record.category === "Organic") organicTotal++;
    }

    return {
      data: results,
      total: results.length,
      summary: {
        organicTotal,
        nonOrganicTotal: results.length - organicTotal,
        byAppointmentType: Array.from(countByTypeLabel.entries()).map(
          ([label, count]) => ({ label, count }),
        ),
      },
      filters: validated,
    };
  } catch (error) {
    console.error("Personnel categories report error:", error);
    throw error;
  }
}

// ─── Personnel Complement Report (TOR 1.3.21) ────────────────────────────────
//
// Totals, male/female split, plantilla filled/vacant, per-office counts, and
// Main (Head) Office vs branches split derived from the offices hierarchy.

export async function getPersonnelComplementReport() {
  try {
    await requirePermission("reports", "view");

    const [employeeRows, officeRows, plantillaRows] = await Promise.all([
      db
        .select({
          id: employees.id,
          gender: employees.gender,
          officeId: employees.officeId,
        })
        .from(employees)
        .where(
          and(eq(employees.status, "active"), isNull(employees.deletedAt)),
        ),
      db
        .select({
          id: offices.id,
          name: offices.name,
          code: offices.code,
          parentId: offices.parentId,
        })
        .from(offices)
        .where(isNull(offices.deletedAt)),
      db
        .select({
          id: plantillaPositions.id,
          officeId: plantillaPositions.officeId,
          isFilled: plantillaPositions.isFilled,
        })
        .from(plantillaPositions)
        .where(isNull(plantillaPositions.deletedAt)),
    ]);

    // Head Office vs Branch classification: walk each office up to its root
    // ancestor. PCSO branches (NCL, STBR, Visayas, Mindanao) are root-level
    // offices named "Branch – X" (P0-005 hierarchy); everything else rolls
    // up to Head Office.
    const officeById = new Map(officeRows.map((o) => [o.id, o]));
    const BRANCH_PATTERN = /branch|\bncl\b|\bstbr\b|visayas|mindanao/i;
    const groupCache = new Map<string, "head_office" | "branch">();

    const officeGroupOf = (officeId: string): "head_office" | "branch" => {
      const cached = groupCache.get(officeId);
      if (cached) return cached;

      let current = officeById.get(officeId);
      const visited = new Set<string>();
      while (current && current.parentId && !visited.has(current.parentId)) {
        visited.add(current.id);
        const parent = officeById.get(current.parentId);
        if (!parent) break;
        current = parent;
      }

      const group: "head_office" | "branch" =
        current && BRANCH_PATTERN.test(`${current.name} ${current.code}`)
          ? "branch"
          : "head_office";
      groupCache.set(officeId, group);
      return group;
    };

    interface OfficeAgg {
      total: number;
      male: number;
      female: number;
      other: number;
      plantillaTotal: number;
      plantillaFilled: number;
    }
    const aggByOffice = new Map<string, OfficeAgg>();
    const aggFor = (key: string): OfficeAgg => {
      let agg = aggByOffice.get(key);
      if (!agg) {
        agg = {
          total: 0,
          male: 0,
          female: 0,
          other: 0,
          plantillaTotal: 0,
          plantillaFilled: 0,
        };
        aggByOffice.set(key, agg);
      }
      return agg;
    };

    // "" bucket = employees with no office assignment.
    for (const emp of employeeRows) {
      const agg = aggFor(emp.officeId ?? "");
      agg.total++;
      if (emp.gender === "male") agg.male++;
      else if (emp.gender === "female") agg.female++;
      else agg.other++;
    }
    for (const pos of plantillaRows) {
      const agg = aggFor(pos.officeId);
      agg.plantillaTotal++;
      if (pos.isFilled) agg.plantillaFilled++;
    }

    const byOffice: PersonnelComplementOfficeRow[] = Array.from(
      aggByOffice.entries(),
    ).map(([officeId, agg]) => {
      const office = officeId ? officeById.get(officeId) : undefined;
      return {
        officeId,
        officeName: office?.name ?? "Unassigned",
        officeGroup: officeId ? officeGroupOf(officeId) : "head_office",
        totalEmployees: agg.total,
        maleCount: agg.male,
        femaleCount: agg.female,
        otherGenderCount: agg.other,
        plantillaTotal: agg.plantillaTotal,
        plantillaFilled: agg.plantillaFilled,
        plantillaVacant: agg.plantillaTotal - agg.plantillaFilled,
      };
    });
    byOffice.sort((a, b) => a.officeName.localeCompare(b.officeName));

    let maleCount = 0;
    let femaleCount = 0;
    let otherGenderCount = 0;
    for (const emp of employeeRows) {
      if (emp.gender === "male") maleCount++;
      else if (emp.gender === "female") femaleCount++;
      else otherGenderCount++;
    }
    const plantillaFilled = plantillaRows.filter((p) => p.isFilled).length;

    let headOfficeEmployees = 0;
    let branchEmployees = 0;
    let unassignedEmployees = 0;
    for (const row of byOffice) {
      if (row.officeId === "") {
        unassignedEmployees += row.totalEmployees;
      } else if (row.officeGroup === "branch") {
        branchEmployees += row.totalEmployees;
      } else {
        headOfficeEmployees += row.totalEmployees;
      }
    }

    return {
      summary: {
        totalEmployees: employeeRows.length,
        maleCount,
        femaleCount,
        otherGenderCount,
        plantillaTotal: plantillaRows.length,
        plantillaFilled,
        plantillaVacant: plantillaRows.length - plantillaFilled,
        headOfficeEmployees,
        branchEmployees,
        unassignedEmployees,
      },
      byOffice,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Personnel complement report error:", error);
    throw error;
  }
}

// ─── NAP Archival Report (TOR 1.3.19) ────────────────────────────────────────
//
// Separated employees (separated status OR soft-deleted record) with hire /
// separation years, mode of separation, last position, step increment count
// (from appointment history), and loyalty milestones reached. Deliberately
// INCLUDES soft-deleted employee records — NAP archival covers them.

export async function getNapArchivalReport(
  filters: z.infer<typeof NapArchivalFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = NapArchivalFiltersSchema.parse(filters);

    const conditions = [
      or(
        inArray(employees.status, [...SEPARATED_STATUSES]),
        isNotNull(employees.deletedAt),
      ),
    ];
    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    const separatedEmployees = await db.query.employees.findMany({
      where: and(...conditions),
      with: {
        office: {
          columns: {
            name: true,
          },
        },
      },
    });

    const ids = separatedEmployees.map((emp) => emp.id);

    const [appointmentRows, separationMovements] = await Promise.all([
      ids.length > 0
        ? db
            .select({
              employeeId: appointments.employeeId,
              effectivityDate: appointments.effectivityDate,
              salaryGrade: appointments.salaryGrade,
              step: appointments.step,
            })
            .from(appointments)
            .where(inArray(appointments.employeeId, ids))
        : Promise.resolve([]),
      ids.length > 0
        ? db
            .select({
              employeeId: personnelMovementRequests.employeeId,
              effectiveDate: personnelMovementRequests.effectiveDate,
            })
            .from(personnelMovementRequests)
            .where(
              and(
                inArray(personnelMovementRequests.employeeId, ids),
                inArray(personnelMovementRequests.movementType, [
                  "resignation",
                  "optional_retirement",
                ]),
                inArray(personnelMovementRequests.status, [
                  "approved",
                  "processed",
                ]),
              ),
            )
        : Promise.resolve([]),
    ]);

    // Appointment history per employee, chronologically ascending.
    const historyByEmployee = new Map<
      string,
      { effectivityDate: string; salaryGrade: number; step: number }[]
    >();
    for (const row of appointmentRows) {
      const list = historyByEmployee.get(row.employeeId) ?? [];
      list.push({
        effectivityDate: row.effectivityDate,
        salaryGrade: row.salaryGrade,
        step: row.step,
      });
      historyByEmployee.set(row.employeeId, list);
    }
    for (const list of historyByEmployee.values()) {
      list.sort((a, b) => a.effectivityDate.localeCompare(b.effectivityDate));
    }

    // Step increments = same-grade step increases between consecutive
    // appointments. Promotions (grade changes) reset the step and do not
    // count. dateLastIncrement guarantees at least one recorded increment.
    const countStepIncrements = (
      history: { salaryGrade: number; step: number }[],
    ): number => {
      let increments = 0;
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1]!;
        const curr = history[i]!;
        if (curr.salaryGrade === prev.salaryGrade && curr.step > prev.step) {
          increments++;
        }
      }
      return increments;
    };

    // Latest effective separation date per employee (date columns are ISO
    // strings, so string comparison is chronological).
    const separationDateByEmployee = new Map<string, string>();
    for (const mv of separationMovements) {
      const existing = separationDateByEmployee.get(mv.employeeId);
      if (!existing || mv.effectiveDate > existing) {
        separationDateByEmployee.set(mv.employeeId, mv.effectiveDate);
      }
    }

    const results: NapArchivalRecord[] = separatedEmployees.map((emp) => {
      const isSeparatedStatus = (
        SEPARATED_STATUSES as readonly string[]
      ).includes(emp.status);
      const separationMode = isSeparatedStatus ? emp.status : "archived";

      const movementDate = separationDateByEmployee.get(emp.id) ?? null;
      const deletedDate = emp.deletedAt
        ? (emp.deletedAt.toISOString().split("T")[0] ?? null)
        : null;
      const separationDate = movementDate ?? deletedDate;
      const yearSeparated = separationDate
        ? new Date(separationDate).getFullYear()
        : null;

      const hireDate = new Date(emp.dateHired);
      const serviceEnd = separationDate ? new Date(separationDate) : new Date();
      const serviceYears = Math.floor(
        (serviceEnd.getTime() - hireDate.getTime()) /
          (1000 * 60 * 60 * 24 * 365.25),
      );
      const loyaltyMilestonesReached = LOYALTY_MILESTONES.filter(
        (milestone) => serviceYears >= milestone,
      );

      const fromHistory = countStepIncrements(
        historyByEmployee.get(emp.id) ?? [],
      );
      const stepIncrementCount = Math.max(
        fromHistory,
        emp.dateLastIncrement ? 1 : 0,
      );

      return {
        id: emp.id,
        employeeNo: emp.employeeNo,
        fullName: formatFullName(emp),
        office: emp.office?.name || "N/A",
        yearHired: hireDate.getFullYear(),
        yearSeparated,
        separationMode,
        lastPosition: emp.positionTitle,
        salaryGrade: emp.salaryGrade,
        step: emp.step,
        stepIncrementCount,
        loyaltyMilestonesReached: [...loyaltyMilestonesReached],
      };
    });

    const filteredResults =
      validated.separationMode === "all"
        ? results
        : results.filter((r) => r.separationMode === validated.separationMode);

    // Most recent separations first; unknown years last.
    filteredResults.sort((a, b) => {
      const aYear = a.yearSeparated ?? 0;
      const bYear = b.yearSeparated ?? 0;
      if (aYear !== bYear) return bYear - aYear;
      return a.fullName.localeCompare(b.fullName);
    });

    return {
      data: filteredResults,
      total: filteredResults.length,
      filters: validated,
    };
  } catch (error) {
    console.error("NAP archival report error:", error);
    throw error;
  }
}

// ─── HR Accomplishment Report (TOR 1.3.24) ───────────────────────────────────
//
// Per-HR-processor statistics for a date range: document requests handled
// (by type and outcome), PDS update requests approved, and 201-file document
// uploads validated. Rejected uploads are excluded (no rejection timestamp).

export async function getHRAccomplishmentReport(
  filters: z.infer<typeof HRAccomplishmentFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = HRAccomplishmentFiltersSchema.parse(filters);

    if (validated.dateFrom > validated.dateTo) {
      throw new Error("Start date must be on or before end date.");
    }

    const fromDate = new Date(`${validated.dateFrom}T00:00:00.000`);
    const toDate = new Date(`${validated.dateTo}T23:59:59.999`);

    const [docRows, pdsRows, validationRows] = await Promise.all([
      db
        .select({
          assignedToId: documentRequests.assignedToId,
          documentType: documentRequests.documentType,
          processedAt: documentRequests.processedAt,
          readyAt: documentRequests.readyAt,
          releasedAt: documentRequests.releasedAt,
          disapprovedAt: documentRequests.disapprovedAt,
        })
        .from(documentRequests)
        .where(
          and(
            isNotNull(documentRequests.assignedToId),
            or(
              and(
                gte(documentRequests.processedAt, fromDate),
                lte(documentRequests.processedAt, toDate),
              ),
              and(
                gte(documentRequests.readyAt, fromDate),
                lte(documentRequests.readyAt, toDate),
              ),
              and(
                gte(documentRequests.releasedAt, fromDate),
                lte(documentRequests.releasedAt, toDate),
              ),
              and(
                gte(documentRequests.disapprovedAt, fromDate),
                lte(documentRequests.disapprovedAt, toDate),
              ),
            ),
          ),
        ),
      db
        .select({ hrReviewerId: pdsUpdateRequests.hrReviewerId })
        .from(pdsUpdateRequests)
        .where(
          and(
            isNotNull(pdsUpdateRequests.hrReviewerId),
            inArray(pdsUpdateRequests.status, ["approved", "processed"]),
            gte(pdsUpdateRequests.hrApprovedAt, fromDate),
            lte(pdsUpdateRequests.hrApprovedAt, toDate),
          ),
        ),
      db
        .select({ approvedById: employeeDocuments.approvedById })
        .from(employeeDocuments)
        .where(
          and(
            isNotNull(employeeDocuments.approvedById),
            eq(employeeDocuments.status, "approved"),
            gte(employeeDocuments.approvedAt, fromDate),
            lte(employeeDocuments.approvedAt, toDate),
          ),
        ),
    ]);

    interface MutableStats {
      handled: number;
      released: number;
      ready: number;
      disapproved: number;
      byType: Record<string, number>;
      pdsApproved: number;
      documentsValidated: number;
    }
    const statsByProcessor = new Map<string, MutableStats>();
    const statsFor = (processorId: string): MutableStats => {
      let stats = statsByProcessor.get(processorId);
      if (!stats) {
        stats = {
          handled: 0,
          released: 0,
          ready: 0,
          disapproved: 0,
          byType: {},
          pdsApproved: 0,
          documentsValidated: 0,
        };
        statsByProcessor.set(processorId, stats);
      }
      return stats;
    };

    const inRange = (value: Date | null): boolean =>
      value !== null && value >= fromDate && value <= toDate;

    for (const row of docRows) {
      if (!row.assignedToId) continue;
      const stats = statsFor(row.assignedToId);
      stats.handled++;
      stats.byType[row.documentType] =
        (stats.byType[row.documentType] ?? 0) + 1;
      if (inRange(row.releasedAt)) stats.released++;
      if (inRange(row.readyAt)) stats.ready++;
      if (inRange(row.disapprovedAt)) stats.disapproved++;
    }
    for (const row of pdsRows) {
      if (row.hrReviewerId) statsFor(row.hrReviewerId).pdsApproved++;
    }
    for (const row of validationRows) {
      if (row.approvedById) statsFor(row.approvedById).documentsValidated++;
    }

    const processorIds = Array.from(statsByProcessor.keys());
    const processorRows =
      processorIds.length > 0
        ? await db
            .select({
              id: employees.id,
              firstName: employees.firstName,
              middleName: employees.middleName,
              lastName: employees.lastName,
              suffix: employees.suffix,
            })
            .from(employees)
            .where(inArray(employees.id, processorIds))
        : [];
    const nameById = new Map(
      processorRows.map((p) => [p.id, formatFullName(p)]),
    );

    const results: HRAccomplishmentRecord[] = processorIds.map(
      (processorId) => {
        const stats = statsByProcessor.get(processorId)!;
        return {
          processorId,
          processorName: nameById.get(processorId) ?? "Unknown",
          docRequestsHandled: stats.handled,
          docRequestsReleased: stats.released,
          docRequestsReady: stats.ready,
          docRequestsDisapproved: stats.disapproved,
          docRequestsByType: stats.byType,
          pdsUpdatesApproved: stats.pdsApproved,
          documentsValidated: stats.documentsValidated,
          totalActions:
            stats.handled + stats.pdsApproved + stats.documentsValidated,
        };
      },
    );

    results.sort(
      (a, b) =>
        b.totalActions - a.totalActions ||
        a.processorName.localeCompare(b.processorName),
    );

    const totals = results.reduce(
      (acc, r) => ({
        docRequestsHandled: acc.docRequestsHandled + r.docRequestsHandled,
        docRequestsReleased: acc.docRequestsReleased + r.docRequestsReleased,
        docRequestsReady: acc.docRequestsReady + r.docRequestsReady,
        docRequestsDisapproved:
          acc.docRequestsDisapproved + r.docRequestsDisapproved,
        pdsUpdatesApproved: acc.pdsUpdatesApproved + r.pdsUpdatesApproved,
        documentsValidated: acc.documentsValidated + r.documentsValidated,
        totalActions: acc.totalActions + r.totalActions,
      }),
      {
        docRequestsHandled: 0,
        docRequestsReleased: 0,
        docRequestsReady: 0,
        docRequestsDisapproved: 0,
        pdsUpdatesApproved: 0,
        documentsValidated: 0,
        totalActions: 0,
      },
    );

    return {
      data: results,
      totals,
      total: results.length,
      filters: validated,
    };
  } catch (error) {
    console.error("HR accomplishment report error:", error);
    throw error;
  }
}

// ─── Step Increment Eligibility Report (TOR 1.3.15) ──────────────────────────
//
// PIMM surface over the CSC MC 6 s. 2012 eligibility computation owned by
// the performance module (step-eligibility.ts + getEligibleEmployeesFor-
// StepIncrement). Adds the reports guard and an office filter.

export async function getStepIncrementEligibilityReport(
  filters: z.infer<typeof StepIncrementReportFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = StepIncrementReportFiltersSchema.parse(filters);

    const eligible = await getEligibleEmployeesForStepIncrement();
    const data = validated.officeId
      ? eligible.filter((row) => row.officeId === validated.officeId)
      : eligible;

    return {
      data,
      total: data.length,
      filters: validated,
    };
  } catch (error) {
    console.error("Step increment eligibility report error:", error);
    throw error;
  }
}

// ─── Employee Ad Hoc Report (TOR 1.3.26) ─────────────────────────────────────
//
// Parameterized employee report: caller picks columns from the catalog in
// utils/pimm/adhoc-report.ts plus office / status / category filters.

export async function getEmployeeAdhocReport(
  filters: z.infer<typeof EmployeeAdhocFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = EmployeeAdhocFiltersSchema.parse(filters);

    const conditions = [isNull(employees.deletedAt)];
    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }
    if (validated.status !== "all") {
      conditions.push(eq(employees.status, validated.status));
    }
    if (validated.category === "organic") {
      conditions.push(
        inArray(employees.appointmentType, [...ORGANIC_APPOINTMENT_TYPES]),
      );
    } else if (validated.category === "non_organic") {
      conditions.push(
        inArray(employees.appointmentType, [...NON_ORGANIC_APPOINTMENT_TYPES]),
      );
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

    // Only hit the 201-file child tables when a selected column needs them.
    const resolvedKeys = new Set(
      resolveAdhocColumns(EMPLOYEE_ADHOC_CATALOG, validated.columns).map(
        (col) => col.key,
      ),
    );
    const ids = allEmployees.map((emp) => emp.id);

    const [educationRows, eligibilityRows, externalRows] = await Promise.all([
      resolvedKeys.has("highestEducation") && ids.length > 0
        ? db
            .select({
              employeeId: employeeEducation.employeeId,
              level: employeeEducation.level,
              degreeCourse: employeeEducation.degreeCourse,
            })
            .from(employeeEducation)
            .where(
              and(
                inArray(employeeEducation.employeeId, ids),
                isNull(employeeEducation.deletedAt),
              ),
            )
        : Promise.resolve([]),
      resolvedKeys.has("eligibilities") && ids.length > 0
        ? db
            .select({
              employeeId: employeeEligibilities.employeeId,
              eligibilityName: employeeEligibilities.eligibilityName,
            })
            .from(employeeEligibilities)
            .where(
              and(
                inArray(employeeEligibilities.employeeId, ids),
                isNull(employeeEligibilities.deletedAt),
              ),
            )
        : Promise.resolve([]),
      resolvedKeys.has("externalTrainings") && ids.length > 0
        ? db
            .select({ employeeId: employeeExternalTrainings.employeeId })
            .from(employeeExternalTrainings)
            .where(
              and(
                inArray(employeeExternalTrainings.employeeId, ids),
                isNull(employeeExternalTrainings.deletedAt),
              ),
            )
        : Promise.resolve([]),
    ]);

    const educationByEmployee = new Map<
      string,
      { level: string; degreeCourse: string | null }[]
    >();
    for (const row of educationRows) {
      const list = educationByEmployee.get(row.employeeId) ?? [];
      list.push({ level: row.level, degreeCourse: row.degreeCourse });
      educationByEmployee.set(row.employeeId, list);
    }

    const eligibilitiesByEmployee = new Map<string, string[]>();
    for (const row of eligibilityRows) {
      const list = eligibilitiesByEmployee.get(row.employeeId) ?? [];
      list.push(row.eligibilityName);
      eligibilitiesByEmployee.set(row.employeeId, list);
    }

    const externalCountByEmployee = new Map<string, number>();
    for (const row of externalRows) {
      externalCountByEmployee.set(
        row.employeeId,
        (externalCountByEmployee.get(row.employeeId) ?? 0) + 1,
      );
    }

    const rows: EmployeeAdhocRow[] = allEmployees.map((emp) => ({
      employeeNo: emp.employeeNo,
      fullName: formatFullName(emp),
      officeName: emp.office?.name ?? "N/A",
      positionTitle: emp.positionTitle,
      appointmentType: appointmentTypeLabel(emp.appointmentType),
      appointmentCategory: appointmentCategoryLabel(emp.appointmentType),
      salaryGrade: String(emp.salaryGrade),
      step: String(emp.step),
      status: emp.status,
      dateHired: emp.dateHired,
      gender: emp.gender,
      email: emp.email ?? "",
      highestEducation: highestEducationLabel(
        educationByEmployee.get(emp.id) ?? [],
      ),
      eligibilities: (eligibilitiesByEmployee.get(emp.id) ?? []).join("; "),
      externalTrainings: String(externalCountByEmployee.get(emp.id) ?? 0),
    }));
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

    const report = shapeAdhocReport(
      EMPLOYEE_ADHOC_CATALOG,
      rows,
      validated.columns,
    );

    return { report, filters: validated };
  } catch (error) {
    console.error("Employee ad hoc report error:", error);
    throw error;
  }
}

// ─── RPM Applications Ad Hoc Report (TOR 1.2.29) ─────────────────────────────

export async function getApplicationsAdhocReport(
  filters: z.infer<typeof ApplicationsAdhocFiltersSchema>,
) {
  try {
    await requirePermission("reports", "view");
    const validated = ApplicationsAdhocFiltersSchema.parse(filters);

    const conditions = [isNull(applications.deletedAt)];
    if (validated.vacancyId) {
      conditions.push(eq(applications.vacancyId, validated.vacancyId));
    }
    if (validated.status !== "all") {
      conditions.push(eq(applications.status, validated.status));
    }

    const applicationRows = await db
      .select({
        applicationNumber: applications.applicationNumber,
        personalInfo: applications.personalInfo,
        status: applications.status,
        matchScore: applications.matchScore,
        submittedAt: applications.submittedAt,
        positionTitle: plantillaPositions.positionTitle,
        itemNo: plantillaPositions.itemNo,
      })
      .from(applications)
      .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
      .innerJoin(
        plantillaPositions,
        eq(vacancies.positionId, plantillaPositions.id),
      )
      .where(and(...conditions));

    const rows: ApplicationAdhocRow[] = applicationRows.map((row) => ({
      applicationNo: row.applicationNumber,
      applicantName: applicantNameFromPersonalInfo(row.personalInfo) || "N/A",
      vacancyPosition: row.positionTitle,
      vacancyItemNo: row.itemNo,
      status: row.status,
      matchScore: row.matchScore ?? "",
      submittedDate: row.submittedAt
        ? (row.submittedAt.toISOString().split("T")[0] ?? "")
        : "",
    }));

    // Most recent submissions first; unsubmitted (drafts) last.
    rows.sort(
      (a, b) =>
        b.submittedDate.localeCompare(a.submittedDate) ||
        a.applicationNo.localeCompare(b.applicationNo),
    );

    const report = shapeAdhocReport(
      APPLICATION_ADHOC_CATALOG,
      rows,
      validated.columns,
    );

    return { report, filters: validated };
  } catch (error) {
    console.error("Applications ad hoc report error:", error);
    throw error;
  }
}
