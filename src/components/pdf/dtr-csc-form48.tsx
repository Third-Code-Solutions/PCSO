/**
 * CSC Form No. 48 — Daily Time Record
 * React-PDF implementation matching the official Civil Service Commission format.
 *
 * Reference: CSC Memorandum Circular No. 16, s. 2013 and CSC Form No. 48 layout.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { AttendanceLogRow } from '@/app/(dashboard)/attendance/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DtrForm48Props {
  employee: {
    name: string;
    employeeNumber: string;
    position: string;
    department: string;
    salary: string; // formatted peso string
  };
  month: string; // e.g. "March 2025"
  schedule: {
    start: string; // e.g. "8:00 AM"
    end: string; // e.g. "5:00 PM"
  };
  logs: AttendanceLogRow[];
  /** Total late minutes for the period */
  totalLateMinutes: number;
  /** Total undertime minutes for the period */
  totalUndertimeMinutes: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 30,
    color: '#000',
  },
  center: { textAlign: 'center' },
  bold: { fontFamily: 'Helvetica-Bold' },
  // Header
  formTitle: { fontSize: 7, textAlign: 'center', marginBottom: 2 },
  mainTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 8 },
  // Info rows
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { fontFamily: 'Helvetica-Bold', width: 80 },
  infoValue: {
    flex: 1,
    borderBottom: '0.5 solid #000',
    paddingBottom: 1,
    marginRight: 10,
  },
  // Table
  table: { borderTop: '0.5 solid #000', borderLeft: '0.5 solid #000', marginTop: 8 },
  tableRow: { flexDirection: 'row' },
  cell: {
    borderBottom: '0.5 solid #000',
    borderRight: '0.5 solid #000',
    padding: '2 3',
    textAlign: 'center',
  },
  headerCell: {
    borderBottom: '0.5 solid #000',
    borderRight: '0.5 solid #000',
    padding: '2 3',
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f0f0f0',
  },
  colDay: { width: 22 },
  colTime: { width: 36 },
  colUndertime: { width: 30 },
  // Footer
  certSection: { marginTop: 12 },
  certText: { fontSize: 7, lineHeight: 1.5 },
  signatureLine: { borderBottom: '0.5 solid #000', marginTop: 18, width: 160 },
  signatureBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
});

// ---------------------------------------------------------------------------
// Helper: format HH:MM to 12-hour display
// ---------------------------------------------------------------------------

