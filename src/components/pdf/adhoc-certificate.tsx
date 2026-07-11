/**
 * Ad Hoc Certificate PDF — generic template-based certificate layout
 * (TOR 1.3.12 / 1.2.29 / 1.3.26, PIM-018).
 *
 * Renders a letterhead, a certificate title, pre-substituted body paragraphs
 * (see src/lib/utils/documents/template-render.ts), and a signatory block
 * sourced from fm_document_signatories when configured.
 *
 * Use with `renderToBuffer(<AdhocCertificatePdf ... />)`.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 60,
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
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  agencyAddress: {
    fontSize: 8,
    color: GRAY,
    marginBottom: 2,
  },
  serialNumber: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 6,
    color: GRAY,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 28,
    textDecoration: "underline",
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.9,
    textAlign: "justify",
    marginBottom: 14,
  },
  issuedLine: {
    fontSize: 10,
    marginTop: 18,
    marginBottom: 8,
  },
  signatureSection: {
    marginTop: 48,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 24,
  },
  signatureBlock: {
    width: 220,
    alignItems: "center",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    marginBottom: 4,
    height: 36,
    alignSelf: "stretch",
  },
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  signatureTitle: {
    fontSize: 8,
    color: GRAY,
  },
  goldRule: {
    height: 3,
    backgroundColor: GOLD,
    width: 60,
    alignSelf: "center",
    marginBottom: 24,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 60,
    right: 60,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 6.5,
    color: GRAY,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AdhocCertificateSignatory {
  name?: string | null;
  title: string;
}

export interface AdhocCertificatePdfProps {
  serialNumber: string;
  agencyName: string;
  agencyAddress?: string | null;
  contactLine?: string | null;
  /** Certificate title (already placeholder-substituted). */
  title: string;
  /** Body paragraphs (already placeholder-substituted, split on blank lines). */
  paragraphs: string[];
  /** Issuance city/date line, e.g. "Issued this 5th day of July 2026 ..." */
  issuedLine: string;
  signatories: AdhocCertificateSignatory[];
  generatedAt?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdhocCertificatePdf({
  serialNumber,
  agencyName,
  agencyAddress,
  contactLine,
  title,
  paragraphs,
  issuedLine,
  signatories,
  generatedAt,
}: AdhocCertificatePdfProps) {
  return (
    <Document title={`${title} — ${serialNumber}`} author={agencyName}>
      <Page size="LETTER" style={styles.page}>
        {/* ── Letterhead ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.agency}>{agencyName}</Text>
          {agencyAddress ? (
            <Text style={styles.agencyAddress}>{agencyAddress}</Text>
          ) : null}
          {contactLine ? (
            <Text style={styles.agencyAddress}>{contactLine}</Text>
          ) : null}
        </View>

        <Text style={styles.serialNumber}>Serial No.: {serialNumber}</Text>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.goldRule} />

        {/* ── Body ──────────────────────────────────────────────────────── */}
        {paragraphs.map((para, idx) => (
          <Text key={idx} style={styles.paragraph}>
            {para}
          </Text>
        ))}

        <Text style={styles.issuedLine}>{issuedLine}</Text>

        {/* ── Signatories ───────────────────────────────────────────────── */}
        <View style={styles.signatureSection}>
          {signatories.map((sig, idx) => (
            <View key={idx} style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>
                {sig.name ?? "________________________"}
              </Text>
              <Text style={styles.signatureTitle}>{sig.title}</Text>
            </View>
          ))}
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Serial No. {serialNumber} — {agencyName} HRIS. This document is
            system-generated; alterations void this certificate.
          </Text>
          <Text style={styles.footerText}>
            Generated: {generatedAt ?? new Date().toLocaleDateString("en-PH")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
