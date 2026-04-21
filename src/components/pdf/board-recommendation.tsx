/**
 * BoardRecommendation — the final PDF recommending candidates for the
 * appointing authority. Emitted when the GM promotes shortlisted applicants
 * to "for_board" per CLAUDE.md §12.3.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#E5E7EB";
const GRAY = "#6B7280";

export interface BoardRecommendationEntry {
  rank: number;
  referenceNo: string;
  applicantName: string;
  currentPosition: string;
  eligibility: string;
  totalWeightedScore: number;
}

export interface BoardRecommendationProps {
  serial: string;
  agencyName: string;
  vacancyTitle: string;
  itemNumber: string;
  recommendedBy: string;
  recommendedByTitle: string;
  entries: ReadonlyArray<BoardRecommendationEntry>;
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 36,
    color: "#111827",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  agency: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },
  meta: { fontSize: 8, color: GRAY, marginTop: 2 },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
  },
  sub: { fontSize: 8, color: GRAY, textAlign: "right", marginTop: 2 },
  intro: { fontSize: 10, color: "#374151", lineHeight: 1.5, marginBottom: 14 },
  positionBlock: { marginBottom: 14 },
  label: {
    fontSize: 7.5,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 11,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  row: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  td: { fontSize: 9, color: "#374151" },
  colRank: { width: 30, textAlign: "center" },
  colRef: { width: 86 },
  colName: { flex: 1.2 },
  colPos: { flex: 1 },
  colElig: { width: 72 },
  colScore: { width: 48, textAlign: "right" },
  closing: { marginTop: 20, fontSize: 10, color: "#374151", lineHeight: 1.5 },
  rule: {
    borderTopWidth: 1,
    borderTopColor: GOLD,
    marginTop: 24,
    paddingTop: 8,
  },
  sig: { flexDirection: "row", gap: 24, marginTop: 48 },
  sigBox: { flex: 1 },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    marginBottom: 3,
    height: 20,
  },
  sigLabel: { fontSize: 8, color: GRAY, textTransform: "uppercase" },
});

export function BoardRecommendation(props: BoardRecommendationProps) {
  const {
    serial,
    agencyName,
    vacancyTitle,
    itemNumber,
    recommendedBy,
    recommendedByTitle,
    entries,
    generatedAt,
  } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.agency}>{agencyName}</Text>
            <Text style={styles.meta}>Office of the General Manager</Text>
          </View>
          <View>
            <Text style={styles.title}>BOARD RECOMMENDATION</Text>
            <Text style={styles.sub}>Serial: {serial}</Text>
            <Text style={styles.sub}>Generated: {generatedAt}</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          Pursuant to the results of the assessment proceedings conducted by the
          Human Resource Merit Promotion and Selection Board, the following
          applicants are hereby endorsed for board interview and final
          deliberation.
        </Text>

        <View style={styles.positionBlock}>
          <Text style={styles.label}>Position</Text>
          <Text style={styles.value}>{vacancyTitle}</Text>
          <Text style={[styles.label, { marginTop: 8 }]}>Item Number</Text>
          <Text style={styles.value}>{itemNumber}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colRank]}>Rank</Text>
          <Text style={[styles.th, styles.colRef]}>Ref. No.</Text>
          <Text style={[styles.th, styles.colName]}>Applicant</Text>
          <Text style={[styles.th, styles.colPos]}>Current Position</Text>
          <Text style={[styles.th, styles.colElig]}>Eligibility</Text>
          <Text style={[styles.th, styles.colScore]}>Score</Text>
        </View>
        {entries.map((e) => (
          <View key={`${e.rank}-${e.referenceNo}`} style={styles.row}>
            <Text style={[styles.td, styles.colRank]}>{e.rank}</Text>
            <Text style={[styles.td, styles.colRef]}>{e.referenceNo}</Text>
            <Text style={[styles.td, styles.colName]}>{e.applicantName}</Text>
            <Text style={[styles.td, styles.colPos]}>{e.currentPosition}</Text>
            <Text style={[styles.td, styles.colElig]}>{e.eligibility}</Text>
            <Text style={[styles.td, styles.colScore]}>
              {e.totalWeightedScore.toFixed(2)}
            </Text>
          </View>
        ))}

        <Text style={styles.closing}>
          The foregoing list is respectfully submitted for the appointing
          authority&apos;s consideration, consistent with CSC MC No. 03 s. 2001
          (as amended) and the agency&apos;s Merit Selection Plan.
        </Text>

        <View style={styles.rule} />
        <View style={styles.sig}>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>{recommendedBy}</Text>
            <Text style={styles.sigLabel}>{recommendedByTitle}</Text>
          </View>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Appointing Authority</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default BoardRecommendation;
