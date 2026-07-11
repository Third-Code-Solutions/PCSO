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
import { Switch } from "@/components/ui/switch";
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
      customTitle: "",
      benefitType: undefined,
      skipMandatoryDeductions: false,
      notes: "",
    },
  });

  const scope = form.watch("scope");
  const isSpecial = scope === "special";
  const isBenefits = scope === "benefits_bonuses";

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
                  <SelectItem value="confidential_agents">
                    Confidential Agents (TOR 1.8.2)
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

        {/* Special payroll fields — only shown when scope === "special" */}
        {isSpecial && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Special Payroll Options
            </p>

            <FormField
              control={form.control}
              name="customTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Custom Title <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Mid-Year Supplemental Pay — June 2025"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Required for special payroll runs. This title appears on
                    payslips and the payroll register (PAY-007).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="skipMandatoryDeductions"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border border-amber-200 bg-white p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Skip Mandatory Deductions</FormLabel>
                    <FormDescription>
                      When enabled, GSIS, PhilHealth, Pag-IBIG, and withholding
                      tax are not deducted from this special payroll run. Ensure
                      this is authorized before proceeding.
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
        )}

        {/* Benefits & bonuses — only shown when scope === "benefits_bonuses" */}
        {isBenefits && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-800">
              Benefits & Bonuses Options
            </p>

            <FormField
              control={form.control}
              name="benefitType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Benefit Component{" "}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select benefit component" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mid_year">
                        Mid-Year Bonus (1 month basic)
                      </SelectItem>
                      <SelectItem value="year_end_cash_gift">
                        Year-End Bonus + Cash Gift (₱5,000)
                      </SelectItem>
                      <SelectItem value="pbb">
                        Performance-Based Bonus (PBB)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Required for benefits and bonuses runs. Only the selected
                    component is paid — this prevents paying every bonus every
                    run (PAY-005).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

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
