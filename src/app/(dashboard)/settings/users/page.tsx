import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { db } from "@/lib/db";
import { systemUsers } from "@/lib/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserRoleDialog } from "./_client";

export const metadata: Metadata = {
  title: "User Management",
};

async function getUsers() {
  return db.query.systemUsers.findMany({
    orderBy: desc(systemUsers.createdAt),
    with: {
      employee: {
        columns: {
          firstName: true,
          lastName: true,
          employeeNo: true,
        },
      },
      office: {
        columns: {
          name: true,
        },
      },
    },
  });
}

export default async function UsersPage() {
  const authUser = await requireAuth();

  // Super admin only
  if (!hasPermission(authUser.role, "admin", "edit")) {
    redirect("/dashboard");
  }

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage system users, roles, and dashboard profiles"
        breadcrumbs={[
          { label: "PCSO HRIS", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Users" },
        ]}
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Office Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.employee ? (
                      <div>
                        <div>
                          {user.employee.firstName} {user.employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.employee.employeeNo}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.role.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.office ? (
                      <span className="text-sm">{user.office.name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        All Offices
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isActive ? "success" : "destructive"}
                      className="capitalize"
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRoleDialog
                      userId={user.id}
                      currentRole={user.role}
                      userEmail={user.email}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
