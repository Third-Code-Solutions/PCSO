# PCSO HRIS — User Roles & Feature Reference

**Roles covered:** Employee Self-Service (ESS) · HR Administrator (hr_admin)

> Navigation items marked _(hidden)_ are suppressed from the sidebar for that role via `nav-hide-config.ts` but the routes remain accessible if the user navigates directly and passes the permission check.

---

## 1. Employee Self-Service (ESS)

**Role ID:** `employee_self_service`

**Scope:** Own records only. The ESS user can view, request, and self-submit — but never read another employee's data, approve requests, or run administrative operations.

---

### 1.1 Dashboard — `/dashboard`

The landing page after login. Renders the **Employee Dashboard** variant, which shows:

- Personal leave balance snapshot (VL / SL remaining days)
- Upcoming leaves (approved, pending)
- Latest payslip summary
- Notifications and pending action items (e.g., IPCRF not yet started)

---

### 1.2 Profile — `/profile`

Own employee 201 profile. Read access to personal information, contact details, government IDs, and a document viewer for the employee's own 201 file attachments. A contact-edit dialog allows updating personal contact details (changes require HR validation before committing).

---

### 1.3 Account Settings — `/settings`

Manage own account: update password, set notification preferences, review active login sessions, and adjust display preferences (theme, language).

---

### 1.4 Attendance

#### `/attendance`

Personal DTR calendar view — current month's daily time records in a calendar grid with tardiness/undertime flags and leave annotation.

#### `/attendance/dtr`

Daily Time Record browser limited to the employee's own records, showing the last 2 months. Can view individual day entries with time-in / time-out / computed hours.

#### `/attendance/clock`

Web time clock widget for clocking in and out. Captures timestamp and records against the employee's assigned work schedule.

#### `/attendance/overtime`

View own overtime requests with status badges (pending / approved / denied). Can submit new OT requests.

#### `/attendance/overtime/new`

File a new overtime request — select date, enter justification, attach supporting document. Routes to supervisor/HR approval queue.

---

### 1.5 Leave

#### `/leave`

Personal leave dashboard showing VL and SL balances, upcoming approved leaves, and a snapshot of pending applications.

#### `/leave/applications`

Full list of own leave applications with status (pending / approved / disapproved / cancelled). Tabbed to show "Mine" only.

#### `/leave/apply`

Submit a new leave application. Selects leave type, date range, half-day toggle, reason, and optional attachment (e.g., medical certificate for sick leave).

#### `/leave/credits`

Personal leave credit ledger — current VL/SL balance, monthly accrual history, usage history, projected terminal leave value, and a download button for CSC Form 6.

#### `/leave/calendar`

Read-only team/office leave calendar showing approved leaves across the employee's unit for the current month.

---

### 1.6 Payroll

#### `/payroll/payslips`

View own payslips across all payroll types. Each payslip shows gross pay, mandatory deductions (GSIS, PhilHealth, Pag-IBIG, BIR), loan deductions, and net pay.

---

### 1.7 Performance

#### `/performance`

Personal performance dashboard showing own latest IPCRF numerical and adjectival rating, current cycle status, and links to active phase forms.

#### `/performance/ipcrf`

List of own IPCRF forms across all cycles with phase status indicators.

#### `/performance/ipcrf/[id]`

View an individual IPCRF form.

#### `/performance/ipcrf/[id]/planning`

Fill in IPCRF planning phase — set Major Final Outputs (MFOs), Key Result Areas (KRAs), and performance targets for the semester.

#### `/performance/ipcrf/[id]/monitoring`

Mid-year monitoring form — update accomplishments against targets.

#### `/performance/ipcrf/[id]/review`

Year-end review form — final rating submission for supervisor sign-off.

---

### 1.8 SALN

> Most SALN sub-routes are hidden from ESS navigation but the `/saln` index and `/saln/[id]` detail remain accessible.

#### `/saln`

Own SALN filing list — all personally filed Statements of Assets, Liabilities, and Net Worth by year.

#### `/saln/[id]`

View a specific SALN filing.

#### `/saln/[id]/edit`

Edit a previously filed SALN (before it is locked by HR).

---

### 1.9 Portal

#### `/portal/announcements`

Read HR-published announcements, memos, and circulars. Acknowledgement is recorded when the employee opens an announcement.

---

### 1.10 Learning & Development

> All L&D nav items are hidden for ESS but the following routes remain accessible.

#### `/learning/certificates`

View and download own training completion certificates. Each certificate has an embedded QR code for authenticity verification.

#### `/portal/training`

View own scheduled training runs, confirm attendance, and download completed training certificates.

---

### 1.11 Org Chart — `/org-chart`

