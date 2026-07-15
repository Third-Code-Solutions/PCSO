import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import {
  getErrorLogsPage,
  getErrorCodeOptions,
  type ErrorLogQueryParams,
  type ErrorLogRow,
} from "./queries";

export const metadata: Metadata = { title: "Error Logs — Admin" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

// ─── Filter bar (server-rendered GET form, audit-logs pattern) ───────────────

function FilterBar({
  params,
  codeOptions,
}: {
  params: ErrorLogQueryParams;
  codeOptions: string[];
}) {
  return (
    <form
      method="GET"
      className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1">
        <Label htmlFor="filter-level" className="text-xs">
          Level
        </Label>
        <select
          id="filter-level"
          name="level"
          defaultValue={params.level ?? ""}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Any level</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-errorCode" className="text-xs">
          Error code
        </Label>
        <Input
          id="filter-errorCode"
          name="errorCode"
          list="error-code-options"
          placeholder="e.g. PAYROLL_JOURNAL_EXPORT_FAILED"
          defaultValue={params.errorCode ?? ""}
          className="h-8 text-sm font-mono"
        />
        <datalist id="error-code-options">
          {codeOptions.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-source" className="text-xs">
          Source
        </Label>
        <Input
          id="filter-source"
          name="source"
          placeholder="module/route"
          defaultValue={params.source ?? ""}
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-pageSize" className="text-xs">
          Rows / page
        </Label>
        <select
          id="filter-pageSize"
          name="pageSize"
          defaultValue={String(params.pageSize ?? 50)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-dateFrom" className="text-xs">
          Date From
        </Label>
        <Input
          id="filter-dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={params.dateFrom ?? ""}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-dateTo" className="text-xs">
          Date To
        </Label>
        <Input
          id="filter-dateTo"
          name="dateTo"
          type="date"
          defaultValue={params.dateTo ?? ""}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button
          type="submit"
          size="sm"
          className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
        >
          Apply filters
        </Button>
        <Button type="reset" variant="outline" size="sm" asChild>
          <Link href="/admin/error-logs">Clear</Link>
        </Button>
      </div>
    </form>
  );
}

// ─── Level badge ─────────────────────────────────────────────────────────────

function levelVariant(level: string): "destructive" | "warning" | "muted" {
  switch (level) {
    case "fatal":
      return "destructive";
    case "error":
      return "destructive";
    case "warn":
      return "warning";
    default:
      return "muted";
  }
}

// ─── Table ───────────────────────────────────────────────────────────────────

function ErrorLogTable({ rows }: { rows: ErrorLogRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No error logs match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Timestamp</th>
            <th className="px-4 py-2.5 font-medium">Level</th>
            <th className="px-4 py-2.5 font-medium">Code</th>
            <th className="px-4 py-2.5 font-medium">Message</th>
            <th className="px-4 py-2.5 font-medium">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {format(row.createdAt, "yyyy-MM-dd HH:mm:ss")}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={levelVariant(row.level)}>{row.level}</Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs">
                {row.errorCode ?? "—"}
              </td>
              <td className="max-w-md px-4 py-2.5">
                <p className="break-words">{row.message}</p>
                {row.affectedResource && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Resource: {row.affectedResource}
                  </p>
                )}
                {row.stackTrace && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-pcso-navy">
                      Stack trace
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] leading-relaxed">
                      {row.stackTrace}
                    </pre>
                  </details>
                )}
              </td>
              <td className="max-w-[200px] break-words px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {row.source ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination strip ────────────────────────────────────────────────────────

function PaginationStrip({
  page,
  totalPages,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
}) {
  function buildUrl(nextPage: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(nextPage));
    return `/admin/error-logs?${sp.toString()}`;
  }

  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{startRow.toLocaleString()}</span>
        –<span className="font-medium">{endRow.toLocaleString()}</span> of{" "}
        <span className="font-medium">{total.toLocaleString()}</span> entries
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link
            href={buildUrl(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page.toLocaleString()}</span> of{" "}
          <span className="font-medium">{totalPages.toLocaleString()}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={page >= totalPages}
        >
          <Link
            href={buildUrl(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
          >
            Next
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function flatten(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ErrorLogsPage({ searchParams }: PageProps) {
  // Super Admin only (TOR 3.4.4 admin viewer). `admin.edit` resolves to
  // super_admin exclusively in the permission matrix — unlike `admin.view`,
  // which also admits the read-only oversight roles. Route-level access via
  // ROUTE_ACCESS "/admin" is likewise super_admin-only.
  await requirePermission("admin", "edit");

  const raw = await searchParams;
  const flat = (k: string) => flatten(raw[k]);

  const pageSizeRaw = flat("pageSize");
  const pageRaw = flat("page");

  const queryParams: ErrorLogQueryParams = {
    level: flat("level"),
    errorCode: flat("errorCode"),
    source: flat("source"),
    dateFrom: flat("dateFrom"),
    dateTo: flat("dateTo"),
    page: pageRaw ? parseInt(pageRaw, 10) || 1 : 1,
    pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) || 50 : 50,
  };

  const [pageResult, codeOptions] = await Promise.all([
    getErrorLogsPage(queryParams),
    getErrorCodeOptions(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Error Logs"
        description="Structured application error log (TOR 3.4.4 / LOG-002). Client boundary reports, cron failures, and server-side errors land here."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Error Logs" },
        ]}
      />

      <FilterBar params={queryParams} codeOptions={codeOptions} />

      <ErrorLogTable rows={pageResult.rows} />

      <PaginationStrip
        page={pageResult.page}
        totalPages={pageResult.totalPages}
        total={pageResult.total}
        pageSize={pageResult.pageSize}
        searchParams={{
          level: queryParams.level,
          errorCode: queryParams.errorCode,
          source: queryParams.source,
          dateFrom: queryParams.dateFrom,
          dateTo: queryParams.dateTo,
          pageSize: String(pageResult.pageSize),
        }}
      />
    </div>
  );
}
