/**
 * PDS (CS Form 212) pure mapper — employee 201 rows → PdsFormPdf props.
 *
 * Factored out of the PDS generator server action so the mapping logic is
 * unit-testable without a database or @react-pdf runtime (all imports from
 * the PDF component are type-only and erased at compile time).
 */

import type {
  PdsFormPdfProps,
  PdsWorkExperienceRow,
  PdsTrainingRow,
  PdsSpouseInfo,
  PdsChildRow,
  PdsEducationRow,
  PdsEligibilityRow,
  PdsVoluntaryWorkRow,
  PdsQuestionAnswer,
  PdsGovernmentIdInfo,
} from "@/components/pdf/pds-form";
import { PDS_QUESTIONS } from "./pds-questions";

// ─── Source row shapes (structural subsets of the Drizzle select models) ─────

export interface PdsEmployeeSource {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  dualCitizenshipType?: string | null;
  dualCitizenshipCountry?: string | null;
  religion?: string | null;
  bloodType?: string | null;
  heightM?: string | null;
  weightKg?: string | null;
  tin?: string | null;
  gsisNo?: string | null;
  philhealthNo?: string | null;
  pagibigNo?: string | null;
  sssNo?: string | null;
  employeeNo: string;
  email?: string | null;
  phone?: string | null;
  telephoneNo?: string | null;
  addressStreet?: string | null;
  addressBarangay?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressZipCode?: string | null;
  permanentAddressStreet?: string | null;
  permanentAddressBarangay?: string | null;
  permanentAddressCity?: string | null;
  permanentAddressProvince?: string | null;
  permanentAddressZipCode?: string | null;
  specialSkillsHobbies?: {
    skills?: string[] | null;
    hobbies?: string[] | null;
  } | null;
  nonAcademicDistinctions?: string[] | null;
  organizationMemberships?: string[] | null;
  pdsQuestionnaire?: Record<
    string,
    { answer: boolean; details?: string | null }
  > | null;
  governmentIssuedId?: {
    idType?: string | null;
    idNo?: string | null;
    dateIssued?: string | null;
    placeIssued?: string | null;
  } | null;
}

export interface PdsFamilyMemberSource {
  memberType: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extensionName?: string | null;
  birthDate?: string | null;
  occupation?: string | null;
  employerName?: string | null;
  employerAddress?: string | null;
  telephoneNo?: string | null;
  sortOrder?: number | null;
}

export interface PdsEducationSource {
  level: string;
  schoolName: string;
  degreeCourse?: string | null;
  attendanceFrom?: string | null;
  attendanceTo?: string | null;
  highestLevelUnits?: string | null;
  yearGraduated?: string | null;
  honorsReceived?: string | null;
  sortOrder?: number | null;
}

export interface PdsEligibilitySource {
  eligibilityName: string;
  rating?: string | null;
  examDate?: string | null;
  examPlace?: string | null;
  licenseNo?: string | null;
  licenseValidity?: string | null;
}

export interface PdsWorkExperienceSource {
  dateFrom: string;
  dateTo?: string | null;
  positionTitle: string;
  companyName: string;
  monthlySalary?: string | null;
  salaryGradeStep?: string | null;
  statusOfAppointment?: string | null;
  isGovernmentService?: boolean | null;
}

export interface PdsAppointmentSource {
  effectivityDate: string;
  endDate?: string | null;
  positionTitle: string;
  salaryGrade: number;
  step: number;
  monthlySalary?: string | null;
  appointmentType: string;
}

export interface PdsVoluntaryWorkSource {
  organizationName: string;
  organizationAddress?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  numberOfHours?: number | null;
  positionNature?: string | null;
}

export interface PdsExternalTrainingSource {
  title: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Drizzle numeric column — string. */
  numberOfHours?: string | null;
  conductedBy?: string | null;
}

