"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { deleteBankConfig } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BankConfigTableProps {
  configs: {
    id: string;
    bankName: string;
    columnMapping: Record<string, unknown>;
    delimiter: string;
    hasHeader: boolean;
    dateFormat: string;
    notes: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  }[];
}

export function BankConfigTable({ configs }: BankConfigTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bank configuration?"))
      return;

    setDeletingId(id);
    try {
      await deleteBankConfig({ id });
      toast.success("Bank configuration deleted successfully");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete configuration",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (configs.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No bank configurations found. Create a new configuration to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bank Name</TableHead>
            <TableHead>Column Mapping</TableHead>
            <TableHead>Delimiter</TableHead>
            <TableHead>Header</TableHead>
            <TableHead>Date Format</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((config) => {
            const columnCount = Object.keys(config.columnMapping).length;

            return (
              <TableRow key={config.id}>
                <TableCell className="font-medium">{config.bankName}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <Badge variant="secondary">{columnCount} columns</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {Object.keys(config.columnMapping).slice(0, 3).join(", ")}
                      {columnCount > 3 && ", ..."}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {config.delimiter === "," ? "comma" : config.delimiter}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant={config.hasHeader ? "default" : "secondary"}>
                    {config.hasHeader ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {config.dateFormat}
                  </code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {config.updatedAt
                    ? format(new Date(config.updatedAt), "MMM d, yyyy")
                    : config.createdAt
                      ? format(new Date(config.createdAt), "MMM d, yyyy")
                      : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/payroll/bank-configs/${config.id}/edit`)
                      }
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                      disabled={deletingId === config.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
