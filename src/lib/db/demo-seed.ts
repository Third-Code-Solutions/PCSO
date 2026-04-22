/**
 * Demo Data Seed Script — PCSO HRIS
 *
 * Usage: npm run db:seed-demo
 *
 * Idempotent — upserts by natural key so re-runs are safe.
 * Seed order respects FK dependencies.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "./schema";

// ─── DB Connection ─────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 60,
  connect_timeout: 30,
  // Supabase pooler (pgbouncer) at port 6543 imposes a statement_timeout.
  // We set a higher idle_timeout and rely on smaller batches to stay under it.
  prepare: false, // required for pgbouncer in transaction mode
});
const db = drizzle(client, { schema });

// ─── Helpers ───────────────────────────────────────────────────────────────────

function log(section: string, count: number): void {
  console.log(`  [${section}] seeded ${count} row(s)`);
}

/**
 * Return a date string YYYY-MM-DD for (today - offsetDays).
 */
function dateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function currentYear(): number {
  return new Date().getFullYear();
}

// ─── 1. Offices ────────────────────────────────────────────────────────────────

async function seedOffices(): Promise<Record<string, string>> {
  // PCSO office hierarchy (PRD §P0-005). Codes retained as natural keys
  // (OSP/COF/COJHR/OSEC/OSAA) to keep demo-seed FK integrity intact; the
  // user-visible names map to PCSO's sectors, head office, and branches.
  const officeData = [
    {
      name: "Head Office",
      code: "OSP",
      type: "office" as const,
      parentCode: null,
    },
    {
      name: "Charity Sector",
      code: "COF",
      type: "department" as const,
      parentCode: "OSP",
    },
    {
      name: "Management Services Sector",
      code: "COJHR",
      type: "department" as const,
      parentCode: "OSP",
    },
    {
      name: "Branch – NCL",
      code: "OSEC",
      type: "office" as const,
      parentCode: null,
    },
    {
      name: "Branch – Visayas",
      code: "OSAA",
      type: "office" as const,
      parentCode: null,
    },
  ];

  // First pass — insert without parentId
  const idMap: Record<string, string> = {};
  for (const o of officeData) {
    const existing = await db
      .select({ id: schema.offices.id })
      .from(schema.offices)
      .where(eq(schema.offices.code, o.code))
      .limit(1);

    if (existing.length === 0) {
      const [row] = await db
        .insert(schema.offices)
        .values({ name: o.name, code: o.code, type: o.type })
        .returning({ id: schema.offices.id });
      idMap[o.code] = row!.id;
    } else {
      idMap[o.code] = existing[0]!.id;
    }
  }

  // Second pass — set parentId where applicable
  for (const o of officeData) {
    if (o.parentCode && idMap[o.parentCode]) {
      await db
        .update(schema.offices)
        .set({ parentId: idMap[o.parentCode] })
        .where(eq(schema.offices.code, o.code));
    }
  }

  log("offices", officeData.length);
  return idMap;
}

// ─── 2. Employees ──────────────────────────────────────────────────────────────

