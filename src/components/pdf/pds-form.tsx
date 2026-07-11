/**
 * Personal Data Sheet (CS Form No. 212, Revised 2017) PDF — React-PDF.
 *
 * TOR 1.3.11 / PIM-013 — all 4 pages of the official CSC form shape,
 * auto-populated from the employee 201 file where the schema holds data.
 *
 * 201-EXPANSION NOTE (data audit): the current employees schema does NOT yet
 * store family background (spouse/parents/children), educational background,
 * civil service eligibility, voluntary work, or references. Those sections
 * render the official form shape with blank rows (fill-by-hand fallback)
 * until the 201-expansion iteration lands. Sections that ARE data-backed:
 *   I  Personal Information  → employees table
 *   V  Work Experience       → appointments history + current appointment
 *   VII Learning & Development → training participation (completed runs)
 *   VIII Other Information   → employees.special_skills_hobbies (Section 31)
 *
 * Use with `renderToBuffer(<PdsFormPdf ... />)`.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GRAY = "#6B7280";
const LIGHT = "#F3F4F6";
const BORDER = "#9CA3AF";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 28,
    fontSize: 7,
    color: "#111827",
  },
  formNo: {
    fontSize: 7,
    fontFamily: "Helvetica-BoldOblique",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 4,
  },
  headerWarn: {
    fontSize: 6,
    fontFamily: "Helvetica-Oblique",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 6,
    color: GRAY,
  },
  serialLine: {
    fontSize: 6.5,
    textAlign: "right",
    color: GRAY,
    marginBottom: 4,
  },
  sectionHeader: {
    backgroundColor: NAVY,
    color: "#FFFFFF",
    fontFamily: "Helvetica-BoldOblique",
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 8,
  },
  grid: {
    borderWidth: 0.75,
    borderColor: BORDER,
    borderTopWidth: 0,
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 0.75,
    borderTopColor: BORDER,
    minHeight: 16,
  },
  cell: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRightWidth: 0.75,
    borderRightColor: BORDER,
    justifyContent: "center",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  label: {
    fontSize: 5.5,
    color: GRAY,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  th: {
    backgroundColor: LIGHT,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderRightColor: BORDER,
    justifyContent: "center",
  },
  td: {
    fontSize: 7,
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRightWidth: 0.75,
    borderRightColor: BORDER,
    justifyContent: "center",
  },
  tdCenter: { textAlign: "center" },
  pendingNote: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Oblique",
    color: GRAY,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  declaration: {
    fontSize: 7,
    lineHeight: 1.6,
    textAlign: "justify",
    marginTop: 8,
  },
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 16,
  },
  sigBlock: {
    flex: 1,
    alignItems: "center",
  },
  sigLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#111827",
    height: 28,
    alignSelf: "stretch",
    marginBottom: 3,
  },
  sigLabel: {
    fontSize: 6,
    color: GRAY,
    textTransform: "uppercase",
    textAlign: "center",
  },
  photoBox: {
    width: 100,
    height: 110,
    borderWidth: 0.75,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  photoText: {
    fontSize: 6,
    color: GRAY,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 5.5,
    color: GRAY,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PdsWorkExperienceRow {
  /** ISO dates; `to` null = Present. */
  from: string;
  to: string | null;
  positionTitle: string;
  agency: string;
  monthlySalary: number | null;
  /** "18-3" salary grade & step increment format per the official form. */
  gradeStep: string | null;
  statusOfAppointment: string;
  isGovService: boolean;
}

export interface PdsTrainingRow {
  title: string;
  from: string | null;
  to: string | null;
  hours: number | null;
  conductedBy: string | null;
}

