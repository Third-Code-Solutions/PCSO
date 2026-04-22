"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  updateUser,
  getUserForEdit,
  searchEmployeesForPicker,
} from "../../actions";
import { SYSTEM_ROLE_VALUES } from "@/lib/validations/admin";
import { Search, X } from "lucide-react";

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

interface EmployeeOption {
  id: string;
  name: string;
  employeeNo: string;
}

export default function EditUserPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [pending, setPending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [role, setRole] = React.useState<(typeof SYSTEM_ROLE_VALUES)[number]>(
    "employee_self_service",
  );
  const [officeId, setOfficeId] = React.useState("");

  // Employee picker state
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [employeeDisplay, setEmployeeDisplay] = React.useState(""); // "Name — EmpNo"
  const [empSearch, setEmpSearch] = React.useState("");
  const [empResults, setEmpResults] = React.useState<EmployeeOption[]>([]);
  const [empSearching, setEmpSearching] = React.useState(false);
  const [empDropdownOpen, setEmpDropdownOpen] = React.useState(false);
  const empRef = React.useRef<HTMLDivElement>(null);

  // Load current user values via server action (bypasses RLS)
  React.useEffect(() => {
    void (async () => {
      try {
        const data = await getUserForEdit(id);
        setRole(
          (data.role as (typeof SYSTEM_ROLE_VALUES)[number]) ??
            "employee_self_service",
        );
        setOfficeId(data.officeId ?? "");
        setEmployeeId(data.employeeId);
        if (data.employeeName) {
          setEmployeeDisplay(
            data.employeeNo
              ? `${data.employeeName} — ${data.employeeNo}`
              : data.employeeName,
          );
        }
      } catch {
        toast.error("Could not load user details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Employee live search with debounce
  React.useEffect(() => {
    if (empSearch.trim().length < 2) {
      setEmpResults([]);
      return;
    }
    setEmpSearching(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchEmployeesForPicker(empSearch);
        setEmpResults(results);
        setEmpDropdownOpen(results.length > 0);
      } finally {
        setEmpSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (empRef.current && !empRef.current.contains(e.target as Node)) {
        setEmpDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectEmployee(emp: EmployeeOption) {
    setEmployeeId(emp.id);
    setEmployeeDisplay(`${emp.name} — ${emp.employeeNo}`);
    setEmpSearch("");
    setEmpResults([]);
    setEmpDropdownOpen(false);
  }

  function clearEmployee() {
    setEmployeeId(null);
    setEmployeeDisplay("");
    setEmpSearch("");
    setEmpResults([]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      await updateUser({
        id,
        role,
        officeId: officeId.trim() !== "" ? officeId.trim() : null,
        employeeId: employeeId ?? null,
      });
      toast.success("User updated successfully");
      router.push(`/admin/users/${id}`);
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to update user.",
      });
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading user…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Edit User"
        description="Update role, office scope, and linked employee."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "Edit" },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select
            value={role}
            onValueChange={(v) =>
              setRole(v as (typeof SYSTEM_ROLE_VALUES)[number])
            }
            name="role"
          >
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
        </div>

        {/* Office scope */}
        <div className="space-y-2">
          <Label htmlFor="officeId">Office scope (optional)</Label>
          <Input
            id="officeId"
            name="officeId"
            placeholder="Office UUID — leave blank for org-wide access"
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to grant org-wide access (subject to role permissions).
          </p>
        </div>

        {/* Employee link */}
        <div className="space-y-2">
          <Label>Linked employee (optional)</Label>

          {employeeId && employeeDisplay ? (
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2 text-sm">
              <span className="flex-1">{employeeDisplay}</span>
              <button
                type="button"
                onClick={clearEmployee}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove employee link"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={empRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or employee number…"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  onFocus={() =>
                    empResults.length > 0 && setEmpDropdownOpen(true)
                  }
                  className="pl-9"
                />
                {empSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Searching…
                  </span>
                )}
              </div>

              {empDropdownOpen && empResults.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                  {empResults.map((emp) => (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => selectEmployee(emp)}
                      >
                        <span className="font-medium">{emp.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {emp.employeeNo}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Links this system account to an employee record for profile,
            payslip, and self-service access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={pending}
            className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/admin/users/${id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
