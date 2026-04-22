"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createUser } from "../actions";
import { SYSTEM_ROLE_VALUES } from "@/lib/validations/admin";

const ROLE_LABELS: Record<(typeof SYSTEM_ROLE_VALUES)[number], string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  payroll_admin: "Payroll Admin",
  leave_approver: "Leave Approver",
  viewer: "Viewer",
  employee_self_service: "Employee (Self-Service)",
  supervisor: "Supervisor / Manager",
  executive: "Executive / Leadership",
  auditor: "Compliance & Audit",
};

export default function NewUserPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const officeIdRaw = formData.get("officeId");

    try {
      await createUser({
        email: formData.get("email") as string,
        role: formData.get("role") as string,
        officeId:
          officeIdRaw && officeIdRaw !== "" ? (officeIdRaw as string) : null,
        employeeId: null,
      });
      toast.success("Invite sent", {
        description:
          "The user will receive a setup email to complete their account.",
      });
      router.push("/admin/users");
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to create user.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Add System User"
        description="Invite a new user by email. They will receive a link to set their password."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "New" },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="user@pcso.gov.ph"
            required
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            An invitation email will be sent to this address.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select name="role" required defaultValue="employee_self_service">
            <SelectTrigger id="role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLE_VALUES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            <strong>Super Admin</strong> has unrestricted access to all modules.
            Assign with care.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="officeId">Office scope (optional)</Label>
          <Input
            id="officeId"
            name="officeId"
            placeholder="Office UUID — leave blank for org-wide access"
          />
          <p className="text-xs text-muted-foreground">
            When set, this user can only view records belonging to the specified
            office. Leave blank for organization-wide access (based on role).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={pending}
            className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            {pending ? "Sending invite…" : "Send invite"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/users")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
