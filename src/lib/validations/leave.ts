/**
 * Leave module Zod validation schemas — PCSO HRIS Phase 08
 *
 * All server actions and API boundaries must parse through these schemas
 * before processing. Per conventions: never trust external data.
 */

import { z } from "zod";
import {
  LEAVE_TYPE_CODES,
  SL_MEDICAL_CERT_THRESHOLD_DAYS,
} from "@/lib/constants/leave-types";

// ---------------------------------------------------------------------------
// Leave application status
// ---------------------------------------------------------------------------

export const LeaveStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "disapproved",
  "cancelled",
  "cancellation_requested", // owner asked to cancel approved leave (§12.1)
  "for_hr_review", // pending HR admin review (multi-level)
  "for_super_admin", // pending super admin (multi-level, > 30 days)
]);

export type LeaveStatus = z.infer<typeof LeaveStatusSchema>;

// ---------------------------------------------------------------------------
// Leave type code schema (derived from constants)
// ---------------------------------------------------------------------------

export const LeaveTypeCodeSchema = z.enum(
  LEAVE_TYPE_CODES as [string, ...string[]],
);

// ---------------------------------------------------------------------------
// Apply Leave schema
// ---------------------------------------------------------------------------

export const ApplyLeaveSchema = z
  .object({
    /**
     * ID of the employee applying for leave.
     * On the server this is always taken from the session; provided here
     * for admin-submitted applications on behalf of an employee.
     */
    employeeId: z.string().uuid("Invalid employee ID."),

    leaveTypeCode: LeaveTypeCodeSchema,

    /** Inclusive start date of the leave period (ISO 8601 date string). */
    startDate: z.string().date("Start date must be a valid date (YYYY-MM-DD)."),

    /** Inclusive end date of the leave period (ISO 8601 date string). */
    endDate: z.string().date("End date must be a valid date (YYYY-MM-DD)."),

    /**
     * Client-side estimate of working days, for display only. The server
     * recomputes chargeable days from the date range, holidays, suspensions
     * and `period` and never charges this value (H-09).
     */
    workingDays: z
      .number()
      .positive("Working days must be a positive number.")
      .max(365, "Working days cannot exceed 365."),

    /** Whether the leave is for the morning, afternoon, or full day. */
    period: z.enum(["am", "pm", "whole_day"]).default("whole_day"),

    /** Optional reason / purpose provided by the applicant. */
    reason: z
      .string()
      .max(500, "Reason must not exceed 500 characters.")
      .optional(),

    /**
     * Storage path(s) for supporting documents uploaded to Supabase Storage.
     * Required when leaveTypeCode === 'SL' and workingDays > SL_MEDICAL_CERT_THRESHOLD_DAYS,
     * and for other leave types with documentRequired === 'always'.
     */
    attachmentPaths: z.array(z.string().min(1)).optional(),

    /** Whether this application is a commutation (monetization) request. */
    isCommutation: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }

    if (data.period !== "whole_day" && data.startDate !== data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["period"],
        message:
          "A half-day (AM/PM) leave must start and end on the same date.",
      });
    }

    // SL medical certificate requirement
    if (
      data.leaveTypeCode === "SL" &&
      data.workingDays > SL_MEDICAL_CERT_THRESHOLD_DAYS
    ) {
      if (!data.attachmentPaths || data.attachmentPaths.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attachmentPaths"],
          message: `A medical certificate is required for Sick Leave exceeding ${SL_MEDICAL_CERT_THRESHOLD_DAYS} days.`,
        });
      }
    }

    // Leaves that always require a document
    const alwaysRequiredTypes: z.infer<typeof LeaveTypeCodeSchema>[] = [
      "ML",
      "PL",
      "SOLO",
      "SLW",
      "REHAB",
      "STUDY",
      "TERMINAL",
    ];
    if (alwaysRequiredTypes.includes(data.leaveTypeCode)) {
      if (!data.attachmentPaths || data.attachmentPaths.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attachmentPaths"],
          message: "A supporting document is required for this leave type.",
        });
      }
    }
  });

