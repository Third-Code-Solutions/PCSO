"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SalaryGradeRow {
  id: string;
  grade: number;
  step: number;
  monthlySalary: string;
  effectiveDate: string;
}

export interface SalaryGradesByDate {
  effectiveDate: string;
  isCurrent: boolean;
  rows: SalaryGradeRow[];
}

interface SalaryGradesTableProps {
  dataSets: SalaryGradesByDate[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SalaryGradesTable({ dataSets }: SalaryGradesTableProps) {
  const [activeDate, setActiveDate] = React.useState<string>(
    dataSets[0]?.effectiveDate ?? "",
  );

  const activeSet = dataSets.find((d) => d.effectiveDate === activeDate);

  // Group rows by grade for nested display
  const byGrade = React.useMemo(() => {
    if (!activeSet) return new Map<number, SalaryGradeRow[]>();
    const map = new Map<number, SalaryGradeRow[]>();
    for (const row of activeSet.rows) {
      const existing = map.get(row.grade) ?? [];
      map.set(row.grade, [...existing, row]);
    }
    return map;
  }, [activeSet]);

  if (dataSets.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No salary grade data found. Add the first effective date set to begin.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Effective date selector */}
      <div className="flex flex-wrap gap-2">
        {dataSets.map((ds) => (
          <button
            key={ds.effectiveDate}
            type="button"
            onClick={() => setActiveDate(ds.effectiveDate)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              activeDate === ds.effectiveDate
                ? "border-pcso-navy bg-pcso-navy text-white"
                : "border-border bg-background text-foreground hover:border-pcso-navy"
            }`}
          >
            {new Date(ds.effectiveDate + "T00:00:00").toLocaleDateString(
              "en-PH",
              {
                year: "numeric",
                month: "short",
                day: "numeric",
              },
            )}
            {ds.isCurrent && (
              <Badge className="ml-1 bg-pcso-gold text-pcso-navy text-[10px] px-1.5 py-0 hover:bg-pcso-gold">
                Current
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Grade-step matrix */}
      {activeSet && (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-center font-semibold">
                  Grade
                </TableHead>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((step) => (
                  <TableHead key={step} className="text-center">
                    Step {step}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 33 }, (_, i) => i + 1).map((grade) => {
                const steps = byGrade.get(grade) ?? [];
                const byStep = new Map(
                  steps.map((r) => [r.step, r.monthlySalary]),
                );
                return (
                  <TableRow key={grade}>
                    <TableCell className="text-center font-semibold text-pcso-navy">
                      SG {grade}
                    </TableCell>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((step) => {
                      const salary = byStep.get(step);
                      return (
                        <TableCell
                          key={step}
                          className="text-right font-mono text-sm"
                        >
                          {salary ? (
                            `₱${parseFloat(salary).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
