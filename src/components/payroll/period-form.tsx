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
  FormDescription,
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
  CreatePeriodSchema,
  type CreatePeriodInput,
} from "@/lib/validations/payroll";
import { createPeriod } from "@/app/(dashboard)/payroll/actions";

interface PeriodFormProps {
  defaultScope?: CreatePeriodInput["scope"];
}

export function PeriodForm({ defaultScope = "regular" }: PeriodFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<CreatePeriodInput>({
    resolver: zodResolver(CreatePeriodSchema),
    defaultValues: {
      name: "",
      periodStart: "",
      periodEnd: "",
      payDate: "",
      scope: defaultScope,
      notes: "",
    },
  });

  function onSubmit(values: CreatePeriodInput) {
    startTransition(async () => {
      try {
        const period = await createPeriod(values);
        toast.success(`Payroll period "${period.name}" created.`);
        router.push(`/payroll/${period.id}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create period.";
        toast.error(message);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Period Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., July 1-15, 2025 (1st Half)"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A descriptive name for this payroll period.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="periodStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period Start</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="periodEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period End</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="payDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormDescription>
                The date funds will be disbursed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payroll Scope</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="regular">
                    Regular Employees (Permanent / Temporary / Casual /
                    Coterminous)
                  </SelectItem>
                  <SelectItem value="jo_cos">
                    JO / COS (Job Order / Contract of Service)
                  </SelectItem>
                  <SelectItem value="rata">
                    RATA (Representation and Transportation Allowance)
                  </SelectItem>
                  <SelectItem value="cash_advance">Cash Advance</SelectItem>
                  <SelectItem value="benefits_bonuses">
                    Benefits and Bonuses (Mid-Year, Year-End, Cash Gift, PBB)
                  </SelectItem>
                  <SelectItem value="salary_differential">
                    Salary Differential (Retroactive Pay)
                  </SelectItem>
                  <SelectItem value="special">
                    Special Payroll (Custom Title)
                  </SelectItem>
                  <SelectItem value="magna_carta">
                    Magna Carta Benefits (RA 9710 Women / RA 7277 PWD)
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Select the payroll type for this period.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any remarks or special instructions for this period..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            {isPending ? "Creating..." : "Create Period"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
