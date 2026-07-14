/**
 * CSC Form 6 (Application for Leave) — FILLED PDF generator (TOR 1.4.11).
 *
 * Renders the existing LeaveForm6 react-pdf component populated with the
 * application's actual data (employee, dates, leave type, status, credits)
 * using the server-side pdf(element).toBlob() pattern proven by the COE
 * generator. Returns base64 so the client can trigger a download.
 *
 * Authorization (two-layer per PRD §11 — middleware route-gating is layer 1):
 *   - the applicant may always download their own Form 6;
 *   - any non-self-service role holding leave.view may download others'.
 *
 * No serial number is issued and no record is written — this is a read-only
 * rendering, so no audit entry is created (house convention: audit writes).
 */

"use server";

import { createElement, type ReactElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employees,
  leaveApplications,
  leaveCredits,
  leaveTypes,
  offices,
  payrollRecords,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { LeaveForm6 } from "@/components/pdf/leave-form-6";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";

const GenerateForm6Schema = z.object({
  leaveApplicationId: z.string().uuid(),
});

export async function generateLeaveForm6Pdf(
  input: unknown,
): Promise<{ base64: string; filename: string }> {
  const parsed = GenerateForm6Schema.parse(input);
  const user = await requireAuth();

  const [row] = await db
    .select({
      id: leaveApplications.id,
      employeeId: leaveApplications.employeeId,
      dateFrom: leaveApplications.dateFrom,
      dateTo: leaveApplications.dateTo,
      noOfDays: leaveApplications.noOfDays,
      reason: leaveApplications.reason,
      status: leaveApplications.status,
      remarks: leaveApplications.remarks,
      createdAt: leaveApplications.createdAt,
      leaveTypeCode: leaveTypes.code,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      employeeNo: employees.employeeNo,
      positionTitle: employees.positionTitle,
      salaryGrade: employees.salaryGrade,
      step: employees.step,
      dateHired: employees.dateHired,
      officeName: offices.name,
    })
    .from(leaveApplications)
    .innerJoin(leaveTypes, eq(leaveApplications.leaveTypeId, leaveTypes.id))
    .innerJoin(employees, eq(leaveApplications.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(eq(leaveApplications.id, parsed.leaveApplicationId))
    .limit(1);

  if (!row) {
    throw new Error("Leave application not found.");
  }

  // ── Layer-2 authorization ─────────────────────────────────────────────────
  const isOwn = user.employeeId !== null && user.employeeId === row.employeeId;
  const isElevated =
    user.role !== "employee_self_service" &&
    hasPermission(user.role, "leave", "view");
  if (!isOwn && !isElevated) {
    throw new Error("You are not authorized to download this leave form.");
  }

  // ── Supporting data (credits as of the leave year, salary display) ───────
  const leaveYear =
    Number(row.dateFrom.slice(0, 4)) || new Date().getFullYear();

  const [creditRows, payRows] = await Promise.all([
    db
      .select({ code: leaveTypes.code, balance: leaveCredits.balance })
      .from(leaveCredits)
      .innerJoin(leaveTypes, eq(leaveCredits.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveCredits.employeeId, row.employeeId),
          eq(leaveCredits.year, leaveYear),
          inArray(leaveTypes.code, ["VL", "SL"]),
        ),
      ),
    db
      .select({ basicPay: payrollRecords.basicPay })
      .from(payrollRecords)
      .where(eq(payrollRecords.employeeId, row.employeeId))
      .orderBy(desc(payrollRecords.createdAt))
      .limit(1),
  ]);

  let vlBalance = 0;
  let slBalance = 0;
  for (const credit of creditRows) {
    if (credit.code === "VL") vlBalance = Number(credit.balance ?? 0);
    if (credit.code === "SL") slBalance = Number(credit.balance ?? 0);
  }

  const latestBasicPay = payRows[0]?.basicPay
    ? Number(payRows[0].basicPay)
    : null;
  const salaryDisplay =
    latestBasicPay !== null && Number.isFinite(latestBasicPay)
      ? latestBasicPay.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : `SG ${row.salaryGrade}, Step ${row.step}`;

  // ── Render ────────────────────────────────────────────────────────────────
  const element = createElement(LeaveForm6, {
    application: {
      id: row.id,
      leaveTypeCode: row.leaveTypeCode as LeaveTypeCode,
      startDate: row.dateFrom,
      endDate: row.dateTo,
      workingDays: Number(row.noOfDays),
      period: "whole_day" as const,
      reason: row.reason,
      status: row.status,
      approverRemarks: row.remarks,
      createdAt: row.createdAt.toISOString(),
    },
    employee: {
      firstName: row.firstName,
      middleName: row.middleName ?? undefined,
      lastName: row.lastName,
      employeeNo: row.employeeNo,
      positionTitle: row.positionTitle,
      salary: salaryDisplay,
      officeName: row.officeName ?? "Unassigned",
      dateHired: row.dateHired,
    },
    credits: { vlBalance, slBalance },
    // LeaveForm6 returns a <Document> root; createElement's generic cannot
    // see that, so assert the shape pdf() expects.
  }) as unknown as ReactElement<DocumentProps>;

  const blob = await pdf(element).toBlob();
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

  const safeNo = row.employeeNo.replace(/[^A-Za-z0-9-]/g, "_");
  const filename = `CSC-Form-6_${safeNo}_${row.dateFrom}.pdf`;

  return { base64, filename };
}
