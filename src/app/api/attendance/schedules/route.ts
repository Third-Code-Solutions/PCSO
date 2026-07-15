/**
 * /api/attendance/schedules — CRUD endpoints for work schedules (TAM-001).
 *
 * Authorization: writes require the `attendance:edit` permission. Middleware
 * does NOT gate `/api/attendance/*` (getMatchingRule/isRouteAllowed only cover
 * the `/attendance/*` page prefix), so each handler must enforce the permission
 * itself (SEC-008 least-privilege). Otherwise any authenticated employee could
 * POST/PUT/DELETE to rewrite the schedules that drive agency-wide
 * tardiness/undertime computation (§10.3) and thus payroll.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { workSchedules } from "@/lib/db/schema/attendance";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * Non-redirecting authorization for API routes (a `redirect()` thrown by
 * requirePermission would be swallowed by the handler try/catch and surface as
 * a 500). Returns an error response to short-circuit, or `{ ok: true }`.
 */
async function authorizeWrite(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasPermission(user.role, "attendance", "edit")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}

const dayArray = z.array(z.number().int().min(0).max(6));

const ScheduleBodySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  timeIn: z.string().min(1),
  timeOut: z.string().min(1),
  breakStart: z.string().nullish(),
  breakEnd: z.string().nullish(),
  totalHours: z.union([z.string(), z.number()]),
  gracePeriodMinutes: z.union([z.string(), z.number()]).nullish(),
  applicableDays: dayArray.optional(),
  isActive: z.boolean().optional(),
});

const ScheduleUpdateSchema = ScheduleBodySchema.extend({
  id: z.string().uuid(),
});

function toValues(input: z.infer<typeof ScheduleBodySchema>) {
  return {
    code: input.code,
    name: input.name,
    timeIn: input.timeIn,
    timeOut: input.timeOut,
    breakStart: input.breakStart || null,
    breakEnd: input.breakEnd || null,
    totalHours: String(input.totalHours),
    gracePeriodMinutes: Number(input.gracePeriodMinutes) || 0,
    applicableDays: input.applicableDays || [1, 2, 3, 4, 5],
    isActive: input.isActive ?? true,
  };
}

export async function POST(req: NextRequest) {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth.response;
  try {
    const parsed = ScheduleBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid schedule payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const [schedule] = await db
      .insert(workSchedules)
      .values(toValues(parsed.data))
      .returning();
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error("Schedule creation error:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth.response;
  try {
    const parsed = ScheduleUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid schedule payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { id, ...rest } = parsed.data;
    const [schedule] = await db
      .update(workSchedules)
      .set(toValues(rest))
      .where(eq(workSchedules.id, id))
      .returning();
    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Schedule update error:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: "Missing or invalid schedule ID" },
        { status: 400 },
      );
    }
    await db
      .update(workSchedules)
      .set({ deletedAt: new Date() })
      .where(eq(workSchedules.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Schedule deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 },
    );
  }
}
