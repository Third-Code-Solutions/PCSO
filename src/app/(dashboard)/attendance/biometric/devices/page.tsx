/**
 * /attendance/biometric/devices — Biometric device registry (TOR 1.5.2).
 *
 * Register BFR devices (push / pull / manual), manage their connection
 * settings, deactivate them, and trigger manual pulls. Device API keys are
 * shown exactly once at registration; only SHA-256 hashes are stored.
 */

import Link from "next/link";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { biometricDevices, offices } from "@/lib/db/schema";
import { BiometricDevicesClient } from "./_client";

export const metadata = { title: "Biometric Devices" };

export default async function BiometricDevicesPage() {
  // Device config is HR-admin surface (PRD §11 "Biometric Device Config").
  await requirePermission("attendance", "edit");

  const [deviceRows, officeRows] = await Promise.all([
    db
      .select({
        id: biometricDevices.id,
        name: biometricDevices.name,
        vendor: biometricDevices.vendor,
        serialNumber: biometricDevices.serialNumber,
        officeId: biometricDevices.officeId,
        officeName: offices.name,
        mode: biometricDevices.mode,
        payloadFormat: biometricDevices.payloadFormat,
        pullUrl: biometricDevices.pullUrl,
        pollIntervalMinutes: biometricDevices.pollIntervalMinutes,
        isActive: biometricDevices.isActive,
        lastPolledAt: biometricDevices.lastPolledAt,
        lastPullStatus: biometricDevices.lastPullStatus,
        lastPullMessage: biometricDevices.lastPullMessage,
      })
      .from(biometricDevices)
      .leftJoin(offices, eq(biometricDevices.officeId, offices.id))
      .where(isNull(biometricDevices.deletedAt))
      .orderBy(desc(biometricDevices.createdAt)),
    db
      .select({ id: offices.id, name: offices.name })
      .from(offices)
      .orderBy(asc(offices.name)),
  ]);

  const devices = deviceRows.map((d) => ({
    ...d,
    lastPolledAt: d.lastPolledAt ? d.lastPolledAt.toISOString() : null,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">
            Biometric Devices
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Register BFR devices and manage push keys, pull schedules, and
            payload formats (TAM-004)
          </p>
        </div>
        <Link
          href="/attendance/biometric"
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Import History
        </Link>
      </div>

      <BiometricDevicesClient devices={devices} offices={officeRows} />
    </main>
  );
}
