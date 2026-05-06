#!/usr/bin/env node
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const SCREENSHOTS_DIR = path.resolve(__dirname, "../screenshots");
const OUTPUT_DIR = path.resolve(__dirname, "../outputs");

const MARGIN = 72;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const H1_SIZE = 16;
const H2_SIZE = 13;
const BODY_SIZE = 10;
const FOOTER_SIZE = 8;

const HR_ADMIN_FEATURES = [
  {
    file: "01-Dashboard.png",
    title: "HR Administrator Dashboard",
    module: "Dashboard",
    description:
      "The central command centre for HR Administrators. Displays live KPIs including active headcount, pending leave approvals, ongoing payroll runs, and upcoming deadlines. Quick-access tiles allow navigation to any module without drilling through menus. The dashboard auto-refreshes every 30 seconds and is scoped to All Units by default.",
  },
  {
    file: "02-Employee-Records.png",
    title: "Employee Records - Master List",
    module: "Personnel Information Management (PIMM)",
    description:
      "The primary employee roster showing all Organic (Permanent, Temporary, Co-terminus, CTI) and Non-Organic (JO, COS, Consultant) personnel. Supports real-time name search with debounce, filter by employment status, appointment type, office, and sector. Each row links to the full 201 file.",
  },
  {
    file: "03-New-Employee.png",
    title: "New Employee - 201 File Creation",
    module: "Personnel Information Management (PIMM)",
    description:
      "Multi-step wizard for creating a new 201 file. Captures personal data, government IDs (TIN, GSIS, PhilHealth, Pag-IBIG), appointment details, salary grade and step, assigned office, and initial document checklist. All fields are validated against FM lookup tables before commit. Triggered automatically when an appointment is issued in RPM.",
  },
  {
    file: "04-Document-Requests.png",
    title: "Document Requests - Queue",
    module: "Personnel Information Management (PIMM)",
    description:
      "Centralised queue for all pending HR document requests submitted by employees. Shows status (Received, In Process, On Hold, Ready, Released), assigned HR staff, target SLA (3 working days), and days elapsed. HR staff can bulk-assign requests and filter by document type, status, or requesting department.",
  },
  {
    file: "05-New-Document-Request.png",
    title: "New Document Request - HR-Initiated",
    module: "Personnel Information Management (PIMM)",
    description:
      "HR Administrators can create document requests on behalf of employees (e.g., walk-in requests). Select the employee, document type (COE, COE with Remunerations, Service Record, PDS, Custom), state the purpose, and assign the processor. System auto-generates a serial number from the centralised serial_sequences table upon generation.",
  },
  {
    file: "06-Org-Chart.png",
    title: "Organisational Chart",
    module: "File Maintenance (FM)",
    description:
      "Interactive visual representation of the PCSO organisational hierarchy: Charity Sector, Management Services Sector, and the four regional branches (NCL, STBR, Visayas, Mindanao). HR Admins can expand/collapse nodes, view headcount per unit, and click any node to see the unit roster. The chart is driven by the FM office hierarchy table.",
  },
  {
    file: "07-Attendance-Overview.png",
    title: "Attendance Overview",
    module: "Time and Attendance (TAM)",
    description:
      "Summary dashboard for the current pay period showing total present, absent, late, and on-leave counts across all units. Includes a calendar heatmap of daily attendance rate and a table of employees with attendance anomalies flagged for HR review. Drill-down to individual DTRs is one click away.",
  },
  {
    file: "08-Admin-Grid.png",
    title: "Attendance Admin Grid",
    module: "Time and Attendance (TAM)",
    description:
      "Bulk attendance view in a spreadsheet-style grid: employees as rows, days as columns, with colour-coded cells (Present, Absent, Late, On Leave, Holiday, Suspended). HR staff can select cells to apply corrections, mark absences as LWOP, or link to a filed leave application. Changes are staged until HR Admin commits.",
  },
  {
    file: "09-DTR.png",
    title: "Daily Time Record (DTR)",
    module: "Time and Attendance (TAM)",
    description:
      "Individual employee DTR view showing biometric time-in/time-out for every working day of the selected month. Displays computed tardiness and undertime minutes per day, total tardiness/undertime for the month, OT hours, and leave consumption. Matches CSC Form 48 format and can be exported to PDF for official submission.",
  },
  {
    file: "10-Timesheets.png",
    title: "Timesheets - Batch View",
    module: "Time and Attendance (TAM)",
    description:
      "Batch timesheet management for processing all employee DTRs for a given period. HR staff can generate, review, and approve timesheets in bulk. Filters by office, position level, and employment status. Integrates with the payroll module. Approved timesheets lock in LWOP and undertime deduction values for the current payroll run.",
  },
  {
    file: "11-Overtime-Approvals.png",
    title: "Overtime Approvals Queue",
    module: "Time and Attendance (TAM)",
    description:
      "Pending OT requests from all employees pending HR review. Shows requestor, department, date, number of OT hours requested, and purpose. HR Admins can approve, disapprove, or return for clarification. Approved OT hours are automatically reflected in the DTR and the payroll computation for the period.",
  },
  {
    file: "12-New-Overtime.png",
    title: "New Overtime Request - HR Entry",
    module: "Time and Attendance (TAM)",
    description:
      "Form for HR staff to encode OT requests on behalf of employees (for offline/paper-based submissions). Selects employee, specifies date, time-in and time-out for OT, purpose, and supporting document upload. OT rate is computed per CSC rules: weekday, rest day, regular holiday, or special non-working day.",
  },
  {
    file: "13-Import-Biometric.png",
    title: "Import Biometric Data",
    module: "Time and Attendance (TAM)",
    description:
      "Manual biometric data import interface for uploading raw TITO exports from biometric devices. Accepts CSV, JSON, or XML formats. Preview table shows parsed records before commit, with validation flags for unmatched employee IDs and duplicate entries. This is the guaranteed fallback path when the device API push is unavailable.",
  },
  {
    file: "14-Work-Schedules.png",
    title: "Work Schedules - Library",
    module: "Time and Attendance (TAM) / File Maintenance (FM)",
    description:
      "Master list of all configured work schedules in the system. Each schedule record shows schedule code, name, time-in, time-out, break window, total contractual hours, applicable days of week, and grace period minutes. Schedules can be assigned to individual employees or entire office groups.",
  },
  {
    file: "15-New-Schedule.png",
    title: "New Work Schedule",
    module: "Time and Attendance (TAM) / File Maintenance (FM)",
    description:
      "Configuration form for creating a new work schedule. Supports fixed, flexible/gapped, and date-range-specific schedules. Grace period is set per schedule (not globally) to accommodate different office policies. Schedules are immediately available for assignment after saving.",
  },
  {
    file: "16-Attendance-Analytics.png",
    title: "Attendance Analytics",
    module: "Time and Attendance (TAM)",
    description:
      "Deep-dive analytics dashboard showing attendance trends over time: tardiness frequency distribution, top absentee list, perfect attendance list, OT utilisation per department, and monthly comparison charts. All panels are filterable by branch, department, division, position level, and employment status.",
  },
  {
    file: "17-Biometric-Devices.png",
    title: "Biometric Devices - Registry",
    module: "Time and Attendance (TAM)",
    description:
      "Device management panel listing all registered biometric BFR devices across PCSO locations. Shows device name, location, last sync timestamp, connection status (Online/Offline), and integration mode (API Push, Polling, or Manual). Super Admin and HR Admin can register, edit, or deactivate devices here.",
  },
  {
    file: "18-Web-Time-Clock.png",
    title: "Web Time Clock",
    module: "Time and Attendance (TAM)",
    description:
      "Browser-based time clock allowing employees to clock in/out from any authorised workstation when biometric hardware is unavailable. Captures employee ID, timestamp, and IP address. Clock-in records are tagged as source: manual_hr or manual_employee_request and flagged for optional supervisor confirmation. This system is also capable of connecting with biometrics hardware.",
  },
  {
    file: "19-Leave-Overview.png",
    title: "Leave Administration Overview",
    module: "Leave Administration (LAM)",
    description:
      "High-level leave dashboard showing total leave applications filed in the current period, breakdown by leave type (VL, SL, Forced, SPL, etc.), pending approvals count, and LWOP incidents. Also surfaces employees approaching forced leave deduction thresholds and auto-approval timeouts (5 business days).",
  },
  {
    file: "20-Leave-Applications.png",
    title: "Leave Applications - Full List",
    module: "Leave Administration (LAM)",
    description:
      "Complete list of all leave applications with filter options by employee, leave type, date range, status, and office. Each row shows the applicant, leave type, dates, number of days, filing date, approver, and current status (Pending / Approved / Disapproved / Cancelled). HR Admin can approve or process any application from this view.",
  },
  {
    file: "21-Apply-for-Leave.png",
    title: "Apply for Leave - HR Entry",
    module: "Leave Administration (LAM)",
    description:
      "Leave application form in CSC Form 6 format. HR staff can file leave on behalf of employees. Fields: leave type, inclusive dates, number of days (auto-computed excluding weekends and holidays), half-day toggle (AM/PM), reason, and document attachment for applicable leave types (medical certificate, etc.). Deduction is applied immediately upon approval.",
  },
  {
    file: "22-Approvals-Queue.png",
    title: "Leave Approvals Queue",
    module: "Leave Administration (LAM)",
    description:
      "Dedicated queue for leave applications pending HR action. Displays days elapsed since submission with visual ageing indicators. Applications approaching the 5-business-day auto-approval timeout are highlighted. Bulk approve/disapprove is supported for batch processing. All actions are timestamped in the audit log.",
  },
  {
    file: "23-Leave-Credits.png",
    title: "Leave Credits - Employee View",
    module: "Leave Administration (LAM)",
    description:
      "Current leave credit balances per employee across all leave types: Vacation Leave (VL), Sick Leave (SL), Forced Leave, Special Privilege Leave, and others. Shows opening balance, total earned for the year, total consumed, and current balance. Monthly accrual log is viewable per leave type with the accrual_run reference.",
  },
  {
    file: "24-Credits-Admin.png",
    title: "Leave Credits - Admin Adjustment",
    module: "Leave Administration (LAM)",
    description:
      "HR Admin tool for manual leave credit adjustments (migration, correction, or policy-based grants). Requires a reason and goes through a staged approval workflow before commit. All adjustments are logged in the audit trail with the approver ID and timestamp. Supports bulk credit upload from CSV for initial data migration.",
  },
  {
    file: "25-Bulk-Upload.png",
    title: "Bulk Leave Ledger Upload",
    module: "Leave Administration (LAM)",
    description:
      "CSV/Excel bulk import tool for loading existing leave ledgers during system migration. A field-mapping UI lets HR staff align source columns to system fields. A validation preview shows potential errors (duplicate employee-period combos, invalid leave types, out-of-range values) before committing. No partial commits - the entire upload succeeds or rolls back.",
  },
  {
    file: "26-Advanced-Reports.png",
    title: "Advanced Leave Reports",
    module: "Leave Administration (LAM)",
    description:
      "Comprehensive leave reporting suite: leave ledger per employee, leave balance report, LWOP by period, sex-disaggregated leave data (for GAD compliance), disapproved applications analysis, and ad hoc report builder. All reports are exportable to Excel/CSV and filterable by office, sector, department, branch, and date range.",
  },
  {
    file: "27-Leave-Calendar.png",
    title: "Leave Calendar",
    module: "Leave Administration (LAM)",
    description:
      "Month-view calendar showing approved leaves across the organisation. HR staff see all employees leave overlaps, allowing them to identify coverage gaps and enforce minimum staffing rules. Filter by office or team. Colour-coded by leave type. Hovering a leave entry shows employee name, leave type, and duration.",
  },
  {
    file: "28-Payroll-Overview.png",
    title: "Payroll Overview",
    module: "Payroll Module (PM)",
    description:
      "Payroll module dashboard showing current payroll run statuses across all 8 payroll types (General, JO/COS, RATA, Cash Advance, Benefits and Bonuses, Salary Differential, Special, Magna Carta). Displays period-to-date totals for gross pay, total deductions, and net pay. Remittance status for BIR, GSIS, PhilHealth, and Pag-IBIG is tracked here.",
  },
  {
    file: "29-New-Payroll.png",
    title: "New Payroll Run",
    module: "Payroll Module (PM)",
    description:
      "Payroll run creation wizard. HR staff select payroll type, period start/end, and the employee set to include. Mandatory deductions (BIR withholding per TRAIN Law, GSIS 9%, PhilHealth 2.5%, Pag-IBIG) are computed automatically per the formulas in Section 10 of the PRD. YTD taxable income is maintained for the annualised withholding method.",
  },
  {
    file: "30-Payslips.png",
    title: "Payslips - Master View",
    module: "Payroll Module (PM)",
    description:
      "Full payslip ledger showing all issued payslips across all payroll types and periods. Searchable by employee, payroll type, and period. Each payslip shows gross pay, itemised deductions (BIR, GSIS, PhilHealth, Pag-IBIG, loans, other), and net pay. Employees can also access their own payslips via the Employee Portal.",
  },
  {
    file: "31-Payroll-History.png",
    title: "Payroll History",
    module: "Payroll Module (PM)",
    description:
      "Audit trail of all completed payroll runs with their final totals, approval chain, finalisation timestamps, and bank hash file generation status. Finalised payrolls are immutable - corrections require a new adjustment payroll run. Full payroll register and batch payslip PDFs can be re-exported from this view.",
  },
  {
    file: "32-JO-COS-Payroll.png",
    title: "JO/COS Payroll",
    module: "Payroll Module (PM)",
    description:
      "Separate payroll run for Job Order and Contract of Service personnel. JO/COS employees are not covered by GSIS or CSC rules, so mandatory deductions differ. PhilHealth contribution depends on their contract terms (configurable per employee). Net pay is computed and exported to bank hash files per the designated bank format.",
  },
  {
    file: "33-Benefits-Bonuses.png",
    title: "Benefits and Bonuses Payroll",
    module: "Payroll Module (PM)",
    description:
      "Specialised payroll type for statutory benefits: Mid-Year Bonus (1 month basic), Year-End Bonus (1 month basic), Cash Gift (PHP 5,000), and Performance-Based Bonus (PBB) per the approved PBB-qualified list from PMM. Tax treatment follows TRAIN Law de minimis rules with the PHP 90,000 annual tax-exempt ceiling.",
  },
  {
    file: "34-New-Benefits.png",
    title: "New Benefits and Bonuses Run",
    module: "Payroll Module (PM)",
    description:
      "Creation form for a Benefits and Bonuses payroll run. HR staff select the benefit type, confirm the eligible employee set (auto-pulled from the PBB qualified list for PBB runs), and verify the computation before submission for approval. System enforces TRAIN Law ceilings and flags any employee exceeding the annual de minimis limit.",
  },
  {
    file: "35-Performance-Overview.png",
    title: "Performance Management Overview",
    module: "Performance Management (PMM)",
    description:
      "Summary dashboard for the active performance cycle. Shows completion rates for IPCRF planning, monitoring, and review phases across all units. Flags units with outstanding submissions and upcoming deadlines. Forced ranking compliance (Outstanding 10% max, Very Satisfactory 25% max) violations are surfaced here.",
  },
  {
    file: "36-Performance-Cycles.png",
    title: "Performance Cycles",
    module: "Performance Management (PMM)",
    description:
      "Management interface for SPMS performance cycles. HR Admin creates, opens, and closes semi-annual cycles (Semester 1: Jan-Jun, Semester 2: Jul-Dec). Each cycle has configurable deadlines for the planning, monitoring, and review phases. Only one cycle per semester can be open at a time.",
  },
  {
    file: "37-New-Cycle.png",
    title: "New Performance Cycle",
    module: "Performance Management (PMM)",
    description:
      "Form to create a new performance cycle with the year, semester, and phase deadlines (planning, monitoring, review). Once opened, system sends N-023 notifications to all active ratees. Cycle closure triggers automatic generation of the PBB-qualified list for eligible employees who pass all 4 qualification gates.",
  },
  {
    file: "38-IPCRF.png",
    title: "IPCRF - Individual Performance Review",
    module: "Performance Management (PMM)",
    description:
      "Individual Performance Commitment and Review Form per employee per cycle. HR Admin can view, edit (during open phases), and upload scanned IPCRF documents. Numerical rating (1.000-5.000) maps to the CSC adjectival scale: Outstanding (4.500 and above), Very Satisfactory (3.500-4.499), Satisfactory (2.500-3.499), Unsatisfactory, or Poor.",
  },
  {
    file: "39-OPCRF.png",
    title: "OPCRF - Office Performance Review",
    module: "Performance Management (PMM)",
    description:
      "Office Performance Commitment and Review Form at the unit level. Aggregates IPCRF ratings into office-level performance indicators. HR Admin manages OPCRF creation, routing for signatures (configurable via FM signatory chains), and scanned document upload per cycle.",
  },
  {
    file: "40-Recruitment-Overview.png",
    title: "Recruitment and Promotion Overview",
    module: "Recruitment and Promotion (RPM)",
    description:
      "Dashboard for all active and completed recruitment pipelines. Shows open MRFs by status, published vacancies, applicant counts per position, and pipeline stages (Application Review, Exam, Rating, Shortlisted, For Board, Appointed). HR Admin can jump into any active recruitment process from this view.",
  },
  {
    file: "41-MRFs.png",
    title: "Manpower Request Forms (MRFs)",
    module: "Recruitment and Promotion (RPM)",
    description:
      "List of all Manpower Request Forms with their current approval status: Draft, Submitted, Approved, or Returned. Each MRF includes the requesting department, position, salary grade, and justification. Approved MRFs trigger CSC Form 9 (Publication of Vacant Position) generation and posting on the applicant portal.",
  },
  {
    file: "42-New-MRF.png",
    title: "New Manpower Request Form",
    module: "Recruitment and Promotion (RPM)",
    description:
      "Digital MRF creation with multi-level signature routing configurable via FM. Required fields: office, position (from FM plantilla), reason for vacancy, proposed appointment type, qualification standards (education, eligibility, experience, training), and items required. Duplicate detection prevents multiple active MRFs for the same plantilla item number.",
  },
  {
    file: "43-Vacancies.png",
    title: "Published Vacancies",
    module: "Recruitment and Promotion (RPM)",
    description:
      "List of all currently published vacant positions visible on the public applicant portal. Shows position title, salary grade, office/sector, publication date, closing date, and applicant count to date. HR Admin can upload the CSC-received publication confirmation against each vacancy and manage the publication window.",
  },
  {
    file: "44-Applicants.png",
    title: "Applicants - Master List",
    module: "Recruitment and Promotion (RPM)",
    description:
      "Complete applicant roster per vacancy showing applicant name, submission date, qualification match score (auto-computed: Education %, Eligibility Match, Experience Years vs Required, Training Match), and current status. HR staff can view full application details, uploaded documents, and override the system-computed qualification screening.",
  },
  {
    file: "45-Selection.png",
    title: "Selection Process and Rating Sheet",
    module: "Recruitment and Promotion (RPM)",
    description:
      "Assessment and ranking interface. HR staff encode written exam scores, interview ratings, PE scores, and other criteria per applicant. Configurable weighting per position produces a ranked Rating Sheet showing all qualified applicants by total weighted score. The top 5 list for GM and the recommended list for Board are auto-filtered from this ranking.",
  },
  {
    file: "46-Appointments.png",
    title: "Appointments - List",
    module: "Recruitment and Promotion (RPM)",
    description:
      "List of all issued appointments with status (Pending, Board Confirmed, Issued). Shows appointee name, position, salary grade, effectivity date, and appointment type. Each appointment links to the full document set: CSC Appointment, Position Description Form, Oath of Office, Assumption to Duty, and ATAF.",
  },
  {
    file: "47-New-Appointment.png",
    title: "New Appointment - Issuance",
    module: "Recruitment and Promotion (RPM)",
    description:
      "Appointment issuance form auto-populated from the Board-confirmed applicant record. HR Admin confirms position, salary grade, step, effectivity date, and appointment type. On save, the system atomically creates the 201 file, plantilla entry, payroll profile, leave ledger, and attendance schedule in a single transaction (RPM-023). If any sub-operation fails, the entire appointment rolls back.",
  },
  {
    file: "48-Announcements.png",
    title: "Announcements and Memorandums",
    module: "Employee Portal (EPM)",
    description:
      "HR-managed announcements board for posting Memorandum Orders and Circulars visible to all employees via the Employee Portal. HR Admin creates, edits, and archives announcements. Employee acknowledgements are logged with timestamps. Unread and unacknowledged counts are tracked per announcement.",
  },
  {
    file: "49-Portal-Document-Requests.png",
    title: "Portal Document Requests - HR View",
    module: "Employee Portal (EPM)",
    description:
      "Employee-submitted document requests received through the Employee Self-Service Portal. Consolidated into the same queue as HR-initiated requests but tagged with source: portal. HR staff can track turnaround time against the 3-working-day SLA target, generate the document PDF, and notify the employee when it is ready for download.",
  },
  {
    file: "50-Settings.png",
    title: "System Settings",
    module: "Technical / Infrastructure",
    description:
      "Application configuration panel accessible to HR Admin and Super Admin. Covers: organisation profile (agency name, logo, employer IDs), notification SMTP settings, leave auto-approval timeout thresholds, payroll run defaults, signatory chain configuration for each document type, and workflow designer access.",
  },
  {
    file: "51-Profile.png",
    title: "Administrator Profile",
    module: "Technical / Infrastructure",
    description:
      "Personal profile page for the logged-in HR Administrator. Shows role assignment, dashboard profile (HR Admin / Payroll Master / Executive / Audit), office assignment, and last login information. HR Admin can update contact details here. Role and dashboard profile changes require Super Admin action and are logged in the audit trail.",
  },
];

