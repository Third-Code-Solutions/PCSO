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

1. **Acknowledge** — Respond in the #pcso-hris-alerts Slack channel (or
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

---

## 7. Scheduled Jobs (Cron)

All jobs live under `/api/cron/*`, are scheduled in `vercel.json`, and require
`Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically).
Every run writes a `transaction_logs` row — check there first when a job is
suspected of not firing.

| Job                         | Schedule (UTC)  | Purpose                                                               |
| --------------------------- | --------------- | --------------------------------------------------------------------- |
| `monthly-accrual`           | `0 1 1 * *`     | Monthly leave credit accrual (LAM-002)                                |
| `sick-leave-auto-approve`   | `0 2 * * *`     | SL auto-approval after 5-business-day approver timeout (LAM-006)      |
| `year-end-forced-leave`     | `55 15 31 12 *` | Dec 31 23:55 PH forced-leave auto-deduction (LAM-009)                 |
| `annual-retirement-notices` | `0 1 1 1 *`     | Jan 1 retirement eligibility notices to HRD (EWB-003)                 |
| `attendance-notifications`  | `0 23 * * *`    | Daily 07:00 PH: tardiness (N-009), NFL/LWOP (N-008), habitual (N-010) |
| `biometric-pull`            | `*/30 * * * *`  | Poll active pull-mode biometric devices (TAM-004)                     |
| `security-alerts`           | `0 * * * *`     | Hourly audit-log anomaly scan (N-037 / LOG-004)                       |

### Manual trigger (backfill / verification)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/<job>
# attendance-notifications accepts ?date=YYYY-MM-DD (PH calendar date) for backfill
```

### biometric-pull

Polls every ACTIVE device with `mode = pull` and a configured pull URL that is
due per its `poll_interval_minutes`. Devices are isolated — one failing device
never blocks the rest. Outcomes land on the device row
(**Attendance > Biometric > Devices**: `last_pull_status` /
`last_pull_message`). A stuck device: verify its pull URL responds within 10 s
and the payload matches its configured format (CSV/JSON/XML); CSV import
remains the guaranteed fallback (**Attendance > Import**).

### attendance-notifications

Processes YESTERDAY (PH time): tardiness notices, No-Filed-Leave notices to
employee + payroll_admin aggregate, and habitual-tardiness flags (≥10
instances month-to-date). Idempotent — re-running for the same day sends no
duplicates (deterministic notification titles). Missing emails usually mean
`RESEND_API_KEY` is unset; in-app notifications still deliver.

### security-alerts

Hourly scan of recent `audit_logs` (rows with `alert_sent = false`) for:
failure bursts (≥5 failures per user/IP in 10 min — N-037), off-hours
super_admin/hr_admin writes on sensitive surfaces (22:00–06:00 PH), and
unusual export volume (>20/hour per actor). Alerts go to Super Admins in-app
and via email; implicated rows are marked `alert_sent = true` (the dedupe
mechanism). On an alert: review **Admin > Audit Logs** filtered to the actor
and window, then follow Section 5 (Incident Response) if it looks hostile.

---

## 8. Public API (/api/v1) & API Key Rotation

REST surface for system integrations (TOR 3.3), managed at
**Admin > API Clients** (`/admin/api-clients`, Super Admin only):

| Endpoint                                         | Purpose                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| `POST /api/v1/oauth/token`                       | OAuth 2.0 client-credentials → short-lived JWT |
| `GET /api/v1/employees[?…]`                      | Employee directory reads                       |
| `GET /api/v1/employees/{id}`                     | Single employee                                |
| `POST /api/v1/employees/batch`                   | Batch reads (API-003)                          |
| `GET /api/v1/leave-balances`                     | Leave balances                                 |
| `GET /api/v1/payroll/journal-entries`            | Accounting-system journal export (PAY-015)     |
| `GET/POST /api/v1/jobs`, `GET /api/v1/jobs/{id}` | Async job queue (API-006)                      |

Operational notes:

- Client secrets are shown **once** at creation and stored only as a SHA-256
  hash (`api_clients.secret_hash`) — there is no "reveal secret" path.
- Per-client rate limit: `rate_limit_per_minute` (default 60), editable on the
  client record. 429 responses use RFC 7807 bodies like all API errors.
- The OAuth token flow requires the `API_JWT_SECRET` env var (≥32 chars);
  when unset the token endpoint returns 503 while static API keys keep working.
- Scopes are per-client (`scopes` jsonb); grant the minimum set.

### Key rotation procedure

1. **Admin > API Clients > New Client** — same scopes/rate limit as the old
   client, name suffixed with the rotation date. Copy the secret now.
2. Deliver the new `client_id` + secret to the integrating system
   (PCSO Accounting, etc.) out-of-band; confirm it authenticates.
3. **Deactivate** (do not delete) the old client — `is_active = false` kills
   auth immediately while preserving the audit trail and `last_used_at`.
4. Watch `last_used_at` on the old client for 1 week for stragglers, then
   leave it deactivated permanently.
5. Suspected compromise: deactivate FIRST, then rotate, then review
   **Admin > Audit Logs** + `transaction_logs` for the client's activity.

---

## 9. Workflow Definitions (Admin > Workflows)

`/admin/workflows` (TOR 3.5.10) is the no-code editor for the nine HR process
chains (PRD §12): leave approval, payroll run, document request, training
approval, personnel movement, salary adjustment, recruitment pipeline, DTR
correction, shift change.

- **Seed defaults** inserts the PRD §12 chains for any process that has no
  definition yet — it never overwrites an existing definition.
- Each step defines: label, actor (role slug or free-text position title),
  kind (submit/endorse/approve/process/release/system), and optional SLA in
  business days.
- Definitions are the display + routing source for process pages. Document
  signatory chains remain in File Maintenance (FM-022) and are NOT edited
  here.
- Deactivating a definition hides it as guidance; it does not halt in-flight
  transactions.
- Every save/toggle/seed is audit-logged (module `ADMIN`,
  sub-module `workflow_definitions`).

---

## 10. Error Logs Viewer (Admin > Error Logs)

`/admin/error-logs` (TOR 3.4.4) surfaces the `error_logs` table: level,
error code, message, source, stack trace, affected resource, environment
info, and user/session context.

Triage flow:

1. Filter by level `error`/`fatal` since the incident window opened.
2. Group by `error_code` / `source` — a burst from one source is one bug,
   not N incidents.
3. Cross-reference the same window in Sentry (richer stack context) and
   `transaction_logs` (whether the failing operation partially committed).
4. For payroll/leave data-integrity errors, follow Section 5 severity rules —
   an error that interrupted a financial write is P2 minimum.
5. Error logs are append-only diagnostics; never edit rows. Retention/offload
   follows the same policy as audit logs.
