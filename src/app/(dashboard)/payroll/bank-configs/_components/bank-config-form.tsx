"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  CreateBankConfigSchema,
  UpdateBankConfigSchema,
  type CreateBankConfigInput,
} from "@/lib/validations/payroll";
import { createBankConfig, updateBankConfig } from "../actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankConfigFormProps {
  defaultValues?: Partial<CreateBankConfigInput>;
  configId?: string;
}

// ─── Column Mapping Config ────────────────────────────────────────────────────

const MAPPING_FIELDS: { key: keyof typeof DEFAULT_MAPPING; label: string }[] = [
  { key: "bank_account_no", label: "Bank Account No." },
  { key: "employee_name", label: "Employee Name" },
  { key: "net_pay_amount", label: "Net Pay Amount" },
  { key: "payroll_period", label: "Payroll Period" },
  { key: "employee_no", label: "Employee No." },
];

const DEFAULT_MAPPING = {
  bank_account_no: 0,
  employee_name: 1,
  net_pay_amount: 2,
  payroll_period: 3,
  employee_no: 4,
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function BankConfigForm({
  defaultValues,
  configId,
}: BankConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const isEditing = Boolean(configId);

  const form = useForm<CreateBankConfigInput>({
    resolver: zodResolver(
      isEditing ? UpdateBankConfigSchema : CreateBankConfigSchema,
    ),
    defaultValues: {
      bankName: defaultValues?.bankName ?? "",
      columnMapping: defaultValues?.columnMapping ?? { ...DEFAULT_MAPPING },
      delimiter: defaultValues?.delimiter ?? ",",
      hasHeader: defaultValues?.hasHeader ?? true,
      dateFormat: defaultValues?.dateFormat ?? "YYYY-MM-DD",
      notes: defaultValues?.notes ?? "",
    },
  });

  function onSubmit(values: CreateBankConfigInput) {
    startTransition(async () => {
      try {
        if (isEditing && configId) {
          await updateBankConfig({ ...values, id: configId });
          toast.success("Bank configuration updated successfully.");
        } else {
          await createBankConfig(values);
          toast.success("Bank configuration created successfully.");
        }
        router.push("/payroll/bank-configs");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save configuration.",
        );
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Bank Name */}
        <FormField
          control={form.control}
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Bank Name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g., BDO, Metrobank, LBP" {...field} />
              </FormControl>
              <FormDescription>
                The name of the bank this configuration applies to.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Column Mapping */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium leading-none">
              Column Mapping <span className="text-destructive">*</span>
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Set the column position (0-indexed) for each field in the CSV
              output. Positions are 0-indexed — the first column is 0.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Field
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Column Position (0-indexed)
                  </th>
                </tr>
              </thead>
              <tbody>
                {MAPPING_FIELDS.map(({ key, label }, idx) => (
                  <tr
                    key={key}
                    className={
                      idx < MAPPING_FIELDS.length - 1
                        ? "border-b border-border"
                        : ""
                    }
                  >
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {key}
                      </code>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min={0}
                        className="w-24"
                        {...form.register(`columnMapping.${key}`, {
                          valueAsNumber: true,
                        })}
                      />
                      {form.formState.errors.columnMapping?.[key] && (
                        <p className="mt-1 text-xs text-destructive">
                          {form.formState.errors.columnMapping[key]?.message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delimiter & Has Header — side by side */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="delimiter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delimiter</FormLabel>
                <FormControl>
                  <Input placeholder="," maxLength={5} {...field} />
                </FormControl>
                <FormDescription>
                  Character separating columns. Use comma (,) for standard CSV.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hasHeader"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Include Header Row</FormLabel>
                  <FormDescription>
                    When enabled, the first row of the CSV will contain field
                    names.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Date Format */}
        <FormField
          control={form.control}
          name="dateFormat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date Format</FormLabel>
              <FormControl>
                <Input placeholder="YYYY-MM-DD" {...field} />
              </FormControl>
              <FormDescription>
                Date format pattern for the payroll period column (e.g.,
                YYYY-MM-DD, MM/DD/YYYY).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any remarks about this bank configuration..."
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/payroll/bank-configs")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            {isPending
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Configuration"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
