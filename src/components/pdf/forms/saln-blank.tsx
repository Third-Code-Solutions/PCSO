/**
 * SALN — blank download template (TOR 1.9.10 / EPM-015).
 *
 * The filled SALN renderer (src/components/pdf/saln-form.tsx) is an
 * HTML/print component, so this dedicated react-pdf template provides the
 * downloadable BLANK form: declarant block, the four asset/liability tables,
 * relatives-in-government section, and the sworn declaration per RA 6713.
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

function TableWithHeader({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: number;
}) {
  return (
    <View>
      <Text style={formStyles.sectionHeader}>{title}</Text>
      <View style={formStyles.table}>
        <View style={formStyles.tableHeaderRow}>
          {headers.map((h) => (
            <View key={h} style={formStyles.tableCell}>
              <Text style={formStyles.tableCellHeaderText}>{h}</Text>
            </View>
          ))}
        </View>
        <EmptyRows columns={headers.length} count={rows} />
      </View>
    </View>
  );
}

export function SalnBlankForm({
  agencyName,
  agencyAddress,
}: BlankFormHeaderProps) {
  return (
    <Document title="SALN — Blank Form" author={agencyName}>
      <Page size="A4" style={formStyles.page}>
        <BlankFormHeader
          agencyName={agencyName}
          agencyAddress={agencyAddress}
        />
        <Text style={formStyles.formTitle}>
          Statement of Assets, Liabilities and Net Worth (SALN)
        </Text>
        <Text style={formStyles.formSubtitle}>
          As of December 31, ________ — required annually under RA 6713.
        </Text>

        <View style={{ flexDirection: "row", gap: 24, marginBottom: 8 }}>
          {["Joint Filing", "Separate Filing", "Not Applicable"].map(
            (label) => (
              <View
                key={label}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderWidth: 0.8,
                    borderColor: "#111827",
                  }}
                />
                <Text style={{ fontSize: 8 }}>{label}</Text>
              </View>
            ),
          )}
        </View>

        <Text style={formStyles.sectionHeader}>I. DECLARANT INFORMATION</Text>
        <BlankFieldPair left="Name (Last, First, MI)" right="Position" />
        <BlankFieldPair left="Agency / Office" right="Office Address" />
        <BlankFieldPair
          left="Spouse (Name / Position / Agency)"
          right="Residential Address"
        />

        <TableWithHeader
          title="II. ASSETS — A. REAL PROPERTIES"
          headers={[
            "DESCRIPTION",
            "KIND",
            "LOCATION",
            "YEAR ACQUIRED",
            "ACQUISITION COST",
            "FAIR MARKET VALUE",
          ]}
          rows={4}
        />
        <TableWithHeader
          title="II. ASSETS — B. PERSONAL AND OTHER PROPERTIES"
          headers={[
            "DESCRIPTION",
            "YEAR ACQUIRED",
            "ACQUISITION COST / AMOUNT",
          ]}
          rows={4}
        />
        <TableWithHeader
          title="III. LIABILITIES"
          headers={[
            "NATURE OF LIABILITY",
            "NAME OF CREDITOR",
            "OUTSTANDING BALANCE",
          ]}
          rows={3}
        />
      </Page>

      <Page size="A4" style={formStyles.page}>
        <TableWithHeader
          title="IV. BUSINESS INTERESTS AND FINANCIAL CONNECTIONS"
          headers={[
            "NAME OF ENTITY",
            "BUSINESS ADDRESS",
            "NATURE OF INTEREST / CONNECTION",
            "DATE OF ACQUISITION",
          ]}
          rows={3}
        />
        <TableWithHeader
          title="V. RELATIVES IN GOVERNMENT SERVICE (within the 4th civil degree)"
          headers={[
            "NAME OF RELATIVE",
            "RELATIONSHIP",
            "POSITION",
            "AGENCY AND ADDRESS",
          ]}
          rows={3}
        />

        <Text style={formStyles.sectionHeader}>VI. NET WORTH SUMMARY</Text>
        <BlankFieldPair left="Total Assets (a)" right="Total Liabilities (b)" />
        <BlankField label="NET WORTH (a minus b)" />

        <Text style={formStyles.sectionHeader}>VII. DECLARATION</Text>
        <Text style={{ marginBottom: 12, textAlign: "justify" }}>
          I hereby certify that these are true and correct statements of my
          assets, liabilities, net worth, business interests and financial
          connections, including those of my spouse and unmarried children below
          eighteen (18) years of age living in my household, and that to the
          best of my knowledge the above-enumerated are names of my relatives in
          the government within the fourth civil degree of consanguinity or
          affinity.
        </Text>
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Signature of Declarant / Date" />
          <SignatureSlot caption="Signature of Co-Declarant (Spouse) / Date" />
        </View>
        <View style={formStyles.signatureRow}>
          <SignatureSlot caption="Government Issued ID / No. / Date of Issue" />
          <SignatureSlot caption="Administering Officer / Date" />
        </View>

        <FormFootnote text="File with the HRD within the prescribed period. Additional sheets may be attached for entries that do not fit the tables above." />
      </Page>
    </Document>
  );
}