Read-only interactive org chart of the PCSO organizational hierarchy. Supports SVG and PDF export.

---

## 2. HR Administrator (HR Admin)

**Role ID:** `hr_admin`

**Scope:** Full access to all employee records, HR transactions, leave management, documents, and reports. Does **not** have access to payroll-only operations (cash advance, loans, bank configs, RATA, special, differential, Magna Carta payroll runs), step increment processing, DPCR/BPCR, PBB lists, plantilla management, L&D module, Welfare/PRAISE module, loyalty/retirement reports, or the system admin panel.

> Note: Several modules show as hidden in navigation for `hr_admin` in the current build. These represent features that are administratively scoped to the `super_admin` or `payroll_admin` roles during this development phase.

---

### 2.1 Dashboard — `/dashboard`

Renders the **Admin Dashboard** variant, which shows:

- Workforce KPI cards: total employees, on-leave today, pending leave requests, tardiness alerts
- Recent HR activity feed
- Upcoming leave expirations and pending document requests
- Step increments due (if not hidden) and performance cycle status

---

### 2.2 Employees

#### `/employees`

Paginated employee directory with search (name, employee number), office filter, employment status filter, and CSV export. Shows all organic and non-organic personnel.

#### `/employees/new`

Create a new employee 201 record manually. Captures all personal information, government IDs, employment details, assignment, salary, and bank details.

#### `/employees/[id]`

Full employee 201 file — tabbed view covering: personal info, employment history, government IDs, educational background, eligibility, trainings, work experience, leave balance, and 201 file document list.

#### `/employees/[id]/edit`

Edit an existing employee record. Changes are logged in the audit trail.

#### `/employees/[id]/gsis`

Manage GSIS-specific data for an employee — membership number, retirement fund status, loan records with GSIS.

#### `/employees/[id]/documents`

Employee-specific document list — view all 201 file attachments uploaded for this employee.

#### `/employees/[id]/documents/requests`

Document certification request history for a specific employee — all requests filed by or for this employee.

#### `/employees/[id]/documents/upload`

Upload a scanned document to the employee's 201 file. Uploads go to a staging queue before HR commits.

#### `/employees/documents/requests`

Organization-wide document certification request queue. Lists all requests across all employees with status filters (Received / In Process / On Hold / Ready / Released / Disapproved).

#### `/employees/documents/requests/[id]`

Individual document request detail. HR can perform lifecycle actions: accept, begin processing, put on hold (with reason), mark as ready, release, or disapprove (with reason). Generates the document PDF on the "ready" action.

---

### 2.3 Attendance

#### `/attendance`

Organization-wide attendance overview — KPI cards for today's present/absent/late counts and a navigation hub to all attendance sub-modules.

#### `/attendance/admin`

Daily attendance grid for all employees — 50 per page. HR can inline-edit attendance entries for any employee-day.

#### `/attendance/admin/[employeeId]`

Per-employee attendance drill-down showing full month grid with edit capability.

#### `/attendance/dtr`

Daily Time Record browser for any employee and any month. Admins can view full history without the 2-month restriction that applies to ESS.

#### `/attendance/timesheets`

Payroll period list linking to per-employee timesheet summaries used for payroll validation.

#### `/attendance/timesheets/[periodId]`

Per-period timesheet detail — all employees' computed hours for the payroll period.

#### `/attendance/clock`

Web clock widget (HR admin can clock in/out on behalf of staff if needed for corrections).

#### `/attendance/overtime`

Pending overtime request queue. HR can approve or deny OT requests from all employees.

#### `/attendance/overtime/new`

File an overtime request on behalf of an employee.

#### `/attendance/import`

Biometric device CSV import — upload raw time-in/time-out export from biometric device, preview match statistics, and commit to attendance records.

#### `/attendance/biometric`

List of all biometric import batches with match rates and error counts.

#### `/attendance/biometric/[id]`

Import batch detail — view matched and unmatched records, manually resolve unmatched entries.

#### `/attendance/schedules`

Work schedule management — list of all defined schedules (code, name, time-in/out, grace period, applicable days, active status).

#### `/attendance/schedules/new`

Create a new work schedule. Defines time-in, time-out, break window, grace period, and applicable days of week.

#### `/attendance/schedules/[id]`

Edit an existing work schedule.

#### `/attendance/analytics`

Attendance analytics with office filter and CSV export — absence rates, tardiness/undertime totals, overtime totals, and perfect attendance list.

---

### 2.4 Leave

#### `/leave`

Leave management hub — shows pending count, approval queue snapshot, organization-wide balance summary.

#### `/leave/applications`

All leave applications across all employees with status filter tabs: "Pending Approval", "All".

