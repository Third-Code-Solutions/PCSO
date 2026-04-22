/**
 * /attendance/import — Biometric CSV import (server wrapper).
 *
 * Enforces `attendance.approve` permission server-side before rendering
 * the client-side import widget.
 */

import { requirePermission } from "@/lib/auth/guards";
import { ImportBiometricClient } from "./_client";

export const metadata = { title: "Import Biometric Data" };

export default async function ImportBiometricPage() {
  await requirePermission("attendance", "approve");
  return <ImportBiometricClient />;
}