async function seedEmployees(
  officeIds: Record<string, string>,
): Promise<Record<string, string>> {
  const employeeData = [
    // OSP
    {
      employeeNo: "EMP-2026-00001",
      firstName: "Rodrigo",
      middleName: "Santos",
      lastName: "Dela Cruz",
      birthDate: "1975-03-15",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Director IV",
      salaryGrade: 27,
      step: 4,
      officeCode: "OSP",
      dateHired: "2002-06-01",
      dateRegularized: "2003-06-01",
      status: "active" as const,
      email: "rdelacruz@pcso.gov.ph",
      phone: "09171234501",
      tin: "123-456-789-001",
      gsisNo: "GSIS-2002-001",
      philhealthNo: "PH-123456001",
      pagibigNo: "PAG-123456001",
      addressCity: "Pasay City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00002",
      firstName: "Maria",
      middleName: "Reyes",
      lastName: "Santos",
      birthDate: "1980-07-22",
      gender: "female" as const,
      civilStatus: "single" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Administrative Officer V",
      salaryGrade: 22,
      step: 3,
      officeCode: "OSP",
      dateHired: "2008-03-10",
      dateRegularized: "2009-03-10",
      status: "active" as const,
      email: "msantos@pcso.gov.ph",
      phone: "09171234502",
      tin: "123-456-789-002",
      gsisNo: "GSIS-2008-002",
      philhealthNo: "PH-123456002",
      pagibigNo: "PAG-123456002",
      addressCity: "Quezon City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00003",
      firstName: "Jose",
      middleName: "Bautista",
      lastName: "Mendoza",
      birthDate: "1985-11-30",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Clerk III",
      salaryGrade: 9,
      step: 2,
      officeCode: "OSP",
      dateHired: "2015-01-05",
      dateRegularized: "2016-01-05",
      status: "active" as const,
      email: "jmendoza@pcso.gov.ph",
      phone: "09171234503",
      tin: "123-456-789-003",
      gsisNo: "GSIS-2015-003",
      philhealthNo: "PH-123456003",
      pagibigNo: "PAG-123456003",
      addressCity: "Mandaluyong City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00004",
      firstName: "Lourdes",
      middleName: "Cruz",
      lastName: "Villanueva",
      birthDate: "1978-05-18",
      gender: "female" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Attorney IV",
      salaryGrade: 24,
      step: 5,
      officeCode: "OSP",
      dateHired: "2005-09-15",
      dateRegularized: "2006-09-15",
      status: "active" as const,
      email: "lvillanueva@pcso.gov.ph",
      phone: "09171234504",
      tin: "123-456-789-004",
      gsisNo: "GSIS-2005-004",
      philhealthNo: "PH-123456004",
      pagibigNo: "PAG-123456004",
      addressCity: "Makati City",
      addressProvince: "Metro Manila",
    },
    // COF
    {
      employeeNo: "EMP-2026-00005",
      firstName: "Ramon",
      middleName: "Aquino",
      lastName: "Castillo",
      birthDate: "1972-09-08",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "coterminous" as const,
      positionTitle: "Budget and Financial Officer III",
      salaryGrade: 19,
      step: 6,
      officeCode: "COF",
      dateHired: "2010-07-01",
      dateRegularized: null,
      status: "active" as const,
      email: "rcastillo@pcso.gov.ph",
      phone: "09171234505",
      tin: "123-456-789-005",
      gsisNo: "GSIS-2010-005",
      philhealthNo: "PH-123456005",
      pagibigNo: "PAG-123456005",
      addressCity: "Taguig City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00006",
      firstName: "Ana",
      middleName: "Lopez",
      lastName: "Garcia",
      birthDate: "1990-02-14",
      gender: "female" as const,
      civilStatus: "single" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Budget and Financial Officer I",
      salaryGrade: 13,
      step: 1,
      officeCode: "COF",
      dateHired: "2020-08-01",
      dateRegularized: "2021-08-01",
      status: "active" as const,
      email: "agarcia@pcso.gov.ph",
      phone: "09171234506",
      tin: "123-456-789-006",
      gsisNo: "GSIS-2020-006",
      philhealthNo: "PH-123456006",
      pagibigNo: "PAG-123456006",
      addressCity: "Parañaque City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00007",
      firstName: "Benjamin",
      middleName: "Torres",
      lastName: "Ramos",
      birthDate: "1983-06-25",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "casual" as const,
      positionTitle: "Data Entry Clerk",
      salaryGrade: 5,
      step: 1,
      officeCode: "COF",
      dateHired: "2023-01-02",
      dateRegularized: null,
      status: "active" as const,
      email: "bramos@pcso.gov.ph",
      phone: "09171234507",
      tin: "123-456-789-007",
      gsisNo: null,
      philhealthNo: "PH-123456007",
      pagibigNo: "PAG-123456007",
      addressCity: "Las Pinas City",
      addressProvince: "Metro Manila",
    },
    // COJHR
    {
      employeeNo: "EMP-2026-00008",
      firstName: "Cecilia",
      middleName: "Flores",
      lastName: "Hernandez",
      birthDate: "1976-12-03",
      gender: "female" as const,
      civilStatus: "widowed" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Attorney V",
      salaryGrade: 25,
      step: 3,
      officeCode: "COJHR",
      dateHired: "2003-11-01",
      dateRegularized: "2004-11-01",
      status: "active" as const,
      email: "chernandez@pcso.gov.ph",
      phone: "09171234508",
      tin: "123-456-789-008",
      gsisNo: "GSIS-2003-008",
      philhealthNo: "PH-123456008",
      pagibigNo: "PAG-123456008",
      addressCity: "Muntinlupa City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00009",
      firstName: "Eduardo",
      middleName: "Reyes",
      lastName: "Ocampo",
      birthDate: "1988-04-10",
      gender: "male" as const,
      civilStatus: "single" as const,
      appointmentType: "coterminous" as const,
      positionTitle: "Legislative Staff Officer I",
      salaryGrade: 16,
      step: 2,
      officeCode: "COJHR",
      dateHired: "2019-06-15",
      dateRegularized: null,
      status: "active" as const,
      email: "eocampo@pcso.gov.ph",
      phone: "09171234509",
      tin: "123-456-789-009",
      gsisNo: "GSIS-2019-009",
      philhealthNo: "PH-123456009",
      pagibigNo: "PAG-123456009",
      addressCity: "Marikina City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00010",
      firstName: "Rosario",
      middleName: "Dela Rosa",
      lastName: "Pascual",
      birthDate: "1992-08-20",
      gender: "female" as const,
      civilStatus: "single" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Records Officer I",
      salaryGrade: 10,
      step: 1,
      officeCode: "COJHR",
      dateHired: "2022-02-14",
      dateRegularized: "2023-02-14",
      status: "active" as const,
      email: "rpascual@pcso.gov.ph",
      phone: "09171234510",
      tin: "123-456-789-010",
      gsisNo: "GSIS-2022-010",
      philhealthNo: "PH-123456010",
      pagibigNo: "PAG-123456010",
      addressCity: "Valenzuela City",
      addressProvince: "Metro Manila",
    },
    // OSEC
    {
      employeeNo: "EMP-2026-00011",
      firstName: "Alfredo",
      middleName: "Manalo",
      lastName: "Gutierrez",
      birthDate: "1970-01-25",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Assistant Secretary",
      salaryGrade: 27,
      step: 8,
      officeCode: "OSEC",
      dateHired: "1998-04-01",
      dateRegularized: "1999-04-01",
      status: "active" as const,
      email: "agutierrez@pcso.gov.ph",
      phone: "09171234511",
      tin: "123-456-789-011",
      gsisNo: "GSIS-1998-011",
      philhealthNo: "PH-123456011",
      pagibigNo: "PAG-123456011",
      addressCity: "San Juan City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00012",
      firstName: "Natividad",
      middleName: "Cruz",
      lastName: "Evangelista",
      birthDate: "1982-03-08",
      gender: "female" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Administrative Officer III",
      salaryGrade: 18,
      step: 4,
      officeCode: "OSEC",
      dateHired: "2007-05-20",
      dateRegularized: "2008-05-20",
      status: "active" as const,
      email: "nevangelista@pcso.gov.ph",
      phone: "09171234512",
      tin: "123-456-789-012",
      gsisNo: "GSIS-2007-012",
      philhealthNo: "PH-123456012",
      pagibigNo: "PAG-123456012",
      addressCity: "Malabon City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00013",
      firstName: "Carlo",
      middleName: "Abad",
      lastName: "Domingo",
      birthDate: "1995-10-05",
      gender: "male" as const,
      civilStatus: "single" as const,
      appointmentType: "job_order" as const,
      positionTitle: "IT Support Specialist",
      salaryGrade: 8,
      step: 1,
      officeCode: "OSEC",
      dateHired: "2024-01-15",
      dateRegularized: null,
      status: "active" as const,
      email: "cdomingo@pcso.gov.ph",
      phone: "09171234513",
      tin: "123-456-789-013",
      gsisNo: null,
      philhealthNo: "PH-123456013",
      pagibigNo: "PAG-123456013",
      addressCity: "Navotas City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00014",
      firstName: "Gloria",
      middleName: "Cabrera",
      lastName: "Luna",
      birthDate: "1979-07-11",
      gender: "female" as const,
      civilStatus: "legally_separated" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Librarian II",
      salaryGrade: 14,
      step: 6,
      officeCode: "OSEC",
      dateHired: "2004-10-01",
      dateRegularized: "2005-10-01",
      status: "active" as const,
      email: "gluna@pcso.gov.ph",
      phone: "09171234514",
      tin: "123-456-789-014",
      gsisNo: "GSIS-2004-014",
      philhealthNo: "PH-123456014",
      pagibigNo: "PAG-123456014",
      addressCity: "Caloocan City",
      addressProvince: "Metro Manila",
    },
    // OSAA
    {
      employeeNo: "EMP-2026-00015",
      firstName: "Ricardo",
      middleName: "Buenaventura",
      lastName: "Fernandez",
      birthDate: "1968-11-15",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Security Officer IV",
      salaryGrade: 20,
      step: 7,
      officeCode: "OSAA",
      dateHired: "1995-08-01",
      dateRegularized: "1996-08-01",
      status: "active" as const,
      email: "rfernandez@pcso.gov.ph",
      phone: "09171234515",
      tin: "123-456-789-015",
      gsisNo: "GSIS-1995-015",
      philhealthNo: "PH-123456015",
      pagibigNo: "PAG-123456015",
      addressCity: "Manila City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00016",
      firstName: "Maricel",
      middleName: "Navarro",
      lastName: "Tolentino",
      birthDate: "1991-05-28",
      gender: "female" as const,
      civilStatus: "single" as const,
      appointmentType: "casual" as const,
      positionTitle: "Security Guard II",
      salaryGrade: 6,
      step: 2,
      officeCode: "OSAA",
      dateHired: "2021-03-01",
      dateRegularized: null,
      status: "active" as const,
      email: "mtolentino@pcso.gov.ph",
      phone: "09171234516",
      tin: "123-456-789-016",
      gsisNo: null,
      philhealthNo: "PH-123456016",
      pagibigNo: "PAG-123456016",
      addressCity: "Pasig City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00017",
      firstName: "Danilo",
      middleName: "Salazar",
      lastName: "Belen",
      birthDate: "1987-09-14",
      gender: "male" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Administrative Aide IV",
      salaryGrade: 7,
      step: 3,
      officeCode: "OSAA",
      dateHired: "2013-06-01",
      dateRegularized: "2014-06-01",
      status: "active" as const,
      email: "dbelen@pcso.gov.ph",
      phone: "09171234517",
      tin: "123-456-789-017",
      gsisNo: "GSIS-2013-017",
      philhealthNo: "PH-123456017",
      pagibigNo: "PAG-123456017",
      addressCity: "Pateros",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00018",
      firstName: "Teresita",
      middleName: "Padua",
      lastName: "Quisumbing",
      birthDate: "1973-04-02",
      gender: "female" as const,
      civilStatus: "married" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Nurse II",
      salaryGrade: 15,
      step: 5,
      officeCode: "OSAA",
      dateHired: "2001-02-14",
      dateRegularized: "2002-02-14",
      status: "active" as const,
      email: "tquisumbing@pcso.gov.ph",
      phone: "09171234518",
      tin: "123-456-789-018",
      gsisNo: "GSIS-2001-018",
      philhealthNo: "PH-123456018",
      pagibigNo: "PAG-123456018",
      addressCity: "Antipolo City",
      addressProvince: "Rizal",
    },
    {
      employeeNo: "EMP-2026-00019",
      firstName: "Michael",
      middleName: "Santiago",
      lastName: "Aguilar",
      birthDate: "1996-01-17",
      gender: "male" as const,
      civilStatus: "single" as const,
      appointmentType: "job_order" as const,
      positionTitle: "Driver I",
      salaryGrade: 5,
      step: 1,
      officeCode: "OSAA",
      dateHired: "2025-01-02",
      dateRegularized: null,
      status: "active" as const,
      email: "maguilar@pcso.gov.ph",
      phone: "09171234519",
      tin: "123-456-789-019",
      gsisNo: null,
      philhealthNo: "PH-123456019",
      pagibigNo: "PAG-123456019",
      addressCity: "Pasay City",
      addressProvince: "Metro Manila",
    },
    {
      employeeNo: "EMP-2026-00020",
      firstName: "Leonora",
      middleName: "Jimenez",
      lastName: "Soriano",
      birthDate: "1984-08-30",
      gender: "female" as const,
      civilStatus: "annulled" as const,
      appointmentType: "permanent" as const,
      positionTitle: "Human Resource Management Officer III",
      salaryGrade: 18,
      step: 2,
      officeCode: "OSP",
      dateHired: "2011-09-01",
      dateRegularized: "2012-09-01",
      status: "active" as const,
      email: "lsoriano@pcso.gov.ph",
      phone: "09171234520",
      tin: "123-456-789-020",
      gsisNo: "GSIS-2011-020",
      philhealthNo: "PH-123456020",
      pagibigNo: "PAG-123456020",
      addressCity: "Quezon City",
      addressProvince: "Metro Manila",
    },
  ];

  const idMap: Record<string, string> = {};

  for (const e of employeeData) {
    const existing = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(eq(schema.employees.employeeNo, e.employeeNo))
      .limit(1);

    if (existing.length > 0) {
      idMap[e.employeeNo] = existing[0]!.id;
      continue;
    }

    const officeId = officeIds[e.officeCode];
    const [row] = await db
      .insert(schema.employees)
      .values({
        employeeNo: e.employeeNo,
        firstName: e.firstName,
        middleName: e.middleName,
        lastName: e.lastName,
        birthDate: e.birthDate,
        gender: e.gender,
        civilStatus: e.civilStatus,
        nationality: "Filipino",
        appointmentType: e.appointmentType,
        positionTitle: e.positionTitle,
        salaryGrade: e.salaryGrade,
        step: e.step,
        officeId,
        dateHired: e.dateHired,
        dateRegularized: e.dateRegularized ?? undefined,
        status: e.status,
        email: e.email,
        phone: e.phone,
        tin: e.tin ?? undefined,
        gsisNo: e.gsisNo ?? undefined,
        philhealthNo: e.philhealthNo,
        pagibigNo: e.pagibigNo,
        addressCity: e.addressCity,
        addressProvince: e.addressProvince,
      })
      .returning({ id: schema.employees.id });

    idMap[e.employeeNo] = row!.id;
  }

  log("employees", employeeData.length);
  return idMap;
}