export interface BuildPdsFormPropsParams {
  employee: PdsEmployeeSource;
  agencyName: string;
  familyMembers: PdsFamilyMemberSource[];
  education: PdsEducationSource[];
  eligibilities: PdsEligibilitySource[];
  externalWorkExperiences: PdsWorkExperienceSource[];
  appointments: PdsAppointmentSource[];
  voluntaryWorks: PdsVoluntaryWorkSource[];
  externalTrainings: PdsExternalTrainingSource[];
  /** Already-shaped LDM (in-house) training participation rows. */
  ldmTrainings: PdsTrainingRow[];
}

export type PdsFormData = Omit<PdsFormPdfProps, "serialNumber" | "generatedAt">;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EDUCATION_LEVEL_ORDER = [
  "elementary",
  "secondary",
  "vocational",
  "college",
  "graduate_studies",
] as const;

const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  elementary: "Elementary",
  secondary: "Secondary",
  vocational: "Vocational / Trade Course",
  college: "College",
  graduate_studies: "Graduate Studies",
};

/** Humanize a snake_case enum value for the official-form face. */
export function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fullName(member: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  extensionName?: string | null;
}): string {
  const base = [member.firstName, member.middleName, member.lastName]
    .filter(Boolean)
    .join(" ");
  return member.extensionName ? `${base}, ${member.extensionName}` : base;
}

function toNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function bySortOrder(
  a: { sortOrder?: number | null },
  b: { sortOrder?: number | null },
): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

/** Descending ISO-date sort; null/empty dates sink to the bottom. */
function byFromDateDesc(
  a: { from: string | null },
  b: { from: string | null },
): number {
  if (!a.from && !b.from) return 0;
  if (!a.from) return 1;
  if (!b.from) return -1;
  return b.from.localeCompare(a.from);
}

/** Citizenship display incl. dual-citizenship acquisition detail. */
export function formatCitizenship(employee: {
  nationality?: string | null;
  dualCitizenshipType?: string | null;
  dualCitizenshipCountry?: string | null;
}): string {
  const base = employee.nationality?.trim() || "Filipino";
  if (!employee.dualCitizenshipType) return base;
  const kind =
    employee.dualCitizenshipType === "by_naturalization"
      ? "by naturalization"
      : "by birth";
  const country = employee.dualCitizenshipCountry
    ? ` — ${employee.dualCitizenshipCountry}`
    : "";
  return `${base} / Dual Citizenship (${kind})${country}`;
}

// ─── Section mappers ──────────────────────────────────────────────────────────

interface FamilySections {
  spouse: PdsSpouseInfo | null;
  fatherName: string | null;
  motherName: string | null;
  children: PdsChildRow[];
}

export function mapFamilyMembers(
  members: PdsFamilyMemberSource[],
): FamilySections {
  const sorted = [...members].sort(bySortOrder);

  const spouseRow = sorted.find((m) => m.memberType === "spouse") ?? null;
  const father = sorted.find((m) => m.memberType === "father") ?? null;
  const mother = sorted.find((m) => m.memberType === "mother") ?? null;

  const children: PdsChildRow[] = sorted
    .filter((m) => m.memberType === "child")
    .map((m) => ({
      fullName: fullName(m),
      birthDate: m.birthDate ?? null,
    }));

  return {
    spouse: spouseRow
      ? {
          fullName: fullName(spouseRow),
          occupation: spouseRow.occupation ?? null,
          employerName: spouseRow.employerName ?? null,
          employerAddress: spouseRow.employerAddress ?? null,
          telephoneNo: spouseRow.telephoneNo ?? null,
        }
      : null,
    fatherName: father ? fullName(father) : null,
    motherName: mother ? fullName(mother) : null,
    children,
  };
}

/**
 * One display row per education record, grouped in official level order
 * (Elementary → Graduate Studies). Levels with no record still emit a
 * labeled blank row, matching the fixed rows of the printed form.
 */
