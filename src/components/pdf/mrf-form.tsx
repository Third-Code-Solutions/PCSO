/**
 * Manpower Request Form (MRF) — PCSO internal posting sheet.
 *
 * Rendered via @react-pdf/renderer. Used as the printed cover for
 * the 3-level approval chain (Department Head → AGM → GM).
 *
 * PRD RPM-002 / FM-022.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MrfSignatory {
  /** Role label printed beneath the signature line. */
  role: string;
  /** Optional printed name; when null the line is left blank for wet sign. */
  name: string | null;
  /** Optional decision stamp. */
  decision?: "approved" | "returned" | "pending" | null;
  /** Optional ISO date the decision was made. */
  decidedAt?: string | null;
}

export interface MrfFormProps {
  mrfNumber: string;
  requestedAt: string;
  requestor: {
    name: string;
    position: string;
    office: string;
  };
  position: {
    title: string;
    itemNumber: string;
    salaryGrade: number;
    placeOfAssignment: string;
  };
  justification: string;
  /**
   * 3 signatory slots. Caller should pass them in approval order:
   * Department Head → AGM → GM.
   */
  signatories: [MrfSignatory, MrfSignatory, MrfSignatory];
  agencyName?: string;
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
    marginBottom: 12,
  },
  agencyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginVertical: 6,
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
    width: "30%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#F3F4F6",
  },
  valueCell: {
    width: "70%",
    padding: 6,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 9,
    lineHeight: 1.4,
    padding: 6,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 60,
  },
  signatoryGrid: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatorySlot: {
    width: "31%",
    padding: 6,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 90,
  },
  signatoryRole: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 2,
  },
  signatoryName: {
    fontSize: 9,
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 2,
    textAlign: "center",
  },
  signatoryMeta: {
    fontSize: 7,
    color: MUTED,
    marginTop: 2,
    textAlign: "center",
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

const DEFAULT_AGENCY_NAME = "Philippine Charity Sweepstakes Office";

function decisionLabel(decision: MrfSignatory["decision"] | undefined): string {
  switch (decision) {
    case "approved":
      return "APPROVED";
    case "returned":
      return "RETURNED";
    case "pending":
      return "PENDING";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MrfForm(props: MrfFormProps) {
  const {
    mrfNumber,
    requestedAt,
    requestor,
    position,
    justification,
    signatories,
    agencyName = DEFAULT_AGENCY_NAME,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agencyName}>{agencyName}</Text>
        </View>

        <Text style={styles.title}>MANPOWER REQUEST FORM</Text>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>MRF No.: </Text>
            {mrfNumber || "DRAFT"}
          </Text>
          <Text>
            <Text style={styles.metaLabel}>Date: </Text>
            {requestedAt}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Requesting Office</Text>
            <Text style={styles.valueCell}>{requestor.office}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Requested by</Text>
            <Text style={styles.valueCell}>
              {requestor.name} — {requestor.position}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Position Title</Text>
            <Text style={styles.valueCell}>{position.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Plantilla Item No.</Text>
            <Text style={styles.valueCell}>{position.itemNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Salary Grade</Text>
            <Text style={styles.valueCell}>SG {position.salaryGrade}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.labelCell}>Place of Assignment</Text>
            <Text style={styles.valueCell}>{position.placeOfAssignment}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Justification</Text>
          <Text style={styles.paragraph}>{justification}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval Chain</Text>
          <View style={styles.signatoryGrid}>
            {signatories.map((s, idx) => (
              <View key={`${s.role}-${idx}`} style={styles.signatorySlot}>
                <Text style={styles.signatoryRole}>{s.role}</Text>
                <Text style={styles.signatoryName}>{s.name ?? ""}</Text>
                <Text style={styles.signatoryMeta}>
                  {decisionLabel(s.decision)}
                  {s.decidedAt ? ` — ${s.decidedAt}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footerNote}>
          Routed via HRIS. Approvals below are legally binding once digitally
          signed per PRD §4.2.1 (RPM-002).
        </Text>
      </Page>
    </Document>
  );
}

export default MrfForm;
