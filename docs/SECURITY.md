# PCSO HRIS — Security & Compliance Reference

This document covers Row-Level Security policies, PII handling, RA 10173
(Data Privacy Act) compliance, access control, backups, and incident response.

---

## 1. Row-Level Security (RLS) Policy Summary

RLS is enabled on every table in the PCSO HRIS database. All policies are
defined in `supabase/rls-policies.sql`.

### employees

| Operation | Who Can Perform                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| SELECT    | `hr_admin`, `payroll_admin`, `super_admin`, `leave_approver` (own department), `employee_self_service` (own record only) |
| INSERT    | `hr_admin`, `super_admin`                                                                                                |
| UPDATE    | `hr_admin`, `super_admin`                                                                                                |
| DELETE    | Blocked for all roles — soft-delete (`deletedAt`) is used                                                                |

### payroll_records

| Operation | Who Can Perform                                                            |
| --------- | -------------------------------------------------------------------------- |
| SELECT    | `payroll_admin`, `super_admin`, `employee_self_service` (own records only) |
| INSERT    | `payroll_admin`, `super_admin` (only in DRAFT period status)               |
| UPDATE    | `payroll_admin`, `super_admin` (only in DRAFT period status)               |
| DELETE    | Blocked — historical payroll is immutable                                  |

### leave_requests

| Operation | Who Can Perform                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------- |
| SELECT    | `hr_admin`, `leave_approver` (own department), `super_admin`, `employee_self_service` (own records only) |
| INSERT    | `employee_self_service`, `hr_admin`, `super_admin`                                                       |
| UPDATE    | `leave_approver`, `hr_admin`, `super_admin` (status changes only)                                        |
| DELETE    | Blocked                                                                                                  |

### leave_balances

| Operation       | Who Can Perform                                                                |
| --------------- | ------------------------------------------------------------------------------ |
| SELECT          | `hr_admin`, `payroll_admin`, `super_admin`, `employee_self_service` (own only) |
| INSERT / UPDATE | `hr_admin`, `payroll_admin`, `super_admin` (system-managed)                    |
| DELETE          | Blocked                                                                        |

### saln_records

| Operation | Who Can Perform                                                       |
| --------- | --------------------------------------------------------------------- |
| SELECT    | `hr_admin`, `super_admin`, `employee_self_service` (own records only) |
| INSERT    | `employee_self_service`, `hr_admin`, `super_admin`                    |
| UPDATE    | `employee_self_service` (DRAFT only), `hr_admin`, `super_admin`       |
| DELETE    | Blocked                                                               |

### audit_logs

| Operation       | Who Can Perform                                           |
| --------------- | --------------------------------------------------------- |
| SELECT          | `super_admin` only                                        |
| INSERT          | Service role only (via server-side `auditLog()` function) |
| UPDATE / DELETE | Blocked for all roles                                     |

### salary_grades

| Operation                | Who Can Perform         |
| ------------------------ | ----------------------- |
| SELECT                   | All authenticated users |
| INSERT / UPDATE / DELETE | `super_admin` only      |

### government_rates (GSIS, PhilHealth, Pag-IBIG, BIR)

| Operation                | Who Can Perform         |
| ------------------------ | ----------------------- |
| SELECT                   | All authenticated users |
| INSERT / UPDATE / DELETE | `super_admin` only      |

---

## 2. PII Fields

The following fields are considered Personally Identifiable Information (PII)
under RA 10173 and must be handled with elevated care:

### employees table

| Field                 | Sensitivity | Notes                                    |
| --------------------- | ----------- | ---------------------------------------- |
| `tin`                 | High        | BIR Tax Identification Number            |
| `gsis_number`         | High        | GSIS membership number                   |
| `philhealth_number`   | High        | PhilHealth MDR number                    |
| `pagibig_number`      | High        | HDMF member ID                           |
| `date_of_birth`       | Medium      | Combined with name = highly identifiable |
| `address`             | Medium      | Home address                             |
| `email`               | Medium      |                                          |
| `phone`               | Medium      |                                          |
| `bank_account_number` | High        | ATM/bank account for payroll crediting   |

### saln_records table

| Field                        | Sensitivity | Notes                          |
| ---------------------------- | ----------- | ------------------------------ |
| All financial declarations   | High        | Net worth, assets, liabilities |
| Spouse/dependent information | High        |                                |
| Business interests           | High        |                                |

### At-Rest Encryption (Future Work)

Supabase Vault (`pgsodium`) encryption of high-sensitivity columns
(`tin`, `gsis_number`, `philhealth_number`, `pagibig_number`, `bank_account_number`)
is planned for Phase 17.

Current mitigation:

- TLS in transit (enforced by Supabase)
- RLS restricts access at the database level
- `SUPABASE_SERVICE_ROLE_KEY` is never exposed client-side
- Sentry `beforeSend` strips PII from error payloads

---

## 3. RA 10173 (Data Privacy Act of the Philippines) Compliance Matrix

RA 10173 was signed into law on August 15, 2012. The National Privacy
Commission (NPC) issues implementing rules and circulars.

| Requirement                             | Status              | Implementation                                                                                         |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| Lawful basis for processing             | Compliant           | Employment relationship (Section 12(b)); statutory obligation (Section 13(e)) for government functions |
| Data subject consent for voluntary data | Partially compliant | Consent tracking module planned (Phase 17)                                                             |
| Purpose limitation                      | Compliant           | PII collected only for HR/payroll functions                                                            |
| Data minimization                       | Compliant           | Only fields required by CSC/DBM/BIR forms are collected                                                |
| Accuracy                                | Compliant           | `updatedAt` timestamps; audit log tracks all modifications                                             |
| Storage limitation                      | Planned             | Retention policy defined below; automated purge not yet implemented                                    |
| Integrity and confidentiality           | Compliant           | RLS, TLS, server-side key management                                                                   |
| Data subject access right               | Planned             | Employee self-service portal (Phase 16); full export endpoint planned                                  |
| Right to rectification                  | Compliant           | Employee records are editable by HR admin; audit log preserved                                         |
| Right to erasure                        | Partial             | Soft-delete implemented; full anonymization planned for separated employees after retention period     |
| Breach notification (72-hour rule)      | Compliant           | Incident response procedure below; Sentry alerts trigger immediate review                              |
| Privacy Impact Assessment (PIA)         | Planned             | PIA document to be filed with NPC before go-live                                                       |
| Data Protection Officer (DPO)           | Required            | PCSO IT Security Officer to be designated as DPO                                                       |

### Breach Notification Procedure

1. Detect breach via Sentry alert, Supabase audit log, or user report
2. DPO and system administrator assess scope within 4 hours
3. If personal data of 1,000+ individuals or sensitive personal information
   is involved, notify NPC within 72 hours using NPC Form 01
4. Notify affected data subjects promptly via official PCSO email
5. Document all breach details in the incident log (see `docs/RUNBOOK.md`)

---

## 4. Backup and Retention Policy

### Database Backups

| Environment | Backup Frequency                | Retention                                    |
| ----------- | ------------------------------- | -------------------------------------------- |
| Production  | Daily automated (Supabase PITR) | 30 days (PITR) + weekly snapshots for 1 year |
| Staging     | Daily automated                 | 7 days                                       |

Supabase Point-in-Time Recovery (PITR) is required on the production project.
Enable it in **Project Settings > Database > Backups**.

### Data Retention Schedule

| Data Type              | Retention Period                        | Basis                                                |
| ---------------------- | --------------------------------------- | ---------------------------------------------------- |
| Payroll records        | 10 years                                | COA audit requirements; Presidential Decree No. 1445 |
| Leave records          | 5 years                                 | CSC Omnibus Rules                                    |
| SALN records           | 10 years                                | RA 6713; CSC guidelines                              |
| Audit logs             | 7 years                                 | Government accounting and auditing rules             |
| Separated employee PII | 5 years post-separation, then anonymize | RA 10173 storage limitation                          |

---

## 5. Access Control Hierarchy

```
super_admin
  └── Full system access including admin panel, all RLS bypass via service role
      (Note: RLS still applies; service role is only used server-side)

hr_admin
  └── Employee management (CRUD), leave management, SALN oversight
  └── Cannot process payroll

payroll_admin
  └── Payroll period management, deduction computation, payslip generation
  └── Cannot edit employee master data

leave_approver
  └── Approve/deny leave requests within their assigned department
  └── Read-only access to employees in their department

viewer
  └── Read-only access to reports and dashboards
  └── No access to PII fields

employee_self_service
  └── Own records only: payslips, leave balances, leave requests, SALN filing
  └── Cannot view other employees' data
```

---

## 6. Security Headers

The following HTTP security headers are configured in `next.config.mjs`:

| Header                      | Value                                          |
| --------------------------- | ---------------------------------------------- |
| `X-Frame-Options`           | `DENY`                                         |
| `X-Content-Type-Options`    | `nosniff`                                      |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy`   | Nonce-based; configured per deployment         |

---

## 7. Dependency Security

- `@sentry/nextjs` monitors for runtime errors
- `npm audit` is run on every CI pipeline execution
- Dependabot is configured (`.github/dependabot.yml`) for weekly dependency updates
- Critical security patches (CVSS >= 7.0) must be applied within 48 hours