// ─── 3. Plantilla Positions ────────────────────────────────────────────────────

async function seedPlantilla(
  officeIds: Record<string, string>,
  employeeIds: Record<string, string>,
): Promise<void> {
  const positions = [
    {
      itemNo: "PLT-OSP-001",
      positionTitle: "Director IV",
      salaryGrade: 27,
      authorizedSalary: "107982.00",
      officeCode: "OSP",
      isFilled: true,
      employeeNo: "EMP-2026-00001",
    },
    {
      itemNo: "PLT-OSP-002",
      positionTitle: "Administrative Officer V",
      salaryGrade: 22,
      authorizedSalary: "58416.00",
      officeCode: "OSP",
      isFilled: true,
      employeeNo: "EMP-2026-00002",
    },
    {
      itemNo: "PLT-OSP-003",
      positionTitle: "Attorney IV",
      salaryGrade: 24,
      authorizedSalary: "76255.00",
      officeCode: "OSP",
      isFilled: true,
      employeeNo: "EMP-2026-00004",
    },
    {
      itemNo: "PLT-OSP-004",
      positionTitle: "Human Resource Management Officer III",
      salaryGrade: 18,
      authorizedSalary: "36628.00",
      officeCode: "OSP",
      isFilled: true,
      employeeNo: "EMP-2026-00020",
    },
    {
      itemNo: "PLT-COF-001",
      positionTitle: "Budget and Financial Officer III",
      salaryGrade: 19,
      authorizedSalary: "41123.00",
      officeCode: "COF",
      isFilled: true,
      employeeNo: "EMP-2026-00005",
    },
    {
      itemNo: "PLT-COF-002",
      positionTitle: "Budget and Financial Officer I",
      salaryGrade: 13,
      authorizedSalary: "21759.00",
      officeCode: "COF",
      isFilled: true,
      employeeNo: "EMP-2026-00006",
    },
    // Vacant positions
    {
      itemNo: "PLT-OSP-005",
      positionTitle: "Senior Administrative Assistant II",
      salaryGrade: 15,
      authorizedSalary: "27480.00",
      officeCode: "OSP",
      isFilled: false,
      employeeNo: null,
    },
    {
      itemNo: "PLT-COJHR-001",
      positionTitle: "Attorney III",
      salaryGrade: 22,
      authorizedSalary: "58416.00",
      officeCode: "COJHR",
      isFilled: false,
      employeeNo: null,
    },
    {
      itemNo: "PLT-OSEC-001",
      positionTitle: "Records Officer II",
      salaryGrade: 12,
      authorizedSalary: "19695.00",
      officeCode: "OSEC",
      isFilled: false,
      employeeNo: null,
    },
    {
      itemNo: "PLT-OSAA-001",
      positionTitle: "Administrative Officer I",
      salaryGrade: 11,
      authorizedSalary: "17807.00",
      officeCode: "OSAA",
      isFilled: false,
      employeeNo: null,
    },
  ];

  for (const p of positions) {
    const existing = await db
      .select({ id: schema.plantillaPositions.id })
      .from(schema.plantillaPositions)
      .where(eq(schema.plantillaPositions.itemNo, p.itemNo))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.plantillaPositions).values({
      itemNo: p.itemNo,
      positionTitle: p.positionTitle,
      salaryGrade: p.salaryGrade,
      authorizedSalary: p.authorizedSalary,
      officeId: officeIds[p.officeCode]!,
      isFilled: p.isFilled,
      employeeId: p.employeeNo
        ? (employeeIds[p.employeeNo] ?? undefined)
        : undefined,
    });
  }

  log("plantilla_positions", positions.length);
}

