"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CreateLoanSchema,
  type CreateLoanInput,
} from "@/lib/validations/payroll";
import { createLoan, updateLoan } from "../actions";

const LOAN_TYPE_OPTIONS = [
  { value: "gsis_personal", label: "GSIS Personal" },
  { value: "gsis_policy", label: "GSIS Policy" },
  { value: "gsis_emergency", label: "GSIS Emergency" },
  { value: "gsis_multi_purpose", label: "GSIS Multi-Purpose" },
  { value: "pagibig_multi_purpose", label: "Pag-IBIG Multi-Purpose" },
  { value: "pcso_in_house", label: "PCSO In-House" },
] as const;

const DEDUCTION_SCHEDULE_OPTIONS = [
  { value: "semi_monthly", label: "Semi-Monthly" },
  { value: "monthly", label: "Monthly" },
] as const;

interface Employee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
}

interface LoanFormProps {
  employees: Employee[];
  defaultValues?: Partial<CreateLoanInput>;
  loanId?: string;
}

export function LoanForm({ employees, defaultValues, loanId }: LoanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const isEditing = loanId !== undefined;

  const form = useForm<CreateLoanInput>({
    resolver: zodResolver(CreateLoanSchema),
    defaultValues: {
      employeeId: "",
      loanType: "gsis_personal",
      principal: "",
      startDate: "",
      endDate: "",
      deductionSchedule: "semi_monthly",
      deductionAmount: "",
      remarks: "",
      ...defaultValues,
    },
  });

  function onSubmit(values: CreateLoanInput) {
    startTransition(async () => {
      try {
        if (isEditing && loanId) {
          await updateLoan({ ...values, id: loanId });
          toast.success("Loan record updated");
        } else {
          await createLoan(values);
          toast.success("Loan record created");
        }
        router.push("/payroll/loans");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save loan");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Employee */}
        <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employee</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName} ({emp.employeeNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Loan Type */}
        <FormField
          control={form.control}
          name="loanType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Loan Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LOAN_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Principal */}
        <FormField
          control={form.control}
          name="principal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Principal Amount (₱)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Deduction Schedule & Amount */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="deductionSchedule"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deduction Schedule</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEDUCTION_SCHEDULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deductionAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deduction Amount (₱)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Remarks */}
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this loan..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/payroll/loans")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Loan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
