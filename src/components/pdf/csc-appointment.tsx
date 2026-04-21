/**
 * CSC Appointment Form (Plantilla).
 *
 * Issued at APPOINTED state (CLAUDE.md §12.3, RPM-022). Renders the CSC
 * Form-33 style plantilla appointment used by the Philippine Charity Sweepstakes Office.
 *
 * Use with `renderToBuffer(<CscAppointmentPdf data={...} />)` from a server
 * action to produce bytes for Supabase storage.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontSize: 10,
    color: "#111827",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
  },
  agency: {
    fontSize: 9,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  subtitle: { fontSize: 9, color: GRAY, marginTop: 2 },
  serial: { textAlign: "right", fontSize: 9, color: GRAY, marginBottom: 12 },
  box: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 12,
    borderRadius: 3,
  },
  row: { flexDirection: "row", marginBottom: 6 },
  label: {
    width: 160,
    fontSize: 9,
    color: GRAY,
    textTransform: "uppercase",
  },
  value: { flex: 1, fontSize: 10, fontFamily: "Helvetica-Bold" },
  body: { fontSize: 10, lineHeight: 1.7, marginBottom: 14 },
  signatureRow: {
    marginTop: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: { width: 220 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    height: 36,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  signatureRole: { fontSize: 8, color: GRAY, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 6, color: GRAY },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CscAppointmentPdfSignatory {
  name: string;
  role: string;
}

export interface CscAppointmentPdfProps {
  serialNumber: string; // APT-YYYY-NNNNNN
  appointee: {
    fullName: string;
    employeeNo: string;
  };
  positionTitle: string;
  itemNumber: string;
  salaryGrade: number;
  step: number;
  monthlySalary: string;
  office: string;
  appointmentType: string;
  effectiveDate: string;
  signatories: ReadonlyArray<CscAppointmentPdfSignatory>;
  generatedAt?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CscAppointmentPdf({
  serialNumber,
  appointee,
  positionTitle,
  itemNumber,
  salaryGrade,
  step,
  monthlySalary,
  office,
  appointmentType,
  effectiveDate,
  signatories,
  generatedAt,
}: CscAppointmentPdfProps) {
  return (
    <Document
      title={`CSC Appointment — ${appointee.fullName}`}
      author="PCSO HRIS"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>
            Philippine Charity Sweepstakes Office
          </Text>
          <Text style={styles.title}>Appointment (CSC Form 33)</Text>
          <Text style={styles.subtitle}>
            Pursuant to CSC Memorandum Circular No. 24, s. 2017
          </Text>
        </View>

        <Text style={styles.serial}>Serial No.: {serialNumber}</Text>

        <View style={styles.box}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{appointee.fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Employee No.</Text>
            <Text style={styles.value}>{appointee.employeeNo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Position Title</Text>
            <Text style={styles.value}>{positionTitle}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Plantilla Item No.</Text>
            <Text style={styles.value}>{itemNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Salary Grade / Step</Text>
            <Text style={styles.value}>
              SG {salaryGrade} — Step {step}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monthly Salary</Text>
            <Text style={styles.value}>PHP {monthlySalary}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Office / Division</Text>
            <Text style={styles.value}>{office}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Appointment Type</Text>
            <Text style={styles.value}>
              {appointmentType.replace("_", " ").toUpperCase()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Effective Date</Text>
            <Text style={styles.value}>{effectiveDate}</Text>
          </View>
        </View>

        <Text style={styles.body}>
          By virtue of the authority vested in the undersigned, you are hereby
          appointed to the position described above under the terms and
          conditions prescribed by the Civil Service Commission. Your
          continuance in the service depends on the faithful and satisfactory
          performance of your duties.
        </Text>

        <View style={styles.signatureRow}>
          {signatories.map((sig, idx) => (
            <View key={idx} style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>{sig.name}</Text>
              <Text style={styles.signatureRole}>{sig.role}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Appointment {serialNumber} — PCSO HRIS
          </Text>
          <Text style={styles.footerText}>
            Generated: {generatedAt ?? new Date().toISOString().slice(0, 10)}
          </Text>
        </View>

        <View
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            width: 4,
            height: 36,
            backgroundColor: GOLD,
          }}
          fixed
        />
      </Page>
    </Document>
  );
}
