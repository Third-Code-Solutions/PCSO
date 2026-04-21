"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { createPerformancePeriod } from "../../actions";

interface Props {
  defaultYear: number;
  defaultSemester: "1" | "2";
}

/**
 * Returns sensible default date-from / date-to for a semester in ISO format.
 */
function defaultWindow(
  year: number,
  semester: "1" | "2",
): { from: string; to: string } {
  if (semester === "1") {
    return { from: `${year}-01-01`, to: `${year}-06-30` };
  }
  return { from: `${year}-07-01`, to: `${year}-12-31` };
}

export function NewCycleForm({ defaultYear, defaultSemester }: Props) {
  const router = useRouter();
  const [year, setYear] = React.useState<string>(String(defaultYear));
  const [semester, setSemester] = React.useState<"1" | "2">(defaultSemester);
  const initialWindow = defaultWindow(defaultYear, defaultSemester);
  const [dateFrom, setDateFrom] = React.useState(initialWindow.from);
  const [dateTo, setDateTo] = React.useState(initialWindow.to);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function handleSemesterChange(value: "1" | "2"): void {
    setSemester(value);
    const win = defaultWindow(Number(year || defaultYear), value);
    setDateFrom(win.from);
    setDateTo(win.to);
  }

  function handleYearChange(value: string): void {
    setYear(value);
    const n = Number(value);
    if (!Number.isNaN(n) && n > 2020) {
      const win = defaultWindow(n, semester);
      setDateFrom(win.from);
      setDateTo(win.to);
    }
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { periodId } = await createPerformancePeriod({
        year: Number(year),
        semester,
        dateFrom,
        dateTo,
      });
      router.push(`/performance/cycles/${periodId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create cycle.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            type="number"
            min={2020}
            max={2050}
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="semester">Semester</Label>
          <Select
            value={semester}
            onValueChange={(v) => handleSemesterChange(v as "1" | "2")}
          >
            <SelectTrigger id="semester">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Semester 1 (Jan–Jun)</SelectItem>
              <SelectItem value="2">Semester 2 (Jul–Dec)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="date-from">Rating window starts</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="date-to">Rating window ends</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
        >
          {submitting ? "Creating…" : "Create Cycle"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
