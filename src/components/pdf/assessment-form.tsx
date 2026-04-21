/**
 * AssessmentForm — blank scoring template used by the RPM board.
 * Lists every qualified applicant for a vacancy with empty score rows for
 * each configured dimension. Printed, scored manually, then transcribed.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#E5E7EB";
const GRAY = "#6B7280";
const ALT = "#F9FAFB";

export interface AssessmentFormApplicant {
  applicationId: string;
  applicantName: string;
  referenceNo: string;
}

export interface AssessmentFormDimension {
  name: string;
  weight: number;
  maxScore: number;
}

export interface AssessmentFormProps {
  serial: string;
  agencyName: string;
  vacancyTitle: string;
  itemNumber: string;
  examDate: string;
  venue: string;
  dimensions: ReadonlyArray<AssessmentFormDimension>;
  applicants: ReadonlyArray<AssessmentFormApplicant>;
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
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    minHeight: 22,
  },
  rowAlt: { backgroundColor: ALT },
  td: { fontSize: 8, color: "#374151" },
  colNo: { width: 24 },
  colRef: { width: 90 },
  colName: { flex: 1 },
  colDim: { width: 60, textAlign: "center" },
  colTotal: { width: 50, textAlign: "center" },
  footer: { marginTop: 14, fontSize: 7, color: GRAY },
  rule: {
    borderTopWidth: 1,
    borderTopColor: GOLD,
    marginTop: 24,
    paddingTop: 6,
  },
  sig: { flexDirection: "row", gap: 24, marginTop: 30 },
  sigBox: { flex: 1 },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    marginBottom: 3,
    height: 18,
  },
  sigLabel: { fontSize: 7, color: GRAY, textTransform: "uppercase" },
});

export function AssessmentForm(props: AssessmentFormProps) {
  const {
    serial,
    agencyName,
    vacancyTitle,
    itemNumber,
    examDate,
    venue,
    dimensions,
    applicants,
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
            <Text style={styles.title}>ASSESSMENT FORM</Text>
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
            <Text style={styles.label}>Venue</Text>
            <Text style={styles.value}>{venue}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colNo]}>#</Text>
          <Text style={[styles.th, styles.colRef]}>Ref. No.</Text>
          <Text style={[styles.th, styles.colName]}>Applicant</Text>
          {dimensions.map((d) => (
            <Text key={d.name} style={[styles.th, styles.colDim]}>
              {d.name} ({d.weight}w / {d.maxScore})
            </Text>
          ))}
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
        </View>

        {applicants.map((a, i) => (
          <View
            key={a.applicationId}
            style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}
          >
            <Text style={[styles.td, styles.colNo]}>{i + 1}</Text>
            <Text style={[styles.td, styles.colRef]}>{a.referenceNo}</Text>
            <Text style={[styles.td, styles.colName]}>{a.applicantName}</Text>
            {dimensions.map((d) => (
              <Text key={d.name} style={[styles.td, styles.colDim]}>
                ___ / {d.maxScore}
              </Text>
            ))}
            <Text style={[styles.td, styles.colTotal]}>_____</Text>
          </View>
        ))}

        <View style={styles.rule}>
          <Text style={styles.footer}>
            This form is generated by the HRIS. Manual scoring must be
            transcribed back into the system by an HR Officer; this printout is
            not itself a record of the rating.
          </Text>
        </View>

        <View style={styles.sig}>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Rater — Name & Signature</Text>
          </View>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default AssessmentForm;
