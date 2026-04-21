/**
 * Shape the data needed to render CSC Form 9 — Publication of Vacant Position.
 *
 * Pure function. No I/O. Consumers (server actions) must load the rows
 * first, then call `buildCscForm9Data`.
 *
 * PRD RPM-005 / FM-022. CSC MC No. 24, s. 2017.
 */

export interface VacancyInput {
  id: string;
  itemNumber: string;
  positionTitle: string;
  salaryGrade: number;
  monthlySalary: string | number;
  placeOfAssignment: string | null;
  applicationDeadline: string | Date | null;
  publishedAt: string | Date | null;
  cscForm9Number: string | null;
  qualificationStandards: QualificationStandardsInput | null;
}

export interface MrfInput {
  id: string;
  mrfNumber: string | null;
  justification: string | null;
}

export interface PositionInput {
  title: string;
  itemNumber: string;
  salaryGrade: number;
}

export interface OfficeInput {
  name: string;
  code: string;
}

export interface OrgProfileInput {
  agencyName: string;
  agencyAddress: string;
  agencyLogoUrl: string | null;
}

export interface QualificationStandardsInput {
  education: string;
  training: string;
  experience: string;
  eligibility: string;
  competencies?: string | null;
}

export interface CscForm9Data {
  agencyName: string;
  agencyAddress: string;
  agencyLogoUrl: string | null;
  cscForm9Number: string;
  publishedAt: string;
  applicationDeadline: string;
  mrfNumber: string;
  position: {
    title: string;
    itemNumber: string;
    salaryGrade: number;
    monthlySalaryPhp: string;
    placeOfAssignment: string;
  };
  qualificationStandards: {
    education: string;
    training: string;
    experience: string;
    eligibility: string;
    competencies: string;
  };
  justification: string;
}

const DEFAULT_AGENCY_NAME = "Philippine Charity Sweepstakes Office";
const DEFAULT_AGENCY_ADDRESS = "PCSO Main Office, Quezon City, Philippines";
const NOT_SPECIFIED = "Not specified";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return NOT_SPECIFIED;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return NOT_SPECIFIED;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return NOT_SPECIFIED;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export interface BuildCscForm9DataInput {
  vacancy: VacancyInput;
  mrf: MrfInput;
  position: PositionInput;
  office: OfficeInput;
  orgProfile?: OrgProfileInput | null;
  qualificationStandardsOverride?: QualificationStandardsInput | null;
}

export function buildCscForm9Data(input: BuildCscForm9DataInput): CscForm9Data {
  const { vacancy, mrf, position, office, orgProfile } = input;
  const qs = input.qualificationStandardsOverride ??
    vacancy.qualificationStandards ?? {
      education: NOT_SPECIFIED,
      training: NOT_SPECIFIED,
      experience: NOT_SPECIFIED,
      eligibility: NOT_SPECIFIED,
      competencies: null,
    };

  return {
    agencyName: orgProfile?.agencyName ?? DEFAULT_AGENCY_NAME,
    agencyAddress: orgProfile?.agencyAddress ?? DEFAULT_AGENCY_ADDRESS,
    agencyLogoUrl: orgProfile?.agencyLogoUrl ?? null,
    cscForm9Number: vacancy.cscForm9Number ?? "PENDING",
    publishedAt: formatDate(vacancy.publishedAt),
    applicationDeadline: formatDate(vacancy.applicationDeadline),
    mrfNumber: mrf.mrfNumber ?? "PENDING",
    position: {
      title: position.title || vacancy.positionTitle,
      itemNumber: position.itemNumber || vacancy.itemNumber,
      salaryGrade: position.salaryGrade || vacancy.salaryGrade,
      monthlySalaryPhp: formatCurrency(vacancy.monthlySalary),
      placeOfAssignment: vacancy.placeOfAssignment ?? office.name,
    },
    qualificationStandards: {
      education: qs.education || NOT_SPECIFIED,
      training: qs.training || NOT_SPECIFIED,
      experience: qs.experience || NOT_SPECIFIED,
      eligibility: qs.eligibility || NOT_SPECIFIED,
      competencies: qs.competencies ?? NOT_SPECIFIED,
    },
    justification: mrf.justification ?? NOT_SPECIFIED,
  };
}
