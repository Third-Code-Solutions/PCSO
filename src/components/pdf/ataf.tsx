/**
 * Assignment, Transfer, and Acceptance Form (ATAF).
 *
 * Issued with the appointment package (CLAUDE.md §12.3). Formalizes the
 * appointee's assignment to a specific office/division and records the
 * office head's acceptance of the employee.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";
const LIGHT = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 40,
    backgroundColor: "#FFFFFF",
    fontSize: 10,
    color: "#111827",
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
  },
  agency: {
    fontSize: 8,
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
  subtitle: { fontSize: 8, color: GRAY, marginTop: 2 },
  serial: { textAlign: "right", fontSize: 9, color: GRAY, marginBottom: 14 },
  section: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
  },
  sectionHeader: {
    backgroundColor: LIGHT,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBody: { padding: 10 },
  row: { flexDirection: "row", marginBottom: 5 },
  label: {
    width: 150,
    fontSize: 9,
    color: GRAY,
    textTransform: "uppercase",
  },
  value: { flex: 1, fontSize: 10, fontFamily: "Helvetica-Bold" },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.7,
    marginBottom: 10,
  },
  acceptanceBox: {
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    paddingLeft: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  signatureRow: {
    marginTop: 24,
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
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 6, color: GRAY, textAlign: "center" },
});

export interface AtafPdfSignatory {
  name: string;
  role: string;
}

export interface AtafPdfProps {
  serialNumber: string; // ATAF-YYYY-NNNNNN
  appointee: {
    fullName: string;
    employeeNo: string;
    positionTitle: string;
  };
  assignment: {
    office: string;
    division?: string;
    effectiveDate: string;
    previousAssignment?: string;
    natureOfMovement:
      | "new_appointment"
      | "transfer"
      | "detail"
      | "reassignment";
  };
  appointingAuthority: AtafPdfSignatory;
  officeHead: AtafPdfSignatory;
  generatedAt?: string;
}

export function AtafPdf({
  serialNumber,
  appointee,
  assignment,
  appointingAuthority,
  officeHead,
  generatedAt,
}: AtafPdfProps) {
  return (
    <Document title={`ATAF — ${appointee.fullName}`} author="PCSO HRIS">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>
            Philippine Charity Sweepstakes Office
          </Text>
          <Text style={styles.title}>
            Assignment, Transfer &amp; Acceptance Form
          </Text>
          <Text style={styles.subtitle}>Personnel Movement Record — ATAF</Text>
        </View>

        <Text style={styles.serial}>Ref: {serialNumber}</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Employee</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.row}>
              <Text style={styles.label}>Full Name</Text>
              <Text style={styles.value}>{appointee.fullName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Employee No.</Text>
              <Text style={styles.value}>{appointee.employeeNo}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Position Title</Text>
              <Text style={styles.value}>{appointee.positionTitle}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. Assignment</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.row}>
              <Text style={styles.label}>Nature of Movement</Text>
              <Text style={styles.value}>
                {assignment.natureOfMovement.replace("_", " ").toUpperCase()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Office</Text>
              <Text style={styles.value}>{assignment.office}</Text>
            </View>
            {assignment.division && (
              <View style={styles.row}>
                <Text style={styles.label}>Division</Text>
                <Text style={styles.value}>{assignment.division}</Text>
              </View>
            )}
            {assignment.previousAssignment && (
              <View style={styles.row}>
                <Text style={styles.label}>Previous Assignment</Text>
                <Text style={styles.value}>
                  {assignment.previousAssignment}
                </Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Effective Date</Text>
              <Text style={styles.value}>{assignment.effectiveDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.acceptanceBox}>
          <Text style={styles.paragraph}>
            I, {officeHead.name}, in my capacity as {officeHead.role}, hereby
            accept the above-named employee into the assignment detailed in
            Section 2 and commit to provide the necessary onboarding, work
            assignment, and supervisory oversight in accordance with PCSO
            policies and applicable Civil Service rules.
          </Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{appointingAuthority.name}</Text>
            <Text style={styles.signatureRole}>{appointingAuthority.role}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{officeHead.name}</Text>
            <Text style={styles.signatureRole}>{officeHead.role}</Text>
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
