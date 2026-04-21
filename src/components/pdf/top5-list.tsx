/**
 * Top5List — the shortlist PDF submitted to the General Manager for selection.
 * Compact one-pager with the top five candidates only.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#E5E7EB";
const GRAY = "#6B7280";

export interface Top5Entry {
  rank: number;
  referenceNo: string;
  applicantName: string;
  currentPosition: string;
  totalWeightedScore: number;
}

export interface Top5ListProps {
  serial: string;
  agencyName: string;
  vacancyTitle: string;
  itemNumber: string;
  entries: ReadonlyArray<Top5Entry>;
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
  positionBlock: { marginBottom: 16 },
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
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  td: { fontSize: 9.5, color: "#374151" },
  colRank: { width: 36, textAlign: "center" },
  colRef: { width: 100 },
  colName: { flex: 1 },
  colPos: { flex: 1 },
  colScore: { width: 56, textAlign: "right" },
  footer: { marginTop: 28, fontSize: 8, color: GRAY },
  rule: {
    borderTopWidth: 1,
    borderTopColor: GOLD,
    marginTop: 28,
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

export function Top5List(props: Top5ListProps) {
  const { serial, agencyName, vacancyTitle, itemNumber, entries, generatedAt } =
    props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.agency}>{agencyName}</Text>
            <Text style={styles.meta}>
              Office of the Human Resources Management
            </Text>
          </View>
          <View>
            <Text style={styles.title}>SHORTLIST — TOP 5</Text>
            <Text style={styles.sub}>Serial: {serial}</Text>
            <Text style={styles.sub}>Generated: {generatedAt}</Text>
          </View>
        </View>

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
          <Text style={[styles.th, styles.colScore]}>Score</Text>
        </View>
        {entries.map((e) => (
          <View key={`${e.rank}-${e.referenceNo}`} style={styles.row}>
            <Text style={[styles.td, styles.colRank]}>{e.rank}</Text>
            <Text style={[styles.td, styles.colRef]}>{e.referenceNo}</Text>
            <Text style={[styles.td, styles.colName]}>{e.applicantName}</Text>
            <Text style={[styles.td, styles.colPos]}>{e.currentPosition}</Text>
            <Text style={[styles.td, styles.colScore]}>
              {e.totalWeightedScore.toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.rule}>
          <Text style={styles.footer}>
            Respectfully submitted for the General Manager&apos;s selection.
            Upon selection, the GM will designate candidates to advance for the
            board interview.
          </Text>
        </View>

        <View style={styles.sig}>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>HR Officer</Text>
          </View>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Noted by: General Manager</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default Top5List;