#### `/leave/approvals`

Pending approvals queue — HR can batch-approve or individually approve/deny applications.

#### `/leave/approvals/[id]`

Individual leave application detail with full approval action form (approve / disapprove with reason).

#### `/leave/apply`

File a leave application on behalf of an employee.

#### `/leave/credits`

Own leave credit summary (HR admin is also an employee with credits).

#### `/leave/credits/admin`

HR leave credit control panel — run monthly accrual job, view all-employee balance summary, and inline-adjust individual balances.

#### `/leave/credits/adjust` _(hidden)_

Dedicated page to adjust leave credits for a specific employee — enter adjustment amount, type, reason, and effective date.

#### `/leave/calendar`

Organization-wide leave calendar showing all approved leaves by office for the current month.

#### `/leave/bulk-upload`

Upload existing leave ledgers in bulk via CSV. Includes a field-mapping UI, validation preview showing errors, and duplicate detection before committing.

#### `/leave/reports/advanced`

Advanced leave reports: LWOP list, sex-disaggregated leave data, leave usage by type, leave usage by office — all filterable by period and unit.

---

### 2.5 Payroll (Limited)

> HR Admin has access only to the general payroll run and benefits payroll. Payroll-only operations (loans, RATA, cash advance, differential, special, Magna Carta, bank configs) are hidden and scoped to `payroll_admin`.

#### `/payroll`

Payroll periods list with status badges.

#### `/payroll/new`

Create a new general payroll period.

#### `/payroll/[periodId]`

Period detail — employee count, gross/net totals, action bar (compute, submit for approval, finalize).

#### `/payroll/[periodId]/process`

Run payroll computation for a period. Triggers async computation of all mandatory deductions per the Section 10 formulas.

#### `/payroll/[periodId]/records/[recordId]`

Individual payroll record — view line-by-line deduction breakdown, override specific values.

#### `/payroll/[periodId]/register`

Payroll register with PDF and Excel download.

#### `/payroll/payslips`

Admin payslip view — browse payslips across all employees and all payroll types.

#### `/payroll/history`

Full historical list of all payroll periods.

#### `/payroll/jo-cos`

Job Order / COS payroll period management.

#### `/payroll/benefits`

Benefits & Bonuses payroll periods — Mid-Year Bonus, Year-End Bonus, Cash Gift, PBB.

#### `/payroll/benefits/new`

Create a new benefits payroll period.

---

### 2.6 Performance

#### `/performance`

Admin performance dashboard — cycle KPIs, rating distribution summary, list of employees with upcoming or overdue IPCRFs.

#### `/performance/cycles`

Performance cycle management — list of all semesters with their lifecycle status (open / closed).

#### `/performance/cycles/new`

Create a new performance cycle — set year, semester, and all phase deadlines (planning, monitoring, review).

#### `/performance/cycles/[id]`

Cycle detail — view all IPCRFs submitted for this cycle, close the cycle.

#### `/performance/ipcrf`

IPCRF list for all employees — filterable by cycle, office, and rating status.

#### `/performance/ipcrf/[id]`

View a specific employee's IPCRF.

#### `/performance/ipcrf/[id]/planning`

HR can view and manage the planning phase entry.

#### `/performance/ipcrf/[id]/monitoring`

View mid-year monitoring entries.

#### `/performance/ipcrf/[id]/review`

View year-end review and final rating.

#### `/performance/opcrf`

Office Performance Commitment Review Form management.

#### `/performance/analytics`

Rating distribution charts, trend analysis across cycles, per-office breakdowns, top performers list, and below-satisfactory watchlist.

---

### 2.7 SALN

> All SALN nav items are hidden for `hr_admin` in the current build, but the routes remain accessible.

#### `/saln`

SALN index (HR admin sees own personal filings).

#### `/saln/admin`

SALN Compliance Tracker — all employees' annual filing status, with bulk email reminder function and CSV export.

#### `/saln/submissions`

SALN submissions browser across all employees with office and year filters.

#### `/saln/tracking`

Compliance tracking dashboard — per-office fill rates, deadline countdown, non-filer table with individual Send Reminder action.

#### `/saln/admin/non-filers`

Dedicated non-filers list for targeted follow-up.

---

### 2.8 Recruitment

#### `/recruitment`

Recruitment pipeline overview — stage counts (MRF draft / published / application review / exam / appointed) and recent activity feed.

#### `/recruitment/mrf`

Manpower Request Form list with status filter.

#### `/recruitment/mrf/new`

Create a new MRF — select vacant position from plantilla, set required qualifications and signatory chain.

#### `/recruitment/mrf/[id]`

MRF detail with approval workflow action buttons (approve, return, publish).

