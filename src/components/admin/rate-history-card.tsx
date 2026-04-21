"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateField {
  label: string;
  key: string;
  format?: "percent" | "money";
}

export interface RateHistoryEntry {
  id: string;
  effectiveDate: string;
  isCurrent: boolean;
  values: Record<string, string>;
}

interface RateHistoryCardProps {
  title: string;
  description?: string;
  fields: RateField[];
  history: RateHistoryEntry[];
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatValue(value: string, format: RateField["format"]): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  if (format === "percent") {
    return `${(num * 100).toFixed(2)}%`;
  }
  if (format === "money") {
    return `₱${num.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return value;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RateHistoryCard({
  title,
  description,
  fields,
  history,
}: RateHistoryCardProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No rate history found.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                {fields.map((f) => (
                  <TableHead key={f.key} className="text-right">
                    {f.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={entry.isCurrent ? "bg-pcso-cream/40" : undefined}
                >
                  <TableCell className="font-medium">
                    {new Date(
                      entry.effectiveDate + "T00:00:00",
                    ).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {entry.isCurrent ? (
                      <Badge className="bg-pcso-gold text-pcso-navy text-xs hover:bg-pcso-gold">
                        Current
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Superseded
                      </Badge>
                    )}
                  </TableCell>
                  {fields.map((f) => (
                    <TableCell
                      key={f.key}
                      className="text-right font-mono text-sm"
                    >
                      {formatValue(entry.values[f.key] ?? "", f.format)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
