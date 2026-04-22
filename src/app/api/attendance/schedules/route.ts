/**
 * /api/attendance/schedules — CRUD endpoints for work schedules (TAM-001).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workSchedules } from "@/lib/db/schema/attendance";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const {
      code,
      name,
      timeIn,
      timeOut,
      breakStart,
      breakEnd,
      totalHours,
      gracePeriodMinutes,
      applicableDays,
      isActive,
    } = body;

    if (!code || !name || !timeIn || !timeOut || !totalHours) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const [schedule] = await db
      .insert(workSchedules)
      .values({
        code,
        name,
        timeIn,
        timeOut,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        totalHours: String(totalHours),
        gracePeriodMinutes: Number(gracePeriodMinutes) || 0,
        applicableDays: applicableDays || [1, 2, 3, 4, 5],
        isActive: isActive ?? true,
      })
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
  try {
    const user = await requireAuth();
    const body = await req.json();

    const {
      id,
      code,
      name,
      timeIn,
      timeOut,
      breakStart,
      breakEnd,
      totalHours,
      gracePeriodMinutes,
      applicableDays,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing schedule ID" },
        { status: 400 },
      );
    }

    const [schedule] = await db
      .update(workSchedules)
      .set({
        code,
        name,
        timeIn,
        timeOut,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        totalHours: String(totalHours),
        gracePeriodMinutes: Number(gracePeriodMinutes) || 0,
        applicableDays: applicableDays || [1, 2, 3, 4, 5],
        isActive: isActive ?? true,
      })
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
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing schedule ID" },
        { status: 400 },
      );
    }

    await db
      .update(workSchedules)
      .set({ deletedAt: new Date().toISOString() })
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
