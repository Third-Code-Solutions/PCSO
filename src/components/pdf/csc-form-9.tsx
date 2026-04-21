/**
 * CSC Form 9 — Publication of Vacant Position.
 *
 * Rendered via @react-pdf/renderer. Matches the layout prescribed by
 * CSC MC No. 24, s. 2017: agency header block, position summary,
 * qualification standards table (Education / Training / Experience /
 * Eligibility / Competencies), place of assignment, application
 * deadline, and signatory slots.
 *
 * Use with `renderToBuffer(<CscForm9 data={...} />)` from a server
 * action to generate bytes for Supabase storage upload.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CscForm9Data } from "@/lib/utils/rpm/csc-form-9-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CscForm9Props {
  data: CscForm9Data;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BORDER = "#111827";
const MUTED = "#4B5563";
const ACCENT = "#1E3A8A";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 32,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
  },
  agencyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
  },
  agencyAddress: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  formBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    marginTop: 6,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    fontSize: 8.5,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginVertical: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowLast: {
    flexDirection: "row",
  },
  labelCell: {
    width: "32%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#F3F4F6",
  },
  valueCell: {
    width: "68%",
    padding: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginTop: 14,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  deadlineBox: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: "solid",
  },
  deadlineLabel: {
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 2,
  },
  signatoryBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  signatorySlot: {
    width: "45%",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  signatoryRole: {
    fontSize: 8,
    color: MUTED,
  },
  footerNote: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 7,
    color: MUTED,
    textAlign: "center",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CscForm9({ data }: CscForm9Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agencyName}>{data.agencyName}</Text>
          <Text style={styles.agencyAddress}>{data.agencyAddress}</Text>
          <Text style={styles.formBadge}>CSC FORM NO. 9 (Revised 2018)</Text>
        </View>

        <Text style={styles.title}>PUBLICATION OF VACANT POSITION</Text>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>Publication No.: </Text>
            {data.cscForm9Number}
          </Text>
          <Text>
            <Text style={styles.metaLabel}>Date Posted: </Text>
            {data.publishedAt}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>MRF Reference: </Text>
            {data.mrfNumber}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Position Title</Text>
            <Text style={styles.valueCell}>{data.position.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Plantilla Item No.</Text>
            <Text style={styles.valueCell}>{data.position.itemNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Salary Grade</Text>
            <Text style={styles.valueCell}>
              SG {data.position.salaryGrade} — {data.position.monthlySalaryPhp}
              /month
            </Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.labelCell}>Place of Assignment</Text>
            <Text style={styles.valueCell}>
              {data.position.placeOfAssignment}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Qualification Standards</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Education</Text>
            <Text style={styles.valueCell}>
              {data.qualificationStandards.education}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Training</Text>
            <Text style={styles.valueCell}>
              {data.qualificationStandards.training}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Experience</Text>
            <Text style={styles.valueCell}>
              {data.qualificationStandards.experience}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Eligibility</Text>
            <Text style={styles.valueCell}>
              {data.qualificationStandards.eligibility}
            </Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.labelCell}>Competencies</Text>
            <Text style={styles.valueCell}>
              {data.qualificationStandards.competencies}
            </Text>
          </View>
        </View>

        <View style={styles.deadlineBox}>
          <Text style={styles.deadlineLabel}>
            DEADLINE FOR SUBMISSION OF APPLICATIONS
          </Text>
          <Text>{data.applicationDeadline}</Text>
        </View>

        <View style={styles.signatoryBlock}>
          <View style={styles.signatorySlot}>
            <Text>HRMO Designate</Text>
            <Text style={styles.signatoryRole}>
              Human Resource Management Officer
            </Text>
          </View>
          <View style={styles.signatorySlot}>
            <Text>General Manager</Text>
            <Text style={styles.signatoryRole}>Approving Authority</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Interested applicants may submit a letter of intent, updated PDS (CS
          Form No. 212), and supporting documents via the official PCSO
          applicant portal on or before the deadline above.
        </Text>
      </Page>
    </Document>
  );
}

export default CscForm9;
