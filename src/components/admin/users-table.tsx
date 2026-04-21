"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/tables/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  activateUser,
  deactivateUser,
  sendPasswordReset,
} from "@/app/(dashboard)/admin/users/actions";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  role: string;
  officeName: string | null;
  employeeName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  payroll_admin: "Payroll Admin",
  leave_approver: "Leave Approver",
  viewer: "Viewer",
  employee_self_service: "Employee",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-pcso-navy text-white",
  hr_admin: "bg-pcso-gold text-pcso-navy",
  payroll_admin: "bg-blue-100 text-blue-800",
  leave_approver: "bg-purple-100 text-purple-800",
  viewer: "bg-gray-100 text-gray-700",
  employee_self_service: "bg-green-100 text-green-800",
};

// ─── Row Actions ─────────────────────────────────────────────────────────────

function RowActions({ row }: { row: UserRow }) {
  const [pending, setPending] = React.useState(false);

  async function handleToggleActive() {
    setPending(true);
    try {
      if (row.isActive) {
        await deactivateUser(row.id);
        toast.success("User deactivated", { description: row.email });
      } else {
        await activateUser(row.id);
        toast.success("User activated", { description: row.email });
      }
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to update user.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handlePasswordReset() {
    setPending(true);
    try {
      await sendPasswordReset(row.id);
      toast.success("Password reset email sent", { description: row.email });
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to send reset email.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label="Open user actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${row.id}`}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${row.id}/edit`}>Edit role / office</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePasswordReset}>
          <KeyRound className="mr-2 h-4 w-4" />
          Send password reset
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleToggleActive}
          className={row.isActive ? "text-destructive" : "text-green-600"}
        >
          {row.isActive ? (
            <>
              <ShieldOff className="mr-2 h-4 w-4" />
              Deactivate
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Activate
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <Link
        href={`/admin/users/${row.original.id}`}
        className="font-medium text-pcso-navy hover:underline"
      >
        {row.original.email}
      </Link>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
          ROLE_COLORS[row.original.role] ?? "bg-gray-100 text-gray-700"
        }`}
      >
        {ROLE_LABELS[row.original.role] ?? row.original.role}
      </span>
    ),
  },
  {
    accessorKey: "employeeName",
    header: "Linked Employee",
    cell: ({ row }) =>
      row.original.employeeName ?? (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "officeName",
    header: "Office Scope",
    cell: ({ row }) =>
      row.original.officeName ?? (
        <span className="text-muted-foreground">Org-wide</span>
      ),
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Active
        </Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      ),
  },
  {
    accessorKey: "lastLogin",
    header: "Last Login",
    cell: ({ row }) =>
      row.original.lastLogin ? (
        new Date(row.original.lastLogin).toLocaleDateString("en-PH")
      ) : (
        <span className="text-muted-foreground">Never</span>
      ),
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActions row={row.original} />,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface UsersTableProps {
  users: UserRow[];
}

export function UsersTable({ users }: UsersTableProps) {
  return (
    <DataTable
      columns={columns}
      data={users}
      searchPlaceholder="Search by email, role, or office…"
    />
  );
}
