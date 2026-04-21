/**
 * GSIS Form 48 — Daily Time Record (DTR) Integration
 *
 * Context: CSC Form 48 is the Civil Service Commission's official Daily Time Record.
 * GSIS uses the DTR data to verify attendance-based adjustments to contributions
 * (e.g., leave without pay, absences affect GSIS credits). This component renders
 * the printable DTR form that accompanies GSIS remittance submissions.
 *
 * Note: Full attendance integration is scoped to Phase 11. This component
 * accepts a pre-aggregated attendance summary and renders it in the official
 * CSC Form 48 layout. The `// TODO: import from '@/lib/...'` pattern per
 * CONVENTIONS.md is used for attendance types not yet exposed from Phase 11.
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ─── Attendance types (Phase 11 will export these from @/lib/db/schema) ───────
// TODO: import from '@/lib/db/schema/attendance' once Phase 11 is complete

interface DailyAttendanceEntry {
  date: string; // ISO date string
  dayOfWeek: string; // "Mon", "Tue", etc.
  morningIn: string | null; // "08:00" or null if absent
  morningOut: string | null; // "12:00" or null
  afternoonIn: string | null;
  afternoonOut: string | null;
  /** Minutes late */
  lateMinutes: number;
  /** Minutes undertime */
  undertimeMinutes: number;
  /** True if official leave day */
  isLeave: boolean;
  leaveType: string | null;
  isHoliday: boolean;
  holidayName: string | null;
}

interface DtrAttendanceSummary {
  totalDaysPresent: number;
  totalDaysAbsent: number;
  totalHolidaysWorked: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalLeaveCreditsUsed: number;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#D1D5DB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    padding: 28,
    color: "#111827",
  },
  headerCenter: {
    alignItems: "center",
    marginBottom: 8,
  },
  formNo: {
    fontSize: 6.5,
    color: "#6B7280",
    marginBottom: 2,
  },
  formTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formSubtitle: {
    fontSize: 7,
    color: "#374151",
    marginTop: 1,
  },
  divider: {
    height: 1.5,
    backgroundColor: GOLD,
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 16,
  },
  metaField: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 6,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  metaValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  // Attendance table
  table: {
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: NAVY,
  },
  thCell: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 6,
    textTransform: "uppercase",
    textAlign: "center",
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRightWidth: 0.3,
    borderRightColor: "rgba(255,255,255,0.2)",
  },
  tdRow: {
    flexDirection: "row",
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER,
  },
  tdRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tdCell: {
    fontSize: 6.5,
    textAlign: "center",
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRightWidth: 0.3,
    borderRightColor: BORDER,
    color: "#374151",
  },
  tdCellDate: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRightWidth: 0.3,
    borderRightColor: BORDER,
    color: NAVY,
  },
  tdCellHoliday: {
    backgroundColor: "#FEF3C7",
    fontSize: 5.5,
    textAlign: "center",
    paddingHorizontal: 3,
    paddingVertical: 3,
    color: "#92400E",
    borderRightWidth: 0.3,
    borderRightColor: BORDER,
  },
  tdCellAbsent: {
    backgroundColor: "#FEE2E2",
    fontSize: 6.5,
    textAlign: "center",
    paddingHorizontal: 3,
    paddingVertical: 3,
    color: "#B91C1C",
    borderRightWidth: 0.3,
    borderRightColor: BORDER,
  },
  // Summary block
  summarySection: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  summaryBox: {
    borderWidth: 0.5,
    borderColor: NAVY,
    borderRadius: 3,
    padding: 8,
    width: 220,
  },
  summaryTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: NAVY,
    textTransform: "uppercase",
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: NAVY,
    paddingBottom: 3,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 7,
    color: "#374151",
  },
  summaryValue: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  certBlock: {
    marginTop: 16,
  },
  certText: {
    fontSize: 7,
    color: "#374151",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  signField: {
    width: 200,
  },
  signLine: {
    borderTopWidth: 0.5,
    borderTopColor: "#374151",
    paddingTop: 3,
  },
  signLabel: {
    fontSize: 6,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  pageNumber: {
    position: "absolute",
    bottom: 14,
    right: 28,
    fontSize: 6,
    color: "#9CA3AF",
  },
});

// ─── Column widths ────────────────────────────────────────────────────────────

