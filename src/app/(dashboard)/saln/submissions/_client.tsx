"use client";

/**
 * SubmissionsBrowser — client-side filter controls + grouped submissions table.
 *
 * Renders the SALN submissions list grouped by year with:
 *   - Status filter pill row
 *   - Employee No. search field (super_admin only)
 *   - Net worth summary per row
 *   - Download PDF link (triggers window.print on the saln-form template)
 *   - Edit link for draft/deficient submissions
 *   - View link for all submissions
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  FileTextIcon,
  DownloadIcon,
  PencilIcon,
  EyeIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/utils/saln/net-worth";
import type { SalnSubmissionRow } from "@/app/(dashboard)/saln/queries";
import type { SalnStatus } from "@/lib/validations/saln";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_STATUSES: { value: SalnStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "received", label: "Received" },
  { value: "verified", label: "Verified" },
  { value: "deficient", label: "Deficient" },
];

const FILING_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  initial: "Initial",
  upon_assumption: "Upon Assumption",
  upon_separation: "Upon Separation",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BadgeVariant = "secondary" | "outline" | "destructive" | "default";

function statusBadgeVariant(status: SalnStatus): BadgeVariant {
  const map: Record<SalnStatus, BadgeVariant> = {
    draft: "secondary",
    submitted: "outline",
    received: "outline",
    verified: "default",
    deficient: "destructive",
  };
  return map[status];
}

function statusLabel(status: SalnStatus): string {
  const map: Record<SalnStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    received: "Received",
    verified: "Verified",
    deficient: "Deficient",
  };
  return map[status];
}

function isEditable(status: SalnStatus): boolean {
  return status === "draft" || status === "deficient";
}

/** Group an array of submissions by year, returning years in descending order. */
function groupByYear(
  rows: SalnSubmissionRow[],
): Map<number, SalnSubmissionRow[]> {
  const map = new Map<number, SalnSubmissionRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.year);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(row.year, [row]);
    }
  }
  // Return sorted descending by year
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

// ---------------------------------------------------------------------------
// PDF download handler
// ---------------------------------------------------------------------------

