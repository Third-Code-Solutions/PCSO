/**
 * Pass-Out Slip — blank official HR form (TOR 1.9.10 / EPM-015).
 * One-page fill-by-hand slip for personal/official exits during work hours.
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

export function PassOutSlipForm({
  agencyName,
  agencyAddress,
}: BlankFormHeaderProps) {
  return (
    <Document title="Pass-Out Slip" author={agencyName}>
      <Page size="A4" style={formStyles.page}>
        <BlankFormHeader
          agencyName={agencyName}
          agencyAddress={agencyAddress}
        />
        <Text style={formStyles.formTitle}>Pass-Out Slip</Text>
        <Text style={formStyles.formSubtitle}>
          Submit to your immediate supervisor before leaving the premises.
        </Text>

        <Text style={formStyles.sectionHeader}>I. EMPLOYEE INFORMATION</Text>
        <BlankFieldPair left="Name" right="Employee No." />
        <BlankFieldPair left="Position" right="Office / Division" />

        <Text style={formStyles.sectionHeader}>II. DETAILS OF PASS-OUT</Text>
        <BlankFieldPair left="Date" right="Destination" />
        <BlankFieldPair
          left="Time of Departure"
          right="Expected Time of Return"
        />
        <BlankField label="Purpose" />
        <BlankField label=" " />

        <View style={{ flexDirection: "row", gap: 24, marginTop: 4 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderWidth: 0.8,
                borderColor: "#111827",
              }}
            />
            <Text>Personal</Text>
          </View>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderWidth: 0.8,
                borderColor: "#111827",
              }}
            />
            <Text>Official (attach OB Form if applicable)</Text>
          </View>
        </View>

        <Text style={formStyles.sectionHeader}>III. AUTHORIZATION</Text>
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Employee's Signature / Date" />
          <SignatureSlot caption="Immediate Supervisor — Approved / Date" />
        </View>
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Guard on Duty — Time Out (actual)" />
          <SignatureSlot caption="Guard on Duty — Time In (actual)" />
        </View>

        <FormFootnote text="Pass-out time is charged against leave credits or logged as undertime per CSC Omnibus Rules unless covered by an approved Official Business authorization." />
      </Page>
    </Document>
  );
}
