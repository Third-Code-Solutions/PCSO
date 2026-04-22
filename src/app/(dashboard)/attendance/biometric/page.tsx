/**
 * /attendance/biometric — List all biometric imports (TAM-004).
 *
 * Features:
 *   - List all biometric CSV imports with match statistics
 *   - Filter by status (processing, completed, failed)
 *   - View import details and matched/unmatched records
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { biometricImports } from "@/lib/db/schema/attendance";
import { eq, desc, isNull } from "drizzle-orm";
import { format } from "date-fns";

interface PageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

export const metadata = { title: "Biometric Imports" };

export default async function BiometricImportsPage({
  searchParams,
}: PageProps) {
  await requirePermission("attendance", "approve");
  const params = await searchParams;

  const status = params.status || "all";

  // Build query
  const conditions = [isNull(biometricImports.deletedAt)];

  if (status !== "all") {
    conditions.push(eq(biometricImports.status, status as any));
  }

  const imports = await db.query.biometricImports
    .findMany({
      where: conditions.length > 0 ? conditions[0] : undefined,
      with: {
        importedBy: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [desc(biometricImports.createdAt)],
      limit: 50,
    })
    .catch(() => []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">
            Biometric Imports
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            View biometric CSV import history and match statistics (TAM-004)
          </p>
        </div>
        <Link
          href="/attendance/import"
          className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
        >
          + New Import
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Imports", value: imports.length },
          {
            label: "Processing",
            value: imports.filter((i) => i.status === "processing").length,
          },
          {
            label: "Completed",
            value: imports.filter((i) => i.status === "completed").length,
          },
          {
            label: "Failed",
            value: imports.filter((i) => i.status === "failed").length,
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-[#0B2545]">{value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm sm:grid-cols-12"
      >
        <div className="sm:col-span-4">
          <label
            htmlFor="filter-status"
            className="block text-xs font-medium text-gray-500"
          >
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          >
            <option value="all">All</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="sm:col-span-8 flex items-end gap-3">
          <button
            type="submit"
            className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
          >
            Apply Filter
          </button>
          <Link
            href="/attendance/biometric"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Imports Table */}
      <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Import Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                File Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Total Records
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Matched
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Unmatched
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Imported By
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {imports.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No biometric imports found. Upload a CSV to get started.
                </td>
              </tr>
            )}
            {imports.map((imp) => (
              <tr key={imp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700">
                  {format(new Date(imp.importDate), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-[#0B2545]">
                  {imp.fileName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {imp.recordCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-green-700">
                  {imp.matchedCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-red-700">
                  {imp.unmatchedCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {imp.importedBy
                    ? `${imp.importedBy.firstName} ${imp.importedBy.lastName}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      imp.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : imp.status === "processing"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {imp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Link
                    href={`/attendance/biometric/${imp.id}`}
                    className="text-sm font-medium text-[#C8A84B] hover:underline"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {imports.length > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          Showing {imports.length} import{imports.length !== 1 ? "s" : ""}.
          Latest:{" "}
          {imports[0]
            ? format(new Date(imports[0].createdAt), "MMM d, yyyy h:mm a")
            : "—"}
        </p>
      )}
    </main>
  );
}
