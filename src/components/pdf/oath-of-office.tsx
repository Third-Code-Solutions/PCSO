/**
 * Oath of Office PDF.
 *
 * Issued with the CSC appointment package (CLAUDE.md §12.3). Prescribed text
 * follows Section 40, Book V, Administrative Code of 1987 (EO 292).
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 48,
    fontSize: 11,
    color: "#111827",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 12,
  },
  agency: {
    fontSize: 9,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 2,
    marginTop: 6,
  },
  serial: { textAlign: "right", fontSize: 9, color: GRAY, marginBottom: 16 },
  oath: {
    fontSize: 11,
    lineHeight: 1.9,
    marginBottom: 24,
    textAlign: "justify",
  },
  affiant: { marginTop: 28, alignItems: "center" },
  affiantLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    width: 260,
    height: 30,
    marginBottom: 4,
  },
  affiantLabel: { fontSize: 9, color: GRAY, textTransform: "uppercase" },
  jurat: { marginTop: 28, fontSize: 10, lineHeight: 1.7 },
  signatureRow: {
    marginTop: 40,
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
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  signatureRole: { fontSize: 8, color: GRAY, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 6, color: GRAY, textAlign: "center" },
});

export interface OathOfOfficeSignatory {
  name: string;
  role: string;
}

export interface OathOfOfficePdfProps {
  serialNumber: string; // OATH-YYYY-NNNNNN
  appointeeName: string;
  positionTitle: string;
  office: string;
  oathDate: string;
  administeringOfficer: OathOfOfficeSignatory;
  witness?: OathOfOfficeSignatory;
  generatedAt?: string;
}

export function OathOfOfficePdf({
  serialNumber,
  appointeeName,
  positionTitle,
  office,
  oathDate,
  administeringOfficer,
  witness,
  generatedAt,
}: OathOfOfficePdfProps) {
  return (
    <Document title={`Oath of Office — ${appointeeName}`} author="PCSO HRIS">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>Republic of the Philippines</Text>
          <Text style={styles.agency}>
            Philippine Charity Sweepstakes Office
          </Text>
          <Text style={styles.title}>OATH OF OFFICE</Text>
        </View>

        <Text style={styles.serial}>Ref: {serialNumber}</Text>

        <Text style={styles.oath}>
          I, {appointeeName.toUpperCase()}, of legal age, having been appointed
          to the position of {positionTitle} of the {office}, Philippine Charity
          Sweepstakes Office, do solemnly swear that I will support and defend
          the Constitution of the Republic of the Philippines; that I will bear
          true faith and allegiance to it; that I will obey the laws, legal
          orders and decrees promulgated by the duly constituted authorities of
          the Republic of the Philippines; that I will well and faithfully
          discharge to the best of my ability the duties of the office upon
          which I am about to enter, and that I impose this obligation upon
          myself voluntarily, without mental reservation or purpose of evasion.
          SO HELP ME GOD.
        </Text>

        <View style={styles.affiant}>
          <View style={styles.affiantLine} />
          <Text style={styles.affiantLabel}>Signature of Affiant</Text>
        </View>

        <Text style={styles.jurat}>
          SUBSCRIBED AND SWORN to before me this {oathDate}, affiant exhibiting
          to me his/her valid government-issued identification.
        </Text>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>
              {administeringOfficer.name}
            </Text>
            <Text style={styles.signatureRole}>
              {administeringOfficer.role}
            </Text>
          </View>
          {witness && (
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>{witness.name}</Text>
              <Text style={styles.signatureRole}>{witness.role}</Text>
            </View>
          )}
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