const ESS_FEATURES = [
  {
    file: "01-Dashboard.png",
    title: "Employee Self-Service Dashboard",
    module: "Employee Portal (EPM)",
    description:
      "The personalised home screen for every employee. Displays current leave balances (VL and SL), today's time-in status, the latest payslip net pay, upcoming leave schedules, and pending action items. Quick-action buttons provide one-tap access to the most common self-service tasks: Apply for Leave, File OT, View Payslip, and Request a Document.",
  },
  {
    file: "02-DTR.png",
    title: "My Daily Time Record",
    module: "Employee Portal (EPM)",
    description:
      "The employee's own DTR showing biometric in/out times for each day of the selected month. Displays daily tardiness minutes, undertime minutes, and OT hours. Calendar is overlaid with approved leaves, holidays, and suspended days. Employees can submit DTR correction requests directly from this view for Out-of-Office (OB) and pass-out entries.",
  },
  {
    file: "03-Clock-In-Out.png",
    title: "Clock In / Clock Out",
    module: "Employee Portal (EPM) / Time and Attendance (TAM)",
    description:
      "Web-based time clock for clocking in or out from an authorised workstation. Displays the employee's current shift schedule and expected time-in. The system timestamps the clock event, captures the IP address, and tags it as source: manual_employee_request. Available when biometric hardware is not accessible.",
  },
  {
    file: "04-File-Overtime.png",
    title: "File Overtime Request",
    module: "Employee Portal (EPM)",
    description:
      "Self-service overtime request form. The employee selects the date, specifies the OT start and end time, states the purpose, and attaches a supporting document (optional). The request routes to the direct supervisor for approval. Approved OT hours are reflected in the DTR and the next applicable payroll run.",
  },
  {
    file: "05-Apply-for-Leave.png",
    title: "Apply for Leave",
    module: "Employee Portal (EPM) / Leave Administration (LAM)",
    description:
      "Online leave application in CSC Form 6 format. The employee selects the leave type, inclusive dates (weekends and holidays are excluded from the day count automatically), half-day toggle, reason, and attaches supporting documents where required (e.g., medical certificate for sick leave beyond 5 days). Current leave balance is shown before submission to prevent over-consumption.",
  },
  {
    file: "06-My-Credits.png",
    title: "My Leave Credits",
    module: "Employee Portal (EPM) / Leave Administration (LAM)",
    description:
      "Detailed leave credit ledger for the logged-in employee. Shows the current balance for each leave type: Vacation Leave (VL), Sick Leave (SL), Forced Leave, Special Privilege Leave, and others. The monthly accrual history is visible (1.25 days VL + 1.25 days SL per month per CSC rules). Leave consumption history links back to the corresponding leave applications.",
  },
  {
    file: "07-Leave-Calendar.png",
    title: "Leave Calendar - Personal",
    module: "Employee Portal (EPM) / Leave Administration (LAM)",
    description:
      "Month-view calendar showing the employee's own approved, pending, and past leave entries. Also displays national and PCSO-declared holidays, work suspension days, and a summary of remaining leave credits for the month. Employees can initiate a cancellation request from any approved leave shown here.",
  },
  {
    file: "08-My-Payslips.png",
    title: "My Payslips",
    module: "Employee Portal (EPM) / Payroll Module (PM)",
    description:
      "Complete payslip history for the logged-in employee across all payroll types (General, Benefits and Bonuses, Salary Differential, Special, etc.). Each payslip shows gross pay, itemised mandatory deductions (BIR withholding, GSIS, PhilHealth, Pag-IBIG), loan deductions, other deductions, and net pay. Payslips are downloadable as PDF.",
  },
  {
    file: "09-IPCRF.png",
    title: "My IPCRF - Performance Form",
    module: "Employee Portal (EPM) / Performance Management (PMM)",
    description:
      "The employee's own Individual Performance Commitment and Review Form for the active and past performance cycles. Employees can view their planning commitments, monitoring entries, and final numerical and adjectival ratings. The form follows the CSC SPMS format across three phases: Planning, Monitoring, and Review.",
  },
  {
    file: "10-Announcements.png",
    title: "Announcements",
    module: "Employee Portal (EPM)",
    description:
      "Bulletin board showing all active Memorandum Orders and Circulars posted by HR. Employees can read the full text of each announcement and click Acknowledge to log their confirmation with a timestamp. Unread and unacknowledged counts are shown as badges. Older announcements are archived and searchable.",
  },
  {
    file: "11-Document-Requests.png",
    title: "My Document Requests",
    module: "Employee Portal (EPM) / Personnel Information Management (PIMM)",
    description:
      "Self-service HR certification request queue. The employee can see all their submitted document requests with current status (Received, In Process, On Hold, Ready, Released) and target release date. When a document is Ready, the employee receives an email/in-app notification and can download the signed PDF directly from this view.",
  },
  {
    file: "12-Org-Chart.png",
    title: "Organisational Chart - Employee View",
    module: "Employee Portal (EPM)",
    description:
      "Read-only view of the PCSO organisational chart. Employees can navigate the hierarchy to find colleagues, check reporting relationships, and view contact information for any unit. The chart is the same FM-driven structure used in the HR Admin view, but employees cannot edit it.",
  },
  {
    file: "13-My-Profile.png",
    title: "My Profile - Personal Data",
    module: "Employee Portal (EPM) / Personnel Information Management (PIMM)",
    description:
      "The employee's own 201 file profile showing personal information, contact details, and civil status. Employees can propose updates to their personal data via the PDS online update workflow (EPM-012). Proposed changes are sent to HRD for review and approval before they are committed to the 201 file.",
  },
  {
    file: "14-Settings.png",
    title: "Settings - General",
    module: "Employee Portal (EPM)",
    description:
      "Personal settings page for the employee's portal account. Covers display preferences (language, date format, timezone) and notification preferences. The employee can also initiate a password change or set up MFA (TOTP via authenticator app) from this settings root page.",
  },
  {
    file: "15-Profile-Employment.png",
    title: "Profile - Employment Details",
    module: "Employee Portal (EPM) / Personnel Information Management (PIMM)",
    description:
      "Employment section of the 201 file: appointment type, position title, salary grade and step, current monthly salary, assigned office and sector, date hired, date of last promotion, and item number (for organic employees). Employees view this in read-only mode; updates are processed by HR after a formal request.",
  },
  {
    file: "16-Profile-Government-IDs.png",
    title: "Profile - Government IDs",
    module: "Employee Portal (EPM) / Personnel Information Management (PIMM)",
    description:
      "Government ID section showing the employee's TIN, GSIS ID, PhilHealth number, Pag-IBIG (HDMF) MID, and SSN (for non-organic). Employees can view these IDs and flag discrepancies to HR. The IDs are used in BIR 2316, PhilHealth RF-1, and Pag-IBIG remittance generation.",
  },
  {
    file: "17-Profile-Leave-Balances.png",
    title: "Profile - Leave Balances",
    module: "Employee Portal (EPM) / Leave Administration (LAM)",
    description:
      "Detailed leave balance summary within the employee's profile: current balance per leave type, year-to-date earned, year-to-date consumed, and monetisation entitlement estimate (VL at full rate, SL at 50% capped at 15 days) as a financial planning reference. Forced leave obligation is highlighted if VL balance exceeds 10 days.",
  },
  {
    file: "18-Profile-Documents.png",
    title: "Profile - 201 File Documents",
    module: "Employee Portal (EPM) / Personnel Information Management (PIMM)",
    description:
      "Document repository within the employee's 201 file visible to the employee. Shows all uploaded documents (appointment papers, PDS, Service Record, COE history, performance forms, training certificates, etc.) with upload date and document status (Valid / Pending HRD Review / Rejected). Employees can upload additional documents via the staging queue (EPM-009).",
  },
  {
    file: "19-Settings-Security.png",
    title: "Settings - Security",
    module: "Employee Portal (EPM)",
    description:
      "Security settings panel for the employee's portal account. Allows the employee to change their password (requires current password confirmation), enable or disable MFA via TOTP authenticator app, and view active sessions. MFA is strongly recommended and mandatory for HR Admin and Super Admin roles.",
  },
  {
    file: "20-Settings-Notifications.png",
    title: "Settings - Notifications",
    module: "Employee Portal (EPM)",
    description:
      "Notification preference management. Employees can configure which events trigger in-app notifications and email notifications: leave approvals, payslip availability, document request status updates, IPCRF deadline reminders, announcement posts, and SALN/PDS filing reminders. Employees cannot disable critical compliance notifications.",
  },
  {
    file: "21-Settings-Sessions.png",
    title: "Settings - Active Sessions",
    module: "Employee Portal (EPM)",
    description:
      "List of all active login sessions for the employee's portal account, showing device type, browser, IP address, and last activity time. Employees can terminate any suspicious session remotely. New device logins trigger the N-036 notification (Entra ID SSO new device alert) to both the employee and HR Admin if the device is unrecognised.",
  },
  {
    file: "22-Settings-Display.png",
    title: "Settings - Display Preferences",
    module: "Employee Portal (EPM)",
    description:
      'Display and accessibility preferences: light/dark mode toggle, font size adjustment, and language selector (English / Filipino). The current role and data scope badge ("Employee - Own Records Only") is always visible in the top bar per the dashboard implementation notes in the PRD to prevent scope confusion.',
  },
  {
    file: "23-Document-Requests-New.png",
    title: "New Document Request - Self-Service",
    module: "Employee Portal (EPM) / Personnel Information Management (PIMM)",
    description:
      "Self-service form for requesting HR certifications and documents. The employee selects the document type (Certificate of Employment, Service Record, PDS, Custom Certificate, etc.) and states the purpose. The request is submitted to HR and tracked in the document request queue. The SLA target for release is 3 working days from receipt.",
  },
];