// ─── 4. Appointments ───────────────────────────────────────────────────────────

async function seedAppointments(
  officeIds: Record<string, string>,
  employeeIds: Record<string, string>,
): Promise<void> {
  const appointmentData = [
    {
      employeeNo: "EMP-2026-00010",
      appointmentType: "permanent" as const,
      effectivityDate: "2022-02-14",
      endDate: null,
      positionTitle: "Records Officer I",
      salaryGrade: 10,
      step: 1,
      monthlySalary: "16543.00",
      officeCode: "COJHR",
      status: "active" as const,
      remarks: "Initial appointment upon regularization.",
    },
    {
      employeeNo: "EMP-2026-00019",
      appointmentType: "job_order" as const,
      effectivityDate: "2025-01-02",
      endDate: "2025-12-31",
      positionTitle: "Driver I",
      salaryGrade: 5,
      step: 1,
      monthlySalary: "13510.00",
      officeCode: "OSAA",
      status: "active" as const,
      remarks: "Job Order contract for CY 2025.",
    },
    {
      employeeNo: "EMP-2026-00013",
      appointmentType: "job_order" as const,
      effectivityDate: "2024-01-15",
      endDate: "2024-12-31",
      positionTitle: "IT Support Specialist",
      salaryGrade: 8,
      step: 1,
      monthlySalary: "15316.00",
      officeCode: "OSEC",
      status: "active" as const,
      remarks: "Job Order extended for CY 2024.",
    },
  ];

  for (const a of appointmentData) {
    const empId = employeeIds[a.employeeNo]!;

    // Check by employeeId + effectivityDate
    const existing = await db
      .select({ id: schema.appointments.id })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.employeeId, empId),
          eq(schema.appointments.effectivityDate, a.effectivityDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.appointments).values({
      employeeId: empId,
      appointmentType: a.appointmentType,
      effectivityDate: a.effectivityDate,
      endDate: a.endDate ?? undefined,
      positionTitle: a.positionTitle,
      salaryGrade: a.salaryGrade,
      step: a.step,
      monthlySalary: a.monthlySalary,
      officeId: officeIds[a.officeCode]!,
      status: a.status,
      remarks: a.remarks,
    });
  }

  log("appointments", appointmentData.length);
}

// ─── 5. Attendance Logs ────────────────────────────────────────────────────────

async function seedAttendanceLogs(
  employeeIds: Record<string, string>,
): Promise<void> {
  // 5 employees × 12 working days over last 14 calendar days
  const targetEmployeeNos = [
    "EMP-2026-00001",
    "EMP-2026-00002",
    "EMP-2026-00005",
    "EMP-2026-00008",
    "EMP-2026-00015",
  ];

  // Generate last 14 calendar days and pick weekdays
  const workDays: string[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      workDays.push(d.toISOString().slice(0, 10));
    }
  }
  // Cap at 12 days
  const days = workDays.slice(-12);

  // Patterns: [timeIn, timeOut, timeInPm, timeOutPm, isLate, lateMin, OTmin]
  type AttendancePattern = {
    timeIn: string;
    timeOut: string;
    timeInPm: string;
    timeOutPm: string;
    isLate: boolean;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
  };

  const patterns: AttendancePattern[] = [
    {
      timeIn: "08:00",
      timeOut: "12:00",
      timeInPm: "13:00",
      timeOutPm: "17:00",
      isLate: false,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
    },
    {
      timeIn: "08:00",
      timeOut: "12:00",
      timeInPm: "13:00",
      timeOutPm: "19:00",
      isLate: false,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 120,
    },
    {
      timeIn: "08:15",
      timeOut: "12:00",
      timeInPm: "13:00",
      timeOutPm: "17:00",
      isLate: true,
      lateMinutes: 15,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
    },
    {
      timeIn: "08:30",
      timeOut: "12:00",
      timeInPm: "13:00",
      timeOutPm: "17:00",
      isLate: true,
      lateMinutes: 30,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
    },
    {
      timeIn: "08:00",
      timeOut: "12:00",
      timeInPm: "13:00",
      timeOutPm: "16:45",
      isLate: false,
      lateMinutes: 0,
      undertimeMinutes: 15,
      overtimeMinutes: 0,
    },
    {
      timeIn: "07:55",
      timeOut: "12:00",
      timeInPm: "13:00",
      timeOutPm: "17:05",
      isLate: false,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 5,
    },
  ];

  let count = 0;
  for (const empNo of targetEmployeeNos) {
    const empId = employeeIds[empNo];
    if (!empId) continue;
    for (let di = 0; di < days.length; di++) {
      const logDate = days[di]!;
      const pattern = patterns[di % patterns.length]!;

      const existing = await db
        .select({ id: schema.attendanceLogs.id })
        .from(schema.attendanceLogs)
        .where(
          and(
            eq(schema.attendanceLogs.employeeId, empId),
            eq(schema.attendanceLogs.logDate, logDate),
          ),
        )
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(schema.attendanceLogs).values({
        employeeId: empId,
        logDate,
        timeIn: pattern.timeIn,
        timeOut: pattern.timeOut,
        timeInPm: pattern.timeInPm,
        timeOutPm: pattern.timeOutPm,
        source: "biometric",
        isLate: pattern.isLate,
        lateMinutes: pattern.lateMinutes,
        undertimeMinutes: pattern.undertimeMinutes,
        overtimeMinutes: pattern.overtimeMinutes,
      });
      count++;
    }
  }

  log("attendance_logs", count);
}

// ─── 6. DTR Periods ────────────────────────────────────────────────────────────

async function seedDtrPeriods(
  employeeIds: Record<string, string>,
): Promise<void> {
  const yr = currentYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, "0");
  const prevMo = String(new Date().getMonth()).padStart(2, "0") || "12";
  const prevYr = new Date().getMonth() === 0 ? yr - 1 : yr;

  const targetEmpNos = ["EMP-2026-00001", "EMP-2026-00002", "EMP-2026-00005"];

  const periods = [
    {
      periodStart: `${yr}-${mo}-01`,
      periodEnd: `${yr}-${mo}-15`,
      status: "draft" as const,
    },
    {
      periodStart: `${prevYr}-${prevMo}-01`,
      periodEnd: `${prevYr}-${prevMo}-30`,
      status: "approved" as const,
    },
    {
      periodStart: `${prevYr}-${prevMo}-16`,
      periodEnd: `${prevYr}-${prevMo}-31`,
      status: "submitted" as const,
    },
  ];

  let count = 0;
  for (const empNo of targetEmpNos) {
    const empId = employeeIds[empNo];
    if (!empId) continue;
    for (const p of periods) {
      const existing = await db
        .select({ id: schema.dtrPeriods.id })
        .from(schema.dtrPeriods)
        .where(
          and(
            eq(schema.dtrPeriods.employeeId, empId),
            eq(schema.dtrPeriods.periodStart, p.periodStart),
            eq(schema.dtrPeriods.periodEnd, p.periodEnd),
          ),
        )
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(schema.dtrPeriods).values({
        employeeId: empId,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        totalDaysPresent: 10,
        totalLateMinutes: 30,
        totalUndertimeMinutes: 15,
        totalOvertimeMinutes: 120,
        status: p.status,
      });
      count++;
    }
  }

  log("dtr_periods", count);
}

