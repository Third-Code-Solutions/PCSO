"use server";

/**
 * Biometric device registry actions — TOR 1.5.2 (TAM-004).
 *
 * Register / edit / deactivate BFR devices and trigger manual pulls.
 * On registration a random 32-byte API key is generated; only its SHA-256
 * hex lands in the database and the plaintext is returned ONCE for the
 * admin to copy into the device configuration.
 *
 * Every mutation: requirePermission("attendance","edit") → Zod-validate →
 * mutate → audit log → revalidatePath (mirrors sibling attendance actions).
 */

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { biometricDevices } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { pullDeviceOnce } from "@/lib/actions/attendance/biometric-pull";

// ─── Validation ───────────────────────────────────────────────────────────────

const DeviceBaseSchema = z.object({
  name: z.string().min(2).max(200),
  vendor: z.string().max(200).optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  officeId: z.string().uuid().optional().nullable(),
  mode: z.enum(["push", "pull", "manual"]),
  payloadFormat: z.enum(["csv", "json", "xml"]),
  pullUrl: z.string().url().max(2000).optional().nullable(),
  pollIntervalMinutes: z.number().int().min(5).max(1440).default(60),
});

const CreateDeviceSchema = DeviceBaseSchema.refine(
  (d) => d.mode === "push" || (d.pullUrl && d.pullUrl.length > 0),
  {
    message: "Pull and manual devices require a pull URL",
    path: ["pullUrl"],
  },
);

const UpdateDeviceSchema = DeviceBaseSchema.partial().extend({
  id: z.string().uuid(),
});

const SetActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

const PullNowSchema = z.object({ deviceId: z.string().uuid() });

const DEVICES_PATH = "/attendance/biometric/devices";

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Registers a device. Returns the plaintext API key exactly once — it is
 * never retrievable again (only the SHA-256 hash is stored).
 */
export async function createBiometricDevice(input: unknown): Promise<{
  success: true;
  deviceId: string;
  apiKey: string;
}> {
  const user = await requirePermission("attendance", "edit");
  const parsed = CreateDeviceSchema.parse(input);

  const apiKey = randomBytes(32).toString("hex");
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  const [inserted] = await db
    .insert(biometricDevices)
    .values({
      name: parsed.name,
      vendor: parsed.vendor ?? null,
      serialNumber: parsed.serialNumber ?? null,
      officeId: parsed.officeId ?? null,
      mode: parsed.mode,
      payloadFormat: parsed.payloadFormat,
      pullUrl: parsed.pullUrl ?? null,
      pollIntervalMinutes: parsed.pollIntervalMinutes,
      apiKeyHash,
      isActive: true,
    })
    .returning({ id: biometricDevices.id });

  if (!inserted) {
    throw new Error("Failed to register the device.");
  }

  await auditLog({
    userId: user.id,
    action: "biometric_device.create",
    table: "biometric_devices",
    recordId: inserted.id,
    module: "TAM",
    subModule: "biometric_devices",
    newValues: {
      name: parsed.name,
      mode: parsed.mode,
      payloadFormat: parsed.payloadFormat,
      officeId: parsed.officeId ?? null,
      // Never log the key or its hash.
    },
  });

  revalidatePath(DEVICES_PATH);

  return { success: true, deviceId: inserted.id, apiKey };
}

