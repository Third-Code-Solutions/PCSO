# PCSO HRIS — Operations Runbook

This runbook covers common operational tasks for HR administrators, payroll
administrators, and system operators. Reference this document during routine
operations and incident response.

---

## 1. Running Payroll for a Period

### Prerequisites

- Current period is in **DRAFT** status
- All employees to be included are **ACTIVE** with no missing salary grade assignment
- Government rates (GSIS, PhilHealth, Pag-IBIG, BIR) are up to date (see Section 2)
- Attendance records / leave deductions for the period are finalized

### Step-by-Step

1. Navigate to **Payroll > Payroll Periods**
2. Confirm the period you intend to process is in **DRAFT** status with the
   correct date range (1st–15th or 16th–end of month)
3. Click **Process Period** → confirm in the dialog
4. The system will:
   - Fetch all active employees assigned to the period
   - Compute gross pay per salary grade step
   - Apply mandatory deductions (GSIS, PhilHealth, Pag-IBIG, BIR withholding)
   - Apply loan amortizations (if any)
   - Compute net pay
   - Write all records to `payroll_records` (audit log entry created)
5. Review the **Payroll Summary** table — verify:
   - Total headcount matches expected active employee count
   - Total gross pay is within expected range (compare to previous period)
   - Total GSIS deductions match the GSIS report
6. If discrepancies exist:
   - Return period to DRAFT (only possible before approval)
   - Correct the underlying data (salary grade, leave deductions, etc.)
   - Re-process
7. Click **Submit for Approval** → the period moves to **PENDING APPROVAL** status
8. The designated approver (payroll admin's superior or super_admin) reviews
   and clicks **Approve**
9. Status changes to **APPROVED** — records are now immutable
10. Click **Generate Payslips** to produce individual PDF payslips
11. Click **Send Payslips** to email payslips to employees via Resend
12. Download the **Payroll Register** (Excel/PDF) for COA audit file

### Common Errors

| Error                                   | Likely Cause                                | Resolution                                                               |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| "Employee has no salary grade"          | Employee record missing SG assignment       | Edit employee → assign SG + step                                         |
| "Government rates not found for period" | Rates table not seeded for this year        | Run `npm run db:seed` or manually add rates via Admin > Government Rates |
| "Period already approved"               | Attempting to re-process an approved period | Do not re-process; create an adjustment record instead                   |

---

## 2. Updating Government Rates

Government contribution tables change periodically via circulars from GSIS,
PhilHealth, HDMF, and the BIR. Update rates before the first payroll run of
the effective year.

### Pre-Update Checklist

- [ ] Download the official circular from the issuing agency website
- [ ] Note the **effective date** — rates apply from that date forward
- [ ] Confirm with the Finance/Accounting office that the circular applies
      to PCSO personnel

### Updating Rates via Admin Panel

1. Navigate to **Admin > Government Rates**
2. Select the rate type: GSIS | PhilHealth | Pag-IBIG | BIR Tax Table
3. Click **Add New Rate Table** with the effective date
4. Enter the new contribution brackets per the circular
5. Save — the system uses the rate table whose `effectiveDate` is closest to
   (but not after) the payroll period start date
6. Run a test payroll computation in **Staging** before applying to production

### Circular References

| Agency          | Rate Type                                       | Where to Find                    |
| --------------- | ----------------------------------------------- | -------------------------------- |
| GSIS            | Contribution rate (employee + government share) | gsis.gov.ph > Circulars          |
| PhilHealth      | Premium contribution table                      | philhealth.gov.ph > Circulars    |
| HDMF (Pag-IBIG) | Monthly contribution table                      | pagibig-fund.gov.ph > Circulars  |
| BIR             | Withholding tax table                           | bir.gov.ph > Revenue Regulations |

### Post-Update Checklist

- [ ] Rate table created with correct effective date
- [ ] Test computation run in Staging with known employee salary and verified manually
- [ ] New rates match the official circular values (spot-check 3+ salary grades)
- [ ] Staging payroll summary reviewed by Payroll Admin before production update

---

## 3. Processing Step Increments

Step increments are granted per CSC rules after satisfactory performance
ratings at prescribed intervals (typically every 3 years for SG 1–10,
every 2 years for SG 11+).

### Step Increment Process

1. Navigate to **Employees > Step Increment Reports**
2. Review the list of employees eligible for increment in the current quarter
   (system auto-flags based on date of last increment + CSC eligibility rules)
3. Verify each employee's **Performance Rating** for the qualifying period —
   must be at least Satisfactory (S)
4. For eligible employees, click **Process Increment**:
   - System moves employee from current step to next step within same SG
   - Creates an audit log entry with old and new step
   - New step takes effect on the increment anniversary date
5. Download the **Step Increment Report** for submission to DBM
6. Update Plantilla positions if the increment affects budgeted salary

### Important Notes

- Step increments do NOT change the Salary Grade — only the step within the grade
- Maximum step is Step 8 for most grades — do not attempt to increment beyond Step 8
- Salary differential (new step minus old step) affects all future payroll periods
  from the effective date

---

## 4. SALN Filing Season (Annual Reminder Cadence)

Statement of Assets, Liabilities and Net Worth (SALN) filing is required for
all government officials and employees under RA 6713.

### Annual Timeline

| Date        | Action                                                       |
| ----------- | ------------------------------------------------------------ |
| January 2   | System sends **SALN filing reminder** email to all employees |
| January 15  | First reminder for employees who have not yet filed          |
| January 25  | Final reminder — 5 days before deadline                      |
| January 30  | Statutory deadline for SALN submission                       |
| February 1  | HR Admin runs **SALN Compliance Report** — flags non-filers  |
| February 10 | Non-filers referred to Legal/HR for appropriate action       |

### Running the SALN Reminder Emails

1. Navigate to **Admin > Notifications > SALN Reminders**
2. Click **Send Annual Reminder** (available from January 2 each year)
3. Select recipient group: All Employees | Specific Department | Non-filers only
4. Review the email preview and click **Send**
5. System logs send event to audit trail

### SALN Compliance Report

1. Navigate to **Reports > SALN > Compliance Report**
2. Select the reference year
3. Export to Excel or PDF for filing with the Office of the Secretary-General

### Confidentiality

SALN records are confidential per RA 6713 Section 8. Access is restricted to
`hr_admin` and `super_admin` roles. Employees can only view their own filings.

---

## 5. Incident Response Quick Reference

### Severity Levels

| Level         | Description                                           | Response Time              |
| ------------- | ----------------------------------------------------- | -------------------------- |
| P1 — Critical | System down, data breach, payroll cannot be processed | Immediate (< 30 min)       |
| P2 — High     | Major feature broken, payroll delayed                 | < 2 hours                  |
| P3 — Medium   | Feature degraded, workaround exists                   | < 8 hours (business hours) |
| P4 — Low      | Minor bug, cosmetic issue                             | Next sprint                |

### P1 / P2 Response Steps

1. **Acknowledge** — Respond in the #senate-hris-alerts Slack channel (or
   designated communication channel) immediately
