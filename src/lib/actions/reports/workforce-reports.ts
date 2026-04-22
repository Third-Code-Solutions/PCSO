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
import { employees, offices } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { z } from "zod";

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

    const results: PDSSubmission[] = allEmployees.map((emp) => ({
      id: emp.id,
      employeeNo: emp.employeeNo,
      fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
      position: emp.positionTitle,
      office: emp.office?.name || "N/A",
      // TODO: Track actual PDS submission in a separate table
      // For now, placeholder logic
      pdsSubmitted: false,
      lastSubmissionDate: null,
    }));

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
    const validated = ClearanceReportFiltersSchema.parse(filters);

    const conditions = [];

    if (validated.officeId) {
      conditions.push(eq(employees.officeId, validated.officeId));
    }

    // Status filter
    if (validated.status !== "all") {
      conditions.push(eq(employees.status, validated.status as any));
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

    const results: ClearanceRecord[] = allEmployees.map((emp) => {
      // Determine clearance status
      let clearanceStatus: "pending" | "completed" | "not_applicable" =
        "not_applicable";
      let dateOfSeparation: string | null = null;

      if (emp.status === "resigned" || emp.status === "retired") {
        // TODO: Track actual clearance status in a separate table
        // For now, default to pending for separated employees
        clearanceStatus = "pending";
        // In production, this would be the actual separation date from a movements table
        dateOfSeparation = new Date().toISOString().split("T")[0] ?? null;
      }

      return {
        id: emp.id,
        employeeNo: emp.employeeNo,
        fullName: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
        position: emp.positionTitle,
        office: emp.office?.name || "N/A",
        status: emp.status,
        dateHired: emp.dateHired,
        dateOfSeparation,
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
        // TODO: Link to actual education, eligibility, and training records
        educationLevel: null,
        eligibilities: [],
        trainings: 0,
        yearsOfExperience,
      };
    });

    // Apply education level filter if specified
    // TODO: Implement when education records are linked

    return {
      data: results,
      total: results.length,
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
