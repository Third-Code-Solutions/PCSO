"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createPagibigRate } from "../actions";

export function PagibigRateForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const effectiveDate = fd.get("effectiveDate") as string;

    if (
      !window.confirm(
        `Insert a new Pag-IBIG rate effective ${effectiveDate}?\n\n` +
          "This row is permanent and affects all payroll periods on or after this date.",
      )
    ) {
      return;
    }

    setPending(true);
    try {
      await createPagibigRate({
        effectiveDate,
        employeeRateLow: fd.get("employeeRateLow") as string,
        employeeRateHigh: fd.get("employeeRateHigh") as string,
        employerRate: fd.get("employerRate") as string,
        salaryThreshold: fd.get("salaryThreshold") as string,
        maxContribution: fd.get("maxContribution") as string,
      });
      toast.success("Pag-IBIG rate saved");
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to save Pag-IBIG rate.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Pag-IBIG Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="col-span-2 max-w-xs space-y-2">
            <Label htmlFor="pib-date">Effective Date</Label>
            <Input id="pib-date" name="effectiveDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pib-empLow">
              Employee Rate — Low bracket (e.g. 0.01)
            </Label>
            <Input
              id="pib-empLow"
              name="employeeRateLow"
              placeholder="0.01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pib-empHigh">
              Employee Rate — High bracket (e.g. 0.02)
            </Label>
            <Input
              id="pib-empHigh"
              name="employeeRateHigh"
              placeholder="0.02"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pib-erRate">Employer Rate (e.g. 0.02)</Label>
            <Input
              id="pib-erRate"
              name="employerRate"
              placeholder="0.02"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pib-threshold">Salary Threshold (₱)</Label>
            <Input
              id="pib-threshold"
              name="salaryThreshold"
              placeholder="1500.00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pib-maxContrib">Max Contribution (₱)</Label>
            <Input
              id="pib-maxContrib"
              name="maxContribution"
              placeholder="200.00"
              required
            />
          </div>
          <div className="col-span-2">
            <Button
              type="submit"
              disabled={pending}
              className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {pending ? "Saving…" : "Save rate"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
