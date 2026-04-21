"use client";

/**
 * Client-side Offices CRUD with create/edit dialog and delete.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OfficeSchema,
  OFFICE_TYPES,
  type OfficeInput,
} from "@/lib/validations/offices";
import { createOffice, updateOffice, deleteOffice } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfficeListRow {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  headEmployeeName: string | null;
  plantillaCount: number;
  memberCount: number;
  createdAt: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  positionTitle: string;
}

interface OfficesClientProps {
  offices: OfficeListRow[];
  employees: EmployeeOption[];
}

// ---------------------------------------------------------------------------
// Office type badge
// ---------------------------------------------------------------------------

const TYPE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "info" | "muted"
> = {
  committee: "warning",
  department: "default",
  office: "info",
  division: "success",
  section: "muted",
};

// ---------------------------------------------------------------------------
// Office form dialog
// ---------------------------------------------------------------------------

interface OfficeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: OfficeListRow;
  offices: OfficeListRow[];
  employees: EmployeeOption[];
  onSuccess: () => void;
}

function OfficeFormDialog({
  open,
  onOpenChange,
  defaultValues,
  offices,
  employees,
  onSuccess,
}: OfficeFormDialogProps) {
  const isEdit = !!defaultValues;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OfficeInput>({
    resolver: zodResolver(OfficeSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      code: defaultValues?.code ?? "",
      type: (defaultValues?.type as OfficeInput["type"]) ?? "office",
      parentId: defaultValues?.parentId ?? null,
      headEmployeeId: null,
    },
  });

  const selectedType = watch("type");
  const selectedParentId = watch("parentId");
  const selectedHeadId = watch("headEmployeeId");

  async function onSubmit(data: OfficeInput) {
    try {
      if (isEdit && defaultValues) {
        await updateOffice({ id: defaultValues.id, ...data });
        toast.success("Office updated.");
      } else {
        await createOffice(data);
        toast.success("Office created.");
      }
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save office.";
      toast.error(message);
    }
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  // Filter out the current office from parent options (prevent self-reference)
  const parentOptions = offices.filter((o) => o.id !== defaultValues?.id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Office" : "New Office"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Editing ${defaultValues.name}`
              : "Add a new PCSO office to the hierarchy."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="office-name">
                Office Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="office-name"
                placeholder="e.g. Charity Sector"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="office-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="office-code"
                placeholder="e.g. OSP"
                className="font-mono uppercase"
                {...register("code")}
                onChange={(e) => setValue("code", e.target.value.toUpperCase())}
              />
              {errors.code && (
                <p className="text-xs text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label htmlFor="office-type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedType}
                onValueChange={(v) =>
                  setValue("type", v as OfficeInput["type"])
                }
              >
                <SelectTrigger id="office-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-xs text-destructive">
                  {errors.type.message}
                </p>
              )}
            </div>

            {/* Parent */}
            <div className="space-y-1.5">
              <Label htmlFor="office-parent">Parent Office</Label>
              <Select
                value={selectedParentId ?? "none"}
                onValueChange={(v) =>
                  setValue("parentId", v === "none" ? null : v)
                }
              >
                <SelectTrigger id="office-parent">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {parentOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Head employee */}
            <div className="space-y-1.5">
              <Label htmlFor="office-head">Office Head</Label>
              <Select
                value={selectedHeadId ?? "none"}
                onValueChange={(v) =>
                  setValue("headEmployeeId", v === "none" ? null : v)
                }
              >
                <SelectTrigger id="office-head">
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName}
                      <span className="ml-1 text-muted-foreground text-xs">
                        — {emp.positionTitle}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : isEdit
                  ? "Save Changes"
                  : "Create Office"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function OfficesClient({ offices, employees }: OfficesClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OfficeListRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filteredOffices = offices.filter((o) => {
    if (typeFilter && o.type !== typeFilter) return false;
    if (search.trim() === "") return true;
    const needle = search.trim().toLowerCase();
    return (
      o.name.toLowerCase().includes(needle) ||
      o.code.toLowerCase().includes(needle) ||
      (o.parentName?.toLowerCase().includes(needle) ?? false) ||
      (o.headEmployeeName?.toLowerCase().includes(needle) ?? false)
    );
  });

  function handleCreate() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function handleEdit(office: OfficeListRow) {
    setEditTarget(office);
    setDialogOpen(true);
  }

  function handleDelete(office: OfficeListRow) {
    if (
      !window.confirm(
        `Delete "${office.name}"?\n\nThis will soft-delete the office. Active employees and positions must be reassigned first.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        await deleteOffice(office.id);
        toast.success(`"${office.name}" deleted.`);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete office.";
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search name, code, parent, or head…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full sm:w-72"
          />
          <Select
            value={typeFilter || "all"}
            onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="Any type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any type</SelectItem>
              {["committee", "department", "office", "division", "section"].map(
                (t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredOffices.length} of {offices.length}
          </span>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Office
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Office</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Head</TableHead>
              <TableHead className="text-right">Positions</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOffices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  {offices.length === 0
                    ? "No offices found. Create one to get started."
                    : "No offices match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredOffices.map((office) => (
                <TableRow key={office.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    {office.name}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {office.code}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={TYPE_VARIANTS[office.type] ?? "outline"}
                      className="capitalize"
                    >
                      {office.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {office.parentName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {office.headEmployeeName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {office.plantillaCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {office.memberCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(office)}
                        disabled={isPending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(office)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <OfficeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultValues={editTarget ?? undefined}
        offices={offices}
        employees={employees}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
