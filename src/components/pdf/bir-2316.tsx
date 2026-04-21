/**
 * BIR Form 2316 — Certificate of Compensation Payment / Tax Withheld (React-PDF)
 *
 * Year-end employee-facing certificate per BIR RR No. 11-2018 (TRAIN Law).
 * Issued by the employer to each employee on or before January 31 of the
 * following year, or upon cessation of employment.
 *
 * Import dynamically in page components:
 *   const { Bir2316Pdf } = await import('@/components/pdf/bir-2316')
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const CREAM = "#FAF4E6";
const BORDER = "#D1D5DB";
const BIR_BLUE = "#1D4ED8";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7,
    padding: 28,
    color: "#111827",
  },
  // Header / form title
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  leftHeader: { flex: 1 },
  centerHeader: { flex: 1, alignItems: "center" },
  rightHeader: { width: 140, alignItems: "flex-end" },
  birTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: BIR_BLUE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formCode: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BIR_BLUE,
    lineHeight: 1,
  },
  formTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 1.4,
    marginTop: 2,
  },
  formSubtitle: {
    fontSize: 6,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 1,
  },
  metaLabel: { fontSize: 5.5, color: "#9CA3AF", textTransform: "uppercase" },
  metaValue: { fontSize: 7, fontFamily: "Helvetica-Bold", color: BIR_BLUE },
  // Dividers
  blueDivider: { height: 1.5, backgroundColor: BIR_BLUE, marginVertical: 6 },
  goldDivider: { height: 0.5, backgroundColor: GOLD, marginBottom: 8 },
  // Section labels
  sectionLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: BIR_BLUE,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
  },
  // Fields
  twoCol: { flexDirection: "row", gap: 6, marginBottom: 6 },
  threeCol: { flexDirection: "row", gap: 6, marginBottom: 6 },
  fieldBox: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  fieldBoxBorder: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 1,
    padding: 4,
  },
  fieldLabel: {
    fontSize: 5.5,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  fieldValue: { fontSize: 7.5, color: "#111827" },
  fieldValueBold: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  // Compensation table
  compTable: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    marginBottom: 8,
  },
  compTableHead: {
    flexDirection: "row",
    backgroundColor: NAVY,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  compHeadLabel: {
    flex: 1,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  compHeadAmt: {
    width: 90,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textAlign: "right",
    textTransform: "uppercase",
  },
  compRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  compRowAlt: { backgroundColor: CREAM },
  compRowBold: { backgroundColor: "#F0FDF4" },
  compLabel: { flex: 1, fontSize: 6.5, color: "#374151" },
  compLabelBold: {
    flex: 1,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  compAmt: {
    width: 90,
    fontSize: 6.5,
    fontFamily: "Courier",
    textAlign: "right",
    color: "#1F2937",
  },
  compAmtBold: {
    width: 90,
    fontSize: 6.5,
    fontFamily: "Courier-Bold",
    textAlign: "right",
    color: "#111827",
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: NAVY,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  totalLabel: {
    flex: 1,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  totalAmt: {
    width: 90,
    fontSize: 7,
    fontFamily: "Courier-Bold",
    textAlign: "right",
    color: GOLD,
  },
  // Summary box
  summaryBox: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
    padding: 6,
    alignItems: "center",
  },
  summaryCardLabel: {
    fontSize: 6,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  summaryCardValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  summaryCardSub: { fontSize: 6, color: "#9CA3AF", marginTop: 1 },
  // Certification
  certBox: {
    borderWidth: 0.5,
    borderColor: "#D97706",
    borderRadius: 2,
    backgroundColor: "#FFFBEB",
    padding: 6,
    marginBottom: 10,
  },
  certText: { fontSize: 6, color: "#78350F", lineHeight: 1.6 },
  // Signature
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderTopColor: "#374151",
    width: 160,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 5.5,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  signatureName: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 1,
  },
  // Footer
  pageNumber: {
    position: "absolute",
    bottom: 12,
    right: 28,
    fontSize: 5.5,
    color: "#9CA3AF",
  },
  disclaimer: {
    position: "absolute",
    bottom: 12,
    left: 28,
    fontSize: 5.5,
    color: "#9CA3AF",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Bir2316Props {
  employer: {
    name: string;
    tin: string;
    address: string;
    zipCode: string;
  };
  employee: {
    tin: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
    suffix: string | null;
    /** 'single' | 'married' | etc. */
    civilStatus: string;
    address: string;
    /** Primary employment indicator */
    isPrimary: boolean;
  };
  period: {
    year: string;
    /** e.g. "January 1 – December 31, 2024" */
    label: string;
  };
  compensation: {
    /** Basic salary (sum of basic_pay across all periods) */
    basicSalary: string;
    /** PERA and similar allowances */
    allowances: string;
    /** 13th month + other benefits */
    thirteenthMonthAndOtherBenefits: string;
    /** Total gross compensation */
    grossCompensation: string;
    /** Mandatory government contributions (GSIS + PhilHealth + Pag-IBIG) */
    mandatoryContributions: string;
    /** Exempt 13th month (up to 90,000) */
    exemptBenefits: string;
    /** Total non-taxable */
    nonTaxableCompensation: string;
    /** Taxable compensation = gross - non-taxable */
    taxableCompensation: string;
  };
  tax: {
    taxDue: string;
    taxWithheld: string;
    /** Positive = over-remittance; negative = under-remittance */
    overUnder: string;
  };
  meta: {
    generatedAt: string;
    preparedBy: string;
    certifiedBy: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Bir2316Pdf({
  employer,
  employee,
  period,
  compensation,
  tax,
  meta,
}: Bir2316Props) {
  const overUnderNum = parseFloat(tax.overUnder);
  const isOverRemittance = overUnderNum > 0;
  const isUnder = overUnderNum < 0;

  const fullName = [
    employee.lastName.toUpperCase(),
    employee.firstName,
    employee.middleName ? `${employee.middleName.charAt(0)}.` : "",
    employee.suffix ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Document
      title={`BIR Form 2316 — ${fullName} — ${period.year}`}
      author={employer.name}
      subject="Certificate of Compensation Payment / Tax Withheld"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.leftHeader}>
            <Text style={styles.birTitle}>Bureau of Internal Revenue</Text>
            <Text style={styles.formCode}>2316</Text>
          </View>

          <View style={styles.centerHeader}>
            <Text style={styles.formTitle}>
              Certificate of Compensation{"\n"}Payment / Tax Withheld
            </Text>
            <Text style={styles.formSubtitle}>
              For Compensation Payment With or Without Tax Withheld
            </Text>
          </View>

          <View style={styles.rightHeader}>
            <Text style={styles.metaLabel}>Period Covered</Text>
            <Text style={styles.metaValue}>{period.label}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Year</Text>
            <Text style={styles.metaValue}>{period.year}</Text>
            <Text style={[styles.metaLabel, { marginTop: 3 }]}>Generated</Text>
            <Text style={styles.metaValue}>{meta.generatedAt}</Text>
          </View>
        </View>

        <View style={styles.blueDivider} />

        {/* Part I — Employer */}
        <Text style={styles.sectionLabel}>Part I — Employer Information</Text>

        <View style={styles.twoCol}>
          <View style={[styles.fieldBox, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>
              Employer / Withholding Agent Name
            </Text>
            <Text style={styles.fieldValueBold}>{employer.name}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Employer TIN</Text>
            <Text style={styles.fieldValueBold}>{employer.tin}</Text>
          </View>
          <View style={[styles.fieldBox, { width: 55 }]}>
            <Text style={styles.fieldLabel}>ZIP</Text>
            <Text style={styles.fieldValue}>{employer.zipCode}</Text>
          </View>
        </View>

        <View style={[styles.twoCol, { marginBottom: 8 }]}>
          <View style={[styles.fieldBox, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Registered Address</Text>
            <Text style={styles.fieldValue}>{employer.address}</Text>
          </View>
        </View>

        <View style={styles.goldDivider} />

        {/* Part II — Employee */}
        <Text style={styles.sectionLabel}>Part II — Employee Information</Text>

        <View style={styles.twoCol}>
          <View style={[styles.fieldBox, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Employee Name</Text>
            <Text style={styles.fieldValueBold}>{fullName}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Employee TIN</Text>
            <Text style={styles.fieldValueBold}>{employee.tin}</Text>
          </View>
        </View>

        <View style={[styles.twoCol, { marginBottom: 8 }]}>
          <View style={[styles.fieldBox, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Address</Text>
            <Text style={styles.fieldValue}>{employee.address}</Text>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Civil Status</Text>
            <Text style={styles.fieldValue}>
              {employee.civilStatus.charAt(0).toUpperCase() +
                employee.civilStatus.slice(1)}
            </Text>
          </View>
          <View style={[styles.fieldBox, { width: 100 }]}>
            <Text style={styles.fieldLabel}>Primary Employer?</Text>
            <Text style={styles.fieldValueBold}>
              {employee.isPrimary ? "YES" : "NO"}
            </Text>
          </View>
        </View>

        <View style={styles.goldDivider} />

        {/* Part III — Compensation & Tax Summary */}
        <Text style={styles.sectionLabel}>
          Part III — Compensation Income & Tax Withheld
        </Text>

        <View style={styles.compTable}>
          <View style={styles.compTableHead}>
            <Text style={styles.compHeadLabel}>Particulars</Text>
            <Text style={styles.compHeadAmt}>Amount (PHP)</Text>
          </View>

          {[
            {
              label: "Basic Salary (Monthly Authorized Rate × Months)",
              value: compensation.basicSalary,
              alt: true,
            },
            {
              label: "PERA and Other Allowances",
              value: compensation.allowances,
              alt: false,
            },
            {
              label: "13th Month Pay and Other Benefits",
              value: compensation.thirteenthMonthAndOtherBenefits,
              alt: true,
            },
            {
              label: "Gross Compensation Income",
              value: compensation.grossCompensation,
              alt: false,
              bold: true,
            },
            {
              label:
                "Less: Mandatory Gov't Contributions (GSIS / PhilHealth / Pag-IBIG)",
              value: compensation.mandatoryContributions,
              alt: true,
            },
            {
              label:
                "Less: 13th Month & Other Benefits (Exempt — up to PHP 90,000)",
              value: compensation.exemptBenefits,
              alt: false,
            },
            {
              label: "Total Non-Taxable Compensation",
              value: compensation.nonTaxableCompensation,
              alt: true,
            },
            {
              label: "Taxable Compensation Income",
              value: compensation.taxableCompensation,
              alt: false,
              bold: true,
            },
          ].map((row, idx) => (
            <View
              key={idx}
              style={[
                styles.compRow,
                row.alt ? styles.compRowAlt : {},
                row.bold ? styles.compRowBold : {},
              ]}
            >
              <Text style={row.bold ? styles.compLabelBold : styles.compLabel}>
                {row.label}
              </Text>
              <Text style={row.bold ? styles.compAmtBold : styles.compAmt}>
                {fmt(row.value)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Gross Taxable Compensation</Text>
            <Text style={styles.totalAmt}>
              {fmt(compensation.taxableCompensation)}
            </Text>
          </View>
        </View>

        {/* Tax summary cards */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Tax Due</Text>
            <Text style={styles.summaryCardValue}>{fmt(tax.taxDue)}</Text>
            <Text style={styles.summaryCardSub}>PHP</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Tax Withheld</Text>
            <Text style={styles.summaryCardValue}>{fmt(tax.taxWithheld)}</Text>
            <Text style={styles.summaryCardSub}>PHP</Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              {
                borderColor: isOverRemittance
                  ? "#16A34A"
                  : isUnder
                    ? "#DC2626"
                    : BORDER,
              },
            ]}
          >
            <Text style={styles.summaryCardLabel}>
              {isOverRemittance
                ? "Over-Remittance"
                : isUnder
                  ? "Under-Remittance"
                  : "Balance"}
            </Text>
            <Text
              style={[
                styles.summaryCardValue,
                {
                  color: isOverRemittance
                    ? "#16A34A"
                    : isUnder
                      ? "#DC2626"
                      : NAVY,
                },
              ]}
            >
              {fmt(Math.abs(overUnderNum))}
            </Text>
            <Text style={styles.summaryCardSub}>PHP</Text>
          </View>
        </View>

        {/* Certification */}
        <View style={styles.certBox}>
          <Text style={styles.certText}>
            I/We declare, under the penalties of perjury, that this certificate
            has been made in good faith, verified by me/us, and to the best of
            my/our knowledge and belief, is true and correct, pursuant to the
            provisions of the National Internal Revenue Code, as amended, and
            the regulations issued under authority thereof.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureRow}>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.preparedBy}</Text>
              <Text style={styles.signatureLabel}>
                Prepared by — Payroll / HR Officer
              </Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{meta.certifiedBy}</Text>
              <Text style={styles.signatureLabel}>
                Certified Correct — Authorized Signatory
              </Text>
            </View>
          </View>
          <View>
            <View style={styles.signatureLine}>
              <Text style={[styles.signatureName, { color: "transparent" }]}>
                {"  "}
              </Text>
              <Text style={styles.signatureLabel}>
                Employee Signature / Date Received
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
        <Text style={styles.disclaimer} fixed>
          Generated by PCSO HRIS — Confidential — For Official Use Only
        </Text>
      </Page>
    </Document>
  );
}
