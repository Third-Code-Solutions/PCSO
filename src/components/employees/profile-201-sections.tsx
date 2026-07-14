"use client";

/**
 * 201 File / PDS Data — section CRUD tables (PIM-001, TOR 1.3.1/1.3.25).
 *
 * Seven CS Form 212 backing sections, each rendered as a table with
 * add / edit / delete dialogs that call the employee-201 server actions.
 * Follows the config-driven form pattern of the File Maintenance client.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import type {
  EmployeeFamilyMember,
  EmployeeEducationRow,
  EmployeeEligibility,
  EmployeeWorkExperience,
  EmployeeVoluntaryWork,
  EmployeeExternalTraining,
  EmployeeDesignation,
} from "@/lib/db/schema";
import {
  FAMILY_MEMBER_TYPE_VALUES,
  EDUCATION_LEVEL_VALUES,
  DESIGNATION_TYPE_VALUES,
  DESIGNATION_STATUS_VALUES,
} from "@/lib/validations/employee-201";
import {
  createFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  createEducationRecord,
  updateEducationRecord,
  removeEducationRecord,
  createEligibility,
  updateEligibility,
  removeEligibility,
  createWorkExperience,
  updateWorkExperience,
  removeWorkExperience,
  createVoluntaryWork,
  updateVoluntaryWork,
  removeVoluntaryWork,
  createExternalTraining,
  updateExternalTraining,
  removeExternalTraining,
  createDesignation,
  updateDesignation,
  removeDesignation,
} from "@/lib/actions/pimm/employee-201";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult = { data: unknown } | { error: string };

type FormState = Record<string, unknown>;

type FieldType = "text" | "date" | "number" | "select" | "switch" | "textarea";

interface SelectOption {
  value: string;
  label: string;
}

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  required?: boolean;
  placeholder?: string;
  /** Span both columns of the dialog grid. */
  full?: boolean;
  /** step attribute for number inputs. */
  step?: string;
  defaultValue?: string | boolean;
  /** Adds a "— None —" choice mapping to empty string (optional selects). */
  allowEmpty?: boolean;
}

interface ColumnDef<Row> {
  header: string;
  cell: (row: Row) => React.ReactNode;
  hideOnMobile?: boolean;
}

interface SectionDef<Row extends { id: string }> {
  key: string;
  title: string;
  subtitle: string;
  addLabel: string;
  emptyText: string;
  columns: ColumnDef<Row>[];
  fields: FieldDef[];
  create: (input: unknown) => Promise<ActionResult>;
  update: (input: unknown) => Promise<ActionResult>;
  remove: (input: unknown) => Promise<ActionResult>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NONE_VALUE = "__none__";

function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function fmtPeriod(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (!from && !to) return "—";
  return `${fmtDate(from)} – ${to ? fmtDate(to) : "Present"}`;
}

function fmtMoney(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((v) => ({ value: v, label: titleCase(v) }));
}

function emptyFormFromFields(fields: FieldDef[]): FormState {
  const state: FormState = {};
  for (const f of fields) {
    if (f.type === "switch") state[f.key] = f.defaultValue ?? false;
    else state[f.key] = f.defaultValue ?? "";
  }
  return state;
}

function formFromRow(
  fields: FieldDef[],
  row: Record<string, unknown>,
): FormState {
  const state: FormState = {};
  for (const f of fields) {
    const v = row[f.key];
    if (f.type === "switch") state[f.key] = Boolean(v);
    else state[f.key] = v == null ? "" : String(v);
  }
  return state;
}

function personName(row: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  extensionName: string | null;
}): string {
  const base = [row.firstName, row.middleName, row.lastName]
    .filter(Boolean)
    .join(" ");
  return row.extensionName ? `${base}, ${row.extensionName}` : base;
}

