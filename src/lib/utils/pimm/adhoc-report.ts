/**
 * PIMM ad hoc report shaping — TOR 1.3.26 (employee ad hoc reports) and
 * TOR 1.2.29 (RPM applications ad hoc reports).
 *
 * Pure helpers for the parametrized PIMM report builder: canonical selectable
 * column catalogs (employees + RPM applications), row → display-cell shaping
 * for a chosen column set, and CSV serialization. The server action fetches
 * raw rows; this module owns everything shape-related so it is fully testable
 * without a database and reusable by the client for CSV export.
 *
 * Modeled on src/lib/utils/payroll/report-builder.ts (TOR 1.8.15).
 */

import {
  isOrganicAppointmentType,
  APPOINTMENT_TYPE_LABELS,
  type AppointmentType,
} from "@/lib/constants/appointment-types";

// ---------------------------------------------------------------------------
// Generic column catalog + shaping
// ---------------------------------------------------------------------------

export interface AdhocColumn<TRow> {
  key: Extract<keyof TRow, string>;
  label: string;
}

export interface AdhocColumnCatalog<TRow> {
  /**
   * Identity columns always present in every report (not user-selectable).
   * Order matters — it is the leading column order in tables and CSV.
   */
  fixed: readonly AdhocColumn<TRow>[];
  /** User-selectable columns (column picker), in catalog order. */
  selectable: readonly AdhocColumn<TRow>[];
  /** Default column selection when the user has not picked anything yet. */
  defaultKeys: readonly Extract<keyof TRow, string>[];
}

/**
 * Resolve a set of selected keys into ordered column definitions: fixed
 * identity columns first, then the selected columns in catalog order.
 * Unknown keys are ignored; an empty (or all-unknown) selection falls back
 * to the catalog's default column set.
 */
export function resolveAdhocColumns<TRow>(
  catalog: AdhocColumnCatalog<TRow>,
  selectedKeys: readonly string[],
): AdhocColumn<TRow>[] {
  const wanted = new Set<string>(
    selectedKeys.length > 0 ? selectedKeys : catalog.defaultKeys,
  );
  const selected = catalog.selectable.filter((col) => wanted.has(col.key));
  const effective =
    selected.length > 0
      ? selected
      : catalog.selectable.filter((col) =>
          catalog.defaultKeys.includes(col.key),
        );
  return [...catalog.fixed, ...effective];
}

export interface ShapedAdhocReport {
  /** Ordered columns (fixed first, then selection in catalog order). */
  columns: { key: string; label: string }[];
  /** One display row per record, cells ordered like `columns`. */
  rows: string[][];
  /** Record count (rows.length — kept explicit for summary display). */
  total: number;
}

/**
 * Shape raw report rows into display cells for the chosen columns. Cell
 * values are plain strings so the same output feeds tables and CSV.
 */
export function shapeAdhocReport<TRow extends Record<string, string>>(
  catalog: AdhocColumnCatalog<TRow>,
  records: readonly TRow[],
  selectedKeys: readonly string[],
): ShapedAdhocReport {
  const columns = resolveAdhocColumns(catalog, selectedKeys);
  const rows = records.map((record) =>
    columns.map((col) => record[col.key] ?? ""),
  );
  return {
    columns: columns.map((col) => ({ key: col.key, label: col.label })),
    rows,
    total: records.length,
  };
}

// ---------------------------------------------------------------------------
// CSV serialization
// ---------------------------------------------------------------------------

export function escapeCsvCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Serialize a header row + data rows to CSV. Callers prepend a UTF-8 BOM at
 * download time (house Excel convention — see downloadCsv client helpers).
 */
export function buildCsvFromTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

/** Serialize a shaped ad hoc report (labels as header) to CSV. */
export function buildAdhocCsv(report: ShapedAdhocReport): string {
  return buildCsvFromTable(
    report.columns.map((c) => c.label),
    report.rows,
  );
}

// ---------------------------------------------------------------------------
// Employee ad hoc report (TOR 1.3.26)
// ---------------------------------------------------------------------------

/** All-string row so shaping/CSV needs no per-column formatting logic. */
export type EmployeeAdhocRow = {
  employeeNo: string;
  fullName: string;
  officeName: string;
  positionTitle: string;
  appointmentType: string;
  appointmentCategory: string;
  salaryGrade: string;
  step: string;
  status: string;
  dateHired: string;
  gender: string;
  email: string;
  highestEducation: string;
  eligibilities: string;
  externalTrainings: string;
};