function to12Hour(time: string | null): string {
  if (!time) return '';
  const parts = time.split(':');
  const h = Number(parts[0] ?? '0');
  const m = Number(parts[1] ?? '0');
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

function minutesToHM(minutes: number): { hours: number; mins: number } {
  return { hours: Math.floor(minutes / 60), mins: minutes % 60 };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableHeader() {
  return (
    <>
      {/* Row 1: group headers */}
      <View style={S.tableRow}>
        <View style={[S.headerCell, S.colDay, { justifyContent: 'center' }]}>
          <Text>{'\n'}</Text>
        </View>
        <View style={[S.headerCell, { width: 144, textAlign: 'center' }]}>
          <Text>A.M.</Text>
        </View>
        <View style={[S.headerCell, { width: 144, textAlign: 'center' }]}>
          <Text>P.M.</Text>
        </View>
        <View style={[S.headerCell, { width: 60, textAlign: 'center' }]}>
          <Text>UNDERTIME</Text>
        </View>
      </View>
      {/* Row 2: sub-headers */}
      <View style={S.tableRow}>
        <View style={[S.headerCell, S.colDay]}>
          <Text>Day</Text>
        </View>
        <View style={[S.headerCell, S.colTime]}>
          <Text>Arrival</Text>
        </View>
        <View style={[S.headerCell, S.colTime]}>
          <Text>Departure</Text>
        </View>
        <View style={[S.headerCell, S.colTime]}>
          <Text>Arrival</Text>
        </View>
        <View style={[S.headerCell, S.colTime]}>
          <Text>Departure</Text>
        </View>
        <View style={[S.headerCell, S.colUndertime]}>
          <Text>Hours</Text>
        </View>
        <View style={[S.headerCell, S.colUndertime]}>
          <Text>Minutes</Text>
        </View>
      </View>
    </>
  );
}

function TableRow({ log, dayNum }: { log: AttendanceLogRow | undefined; dayNum: number }) {
  const lateMin = log?.undertimeMinutes ?? 0;
  const { hours, mins } = minutesToHM(lateMin);
  const isEmpty = !log;
  const isAbsent = log && !log.timeIn && !log.timeOut;

  return (
    <View style={S.tableRow}>
      <View style={[S.cell, S.colDay]}>
        <Text>{dayNum}</Text>
      </View>
      <View style={[S.cell, S.colTime]}>
        <Text>{isEmpty ? '' : isAbsent ? 'ABSENT' : to12Hour(log.timeIn)}</Text>
      </View>
      <View style={[S.cell, S.colTime]}>
        <Text>{isEmpty || isAbsent ? '' : '12:00 PM'}</Text>
      </View>
      <View style={[S.cell, S.colTime]}>
        <Text>{isEmpty || isAbsent ? '' : '1:00 PM'}</Text>
      </View>
      <View style={[S.cell, S.colTime]}>
        <Text>{isEmpty || isAbsent ? '' : to12Hour(log.timeOut)}</Text>
      </View>
      <View style={[S.cell, S.colUndertime]}>
        <Text>{lateMin > 0 ? String(hours) : ''}</Text>
      </View>
      <View style={[S.cell, S.colUndertime]}>
        <Text>{lateMin > 0 ? String(mins) : ''}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DtrCscForm48({ employee, month, schedule, logs, totalLateMinutes, totalUndertimeMinutes }: DtrForm48Props) {
  const logByDay = new Map<number, AttendanceLogRow>();
  for (const log of logs) {
    const day = Number(log.date.split('-')[2] ?? '0');
    logByDay.set(day, log);
  }

  const daysInMonth = 31; // CSC Form 48 always has 31 rows
  const totalUndertime = minutesToHM(totalLateMinutes + totalUndertimeMinutes);

  return (
    <Document>
      <Page size="LEGAL" orientation="portrait" style={S.page}>
        {/* Header */}
        <Text style={S.formTitle}>Civil Service Form No. 48</Text>
        <Text style={S.mainTitle}>DAILY TIME RECORD</Text>

        {/* Employee info */}
        <View style={S.infoRow}>
          <Text style={S.infoLabel}>Name:</Text>
          <Text style={[S.infoValue, S.bold]}>{employee.name}</Text>
        </View>
        <View style={S.infoRow}>
          <Text style={S.infoLabel}>Position:</Text>
          <Text style={S.infoValue}>{employee.position}</Text>
          <Text style={S.infoLabel}>Employee No.:</Text>
          <Text style={S.infoValue}>{employee.employeeNumber}</Text>
        </View>
        <View style={S.infoRow}>
          <Text style={S.infoLabel}>Office/Dept.:</Text>
          <Text style={S.infoValue}>{employee.department}</Text>
        </View>
        <View style={S.infoRow}>
          <Text style={S.infoLabel}>Month of:</Text>
          <Text style={S.infoValue}>{month}</Text>
          <Text style={S.infoLabel}>Schedule:</Text>
          <Text style={S.infoValue}>{schedule.start} – {schedule.end}</Text>
        </View>

        {/* DTR Table */}
        <View style={S.table}>
          <TableHeader />
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <TableRow key={day} dayNum={day} log={logByDay.get(day)} />
          ))}

          {/* Totals row */}
          <View style={S.tableRow}>
            <View style={[S.headerCell, { flex: 1 }]}>
              <Text>TOTAL UNDERTIME FOR THE PERIOD</Text>
            </View>
            <View style={[S.cell, S.colUndertime]}>
              <Text style={S.bold}>{totalUndertime.hours}</Text>
            </View>
            <View style={[S.cell, S.colUndertime]}>
              <Text style={S.bold}>{totalUndertime.mins}</Text>
            </View>
          </View>
        </View>

        {/* Certification */}
        <View style={S.certSection}>
          <Text style={S.certText}>
            I certify on my honor that the above is a true and correct report of the hours of work
            performed, record of which was made daily at the time of arrival at and departure from
            the office.
          </Text>

          <View style={S.signatureBlock}>
            <View>
              <View style={S.signatureLine} />
              <Text style={{ textAlign: 'center', fontSize: 7 }}>{employee.name}</Text>
              <Text style={{ textAlign: 'center', fontSize: 7, color: '#555' }}>
                Employee Signature over Printed Name
              </Text>
            </View>
            <View>
              <View style={[S.signatureLine, { width: 180 }]} />
              <Text style={{ textAlign: 'center', fontSize: 7 }}>
                Verified as to the prescribed office hours
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