// ─── 7. Leave Credits ──────────────────────────────────────────────────────────

async function seedLeaveCredits(
  employeeIds: Record<string, string>,
): Promise<void> {
  const yr = currentYear();

  // Fetch VL and SL leave type IDs from DB (seeded by main seed.ts)
  const vl = await db
    .select({ id: schema.leaveTypes.id })
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.code, "VL"))
    .limit(1);
  const sl = await db
    .select({ id: schema.leaveTypes.id })
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.code, "SL"))
    .limit(1);

  if (vl.length === 0 || sl.length === 0) {
    console.log(
      "  [leave_credits] SKIP — VL/SL leave types not found; run db:seed first",
    );
    return;
  }

  const vlId = vl[0]!.id;
  const slId = sl[0]!.id;

  const targetEmpNos = [
    "EMP-2026-00001",
    "EMP-2026-00002",
    "EMP-2026-00004",
    "EMP-2026-00008",
  ];
  const credits = [
    {
      leaveTypeId: vlId,
      totalCredits: "15.000",
      usedCredits: "3.000",
      balance: "12.000",
      carryOver: "5.000",
    },
    {
      leaveTypeId: slId,
      totalCredits: "15.000",
      usedCredits: "1.500",
      balance: "13.500",
      carryOver: "8.000",
    },
  ];

  let count = 0;
  for (const empNo of targetEmpNos) {
    const empId = employeeIds[empNo];
    if (!empId) continue;
    for (const c of credits) {
      const existing = await db
        .select({ id: schema.leaveCredits.id })
        .from(schema.leaveCredits)
        .where(
          and(
            eq(schema.leaveCredits.employeeId, empId),
            eq(schema.leaveCredits.leaveTypeId, c.leaveTypeId),
            eq(schema.leaveCredits.year, yr),
          ),
        )
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(schema.leaveCredits).values({
        employeeId: empId,
        leaveTypeId: c.leaveTypeId,
        year: yr,
        totalCredits: c.totalCredits,
        usedCredits: c.usedCredits,
        balance: c.balance,
        carryOver: c.carryOver,
      });
      count++;
    }
  }

  log("leave_credits", count);
}

// ─── 8. Leave Applications ─────────────────────────────────────────────────────

async function seedLeaveApplications(
  employeeIds: Record<string, string>,
): Promise<void> {
  const vl = await db
    .select({ id: schema.leaveTypes.id })
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.code, "VL"))
    .limit(1);
  const sl = await db
    .select({ id: schema.leaveTypes.id })
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.code, "SL"))
    .limit(1);

  if (vl.length === 0 || sl.length === 0) {
    console.log(
      "  [leave_applications] SKIP — VL/SL leave types not found; run db:seed first",
    );
    return;
  }

  const vlId = vl[0]!.id;
  const slId = sl[0]!.id;
  const approverEmpId = employeeIds["EMP-2026-00001"];

  const apps = [
    {
      employeeNo: "EMP-2026-00002",
      leaveTypeId: vlId,
      dateFrom: dateOffset(5),
      dateTo: dateOffset(3),
      noOfDays: "3.000",
      reason: "Family vacation",
      status: "pending" as const,
      approvedBy: null,
    },
    {
      employeeNo: "EMP-2026-00004",
      leaveTypeId: slId,
      dateFrom: dateOffset(10),
      dateTo: dateOffset(9),
      noOfDays: "2.000",
      reason: "Medical consultation",
      status: "pending" as const,
      approvedBy: null,
    },
    {
      employeeNo: "EMP-2026-00008",
      leaveTypeId: vlId,
      dateFrom: dateOffset(20),
      dateTo: dateOffset(18),
      noOfDays: "3.000",
      reason: "Personal affairs",
      status: "pending" as const,
      approvedBy: null,
    },
    {
      employeeNo: "EMP-2026-00001",
      leaveTypeId: vlId,
      dateFrom: dateOffset(30),
      dateTo: dateOffset(28),
      noOfDays: "3.000",
      reason: "Annual leave",
      status: "approved" as const,
      approvedBy: approverEmpId,
    },
    {
      employeeNo: "EMP-2026-00005",
      leaveTypeId: slId,
      dateFrom: dateOffset(25),
      dateTo: dateOffset(24),
      noOfDays: "2.000",
      reason: "Flu symptoms",
      status: "approved" as const,
      approvedBy: approverEmpId,
    },
    {
      employeeNo: "EMP-2026-00015",
      leaveTypeId: vlId,
      dateFrom: dateOffset(40),
      dateTo: dateOffset(38),
      noOfDays: "3.000",
      reason: "Personal travel",
      status: "disapproved" as const,
      approvedBy: approverEmpId,
    },
  ];

  let count = 0;
  for (const a of apps) {
    const empId = employeeIds[a.employeeNo];
    if (!empId) continue;

    const existing = await db
      .select({ id: schema.leaveApplications.id })
      .from(schema.leaveApplications)
      .where(
        and(
          eq(schema.leaveApplications.employeeId, empId),
          eq(schema.leaveApplications.dateFrom, a.dateFrom),
          eq(schema.leaveApplications.leaveTypeId, a.leaveTypeId),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.leaveApplications).values({
      employeeId: empId,
      leaveTypeId: a.leaveTypeId,
      dateFrom: a.dateFrom,
      dateTo: a.dateTo,
      noOfDays: a.noOfDays,
      reason: a.reason,
      status: a.status,
      approvedBy: a.approvedBy ?? undefined,
      approvedAt: a.approvedBy ? new Date() : undefined,
      remarks:
        a.status === "disapproved"
          ? "Insufficient leave credits for the period."
          : undefined,
    });
    count++;
  }

  log("leave_applications", count);
}

// ─── 9. Payroll Period + Records ───────────────────────────────────────────────

