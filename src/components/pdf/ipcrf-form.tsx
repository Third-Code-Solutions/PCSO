/**
 * IPCRF PDF template — React-PDF rendering.
 *
 * Official CSC Individual Performance Commitment and Review Form (IPCRF).
 * Follows the standard CSC format for government agencies.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { KraRatingData } from '@/app/(dashboard)/performance/queries';
import { RATING_BANDS } from '@/lib/constants/performance';
import type { AdjectivalRating } from '@/lib/constants/performance';

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = '#0B2545';
const GOLD = '#C8A84B';
const GRAY = '#6B7280';
const LIGHT_GRAY = '#F9FAFB';
const BORDER = '#E5E7EB';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    padding: 36,
    fontSize: 8,
    color: '#111827',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 8,
    color: GRAY,
    textAlign: 'center',
    marginTop: 2,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    backgroundColor: LIGHT_GRAY,
    padding: '4 8',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoField: {
    flex: 1,
    minWidth: 150,
  },
  infoLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 8,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: NAVY,
  },
  tableHeader: {
    padding: '5 6',
    fontSize: 7,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableCell: {
    padding: '5 6',
    fontSize: 8,
    color: '#111827',
  },
  tableCellAlt: {
    padding: '5 6',
    fontSize: 8,
    color: '#111827',
    backgroundColor: LIGHT_GRAY,
  },
  ratingCell: {
    padding: '5 6',
    fontSize: 8,
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  weightCell: {
    padding: '5 6',
    fontSize: 8,
    color: '#111827',
    textAlign: 'center',
  },
  finalRatingBox: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: NAVY,
    borderRadius: 4,
    padding: '8 12',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  finalRatingLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  finalRatingValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  finalRatingAdjectival: {
    fontSize: 10,
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
  },
  signatureSection: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 24,
  },
  signatureBlock: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    width: '100%',
    marginBottom: 4,
    height: 32,
  },
  signatureLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  signatureName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#111827',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6,
    color: GRAY,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IpcrfPdfProps {
  employee: {
    fullName: string;
    employeeNo: string;
    positionTitle: string;
    officeName: string;
    salaryGrade: number;
    step: number;
  };
  period: {
    year: number;
    semester: '1' | '2';
    dateFrom: string;
    dateTo: string;
  };
  kras: KraRatingData[];
  numericalRating?: number;
  adjectivalRating?: AdjectivalRating;
  raterName?: string;
  approverName?: string;
  generatedAt?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IpcrfPdf({
  employee,
  period,
  kras,
  numericalRating,
  adjectivalRating,
  raterName,
  approverName,
  generatedAt,
}: IpcrfPdfProps) {
  const semLabel = period.semester === '1' ? '1st Semester' : '2nd Semester';
  const periodLabel = `${semLabel}, ${period.year}`;
  const hasRatings = kras.some((k) => typeof k.rating === 'number');
  const adjectivalLabel =
    adjectivalRating ? RATING_BANDS[adjectivalRating].label : 'Not Yet Rated';

  return (
    <Document
      title={`IPCRF — ${employee.fullName} — ${periodLabel}`}
      author="Senate of the Philippines HRIS"
    >
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Individual Performance Commitment and Review Form (IPCRF)
          </Text>
          <Text style={styles.headerSubtitle}>
            Senate of the Philippines — SPMS Form No. 1 — {periodLabel}
          </Text>
        </View>

        {/* ── Employee Info ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoField}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{employee.fullName}</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoLabel}>Employee No.</Text>
              <Text style={styles.infoValue}>{employee.employeeNo}</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoLabel}>Position Title</Text>
              <Text style={styles.infoValue}>{employee.positionTitle}</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoLabel}>Office / Division</Text>
              <Text style={styles.infoValue}>{employee.officeName}</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoLabel}>Salary Grade / Step</Text>
              <Text style={styles.infoValue}>
                SG {employee.salaryGrade} / Step {employee.step}
              </Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoLabel}>Rating Period</Text>
              <Text style={styles.infoValue}>
                {period.dateFrom} to {period.dateTo}
              </Text>
            </View>
          </View>
        </View>

        {/* ── KRA Table ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Targets and Ratings</Text>
          <View style={styles.table}>
            {/* Table header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeader, { width: 20 }]}>#</Text>
              <Text style={[styles.tableHeader, { flex: 2 }]}>Key Result Area</Text>
              <Text style={[styles.tableHeader, { flex: 2 }]}>Success Indicators / Targets</Text>
              <Text style={[styles.tableHeader, { width: 40 }]}>Weight (%)</Text>
              {hasRatings && (
                <>
                  <Text style={[styles.tableHeader, { flex: 2 }]}>Actual Accomplishments</Text>
                  <Text style={[styles.tableHeader, { width: 45 }]}>Rating</Text>
                </>
              )}
            </View>

            {/* KRA rows */}
            {kras.map((kra, idx) => {
              const isAlt = idx % 2 === 1;
              const cell = isAlt ? styles.tableCellAlt : styles.tableCell;
              return (
                <View key={kra.position} style={styles.tableRow}>
                  <Text style={[cell, { width: 20, textAlign: 'center' }]}>{kra.position}</Text>
                  <Text style={[cell, { flex: 2 }]}>{kra.title}</Text>
                  <Text style={[cell, { flex: 2 }]}>{kra.successIndicators}</Text>
                  <Text style={[cell, styles.weightCell, { width: 40 }]}>{kra.weight}%</Text>
                  {hasRatings && (
                    <>
                      <Text style={[cell, { flex: 2 }]}>
                        {kra.actualAccomplishments ?? ''}
                      </Text>
                      <Text style={[cell, styles.ratingCell, { width: 45 }]}>
                        {typeof kra.rating === 'number' ? kra.rating.toFixed(3) : '—'}
                      </Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Final Rating ───────────────────────────────────────────────── */}
        {hasRatings && numericalRating !== undefined && (
          <View style={styles.finalRatingBox}>
            <Text style={styles.finalRatingLabel}>Final Computed Rating</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={styles.finalRatingValue}>{numericalRating.toFixed(3)}</Text>
              <Text style={styles.finalRatingAdjectival}>{adjectivalLabel}</Text>
            </View>
          </View>
        )}

        {/* ── Signatures ─────────────────────────────────────────────────── */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{employee.fullName}</Text>
            <Text style={styles.signatureLabel}>Ratee / Employee Signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{raterName ?? '________________________'}</Text>
            <Text style={styles.signatureLabel}>Immediate Supervisor / Rater</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{approverName ?? '________________________'}</Text>
            <Text style={styles.signatureLabel}>Approving Authority</Text>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            SPMS Form No. 1 — Senate of the Philippines HRIS
          </Text>
          <Text style={styles.footerText}>
            Generated: {generatedAt ?? new Date().toLocaleDateString('en-PH')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
