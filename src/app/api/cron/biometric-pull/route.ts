import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, biometricDevices } from "@/lib/db/schema";
import { pullDeviceOnce } from "@/lib/actions/attendance/biometric-pull";
import { checkCronAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * TAM-004 / TOR 1.5.2 — Scheduled biometric device polling.
 *
 * Scheduled via vercel.json: every 30 minutes. For each ACTIVE pull-mode
 * device that is due (never polled, or last polled ≥ poll_interval_minutes
 * ago), fetches the device's pull URL (10s timeout), parses the payload per
 * the device's configured format (CSV/JSON/XML), and runs the shared
 * attendance ingest pipeline. Devices are isolated: one device failing never
 * blocks the rest — outcomes land on each device row
 * (last_pull_status / last_pull_message).
 */
export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = Date.now();
  try {
    const devices = await db
      .select({
        id: biometricDevices.id,
        name: biometricDevices.name,
        payloadFormat: biometricDevices.payloadFormat,
        pullUrl: biometricDevices.pullUrl,
        pollIntervalMinutes: biometricDevices.pollIntervalMinutes,
        lastPolledAt: biometricDevices.lastPolledAt,
      })
      .from(biometricDevices)
      .where(
        and(
          eq(biometricDevices.mode, "pull"),
          eq(biometricDevices.isActive, true),
          isNotNull(biometricDevices.pullUrl),
          isNull(biometricDevices.deletedAt),
        ),
      );

    const now = Date.now();
    const due = devices.filter((d) => {
      if (!d.lastPolledAt) return true;
      const intervalMs = Math.max(1, d.pollIntervalMinutes) * 60_000;
      return now - d.lastPolledAt.getTime() >= intervalMs;
    });

    // Sequential on purpose: parallel pulls across many devices could pile
    // up DB writes; each device already has a 10s fetch timeout.
    // pullDeviceOnce never throws — failures are captured per device.
    const results = [];
    for (const device of due) {
      const result = await pullDeviceOnce(device, {
        attributionEmployeeId: null,
        actorUserId: null,
        origin: "pull",
      });
      results.push({
        deviceId: result.deviceId,
        device: result.deviceName,
        ok: result.ok,
        message: result.message,
        imported: result.summary?.imported ?? 0,
        skipped: result.summary?.skipped ?? 0,
      });
    }

    const failures = results.filter((r) => !r.ok).length;

    await db.insert(auditLogs).values({
      userId: null,
      action: "cron.biometric_pull",
      tableName: "attendance_logs",
      newValues: {
        activeDevices: devices.length,
        polled: due.length,
        failures,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      success: failures === 0,
      activeDevices: devices.length,
      polled: due.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/biometric-pull] Job failed:", error);

    await db
      .insert(auditLogs)
      .values({
        userId: null,
        action: "cron.biometric_pull",
        tableName: "attendance_logs",
        newValues: { outcome: "failure", error: message },
      })
      .catch((auditErr) =>
        console.error("[cron/biometric-pull] Audit write failed:", auditErr),
      );

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
