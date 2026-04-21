/**
 * Position Description Form (PDF / DBM-CSC Form No. 1).
 *
 * Issued with the appointment package (CLAUDE.md §12.3). Describes the
 * duties, responsibilities, reporting lines, and qualification standards
 * of the position the appointee is filling.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";
const LIGHT = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 36,
    backgroundColor: "#FFFFFF",
    fontSize: 9,
    color: "#111827",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 8,
  },
  agency: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 4,
  },
  subtitle: { fontSize: 8, color: GRAY, marginTop: 2 },
  serial: { textAlign: "right", fontSize: 8, color: GRAY, marginBottom: 10 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: LIGHT,
    padding: 4,
    borderLeftWidth: 3,
    borderLeftColor: NAVY,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { width: "50%", marginBottom: 6 },
  cellLabel: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  cellValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    fontSize: 9,
    lineHeight: 1.4,
  },
  bullet: { width: 10, fontFamily: "Helvetica-Bold" },
  listText: { flex: 1 },
  qsBox: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    borderRadius: 3,
    marginBottom: 8,
  },
  qsRow: { flexDirection: "row", marginBottom: 4 },
  qsLabel: {
    width: 110,
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
  },
  qsValue: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold" },
  signatureRow: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: { width: 180 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    height: 28,
    marginBottom: 3,
  },
  signatureName: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  signatureRole: { fontSize: 7, color: GRAY, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  footerText: { fontSize: 6, color: GRAY, textAlign: "center" },
});

export interface PositionDescriptionSignatory {
  name: string;
  role: string;
}

export interface PositionDescriptionPdfProps {
  serialNumber: string; // PDF-YYYY-NNNNNN
  positionTitle: string;
  itemNumber: string;
  salaryGrade: number;
  office: string;
  reportsTo: string;
  incumbent: string;
  duties: ReadonlyArray<string>;
  qualifications: {
    education: string;
    training: string;
    experience: string;
    eligibility: string;
    competencies?: string;
  };
  signatories: ReadonlyArray<PositionDescriptionSignatory>;
  generatedAt?: string;
}

export function PositionDescriptionPdf({
  serialNumber,
  positionTitle,
  itemNumber,
  salaryGrade,
  office,
  reportsTo,
  incumbent,
  duties,
  qualifications,
  signatories,
  generatedAt,
}: PositionDescriptionPdfProps) {
  return (
    <Document
      title={`Position Description — ${positionTitle}`}
      author="PCSO HRIS"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>
            Philippine Charity Sweepstakes Office
          </Text>
          <Text style={styles.title}>Position Description</Text>
          <Text style={styles.subtitle}>
            DBM-CSC Form No. 1 — Position Description Form
          </Text>
        </View>

        <Text style={styles.serial}>Ref: {serialNumber}</Text>

        <Text style={styles.sectionTitle}>Position Identification</Text>
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>Position Title</Text>
            <Text style={styles.cellValue}>{positionTitle}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>Plantilla Item</Text>
            <Text style={styles.cellValue}>{itemNumber}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>Salary Grade</Text>
            <Text style={styles.cellValue}>SG {salaryGrade}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>Office</Text>
            <Text style={styles.cellValue}>{office}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>Reports To</Text>
            <Text style={styles.cellValue}>{reportsTo}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>Incumbent</Text>
            <Text style={styles.cellValue}>{incumbent}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Duties and Responsibilities</Text>
        {duties.map((duty, idx) => (
          <View key={idx} style={styles.listItem}>
            <Text style={styles.bullet}>{idx + 1}.</Text>
            <Text style={styles.listText}>{duty}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Qualification Standards</Text>
        <View style={styles.qsBox}>
          <View style={styles.qsRow}>
            <Text style={styles.qsLabel}>Education</Text>
            <Text style={styles.qsValue}>{qualifications.education}</Text>
          </View>
          <View style={styles.qsRow}>
            <Text style={styles.qsLabel}>Training</Text>
            <Text style={styles.qsValue}>{qualifications.training}</Text>
          </View>
          <View style={styles.qsRow}>
            <Text style={styles.qsLabel}>Experience</Text>
            <Text style={styles.qsValue}>{qualifications.experience}</Text>
          </View>
          <View style={styles.qsRow}>
            <Text style={styles.qsLabel}>Eligibility</Text>
            <Text style={styles.qsValue}>{qualifications.eligibility}</Text>
          </View>
          {qualifications.competencies && (
            <View style={styles.qsRow}>
              <Text style={styles.qsLabel}>Competencies</Text>
              <Text style={styles.qsValue}>{qualifications.competencies}</Text>
            </View>
          )}
        </View>

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
            {serialNumber} — Generated{" "}
            {generatedAt ?? new Date().toISOString().slice(0, 10)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