/** Updates device metadata / connection settings (never the API key). */
export async function updateBiometricDevice(input: unknown): Promise<{
  success: true;
}> {
  const user = await requirePermission("attendance", "edit");
  const parsed = UpdateDeviceSchema.parse(input);
  const { id, ...changes } = parsed;

  const [existing] = await db
    .select({
      id: biometricDevices.id,
      name: biometricDevices.name,
      mode: biometricDevices.mode,
      pullUrl: biometricDevices.pullUrl,
    })
    .from(biometricDevices)
    .where(and(eq(biometricDevices.id, id), isNull(biometricDevices.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Device not found.");
  }

  const nextMode = changes.mode ?? existing.mode;
  const nextPullUrl =
    changes.pullUrl !== undefined ? changes.pullUrl : existing.pullUrl;
  if (nextMode !== "push" && !nextPullUrl) {
    throw new Error("Pull and manual devices require a pull URL.");
  }

  await db
    .update(biometricDevices)
    .set({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.vendor !== undefined
        ? { vendor: changes.vendor ?? null }
        : {}),
      ...(changes.serialNumber !== undefined
        ? { serialNumber: changes.serialNumber ?? null }
        : {}),
      ...(changes.officeId !== undefined
        ? { officeId: changes.officeId ?? null }
        : {}),
      ...(changes.mode !== undefined ? { mode: changes.mode } : {}),
      ...(changes.payloadFormat !== undefined
        ? { payloadFormat: changes.payloadFormat }
        : {}),
      ...(changes.pullUrl !== undefined
        ? { pullUrl: changes.pullUrl ?? null }
        : {}),
      ...(changes.pollIntervalMinutes !== undefined
        ? { pollIntervalMinutes: changes.pollIntervalMinutes }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(biometricDevices.id, id));

  await auditLog({
    userId: user.id,
    action: "biometric_device.update",
    table: "biometric_devices",
    recordId: id,
    module: "TAM",
    subModule: "biometric_devices",
    newValues: { ...changes },
  });

  revalidatePath(DEVICES_PATH);
  return { success: true };
}

/** Activates / deactivates a device (deactivation blocks push auth + polling). */
export async function setBiometricDeviceActive(input: unknown): Promise<{
  success: true;
  isActive: boolean;
}> {
  const user = await requirePermission("attendance", "edit");
  const parsed = SetActiveSchema.parse(input);

  const [updated] = await db
    .update(biometricDevices)
    .set({ isActive: parsed.isActive, updatedAt: new Date() })
    .where(
      and(
        eq(biometricDevices.id, parsed.id),
        isNull(biometricDevices.deletedAt),
      ),
    )
    .returning({ id: biometricDevices.id });

  if (!updated) {
    throw new Error("Device not found.");
  }

  await auditLog({
    userId: user.id,
    action: parsed.isActive
      ? "biometric_device.activate"
      : "biometric_device.deactivate",
    table: "biometric_devices",
    recordId: parsed.id,
    module: "TAM",
    subModule: "biometric_devices",
    newValues: { isActive: parsed.isActive },
  });

  revalidatePath(DEVICES_PATH);
  return { success: true, isActive: parsed.isActive };
}

/**
 * Manual pull trigger (TOR 1.5.2 "manual trigger"). Fetches the device's
 * pull URL immediately and ingests the payload through the shared pipeline.
 */
export async function pullBiometricDeviceNow(input: unknown): Promise<{
  success: boolean;
  message: string;
  imported: number;
  skipped: number;
  unmatchedBadges: number;
}> {
  const user = await requirePermission("attendance", "edit");
  const parsed = PullNowSchema.parse(input);

  const [device] = await db
    .select({
      id: biometricDevices.id,
      name: biometricDevices.name,
      mode: biometricDevices.mode,
      payloadFormat: biometricDevices.payloadFormat,
      pullUrl: biometricDevices.pullUrl,
      isActive: biometricDevices.isActive,
    })
    .from(biometricDevices)
    .where(
      and(
        eq(biometricDevices.id, parsed.deviceId),
        isNull(biometricDevices.deletedAt),
      ),
    )
    .limit(1);

  if (!device) {
    throw new Error("Device not found.");
  }
  if (!device.isActive) {
    throw new Error("Device is deactivated. Reactivate it before pulling.");
  }
  if (device.mode === "push") {
    throw new Error("Push devices send data themselves and cannot be pulled.");
  }
  if (!device.pullUrl) {
    throw new Error("Device has no pull URL configured.");
  }

  const result = await pullDeviceOnce(device, {
    attributionEmployeeId: user.employeeId ?? null,
    actorUserId: user.id,
    origin: "manual_pull",
  });

  await auditLog({
    userId: user.id,
    action: "biometric_device.manual_pull",
    table: "biometric_devices",
    recordId: device.id,
    module: "TAM",
    subModule: "biometric_devices",
    outcome: result.ok ? "success" : "failure",
    newValues: {
      device: device.name,
      message: result.message,
      imported: result.summary?.imported ?? 0,
      skipped: result.summary?.skipped ?? 0,
    },
  });

  revalidatePath(DEVICES_PATH);

  return {
    success: result.ok,
    message: result.message,
    imported: result.summary?.imported ?? 0,
    skipped: result.summary?.skipped ?? 0,
    unmatchedBadges: result.summary?.unmatchedBadgeCount ?? 0,
  };
}