async function seedPayroll(employeeIds: Record<string, string>): Promise<void> {
  const yr = currentYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, "0");
  const periodStart = `${yr}-${mo}-01`;
  const periodEnd = `${yr}-${mo}-15`;
  const payDate = `${yr}-${mo}-15`;
  const periodName = `${yr}-${mo} Semi-Monthly 1st (1-15)`;

  // Upsert payroll period
  let periodId: string;
  const existingPeriod = await db
    .select({ id: schema.payrollPeriods.id })
    .from(schema.payrollPeriods)
    .where(
      and(
        eq(schema.payrollPeriods.periodStart, periodStart),
        eq(schema.payrollPeriods.periodEnd, periodEnd),
      ),
    )
    .limit(1);

  if (existingPeriod.length > 0) {
    periodId = existingPeriod[0]!.id;
  } else {
    const [p] = await db
      .insert(schema.payrollPeriods)
      .values({
        name: periodName,
        periodStart,
        periodEnd,
        payDate,
        scope: "regular",
        status: "draft",
        notes: "Demo payroll period — current semi-monthly 1-15.",
      })
      .returning({ id: schema.payrollPeriods.id });
    periodId = p!.id;
  }

  log("payroll_periods", 1);

  // Payroll records for 5 employees with hand-computed deductions
  // SG/Step rates approximate 2024 DBM schedules (half-month = monthly / 2)
  type PayRecord = {
    employeeNo: string;
    salaryGrade: number;
    step: number;
    positionTitle: string;
    appointmentType: string;
    authorizedSalary: string;
    basicPay: string;
    pera: string;
    grossPay: string;
    gsisPersonal: string;
    gsisEmployer: string;
    gsisLifeInsurance: string;
    philhealthPersonal: string;
    philhealthEmployer: string;
    pagibigPersonal: string;
    pagibigEmployer: string;
    withholdingTax: string;
    lateDeduction: string;
    totalDeductions: string;
    netPay: string;
  };

  const payRecords: PayRecord[] = [
    {
      employeeNo: "EMP-2026-00001",
      salaryGrade: 27,
      step: 4,
      positionTitle: "Director IV",
      appointmentType: "permanent",
      authorizedSalary: "107982.00",
      basicPay: "53991.00",
      pera: "1000.00",
      grossPay: "54991.00",
      gsisPersonal: "4859.19",
      gsisEmployer: "6479.00",
      gsisLifeInsurance: "107.98",
      philhealthPersonal: "1349.78",
      philhealthEmployer: "1349.78",
      pagibigPersonal: "100.00",
      pagibigEmployer: "100.00",
      withholdingTax: "8520.00",
      lateDeduction: "0.00",
      totalDeductions: "14936.95",
      netPay: "40054.05",
    },
    {
      employeeNo: "EMP-2026-00002",
      salaryGrade: 22,
      step: 3,
      positionTitle: "Administrative Officer V",
      appointmentType: "permanent",
      authorizedSalary: "58416.00",
      basicPay: "29208.00",
      pera: "1000.00",
      grossPay: "30208.00",
      gsisPersonal: "2628.72",
      gsisEmployer: "3504.96",
      gsisLifeInsurance: "58.42",
      philhealthPersonal: "730.20",
      philhealthEmployer: "730.20",
      pagibigPersonal: "100.00",
      pagibigEmployer: "100.00",
      withholdingTax: "3300.00",
      lateDeduction: "154.10",
      totalDeductions: "7071.44",
      netPay: "23136.56",
    },
    {
      employeeNo: "EMP-2026-00005",
      salaryGrade: 19,
      step: 6,
      positionTitle: "Budget and Financial Officer III",
      appointmentType: "coterminous",
      authorizedSalary: "41123.00",
      basicPay: "20561.50",
      pera: "1000.00",
      grossPay: "21561.50",
      gsisPersonal: "1850.54",
      gsisEmployer: "2467.38",
      gsisLifeInsurance: "41.12",
      philhealthPersonal: "514.04",
      philhealthEmployer: "514.04",
      pagibigPersonal: "100.00",
      pagibigEmployer: "100.00",
      withholdingTax: "1400.00",
      lateDeduction: "0.00",
      totalDeductions: "4005.70",
      netPay: "17555.80",
    },
    {
      employeeNo: "EMP-2026-00008",
      salaryGrade: 25,
      step: 3,
      positionTitle: "Attorney V",
      appointmentType: "permanent",
      authorizedSalary: "84000.00",
      basicPay: "42000.00",
      pera: "1000.00",
      grossPay: "43000.00",
      gsisPersonal: "3780.00",
      gsisEmployer: "5040.00",
      gsisLifeInsurance: "84.00",
      philhealthPersonal: "1050.00",
      philhealthEmployer: "1050.00",
      pagibigPersonal: "100.00",
      pagibigEmployer: "100.00",
      withholdingTax: "5500.00",
      lateDeduction: "0.00",
      totalDeductions: "10614.00",
      netPay: "32386.00",
    },
    {
      employeeNo: "EMP-2026-00015",
      salaryGrade: 20,
      step: 7,
      positionTitle: "Security Officer IV",
      appointmentType: "permanent",
      authorizedSalary: "45203.00",
      basicPay: "22601.50",
      pera: "1000.00",
      grossPay: "23601.50",
      gsisPersonal: "2034.14",
      gsisEmployer: "2712.18",
      gsisLifeInsurance: "45.20",
      philhealthPersonal: "565.04",
      philhealthEmployer: "565.04",
      pagibigPersonal: "100.00",
      pagibigEmployer: "100.00",
      withholdingTax: "1800.00",
      lateDeduction: "0.00",
      totalDeductions: "4544.38",
      netPay: "19057.12",
    },
  ];

  let count = 0;
  for (const r of payRecords) {
    const empId = employeeIds[r.employeeNo];
    if (!empId) continue;

    const existing = await db
      .select({ id: schema.payrollRecords.id })
      .from(schema.payrollRecords)
      .where(
        and(
          eq(schema.payrollRecords.periodId, periodId),
          eq(schema.payrollRecords.employeeId, empId),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.payrollRecords).values({
      periodId,
      employeeId: empId,
      status: "draft",
      salaryGrade: r.salaryGrade,
      step: r.step,
      positionTitle: r.positionTitle,
      appointmentType: r.appointmentType,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceDays: 0,
      approvedOvertimeHours: "0",
      authorizedSalary: r.authorizedSalary,
      basicPay: r.basicPay,
      rata: "0",
      longevityPay: "0",
      overtimePay: "0",
      pera: r.pera,
      otherEarnings: "0",
      grossPay: r.grossPay,
      gsisPersonal: r.gsisPersonal,
      gsisEmployer: r.gsisEmployer,
      gsisLifeInsurance: r.gsisLifeInsurance,
      philhealthPersonal: r.philhealthPersonal,
      philhealthEmployer: r.philhealthEmployer,
      pagibigPersonal: r.pagibigPersonal,
      pagibigEmployer: r.pagibigEmployer,
      withholdingTax: r.withholdingTax,
      lateDeduction: r.lateDeduction,
      undertimeDeduction: "0",
      absenceDeduction: "0",
      otherDeductions: "0",
      totalDeductions: r.totalDeductions,
      netPay: r.netPay,
      hasException: false,
      computationSnapshot: {
        computedAt: new Date().toISOString(),
        method: "demo-seed",
        note: "Hand-computed demo values for UI preview.",
      },
    });
    count++;
  }

  log("payroll_records", count);
}

// ─── 10. Performance Periods + Ratings ────────────────────────────────────────

