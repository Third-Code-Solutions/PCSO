"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { createHoliday } from "../actions";
import {
  HOLIDAY_TYPE_VALUES,
  HolidayTypeLabels,
} from "@/lib/validations/holidays";

export default function NewHolidayPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [type, setType] =
    React.useState<(typeof HOLIDAY_TYPE_VALUES)[number]>("regular");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);

    try {
      const result = await createHoliday({
        name: fd.get("name") as string,
        holidayDate: fd.get("holidayDate") as string,
        type,
        proclamationRef: (fd.get("proclamationRef") as string) || null,
        remarks: (fd.get("remarks") as string) || null,
      });
      toast.success("Holiday added", { description: `ID: ${result.id}` });
      const year = (fd.get("holidayDate") as string).slice(0, 4);
      router.push(`/admin/holidays?year=${year}`);
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to add holiday.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Add Holiday"
        description="Add a declared Philippine public holiday with its proclamation reference."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Holidays", href: "/admin/holidays" },
          { label: "New" },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Holiday Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g. National Heroes Day"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="holidayDate">Date</Label>
          <Input id="holidayDate" name="holidayDate" type="date" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={type}
            onValueChange={(v) =>
              setType(v as (typeof HOLIDAY_TYPE_VALUES)[number])
            }
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOLIDAY_TYPE_VALUES.map((t) => (
                <SelectItem key={t} value={t}>
                  {HolidayTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proclamationRef">
            Proclamation Reference (optional)
          </Label>
          <Input
            id="proclamationRef"
            name="proclamationRef"
            placeholder="e.g. Proclamation No. 123 s. 2024"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="remarks">Remarks (optional)</Label>
          <Input
            id="remarks"
            name="remarks"
            placeholder="Additional notes or legal text excerpt"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={pending}
            className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            {pending ? "Saving…" : "Add holiday"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/holidays")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
