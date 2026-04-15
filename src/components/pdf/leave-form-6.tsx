/**
 * CSC Form 6 — Application for Leave
 * Rendered using @react-pdf/renderer for server-side PDF generation.
 *
 * Layout follows the official Civil Service Commission Form No. 6 format.
 * Reference: CSC Resolution No. 1200175, MC No. 41, s. 1998.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveForm6Props {
  /** Leave application details */
  application: {
    id: string;
    leaveTypeCode: LeaveTypeCode;
    startDate: string;
    endDate: string;
    workingDays: number;
    period: 'am' | 'pm' | 'whole_day';
    reason: string | null;
    status: string;
    approverRemarks: string | null;
    createdAt: string;
  };
  /** Employee information */
  employee: {
    firstName: string;
    middleName?: string;
    lastName: string;
    employeeNo: string;
    positionTitle: string;
    salary: string; // formatted monetary string, e.g., "44,000.00"
    officeName: string;
    dateHired: string;
  };
  /** Name of the recommending official */
  recommendingOfficialName?: string;
  /** Name of the approving authority */
  approvingAuthorityName?: string;
  /** Leave credit balances as of the date of application */
  credits?: {
    vlBalance: number;
    slBalance: number;
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SENATE_NAVY = '#0B2545';
const SENATE_GOLD = '#C8A84B';
const LIGHT_GRAY = '#f5f5f5';
const BORDER_COLOR = '#d1d5db';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    padding: 30,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    textAlign: 'center',
    marginBottom: 8,
  },
  headerAgency: {
    fontSize: 7,
    color: '#6b7280',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: SENATE_NAVY,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 7.5,
    color: '#374151',
    marginBottom: 2,
  },
  formNumber: {
    fontSize: 7,
    color: SENATE_GOLD,
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: SENATE_GOLD,
    marginVertical: 6,
  },
  thinDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_COLOR,
    marginVertical: 4,
  },
  // Sections
  sectionHeader: {
    backgroundColor: SENATE_NAVY,
    color: '#FAF4E6',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    padding: 3,
    marginBottom: 4,
  },
  // Rows
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  col: {
    flex: 1,
  },
  colLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    marginBottom: 1,
  },
  colValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_COLOR,
    paddingBottom: 2,
    minHeight: 14,
  },
  // Tables
  table: {
    borderWidth: 0.5,
    borderColor: BORDER_COLOR,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: LIGHT_GRAY,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_COLOR,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: BORDER_COLOR,
  },
  tableCell: {
    padding: 3,
    fontSize: 7,
    flex: 1,
    borderRightWidth: 0.3,
    borderRightColor: BORDER_COLOR,
  },
  tableCellHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    color: '#374151',
  },
  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 0.8,
    borderColor: '#374151',
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    width: 6,
    height: 6,
    backgroundColor: SENATE_NAVY,
  },
  checkboxLabel: {
    fontSize: 7.5,
    flex: 1,
  },
  // Signature area
  signatureBlock: {
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_COLOR,
    paddingTop: 4,
  },
  signatureLine: {
    borderBottomWidth: 0.8,
    borderBottomColor: '#374151',
    marginBottom: 2,
    height: 20,
  },
  signatureLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Stamp area
  officialUse: {
    backgroundColor: LIGHT_GRAY,
    border: 0.5,
    borderColor: BORDER_COLOR,
    padding: 8,
    marginTop: 6,
  },
  officialUseTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textDecoration: 'underline',
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function CheckboxItem({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  return (
    <View style={styles.checkboxRow}>
      <View style={styles.checkbox}>
        {checked && <View style={styles.checkboxChecked} />}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PDF Document
// ---------------------------------------------------------------------------

export function LeaveForm6({
  application,
  employee,
  recommendingOfficialName = '___________________________',
  approvingAuthorityName = '___________________________',
  credits,
}: LeaveForm6Props) {
  const leaveType = LEAVE_TYPES[application.leaveTypeCode];
  const fullName = `${employee.lastName}, ${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ''}`;

  return (
    <Document
      title={`CSC Form No. 6 — ${fullName}`}
      author="Senate of the Philippines HRIS"
      subject="Application for Leave"
      keywords="leave,CSC,Form 6,Senate HRIS"
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.formNumber}>Republic of the Philippines</Text>
          <Text style={styles.headerTitle}>SENATE OF THE PHILIPPINES</Text>
          <Text style={styles.headerSubtitle}>Human Resources Information System</Text>
          <View style={styles.divider} />
          <Text style={styles.headerAgency}>CSC FORM No. 6 (Revised 2018)</Text>
          <Text style={styles.headerTitle}>APPLICATION FOR LEAVE</Text>
        </View>

        {/* ── I. Employee Information ─────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>I. EMPLOYEE INFORMATION</Text>
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: 8 }]}>
            <Text style={styles.colLabel}>1. OFFICE / DEPARTMENT</Text>
            <Text style={styles.colValue}>{employee.officeName}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>2. NAME (Last, First, Middle)</Text>
            <Text style={styles.colValue}>{fullName}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: 8 }]}>
            <Text style={styles.colLabel}>3. DATE OF FILING</Text>
            <Text style={styles.colValue}>{formatDate(application.createdAt)}</Text>
          </View>
          <View style={[styles.col, { marginRight: 8 }]}>
            <Text style={styles.colLabel}>4. POSITION</Text>
            <Text style={styles.colValue}>{employee.positionTitle}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>5. SALARY</Text>
            <Text style={styles.colValue}>₱ {employee.salary}</Text>
          </View>
        </View>

        {/* ── II. Type of Leave ──────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>II. DETAILS OF APPLICATION</Text>
        <Text style={[styles.colLabel, { marginBottom: 4 }]}>
          6. TYPE OF LEAVE TO BE AVAILED OF
        </Text>

        {/* Leave type checkboxes */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {Object.values(LEAVE_TYPES).map((lt) => (
            <View key={lt.code} style={{ width: '50%', marginBottom: 2 }}>
              <CheckboxItem
                label={`${lt.code} — ${lt.name}`}
                checked={application.leaveTypeCode === lt.code}
              />
            </View>
          ))}
        </View>

        {/* ── III. Dates and Days ─────────────────────────────────────────── */}
        <Text style={[styles.colLabel, { marginBottom: 3 }]}>
          7. INCLUSIVE DATE(S) OF LEAVE
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {['DATE FROM', 'DATE TO', 'NO. OF WORKING DAYS', 'PERIOD'].map((h) => (
              <View key={h} style={styles.tableCell}>
                <Text style={styles.tableCellHeader}>{h}</Text>
              </View>
            ))}
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <Text>{formatDate(application.startDate)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text>{formatDate(application.endDate)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{application.workingDays}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text>
                {application.period === 'whole_day'
                  ? 'Whole Day'
                  : application.period === 'am'
                    ? 'AM'
                    : 'PM'}
              </Text>
            </View>
          </View>
        </View>

        {/* Commutation */}
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <CheckboxItem
            label="In case of Vacation/Forced Leave — commutation requested"
            checked={false}
          />
        </View>

        {/* Reason */}
        <Text style={styles.colLabel}>8. REASON FOR LEAVE</Text>
        <View
          style={{
            minHeight: 30,
            borderWidth: 0.5,
            borderColor: BORDER_COLOR,
            padding: 4,
            marginBottom: 6,
          }}
        >
          <Text>{application.reason ?? '(No reason provided)'}</Text>
        </View>

        {/* ── IV. Leave Credit Balance ────────────────────────────────────── */}
        {credits && (
          <>
            <Text style={styles.sectionHeader}>III. LEAVE CREDIT BALANCE</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                {['LEAVE TYPE', 'BALANCE (Days)', 'USED', 'REMAINING'].map((h) => (
                  <View key={h} style={styles.tableCell}>
                    <Text style={styles.tableCellHeader}>{h}</Text>
                  </View>
                ))}
              </View>
              {[
                {
                  type: 'Vacation Leave (VL)',
                  balance: credits.vlBalance,
                  used:
                    application.leaveTypeCode === 'VL' ? application.workingDays : 0,
                },
                {
                  type: 'Sick Leave (SL)',
                  balance: credits.slBalance,
                  used:
                    application.leaveTypeCode === 'SL' ? application.workingDays : 0,
                },
              ].map(({ type, balance, used }) => (
                <View key={type} style={styles.tableRow}>
                  <View style={styles.tableCell}>
                    <Text>{type}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text>{balance.toFixed(3)}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text>{used.toFixed(1)}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                      {Math.max(0, balance - used).toFixed(3)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── V. Approval Section ─────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>IV. CERTIFICATION OF LEAVE CREDITS</Text>
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: 16 }]}>
            <Text style={[styles.colLabel, { marginBottom: 2 }]}>
              I CERTIFY that the leave applied for is authorized under existing laws and CSC
              rules and regulations, and that the employee has sufficient leave credits.
            </Text>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>
                Signature over Printed Name / Date
              </Text>
              <Text style={[styles.signatureLabel, { marginTop: 1 }]}>
                AUTHORIZED OFFICER
              </Text>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={[styles.colLabel, { marginBottom: 2 }]}>
              RECOMMENDED:
            </Text>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{recommendingOfficialName}</Text>
              <Text style={[styles.signatureLabel, { marginTop: 1 }]}>
                Recommending Official / Date
              </Text>
            </View>
            <View style={[styles.signatureBlock, { marginTop: 8 }]}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{approvingAuthorityName}</Text>
              <Text style={[styles.signatureLabel, { marginTop: 1 }]}>
                Approving Authority / Date
              </Text>
            </View>
          </View>
        </View>

        {/* ── VI. Applicant Signature ─────────────────────────────────────── */}
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: 16 }]}>
            <Text style={[styles.colLabel, { marginBottom: 2 }]}>APPLICANT SIGNATURE:</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Signature over Printed Name / Date</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.colLabel, { marginBottom: 2 }]}>APPLICATION STATUS:</Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Helvetica-Bold',
                color:
                  application.status === 'approved'
                    ? '#059669'
                    : application.status === 'disapproved'
                      ? '#dc2626'
                      : '#d97706',
                marginTop: 4,
              }}
            >
              {application.status.toUpperCase().replace(/_/g, ' ')}
            </Text>
            {application.approverRemarks && (
              <Text style={[styles.colLabel, { marginTop: 2 }]}>
                Remarks: {application.approverRemarks}
              </Text>
            )}
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View
          style={{
            marginTop: 10,
            borderTopWidth: 0.5,
            borderTopColor: BORDER_COLOR,
            paddingTop: 4,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={styles.colLabel}>
            Generated by Senate HRIS — {new Date().toLocaleDateString('en-PH')}
          </Text>
          <Text style={styles.colLabel}>
            Ref: {application.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.colLabel}>CSC Form No. 6 (Revised 2018)</Text>
        </View>
      </Page>
    </Document>
  );
}