2. **Assess** — Identify scope: how many users affected? Is data integrity at
   risk?
3. **Contain** — If data breach: rotate `SUPABASE_SERVICE_ROLE_KEY` immediately;
   invalidate all active sessions via Supabase Auth dashboard
4. **Diagnose** — Check Sentry for the triggering error; check Supabase logs
   for unusual query patterns
5. **Fix or Roll Back** — Either deploy a hotfix from a `hotfix/` branch or
   roll back the Vercel deployment to the last known-good version
6. **Verify** — Confirm resolution in staging before closing the incident
7. **Document** — Create a post-incident review within 48 hours using the
   template below

### Post-Incident Review Template

```
Date:
Severity:
Duration of Impact:
Systems Affected:

Timeline:
  - HH:MM  Incident first detected
  - HH:MM  Alert triggered / on-call notified
  - HH:MM  Root cause identified
  - HH:MM  Fix deployed / rollback executed
  - HH:MM  Incident resolved

Root Cause:

Impact:
  - Users affected:
  - Data integrity:
  - Compliance impact:

Resolution:

Follow-up Actions (with owners and due dates):
  1.
  2.
```

### Key Contacts

| Role                              | Responsibility                                |
| --------------------------------- | --------------------------------------------- |
| System Administrator              | Deployment, infrastructure, Supabase, Vercel  |
| DPO (Data Protection Officer)     | RA 10173 breach notifications to NPC          |
| Payroll Admin Lead                | Payroll continuity decisions                  |
| HR Admin Lead                     | Employee data decisions                       |
| NPC (National Privacy Commission) | Report breaches: gov.ph/npc or (02) 8234-2228 |

---

## 6. Common Maintenance Tasks

### Clearing Stale Database Connections

If Supabase connection pool is exhausted:

```sql
-- Run in Supabase SQL Editor
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes'
  AND datname = 'postgres';
```

### Checking Audit Log for Suspicious Activity

```sql
-- Last 100 DELETE and sensitive UPDATE operations
SELECT
  al.created_at,
  al.action,
  al.table_name,
  al.record_id,
  u.email AS performed_by
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.action IN ('delete', 'update')
  AND al.table_name IN ('employees', 'payroll_records', 'saln_records')
ORDER BY al.created_at DESC
LIMIT 100;
```

### Force Re-send Failed Payslip Emails

If a batch email send fails:

1. Navigate to **Payroll > [Period] > Payslips**
2. Filter by **Email Status: Failed**
3. Select all failed records
4. Click **Resend Selected**
5. Monitor Resend dashboard for delivery confirmation
