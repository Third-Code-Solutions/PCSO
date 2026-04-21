/**
 * RatingSheet — consolidated scoring output after the board has encoded
 * scores. Shows every qualified applicant ranked by total weighted score,
 * with per-dimension breakdown. Used to produce the top-5 list.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#E5E7EB";
const GRAY = "#6B7280";
const ALT = "#F9FAFB";

export interface RatingSheetRow {
  rank: number;
  referenceNo: string;
  applicantName: string;
  perDimension: ReadonlyArray<{
    dimension: string;
    score: number;
    maxScore: number;
  }>;
  totalWeightedScore: number;
}

export interface RatingSheetProps {
  serial: string;
  agencyName: string;
  vacancyTitle: string;
  itemNumber: string;
  examDate: string;
  rows: ReadonlyArray<RatingSheetRow>;
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, padding: 28, color: "#111827" },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  agency: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  meta: { fontSize: 7, color: GRAY, marginTop: 1 },
  title: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
  },
  sub: { fontSize: 8, color: GRAY, textAlign: "right", marginTop: 2 },
  infoBlock: { flexDirection: "row", marginBottom: 8, gap: 12 },
  infoCell: { flex: 1 },
  label: {
    fontSize: 6.5,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 8.5,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 6.5 },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowAlt: { backgroundColor: ALT },
  top5: { backgroundColor: "#FEF7E0" },
  td: { fontSize: 7.5, color: "#374151" },
  tdBold: { fontSize: 7.5, color: NAVY, fontFamily: "Helvetica-Bold" },
  colRank: { width: 30, textAlign: "center" },
  colRef: { width: 80 },
  colName: { flex: 1 },
  colDim: { width: 54, textAlign: "center" },
  colTotal: { width: 50, textAlign: "right" },
  footer: { marginTop: 14, fontSize: 7, color: GRAY },
  rule: {
    borderTopWidth: 1,
    borderTopColor: GOLD,
    marginTop: 18,
    paddingTop: 6,
  },
});

export function RatingSheet(props: RatingSheetProps) {
  const {
    serial,
    agencyName,
    vacancyTitle,
    itemNumber,
    examDate,
    rows,
    generatedAt,
  } = props;
  const dimensionNames = rows[0]?.perDimension.map((d) => d.dimension) ?? [];

  return (
    <Document>
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.agency}>{agencyName}</Text>
            <Text style={styles.meta}>Recruitment, Placement & Mobility</Text>
          </View>
          <View>
            <Text style={styles.title}>RATING SHEET</Text>
            <Text style={styles.sub}>Serial: {serial}</Text>
            <Text style={styles.sub}>Generated: {generatedAt}</Text>
          </View>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoCell}>
            <Text style={styles.label}>Position</Text>
            <Text style={styles.value}>{vacancyTitle}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.label}>Item No.</Text>
            <Text style={styles.value}>{itemNumber}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.label}>Exam Date</Text>
            <Text style={styles.value}>{examDate}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.label}>Applicants Rated</Text>
            <Text style={styles.value}>{rows.length}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colRank]}>Rank</Text>
          <Text style={[styles.th, styles.colRef]}>Ref. No.</Text>
          <Text style={[styles.th, styles.colName]}>Applicant</Text>
          {dimensionNames.map((name) => (
            <Text key={name} style={[styles.th, styles.colDim]}>
              {name}
            </Text>
          ))}
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
        </View>

        {rows.map((r, i) => {
          const rowStyle = [
            styles.row,
            i % 2 === 1 ? styles.rowAlt : {},
            r.rank <= 5 ? styles.top5 : {},
          ];
          return (
            <View key={`${r.rank}-${r.referenceNo}`} style={rowStyle}>
              <Text style={[styles.tdBold, styles.colRank]}>{r.rank}</Text>
              <Text style={[styles.td, styles.colRef]}>{r.referenceNo}</Text>
              <Text style={[styles.td, styles.colName]}>{r.applicantName}</Text>
              {r.perDimension.map((d) => (
                <Text key={d.dimension} style={[styles.td, styles.colDim]}>
                  {d.score}/{d.maxScore}
                </Text>
              ))}
              <Text style={[styles.tdBold, styles.colTotal]}>
                {r.totalWeightedScore.toFixed(2)}
              </Text>
            </View>
          );
        })}

        <View style={styles.rule}>
          <Text style={styles.footer}>
            Scores shown are the weighted composite computed by the HRIS.
            Highlighted rows (rank 1–5) are the shortlist advanced to the
            General Manager per CLAUDE.md §12.3.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default RatingSheet;
