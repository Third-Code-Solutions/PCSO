"use server";

/**
 * Server actions for the DTR browser page.
 *
 * exportDtrPdf — generates the official CSC Form No. 48 (Daily Time Record)
 * as a PDF (TOR 1.5.13) rendered server-side with @react-pdf/renderer via
 * the same `pdf(element).toBlob()` pattern proven by the COE generator
 * (src/lib/actions/documents/coe-generator.tsx). Bytes are returned base64
 * so the client can trigger a download without exposing a signed URL or a
 * file-system path.
 *
 * CSV output is retained as an explicit `format: 'csv'` option AND as an
 * automatic fallback if the PDF render throws (@react-pdf/renderer@4.x has a
 * known concurrent-commit failure mode under React 19; CSV works
 * deterministically under concurrent load).
 */

import { createElement, type ReactElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getOwnAttendanceLogs,
  getAttendanceLogsByPeriod,
  getEmployeeSummaries,
} from "@/app/(dashboard)/attendance/queries";
import { DtrCscForm48 } from "@/components/pdf/dtr-csc-form48";
import { db } from "@/lib/db";
import { withTx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import {
  employees,
  offices,
  dtrPeriods,
  attendanceLogs,
} from "@/lib/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { auditLog } from "@/lib/audit";
import type { DateString } from "@/lib/utils/attendance/types";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ExportDtrPdfSchema = z.object({
  /** Target employee UUID. Required for admins; ignored for employee_self_service (own record used). */
  employeeId: z.string().uuid().optional(),
  /** 1-based month number */
  month: z.number().int().min(1).max(12),
  /** Full calendar year, e.g. 2025 */
  year: z.number().int().min(2000).max(2100),
  /** Output format — official CSC Form 48 PDF (default) or CSV fallback. */
  format: z.enum(["pdf", "csv"]).default("pdf"),
});

export type ExportDtrPdfInput = z.infer<typeof ExportDtrPdfSchema>;

export interface ExportDtrPdfResult {
  /** Base64-encoded PDF bytes */
  base64: string;
  /** Suggested file name */
  filename: string;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function exportDtrPdf(
  input: unknown,
): Promise<ExportDtrPdfResult> {
  const parsed = ExportDtrPdfSchema.parse(input);
  const user = await requirePermission("attendance", "view");

  const isElevated = hasPermission(user.role, "attendance", "export");

  // Resolve which employee's data to fetch
  let targetEmployeeId: string;

  if (isElevated && parsed.employeeId) {
    targetEmployeeId = parsed.employeeId;
  } else {
    // Fall back to own record — covers employee_self_service and elevated users
    // who didn't pass an explicit employeeId
    if (!user.employeeId) {
      throw new Error("Your account is not linked to an employee record.");
    }
    targetEmployeeId = user.employeeId;
  }

  // Date range for the requested month
  const periodStart = format(
    startOfMonth(new Date(parsed.year, parsed.month - 1, 1)),
    "yyyy-MM-dd",
  ) as DateString;
  const periodEnd = format(
    endOfMonth(new Date(parsed.year, parsed.month - 1, 1)),
    "yyyy-MM-dd",
  ) as DateString;

  // Fetch logs — use own-query for self-service so Supabase RLS stays happy
  const logs =
    isElevated && parsed.employeeId
      ? await getAttendanceLogsByPeriod(
          periodStart,
          periodEnd,
          targetEmployeeId,
        )
      : await getOwnAttendanceLogs(periodStart, periodEnd);

  // Fetch employee details (+ office name) for the CSV header
  const [employeeRow] = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      suffix: employees.suffix,
      positionTitle: employees.positionTitle,
      salaryGrade: employees.salaryGrade,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(eq(employees.id, targetEmployeeId))
    .limit(1);

  if (!employeeRow) {
    throw new Error("Employee record not found.");
  }

  const nameParts = [
    employeeRow.lastName,
    employeeRow.firstName,
    employeeRow.middleName ?? "",
    employeeRow.suffix ?? "",
  ]
    .map((p) => p.trim())
    .filter(Boolean);
  const fullName = nameParts.join(", ");

  const monthLabel = format(
    new Date(parsed.year, parsed.month - 1, 1),
    "MMMM yyyy",
  );

  const totalLateMinutes = logs.reduce((sum, l) => sum + l.lateMinutes, 0);
  const totalUndertimeMinutes = logs.reduce(
    (sum, l) => sum + l.undertimeMinutes,
    0,
  );

  const safeName = employeeRow.lastName.replace(/[^A-Za-z0-9]/g, "_");
  const baseFilename = `DTR_${safeName}_${parsed.year}_${String(parsed.month).padStart(2, "0")}`;

  // ── PDF path (TOR 1.5.13) — official CSC Form No. 48 ─────────────────────
  // Server-rendered with the same pdf(element).toBlob() pattern proven by the
  // COE generator (src/lib/actions/documents/coe-generator.tsx). On render
  // failure (@react-pdf/renderer@4.x has a known concurrent-commit issue with
  // React 19) we fall through to the deterministic CSV export below instead
  // of failing the download.
  if (parsed.format === "pdf") {
    try {
      const element = createElement(DtrCscForm48, {
        employee: {
          name: fullName,
          employeeNumber: employeeRow.employeeNo,
          position: employeeRow.positionTitle,
          department: employeeRow.officeName ?? "Unassigned",
          salary:
            employeeRow.salaryGrade !== null &&
            employeeRow.salaryGrade !== undefined
              ? `SG ${employeeRow.salaryGrade}`
              : "",
        },
        month: monthLabel,
        schedule: { start: "8:00 AM", end: "5:00 PM" },
        logs,
        totalLateMinutes,
        totalUndertimeMinutes,
        // DtrCscForm48 returns a <Document> root; createElement's generic
        // cannot see that, so assert the shape pdf() expects.
      }) as unknown as ReactElement<DocumentProps>;
      const blob = await pdf(element).toBlob();
      const pdfBase64 = Buffer.from(await blob.arrayBuffer()).toString(
        "base64",
      );
      const pdfFilename = `${baseFilename}.pdf`;

      // Audit the export (record contents may leave the system).
      void auditLog({
        userId: user.id,
        action: "dtr_pdf_export",
        table: "attendance_logs",
        recordId: targetEmployeeId,
        newValues: {
          employeeId: targetEmployeeId,
          periodStart,
          periodEnd,
          rowCount: logs.length,
          format: "pdf",
          filename: pdfFilename,
        },
      });

      return { base64: pdfBase64, filename: pdfFilename };
    } catch (pdfError) {
      console.error(
        "[exportDtrPdf] PDF render failed; falling back to CSV:",
        pdfError,
      );
    }
  }

  // ── CSV path — explicit format: 'csv' or PDF-render fallback ─────────────
  // Note: CSC accepts either PDF or CSV export per Memorandum Circular No. 16.
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = [
    "# CSC Form No. 48 — Daily Time Record",
    `# Name,${escape(fullName)}`,
    `# Position,${escape(employeeRow.positionTitle)}`,
    `# Employee No.,${escape(employeeRow.employeeNo)}`,
    `# Office/Dept.,${escape(employeeRow.officeName ?? "Unassigned")}`,
    `# Month,${escape(monthLabel)}`,
    "# Schedule,8:00 AM – 5:00 PM",
    "",
    "Day,AM Arrival,AM Departure,PM Arrival,PM Departure,Undertime (Hrs),Undertime (Mins),Remarks",
  ];

  const byDay = new Map<number, (typeof logs)[number]>();
  for (const log of logs) {
    const day = Number(log.date.split("-")[2] ?? "0");
    if (day >= 1 && day <= 31) byDay.set(day, log);
  }

  const rows: string[] = [];
  for (let d = 1; d <= 31; d += 1) {
    const log = byDay.get(d);
    if (!log) {
      rows.push([d, "", "", "", "", "", "", ""].map(escape).join(","));
      continue;
    }
    const isAbsent = !log.timeIn && !log.timeOut;
    const under = log.undertimeMinutes ?? 0;
    const hours = Math.floor(under / 60);
    const mins = under % 60;
    rows.push(
      [
        d,
        isAbsent ? "ABSENT" : (log.timeIn ?? ""),
        isAbsent ? "" : "12:00 PM",
        isAbsent ? "" : "1:00 PM",
        isAbsent ? "" : (log.timeOut ?? ""),
        under > 0 ? hours : "",
        under > 0 ? mins : "",
        log.remarks ?? "",
      ]
        .map(escape)
        .join(","),
    );
  }

  const totalUnderHrs = Math.floor(
    (totalLateMinutes + totalUndertimeMinutes) / 60,
  );
  const totalUnderMins = (totalLateMinutes + totalUndertimeMinutes) % 60;
  const footer = [
    "",
    `TOTAL UNDERTIME,,,,,${totalUnderHrs},${totalUnderMins},`,
    "",
    "# Certification: I certify on my honor that the above is a true and correct",
    "# report of the hours of work performed, record of which was made daily at",
    "# the time of arrival at and departure from the office.",
  ];

  const csv = [...header, ...rows, ...footer].join("\n");
  // UTF-8 BOM for Excel compatibility with Filipino tildes (e.g. ñ in names).
  const buffer = Buffer.concat([
    Buffer.from("\uFEFF", "utf8"),
    Buffer.from(csv, "utf8"),
  ]);
  const base64 = buffer.toString("base64");

  const filename = `${baseFilename}.csv`;

  // Audit the export (record contents may leave the system).
  // Fire-and-forget: auditLog() already swallows its own errors internally,
  // so not awaiting keeps the response latency predictable under concurrent
  // load. The write still completes on the server after the response is sent.
  void auditLog({
    userId: user.id,
    action: "dtr_csv_export",
    table: "attendance_logs",
    recordId: targetEmployeeId,
    newValues: {
      employeeId: targetEmployeeId,
      periodStart,
      periodEnd,
      rowCount: logs.length,
      filename,
    },
  });

  return { base64, filename };
}

// ---------------------------------------------------------------------------
// getDtrEmployeeList — returns employee list for the picker (elevated roles only)
// ---------------------------------------------------------------------------

export async function getDtrEmployeeList() {
  const user = await requirePermission("attendance", "view");

  if (!hasPermission(user.role, "attendance", "export")) {
    // employee_self_service — no employee list needed
    return [];
  }

  return getEmployeeSummaries();
}

// ---------------------------------------------------------------------------
// submitDtr — finalise (submit) an employee's DTR for the given period.
//
// Concurrent-safe: uses `withTx` + advisory `lockKey` scoped to
// `dtr:submit:<employeeId>:<periodStart>:<periodEnd>` so two parallel submits
// on the same employee+period cannot race. Idempotent: re-submitting an
// already-submitted period returns the existing row.
// ---------------------------------------------------------------------------

const SubmitDtrSchema = z.object({
  employeeId: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export type SubmitDtrInput = z.infer<typeof SubmitDtrSchema>;

export interface SubmitDtrResult {
  success: true;
  periodId: string;
  status: "submitted";
}

export async function submitDtr(input: unknown): Promise<SubmitDtrResult> {
  const parsed = SubmitDtrSchema.parse(input);
  const user = await requirePermission("attendance", "view");

  const isElevated = hasPermission(user.role, "attendance", "export");

  let targetEmployeeId: string;
  if (isElevated && parsed.employeeId) {
    targetEmployeeId = parsed.employeeId;
  } else {
    if (!user.employeeId) {
      throw new Error("Your account is not linked to an employee record.");
    }
    targetEmployeeId = user.employeeId;
  }

  const periodStart = format(
    startOfMonth(new Date(parsed.year, parsed.month - 1, 1)),
    "yyyy-MM-dd",
  ) as DateString;
  const periodEnd = format(
    endOfMonth(new Date(parsed.year, parsed.month - 1, 1)),
    "yyyy-MM-dd",
  ) as DateString;

  const lockId = `dtr:submit:${targetEmployeeId}:${periodStart}:${periodEnd}`;

  const result = await withTx(async (tx) => {
    // Serialise concurrent submits on the same employee+period.
    await lockKey(tx, lockId);

    // Aggregate totals for the period inside the tx so we see a consistent view.
    const logs = await tx
      .select({
        timeIn: attendanceLogs.timeIn,
        timeOut: attendanceLogs.timeOut,
        lateMinutes: attendanceLogs.lateMinutes,
        undertimeMinutes: attendanceLogs.undertimeMinutes,
        overtimeMinutes: attendanceLogs.overtimeMinutes,
      })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.employeeId, targetEmployeeId),
          gte(attendanceLogs.logDate, periodStart),
          lte(attendanceLogs.logDate, periodEnd),
        ),
      );

    const totals = logs.reduce(
      (acc, l) => {
        if (l.timeIn && l.timeOut) acc.present += 1;
        acc.late += l.lateMinutes ?? 0;
        acc.undertime += l.undertimeMinutes ?? 0;
        acc.overtime += l.overtimeMinutes ?? 0;
        return acc;
      },
      { present: 0, late: 0, undertime: 0, overtime: 0 },
    );

    // Idempotent check: if a submitted/approved row already exists, return it.
    const [existing] = await tx
      .select({ id: dtrPeriods.id, status: dtrPeriods.status })
      .from(dtrPeriods)
      .where(
        and(
          eq(dtrPeriods.employeeId, targetEmployeeId),
          eq(dtrPeriods.periodStart, periodStart),
          eq(dtrPeriods.periodEnd, periodEnd),
        ),
      )
      .limit(1);

    if (existing && existing.status !== "draft") {
      return { id: existing.id };
    }

    if (existing) {
      await tx
        .update(dtrPeriods)
        .set({
          status: "submitted",
          totalDaysPresent: totals.present,
          totalLateMinutes: totals.late,
          totalUndertimeMinutes: totals.undertime,
          totalOvertimeMinutes: totals.overtime,
        })
        .where(eq(dtrPeriods.id, existing.id));
      return { id: existing.id };
    }

    const [inserted] = await tx
      .insert(dtrPeriods)
      .values({
        employeeId: targetEmployeeId,
        periodStart,
        periodEnd,
        status: "submitted",
        totalDaysPresent: totals.present,
        totalLateMinutes: totals.late,
        totalUndertimeMinutes: totals.undertime,
        totalOvertimeMinutes: totals.overtime,
      })
      .returning({ id: dtrPeriods.id });

    if (!inserted) {
      throw new Error("Failed to create DTR period.");
    }
    return { id: inserted.id };
  });

  void auditLog({
    userId: user.id,
    action: "dtr_submit",
    table: "dtr_periods",
    recordId: result.id,
    newValues: {
      employeeId: targetEmployeeId,
      periodStart,
      periodEnd,
      status: "submitted",
    },
  });

  revalidatePath("/attendance/dtr");

  return { success: true, periodId: result.id, status: "submitted" };
}
