/**
 * Office Clearance Form — blank official HR form (TOR 1.9.10 / EPM-015).
 * Property, money, and work accountability clearance for separation,
 * transfer, or prolonged leave.
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

const CLEARANCE_UNITS = [
  "Immediate Supervisor / Division Chief",
  "Property & Supply Section (equipment, ID, keys)",
  "Accounting Division (cash advances, receivables)",
  "Cashier (money accountability)",
  "Library / Records Section (documents, files)",
  "IT / MIS Department (system accounts, devices)",
  "GSIS / Provident Loans Liaison",
  "Human Resources Department (201 file, leave ledger)",
];

export function OfficeClearanceForm({
  agencyName,
  agencyAddress,
}: BlankFormHeaderProps) {
  return (
    <Document title="Office Clearance" author={agencyName}>
      <Page size="A4" style={formStyles.page}>
        <BlankFormHeader
          agencyName={agencyName}
          agencyAddress={agencyAddress}
        />
        <Text style={formStyles.formTitle}>Office Clearance</Text>
        <Text style={formStyles.formSubtitle}>
          For separation, retirement, transfer, or prolonged leave of absence.
        </Text>

        <Text style={formStyles.sectionHeader}>I. EMPLOYEE INFORMATION</Text>
        <BlankFieldPair left="Name" right="Employee No." />
        <BlankFieldPair left="Position" right="Office / Division" />
        <BlankFieldPair left="Purpose of Clearance" right="Effective Date" />

        <Text style={formStyles.sectionHeader}>
          II. CLEARANCE FROM ACCOUNTABILITIES
        </Text>
        <View style={formStyles.table}>
          <View style={formStyles.tableHeaderRow}>
            <View style={[formStyles.tableCell, { flex: 3 }]}>
              <Text style={formStyles.tableCellHeaderText}>UNIT / OFFICE</Text>
            </View>
            <View style={[formStyles.tableCell, { flex: 2 }]}>
              <Text style={formStyles.tableCellHeaderText}>
                REMARKS (CLEARED / WITH ACCOUNTABILITY)
              </Text>
            </View>
            <View style={[formStyles.tableCell, { flex: 2 }]}>
              <Text style={formStyles.tableCellHeaderText}>
                SIGNATURE / DATE
              </Text>
            </View>
          </View>
          {CLEARANCE_UNITS.map((unit) => (
            <View key={unit} style={[formStyles.tableRow, { minHeight: 22 }]}>
              <View style={[formStyles.tableCell, { flex: 3 }]}>
                <Text style={{ fontSize: 8 }}>{unit}</Text>
              </View>
              <View style={[formStyles.tableCell, { flex: 2 }]}>
                <Text> </Text>
              </View>
              <View style={[formStyles.tableCell, { flex: 2 }]}>
                <Text> </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={formStyles.sectionHeader}>III. FINAL ACTION</Text>
        <BlankField label="Remarks" />
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Employee's Signature / Date" />
          <SignatureSlot caption="HRD Manager — Final Clearance / Date" />
        </View>

        <FormFootnote text="All accountabilities must be settled before final pay, leave monetization, and issuance of clearance-dependent documents." />
      </Page>
    </Document>
  );
}
