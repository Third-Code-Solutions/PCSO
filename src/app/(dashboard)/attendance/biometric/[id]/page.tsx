/**
 * /attendance/biometric/[id] — View biometric import details (TAM-005).
 */

import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  biometricImports,
  biometricRawRecords,
} from "@/lib/db/schema/attendance";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Biometric Import Details" };

export default async function BiometricImportDetailPage({ params }: PageProps) {
  await requirePermission("attendance", "approve");
  const { id } = await params;

  const importRecord = await db.query.biometricImports
    .findFirst({
      where: eq(biometricImports.id, id),
      with: {
        importedBy: {
          columns: {
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
      },
    })
    .catch(() => null);

  if (!importRecord) {
    notFound();
  }

  // Get raw records - matched and unmatched
  const rawRecords = await db.query.biometricRawRecords
    .findMany({
      where: eq(biometricRawRecords.importId, id),
      with: {
        employee: {
          columns: {
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
      },
      limit: 100,
    })
    .catch(() => []);

  const matchedRecords = rawRecords.filter((r) => r.matched);
  const unmatchedRecords = rawRecords.filter((r) => !r.matched);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">Import Details</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {importRecord.fileName} —{" "}
            {format(new Date(importRecord.importDate), "MMM d, yyyy")}
          </p>
        </div>
        <Link
          href="/attendance/biometric"
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Back to Imports
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Records", value: importRecord.recordCount },
          { label: "Matched", value: importRecord.matchedCount },
          { label: "Unmatched", value: importRecord.unmatchedCount },
          {
            label: "Match Rate",
            value: `${importRecord.recordCount > 0 ? Math.round((importRecord.matchedCount / importRecord.recordCount) * 100) : 0}%`,
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

      {/* Import Info */}
      <div className="mb-6 rounded-xl border border-[#0B2545]/10 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[#0B2545]">
          Import Information
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  importRecord.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : importRecord.status === "processing"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {importRecord.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Imported By</dt>
            <dd className="mt-1 text-sm text-gray-700">
              {importRecord.importedBy
                ? `${importRecord.importedBy.firstName} ${importRecord.importedBy.lastName} (${importRecord.importedBy.employeeNo})`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Import Date</dt>
            <dd className="mt-1 text-sm text-gray-700">
              {format(new Date(importRecord.createdAt), "MMM d, yyyy h:mm a")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">File Name</dt>
            <dd className="mt-1 text-sm font-mono text-gray-700">
              {importRecord.fileName}
            </dd>
          </div>
          {importRecord.errorLog && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-gray-500">Error Log</dt>
              <dd className="mt-1 rounded bg-red-50 border border-red-200 p-3 text-xs text-red-800">
                {importRecord.errorLog}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Matched Records */}
      {matchedRecords.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Matched Records ({matchedRecords.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Badge ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Matched At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matchedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-[#0B2545]">
                      {record.badgeId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {record.employee
                        ? `${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeNo})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {record.timestamp}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          record.recordType === "in"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {record.recordType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.matchedAt || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched Records */}
      {unmatchedRecords.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
            Unmatched Records ({unmatchedRecords.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-red-100 bg-red-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Badge ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {unmatchedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-red-50/50">
                    <td className="px-4 py-3 text-sm font-mono text-red-900">
                      {record.badgeId}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-red-700">
                      {record.timestamp}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-700">
                      {record.recordType}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">
                      No employee found with this badge ID
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rawRecords.length === 0 && (
        <div className="rounded-xl border border-[#0B2545]/10 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            No raw records found for this import.
          </p>
        </div>
      )}
    </main>
  );
}
