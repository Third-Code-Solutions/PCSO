/**
 * Template rendering for the ad hoc certificate engine (PIM-018).
 *
 * Pure {{placeholder}} substitution — no DB, no env, no I/O. Placeholder
 * vocabulary is built from the employee 201 file by
 * `buildEmployeePlaceholderValues`; the substitution itself is generic.
 *
 * Unknown / unresolvable placeholders are collected into `missing` and left
 * verbatim in the output so the generator can refuse to issue an incomplete
 * certificate with a precise error list. Output goes into a PDF text node —
 * no HTML escaping is required (react-pdf renders plain text).
 */

// ─── Core substitution ────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface TemplateRenderResult {
  /** Rendered text. Missing placeholders remain verbatim (`{{name}}`). */
  text: string;
  /** Distinct placeholder names that could not be resolved. */
  missing: string[];
}

/** Distinct placeholder names referenced by a template, in first-seen order. */
export function extractPlaceholders(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    names.add(match[1]!);
  }
  return [...names];
}

/**
 * Substitute `{{name}}` tokens with `values[name]`.
 * `undefined`, `null`, and empty-string values count as missing.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
): TemplateRenderResult {
  const missing = new Set<string>();

  const text = template.replace(PLACEHOLDER_RE, (raw, name: string) => {
    const value = values[name];
    if (value === undefined || value === null || value === "") {
      missing.add(name);
      return raw;
    }
    return String(value);
  });

  return { text, missing: [...missing] };
}

// ─── Employee 201 placeholder vocabulary ─────────────────────────────────────

export interface EmployeePlaceholderSource {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  employeeNo: string;
  positionTitle: string;
  officeName?: string | null;
  salaryGrade?: number | null;
  step?: number | null;
  /** Monthly basic salary in PHP (resolved by the caller from salary_grades). */
  monthlySalary?: number | null;
  /** ISO date string (YYYY-MM-DD). */
  dateHired?: string | null;
  appointmentType?: string | null;
  civilStatus?: string | null;
}

export interface PlaceholderContext {
  agencyName?: string | null;
  purpose?: string | null;
  /** Injectable clock for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

/** "January 5, 2026" — en-PH long date, used across generated documents. */
export function formatLongDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "PHP 51,357.00" */
export function formatPhp(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "First M. Last Suffix" */
export function composeFullName(source: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
}): string {
  return [
    source.firstName,
    source.middleName ? `${source.middleName.charAt(0)}.` : "",
    source.lastName,
    source.suffix ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the full placeholder vocabulary from an employee 201 snapshot.
 *
 * Vocabulary: full_name, first_name, middle_initial, last_name, position,
 * office, employee_number, salary, salary_grade, step, date_hired,
 * appointment_type, civil_status, current_date, agency_name, purpose.
 */
export function buildEmployeePlaceholderValues(
  employee: EmployeePlaceholderSource,
  context: PlaceholderContext = {},
): Record<string, string> {
  const now = context.now ?? new Date();

  const values: Record<string, string> = {
    full_name: composeFullName(employee),
    first_name: employee.firstName,
    middle_initial: employee.middleName
      ? `${employee.middleName.charAt(0)}.`
      : "",
    last_name: employee.lastName,
    position: employee.positionTitle,
    office: employee.officeName ?? "",
    employee_number: employee.employeeNo,
    salary:
      employee.monthlySalary != null ? formatPhp(employee.monthlySalary) : "",
    salary_grade:
      employee.salaryGrade != null ? String(employee.salaryGrade) : "",
    step: employee.step != null ? String(employee.step) : "",
    date_hired: employee.dateHired ? formatLongDate(employee.dateHired) : "",
    appointment_type: employee.appointmentType
      ? titleCase(employee.appointmentType)
      : "",
    civil_status: employee.civilStatus ? titleCase(employee.civilStatus) : "",
    current_date: formatLongDate(now),
    agency_name: context.agencyName ?? "",
    purpose: context.purpose ?? "",
  };

  return values;
}