export type ApplyLeaveInput = z.infer<typeof ApplyLeaveSchema>;

// ---------------------------------------------------------------------------
// Approve Leave schema
// ---------------------------------------------------------------------------

export const ApproveLeaveSchema = z.object({
  leaveApplicationId: z.string().uuid("Invalid leave application ID."),
  remarks: z.string().max(500).optional(),
});

export type ApproveLeaveInput = z.infer<typeof ApproveLeaveSchema>;

// ---------------------------------------------------------------------------
// Disapprove Leave schema
// ---------------------------------------------------------------------------

export const DisapproveLeaveSchema = z.object({
  leaveApplicationId: z.string().uuid("Invalid leave application ID."),
  /** Reason for disapproval is required so the applicant understands the decision. */
  remarks: z
    .string()
    .min(5, "Please provide a reason for disapproval.")
    .max(500),
});

export type DisapproveLeaveInput = z.infer<typeof DisapproveLeaveSchema>;

// ---------------------------------------------------------------------------
// Cancel Leave schema
// ---------------------------------------------------------------------------

export const CancelLeaveSchema = z.object({
  leaveApplicationId: z.string().uuid("Invalid leave application ID."),
  /** Optional reason for cancellation. */
  reason: z.string().max(500).optional(),
});

export type CancelLeaveInput = z.infer<typeof CancelLeaveSchema>;

/** Approver decision on a CANCELLATION_REQUESTED application (§12.1). */
export const DecideLeaveCancellationSchema = z.object({
  leaveApplicationId: z.string().uuid("Invalid leave application ID."),
  decision: z.enum(["confirm", "deny"]),
  remarks: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Monthly accrual trigger schema (for cron / admin action)
// ---------------------------------------------------------------------------

export const AccrueMonthlyCreditsSchema = z.object({
  /**
   * The month (1–12) to accrue credits for.
   * Defaults to the previous (completed) month if not provided.
   */
  month: z.number().int().min(1).max(12).optional(),
  /**
   * The year to accrue credits for.
   * Defaults to the current year if not provided.
   */
  year: z.number().int().min(2000).max(2100).optional(),
  /**
   * Optional subset of employee IDs to accrue for (e.g., for retry runs).
   * If empty or not provided, all eligible employees are processed.
   */
  employeeIds: z.array(z.string().uuid()).optional(),
});

export type AccrueMonthlyCreditsInput = z.infer<
  typeof AccrueMonthlyCreditsSchema
>;

// ---------------------------------------------------------------------------
// Leave credit balance schema (for API responses)
// ---------------------------------------------------------------------------

export const LeaveCreditBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  vlBalance: z.number().min(0),
  slBalance: z.number().min(0),
  asOfDate: z.string().date(),
  year: z.number().int(),
});

export type LeaveCreditBalance = z.infer<typeof LeaveCreditBalanceSchema>;

// ---------------------------------------------------------------------------
// Terminal leave computation input schema
// ---------------------------------------------------------------------------

export const TerminalLeaveComputationSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID."),
  separationDate: z
    .string()
    .date("Separation date must be a valid date (YYYY-MM-DD)."),
  separationType: z.enum([
    "retirement",
    "resignation",
    "end_of_term",
    "death",
    "other",
  ]),
  /**
   * Monthly basic salary as a numeric string (stored as numeric in Postgres).
   * Must be positive.
   */
  monthlyBasicSalary: z
    .string()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Monthly basic salary must be a valid monetary amount.",
    ),
  vlBalance: z.number().min(0, "VL balance cannot be negative."),
  slBalance: z.number().min(0, "SL balance cannot be negative."),
});

export type TerminalLeaveComputationInput = z.infer<
  typeof TerminalLeaveComputationSchema
>;
