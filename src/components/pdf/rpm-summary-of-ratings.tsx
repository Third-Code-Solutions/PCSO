/**
 * RpmSummaryOfRatings — TOR 1.2.21 Summary of Ratings report.
 *
 * Distinct from the RatingSheet (raw score-encoding output): this is the
 * board-facing consolidated report ranked by total weighted score with rank
 * numbers, per-dimension breakdown, an advisory descriptive rating column,
 * internal-applicant tagging, and the applicant's current pipeline status.
 * Header carries the org-profile agency identity like every other PCSO
 * document generator.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#E5E7EB";
const GRAY = "#6B7280";
const ALT = "#F9FAFB";

export interface SummaryOfRatingsRow {
  rank: number;
  referenceNo: string;
  applicantName: string;
  /** True when filed by a current PCSO employee (internal promotion). */
  isInternal: boolean;
  perDimension: ReadonlyArray<{
    dimension: string;
    score: number;
    maxScore: number;
  }>;
  totalWeightedScore: number;
  /** Advisory descriptive rating derived from the composite score. */
  adjectival: string;
  /** Current application status (qualified / shortlisted / for_interview …). */
  status: string;
}

export interface RpmSummaryOfRatingsProps {
  serial: string;
  agencyName: string;
  vacancyTitle: string;
  itemNumber: string;
  /** ISO datetime of the assessment, when one exists. */
  examDate: string | null;
  /** Ordered dimension column names. */
  dimensionNames: ReadonlyArray<string>;
  rows: ReadonlyArray<SummaryOfRatingsRow>;
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
  td: { fontSize: 7.5, color: "#374151" },
  tdBold: { fontSize: 7.5, color: NAVY, fontFamily: "Helvetica-Bold" },
  colRank: { width: 28, textAlign: "center" },
  colRef: { width: 76 },
  colName: { flex: 1 },
  colInternal: { width: 40, textAlign: "center" },
  colDim: { width: 50, textAlign: "center" },
  colTotal: { width: 46, textAlign: "right" },
  colAdjectival: { width: 72, textAlign: "center" },
  colStatus: { width: 62 },
  footer: { marginTop: 14, fontSize: 7, color: GRAY },
  rule: {
    borderTopWidth: 1,
    borderTopColor: GOLD,
    marginTop: 18,
    paddingTop: 6,
  },
});

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export function RpmSummaryOfRatings(props: RpmSummaryOfRatingsProps) {
  const {
    serial,
    agencyName,
    vacancyTitle,
    itemNumber,
    examDate,
    dimensionNames,
    rows,
    generatedAt,
  } = props;

  return (
    <Document>
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.agency}>{agencyName}</Text>
            <Text style={styles.meta}>Recruitment, Placement & Mobility</Text>
          </View>
          <View>
            <Text style={styles.title}>SUMMARY OF RATINGS</Text>
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
            <Text style={styles.label}>Assessment Date</Text>
            <Text style={styles.value}>{examDate ?? "—"}</Text>
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
          <Text style={[styles.th, styles.colInternal]}>Internal</Text>
          {dimensionNames.map((name) => (
            <Text key={name} style={[styles.th, styles.colDim]}>
              {name}
            </Text>
          ))}
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
          <Text style={[styles.th, styles.colAdjectival]}>Descriptive</Text>
          <Text style={[styles.th, styles.colStatus]}>Status</Text>
        </View>

        {rows.map((r, i) => {
          const rowStyle = [styles.row, i % 2 === 1 ? styles.rowAlt : {}];
          return (
            <View key={`${r.rank}-${r.referenceNo}`} style={rowStyle}>
              <Text style={[styles.tdBold, styles.colRank]}>{r.rank}</Text>
              <Text style={[styles.td, styles.colRef]}>{r.referenceNo}</Text>
              <Text style={[styles.td, styles.colName]}>{r.applicantName}</Text>
              <Text style={[styles.td, styles.colInternal]}>
                {r.isInternal ? "Yes" : "—"}
              </Text>
              {dimensionNames.map((name) => {
                const d = r.perDimension.find((x) => x.dimension === name);
                return (
                  <Text key={name} style={[styles.td, styles.colDim]}>
                    {d ? `${d.score}/${d.maxScore}` : "—"}
                  </Text>
                );
              })}
              <Text style={[styles.tdBold, styles.colTotal]}>
                {r.totalWeightedScore.toFixed(2)}
              </Text>
              <Text style={[styles.td, styles.colAdjectival]}>
                {r.adjectival}
              </Text>
              <Text style={[styles.td, styles.colStatus]}>
                {formatStatus(r.status)}
              </Text>
            </View>
          );
        })}

        <View style={styles.rule}>
          <Text style={styles.footer}>
            Total is the weighted composite (0–100) computed by the HRIS per the
            configured assessment dimensions. The Descriptive column is an
            advisory banding of the composite for readability — it is not a CSC
            performance rating. Ranking uses standard competition ranking; tied
            scores share a rank.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default RpmSummaryOfRatings;