export function mapEducation(rows: PdsEducationSource[]): PdsEducationRow[] {
  const out: PdsEducationRow[] = [];
  for (const level of EDUCATION_LEVEL_ORDER) {
    const label = EDUCATION_LEVEL_LABELS[level] ?? humanize(level);
    const matches = rows.filter((r) => r.level === level).sort(bySortOrder);
    if (matches.length === 0) {
      out.push({
        level: label,
        schoolName: null,
        degreeCourse: null,
        attendanceFrom: null,
        attendanceTo: null,
        unitsEarned: null,
        yearGraduated: null,
        honorsReceived: null,
      });
      continue;
    }
    for (const r of matches) {
      out.push({
        level: label,
        schoolName: r.schoolName,
        degreeCourse: r.degreeCourse ?? null,
        attendanceFrom: r.attendanceFrom ?? null,
        attendanceTo: r.attendanceTo ?? null,
        unitsEarned: r.highestLevelUnits ?? null,
        yearGraduated: r.yearGraduated ?? null,
        honorsReceived: r.honorsReceived ?? null,
      });
    }
  }
  return out;
}

export function mapEligibilities(
  rows: PdsEligibilitySource[],
): PdsEligibilityRow[] {
  return rows.map((r) => ({
    name: r.eligibilityName,
    rating: r.rating ?? null,
    examDate: r.examDate ?? null,
    examPlace: r.examPlace ?? null,
    licenseNo: r.licenseNo ?? null,
    licenseValidity: r.licenseValidity ?? null,
  }));
}

/**
 * Section V — merge externally-declared work experience with authoritative
 * PCSO appointment history, most recent first.
 */
export function mapWorkExperience(
  external: PdsWorkExperienceSource[],
  appointments: PdsAppointmentSource[],
  agencyName: string,
): PdsWorkExperienceRow[] {
  const externalRows: PdsWorkExperienceRow[] = external.map((r) => ({
    from: r.dateFrom,
    to: r.dateTo ?? null,
    positionTitle: r.positionTitle,
    agency: r.companyName,
    monthlySalary: toNumber(r.monthlySalary),
    gradeStep: r.salaryGradeStep ?? null,
    statusOfAppointment: r.statusOfAppointment ?? "",
    isGovService: r.isGovernmentService ?? false,
  }));

  const pcsoRows: PdsWorkExperienceRow[] = appointments.map((a) => ({
    from: a.effectivityDate,
    to: a.endDate ?? null,
    positionTitle: a.positionTitle,
    agency: agencyName,
    monthlySalary: toNumber(a.monthlySalary),
    gradeStep: `${a.salaryGrade}-${a.step}`,
    statusOfAppointment: humanize(a.appointmentType),
    isGovService: true,
  }));

  return [...externalRows, ...pcsoRows].sort(byFromDateDesc);
}

export function mapVoluntaryWorks(
  rows: PdsVoluntaryWorkSource[],
): PdsVoluntaryWorkRow[] {
  return rows.map((r) => ({
    organization: r.organizationName,
    address: r.organizationAddress ?? null,
    from: r.dateFrom ?? null,
    to: r.dateTo ?? null,
    hours: r.numberOfHours ?? null,
    position: r.positionNature ?? null,
  }));
}

/**
 * Section VII — merge externally-declared trainings with LDM (in-house)
 * participation rows, most recent first.
 */
export function mapTrainings(
  external: PdsExternalTrainingSource[],
  ldmTrainings: PdsTrainingRow[],
): PdsTrainingRow[] {
  const externalRows: PdsTrainingRow[] = external.map((r) => ({
    title: r.title,
    from: r.dateFrom ?? null,
    to: r.dateTo ?? null,
    hours: toNumber(r.numberOfHours),
    conductedBy: r.conductedBy ?? null,
  }));

  return [...externalRows, ...ldmTrainings].sort(byFromDateDesc);
}

/**
 * Page-4 questions 34–40. Every canonical key is emitted; unanswered
 * questions carry `answer: null` so the PDF prints empty parentheses.
 */
