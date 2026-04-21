/**
 * Assumption of Duty Certificate.
 *
 * Issued with the appointment package (CLAUDE.md §12.3). Records the actual
 * reporting date of the appointee, which drives payroll/leave accrual start.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 44,
    backgroundColor: "#FFFFFF",
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
  serial: { textAlign: "right", fontSize: 9, color: GRAY, marginBottom: 14 },
  paragraph: { fontSize: 10.5, lineHeight: 1.8, marginBottom: 14 },
  highlight: {
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    paddingLeft: 10,
    marginVertical: 10,
  },
  detailRow: { flexDirection: "row", marginBottom: 5 },
  detailLabel: {
    width: 150,
    fontSize: 9,
    color: GRAY,
    textTransform: "uppercase",
  },
  detailValue: { flex: 1, fontSize: 10, fontFamily: "Helvetica-Bold" },
  signatureRow: {
    marginTop: 38,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: { width: 220 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    height: 34,
    marginBottom: 4,
  },
  signatureName: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  signatureRole: { fontSize: 8, color: GRAY, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 6, color: GRAY, textAlign: "center" },
});

export interface AssumptionDutySignatory {
  name: string;
  role: string;
}

export interface AssumptionDutyPdfProps {
  serialNumber: string; // ADO-YYYY-NNNNNN
  appointee: {
    fullName: string;
    employeeNo: string;
    positionTitle: string;
    salaryGrade: number;
    step: number;
    office: string;
  };
  assumptionDate: string;
  attestedBy: AssumptionDutySignatory;
  appointee_signature_label?: string;
  generatedAt?: string;
}

export function AssumptionDutyPdf({
  serialNumber,
  appointee,
  assumptionDate,
  attestedBy,
  appointee_signature_label,
  generatedAt,
}: AssumptionDutyPdfProps) {
  return (
    <Document
      title={`Assumption of Duty — ${appointee.fullName}`}
      author="PCSO HRIS"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>
            Philippine Charity Sweepstakes Office
          </Text>
          <Text style={styles.title}>Certificate of Assumption to Duty</Text>
        </View>

        <Text style={styles.serial}>Ref: {serialNumber}</Text>

        <Text style={styles.paragraph}>
          This is to certify that {appointee.fullName} assumed the duties and
          responsibilities of the position described below on the date
          indicated.
        </Text>

        <View style={styles.highlight}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Employee No.</Text>
            <Text style={styles.detailValue}>{appointee.employeeNo}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Position Title</Text>
            <Text style={styles.detailValue}>{appointee.positionTitle}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Salary Grade / Step</Text>
            <Text style={styles.detailValue}>
              SG {appointee.salaryGrade} — Step {appointee.step}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Office / Division</Text>
            <Text style={styles.detailValue}>{appointee.office}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date of Assumption</Text>
            <Text style={styles.detailValue}>{assumptionDate}</Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          This certificate is issued for whatever purpose it may serve,
          particularly for payroll and leave-credit accrual purposes in
          accordance with applicable Civil Service rules.
        </Text>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{appointee.fullName}</Text>
            <Text style={styles.signatureRole}>
              {appointee_signature_label ?? "Appointee"}
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{attestedBy.name}</Text>
            <Text style={styles.signatureRole}>{attestedBy.role}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {serialNumber} — Generated{" "}
            {generatedAt ?? new Date().toISOString().slice(0, 10)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