#### `/recruitment/vacancies`

Active vacancy list with stage badges showing how far each vacancy has progressed through the pipeline.

#### `/recruitment/vacancies/[id]`

Vacancy detail — qualification standards, published status, application count.

#### `/recruitment/applicants`

All applicants table across all vacancies — search by name, filter by vacancy/status.

#### `/recruitment/applicants/[id]`

Applicant detail — personal info, submitted documents, qualification match score, and status update controls.

#### `/recruitment/selection`

Selection board — active vacancies ready for evaluation. Leads to rating sheet entry.

#### `/recruitment/selection/[vacancyId]`

Selection process for a specific vacancy — encode assessment ratings per dimension, view ranked results, generate top-5 list and rating sheet PDFs.

#### `/recruitment/appointments`

Appointment records list.

#### `/recruitment/appointments/new`

Create a new appointment — auto-populates from selected applicant and vacancy data.

#### `/recruitment/appointments/[id]`

Appointment detail with generated CSC appointment document, PD form, Oath of Office, and Assumption to Duty documents.

#### `/recruitment/appointments/[id]/provision`

Trigger auto-provisioning: atomically creates the employee 201 record, payroll profile, leave ledger, and attendance schedule from the appointment in a single transaction.

---

### 2.9 Documents (Document Generators)

Accessible via the employee 201 file (`/employees/[id]`) or the document request queue:

| Document                        | Serial Number Format | Purpose                                |
| ------------------------------- | -------------------- | -------------------------------------- |
| Certificate of Employment (COE) | `COE-YYYY-NNNNNN`    | Certifies employment status            |
| COE with Remunerations          | `COER-YYYY-NNNNNN`   | COE plus current salary and deductions |
| Service Record                  | `SR-YYYY-NNNNNN`     | Full chronological employment history  |
| Personal Data Sheet (PDS)       | —                    | CS Form 212, all 4 pages               |
| NOSI                            | `NOSI-YYYY-NNNNNN`   | Notice of Salary Step Increment        |
| NOSA                            | `NOSA-YYYY-NNNNNN`   | Notice of Salary Adjustment            |

All generated PDFs embed a QR code containing a signed JWT for document authenticity verification at `/verify/[token]`.

---

### 2.10 Portal

#### `/portal/announcements`

HR publishes announcements, memorandum orders, and circulars. Employees read and acknowledge. HR sees read/acknowledged counts.

---

### 2.11 Audit Logs — `/admin/audit-logs`

Paginated audit log table showing all system actions — who did what, when, from which IP, and with what outcome. Filterable by user, module, action type, and date range. CSV export available.

---

### 2.12 Org Chart — `/org-chart`

Read-only interactive org chart. HR Admin can view and export but cannot restructure the org hierarchy (super_admin only).

---

## 3. Quick Comparison Matrix

| Feature Area                        |                 ESS                 |          HR Admin          |
| ----------------------------------- | :---------------------------------: | :------------------------: |
| **Own profile / 201 file**          |        View + request edits         |         Full CRUD          |
| **All employee 201 files**          |                  ✗                  |         Full CRUD          |
| **Document certification requests** |             Submit only             | Full lifecycle management  |
| **Payslips**                        |              Own only               |       All employees        |
| **Leave: apply**                    |              Own only               |        Any employee        |
| **Leave: approve**                  |                  ✗                  |       All employees        |
| **Leave credits admin**             |                  ✗                  | Full (run accrual, adjust) |
| **Attendance: view**                |            Own DTR only             | All employees, all periods |
| **Attendance: edit**                |         Request correction          |        Inline edit         |
| **Biometric import**                |                  ✗                  |            Full            |
| **Payroll runs**                    |                  ✗                  |  General + Benefits only   |
| **Remittances**                     |                  ✗                  |   ✗ (payroll_admin only)   |
| **Performance: IPCRF**              |              Own only               |       All employees        |
| **Performance: analytics**          |                  ✗                  |            Full            |
| **SALN: file**                      |              Own only               | Own + compliance tracking  |
| **Recruitment**                     |                  ✗                  |       Full pipeline        |
| **Learning & Development**          | Certificates + training portal only |   Full (hidden from nav)   |
| **Welfare / PRAISE**                |                  ✗                  |    ✗ (hidden from nav)     |
| **Org chart**                       |                View                 |            View            |
| **Audit logs**                      |                  ✗                  |            View            |
| **System admin**                    |                  ✗                  |    ✗ (super_admin only)    |

---

_Generated from codebase analysis of `src/app`, `src/lib/auth/permissions.ts`, `src/middleware.ts`, and `src/components/layouts/nav-hide-config.ts`._