async function seedPerformance(
  employeeIds: Record<string, string>,
): Promise<void> {
  const yr = currentYear();

  const periods = [
    {
      year: yr,
      semester: "1" as const,
      dateFrom: `${yr}-01-01`,
      dateTo: `${yr}-06-30`,
      status: "rating" as const,
    },
    {
      year: yr,
      semester: "2" as const,
      dateFrom: `${yr}-07-01`,
      dateTo: `${yr}-12-31`,
      status: "open" as const,
    },
  ];

  const periodIds: Record<string, string> = {};
  for (const p of periods) {
    const existing = await db
      .select({ id: schema.performancePeriods.id })
      .from(schema.performancePeriods)
      .where(
        and(
          eq(schema.performancePeriods.year, p.year),
          eq(schema.performancePeriods.semester, p.semester),
        ),
      )
      .limit(1);

    let pid: string;
    if (existing.length > 0) {
      pid = existing[0]!.id;
    } else {
      const [row] = await db
        .insert(schema.performancePeriods)
        .values(p)
        .returning({ id: schema.performancePeriods.id });
      pid = row!.id;
    }
    periodIds[p.semester] = pid;
  }

  log("performance_periods", periods.length);

  // 4 ratings for semester 1
  const raterEmpId = employeeIds["EMP-2026-00001"]!;

  const ratings = [
    {
      employeeNo: "EMP-2026-00002",
      semester: "1",
      ratingType: "ipcrf" as const,
      numericalRating: "4.750",
      adjectivalRating: "outstanding" as const,
      status: "approved" as const,
    },
    {
      employeeNo: "EMP-2026-00004",
      semester: "1",
      ratingType: "ipcrf" as const,
      numericalRating: "4.200",
      adjectivalRating: "very_satisfactory" as const,
      status: "submitted" as const,
    },
    {
      employeeNo: "EMP-2026-00005",
      semester: "1",
      ratingType: "ipcrf" as const,
      numericalRating: "3.800",
      adjectivalRating: "satisfactory" as const,
      status: "submitted" as const,
    },
    {
      employeeNo: "EMP-2026-00008",
      semester: "1",
      ratingType: "ipcrf" as const,
      numericalRating: "4.500",
      adjectivalRating: "outstanding" as const,
      status: "approved" as const,
    },
  ];

  let count = 0;
  for (const r of ratings) {
    const empId = employeeIds[r.employeeNo];
    const periodId = periodIds[r.semester];
    if (!empId || !periodId) continue;

    const existing = await db
      .select({ id: schema.performanceRatings.id })
      .from(schema.performanceRatings)
      .where(
        and(
          eq(schema.performanceRatings.employeeId, empId),
          eq(schema.performanceRatings.periodId, periodId),
          eq(schema.performanceRatings.ratingType, r.ratingType),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.performanceRatings).values({
      employeeId: empId,
      periodId,
      ratingType: r.ratingType,
      numericalRating: r.numericalRating,
      adjectivalRating: r.adjectivalRating,
      ratedBy: raterEmpId,
      approvedBy: r.status === "approved" ? raterEmpId : undefined,
      status: r.status,
    });
    count++;
  }

  log("performance_ratings", count);
}

// ─── 11. Step Increments ───────────────────────────────────────────────────────

async function seedStepIncrements(
  employeeIds: Record<string, string>,
): Promise<void> {
  const empId = employeeIds["EMP-2026-00002"];
  const approverId = employeeIds["EMP-2026-00001"];
  if (!empId) return;

  const existing = await db
    .select({ id: schema.stepIncrements.id })
    .from(schema.stepIncrements)
    .where(eq(schema.stepIncrements.employeeId, empId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.stepIncrements).values({
      employeeId: empId,
      fromStep: 2,
      toStep: 3,
      effectivityDate: `${currentYear() - 1}-01-01`,
      basisPeriodIds: [],
      status: "implemented",
      approvedBy: approverId,
      remarks:
        "Three consecutive VS ratings — automatic step increment per CSC rules.",
    });
  }

  log("step_increments", 1);
}

// ─── 12. SALN Submissions ──────────────────────────────────────────────────────

async function seedSaln(employeeIds: Record<string, string>): Promise<void> {
  const reviewerId = employeeIds["EMP-2026-00020"];

  const submissions = [
    {
      employeeNo: "EMP-2026-00001",
      year: currentYear() - 1,
      filingType: "annual" as const,
      totalAssets: "8500000.00",
      totalLiabilities: "2500000.00",
      netWorth: "6000000.00",
      status: "submitted" as const,
      dateFiled: `${currentYear() - 1}-12-15`,
      realAssets: JSON.stringify([
        {
          description: "Residential lot and house",
          location: "Quezon City",
          yearAcquired: 2015,
          mode: "Purchase",
          cost: "4500000",
          assessedValue: "3200000",
          marketValue: "8000000",
        },
      ]),
      personalProperties: JSON.stringify([
        {
          description: "Toyota Fortuner 2020",
          yearAcquired: 2020,
          cost: "1800000",
          currentFairMarketValue: "1200000",
        },
      ]),
      liabilities: JSON.stringify([
        {
          nature: "Housing Loan",
          nameOfCreditor: "GSIS",
          balanceOutstanding: "2500000",
        },
      ]),
    },
    {
      employeeNo: "EMP-2026-00004",
      year: currentYear() - 1,
      filingType: "annual" as const,
      totalAssets: "3200000.00",
      totalLiabilities: "1200000.00",
      netWorth: "2000000.00",
      status: "draft" as const,
      dateFiled: null,
      realAssets: JSON.stringify([]),
      personalProperties: JSON.stringify([
        {
          description: "Honda CR-V 2019",
          yearAcquired: 2019,
          cost: "1600000",
          currentFairMarketValue: "1000000",
        },
      ]),
      liabilities: JSON.stringify([
        {
          nature: "Car Loan",
          nameOfCreditor: "BPI",
          balanceOutstanding: "1200000",
        },
      ]),
    },
  ];

  let count = 0;
  for (const s of submissions) {
    const empId = employeeIds[s.employeeNo];
    if (!empId) continue;

    const existing = await db
      .select({ id: schema.salnSubmissions.id })
      .from(schema.salnSubmissions)
      .where(
        and(
          eq(schema.salnSubmissions.employeeId, empId),
          eq(schema.salnSubmissions.year, s.year),
          eq(schema.salnSubmissions.filingType, s.filingType),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.salnSubmissions).values({
      employeeId: empId,
      year: s.year,
      filingType: s.filingType,
      realAssets: s.realAssets,
      personalProperties: s.personalProperties,
      liabilities: s.liabilities,
      totalAssets: s.totalAssets,
      totalLiabilities: s.totalLiabilities,
      netWorth: s.netWorth,
      businessInterests: "[]",
      relatives: "[]",
      dateFiled: s.dateFiled ?? undefined,
      status: s.status,
      reviewedBy: s.status === "submitted" ? reviewerId : undefined,
    });
    count++;
  }

  log("saln_submissions", count);
}

// ─── 13. Holidays ──────────────────────────────────────────────────────────────

async function seedHolidays(): Promise<void> {
  const yr = currentYear();
  const holidayData = [
    {
      name: "New Year's Day",
      holidayDate: `${yr}-01-01`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Annual regular holiday.",
    },
    {
      name: "EDSA People Power Revolution Anniversary",
      holidayDate: `${yr}-02-25`,
      type: "special_non_working" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Commemorates the 1986 People Power Revolution.",
    },
    {
      name: "Maundy Thursday",
      holidayDate: `${yr}-04-02`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Movable holiday — Holy Week.",
    },
    {
      name: "Good Friday",
      holidayDate: `${yr}-04-03`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Movable holiday — Holy Week.",
    },
    {
      name: "Araw ng Kagitingan (Day of Valor)",
      holidayDate: `${yr}-04-09`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Commemorates the Fall of Bataan.",
    },
    {
      name: "Labor Day",
      holidayDate: `${yr}-05-01`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "International Workers Day.",
    },
    {
      name: "Independence Day",
      holidayDate: `${yr}-06-12`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Philippine Independence Day.",
    },
    {
      name: "National Heroes Day",
      holidayDate: `${yr}-08-25`,
      type: "regular" as const,
      proclamationRef: `Proclamation No. 727 s. ${yr}`,
      remarks: "Last Monday of August.",
    },
  ];

  let count = 0;
  for (const h of holidayData) {
    const existing = await db
      .select({ id: schema.holidays.id })
      .from(schema.holidays)
      .where(eq(schema.holidays.holidayDate, h.holidayDate))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(schema.holidays).values({
      name: h.name,
      holidayDate: h.holidayDate,
      type: h.type,
      year: yr,
      proclamationRef: h.proclamationRef,
      remarks: h.remarks,
    });
    count++;
  }

  log("holidays", count);
}

// ─── 14. Audit Logs ────────────────────────────────────────────────────────────

async function seedAuditLogs(
  employeeIds: Record<string, string>,
): Promise<void> {
  const systemUserId = null; // Will use null for seed-generated entries
  const actions = [
    {
      action: "create",
      tableName: "employees",
      employeeNo: "EMP-2026-00001",
      daysAgo: 7,
    },
    {
      action: "update",
      tableName: "employees",
      employeeNo: "EMP-2026-00002",
      daysAgo: 6,
    },
    {
      action: "approve",
      tableName: "leave_applications",
      employeeNo: "EMP-2026-00001",
      daysAgo: 6,
    },
    {
      action: "create",
      tableName: "payroll_periods",
      employeeNo: "EMP-2026-00001",
      daysAgo: 5,
    },
    {
      action: "create",
      tableName: "payroll_records",
      employeeNo: "EMP-2026-00001",
      daysAgo: 5,
    },
    {
      action: "export",
      tableName: "payroll_records",
      employeeNo: "EMP-2026-00001",
      daysAgo: 5,
    },
    {
      action: "create",
      tableName: "saln_submissions",
      employeeNo: "EMP-2026-00020",
      daysAgo: 4,
    },
    {
      action: "update",
      tableName: "saln_submissions",
      employeeNo: "EMP-2026-00020",
      daysAgo: 4,
    },
    {
      action: "approve",
      tableName: "performance_ratings",
      employeeNo: "EMP-2026-00001",
      daysAgo: 3,
    },
    {
      action: "create",
      tableName: "appointments",
      employeeNo: "EMP-2026-00020",
      daysAgo: 3,
    },
    {
      action: "update",
      tableName: "employees",
      employeeNo: "EMP-2026-00020",
      daysAgo: 3,
    },
    {
      action: "login",
      tableName: "system_users",
      employeeNo: "EMP-2026-00001",
      daysAgo: 2,
    },
    {
      action: "login",
      tableName: "system_users",
      employeeNo: "EMP-2026-00002",
      daysAgo: 2,
    },
    {
      action: "create",
      tableName: "attendance_logs",
      employeeNo: "EMP-2026-00001",
      daysAgo: 2,
    },
    {
      action: "update",
      tableName: "plantilla_positions",
      employeeNo: "EMP-2026-00001",
      daysAgo: 2,
    },
    {
      action: "approve",
      tableName: "leave_applications",
      employeeNo: "EMP-2026-00001",
      daysAgo: 1,
    },
    {
      action: "create",
      tableName: "step_increments",
      employeeNo: "EMP-2026-00001",
      daysAgo: 1,
    },
    {
      action: "export",
      tableName: "employees",
      employeeNo: "EMP-2026-00001",
      daysAgo: 1,
    },
    {
      action: "update",
      tableName: "leave_credits",
      employeeNo: "EMP-2026-00020",
      daysAgo: 1,
    },
    {
      action: "create",
      tableName: "dtr_periods",
      employeeNo: "EMP-2026-00020",
      daysAgo: 1,
    },
    {
      action: "login",
      tableName: "system_users",
      employeeNo: "EMP-2026-00001",
      daysAgo: 0,
    },
    {
      action: "login",
      tableName: "system_users",
      employeeNo: "EMP-2026-00020",
      daysAgo: 0,
    },
    {
      action: "create",
      tableName: "attendance_logs",
      employeeNo: "EMP-2026-00002",
      daysAgo: 0,
    },
    {
      action: "update",
      tableName: "payroll_records",
      employeeNo: "EMP-2026-00001",
      daysAgo: 0,
    },
    {
      action: "view",
      tableName: "employees",
      employeeNo: "EMP-2026-00002",
      daysAgo: 0,
    },
    {
      action: "create",
      tableName: "leave_applications",
      employeeNo: "EMP-2026-00020",
      daysAgo: 0,
    },
    {
      action: "approve",
      tableName: "dtr_periods",
      employeeNo: "EMP-2026-00001",
      daysAgo: 0,
    },
    {
      action: "export",
      tableName: "saln_submissions",
      employeeNo: "EMP-2026-00001",
      daysAgo: 0,
    },
    {
      action: "update",
      tableName: "performance_ratings",
      employeeNo: "EMP-2026-00020",
      daysAgo: 0,
    },
    {
      action: "create",
      tableName: "holidays",
      employeeNo: "EMP-2026-00001",
      daysAgo: 0,
    },
  ];

  // Audit logs are append-only; we check count to avoid duplicating on re-run
  const existing = await db
    .select({ id: schema.auditLogs.id })
    .from(schema.auditLogs)
    .limit(1);

  if (existing.length > 0) {
    console.log("  [audit_logs] SKIP — rows already exist (append-only table)");
    return;
  }

  for (const entry of actions) {
    const recordId = employeeIds[entry.employeeNo] ?? undefined;
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - entry.daysAgo);

    await db.insert(schema.auditLogs).values({
      userId: systemUserId ?? undefined,
      action: entry.action,
      tableName: entry.tableName,
      recordId,
      newValues: { seeded: true, employeeNo: entry.employeeNo },
      ipAddress: "127.0.0.1",
      userAgent: "demo-seed-script/1.0",
      createdAt,
      updatedAt: createdAt,
    });
  }

  log("audit_logs", actions.length);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("PCSO HRIS — Demo Data Seed");
  console.log("─".repeat(50));

  try {
    const officeIds = await seedOffices();
    const employeeIds = await seedEmployees(officeIds);
    await seedPlantilla(officeIds, employeeIds);
    await seedAppointments(officeIds, employeeIds);
    await seedAttendanceLogs(employeeIds);
    await seedDtrPeriods(employeeIds);
    await seedLeaveCredits(employeeIds);
    await seedLeaveApplications(employeeIds);
    await seedPayroll(employeeIds);
    await seedPerformance(employeeIds);
    await seedStepIncrements(employeeIds);
    await seedSaln(employeeIds);
    await seedHolidays();
    await seedAuditLogs(employeeIds);

    console.log("─".repeat(50));
    console.log("Demo seed completed successfully.");
  } catch (err) {
    console.error("Demo seed failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
