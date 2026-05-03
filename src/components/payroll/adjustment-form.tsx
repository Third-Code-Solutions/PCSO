"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  OverrideRecordSchema,
  type OverrideRecordInput,
} from "@/lib/validations/payroll";
import { overrideRecord } from "@/app/(dashboard)/payroll/actions";

interface AdjustmentFormProps {
  recordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** Fields that can be overridden, with labels */
const OVERRIDEABLE_FIELDS: Array<{
  value: string;
  label: string;
  type: "earning" | "deduction";
}> = [
  { value: "basicPay", label: "Basic Pay", type: "earning" },
  { value: "rata", label: "RATA", type: "earning" },
  { value: "longevityPay", label: "Longevity Pay", type: "earning" },
  { value: "overtimePay", label: "Overtime Pay", type: "earning" },
  { value: "pera", label: "PERA", type: "earning" },
  { value: "otherEarnings", label: "Other Earnings", type: "earning" },
  { value: "gsisPersonal", label: "GSIS Personal", type: "deduction" },
  {
    value: "philhealthPersonal",
    label: "PhilHealth Personal",
    type: "deduction",
  },
  { value: "pagibigPersonal", label: "Pag-IBIG Personal", type: "deduction" },
  { value: "withholdingTax", label: "Withholding Tax", type: "deduction" },
  { value: "lateDeduction", label: "Late Deduction", type: "deduction" },
  {
    value: "undertimeDeduction",
    label: "Undertime Deduction",
    type: "deduction",
  },
  { value: "absenceDeduction", label: "Absence Deduction", type: "deduction" },
  { value: "otherDeductions", label: "Other Deductions", type: "deduction" },
];

export function AdjustmentForm({
  recordId,
  open,
  onOpenChange,
  onSuccess,
}: AdjustmentFormProps) {
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<OverrideRecordInput>({
    resolver: zodResolver(OverrideRecordSchema),
    defaultValues: {
      recordId,
      fieldName: "",
      adjustedValue: "",
      adjustmentType: "earning",
      description: "",
      justification: "",
    },
  });

  // Auto-fill adjustmentType when field is selected
  const watchedField = form.watch("fieldName");
  React.useEffect(() => {
    const found = OVERRIDEABLE_FIELDS.find((f) => f.value === watchedField);
    if (found) {
      form.setValue("adjustmentType", found.type);
    }
  }, [watchedField, form]);

  function onSubmit(values: OverrideRecordInput) {
    startTransition(async () => {
      try {
        await overrideRecord(values);
        toast.success("Override applied. Record marked for review.");
        form.reset();
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to apply override.";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Override Payroll Record</DialogTitle>
          <DialogDescription>
            All overrides are logged with justification for audit purposes.
            Original computed values are preserved.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fieldName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field to Override</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OVERRIDEABLE_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
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
              name="adjustedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Value (₱)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the corrected amount in pesos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Corrected overtime hours"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justification</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why this override is necessary, citing supporting documentation or authorization..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum 10 characters. This will appear in the audit log.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-[#0B2545] text-white hover:bg-[#13315C]"
              >
                {isPending ? "Applying..." : "Apply Override"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
