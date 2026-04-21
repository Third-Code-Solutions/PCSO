import { z } from "zod";

// ---------------------------------------------------------------------------
// Re-usable primitives
// ---------------------------------------------------------------------------

/** HH:MM 24-hour time string */
const TimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format (24-hour)")
  .refine((t) => {
    const [h, m] = t.split(":").map(Number);
    return (
      h !== undefined &&
      m !== undefined &&
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    );
  }, "Invalid time value");

/** YYYY-MM-DD date string */
const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const DayTypeSchema = z.enum([
  "ordinary",
  "special_non_working",
  "regular_holiday",
  "rest_day",
  "rest_day_and_special",
  "rest_day_and_regular_holiday",
]);

// ---------------------------------------------------------------------------
// Clock-in / Clock-out
// ---------------------------------------------------------------------------

export const ClockInSchema = z.object({
  employeeId: z.string().uuid(),
  date: DateStringSchema,
  timeIn: TimeStringSchema,
  /** Optional note (location, method, etc.) */
  notes: z.string().max(500).optional(),
});

export type ClockInInput = z.infer<typeof ClockInSchema>;

export const ClockOutSchema = z.object({
  attendanceLogId: z.string().uuid(),
  timeOut: TimeStringSchema,
  notes: z.string().max(500).optional(),
});

export type ClockOutInput = z.infer<typeof ClockOutSchema>;

// ---------------------------------------------------------------------------
// Manual entry (HR admin)
// ---------------------------------------------------------------------------

export const ManualEntrySchema = z
  .object({
    employeeId: z.string().uuid(),
    date: DateStringSchema,
    timeIn: TimeStringSchema.nullable(),
    timeOut: TimeStringSchema.nullable(),
    dayType: DayTypeSchema,
    approvedOvertimeMinutes: z.number().int().min(0).max(480).default(0),
    notes: z.string().max(1000).optional(),
    /** Mandatory justification for manual correction audit trail */
    correctionReason: z.string().min(10).max(500),
  })
  .refine(
    (data) => {
      // If both are provided, validate timeOut is after timeIn (unless overnight)
      if (data.timeIn && data.timeOut) {
        // We allow overnight (timeOut <= timeIn) but require them to be distinct
        return data.timeIn !== data.timeOut;
      }
      return true;
    },
    {
      message: "Time-in and time-out cannot be the same value",
      path: ["timeOut"],
    },
  );

export type ManualEntryInput = z.infer<typeof ManualEntrySchema>;

// ---------------------------------------------------------------------------
// Overtime application
// ---------------------------------------------------------------------------

export const OvertimeRequestSchema = z.object({
  employeeId: z.string().uuid(),
  date: DateStringSchema,
  requestedMinutes: z.number().int().min(30).max(240), // max 4 hours per PCSO policy
  dayType: DayTypeSchema,
  justification: z.string().min(20).max(1000),
  supervisorId: z.string().uuid(),
});

export type OvertimeRequestInput = z.infer<typeof OvertimeRequestSchema>;

export const OvertimeApprovalSchema = z.object({
  overtimeRequestId: z.string().uuid(),
  approvedMinutes: z.number().int().min(0).max(240),
  /** Approver comments (required on denial) */
  comments: z.string().max(500).optional(),
  decision: z.enum(["approved", "denied", "partial"]),
});

export type OvertimeApprovalInput = z.infer<typeof OvertimeApprovalSchema>;

// ---------------------------------------------------------------------------
// Biometric CSV import
// ---------------------------------------------------------------------------

export const BiometricRowSchema = z
  .object({
    employeeId: z.string().min(1, "Employee ID is required"),
    date: DateStringSchema,
    timeIn: TimeStringSchema.nullable(),
    timeOut: TimeStringSchema.nullable(),
  })
  .refine(
    (row) => row.timeIn !== null || row.timeOut !== null,
    "At least one of time-in or time-out must be present",
  );

export type BiometricRow = z.infer<typeof BiometricRowSchema>;

export const BiometricImportSchema = z.object({
  /** Employee ID column header in the CSV */
  employeeIdColumn: z.string().default("employee_id"),
  /** Date column header */
  dateColumn: z.string().default("date"),
  /** Time-in column header */
  timeInColumn: z.string().default("time_in"),
  /** Time-out column header */
  timeOutColumn: z.string().default("time_out"),
  rows: z.array(BiometricRowSchema).min(1, "CSV must contain at least one row"),
});

export type BiometricImportInput = z.infer<typeof BiometricImportSchema>;

// ---------------------------------------------------------------------------
// Holiday management
// ---------------------------------------------------------------------------

export const HolidayEntrySchema = z.object({
  date: DateStringSchema,
  name: z.string().min(2).max(200),
  type: z.enum(["regular", "special_non_working"]),
});

export type HolidayEntryInput = z.infer<typeof HolidayEntrySchema>;

export const HolidayBatchSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  holidays: z.array(HolidayEntrySchema).min(1),
});

export type HolidayBatchInput = z.infer<typeof HolidayBatchSchema>;

// ---------------------------------------------------------------------------
// DTR period query
// ---------------------------------------------------------------------------

export const DtrPeriodSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    startDate: DateStringSchema,
    endDate: DateStringSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be on or before end date",
    path: ["endDate"],
  });

export type DtrPeriodInput = z.infer<typeof DtrPeriodSchema>;
