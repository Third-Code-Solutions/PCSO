/**
 * HR Accomplishment Report — TOR 1.3.24 (PIM-007)
 *
 * Per-HR-processor statistics for a date range: document requests handled
 * by type and outcome, PDS update requests approved, and 201-file document
 * uploads validated.
 */

import { requirePermission } from "@/lib/auth/guards";
import { HrAccomplishmentsClient } from "./_client";

export const metadata = {
  title: "HR Accomplishment Report",
  description: "Per-processor HR transaction statistics for a date range.",
};

export default async function HrAccomplishmentsPage() {
  await requirePermission("reports", "view");

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          HR Accomplishment Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Documents processed, PDS updates approved, and 201-file uploads
          validated per HR staff member (TOR 1.3.24)
        </p>
      </header>

      <HrAccomplishmentsClient />
    </div>
  );
}
