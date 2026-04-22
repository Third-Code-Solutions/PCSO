"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustLeaveCredits } from "@/app/(dashboard)/leave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, SearchIcon } from "lucide-react";

interface EmployeeOption {
  id: string;
  employeeNo: string;
  fullName: string;
  vlBalance: number;
  slBalance: number;
}

interface AdjustLeaveCreditsFormProps {
  employees: EmployeeOption[];
  currentYear: number;
}

export function AdjustLeaveCreditsForm({
  employees,
  currentYear,
}: AdjustLeaveCreditsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [leaveTypeCode, setLeaveTypeCode] = useState<"VL" | "SL" | "">("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeNo.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const currentBalance =
    selectedEmployee && leaveTypeCode
      ? leaveTypeCode === "VL"
        ? selectedEmployee.vlBalance
        : selectedEmployee.slBalance
      : null;

  const deltaNum = parseFloat(delta);
  const projected =
    currentBalance !== null && Number.isFinite(deltaNum)
      ? currentBalance + deltaNum
      : null;

  const canSubmit =
    selectedEmployeeId &&
    leaveTypeCode &&
    Number.isFinite(deltaNum) &&
    deltaNum !== 0 &&
    Math.abs(deltaNum) <= 200 &&
    projected !== null &&
    projected >= 0 &&
    reason.trim().length >= 5 &&
    !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedEmployeeId || !leaveTypeCode || !Number.isFinite(deltaNum)) {
      setError("Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await adjustLeaveCredits({
          employeeId: selectedEmployeeId,
          year: currentYear,
          leaveTypeCode: leaveTypeCode as "VL" | "SL",
          delta: deltaNum,
          reason: reason.trim(),
        });

        const empName = selectedEmployee?.fullName ?? "Employee";
        setSuccess(
          `${empName} — ${leaveTypeCode} adjusted: ${result.previousBalance.toFixed(3)} → ${result.newBalance.toFixed(3)} days`,
        );

        // Reset form
        setSelectedEmployeeId("");
        setLeaveTypeCode("");
        setDelta("");
        setReason("");
        setSearch("");

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Adjustment failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Employee search + picker */}
      <div className="space-y-2">
        <Label htmlFor="search">Search Employee</Label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Name or employee number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee">Employee</Label>
        <Select
          value={selectedEmployeeId}
          onValueChange={setSelectedEmployeeId}
        >
          <SelectTrigger id="employee">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No employees found
              </div>
            ) : (
              filtered.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.fullName}{" "}
                  <span className="text-muted-foreground">
                    ({emp.employeeNo})
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Leave type */}
      <div className="space-y-2">
        <Label htmlFor="leaveType">Leave Type</Label>
        <Select
          value={leaveTypeCode}
          onValueChange={(v) => setLeaveTypeCode(v as "VL" | "SL")}
        >
          <SelectTrigger id="leaveType">
            <SelectValue placeholder="Select leave type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VL">Vacation Leave (VL)</SelectItem>
            <SelectItem value="SL">Sick Leave (SL)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current / projected balance */}
      {currentBalance !== null && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Current {leaveTypeCode} balance ({currentYear}):
            </span>
            <span className="font-semibold tabular-nums">
              {currentBalance.toFixed(3)} days
            </span>
          </div>
          {projected !== null &&
            Number.isFinite(deltaNum) &&
            deltaNum !== 0 && (
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">After adjustment:</span>
                <span
                  className={`font-bold tabular-nums ${projected < 0 ? "text-red-600" : "text-pcso-navy"}`}
                >
                  {projected.toFixed(3)} days
                </span>
              </div>
            )}
        </div>
      )}

      {/* Delta */}
      <div className="space-y-2">
        <Label htmlFor="delta">Adjustment (days)</Label>
        <Input
          id="delta"
          type="number"
          step="0.001"
          placeholder="e.g., 5.000 or -2.500"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Positive to add credits, negative to deduct. Maximum ±200 days.
        </p>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason (audit trail)</Label>
        <Textarea
          id="reason"
          placeholder="Explain why this adjustment is needed (min 5 characters)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? "Adjusting…" : "Adjust Credits"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/leave/credits/admin")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