// ─── Field control ────────────────────────────────────────────────────────────

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f201-${field.key}`;

  if (field.type === "switch") {
    return (
      <div className="flex items-center gap-2 pt-6">
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
          {field.label}
        </Label>
      </div>
    );
  }

  const labelEl = (
    <Label htmlFor={id} className="text-xs">
      {field.label}
      {field.required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );

  if (field.type === "select") {
    const stringValue = value == null || value === "" ? "" : String(value);
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Select
          value={
            stringValue === ""
              ? field.allowEmpty
                ? NONE_VALUE
                : ""
              : stringValue
          }
          onValueChange={(v) => onChange(v === NONE_VALUE ? "" : v)}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.allowEmpty ? (
              <SelectItem value={NONE_VALUE}>— None —</SelectItem>
            ) : null}
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Textarea
          id={id}
          rows={2}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {labelEl}
      <Input
        id={id}
        type={field.type === "number" ? "number" : field.type}
        step={field.step}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Section card (table + dialogs) ──────────────────────────────────────────

function SectionCard<Row extends { id: string }>({
  section,
  rows,
  employeeId,
  canEdit,
}: {
  section: SectionDef<Row>;
  rows: Row[];
  employeeId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyFormFromFields(section.fields));
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setForm(formFromRow(section.fields, row as Record<string, unknown>));
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = editing
        ? await section.update({ id: editing.id, ...form })
        : await section.create({ employeeId, ...form });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        editing
          ? `${section.title} record updated`
          : `${section.title} record added`,
      );
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to save record");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await section.remove({ id: deleteTarget.id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Record removed");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Failed to remove record");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-pcso-navy">
            {section.title}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {section.subtitle}
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            {section.addLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {section.emptyText}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {section.columns.map((col) => (
                    <TableHead
                      key={col.header}
                      className={
                        col.hideOnMobile ? "hidden md:table-cell" : undefined
                      }
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {canEdit ? (
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {section.columns.map((col) => (
                      <TableCell
                        key={col.header}
                        className={
                          col.hideOnMobile ? "hidden md:table-cell" : undefined
                        }
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                    {canEdit ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            aria-label="Edit record"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            aria-label="Remove record"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${section.title}` : section.addLabel}
            </DialogTitle>
            <DialogDescription>{section.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div
                key={field.key}
                className={field.full ? "sm:col-span-2" : undefined}
              >
                <FieldControl
                  field={field}
                  value={form[field.key]}
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, [field.key]: v }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this record?</AlertDialogTitle>
            <AlertDialogDescription>
              The {section.title.toLowerCase()} record will be removed from the
              201 file (soft-deleted; the action is logged in the audit trail).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Section definitions ──────────────────────────────────────────────────────

const familySection: SectionDef<EmployeeFamilyMember> = {
  key: "family",
  title: "Family & Dependents",
  subtitle: "CS Form 212 Section II — spouse, parents, children, dependents",
  addLabel: "Add Family Member",
  emptyText: "No family members recorded.",
  columns: [
    {
      header: "Type",
      cell: (r) => <Badge variant="muted">{titleCase(r.memberType)}</Badge>,
    },
    { header: "Name", cell: (r) => personName(r) },
    {
      header: "Birth Date",
      cell: (r) => fmtDate(r.birthDate),
      hideOnMobile: true,
    },
    {
      header: "Occupation",
      cell: (r) => r.occupation ?? "—",
      hideOnMobile: true,
    },
    { header: "Dependent", cell: (r) => (r.isDependent ? "Yes" : "No") },
  ],
  fields: [
    {
      key: "memberType",
      label: "Member Type",
      type: "select",
      options: toOptions(FAMILY_MEMBER_TYPE_VALUES),
      required: true,
      defaultValue: "child",
    },
    { key: "lastName", label: "Last Name", type: "text", required: true },
    { key: "firstName", label: "First Name", type: "text", required: true },
    { key: "middleName", label: "Middle Name", type: "text" },
    {
      key: "extensionName",
      label: "Name Ext.",
      type: "text",
      placeholder: "Jr., Sr., III",
    },
    { key: "birthDate", label: "Birth Date", type: "date" },
    { key: "occupation", label: "Occupation", type: "text" },
    { key: "telephoneNo", label: "Telephone No.", type: "text" },
    { key: "employerName", label: "Employer / Business Name", type: "text" },
    {
      key: "sortOrder",
      label: "Sort Order",
      type: "number",
      defaultValue: "0",
    },
    {
      key: "employerAddress",
      label: "Employer / Business Address",
      type: "textarea",
      full: true,
    },
    { key: "isDependent", label: "Declared dependent", type: "switch" },
  ],
  create: createFamilyMember,
  update: updateFamilyMember,
  remove: removeFamilyMember,
};