const C = {
  day: "5%",
  date: "8%",
  amIn: "10%",
  amOut: "10%",
  pmIn: "10%",
  pmOut: "10%",
  late: "8%",
  utime: "8%",
  remarks: "31%",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMinutes(minutes: number): string {
  if (minutes === 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GsisForm48Props {
  employee: {
    employeeNo: string;
    name: string;
    positionTitle: string;
    office: string;
    salaryGrade: number;
    step: number;
  };
  period: {
    month: string; // e.g. "January"
    year: number;
  };
  entries: DailyAttendanceEntry[];
  summary: DtrAttendanceSummary;
  preparedBy: string;
  approvedBy: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GsisForm48Pdf({
  employee,
  period,
  entries,
  summary,
  preparedBy,
  approvedBy,
}: GsisForm48Props) {
  return (
    <Document
      title={`CSC Form 48 — DTR — ${employee.name} — ${period.month} ${period.year}`}
      author="PCSO HRIS"
      subject="Civil Service Commission Form 48 — Daily Time Record"
    >
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        {/* Header */}
        <View style={styles.headerCenter}>
          <Text style={styles.formNo}>CSC Form No. 48 (Revised 2018)</Text>
          <Text style={styles.formTitle}>Daily Time Record</Text>
          <Text style={styles.formSubtitle}>
            Civil Service Commission — Republic of the Philippines
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Employee metadata */}
        <View style={styles.metaRow}>
          <View style={[styles.metaField, { flex: 2 }]}>
            <Text style={styles.metaLabel}>Name</Text>
            <Text style={styles.metaValue}>{employee.name}</Text>
          </View>
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Employee No.</Text>
            <Text style={styles.metaValue}>{employee.employeeNo}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaField, { flex: 2 }]}>
            <Text style={styles.metaLabel}>Position / Designation</Text>
            <Text style={styles.metaValue}>{employee.positionTitle}</Text>
          </View>
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Salary Grade / Step</Text>
            <Text
              style={styles.metaValue}
            >{`SG ${employee.salaryGrade} / Step ${employee.step}`}</Text>
          </View>
        </View>

        <View style={[styles.metaRow, { marginBottom: 10 }]}>
          <View style={[styles.metaField, { flex: 2 }]}>
            <Text style={styles.metaLabel}>Office / Department</Text>
            <Text style={styles.metaValue}>{employee.office}</Text>
          </View>
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text
              style={styles.metaValue}
            >{`${period.month} ${period.year}`}</Text>
          </View>
        </View>

        {/* Attendance table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.thCell, { width: C.day }]}>Day</Text>
            <Text style={[styles.thCell, { width: C.date }]}>Date</Text>
            <Text style={[styles.thCell, { width: C.amIn }]}>AM In</Text>
            <Text style={[styles.thCell, { width: C.amOut }]}>AM Out</Text>
            <Text style={[styles.thCell, { width: C.pmIn }]}>PM In</Text>
            <Text style={[styles.thCell, { width: C.pmOut }]}>PM Out</Text>
            <Text style={[styles.thCell, { width: C.late }]}>Late</Text>
            <Text style={[styles.thCell, { width: C.utime }]}>U-time</Text>
            <Text style={[styles.thCell, { width: C.remarks }]}>Remarks</Text>
          </View>

          {entries.map((entry, idx) => {
            const isAbsent =
              !entry.isHoliday &&
              !entry.isLeave &&
              entry.morningIn == null &&
              entry.afternoonIn == null;

            return (
              <View
                key={entry.date}
                style={[styles.tdRow, idx % 2 === 1 ? styles.tdRowAlt : {}]}
              >
                <Text style={[styles.tdCell, { width: C.day }]}>
                  {entry.dayOfWeek}
                </Text>
                <Text style={[styles.tdCellDate, { width: C.date }]}>
                  {new Date(entry.date).getDate()}
                </Text>

                {entry.isHoliday ? (
                  <>
                    <Text
                      style={[
                        styles.tdCellHoliday,
                        {
                          width: `calc(${C.amIn} + ${C.amOut} + ${C.pmIn} + ${C.pmOut} + ${C.late} + ${C.utime})`,
                        },
                      ]}
                    >
                      HOLIDAY
                      {entry.holidayName ? ` — ${entry.holidayName}` : ""}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.remarks }]} />
                  </>
                ) : isAbsent ? (
                  <>
                    <Text
                      style={[
                        styles.tdCellAbsent,
                        {
                          width: `calc(${C.amIn} + ${C.amOut} + ${C.pmIn} + ${C.pmOut} + ${C.late} + ${C.utime})`,
                        },
                      ]}
                    >
                      ABSENT
                    </Text>
                    <Text style={[styles.tdCell, { width: C.remarks }]} />
                  </>
                ) : (
                  <>
                    <Text style={[styles.tdCell, { width: C.amIn }]}>
                      {entry.morningIn ?? ""}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.amOut }]}>
                      {entry.morningOut ?? ""}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.pmIn }]}>
                      {entry.afternoonIn ?? ""}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.pmOut }]}>
                      {entry.afternoonOut ?? ""}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.late }]}>
                      {fmtMinutes(entry.lateMinutes)}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.utime }]}>
                      {fmtMinutes(entry.undertimeMinutes)}
                    </Text>
                    <Text style={[styles.tdCell, { width: C.remarks }]}>
                      {entry.isLeave && entry.leaveType ? entry.leaveType : ""}
                    </Text>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Monthly Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days Present</Text>
              <Text style={styles.summaryValue}>
                {summary.totalDaysPresent}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days Absent (LWOP)</Text>
              <Text style={styles.summaryValue}>{summary.totalDaysAbsent}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Leave Credits Used</Text>
              <Text style={styles.summaryValue}>
                {summary.totalLeaveCreditsUsed}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Late (minutes)</Text>
              <Text style={styles.summaryValue}>
                {summary.totalLateMinutes}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Undertime (minutes)</Text>
              <Text style={styles.summaryValue}>
                {summary.totalUndertimeMinutes}
              </Text>
            </View>
          </View>
        </View>

        {/* Certification */}
        <View style={styles.certBlock}>
          <Text style={styles.certText}>
            I certify on my honor that the above is a true and correct report of
            the hours of work performed, record of which was made daily at the
            time of arrival and departure from the office.
          </Text>

          <View style={styles.signRow}>
            <View style={styles.signField}>
              <View style={styles.signLine}>
                <Text style={[styles.summaryValue, { fontSize: 7.5 }]}>
                  {preparedBy}
                </Text>
                <Text style={styles.signLabel}>Signature of Employee</Text>
              </View>
            </View>
            <View style={styles.signField}>
              <View style={styles.signLine}>
                <Text style={[styles.summaryValue, { fontSize: 7.5 }]}>
                  {approvedBy}
                </Text>
                <Text style={styles.signLabel}>
                  In charge of attendance records
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Page number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