export const EMPLOYEE_ADHOC_CATALOG: AdhocColumnCatalog<EmployeeAdhocRow> = {
  fixed: [
    { key: "employeeNo", label: "Employee No." },
    { key: "fullName", label: "Employee Name" },
  ],
  selectable: [
    { key: "officeName", label: "Office" },
    { key: "positionTitle", label: "Position" },
    { key: "appointmentType", label: "Appointment Type" },
    { key: "appointmentCategory", label: "Category (Organic / Non-Organic)" },
    { key: "salaryGrade", label: "Salary Grade" },
    { key: "step", label: "Step" },
    { key: "status", label: "Employment Status" },
    { key: "dateHired", label: "Date Hired" },
    { key: "gender", label: "Sex" },
    { key: "email", label: "Email" },
    { key: "highestEducation", label: "Highest Education" },
    { key: "eligibilities", label: "Eligibilities" },
    { key: "externalTrainings", label: "External Trainings (Count)" },
  ],
  defaultKeys: [
    "officeName",
    "positionTitle",
    "appointmentType",
    "salaryGrade",
    "step",
    "status",
    "dateHired",
  ],
};

/**
 * TOR 1.3.3 category label for an appointment type. Delegates to the
 * fail-safe organic ALLOWLIST in constants/appointment-types.ts.
 */
export function appointmentCategoryLabel(
  type: AppointmentType,
): "Organic" | "Non-Organic" {
  return isOrganicAppointmentType(type) ? "Organic" : "Non-Organic";
}

/** Human label for an appointment type enum value (fallback: raw value). */
export function appointmentTypeLabel(type: string): string {
  return APPOINTMENT_TYPE_LABELS[type as AppointmentType] ?? type;
}

// ── Education summary ────────────────────────────────────────────────────────

/** Ascending attainment order — matches education_level pgEnum values. */
export const EDUCATION_LEVEL_RANK = [
  "elementary",
  "secondary",
  "vocational",
  "college",
  "graduate_studies",
] as const;

export const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  elementary: "Elementary",
  secondary: "Secondary",
  vocational: "Vocational / Trade Course",
  college: "College",
  graduate_studies: "Graduate Studies",
};

export interface EducationEntry {
  level: string;
  degreeCourse?: string | null;
}

/**
 * Highest educational attainment as a display string, e.g.
 * "College — BS Information Technology". Unknown levels rank lowest.
 * Returns "" when the employee has no education records.
 */
export function highestEducationLabel(
  entries: readonly EducationEntry[],
): string {
  let best: EducationEntry | null = null;
  let bestRank = -1;
  for (const entry of entries) {
    const rank = (EDUCATION_LEVEL_RANK as readonly string[]).indexOf(
      entry.level,
    );
    if (best === null || rank > bestRank) {
      best = entry;
      bestRank = rank;
    }
  }
  if (!best) return "";
  const label = EDUCATION_LEVEL_LABELS[best.level] ?? best.level;
  return best.degreeCourse ? `${label} — ${best.degreeCourse}` : label;
}

// ---------------------------------------------------------------------------
// RPM applications ad hoc report (TOR 1.2.29)
// ---------------------------------------------------------------------------

export type ApplicationAdhocRow = {
  applicationNo: string;
  applicantName: string;
  vacancyPosition: string;
  vacancyItemNo: string;
  status: string;
  matchScore: string;
  submittedDate: string;
};

export const APPLICATION_ADHOC_CATALOG: AdhocColumnCatalog<ApplicationAdhocRow> =
  {
    fixed: [
      { key: "applicationNo", label: "Application No." },
      { key: "applicantName", label: "Applicant Name" },
    ],
    selectable: [
      { key: "vacancyPosition", label: "Vacancy / Position" },
      { key: "vacancyItemNo", label: "Plantilla Item No." },
      { key: "status", label: "Application Status" },
      { key: "matchScore", label: "Match Score" },
      { key: "submittedDate", label: "Submitted Date" },
    ],
    defaultKeys: ["vacancyPosition", "status", "matchScore", "submittedDate"],
  };

/**
 * Extract "Last, First Middle" from the applications.personal_info JSONB
 * blob (shape enforced at the Zod boundary — see validations/recruitment.ts
 * personalInfoSchema). Defensive against legacy/partial payloads.
 */
export function applicantNameFromPersonalInfo(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "";
  }
  const info = value as Record<string, unknown>;
  const first = typeof info.firstName === "string" ? info.firstName.trim() : "";
  const last = typeof info.lastName === "string" ? info.lastName.trim() : "";
  const middle =
    typeof info.middleName === "string" ? info.middleName.trim() : "";
  if (!first && !last) return "";
  const given = [first, middle].filter(Boolean).join(" ");
  if (last && given) return `${last}, ${given}`;
  return last || given;
}