const educationSection: SectionDef<EmployeeEducationRow> = {
  key: "education",
  title: "Educational Background",
  subtitle: "CS Form 212 Section III — elementary to graduate studies",
  addLabel: "Add Education",
  emptyText: "No education records.",
  columns: [
    {
      header: "Level",
      cell: (r) => <Badge variant="muted">{titleCase(r.level)}</Badge>,
    },
    { header: "School", cell: (r) => r.schoolName },
    {
      header: "Degree / Course",
      cell: (r) => r.degreeCourse ?? "—",
      hideOnMobile: true,
    },
    {
      header: "Period",
      cell: (r) =>
        [r.attendanceFrom, r.attendanceTo].filter(Boolean).join(" – ") || "—",
      hideOnMobile: true,
    },
    { header: "Year Graduated", cell: (r) => r.yearGraduated ?? "—" },
  ],
  fields: [
    {
      key: "level",
      label: "Level",
      type: "select",
      options: toOptions(EDUCATION_LEVEL_VALUES),
      required: true,
      defaultValue: "college",
    },
    {
      key: "schoolName",
      label: "Name of School",
      type: "text",
      required: true,
    },
    {
      key: "degreeCourse",
      label: "Basic Education / Degree / Course",
      type: "text",
      full: true,
    },
    {
      key: "attendanceFrom",
      label: "Attendance From (year)",
      type: "text",
      placeholder: "2001",
    },
    {
      key: "attendanceTo",
      label: "Attendance To (year)",
      type: "text",
      placeholder: "2005",
    },
    {
      key: "highestLevelUnits",
      label: "Highest Level / Units Earned",
      type: "text",
    },
    { key: "yearGraduated", label: "Year Graduated", type: "text" },
    {
      key: "honorsReceived",
      label: "Scholarship / Academic Honors",
      type: "text",
    },
    {
      key: "sortOrder",
      label: "Sort Order",
      type: "number",
      defaultValue: "0",
    },
  ],
  create: createEducationRecord,
  update: updateEducationRecord,
  remove: removeEducationRecord,
};

const eligibilitySection: SectionDef<EmployeeEligibility> = {
  key: "eligibility",
  title: "Civil Service Eligibility",
  subtitle: "CS Form 212 Section IV — career service, RA 1080, board / bar",
  addLabel: "Add Eligibility",
  emptyText: "No eligibilities recorded.",
  columns: [
    { header: "Eligibility", cell: (r) => r.eligibilityName },
    { header: "Rating", cell: (r) => r.rating ?? "—" },
    {
      header: "Exam Date",
      cell: (r) => fmtDate(r.examDate),
      hideOnMobile: true,
    },
    {
      header: "Exam Place",
      cell: (r) => r.examPlace ?? "—",
      hideOnMobile: true,
    },
    { header: "License No.", cell: (r) => r.licenseNo ?? "—" },
  ],
  fields: [
    {
      key: "eligibilityName",
      label: "Eligibility (Career Service / RA 1080 / Board-Bar)",
      type: "text",
      required: true,
      full: true,
    },
    { key: "rating", label: "Rating", type: "text", placeholder: "85.20" },
    { key: "examDate", label: "Date of Examination", type: "date" },
    { key: "examPlace", label: "Place of Examination", type: "text" },
    { key: "licenseNo", label: "License No.", type: "text" },
    { key: "licenseValidity", label: "License Validity", type: "date" },
  ],
  create: createEligibility,
  update: updateEligibility,
  remove: removeEligibility,
};

