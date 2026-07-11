/**
 * Service Record PDF — React-PDF rendering (TOR 1.3.8 / PIM-012).
 *
 * CSC Service Record format: employee heading + chronological table of
 * service periods (FROM/TO, designation, status, salary, station, branch,
 * LWOP, remarks). Serial number SR-YYYY-NNNNNN from the centralized serial
 * sequence system.
 *
 * Use with `renderToBuffer(<ServiceRecordPdf ... />)` from a server action.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ServiceRecordRow } from "@/lib/utils/documents/service-history";

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F9FAFB";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontSize: 8,
    color: "#111827",
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
  },
  agency: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  agencyAddress: {
    fontSize: 7,
    color: GRAY,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 7,
    color: GRAY,
    marginTop: 2,
  },
  serialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  serialText: {
    fontSize: 8,
    color: GRAY,
  },
  // Employee heading
  headingBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: LIGHT_GRAY,
    padding: 10,
    marginBottom: 12,
  },
  headingRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  headingItem: {
    flex: 1,
    flexDirection: "row",
  },
  headingLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    marginRight: 4,
  },
  headingValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: NAVY,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: NAVY,
  },
  tableHeaderGroup: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    textAlign: "center",
    paddingVertical: 3,
  },
  th: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: "#FFFFFF",
  },
  tr: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
  td: {
    fontSize: 7.5,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  tdCenter: {
    textAlign: "center",
  },
  tdRight: {
    textAlign: "right",
  },
  // Column widths (must add up to 100%)
  colFrom: { width: "9%" },
  colTo: { width: "9%" },
  colDesignation: { width: "22%" },
  colStatus: { width: "10%" },
  colSalary: { width: "12%" },
  colStation: { width: "18%" },
  colBranch: { width: "8%" },
  colLwop: { width: "5%" },
  colRemarks: { width: "7%" },
  certText: {
    marginTop: 16,
    fontSize: 8,
    lineHeight: 1.6,
    textAlign: "justify",
  },
  signatureSection: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    width: 200,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    marginBottom: 4,
    height: 28,
  },
  signatureName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  signatureTitle: {
    fontSize: 7,
    color: GRAY,
  },
  signatureLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    marginTop: 2,
  },
  fallbackNote: {
    marginTop: 8,
    fontSize: 7,
    color: GRAY,
    fontFamily: "Helvetica-Oblique",
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 5,
  },
  footerText: {
    fontSize: 6,
    color: GRAY,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ServiceRecordPdfProps {
  serialNumber: string;
  agencyName: string;
  agencyAddress?: string | null;
  /** Branch column value (agency short name / branch designation). */
  branchLabel: string;
  employee: {
    lastName: string;
    firstName: string;
    middleName?: string | null;
    suffix?: string | null;
    employeeNo: string;
    birthDate?: string | null;
    positionTitle: string;
    officeName?: string | null;
  };
  rows: ServiceRecordRow[];
  /** True when the history was reconstructed from current-state data only. */
  isCurrentStateFallback?: boolean;
  issuedDate: string;
  issuedByName: string;
  issuedByTitle: string;
  generatedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Present";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtSalary(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceRecordPdf({
  serialNumber,
  agencyName,
  agencyAddress,
  branchLabel,
  employee,
  rows,
  isCurrentStateFallback,
  issuedDate,
  issuedByName,
  issuedByTitle,
  generatedAt,
}: ServiceRecordPdfProps) {
  const surnameFirst = [
    employee.lastName.toUpperCase(),
    [employee.firstName, employee.middleName ?? ""].filter(Boolean).join(" "),
  ].join(", ");
  const displayName = employee.suffix
    ? `${surnameFirst} ${employee.suffix}`
    : surnameFirst;

  return (
    <Document
      title={`Service Record — ${employee.lastName}, ${employee.firstName}`}
      author={agencyName}
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.agency}>{agencyName}</Text>
          {agencyAddress ? (
            <Text style={styles.agencyAddress}>{agencyAddress}</Text>
          ) : null}
          <Text style={styles.title}>Service Record</Text>
          <Text style={styles.subtitle}>
            (To be accomplished by the Human Resources Department)
          </Text>
        </View>

        <View style={styles.serialRow}>
          <Text style={styles.serialText}>Serial No.: {serialNumber}</Text>
          <Text style={styles.serialText}>Date Issued: {issuedDate}</Text>
        </View>

        {/* ── Employee heading ──────────────────────────────────────────── */}
        <View style={styles.headingBox}>
          <View style={styles.headingRow}>
            <View style={styles.headingItem}>
              <Text style={styles.headingLabel}>Name</Text>
              <Text style={styles.headingValue}>{displayName}</Text>
            </View>
          </View>
          <View style={styles.headingRow}>
            <View style={styles.headingItem}>
              <Text style={styles.headingLabel}>Employee No.</Text>
              <Text style={styles.headingValue}>{employee.employeeNo}</Text>
            </View>
            <View style={styles.headingItem}>
              <Text style={styles.headingLabel}>Date of Birth</Text>
              <Text style={styles.headingValue}>
                {employee.birthDate ? fmtDate(employee.birthDate) : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.headingRow}>
            <View style={styles.headingItem}>
              <Text style={styles.headingLabel}>Present Position</Text>
              <Text style={styles.headingValue}>{employee.positionTitle}</Text>
            </View>
            <View style={styles.headingItem}>
              <Text style={styles.headingLabel}>Office</Text>
              <Text style={styles.headingValue}>
                {employee.officeName ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Service table ─────────────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colFrom]}>From</Text>
            <Text style={[styles.th, styles.colTo]}>To</Text>
            <Text style={[styles.th, styles.colDesignation]}>
              Designation / Position
            </Text>
            <Text style={[styles.th, styles.colStatus]}>Status</Text>
            <Text style={[styles.th, styles.colSalary]}>
              Monthly Salary (PHP)
            </Text>
            <Text style={[styles.th, styles.colStation]}>
              Station / Place of Assignment
            </Text>
            <Text style={[styles.th, styles.colBranch]}>Branch</Text>
            <Text style={[styles.th, styles.colLwop]}>LWOP</Text>
            <Text style={[styles.th, styles.colRemarks]}>Cause</Text>
          </View>

          {rows.map((row, idx) => (
            <View key={idx} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.tdCenter, styles.colFrom]}>
                {fmtDate(row.dateFrom)}
              </Text>
              <Text style={[styles.td, styles.tdCenter, styles.colTo]}>
                {fmtDate(row.dateTo)}
              </Text>
              <Text style={[styles.td, styles.colDesignation]}>
                {row.designation}
              </Text>
              <Text style={[styles.td, styles.tdCenter, styles.colStatus]}>
                {row.statusLabel}
              </Text>
              <Text style={[styles.td, styles.tdRight, styles.colSalary]}>
                {fmtSalary(row.salary)}
              </Text>
              <Text style={[styles.td, styles.colStation]}>{row.station}</Text>
              <Text style={[styles.td, styles.tdCenter, styles.colBranch]}>
                {branchLabel}
              </Text>
              <Text style={[styles.td, styles.tdCenter, styles.colLwop]}>
                {row.lwop || "None"}
              </Text>
              <Text style={[styles.td, styles.colRemarks]}>{row.remarks}</Text>
            </View>
          ))}
        </View>

        {isCurrentStateFallback ? (
          <Text style={styles.fallbackNote}>
            Note: reconstructed from the current 201 file record; historical
            appointment entries prior to system migration are not yet encoded.
          </Text>
        ) : null}

        {/* ── Certification ─────────────────────────────────────────────── */}
        <Text style={styles.certText}>
          This is to certify that the foregoing is a true statement of service
          rendered by the above-named employee based on the records of this
          Office. Issued in compliance with the requirements of the Civil
          Service Commission and for whatever legal purpose it may serve.
        </Text>

        {/* ── Signature ─────────────────────────────────────────────────── */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{issuedByName}</Text>
            <Text style={styles.signatureTitle}>{issuedByTitle}</Text>
            <Text style={styles.signatureLabel}>Certified Correct</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={[styles.signatureTitle, { color: GOLD }]}>
              Official Dry Seal
            </Text>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Serial No. {serialNumber} — {agencyName} HRIS
          </Text>
          <Text style={styles.footerText}>
            Generated: {generatedAt ?? new Date().toLocaleDateString("en-PH")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
