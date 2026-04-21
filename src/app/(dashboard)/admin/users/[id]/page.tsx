import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

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
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("system_users")
    .select(
      `
      id, email, role, is_active, last_login, created_at, auth_uid,
      offices(name, code),
      employees(first_name, last_name, position_title, employee_no)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function UserDetailPage({ params }: PageProps) {
  await requirePermission("admin", "view");
  const { id } = await params;
  const user = await getUser(id);

  if (!user) notFound();

  const office = Array.isArray(user.offices) ? user.offices[0] : user.offices;
  const employee = Array.isArray(user.employees)
    ? user.employees[0]
    : user.employees;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={user.email as string}
        description="System user account details"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: user.email as string },
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
            <dd>{user.email as string}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Role</dt>
            <dd>{ROLE_LABELS[user.role as string] ?? (user.role as string)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Status</dt>
            <dd>
              {user.is_active ? (
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
              {office
                ? `${(office as { name: string }).name} (${(office as { code: string }).code})`
                : "Org-wide"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">
              Linked Employee
            </dt>
            <dd>
              {employee
                ? `${(employee as { first_name: string }).first_name} ${(employee as { last_name: string }).last_name} — ${(employee as { employee_no: string }).employee_no}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">Last Login</dt>
            <dd>
              {user.last_login
                ? new Date(user.last_login as string).toLocaleString("en-PH")
                : "Never"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">
              Account Created
            </dt>
            <dd>
              {new Date(user.created_at as string).toLocaleString("en-PH")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-muted-foreground">
              Supabase Auth UID
            </dt>
            <dd className="font-mono text-xs text-muted-foreground">
              {(user.auth_uid as string) ?? "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
