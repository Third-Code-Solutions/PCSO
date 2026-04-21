import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layouts/page-header";
import type { UserRow } from "@/components/admin/users-table";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requirePermission } from "@/lib/auth/guards";
import { getUsersPage, getOfficeOptions } from "./queries";
import { UsersFilterBar, UsersPagination, UsersTableShell } from "./_client";

export const metadata: Metadata = {
  title: "User Management — Admin",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

function flatten(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requirePermission("admin", "view");

  const raw = await searchParams;
  const flat = (k: string) => flatten(raw[k]);

  const statusRaw = flat("status");
  const status: "" | "active" | "inactive" =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "";
  const pageSizeRaw = flat("pageSize");
  const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
  const pageRaw = flat("page");
  const page = pageRaw ? parseInt(pageRaw, 10) : 1;

  const queryParams = {
    search: flat("search"),
    role: flat("role"),
    status,
    officeId: flat("officeId"),
    page,
    pageSize,
  };

  const [result, officeOptions] = await Promise.all([
    getUsersPage(queryParams),
    getOfficeOptions(),
  ]);

  const rows: UserRow[] = result.rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    officeName: r.officeName,
    employeeName: r.employeeName,
    isActive: r.isActive,
    lastLogin: r.lastSignInAt ?? r.lastLogin,
    createdAt: r.createdAt,
  }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="User Management"
        description={`${result.total.toLocaleString()} system account${result.total !== 1 ? "s" : ""} — ${result.activeCount.toLocaleString()} active, ${result.inactiveCount.toLocaleString()} inactive.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Users" },
        ]}
        actions={
          <Button
            asChild
            size="sm"
            className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            <Link href="/admin/users/new">
              <UserPlus className="h-4 w-4" />
              Add User
            </Link>
          </Button>
        }
      />

      <UsersFilterBar
        initial={{
          search: queryParams.search,
          role: queryParams.role,
          status: queryParams.status,
          officeId: queryParams.officeId,
          pageSize: result.pageSize,
        }}
        offices={officeOptions}
      />

      <UsersTableShell users={rows} />

      <UsersPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        searchParams={{
          search: queryParams.search,
          role: queryParams.role,
          status: queryParams.status,
          officeId: queryParams.officeId,
          pageSize: String(result.pageSize),
        }}
      />

      {/* Realtime: re-renders the page when system_users or audit_logs change */}
      <RealtimeBoundary tables={["system_users", "audit_logs"]} />
    </div>
  );
}
