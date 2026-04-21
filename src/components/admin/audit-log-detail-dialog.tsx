"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { diffValues } from "@/lib/audit/diff";
import type { AuditLogRow } from "./audit-log-table";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLogDetailDialogProps {
  row: AuditLogRow | null;
  open: boolean;
  onClose: () => void;
}

// ─── Diff Row ─────────────────────────────────────────────────────────────────

function DiffRow({
  field,
  old: oldVal,
  new: newVal,
}: {
  field: string;
  old: unknown;
  new: unknown;
}) {
  const formatVal = (v: unknown): string => {
    if (v === undefined) return "(not set)";
    if (v === null) return "null";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  };

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 align-top">
        <code className="text-xs font-semibold text-pcso-navy">{field}</code>
      </td>
      <td className="py-2 pr-4 align-top max-w-xs">
        <pre className="whitespace-pre-wrap break-words rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          {formatVal(oldVal)}
        </pre>
      </td>
      <td className="py-2 align-top max-w-xs">
        <pre className="whitespace-pre-wrap break-words rounded bg-green-50 px-2 py-1 text-xs text-green-700">
          {formatVal(newVal)}
        </pre>
      </td>
    </tr>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AuditLogDetailDialog({
  row,
  open,
  onClose,
}: AuditLogDetailDialogProps) {
  const diffs = React.useMemo(() => {
    if (!row) return [];
    const old = row.oldValues ?? {};
    const next = row.newValues ?? {};
    return diffValues(old, next);
  }, [row]);

  if (!row) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Audit Log — Change Details</DialogTitle>
        </DialogHeader>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Timestamp</span>
            <p className="font-mono text-xs">
              {new Date(row.timestamp).toLocaleString("en-PH")}
            </p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">User</span>
            <p>{row.userName ?? "System"}</p>
            {row.userEmail && (
              <p className="text-xs text-muted-foreground">{row.userEmail}</p>
            )}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Action</span>
            <p className="capitalize">{row.action}</p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Table</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {row.tableName}
            </code>
          </div>
          {row.recordId && (
            <div className="col-span-2">
              <span className="font-medium text-muted-foreground">
                Record ID
              </span>
              <p className="font-mono text-xs">{row.recordId}</p>
            </div>
          )}
          {row.ipAddress && (
            <div>
              <span className="font-medium text-muted-foreground">
                IP Address
              </span>
              <p className="font-mono text-xs">{row.ipAddress}</p>
            </div>
          )}
        </div>

        {/* Diff table */}
        {diffs.length > 0 ? (
          <div className="overflow-auto">
            <p className="mb-2 text-sm font-semibold text-foreground">
              Changed Fields
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="pb-1 pr-4">Field</th>
                  <th className="pb-1 pr-4">Before</th>
                  <th className="pb-1">After</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <DiffRow
                    key={d.field}
                    field={d.field}
                    old={d.old}
                    new={d.new}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {row.oldValues && (
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">
                  Old Values
                </p>
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(row.oldValues, null, 2)}
                </pre>
              </div>
            )}
            {row.newValues && (
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">
                  New Values
                </p>
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(row.newValues, null, 2)}
                </pre>
              </div>
            )}
            {!row.oldValues && !row.newValues && (
              <p className="text-sm text-muted-foreground">
                No value snapshot available.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
