"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { updateUserRole } from "@/lib/actions/settings";
import type { SystemRole } from "@/lib/db/schema";

interface UserRoleDialogProps {
  userId: string;
  currentRole: string;
  userEmail: string;
}

const SYSTEM_ROLES: { value: SystemRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "payroll_admin", label: "Payroll Admin" },
  { value: "leave_approver", label: "Leave Approver" },
  { value: "supervisor", label: "Supervisor / Manager" },
  { value: "executive", label: "Executive / Leadership" },
  { value: "auditor", label: "Compliance & Audit" },
  { value: "employee_self_service", label: "Employee Self-Service" },
  { value: "viewer", label: "Viewer (Read-Only)" },
];

export function UserRoleDialog({
  userId,
  currentRole,
  userEmail,
}: UserRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SystemRole>(
    currentRole as SystemRole,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await updateUserRole(userId, selectedRole);
      toast.success(`Role updated to ${selectedRole.replace(/_/g, " ")}`);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit Role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update User Role</DialogTitle>
          <DialogDescription>
            Change the system role and dashboard profile for {userEmail}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">System Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as SystemRole)}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Roles determine dashboard type and data access per PRD Section 3.4
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
