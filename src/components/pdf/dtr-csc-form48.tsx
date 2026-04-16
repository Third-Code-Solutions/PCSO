/**
 * CSC Form No. 48 — Daily Time Record
 * React-PDF implementation matching the official Civil Service Commission format.
 *
 * Reference: CSC Memorandum Circular No. 16, s. 2013 and CSC Form No. 48 layout.
 *
 * Note: @react-pdf/renderer v4 is strict about style shorthands and about
 * component return shapes. This implementation uses long-form style props,
 * wraps every branch in a native Element, and never returns Fragments from
 * sub-components.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AttendanceLogRow } from '@/app/(dashboard)/attendance/queries';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DtrForm48Props {
  employee: {
    name: string;
    employeeNumber: string;
    position: string;
    department: string;
    salary: string;
  };
  month: string;
  schedule: { start: string; end: string };
  logs: AttendanceLogRow[];
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
}

// ─── Styles (long-form only — v4 parser is strict) ───────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    paddingTop: 20,
    paddingBottom: 30,
    paddingLeft: 30,
    paddingRight: 30,
    color: '#000000',
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    paddingBottom: 1,
    marginRight: 10,
  },
  infoBold: { fontFamily: 'Helvetica-Bold' },
  table: {
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#000000',
    borderTopStyle: 'solid',
    borderLeftWidth: 0.5,
    borderLeftColor: '#000000',
    borderLeftStyle: 'solid',
  },
  row: { flexDirection: 'row' },
  cell: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    borderRightWidth: 0.5,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 3,
    paddingRight: 3,
    textAlign: 'center',
  },
  headerCell: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    borderRightWidth: 0.5,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 3,
    paddingRight: 3,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f0f0f0',
  },
  colDay: { width: 22 },
  colTime: { width: 36 },
  colUndertime: { width: 30 },
  colAmPm: { width: 144, textAlign: 'center' },
  colUndertimeHead: { width: 60, textAlign: 'center' },
  totalLabel: { flex: 1 },
  certSection: { marginTop: 12 },
  certText: { fontSize: 7, lineHeight: 1.5 },
  signatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  signatureCol: { width: 200 },
  signatureLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginTop: 18,
    width: 160,
  },
  signatureLineWide: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginTop: 18,
    width: 180,
  },
  signatureName: { textAlign: 'center', fontSize: 7 },
  signatureCaption: { textAlign: 'center', fontSize: 7, color: '#555555' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function to12Hour(time: string | null | undefined): string {
  if (!time) return '';
  const parts = time.split(':');
  const h = Number(parts[0] ?? '0');
  const m = Number(parts[1] ?? '0');
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

function minutesToHM(minutes: number): { hours: number; mins: number } {
  const m = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return { hours: Math.floor(m / 60), mins: m % 60 };
}

/** Safely produce a text node — @react-pdf v4 refuses null/undefined children. */
function t(value: unknown): string {
  if (value === null || value === undefined) return ' ';
  const s = String(value);
  return s.length > 0 ? s : ' ';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DtrCscForm48(props: DtrForm48Props) {
  const {
    employee,
    month,
    schedule,
    logs,
    totalLateMinutes,
    totalUndertimeMinutes,
  } = props;

  const logByDay = new Map<number, AttendanceLogRow>();
  for (const log of logs ?? []) {
    if (!log?.date) continue;
    const day = Number(log.date.split('-')[2] ?? '0');
    if (day >= 1 && day <= 31) logByDay.set(day, log);
  }

  const daysInMonth = 31;
  const totalUndertime = minutesToHM(
    (totalLateMinutes ?? 0) + (totalUndertimeMinutes ?? 0),
  );

  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i += 1) days.push(i);

  return (
    <Document>
      <Page size="LEGAL" orientation="portrait" style={S.page}>
        <Text style={S.formTitle}>{t('Civil Service Form No. 48')}</Text>
        <Text style={S.mainTitle}>{t('DAILY TIME RECORD')}</Text>

        <View style={S.infoRow}>
          <Text style={S.infoLabel}>{t('Name:')}</Text>
          <Text style={[S.infoValue, S.infoBold]}>{t(employee.name)}</Text>
        </View>

        <View style={S.infoRow}>
          <Text style={S.infoLabel}>{t('Position:')}</Text>
          <Text style={S.infoValue}>{t(employee.position)}</Text>
          <Text style={S.infoLabel}>{t('Employee No.:')}</Text>
          <Text style={S.infoValue}>{t(employee.employeeNumber)}</Text>
        </View>

        <View style={S.infoRow}>
          <Text style={S.infoLabel}>{t('Office/Dept.:')}</Text>
          <Text style={S.infoValue}>{t(employee.department)}</Text>
        </View>

        <View style={S.infoRow}>
          <Text style={S.infoLabel}>{t('Month of:')}</Text>
          <Text style={S.infoValue}>{t(month)}</Text>
          <Text style={S.infoLabel}>{t('Schedule:')}</Text>
          <Text style={S.infoValue}>
            {t(`${schedule.start} – ${schedule.end}`)}
          </Text>
        </View>

        <View style={S.table}>
          {/* Group headers */}
          <View style={S.row}>
            <View style={[S.headerCell, S.colDay]}>
              <Text>{t(' ')}</Text>
            </View>
            <View style={[S.headerCell, S.colAmPm]}>
              <Text>{t('A.M.')}</Text>
            </View>
            <View style={[S.headerCell, S.colAmPm]}>
              <Text>{t('P.M.')}</Text>
            </View>
            <View style={[S.headerCell, S.colUndertimeHead]}>
              <Text>{t('UNDERTIME')}</Text>
            </View>
          </View>

          {/* Sub headers */}
          <View style={S.row}>
            <View style={[S.headerCell, S.colDay]}>
              <Text>{t('Day')}</Text>
            </View>
            <View style={[S.headerCell, S.colTime]}>
              <Text>{t('Arrival')}</Text>
            </View>
            <View style={[S.headerCell, S.colTime]}>
              <Text>{t('Departure')}</Text>
            </View>
            <View style={[S.headerCell, S.colTime]}>
              <Text>{t('Arrival')}</Text>
            </View>
            <View style={[S.headerCell, S.colTime]}>
              <Text>{t('Departure')}</Text>
            </View>
            <View style={[S.headerCell, S.colUndertime]}>
              <Text>{t('Hours')}</Text>
            </View>
            <View style={[S.headerCell, S.colUndertime]}>
              <Text>{t('Minutes')}</Text>
            </View>
          </View>

          {/* Day rows */}
          {days.map((day) => {
            const log = logByDay.get(day);
            const isEmpty = !log;
            const isAbsent = !isEmpty && !log.timeIn && !log.timeOut;
            const under = isEmpty ? 0 : log.undertimeMinutes ?? 0;
            const { hours, mins } = minutesToHM(under);

            const arrivalAm = isEmpty
              ? ''
              : isAbsent
                ? 'ABSENT'
                : to12Hour(log.timeIn);
            const departureAm = isEmpty || isAbsent ? '' : '12:00 PM';
            const arrivalPm = isEmpty || isAbsent ? '' : '1:00 PM';
            const departurePm = isEmpty || isAbsent ? '' : to12Hour(log.timeOut);
            const hoursStr = under > 0 ? String(hours) : '';
            const minsStr = under > 0 ? String(mins) : '';

            return (
              <View key={day} style={S.row}>
                <View style={[S.cell, S.colDay]}>
                  <Text>{t(day)}</Text>
                </View>
                <View style={[S.cell, S.colTime]}>
                  <Text>{t(arrivalAm)}</Text>
                </View>
                <View style={[S.cell, S.colTime]}>
                  <Text>{t(departureAm)}</Text>
                </View>
                <View style={[S.cell, S.colTime]}>
                  <Text>{t(arrivalPm)}</Text>
                </View>
                <View style={[S.cell, S.colTime]}>
                  <Text>{t(departurePm)}</Text>
                </View>
                <View style={[S.cell, S.colUndertime]}>
                  <Text>{t(hoursStr)}</Text>
                </View>
                <View style={[S.cell, S.colUndertime]}>
                  <Text>{t(minsStr)}</Text>
                </View>
              </View>
            );
          })}

          {/* Totals */}
          <View style={S.row}>
            <View style={[S.headerCell, S.totalLabel]}>
              <Text>{t('TOTAL UNDERTIME FOR THE PERIOD')}</Text>
            </View>
            <View style={[S.cell, S.colUndertime]}>
              <Text style={S.infoBold}>{t(totalUndertime.hours)}</Text>
            </View>
            <View style={[S.cell, S.colUndertime]}>
              <Text style={S.infoBold}>{t(totalUndertime.mins)}</Text>
            </View>
          </View>
        </View>

        <View style={S.certSection}>
          <Text style={S.certText}>
            {t(
              'I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival at and departure from the office.',
            )}
          </Text>

          <View style={S.signatureBlock}>
            <View style={S.signatureCol}>
              <View style={S.signatureLine} />
              <Text style={S.signatureName}>{t(employee.name)}</Text>
              <Text style={S.signatureCaption}>
                {t('Employee Signature over Printed Name')}
              </Text>
            </View>
            <View style={S.signatureCol}>
              <View style={S.signatureLineWide} />
              <Text style={S.signatureName}>
                {t('Verified as to the prescribed office hours')}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