function handlePdfPrint(submissionId: string): void {
  // Open the submission detail page which renders the saln-form PDF template.
  // The ?print=1 param signals the detail page to trigger window.print().
  window.open(`/saln/${submissionId}?print=1`, "_blank", "noopener,noreferrer");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusFilterProps {
  active: SalnStatus | "all";
  onChange: (value: SalnStatus | "all") => void;
}

function StatusFilter({ active, onChange }: StatusFilterProps) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Filter by status"
    >
      {ALL_STATUSES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={[
            "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pcso-gold",
            active === value
              ? "bg-pcso-navy text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/70",
          ].join(" ")}
          aria-pressed={active === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface YearGroupProps {
  year: number;
  rows: SalnSubmissionRow[];
  isSuperAdmin: boolean;
}

function YearGroup({ year, rows, isSuperAdmin }: YearGroupProps) {
  const totalNetWorth = rows.reduce((acc, r) => {
    // Simple summation for the group header — display only, not for compliance.
    const cents = Math.round(parseFloat(r.netWorth) * 100);
    return acc + cents;
  }, 0);
  const groupNetWorthStr = (totalNetWorth / 100).toFixed(2);

  return (
    <section aria-labelledby={`year-${year}-heading`} className="mb-8">
      {/* Year header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2
            id={`year-${year}-heading`}
            className="text-sm font-semibold text-pcso-navy"
          >
            Calendar Year {year}
          </h2>
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "filing" : "filings"}
          </span>
        </div>
        {rows.length > 1 && (
          <span className="text-xs text-muted-foreground font-mono">
            Combined net worth: {formatPeso(groupNetWorthStr)}
          </span>
        )}
      </div>

      {/* Submissions table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {isSuperAdmin && (
                <TableHead className="w-32">Employee No.</TableHead>
              )}
              {isSuperAdmin && <TableHead>Employee Name</TableHead>}
              <TableHead>Filing Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Filed</TableHead>
              <TableHead className="text-right">Total Assets</TableHead>
              <TableHead className="text-right">Total Liabilities</TableHead>
              <TableHead className="text-right font-semibold">
                Net Worth
              </TableHead>
              <TableHead className="w-36">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                {isSuperAdmin && (
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.employeeNo}
                  </TableCell>
                )}
                {isSuperAdmin && (
                  <TableCell className="text-sm font-medium">
                    {s.employeeName}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {FILING_TYPE_LABELS[s.filingType] ?? s.filingType}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusBadgeVariant(s.status)}
                    className="capitalize"
                  >
                    {statusLabel(s.status)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {s.dateFiled ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatPeso(s.totalAssets)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  ({formatPeso(s.totalLiabilities)})
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatPeso(s.netWorth)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {/* View */}
                    <Link
                      href={`/saln/${s.id}`}
                      className="inline-flex items-center gap-1 text-xs text-pcso-navy underline hover:no-underline"
                      aria-label={`View SALN filing for ${isSuperAdmin ? s.employeeName : "year " + s.year}`}
                    >
                      <EyeIcon className="h-3 w-3" aria-hidden />
                      View
                    </Link>

                    {/* Edit — only for draft or deficient */}
                    {isEditable(s.status) && (
                      <Link
                        href={`/saln/${s.id}/edit`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:no-underline"
                        aria-label={`Edit SALN filing`}
                      >
                        <PencilIcon className="h-3 w-3" aria-hidden />
                        Edit
                      </Link>
                    )}

                    {/* PDF download — available for all non-draft submissions */}
                    {s.status !== "draft" && (
                      <button
                        type="button"
                        onClick={() => handlePdfPrint(s.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pcso-gold rounded"
                        aria-label={`Download PDF for SALN filing`}
                      >
                        <DownloadIcon className="h-3 w-3" aria-hidden />
                        PDF
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
      <FileTextIcon
        className="mb-3 h-10 w-10 text-muted-foreground/40"
        aria-hidden
      />
      <p className="text-sm font-medium text-foreground">
        {hasFilters
          ? "No submissions match your filters"
          : "No SALN submissions yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilters
          ? "Try clearing your filters to see all submissions."
          : "File your first SALN to comply with RA 6713."}
      </p>
      {!hasFilters && (
        <Button
          asChild
          className="mt-4 bg-pcso-navy text-white hover:bg-pcso-navy-light"
          size="sm"
        >
          <Link href="/saln/new">File Now</Link>
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CSV export — client-side (own submissions only, for super_admin it's done
// via the server action in /saln/tracking; here we export only what's in view).
// ---------------------------------------------------------------------------

function exportVisibleAsCsv(
  rows: SalnSubmissionRow[],
  isSuperAdmin: boolean,
): void {
  const headers = [
    "Year",
    "Filing Type",
    "Status",
    "Date Filed",
    "Total Assets",
    "Total Liabilities",
    "Net Worth",
    ...(isSuperAdmin ? ["Employee No.", "Employee Name"] : []),
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      String(r.year),
      FILING_TYPE_LABELS[r.filingType] ?? r.filingType,
      statusLabel(r.status),
      r.dateFiled ?? "",
      r.totalAssets,
      r.totalLiabilities,
      r.netWorth,
      ...(isSuperAdmin ? [r.employeeNo, r.employeeName] : []),
    ]
      .map(escape)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saln-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Pagination control
// ---------------------------------------------------------------------------

interface PaginationBarProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}

function PaginationBar({
  page,
  perPage,
  total,
  onPageChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of{" "}
        <strong>{total}</strong> submissions
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          Prev
        </Button>
        <span className="px-2 text-xs text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRightIcon className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export interface SubmissionsBrowserProps {
  submissions: SalnSubmissionRow[];
  isSuperAdmin: boolean;
  activeStatus: SalnStatus | undefined;
  activeEmployeeNo: string;
  activeYear?: number | undefined;
  page: number;
  perPage: number;
  total: number;
}

export function SubmissionsBrowser({
  submissions,
  isSuperAdmin,
  activeStatus,
  activeEmployeeNo,
  activeYear,
  page,
  perPage,
  total,
}: SubmissionsBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local controlled state for the employee search input (debounced URL push).
  const [employeeSearch, setEmployeeSearch] = React.useState(activeEmployeeNo);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push URL search params without a full navigation — preserves scroll position.
  const pushParams = React.useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (resetPage) params.delete("page");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function handleStatusChange(value: SalnStatus | "all") {
    pushParams({ status: value === "all" ? undefined : value });
  }

  function handleEmployeeSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEmployeeSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ employee_no: val || undefined });
    }, 350);
  }

  function handleYearChange(val: string) {
    pushParams({ year: val === "all" ? undefined : val });
  }

  function handlePageChange(next: number) {
    pushParams({ page: String(next) }, false);
  }

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const grouped = groupByYear(submissions);
  const hasFilters = Boolean(activeStatus || activeEmployeeNo || activeYear);

  // Year options — current year + last 5
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <StatusFilter
          active={activeStatus ?? "all"}
          onChange={handleStatusChange}
        />

        {isSuperAdmin && (
          <>
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="year-filter"
                className="text-xs text-muted-foreground"
              >
                Year:
              </label>
              <select
                id="year-filter"
                value={activeYear ? String(activeYear) : "all"}
                onChange={(e) => handleYearChange(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pcso-gold"
                aria-label="Filter by coverage year"
              >
                <option value="all">All years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative ml-auto">
              <SearchIcon
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Filter by employee no."
                value={employeeSearch}
                onChange={handleEmployeeSearchChange}
                className="h-8 w-52 pl-8 text-sm"
                aria-label="Filter by employee number"
              />
            </div>
          </>
        )}

        {submissions.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={isSuperAdmin ? "" : "ml-auto"}
            onClick={() => exportVisibleAsCsv(submissions, isSuperAdmin)}
            aria-label="Export visible submissions as CSV"
          >
            <DownloadIcon className="mr-1.5 h-3 w-3" aria-hidden />
            Export CSV
          </Button>
        )}
      </div>

      {/* ── Results summary ────────────────────────────────────── */}
      {submissions.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Showing <strong>{submissions.length}</strong>{" "}
          {submissions.length === 1 ? "submission" : "submissions"}
          {activeStatus ? ` with status "${activeStatus}"` : ""}
          {activeEmployeeNo ? ` for employee "${activeEmployeeNo}"` : ""}
          {activeYear ? ` in ${activeYear}` : ""} across{" "}
          <strong>{grouped.size}</strong>{" "}
          {grouped.size === 1 ? "year" : "years"}
          {isSuperAdmin && total > submissions.length ? (
            <> ({total} total)</>
          ) : null}
          .
        </p>
      )}

      {/* ── Grouped year sections ──────────────────────────────── */}
      {submissions.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        [...grouped.entries()].map(([year, rows]) => (
          <YearGroup
            key={year}
            year={year}
            rows={rows}
            isSuperAdmin={isSuperAdmin}
          />
        ))
      )}

      {/* ── Pagination (super_admin only) ─────────────────────── */}
      {isSuperAdmin && (
        <PaginationBar
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