export function mapQuestionnaire(
  stored:
    | Record<string, { answer: boolean; details?: string | null }>
    | null
    | undefined,
): Record<string, PdsQuestionAnswer> {
  const out: Record<string, PdsQuestionAnswer> = {};
  for (const q of PDS_QUESTIONS) {
    const entry = stored?.[q.key];
    out[q.key] = entry
      ? { answer: entry.answer, details: entry.details ?? null }
      : { answer: null, details: null };
  }
  return out;
}

function mapGovernmentId(
  stored: PdsEmployeeSource["governmentIssuedId"],
): PdsGovernmentIdInfo | null {
  if (!stored) return null;
  const info: PdsGovernmentIdInfo = {
    idType: stored.idType ?? null,
    idNo: stored.idNo ?? null,
    dateIssued: stored.dateIssued ?? null,
    placeIssued: stored.placeIssued ?? null,
  };
  const hasAny = Object.values(info).some(Boolean);
  return hasAny ? info : null;
}

// ─── Top-level mapper ─────────────────────────────────────────────────────────

export function buildPdsFormProps(
  params: BuildPdsFormPropsParams,
): PdsFormData {
  const { employee, agencyName } = params;
  const family = mapFamilyMembers(params.familyMembers);

  return {
    agencyName,
    employee: {
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName ?? null,
      suffix: employee.suffix ?? null,
      birthDate: employee.birthDate ?? null,
      placeOfBirth: employee.placeOfBirth ?? null,
      gender: employee.gender ?? null,
      civilStatus: employee.civilStatus ?? null,
      nationality: employee.nationality ?? null,
      citizenshipDisplay: formatCitizenship(employee),
      religion: employee.religion ?? null,
      bloodType: employee.bloodType ?? null,
      heightM: employee.heightM ?? null,
      weightKg: employee.weightKg ?? null,
      tin: employee.tin ?? null,
      gsisNo: employee.gsisNo ?? null,
      philhealthNo: employee.philhealthNo ?? null,
      pagibigNo: employee.pagibigNo ?? null,
      sssNo: employee.sssNo ?? null,
      employeeNo: employee.employeeNo,
      email: employee.email ?? null,
      phone: employee.phone ?? null,
      telephoneNo: employee.telephoneNo ?? null,
      addressStreet: employee.addressStreet ?? null,
      addressBarangay: employee.addressBarangay ?? null,
      addressCity: employee.addressCity ?? null,
      addressProvince: employee.addressProvince ?? null,
      addressZipCode: employee.addressZipCode ?? null,
      permanentAddressStreet: employee.permanentAddressStreet ?? null,
      permanentAddressBarangay: employee.permanentAddressBarangay ?? null,
      permanentAddressCity: employee.permanentAddressCity ?? null,
      permanentAddressProvince: employee.permanentAddressProvince ?? null,
      permanentAddressZipCode: employee.permanentAddressZipCode ?? null,
    },
    spouse: family.spouse,
    fatherName: family.fatherName,
    motherName: family.motherName,
    children: family.children,
    education: mapEducation(params.education),
    eligibilities: mapEligibilities(params.eligibilities),
    workExperience: mapWorkExperience(
      params.externalWorkExperiences,
      params.appointments,
      agencyName,
    ),
    voluntaryWorks: mapVoluntaryWorks(params.voluntaryWorks),
    trainings: mapTrainings(params.externalTrainings, params.ldmTrainings),
    skills: employee.specialSkillsHobbies?.skills ?? [],
    hobbies: employee.specialSkillsHobbies?.hobbies ?? [],
    distinctions: employee.nonAcademicDistinctions ?? [],
    memberships: employee.organizationMemberships ?? [],
    questionnaire: mapQuestionnaire(employee.pdsQuestionnaire),
    governmentId: mapGovernmentId(employee.governmentIssuedId),
  };
}
