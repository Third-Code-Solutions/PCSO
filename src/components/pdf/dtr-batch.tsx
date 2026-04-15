/**
 * Batch DTR PDF generator.
 * Wraps multiple DtrCscForm48 pages into a single Document
 * for bulk download by HR admin.
 */

import { Document } from '@react-pdf/renderer';
import { DtrCscForm48, type DtrForm48Props } from './dtr-csc-form48';

export interface BatchDtrProps {
  records: DtrForm48Props[];
}

/**
 * DtrBatch renders one CSC Form 48 page per employee.
 * Use with @react-pdf/renderer's PDFDownloadLink or renderToBuffer.
 *
 * Example (server-side buffer for email/download):
 *   import { renderToBuffer } from '@react-pdf/renderer';
 *   const buffer = await renderToBuffer(<DtrBatch records={records} />);
 */
export function DtrBatch({ records }: BatchDtrProps) {
  return (
    <Document
      title="Batch Daily Time Records"
      author="Senate of the Philippines HRIS"
      subject="CSC Form No. 48 — Daily Time Record"
      creator="Senate HRIS"
    >
      {records.map((props, idx) => (
        // Each DtrCscForm48 renders its own <Page> inside a shared <Document>
        // We need to extract just the Page children, so we re-use the internal
        // page content approach. Since React-PDF doesn't support nested Documents,
        // we render each employee as a separate Page within this single Document.
        //
        // The DtrCscForm48 component itself is a Document wrapper, so for batch
        // use we need its inner Page — which is exported below as DtrForm48Page.
        <DtrForm48Page key={idx} {...props} />
      ))}
    </Document>
  );
}

/**
 * Single-page version of the DTR for use inside a batch Document.
 * This is the Page-level component without the outer Document wrapper.
 */
import {
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { AttendanceLogRow } from '@/app/(dashboard)/attendance/queries';

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

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 30,
    color: '#000',
  },
  formTitle: { fontSize: 7, textAlign: 'center', marginBottom: 2 },
  mainTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { fontFamily: 'Helvetica-Bold', width: 80 },
  infoValue: {
    flex: 1,
    borderBottom: '0.5 solid #000',
    paddingBottom: 1,
    marginRight: 10,
  },
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
  signatureLine: { borderBottom: '0.5 solid #000', marginTop: 18, width: 160 },
  signatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});

function DtrForm48Page({
  employee,
  month,
  schedule,
  logs,
  totalLateMinutes,
  totalUndertimeMinutes,
}: DtrForm48Props) {
  const logByDay = new Map<number, AttendanceLogRow>();
  for (const log of logs) {
    const dayPart = log.date.split('-')[2] ?? '0';
    const day = Number(dayPart);
    logByDay.set(day, log);
  }

  const daysInMonth = 31;
  const totalUndertime = minutesToHM(totalLateMinutes + totalUndertimeMinutes);

  return (
    <Page size="LEGAL" orientation="portrait" style={S.page}>
      <Text style={S.formTitle}>Civil Service Form No. 48</Text>
      <Text style={S.mainTitle}>DAILY TIME RECORD</Text>

      <View style={S.infoRow}>
        <Text style={S.infoLabel}>Name:</Text>
        <Text style={[S.infoValue, { fontFamily: 'Helvetica-Bold' }]}>{employee.name}</Text>
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

      <View style={S.table}>
        {/* Header row 1 */}
        <View style={S.tableRow}>
          <View style={[S.headerCell, S.colDay]}><Text>{'\n'}</Text></View>
          <View style={[S.headerCell, { width: 144, textAlign: 'center' }]}><Text>A.M.</Text></View>
          <View style={[S.headerCell, { width: 144, textAlign: 'center' }]}><Text>P.M.</Text></View>
          <View style={[S.headerCell, { width: 60, textAlign: 'center' }]}><Text>UNDERTIME</Text></View>
        </View>
        {/* Header row 2 */}
        <View style={S.tableRow}>
          <View style={[S.headerCell, S.colDay]}><Text>Day</Text></View>
          <View style={[S.headerCell, S.colTime]}><Text>Arrival</Text></View>
          <View style={[S.headerCell, S.colTime]}><Text>Departure</Text></View>
          <View style={[S.headerCell, S.colTime]}><Text>Arrival</Text></View>
          <View style={[S.headerCell, S.colTime]}><Text>Departure</Text></View>
          <View style={[S.headerCell, S.colUndertime]}><Text>Hours</Text></View>
          <View style={[S.headerCell, S.colUndertime]}><Text>Minutes</Text></View>
        </View>

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const log = logByDay.get(day);
          const lateMin = log?.undertimeMinutes ?? 0;
          const { hours, mins } = minutesToHM(lateMin);
          const isAbsent = log && !log.timeIn && !log.timeOut;

          return (
            <View key={day} style={S.tableRow}>
              <View style={[S.cell, S.colDay]}><Text>{day}</Text></View>
              <View style={[S.cell, S.colTime]}>
                <Text>{!log ? '' : isAbsent ? 'ABSENT' : to12Hour(log.timeIn)}</Text>
              </View>
              <View style={[S.cell, S.colTime]}>
                <Text>{!log || isAbsent ? '' : '12:00 PM'}</Text>
              </View>
              <View style={[S.cell, S.colTime]}>
                <Text>{!log || isAbsent ? '' : '1:00 PM'}</Text>
              </View>
              <View style={[S.cell, S.colTime]}>
                <Text>{!log || isAbsent ? '' : to12Hour(log.timeOut)}</Text>
              </View>
              <View style={[S.cell, S.colUndertime]}>
                <Text>{lateMin > 0 ? String(hours) : ''}</Text>
              </View>
              <View style={[S.cell, S.colUndertime]}>
                <Text>{lateMin > 0 ? String(mins) : ''}</Text>
              </View>
            </View>
          );
        })}

        {/* Totals */}
        <View style={S.tableRow}>
          <View style={[S.headerCell, { flex: 1 }]}>
            <Text>TOTAL UNDERTIME FOR THE PERIOD</Text>
          </View>
          <View style={[S.cell, S.colUndertime]}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{totalUndertime.hours}</Text>
          </View>
          <View style={[S.cell, S.colUndertime]}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{totalUndertime.mins}</Text>
          </View>
        </View>
      </View>

      {/* Certification */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 7, lineHeight: 1.5 }}>
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
  );
}