const workExperienceSection: SectionDef<EmployeeWorkExperience> = {
  key: "work",
  title: "Work Experience",
  subtitle:
    "CS Form 212 Section V — external / pre-PCSO employment (PCSO service pulls from appointments)",
  addLabel: "Add Work Experience",
  emptyText: "No external work experience recorded.",
  columns: [
    { header: "Period", cell: (r) => fmtPeriod(r.dateFrom, r.dateTo) },
    { header: "Position", cell: (r) => r.positionTitle },
    { header: "Company / Agency", cell: (r) => r.companyName },
    {
      header: "Monthly Salary",
      cell: (r) => fmtMoney(r.monthlySalary),
      hideOnMobile: true,
    },
    { header: "Gov't", cell: (r) => (r.isGovernmentService ? "Yes" : "No") },
  ],
  fields: [
    { key: "dateFrom", label: "From", type: "date", required: true },
    { key: "dateTo", label: "To (blank = present)", type: "date" },
    {
      key: "positionTitle",
      label: "Position Title",
      type: "text",
      required: true,
    },
    {
      key: "companyName",
      label: "Department / Agency / Company",
      type: "text",
      required: true,
    },
    {
      key: "monthlySalary",
      label: "Monthly Salary",
      type: "number",
      step: "0.01",
    },
    { key: "salaryGradeStep", label: "SG & Step (e.g. 18-3)", type: "text" },
    {
      key: "statusOfAppointment",
      label: "Status of Appointment",
      type: "text",
    },
    { key: "isGovernmentService", label: "Government service", type: "switch" },
  ],
  create: createWorkExperience,
  update: updateWorkExperience,
  remove: removeWorkExperience,
};

const voluntaryWorkSection: SectionDef<EmployeeVoluntaryWork> = {
  key: "voluntary",
  title: "Voluntary Work",
  subtitle:
    "CS Form 212 Section VI — civic / NGO / people / voluntary organizations",
  addLabel: "Add Voluntary Work",
  emptyText: "No voluntary work recorded.",
  columns: [
    { header: "Organization", cell: (r) => r.organizationName },
    {
      header: "Period",
      cell: (r) => fmtPeriod(r.dateFrom, r.dateTo),
      hideOnMobile: true,
    },
    { header: "Hours", cell: (r) => r.numberOfHours ?? "—" },
    { header: "Position / Nature", cell: (r) => r.positionNature ?? "—" },
  ],
  fields: [
    {
      key: "organizationName",
      label: "Name of Organization",
      type: "text",
      required: true,
      full: true,
    },
    {
      key: "organizationAddress",
      label: "Address of Organization",
      type: "textarea",
      full: true,
    },
    { key: "dateFrom", label: "From", type: "date" },
    { key: "dateTo", label: "To", type: "date" },
    {
      key: "numberOfHours",
      label: "Number of Hours",
      type: "number",
      step: "1",
    },
    { key: "positionNature", label: "Position / Nature of Work", type: "text" },
  ],
  create: createVoluntaryWork,
  update: updateVoluntaryWork,
  remove: removeVoluntaryWork,
};

const externalTrainingSection: SectionDef<EmployeeExternalTraining> = {
  key: "trainings",
  title: "External Trainings",
  subtitle:
    "CS Form 212 Section VII — trainings attended outside PCSO (in-house LDM records merge automatically)",
  addLabel: "Add Training",
  emptyText: "No external trainings recorded.",
  columns: [
    { header: "Title", cell: (r) => r.title },
    {
      header: "Period",
      cell: (r) => fmtPeriod(r.dateFrom, r.dateTo),
      hideOnMobile: true,
    },
    { header: "Hours", cell: (r) => r.numberOfHours ?? "—" },
    {
      header: "Conducted By",
      cell: (r) => r.conductedBy ?? "—",
      hideOnMobile: true,
    },
    { header: "L&D Type", cell: (r) => (r.ldType ? titleCase(r.ldType) : "—") },
  ],
  fields: [
    {
      key: "title",
      label: "Title of L&D Intervention",
      type: "text",
      required: true,
      full: true,
    },
    { key: "dateFrom", label: "From", type: "date" },
    { key: "dateTo", label: "To", type: "date" },
    {
      key: "numberOfHours",
      label: "Number of Hours",
      type: "number",
      step: "0.5",
    },
    {
      key: "ldType",
      label: "L&D Type",
      type: "text",
      placeholder: "Technical, Managerial…",
    },
    { key: "conductedBy", label: "Conducted / Sponsored By", type: "text" },
  ],
  create: createExternalTraining,
  update: updateExternalTraining,
  remove: removeExternalTraining,
};

function designationStatusVariant(
  status: string,
): "success" | "warning" | "destructive" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "completed":
      return "muted";
    case "revoked":
      return "destructive";
    default:
      return "warning";
  }
}

