/**
 * Official Business (OB) Form — blank official HR form (TOR 1.9.10 / EPM-015).
 * Authorization to render duty outside official station.
 */

import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  BlankField,
  BlankFieldPair,
  BlankFormHeader,
  EmptyRows,
  FormFootnote,
  SignatureSlot,
  formStyles,
  type BlankFormHeaderProps,
} from "./form-primitives";

export function ObForm({ agencyName, agencyAddress }: BlankFormHeaderProps) {
  return (
    <Document title="Official Business Form" author={agencyName}>
      <Page size="A4" style={formStyles.page}>
        <BlankFormHeader
          agencyName={agencyName}
          agencyAddress={agencyAddress}
        />
        <Text style={formStyles.formTitle}>Official Business (OB) Form</Text>
        <Text style={formStyles.formSubtitle}>
          File before the date of travel/official business whenever practicable.
        </Text>

        <Text style={formStyles.sectionHeader}>I. EMPLOYEE INFORMATION</Text>
        <BlankFieldPair left="Name" right="Employee No." />
        <BlankFieldPair left="Position" right="Office / Division" />

        <Text style={formStyles.sectionHeader}>
          II. OFFICIAL BUSINESS DETAILS
        </Text>
        <View style={formStyles.table}>
          <View style={formStyles.tableHeaderRow}>
            {[
              "DATE",
              "DESTINATION / AGENCY",
              "TIME OF DEPARTURE",
              "TIME OF RETURN",
            ].map((h) => (
              <View key={h} style={formStyles.tableCell}>
                <Text style={formStyles.tableCellHeaderText}>{h}</Text>
              </View>
            ))}
          </View>
          <EmptyRows columns={4} count={4} />
        </View>
        <BlankField label="Purpose / Nature of Official Business" />
        <BlankField label=" " />
        <BlankField label="Supporting Document (Travel Order / Memo No., if any)" />

        <Text style={formStyles.sectionHeader}>
          III. CERTIFICATION AND APPROVAL
        </Text>
        <Text style={{ marginBottom: 10 }}>
          I certify that the above official business is in connection with my
          duties and functions.
        </Text>
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Employee's Signature / Date" />
          <SignatureSlot caption="Immediate Supervisor — Recommending Approval" />
        </View>
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Department / Division Head — Approved / Date" />
          <SignatureSlot caption="HRD — Recorded / DTR Annotated" />
        </View>

        <FormFootnote text="Approved OB time is credited as time worked on the Daily Time Record. Submit accomplished form to HRD for DTR annotation." />
      </Page>
    </Document>
  );
}