function addFooter(doc, pageNum, totalPages, title) {
  doc.font(FONT).fontSize(FOOTER_SIZE);
  const footerY = PAGE_HEIGHT - MARGIN + 20;
  doc.text(title, MARGIN, footerY, { width: CONTENT_WIDTH / 2, align: "left" });
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    MARGIN + CONTENT_WIDTH / 2,
    footerY,
    { width: CONTENT_WIDTH / 2, align: "right" },
  );
}

function addCoverPage(doc, accountType, featureCount) {
  const centerX = PAGE_WIDTH / 2;
  let y = MARGIN + 120;

  doc.font(FONT_BOLD).fontSize(H1_SIZE);
  doc.text("PCSO Human Resource System", MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  y += 30;

  doc.font(FONT_BOLD).fontSize(H2_SIZE);
  doc.text(`${accountType} - Feature Reference`, MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  y += 60;

  doc
    .moveTo(centerX - 40, y)
    .lineTo(centerX + 40, y)
    .lineWidth(1)
    .stroke("#000000");
  y += 40;

  const infoLines = [
    ["Document:", `Features List - ${accountType}`],
    ["Organisation:", "Philippine Charity Sweepstakes Office (PCSO)"],
    ["Prepared by:", "Th/rd Code Solutions Inc."],
    ["Version:", "v1.2 - April 2026"],
    ["Date:", "May 2026"],
    ["Classification:", "CONFIDENTIAL"],
    ["Total features:", String(featureCount)],
  ];

  for (const [label, value] of infoLines) {
    doc.font(FONT).fontSize(BODY_SIZE);
    doc.text(label, MARGIN + 80, y, { continued: true });
    doc.font(FONT_BOLD).text(` ${value}`);
    y += 18;
  }
}

function addFeaturePage(
  doc,
  feature,
  idx,
  totalFeatures,
  screenshotsDir,
  docTitle,
) {
  doc.addPage();
  let y = MARGIN;

  const num = String(idx + 1).padStart(2, "0");

  doc.font(FONT_BOLD).fontSize(H1_SIZE);
  doc.text(`${num}. ${feature.title}`, MARGIN, y);
  y += H1_SIZE + 8;

  doc.font(FONT_BOLD).fontSize(H2_SIZE);
  doc.text(`Module: ${feature.module}`, MARGIN, y);
  y += H2_SIZE + 12;

  const imgPath = path.join(screenshotsDir, feature.file);
  if (fs.existsSync(imgPath)) {
    const maxImgWidth = CONTENT_WIDTH;
    const maxImgHeight = 280;
    try {
      doc.image(imgPath, MARGIN, y, {
        fit: [maxImgWidth, maxImgHeight],
        align: "center",
      });
      y += maxImgHeight + 12;
    } catch (e) {
      doc.font(FONT).fontSize(BODY_SIZE);
      doc.text(`[Screenshot not available: ${feature.file}]`, MARGIN, y);
      y += 20;
    }
  } else {
    doc.font(FONT).fontSize(BODY_SIZE);
    doc.text(`[Screenshot not available: ${feature.file}]`, MARGIN, y);
    y += 20;
  }

  doc.font(FONT_BOLD).fontSize(H2_SIZE);
  doc.text("Description", MARGIN, y);
  y += H2_SIZE + 6;

  doc.font(FONT).fontSize(BODY_SIZE);
  const descHeight = doc.heightOfString(feature.description, {
    width: CONTENT_WIDTH,
  });
  doc.text(feature.description, MARGIN, y, { width: CONTENT_WIDTH });
  y += descHeight + 16;

  doc.font(FONT_BOLD).fontSize(H2_SIZE);
  doc.text("Comments and Notes", MARGIN, y);
  y += H2_SIZE + 8;

  const tableX = MARGIN;
  const tableWidth = CONTENT_WIDTH;
  const rowHeight = 20;
  const numRows = 5;

  doc.lineWidth(0.5).strokeColor("#000000");
  doc.rect(tableX, y, tableWidth, rowHeight * numRows).stroke();
  for (let i = 1; i < numRows; i++) {
    const lineY = y + rowHeight * i;
    doc
      .moveTo(tableX, lineY)
      .lineTo(tableX + tableWidth, lineY)
      .stroke();
  }
  y += rowHeight * numRows + 16;

  const sigLineWidth = (CONTENT_WIDTH - 40) / 2;
  const sig1X = MARGIN;
  const sig2X = MARGIN + sigLineWidth + 40;

  doc
    .moveTo(sig1X, y + 20)
    .lineTo(sig1X + sigLineWidth, y + 20)
    .stroke();
  doc
    .moveTo(sig2X, y + 20)
    .lineTo(sig2X + sigLineWidth, y + 20)
    .stroke();

  doc.font(FONT).fontSize(FOOTER_SIZE);
  doc.text("Reviewer", sig1X, y + 24, { width: sigLineWidth, align: "center" });
  doc.text("Date", sig2X, y + 24, { width: sigLineWidth, align: "center" });
}

function generatePdf(accountType, features, screenshotsDir, outputPath) {
  return new Promise((resolve, reject) => {
    const totalPages = features.length + 1;
    const docTitle = `PCSO HRS - ${accountType}`;

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: docTitle,
        Author: "Th/rd Code Solutions Inc.",
        Subject: `${accountType} Feature Reference`,
      },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    addCoverPage(doc, accountType, features.length);

    let pageNum = 1;
    addFooter(doc, pageNum, totalPages, docTitle);

    for (let i = 0; i < features.length; i++) {
      addFeaturePage(
        doc,
        features[i],
        i,
        features.length,
        screenshotsDir,
        docTitle,
      );
      pageNum++;
      addFooter(doc, pageNum, totalPages, docTitle);
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));
  });
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Building PDF: HR Administrator Account (51 features)");
  await generatePdf(
    "HR Administrator Account",
    HR_ADMIN_FEATURES,
    path.join(SCREENSHOTS_DIR, "hr-admin-qa"),
    path.join(OUTPUT_DIR, "PCSO-HRS-HR-Administrator-Features.pdf"),
  );
  console.log("  Saved: outputs/PCSO-HRS-HR-Administrator-Features.pdf");

  console.log(
    "Building PDF: Employee Self-Service (ESS) Account (23 features)",
  );
  await generatePdf(
    "Employee Self-Service (ESS) Account",
    ESS_FEATURES,
    path.join(SCREENSHOTS_DIR, "ess-qa"),
    path.join(OUTPUT_DIR, "PCSO-HRS-ESS-Features.pdf"),
  );
  console.log("  Saved: outputs/PCSO-HRS-ESS-Features.pdf");

  console.log("\nDone. Both PDF files generated in outputs/.");
})();
