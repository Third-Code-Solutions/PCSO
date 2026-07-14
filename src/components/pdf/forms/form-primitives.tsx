/**
 * Shared primitives for blank official HR form PDFs (TOR 1.9.10 / EPM-015).
 *
 * Every downloadable blank form shares the PCSO letterhead, fill-by-hand
 * field rows, and signature blocks defined here. Agency identity is passed
 * in from the org profile (P0-002 — no hardcoded agency strings).
 */

import { StyleSheet, Text, View } from "@react-pdf/renderer";

export const formStyles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111827",
    lineHeight: 1.5,
  },
  headerBlock: {
    textAlign: "center",
    marginBottom: 14,
  },
  headerRepublic: {
    fontSize: 8,
    color: "#374151",
  },
  headerAgency: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1B4F9E",
    marginTop: 2,
    textTransform: "uppercase",
  },
  headerAddress: {
    fontSize: 7.5,
    color: "#6B7280",
    marginTop: 1,
  },
  formTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 12,
    textDecoration: "underline",
    textTransform: "uppercase",
  },
  formSubtitle: {
    fontSize: 8,
    textAlign: "center",
    color: "#6B7280",
    marginTop: -8,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#F3F4F6",
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 9,
  },
  fieldLabel: {
    fontSize: 9,
  },
  fieldLine: {
    flexGrow: 1,
    borderBottomWidth: 0.7,
    borderBottomColor: "#111827",
    marginLeft: 4,
    minHeight: 11,
  },
  table: {
    borderWidth: 0.7,
    borderColor: "#6B7280",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 0.7,
    borderBottomColor: "#6B7280",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: "#9CA3AF",
    minHeight: 16,
  },
  tableCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 0.4,
    borderRightColor: "#9CA3AF",
    justifyContent: "center",
  },
  tableCellHeaderText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
    gap: 24,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 0.7,
    borderBottomColor: "#111827",
    marginBottom: 3,
    minHeight: 14,
  },
  signatureLabel: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#374151",
  },
  footNote: {
    position: "absolute",
    bottom: 26,
    left: 42,
    right: 42,
    fontSize: 7,
    color: "#9CA3AF",
    textAlign: "center",
  },
});

export interface BlankFormHeaderProps {
  agencyName: string;
  agencyAddress?: string | null;
}

/** PCSO letterhead used across every blank form. */
export function BlankFormHeader({
  agencyName,
  agencyAddress,
}: BlankFormHeaderProps) {
  return (
    <View style={formStyles.headerBlock}>
      <Text style={formStyles.headerRepublic}>Republic of the Philippines</Text>
      <Text style={formStyles.headerAgency}>{agencyName}</Text>
      {agencyAddress ? (
        <Text style={formStyles.headerAddress}>{agencyAddress}</Text>
      ) : null}
    </View>
  );
}

/** Label + fill-by-hand underline row. */
export function BlankField({ label }: { label: string }) {
  return (
    <View style={formStyles.fieldRow}>
      <Text style={formStyles.fieldLabel}>{label}:</Text>
      <View style={formStyles.fieldLine} />
    </View>
  );
}

/** Two blank fields sharing one row. */
export function BlankFieldPair({
  left,
  right,
}: {
  left: string;
  right: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 18 }}>
      <View style={{ flex: 1 }}>
        <BlankField label={left} />
      </View>
      <View style={{ flex: 1 }}>
        <BlankField label={right} />
      </View>
    </View>
  );
}

/** Signature line + role caption. */
export function SignatureSlot({ caption }: { caption: string }) {
  return (
    <View style={formStyles.signatureBlock}>
      <View style={formStyles.signatureLine} />
      <Text style={formStyles.signatureLabel}>{caption}</Text>
    </View>
  );
}

/** N empty table rows for fill-by-hand tables. */
export function EmptyRows({
  columns,
  count,
}: {
  columns: number;
  count: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, rowIdx) => (
        <View key={rowIdx} style={formStyles.tableRow}>
          {Array.from({ length: columns }).map((__, colIdx) => (
            <View key={colIdx} style={formStyles.tableCell}>
              <Text> </Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

export function FormFootnote({ text }: { text: string }) {
  return <Text style={formStyles.footNote}>{text}</Text>;
}