function makeDesignationSection(
  offices: { id: string; name: string }[],
): SectionDef<EmployeeDesignation> {
  const officeNames = new Map(offices.map((o) => [o.id, o.name]));
  return {
    key: "designations",
    title: "Designations & Special Orders",
    subtitle:
      "TOR 1.3.25 — designation, reassignment, special order, detail history",
    addLabel: "Add Designation",
    emptyText: "No designations or special orders recorded.",
    columns: [
      {
        header: "Type",
        cell: (r) => (
          <Badge variant="muted">{titleCase(r.designationType)}</Badge>
        ),
      },
      { header: "Title", cell: (r) => r.designationTitle },
      {
        header: "Office",
        cell: (r) => (r.officeId ? (officeNames.get(r.officeId) ?? "—") : "—"),
        hideOnMobile: true,
      },
      {
        header: "S.O. No.",
        cell: (r) => r.specialOrderNo ?? "—",
        hideOnMobile: true,
      },
      { header: "Period", cell: (r) => fmtPeriod(r.startDate, r.endDate) },
      {
        header: "Status",
        cell: (r) => (
          <Badge variant={designationStatusVariant(r.status)}>
            {titleCase(r.status)}
          </Badge>
        ),
      },
    ],
    fields: [
      {
        key: "designationType",
        label: "Type",
        type: "select",
        options: toOptions(DESIGNATION_TYPE_VALUES),
        required: true,
        defaultValue: "designation",
      },
      {
        key: "designationTitle",
        label: "Designation Title",
        type: "text",
        required: true,
        placeholder: "OIC — Division Chief",
      },
      {
        key: "officeId",
        label: "Office",
        type: "select",
        options: offices.map((o) => ({ value: o.id, label: o.name })),
        allowEmpty: true,
      },
      { key: "specialOrderNo", label: "Special Order No.", type: "text" },
      { key: "startDate", label: "Start Date", type: "date", required: true },
      { key: "endDate", label: "End Date", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: toOptions(DESIGNATION_STATUS_VALUES),
        required: true,
        defaultValue: "active",
      },
      {
        key: "documentUrl",
        label: "Document URL",
        type: "text",
        placeholder: "https://…",
      },
      { key: "remarks", label: "Remarks", type: "textarea", full: true },
    ],
    create: createDesignation,
    update: updateDesignation,
    remove: removeDesignation,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface Profile201Data {
  familyMembers: EmployeeFamilyMember[];
  education: EmployeeEducationRow[];
  eligibilities: EmployeeEligibility[];
  workExperiences: EmployeeWorkExperience[];
  voluntaryWorks: EmployeeVoluntaryWork[];
  externalTrainings: EmployeeExternalTraining[];
  designations: EmployeeDesignation[];
}

export interface Profile201SectionsProps {
  employeeId: string;
  canEdit: boolean;
  data: Profile201Data;
  offices: { id: string; name: string }[];
}

export function Profile201Sections({
  employeeId,
  canEdit,
  data,
  offices,
}: Profile201SectionsProps) {
  const designationSection = useMemo(
    () => makeDesignationSection(offices),
    [offices],
  );

  return (
    <div className="space-y-6">
      <SectionCard
        section={familySection}
        rows={data.familyMembers}
        employeeId={employeeId}
        canEdit={canEdit}
      />
      <SectionCard
        section={educationSection}
        rows={data.education}
        employeeId={employeeId}
        canEdit={canEdit}
      />
      <SectionCard
        section={eligibilitySection}
        rows={data.eligibilities}
        employeeId={employeeId}
        canEdit={canEdit}
      />
      <SectionCard
        section={workExperienceSection}
        rows={data.workExperiences}
        employeeId={employeeId}
        canEdit={canEdit}
      />
      <SectionCard
        section={voluntaryWorkSection}
        rows={data.voluntaryWorks}
        employeeId={employeeId}
        canEdit={canEdit}
      />
      <SectionCard
        section={externalTrainingSection}
        rows={data.externalTrainings}
        employeeId={employeeId}
        canEdit={canEdit}
      />
      <SectionCard
        section={designationSection}
        rows={data.designations}
        employeeId={employeeId}
        canEdit={canEdit}
      />
    </div>
  );
}
