"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, Power, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createFmRecord,
  listFmRecords,
  setFmRecordActive,
  updateFmRecord,
  type FmListResult,
  type FmRecord,
} from "@/lib/actions/fm/crud";
import type {
  FmExternalLookup,
  FmField,
  FmGroup,
  FmTableMeta,
} from "@/lib/fm/types";

const GROUP_LABELS: Record<FmGroup, string> = {
  personal: "Personal Data",
  organization: "Organization & Positions",
  documents: "Documents",
  training: "Training & Competency",
  compensation: "Compensation",
  attendance: "Attendance & Leave",
  separation: "Separation & Misc",
};

const GROUP_ORDER: FmGroup[] = [
  "personal",
  "organization",
  "documents",
  "training",
  "compensation",
  "attendance",
  "separation",
];

type Props = {
  metas: FmTableMeta[];
  externals: FmExternalLookup[];
  canWrite: boolean;
  initialTable: string;
  initialData: FmListResult;
};

type FormState = Record<string, unknown>;

function emptyForm(fields: FmField[]): FormState {
  const state: FormState = {};
  for (const f of fields) {
    if (f.type === "boolean") state[f.key] = false;
    else if (f.type === "multiselect") state[f.key] = [];
    else state[f.key] = "";
  }
  return state;
}

function formFromRecord(fields: FmField[], record: FmRecord): FormState {
  const state: FormState = {};
  for (const f of fields) {
    const v = record[f.key];
    if (f.type === "boolean") state[f.key] = Boolean(v);
    else if (f.type === "multiselect") state[f.key] = Array.isArray(v) ? v : [];
    else state[f.key] = v == null ? "" : String(v);
  }
  return state;
}

function cellText(field: FmField, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

export function FileMaintenanceClient({
  metas,
  externals,
  canWrite,
  initialTable,
  initialData,
}: Props) {
  const [activeKey, setActiveKey] = useState(initialTable);
  const [data, setData] = useState<FmListResult>(initialData);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [isPending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FmRecord | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => {
    const found = metas.find((m) => m.key === activeKey) ?? metas[0];
    if (!found) throw new Error("FM registry is empty");
    return found;
  }, [metas, activeKey]);

  const grouped = useMemo(() => {
    const map = new Map<FmGroup, FmTableMeta[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const m of metas) map.get(m.group)?.push(m);
    return map;
  }, [metas]);

  const visibleFields = active.fields.slice(0, 5);

  function reload(
    key: string,
    opts: { search?: string; includeInactive?: boolean } = {},
  ) {
    startTransition(async () => {
      try {
        const result = await listFmRecords(key, {
          search: opts.search ?? search,
          includeInactive: opts.includeInactive ?? showInactive,
        });
        setData(result);
      } catch {
        toast.error("Failed to load records");
      }
    });
  }

  function selectTable(key: string) {
    setActiveKey(key);
    setSearch("");
    reload(key, { search: "" });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("table", key);
      window.history.replaceState(null, "", url.toString());
    }
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      reload(active.key, { search: value });
    }, 350);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(active.fields));
    setDialogOpen(true);
  }

  function openEdit(record: FmRecord) {
    setEditing(record);
    setForm(formFromRecord(active.fields, record));
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await updateFmRecord(active.key, editing.id, form);
        toast.success(`${active.label} record updated`);
      } else {
        await createFmRecord(active.key, form);
        toast.success(`${active.label} record added`);
      }
      setDialogOpen(false);
      reload(active.key);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save record";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(record: FmRecord) {
    try {
      await setFmRecordActive(active.key, record.id, !record.isActive);
      toast.success(
        record.isActive ? "Record deactivated" : "Record reactivated",
      );
      reload(active.key);
    } catch {
      toast.error("Failed to update record status");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* ── Category sidebar ── */}
      <div className="space-y-4">
        {GROUP_ORDER.map((group) => {
          const items = grouped.get(group) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {GROUP_LABELS[group]}
              </p>
              <div className="space-y-0.5">
                {items.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => selectTable(m.key)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      m.key === active.key
                        ? "bg-pcso-navy text-white"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="truncate">{m.label}</span>
                    <span
                      className={`ml-2 shrink-0 text-[10px] ${
                        m.key === active.key
                          ? "text-white/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {m.torRef}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Managed in Modules
          </p>
          <div className="space-y-0.5">
            {externals.map((ext) => (
              <Link
                key={ext.href + ext.torRef}
                href={ext.href}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="truncate">{ext.label}</span>
                <ExternalLink className="ml-2 h-3 w-3 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active table ── */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {active.label}
              <Badge variant="outline">TOR {active.torRef}</Badge>
            </CardTitle>
            {canWrite && (
              <Button
                size="sm"
                onClick={openCreate}
                className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
              >
                <Plus className="h-4 w-4" />
                Add Record
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Search ${active.label.toLowerCase()}…`}
                className="pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={showInactive}
                onCheckedChange={(checked) => {
                  setShowInactive(checked);
                  reload(active.key, { includeInactive: checked });
                }}
              />
              Show inactive
            </label>
            <span className="ml-auto text-sm text-muted-foreground">
              {data.total} record{data.total === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleFields.map((f) => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={visibleFields.length + (canWrite ? 2 : 1)}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {isPending ? "Loading…" : "No records yet."}
                    </TableCell>
                  </TableRow>
                )}
                {data.rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.isActive ? "" : "opacity-50"}
                  >
                    {visibleFields.map((f) => (
                      <TableCell key={f.key} className="max-w-[240px] truncate">
                        {cellText(f, row[f.key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge variant={row.isActive ? "default" : "secondary"}>
                        {row.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(row)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActive(row)}
                            title={row.isActive ? "Deactivate" : "Reactivate"}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Add / edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${active.label}` : `Add ${active.label}`}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the record. Changes are audit-logged."
                : "Create a new lookup record. It becomes available to all modules immediately."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {active.fields.map((field) => (
              <FmFieldInput
                key={field.key}
                field={field}
                value={form[field.key]}
                onChange={(v) => setForm((s) => ({ ...s, [field.key]: v }))}
              />
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FmFieldInput({
  field,
  value,
  onChange,
}: {
  field: FmField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `fm-${field.key}`;
  const label = (
    <Label htmlFor={id} className="flex items-center gap-1">
      {field.label}
      {field.required && <span className="text-destructive">*</span>}
    </Label>
  );

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1.5">
          {label}
          <Textarea
            id={id}
            value={String(value ?? "")}
            maxLength={field.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.help && (
            <p className="text-xs text-muted-foreground">{field.help}</p>
          )}
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor={id}>{field.label}</Label>
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select
            value={value ? String(value) : undefined}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger id={id}>
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}`}
              />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1.5">
          {label}
          <div className="space-y-2 rounded-md border p-3">
            {(field.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, opt]
                        : selected.filter((s) => s !== opt),
                    )
                  }
                />
                {opt.replace(/_/g, " ")}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case "int":
    case "decimal":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            id={id}
            type="number"
            step={field.type === "int" ? 1 : "0.01"}
            min={field.min}
            max={field.max}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.help && (
            <p className="text-xs text-muted-foreground">{field.help}</p>
          )}
        </div>
      );
    case "date":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            id={id}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            id={id}
            value={String(value ?? "")}
            maxLength={field.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.help && (
            <p className="text-xs text-muted-foreground">{field.help}</p>
          )}
        </div>
      );
  }
}
