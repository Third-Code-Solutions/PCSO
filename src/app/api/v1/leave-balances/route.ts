import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { employees, leaveCredits, leaveTypes } from "@/lib/db/schema";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v1/leave-balances — leave credit ledger balances (TOR 3.3.5).
 * Scope: leave:read.
 *
 * Reads the `leave_credits` ledger (one row per employee × leave type ×
 * year — same source of truth the LAM module uses).
 *
 * Query params:
 *   employee_id — uuid (this or office_id is required, to bound the query)
 *   office_id   — uuid
 *   year        — int, defaults to the current year
 *   page/limit  — pagination (limit max 200, default 50)
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const querySchema = z.object({
  employee_id: z.string().uuid().optional(),
  office_id: z.string().uuid().optional(),
  year: z.coerce
    .number()
    .int()
    .min(1990)
    .max(2100)
    .default(() => new Date().getFullYear()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, ["leave:read"]);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      employee_id: url.searchParams.get("employee_id") ?? undefined,
      office_id: url.searchParams.get("office_id") ?? undefined,
      year: url.searchParams.get("year") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }
    const query = parsed.data;

    if (!query.employee_id && !query.office_id) {
      return problem({
        status: 400,
        title: "Bad Request",
        detail: "Provide employee_id or office_id to scope the balance query.",
      });
    }

    const conditions: SQL[] = [
      eq(leaveCredits.year, query.year),
      isNull(employees.deletedAt),
    ];
    if (query.employee_id) {
      conditions.push(eq(leaveCredits.employeeId, query.employee_id));
    }
    if (query.office_id) {
      conditions.push(eq(employees.officeId, query.office_id));
    }
    const where = and(...conditions);

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(leaveCredits)
      .innerJoin(employees, eq(leaveCredits.employeeId, employees.id))
      .where(where);
    const total = countRow?.total ?? 0;

    const rows = await db
      .select({
        employeeId: leaveCredits.employeeId,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        leaveTypeCode: leaveTypes.code,
        leaveTypeName: leaveTypes.name,
        year: leaveCredits.year,
        totalCredits: leaveCredits.totalCredits,
        usedCredits: leaveCredits.usedCredits,
        balance: leaveCredits.balance,
        carryOver: leaveCredits.carryOver,
        updatedAt: leaveCredits.updatedAt,
      })
      .from(leaveCredits)
      .innerJoin(employees, eq(leaveCredits.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveCredits.leaveTypeId, leaveTypes.id))
      .where(where)
      .orderBy(
        asc(employees.lastName),
        asc(employees.firstName),
        asc(leaveTypes.code),
      )
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    return apiResponse(request, "leave_balances", {
      data: rows.map((row) => ({
        employee_id: row.employeeId,
        employee_no: row.employeeNo,
        employee_name: `${row.lastName}, ${row.firstName}`,
        leave_type_code: row.leaveTypeCode,
        leave_type_name: row.leaveTypeName,
        year: row.year,
        total_credits: row.totalCredits,
        used_credits: row.usedCredits,
        balance: row.balance,
        carry_over: row.carryOver,
        updated_at: row.updatedAt.toISOString(),
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        total_pages: Math.max(1, Math.ceil(total / query.limit)),
        year: query.year,
      },
    });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
