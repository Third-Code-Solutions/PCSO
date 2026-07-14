/**
 * Performance Evaluation Sheet (PES) — blank official HR form
 * (TOR 1.9.10 / EPM-015). SPMS-aligned rating sheet with the CSC MC 13
 * s. 1999 adjectival scale printed for reference.
 */

import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  BlankField,
  BlankFieldPair,
  BlankFormHeader,
  FormFootnote,
  SignatureSlot,
  formStyles,
  type BlankFormHeaderProps,
} from "./form-primitives";

const RATING_SCALE = [
  ["4.500 – 5.000", "Outstanding (O)"],
  ["3.500 – 4.499", "Very Satisfactory (VS)"],
  ["2.500 – 3.499", "Satisfactory (S)"],
  ["1.500 – 2.499", "Unsatisfactory (US)"],
  ["Below 1.500", "Poor (P)"],
];

export function PesForm({ agencyName, agencyAddress }: BlankFormHeaderProps) {
  return (
    <Document title="Performance Evaluation Sheet" author={agencyName}>
      <Page size="A4" style={formStyles.page}>
        <BlankFormHeader
          agencyName={agencyName}
          agencyAddress={agencyAddress}
        />
        <Text style={formStyles.formTitle}>
          Performance Evaluation Sheet (PES)
        </Text>
        <Text style={formStyles.formSubtitle}>
          Strategic Performance Management System (SPMS) — individual rating
          sheet.
        </Text>

        <Text style={formStyles.sectionHeader}>I. RATEE INFORMATION</Text>
        <BlankFieldPair left="Name of Ratee" right="Employee No." />
        <BlankFieldPair left="Position" right="Office / Division" />
        <BlankFieldPair
          left="Rating Period (Semester / Year)"
          right="Date of Review"
        />

        <Text style={formStyles.sectionHeader}>
          II. PERFORMANCE TARGETS AND ACCOMPLISHMENTS
        </Text>
        <View style={formStyles.table}>
          <View style={formStyles.tableHeaderRow}>
            {[
              "MFO / SUCCESS INDICATOR (TARGET + MEASURE)",
              "ACTUAL ACCOMPLISHMENT",
              "Q",
              "E",
              "T",
              "AVE.",
            ].map((h, i) => (
              <View
                key={h}
                style={[
                  formStyles.tableCell,
                  { flex: i === 0 ? 4 : i === 1 ? 3 : 1 },
                ]}
              >
                <Text style={formStyles.tableCellHeaderText}>{h}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <View key={rowIdx} style={[formStyles.tableRow, { minHeight: 24 }]}>
              {[4, 3, 1, 1, 1, 1].map((flex, colIdx) => (
                <View key={colIdx} style={[formStyles.tableCell, { flex }]}>
                  <Text> </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <BlankFieldPair
          left="Final Average Rating (numerical)"
          right="Adjectival Rating"
        />

        <Text style={formStyles.sectionHeader}>
          III. ADJECTIVAL RATING SCALE (CSC MC 13, s. 1999)
        </Text>
        <View style={formStyles.table}>
          <View style={formStyles.tableHeaderRow}>
            <View style={formStyles.tableCell}>
              <Text style={formStyles.tableCellHeaderText}>
                NUMERICAL RANGE
              </Text>
            </View>
            <View style={formStyles.tableCell}>
              <Text style={formStyles.tableCellHeaderText}>
                ADJECTIVAL EQUIVALENT
              </Text>
            </View>
          </View>
          {RATING_SCALE.map(([range, label]) => (
            <View key={range} style={formStyles.tableRow}>
              <View style={formStyles.tableCell}>
                <Text style={{ fontSize: 8, textAlign: "center" }}>
                  {range}
                </Text>
              </View>
              <View style={formStyles.tableCell}>
                <Text style={{ fontSize: 8, textAlign: "center" }}>
                  {label}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={formStyles.sectionHeader}>
          IV. COMMENTS AND SIGNATURES
        </Text>
        <BlankField label="Comments / Development Recommendations" />
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Ratee — Conforme / Date" />
          <SignatureSlot caption="Rater (Immediate Supervisor) / Date" />
          <SignatureSlot caption="Reviewer (Division Chief or higher) / Date" />
        </View>

        <FormFootnote text="Ratings feed the IPCRF for the period. Outstanding is capped at 10% and Very Satisfactory at 25% of the rated population per office (forced ranking limits)." />
      </Page>
    </Document>
  );
}