export interface PdsFormPdfProps {
  serialNumber: string;
  agencyName: string;
  employee: {
    lastName: string;
    firstName: string;
    middleName?: string | null;
    suffix?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    civilStatus?: string | null;
    nationality?: string | null;
    religion?: string | null;
    bloodType?: string | null;
    tin?: string | null;
    gsisNo?: string | null;
    philhealthNo?: string | null;
    pagibigNo?: string | null;
    employeeNo: string;
    email?: string | null;
    phone?: string | null;
    addressStreet?: string | null;
    addressBarangay?: string | null;
    addressCity?: string | null;
    addressProvince?: string | null;
    addressZipCode?: string | null;
  };
  workExperience: PdsWorkExperienceRow[];
  trainings: PdsTrainingRow[];
  skills: string[];
  hobbies: string[];
  generatedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(value: number | null): string {
  if (value == null) return "";
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface FieldProps {
  label: string;
  value?: string | null;
  width: string | number;
  last?: boolean;
}

function Field({ label, value, width, last }: FieldProps) {
  return (
    <View style={[styles.cell, { width }, last ? styles.cellLast : {}]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || " "}</Text>
    </View>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

/** Blank rows preserving the official form shape for hand fill-in. */
function BlankRows({
  widths,
  count,
}: {
  widths: (string | number)[];
  count: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, r) => (
        <View key={r} style={styles.row}>
          {widths.map((w, c) => (
            <View
              key={c}
              style={[
                styles.td,
                { width: w },
                c === widths.length - 1 ? styles.cellLast : {},
              ]}
            >
              <Text> </Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function HeaderCells({
  widths,
  labels,
}: {
  widths: (string | number)[];
  labels: string[];
}) {
  return (
    <View style={styles.row}>
      {labels.map((label, i) => (
        <View
          key={i}
          style={[
            styles.th,
            { width: widths[i] },
            i === labels.length - 1 ? styles.cellLast : {},
          ]}
        >
          <Text>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function PageHeader({
  serialNumber,
  pageNo,
}: {
  serialNumber: string;
  pageNo: number;
}) {
  return (
    <>
      <Text style={styles.formNo}>CS Form No. 212 (Revised 2017)</Text>
      {pageNo === 1 ? (
        <>
          <Text style={styles.headerTitle}>PERSONAL DATA SHEET</Text>
          <Text style={styles.headerWarn}>
            WARNING: Any misrepresentation made in the Personal Data Sheet and
            the Work Experience Sheet shall cause the filing of
            administrative/criminal case/s against the person concerned.
          </Text>
        </>
      ) : null}
      <Text style={styles.serialLine}>
        Serial No.: {serialNumber} — Page {pageNo} of 4
      </Text>
    </>
  );
}

function PageFooter({
  serialNumber,
  generatedAt,
}: {
  serialNumber: string;
  generatedAt?: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        CS Form 212 (Revised 2017) — {serialNumber}
      </Text>
      <Text style={styles.footerText}>
        Generated: {generatedAt ?? new Date().toLocaleDateString("en-PH")}
      </Text>
    </View>
  );
}

const PENDING_201 =
  "Data not yet encoded in the 201 file — to be accomplished by hand pending the 201-expansion iteration.";

// ─── Component ────────────────────────────────────────────────────────────────

export function PdsFormPdf({
  serialNumber,
  agencyName,
  employee,
  workExperience,
  trainings,
  skills,
  hobbies,
  generatedAt,
}: PdsFormPdfProps) {
  const residential = [
    employee.addressStreet,
    employee.addressBarangay,
    employee.addressCity,
    employee.addressProvince,
  ]
    .filter(Boolean)
    .join(", ");

  const weWidths = ["11%", "11%", "26%", "20%", "10%", "8%", "10%", "4%"];
  const ldWidths = ["40%", "12%", "12%", "8%", "28%"];
  const eduWidths = ["16%", "30%", "24%", "10%", "10%", "10%"];
  const eligWidths = ["30%", "12%", "14%", "24%", "20%"];

  return (
    <Document
      title={`PDS (CS Form 212) — ${employee.lastName}, ${employee.firstName}`}
      author={agencyName}
    >
      {/* ════════ PAGE 1 — Personal Info · Family · Education ════════ */}
      <Page size="LEGAL" style={styles.page}>
        <PageHeader serialNumber={serialNumber} pageNo={1} />

        <SectionHeader>I. PERSONAL INFORMATION</SectionHeader>
        <View style={styles.grid}>
          <View style={styles.row}>
            <Field label="2. Surname" value={employee.lastName} width="34%" />
            <Field label="First Name" value={employee.firstName} width="34%" />
            <Field
              label="Middle Name"
              value={employee.middleName ?? ""}
              width="22%"
            />
            <Field
              label="Name Ext. (Jr./Sr.)"
              value={employee.suffix ?? ""}
              width="10%"
              last
            />
          </View>
          <View style={styles.row}>
            <Field
              label="3. Date of Birth (mm/dd/yyyy)"
              value={fmtDate(employee.birthDate)}
              width="25%"
            />
            <Field label="4. Place of Birth" value="" width="25%" />
            <Field
              label="5. Sex"
              value={titleCase(employee.gender)}
              width="25%"
            />
            <Field
              label="6. Civil Status"
              value={titleCase(employee.civilStatus)}
              width="25%"
              last
            />
          </View>
          <View style={styles.row}>
            <Field label="7. Height (m)" value="" width="25%" />
            <Field label="8. Weight (kg)" value="" width="25%" />
            <Field
              label="9. Blood Type"
              value={employee.bloodType ?? ""}
              width="25%"
            />
            <Field
              label="16. Citizenship"
              value={employee.nationality ?? ""}
              width="25%"
              last
            />
          </View>
          <View style={styles.row}>
            <Field
              label="10. GSIS ID No."
              value={employee.gsisNo ?? ""}
              width="25%"
            />
            <Field
              label="11. Pag-IBIG ID No."
              value={employee.pagibigNo ?? ""}
              width="25%"
            />
            <Field
              label="12. PhilHealth No."
              value={employee.philhealthNo ?? ""}
              width="25%"
            />
            <Field
              label="14. TIN No."
              value={employee.tin ?? ""}
              width="25%"
              last
            />
          </View>
          <View style={styles.row}>
            <Field label="13. SSS No." value="" width="25%" />
            <Field
              label="15. Agency Employee No."
              value={employee.employeeNo}
              width="25%"
            />
            <Field
              label="Religion"
              value={employee.religion ?? ""}
              width="50%"
              last
            />
          </View>
          <View style={styles.row}>
            <Field
              label="17. Residential Address"
              value={residential}
              width="75%"
            />
            <Field
              label="Zip Code"
              value={employee.addressZipCode ?? ""}
              width="25%"
              last
            />
          </View>
          <View style={styles.row}>
            <Field label="18. Permanent Address" value="" width="75%" />
            <Field label="Zip Code" value="" width="25%" last />
          </View>
          <View style={styles.row}>
            <Field
              label="19. Telephone / 20. Mobile No."
              value={employee.phone ?? ""}
              width="50%"
            />
            <Field
              label="21. E-mail Address (if any)"
              value={employee.email ?? ""}
              width="50%"
              last
            />
          </View>
        </View>

        <SectionHeader>II. FAMILY BACKGROUND</SectionHeader>
        <View style={styles.grid}>
          <Text style={styles.pendingNote}>{PENDING_201}</Text>
          <HeaderCells
            widths={["25%", "25%", "25%", "25%"]}
            labels={[
              "22. Spouse's Surname / First / Middle Name",
              "Occupation / Employer",
              "24. Father's Full Name",
              "25. Mother's Maiden Name",
            ]}
          />
          <BlankRows widths={["25%", "25%", "25%", "25%"]} count={2} />
          <HeaderCells
            widths={["60%", "40%"]}
            labels={[
              "23. Name of Children (write full name, list all)",
              "Date of Birth (mm/dd/yyyy)",
            ]}
          />
          <BlankRows widths={["60%", "40%"]} count={4} />
        </View>

        <SectionHeader>III. EDUCATIONAL BACKGROUND</SectionHeader>
        <View style={styles.grid}>
          <Text style={styles.pendingNote}>{PENDING_201}</Text>
          <HeaderCells
            widths={eduWidths}
            labels={[
              "26. Level",
              "Name of School",
              "Basic Education / Degree / Course",
              "Period From-To",
              "Units Earned",
              "Year Graduated",
            ]}
          />
          {[
            "Elementary",
            "Secondary",
            "Vocational",
            "College",
            "Graduate Studies",
          ].map((level) => (
            <View key={level} style={styles.row}>
              <View style={[styles.td, { width: eduWidths[0] }]}>
                <Text>{level}</Text>
              </View>
              {eduWidths.slice(1).map((w, i) => (
                <View
                  key={i}
                  style={[
                    styles.td,
                    { width: w },
                    i === eduWidths.length - 2 ? styles.cellLast : {},
                  ]}
                >
                  <Text> </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <PageFooter serialNumber={serialNumber} generatedAt={generatedAt} />
      </Page>

      {/* ════════ PAGE 2 — Eligibility · Work Experience ════════ */}
      <Page size="LEGAL" style={styles.page}>
        <PageHeader serialNumber={serialNumber} pageNo={2} />

        <SectionHeader>IV. CIVIL SERVICE ELIGIBILITY</SectionHeader>
        <View style={styles.grid}>
          <Text style={styles.pendingNote}>{PENDING_201}</Text>
          <HeaderCells
            widths={eligWidths}
            labels={[
              "27. Career Service / RA 1080 / Board-Bar",
              "Rating",
              "Date of Exam",
              "Place of Examination",
              "License No. / Validity",
            ]}
          />
          <BlankRows widths={eligWidths} count={4} />
        </View>

        <SectionHeader>
          V. WORK EXPERIENCE (Include private employment. Start from your recent
          work)
        </SectionHeader>
        <View style={styles.grid}>
          <HeaderCells
            widths={weWidths}
            labels={[
              "28. From",
              "To",
              "Position Title",
              "Department / Agency / Company",
              "Monthly Salary",
              "SG & Step",
              "Status of Appt.",
              "Gov't",
            ]}
          />
          {workExperience.map((row, idx) => (
            <View key={idx} style={styles.row} wrap={false}>
              <View
                style={[styles.td, styles.tdCenter, { width: weWidths[0] }]}
              >
                <Text>{fmtDate(row.from)}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: weWidths[1] }]}
              >
                <Text>{row.to ? fmtDate(row.to) : "Present"}</Text>
              </View>
              <View style={[styles.td, { width: weWidths[2] }]}>
                <Text>{row.positionTitle}</Text>
              </View>
              <View style={[styles.td, { width: weWidths[3] }]}>
                <Text>{row.agency}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: weWidths[4] }]}
              >
                <Text>{money(row.monthlySalary)}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: weWidths[5] }]}
              >
                <Text>{row.gradeStep ?? ""}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: weWidths[6] }]}
              >
                <Text>{row.statusOfAppointment}</Text>
              </View>
              <View
                style={[
                  styles.td,
                  styles.tdCenter,
                  styles.cellLast,
                  { width: weWidths[7] },
                ]}
              >
                <Text>{row.isGovService ? "Y" : "N"}</Text>
              </View>
            </View>
          ))}
          <BlankRows
            widths={weWidths}
            count={Math.max(0, 6 - workExperience.length)}
          />
        </View>

        <PageFooter serialNumber={serialNumber} generatedAt={generatedAt} />
      </Page>

      {/* ════════ PAGE 3 — Voluntary Work · L&D · Other Info ════════ */}
      <Page size="LEGAL" style={styles.page}>
        <PageHeader serialNumber={serialNumber} pageNo={3} />

        <SectionHeader>
          VI. VOLUNTARY WORK OR INVOLVEMENT IN CIVIC / NON-GOVERNMENT / PEOPLE /
          VOLUNTARY ORGANIZATION/S
        </SectionHeader>
        <View style={styles.grid}>
          <Text style={styles.pendingNote}>{PENDING_201}</Text>
          <HeaderCells
            widths={["40%", "14%", "14%", "10%", "22%"]}
            labels={[
              "29. Name & Address of Organization",
              "From",
              "To",
              "Hours",
              "Position / Nature of Work",
            ]}
          />
          <BlankRows widths={["40%", "14%", "14%", "10%", "22%"]} count={3} />
        </View>

        <SectionHeader>
          VII. LEARNING AND DEVELOPMENT (L&D) INTERVENTIONS / TRAINING PROGRAMS
          ATTENDED
        </SectionHeader>
        <View style={styles.grid}>
          <HeaderCells
            widths={ldWidths}
            labels={[
              "30. Title of Learning and Development Intervention",
              "From",
              "To",
              "Hours",
              "Conducted / Sponsored By",
            ]}
          />
          {trainings.map((t, idx) => (
            <View key={idx} style={styles.row} wrap={false}>
              <View style={[styles.td, { width: ldWidths[0] }]}>
                <Text>{t.title}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: ldWidths[1] }]}
              >
                <Text>{fmtDate(t.from)}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: ldWidths[2] }]}
              >
                <Text>{fmtDate(t.to)}</Text>
              </View>
              <View
                style={[styles.td, styles.tdCenter, { width: ldWidths[3] }]}
              >
                <Text>{t.hours ?? ""}</Text>
              </View>
              <View
                style={[styles.td, styles.cellLast, { width: ldWidths[4] }]}
              >
                <Text>{t.conductedBy ?? ""}</Text>
              </View>
            </View>
          ))}
          <BlankRows
            widths={ldWidths}
            count={Math.max(0, 5 - trainings.length)}
          />
        </View>

        <SectionHeader>VIII. OTHER INFORMATION</SectionHeader>
        <View style={styles.grid}>
          <HeaderCells
            widths={["34%", "33%", "33%"]}
            labels={[
              "31. Special Skills and Hobbies",
              "32. Non-Academic Distinctions / Recognition",
              "33. Membership in Association / Organization",
            ]}
          />
          {Array.from({
            length: Math.max(4, skills.length + hobbies.length),
          }).map((_, idx) => {
            const combined = [...skills, ...hobbies];
            return (
              <View key={idx} style={styles.row}>
                <View style={[styles.td, { width: "34%" }]}>
                  <Text>{combined[idx] ?? " "}</Text>
                </View>
                <View style={[styles.td, { width: "33%" }]}>
                  <Text> </Text>
                </View>
                <View style={[styles.td, styles.cellLast, { width: "33%" }]}>
                  <Text> </Text>
                </View>
              </View>
            );
          })}
        </View>

        <PageFooter serialNumber={serialNumber} generatedAt={generatedAt} />
      </Page>

      {/* ════════ PAGE 4 — Questions · References · Declaration ════════ */}
      <Page size="LEGAL" style={styles.page}>
        <PageHeader serialNumber={serialNumber} pageNo={4} />

        <SectionHeader>34–40. QUESTIONS</SectionHeader>
        <View style={styles.grid}>
          <Text style={styles.pendingNote}>
            To be answered and initialed by the employee upon signing (data not
            captured by the system yet).
          </Text>
          {[
            "34. Are you related by consanguinity or affinity to the appointing or recommending authority, or to the chief of bureau or office, or to the person who has immediate supervision over you in the Office, Bureau or Department where you will be appointed?",
            "35. a. Have you ever been found guilty of any administrative offense? b. Have you been criminally charged before any court?",
            "36. Have you ever been convicted of any crime or violation of any law, decree, ordinance or regulation by any court or tribunal?",
            "37. Have you ever been separated from the service in any of the following modes: resignation, retirement, dropped from the rolls, dismissal, termination, end of term, finished contract or phased out (abolition) in the public or private sector?",
            "38. a. Have you ever been a candidate in a national or local election held within the last year? b. Have you resigned from the government service during the three (3)-month period before the last election?",
            "39. Have you acquired the status of an immigrant or permanent resident of another country?",
            "40. Pursuant to: (a) Indigenous People's Act (RA 8371); (b) Magna Carta for Disabled Persons (RA 7277); and (c) Solo Parents Welfare Act of 2000 (RA 8972), please answer the following items:",
          ].map((q, idx) => (
            <View key={idx} style={styles.row}>
              <View style={[styles.td, { width: "78%" }]}>
                <Text>{q}</Text>
              </View>
              <View style={[styles.td, styles.tdCenter, { width: "11%" }]}>
                <Text style={styles.label}>Yes ( )</Text>
              </View>
              <View
                style={[
                  styles.td,
                  styles.tdCenter,
                  styles.cellLast,
                  { width: "11%" },
                ]}
              >
                <Text style={styles.label}>No ( )</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionHeader>
          41. REFERENCES (Person not related by consanguinity or affinity to
          applicant / appointee)
        </SectionHeader>
        <View style={styles.grid}>
          <Text style={styles.pendingNote}>{PENDING_201}</Text>
          <HeaderCells
            widths={["40%", "40%", "20%"]}
            labels={["Name", "Address", "Tel. No."]}
          />
          <BlankRows widths={["40%", "40%", "20%"]} count={3} />
        </View>

        <Text style={styles.declaration}>
          42. I declare under oath that I have personally accomplished this
          Personal Data Sheet which is a true, correct and complete statement
          pursuant to the provisions of pertinent laws, rules and regulations of
          the Republic of the Philippines. I authorize the agency head /
          authorized representative to verify / validate the contents stated
          herein. I agree that any misrepresentation made in this document and
          its attachments shall cause the filing of administrative / criminal
          case/s against me.
        </Text>

        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>
              Government Issued ID (i.e. Passport, GSIS, SSS, PRC, Driver's
              License, etc.) — ID/License/Passport No. & Date of Issuance
            </Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>
              Signature (Sign inside the box) / Date Accomplished
            </Text>
          </View>
          <View style={styles.photoBox}>
            <Text style={styles.photoText}>
              ID picture taken within the last 6 months (4.5 cm x 3.5 cm)
            </Text>
          </View>
          <View style={[styles.photoBox, { width: 80, height: 80 }]}>
            <Text style={styles.photoText}>Right Thumbmark</Text>
          </View>
        </View>

        <PageFooter serialNumber={serialNumber} generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
