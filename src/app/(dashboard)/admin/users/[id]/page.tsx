import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { systemUsers } from "@/lib/db/schema/users";
import { employees } from "@/lib/db/schema/employees";
import { offices } from "@/lib/db/schema/offices";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "User Detail — Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  payroll_admin: "Payroll Admin",
  leave_approver: "Leave Approver",
  viewer: "Viewer",
  employee_self_service: "Employee (Self-Service)",
};

async function getUser(id: string) {
  const rows = await db
    .select({
      id: systemUsers.id,
      email: systemUsers.email,
      role: systemUsers.role,
      isActive: systemUsers.isActive,
      lastLogin: systemUsers.lastLogin,
      createdAt: systemUsers.createdAt,
      authUid: systemUsers.authUid,
      officeName: offices.name,
      officeCode: offices.code,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
      employeeNo: employees.employeeNo,
    })
    .from(systemUsers)
    .leftJoin(employees, eq(systemUsers.employeeId, employees.id))
    .leftJoin(offices, eq(systemUsers.officeId, offices.id))
    .where(eq(systemUsers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export default async function UserDetailPage({ params }: PageProps) {
  await requirePermission("admin", "view");
  const { id } = await params;
  const user = await getUser(id);

  if (!user) notFound();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={user.email}
        description="System user account details"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: user.email },
        ]}
        actions={
          <Button
            asChild
            size="sm"
            className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            <Link href={`/admin/users/${id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        }
      />

      <div className="max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Role</dt>
            <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Status</dt>
            <dd>
              {user.isActive ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Office Scope</dt>
            <dd>
              {user.officeName
                ? `${user.officeName} (${user.officeCode})`
                : "Org-wide"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">
              Linked Employee
            </dt>
            <dd>
              {user.employeeFirstName
                ? `${user.employeeFirstName} ${user.employeeLastName} — ${user.employeeNo}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Last Login</dt>
            <dd>
              {user.lastLogin
                ? new Date(user.lastLogin).toLocaleString("en-PH")
                : "Never"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">
              Account Created
            </dt>
            <dd>{new Date(user.createdAt).toLocaleString("en-PH")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">
              Supabase Auth UID
            </dt>
            <dd className="font-mono text-xs text-muted-foreground">
              {user.authUid ?? "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
