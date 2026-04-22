"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustLeaveCredits } from "@/lib/actions/leave-gaps";
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
import { AlertCircle, CheckCircle } from "lucide-react";

export function AdjustLeaveCreditsForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const result = await adjustLeaveCredits({
          employeeId,
          leaveTypeId,
          adjustment: parseFloat(adjustment),
          reason,
        });

        setSuccess(
          `Successfully adjusted credits from ${result.previousBalance.toFixed(3)} to ${result.newBalance.toFixed(3)}`,
        );

        // Reset form
        setEmployeeId("");
        setLeaveTypeId("");
        setAdjustment("");
        setReason("");

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Adjustment failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="employeeId">Employee ID</Label>
        <Input
          id="employeeId"
          placeholder="UUID of employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="leaveTypeId">Leave Type ID</Label>
        <Input
          id="leaveTypeId"
          placeholder="UUID of leave type (VL or SL)"
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adjustment">Adjustment (days)</Label>
        <Input
          id="adjustment"
          type="number"
          step="0.001"
          placeholder="e.g., 5.000 or -2.500"
          value={adjustment}
          onChange={(e) => setAdjustment(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Positive for credit, negative for deduction
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason (for audit trail)</Label>
        <Textarea
          id="reason"
          placeholder="Explain why this adjustment is needed..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adjusting..." : "Adjust Credits"}
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
