/**
 * Training Budget Summary PDF — React-PDF rendering.
 *
 * Used by LDM-005 cost reports and LDM-008 approval attachments.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import type { CostBreakdown } from "@/lib/utils/ldm/cost-calculator";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F9FAFB";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 48,
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
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 9,
    color: GRAY,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: {
    width: 120,
    fontSize: 9,
    color: GRAY,
  },
  metaValue: {
    flex: 1,
    fontSize: 10,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT_GRAY,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    padding: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    padding: 6,
  },
  colLabel: { flex: 3, fontSize: 9 },
  colQty: { flex: 1, fontSize: 9, textAlign: "right" },
  colUnit: { flex: 1.5, fontSize: 9, textAlign: "right" },
  colAmount: { flex: 1.5, fontSize: 9, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: NAVY,
  },
  totalLabel: {
    flex: 5.5,
    fontSize: 10,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalAmount: {
    flex: 1.5,
    fontSize: 11,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
});

export interface TrainingBudgetSummaryProps {
  agencyName: string;
  programName: string;
  providerName: string;
  runPeriod: { startDate: string; endDate: string };
  breakdown: CostBreakdown;
  preparedBy?: string;
}

function formatPhp(amount: number): string {
  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  });
}

export function TrainingBudgetSummary({
  agencyName,
  programName,
  providerName,
  runPeriod,
  breakdown,
  preparedBy,
}: TrainingBudgetSummaryProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>{agencyName}</Text>
          <Text style={styles.title}>Training Budget Summary</Text>
          <Text style={styles.subtitle}>Learning & Development Management</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Details</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Program</Text>
            <Text style={styles.metaValue}>{programName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Provider</Text>
            <Text style={styles.metaValue}>{providerName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Run Period</Text>
            <Text style={styles.metaValue}>
              {runPeriod.startDate} – {runPeriod.endDate}
            </Text>
          </View>
          {preparedBy ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Prepared By</Text>
              <Text style={styles.metaValue}>{preparedBy}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colLabel, { fontFamily: "Helvetica-Bold" }]}>
                Item
              </Text>
              <Text style={[styles.colQty, { fontFamily: "Helvetica-Bold" }]}>
                Qty
              </Text>
              <Text style={[styles.colUnit, { fontFamily: "Helvetica-Bold" }]}>
                Unit Cost
              </Text>
              <Text
                style={[styles.colAmount, { fontFamily: "Helvetica-Bold" }]}
              >
                Amount
              </Text>
            </View>
            {breakdown.lines.map((line, idx) => (
              <View key={`${line.label}-${idx}`} style={styles.tableRow}>
                <Text style={styles.colLabel}>{line.label}</Text>
                <Text style={styles.colQty}>{line.quantity}</Text>
                <Text style={styles.colUnit}>{formatPhp(line.unitCost)}</Text>
                <Text style={styles.colAmount}>{formatPhp(line.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Budget</Text>
              <Text style={styles.totalAmount}>
                {formatPhp(breakdown.total)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default TrainingBudgetSummary;
