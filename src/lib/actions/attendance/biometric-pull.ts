import "server-only";

/**
 * Biometric device PULL orchestration — TOR 1.5.2 (TAM-004).
 *
 * `pullDeviceOnce` fetches a device's pull endpoint (10s timeout), parses the
 * payload per the device's configured format (CSV / JSON / XML), runs the
 * shared ingest pipeline, and records the outcome on the device row
 * (last_polled_at / last_pull_status / last_pull_message).
 *
 * Used by the /api/cron/biometric-pull scheduler and the manual
 * "Pull now" server action. Never throws: every failure is captured into
 * the returned result and the device row.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { biometricDevices } from "@/lib/db/schema";
import {
  parsePunchCsv,
  parsePunchRecords,
  parsePunchXml,
  type PayloadParseResult,
} from "@/lib/utils/attendance/biometric-payload";
import {
  ingestDevicePunches,
  type DeviceIngestSummary,
} from "./biometric-ingest";

const PULL_TIMEOUT_MS = 10_000;
const MAX_PULL_BYTES = 10 * 1024 * 1024; // 10MB safety cap

export interface PullableDevice {
  id: string;
  name: string;
  payloadFormat: "csv" | "json" | "xml";
  pullUrl: string | null;
}

export interface PullDeviceResult {
  deviceId: string;
  deviceName: string;
  ok: boolean;
  message: string;
  summary: DeviceIngestSummary | null;
}

/** Parses a raw payload string per the device's configured format. */
export function parseDevicePayload(
  format: "csv" | "json" | "xml",
  text: string,
): PayloadParseResult {
  if (format === "csv") return parsePunchCsv(text);
  if (format === "xml") return parsePunchXml(text);

  // JSON: accept either { records: [...] } or a bare array.
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return {
      punches: [],
      errors: [{ index: 1, message: "Payload is not valid JSON" }],
    };
  }
  const records = Array.isArray(decoded)
    ? decoded
    : typeof decoded === "object" &&
        decoded !== null &&
        Array.isArray((decoded as { records?: unknown }).records)
      ? (decoded as { records: unknown[] }).records
      : null;
  if (!records) {
    return {
      punches: [],
      errors: [
        {
          index: 1,
          message: 'JSON payload must be an array or {"records": [...]}',
        },
      ],
    };
  }
  return parsePunchRecords(records);
}

/**
 * Pulls and ingests one device. Updates the device's poll bookkeeping
 * columns regardless of outcome.
 *
 * @param attributionEmployeeId employee UUID to attribute raw-record
 *        archival to (manual pulls); null for scheduler pulls.
 * @param actorUserId auth user id for the transaction log; null for cron.
 */
export async function pullDeviceOnce(
  device: PullableDevice,
  options: {
    attributionEmployeeId: string | null;
    actorUserId: string | null;
    origin: "pull" | "manual_pull";
  },
): Promise<PullDeviceResult> {
  const polledAt = new Date();
  let status: "success" | "partial" | "error" = "error";
  let message = "";
  let summary: DeviceIngestSummary | null = null;

  try {
    if (!device.pullUrl) {
      throw new Error("Device has no pull URL configured");
    }

    const response = await fetch(device.pullUrl, {
      method: "GET",
      headers: {
        accept: "text/csv, application/json, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(PULL_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Device responded ${response.status} ${response.statusText}`,
      );
    }

    const text = await response.text();
    if (text.length > MAX_PULL_BYTES) {
      throw new Error("Device payload exceeds the 10MB pull limit");
    }

    const parsed = parseDevicePayload(device.payloadFormat, text);

    summary = await ingestDevicePunches({
      punches: parsed.punches,
      parseErrorCount: parsed.errors.length,
      origin: options.origin,
      deviceId: device.id,
      deviceName: device.name,
      attributionEmployeeId: options.attributionEmployeeId,
      actorUserId: options.actorUserId,
    });

    const hadIssues = summary.skipped > 0 || parsed.errors.length > 0;
    status = hadIssues
      ? summary.imported > 0
        ? "partial"
        : "error"
      : "success";
    message =
      `${summary.receivedPunches} punches → ${summary.dayRows} day rows; ` +
      `${summary.imported} imported, ${summary.skipped} skipped, ` +
      `${summary.unmatchedBadgeCount} unmatched badges, ` +
      `${parsed.errors.length} parse errors`;
  } catch (err: unknown) {
    status = "error";
    message =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? `Pull timed out after ${PULL_TIMEOUT_MS / 1000}s`
          : err.message
        : "Unknown pull failure";
  }

  try {
    await db
      .update(biometricDevices)
      .set({
        lastPolledAt: polledAt,
        lastPullStatus: status,
        lastPullMessage: message.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(biometricDevices.id, device.id));
  } catch (err) {
    console.error(
      `[biometric-pull] Failed to update device ${device.id} poll status:`,
      err,
    );
  }

  return {
    deviceId: device.id,
    deviceName: device.name,
    ok: status !== "error",
    message,
    summary,
  };
}
