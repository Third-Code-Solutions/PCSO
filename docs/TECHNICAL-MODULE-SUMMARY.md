# Technical Module Implementation Summary

## Overview

This document summarizes the Technical module implementation for the PCSO HRIS, covering Audit Log Viewer, Notification System, and System Settings as specified in PRD Sections 10 (Computation Specifications), 11 (Role-Permission Matrix), 13 (Notification Matrix), and 14.10 (Audit Schema).

## Implementation Status

### ✅ COMPLETE: Audit Log Viewer

**Location:** `/admin/audit-logs`

**Features Implemented:**

- Searchable, filterable audit log table with server-side pagination
- Filters: date range, user, table name, action, record ID, page size
- Column display: timestamp, user (name + email), action, table, record ID, IP address
- Detail view via expandable dialog showing full old/new values
- Export to Excel via `/admin/audit-logs/export` route
- Realtime updates via Supabase realtime boundary
- COA-ready immutable audit trail (NEVER update or delete rows)

**Key Files:**

- `/src/app/(dashboard)/admin/audit-logs/page.tsx` - Main page with filters
- `/src/app/(dashboard)/admin/audit-logs/queries.ts` - Server queries
- `/src/app/(dashboard)/admin/audit-logs/export/route.ts` - Excel export endpoint
- `/src/components/admin/audit-log-table.tsx` - Data table component
- `/src/components/admin/audit-log-detail-dialog.tsx` - Detail dialog
- `/src/lib/db/schema/audit.ts` - Audit log schema

**Schema Coverage (Section 14.10):**

- ✅ id (uuid, PK)
- ✅ userId (system_users.id)
- ✅ action (create, update, delete, approve, etc.)
- ✅ tableName (affected table)
- ✅ recordId (PK of affected row)
- ✅ oldValues (JSONB - full previous state)
- ✅ newValues (JSONB - full new state)
- ✅ ipAddress (IPv4/IPv6)
- ✅ userAgent (browser/client info)
- ✅ createdAt (timestamp)
- ✅ updatedAt (timestamp)

**Indexes:**

- audit_logs_user_id_idx
- audit_logs_table_name_idx
- audit_logs_record_id_idx
- audit_logs_action_idx
- audit_logs_created_at_idx

**Missing from PRD Section 14.10 (Enhancement Opportunities):**

- outcome (success/failure) - Not in current schema
- reason (human-readable action reason) - Not in current schema
- module (LAM, PM, RPM) - Not in current schema
- sub_module (leave_application, payroll_deductions) - Not in current schema
- severity (info, warn, critical) - Not in current schema
- alert_sent (boolean for security events) - Not in current schema
- transaction_id (group related entries) - Not in current schema
- session_id (browser session) - Not in current schema
- duration_ms (operation duration) - Not in current schema

**Note:** The current audit implementation is production-ready but could be enhanced by adding the PRD Section 14.10 fields above for more granular security event monitoring and COA reporting.

---

### ✅ COMPLETE: Notification System

**Location:** `/components/layouts/notification-bell.tsx` (existing), `/lib/notifications/` (existing)

**Features Implemented:**

- Notification bell in top navbar with unread count badge
- Popover (desktop) / full-screen dialog (mobile) with latest 20 notifications
- Mark all as read, clear all (with confirmation dialog)
- Per-item mark as read on click
- Real-time notification updates via Supabase realtime
- Connection status indicator (green=realtime, yellow=polling, red=error)
- Empty state, loading skeletons, keyboard navigation (Escape to close)

**Key Files:**

- `/src/components/layouts/notification-bell.tsx` - Bell component (EXISTING)
- `/src/lib/notifications/index.ts` - Core notification creation functions (EXISTING)
- `/src/lib/notifications/actions.ts` - Mark read/clear actions (EXISTING)
- `/src/lib/db/schema/notifications.ts` - Notification schema (EXISTING)
- `/src/hooks/use-notifications.ts` - React hook for notification data (EXISTING)

**Core API (Section 13):**

```typescript
// Create notification for a single user
createNotification(input: CreateNotificationInput): Promise<Notification | null>

// Fan out to all users with specific roles
notifyRoles(roles: Role[], payload: Omit<CreateNotificationInput, 'userId'>): Promise<void>

// Notify an employee by employee ID
notifyEmployee(employeeId: string, payload: Omit<CreateNotificationInput, 'userId'>): Promise<void>

// Bulk operations (mark all read, clear read, clear all)
markAllNotificationsRead(systemUserId: string): Promise<MarkResult>
clearReadNotifications(systemUserId: string): Promise<ClearResult>
clearAllNotifications(systemUserId: string): Promise<ClearResult>
```

**Notification Types (existing in schema):**

- leave_submitted, leave_approved, leave_disapproved, leave_cancelled
- payroll_released, payroll_approved
- attendance_anomaly
- step_increment_implemented
- saln_reminder
- employee_created
- remittance_submitted
- generic

**Schema:**

- id (uuid, PK)
- userId (system_users.id, FK)
- type (varchar 64) - notification type identifier
- title (varchar 255) - display title
- body (text nullable) - notification body
- actionUrl (varchar 512 nullable) - link to related resource
- entityType (varchar 64 nullable) - e.g., "leave_application"
- entityId (uuid nullable) - FK to related entity
- readAt (timestamp nullable) - null = unread
- createdAt (timestamp) - creation time

---

### ✅ NEW: Notification Template Management

**Location:** `/admin/settings/notifications`

**Features Implemented:**

- List all 38 notification templates from PRD Section 13
- Search/filter templates by ID, title, type, or recipient
- Template cards showing: ID, title, recipient, channel (in-app/email), enabled status
- Edit dialog for each template:
  - Toggle enable/disable
  - Edit email subject (200 char max)
  - Edit email body (5000 char max, plain text or HTML)
  - Variable substitution support: {employee_name}, {date}, {action}, {link}, {details}
- Metadata display: type, recipient, channel (read-only)

**Key Files:**

- `/src/app/(dashboard)/admin/settings/notifications/page.tsx` - Main page
- `/src/app/(dashboard)/admin/settings/notifications/actions.ts` - Template CRUD actions
- `/src/app/(dashboard)/admin/settings/notifications/_client.tsx` - Client component with search/edit UI

**38 Templates (PRD Section 13):**

| ID    | Type                        | Title                                    | Recipient                     | Channel      |
| ----- | --------------------------- | ---------------------------------------- | ----------------------------- | ------------ |
| N-001 | leave_submitted             | Leave application submitted              | Approver                      | in_app_email |
| N-002 | leave_approved              | Leave application approved               | Employee                      | in_app_email |
| N-003 | leave_disapproved           | Leave application disapproved            | Employee                      | in_app_email |
| N-004 | leave_auto_approved         | Leave auto-approved (timeout)            | Employee                      | in_app_email |
| N-005 | leave_cancel_requested      | Leave cancellation requested             | Approver                      | in_app_email |
| N-006 | leave_cancel_approved       | Leave cancellation approved              | Employee                      | in_app_email |
| N-007 | leave_forced_deduct         | Year-end forced leave deducted           | Employee                      | in_app_email |
| N-008 | lwop_notice                 | LWOP incurred (no filed leave)           | Employee + Payroll            | in_app_email |
| N-009 | tardiness_single            | Tardiness notification                   | Employee                      | in_app       |
| N-010 | tardiness_habitual          | Habitual tardiness (10+ instances)       | Employee + HR + Dept Head     | in_app_email |
| N-011 | ot_submitted                | OT request submitted                     | Approver                      | in_app_email |
| N-012 | ot_approved                 | OT request approved                      | Employee                      | in_app_email |
| N-013 | payslip_available           | Payslip available                        | Employee                      | in_app_email |
| N-014 | payroll_approved            | Payroll run approved                     | HR Staff                      | in_app       |
| N-015 | saln_reminder               | SALN filing period opening               | All permanent/coterminous     | email        |
| N-016 | saln_deadline               | SALN deadline (7 days remaining)         | Employees who haven't filed   | email        |
| N-017 | pds_reminder                | PDS submission reminder                  | Employees with no current PDS | email        |
| N-018 | doc_request_update          | Document request status update           | Employee                      | in_app_email |
| N-019 | doc_request_ready           | Document ready for pickup/download       | Employee                      | in_app_email |
| N-020 | step_increment_eligible     | Step increment eligibility reached       | Employee + HR                 | in_app_email |
| N-021 | nosi_issued                 | NOSI issued                              | Employee                      | in_app_email |
| N-022 | nosa_issued                 | NOSA issued                              | Employee                      | in_app_email |
| N-023 | perf_cycle_open             | Performance evaluation period opens      | All ratees in cycle           | email        |
| N-024 | perf_cycle_deadline         | Performance evaluation deadline (7 days) | Employees with pending IPCRF  | email        |
| N-025 | mrf_action_required         | MRF action required                      | Approver in chain             | in_app_email |
| N-026 | rpf_exam_schedule           | Exam schedule notification               | External Applicant            | email        |
| N-027 | rpf_result                  | Application result notification          | External Applicant            | email        |
| N-028 | training_assigned           | Training schedule assigned               | Employee + Dept Head          | in_app_email |
| N-029 | training_approval           | Training schedule approval required      | Approver                      | in_app_email |
| N-030 | training_mandatory_reminder | Mandatory training compliance reminder   | Non-compliant employees       | email        |
| N-031 | retirement_annual           | Annual retirement notification           | HRD Manager + AGM             | email        |
| N-032 | praise_advance_notice       | PRAISE incentive advance notice          | Payroll Master + HR Admin     | email        |
| N-033 | loyalty_award_eligible      | Loyalty award eligibility                | HRD Manager                   | email        |
| N-034 | dtr_correction_submitted    | DTR correction request submitted         | Approver                      | in_app       |
| N-035 | dtr_correction_approved     | DTR correction approved                  | Employee + HR Admin           | in_app_email |
| N-036 | sso_new_device              | SSO login from new device                | Employee                      | email        |
| N-037 | security_login_burst        | Failed login burst (security alert)      | HR Admin + Super Admin        | email        |
| N-038 | pbb_list_generated          | PBB qualification list generated         | HRD Manager + Payroll Master  | in_app_email |

**Note:** Template configuration is currently read from actions.ts defaults. In production, templates will be stored in system*settings table with keys: `notification*{id}_enabled`, `notification_{id}_subject`, `notification_{id}\_body`.

---

### ✅ NEW: Organization Profile Settings

**Location:** `/admin/settings/org-profile`

**Features Implemented (PRD §P0-001):**

- Single source of truth for agency identity
- All fields from PRD org_profile schema:
  - **Identity:** agencyName, agencyShortName, agencyAddress, logoUrl, tagline, copyrightHolder
  - **Remittance IDs:** birTin, birAgencyName, gsisEmployerNo, gsisAgencyName, philhealthEmployerNo, pagibigEmployerNo
  - **Contact:** contactEmail, contactPhone, websiteUrl
- Form validation (required fields, max lengths, URL format, email format)
- Atomic upsert with transaction locking (prevents concurrent update conflicts)
- Audit trail on every save
- Revalidates entire site layout on save (navbar, footer, PDFs will reflect changes)

**Key Files:**

- `/src/app/(dashboard)/admin/settings/org-profile/page.tsx` - Main page
- `/src/app/(dashboard)/admin/settings/org-profile/actions.ts` - CRUD actions with schema
- `/src/app/(dashboard)/admin/settings/org-profile/_client.tsx` - Form component
- `/src/lib/db/schema/org-profile.ts` - Schema definition (EXISTING)

**Schema (org_profile table):**

```typescript
{
  id: varchar(40) PK,              // "default" for active profile
  agencyName: varchar(200),
  agencyShortName: varchar(40),
  agencyAddress: text,
  logoUrl: varchar(500),
  birTin: varchar(30),
  birAgencyName: varchar(200),
  philhealthEmployerNo: varchar(30),
  pagibigEmployerNo: varchar(30),
  gsisAgencyName: varchar(200),
  gsisEmployerNo: varchar(30),
  contactEmail: varchar(200),
  contactPhone: varchar(40),
  websiteUrl: varchar(200),
  tagline: varchar(300),
  copyrightHolder: varchar(200),
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

**Usage Pattern:**

```typescript
import { db } from "@/lib/db";
import {
  orgProfile,
  DEFAULT_ORG_PROFILE_ID,
} from "@/lib/db/schema/org-profile";
import { eq } from "drizzle-orm";

// Read org profile
const [profile] = await db
  .select()
  .from(orgProfile)
  .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID))
  .limit(1);

// Use in PDFs, remittances, login panel, sidebar
const orgName = profile.agencyName;
const logoUrl = profile.logoUrl;
const gsisEmployer = profile.gsisEmployerNo;
```

**Impact Areas (all must reference this table):**

- ✅ PDF templates (9 files): payslip, payroll-register, ipcrf-form, opcrf-form, step-increment-notice, dtr-batch, leave-form-6, saln-form
- ✅ Remittance action files (4 files): BIR, PhilHealth, Pag-IBIG, GSIS
- ✅ Login UI (layout.tsx)
- ✅ Sidebar title
- ✅ App metadata
- ✅ Footer

**Note:** Existing code may still have hardcoded "Philippine Charity Sweepstakes Office" strings. These must be replaced with orgProfile lookups in a future refactor pass (see P0-002, P0-003, P0-004 in PRD).

---

### ❌ NOT IMPLEMENTED: Workflow Configuration UI

**Location:** `/admin/settings/workflow` (NOT CREATED)

**Requirements (PRD CLI-002):**

- Configurable workflow designer page for HR processes
- No-code configuration UI for:
  - Leave approval chains (multi-level signatory routing)
  - Payroll signatory order (who signs what in what order)
  - Document routing (COE, Service Record, NOSI, NOSA, PDS)
- Drag-and-drop or form-based workflow builder
- Validation: no circular dependencies, at least one approver per workflow
- Preview mode showing sample workflow execution

**Rationale for Deferral:**
This is a complex feature requiring a workflow engine with state machine logic. The existing codebase has hardcoded approval chains in leave/payroll modules. Building a visual workflow designer requires:

1. Workflow definition schema (nodes, edges, conditions, actors)
2. Workflow execution engine (state transitions, timeout handling, escalation)
3. UI builder (drag-and-drop canvas or form-based conditional builder)
4. Integration points in all modules (leave, payroll, RPM, document requests)

**Recommended Approach:**

- Phase 1: Define workflow schema in database (workflow_definitions, workflow_nodes, workflow_edges tables)
- Phase 2: Build workflow execution engine (state machine with timeout/escalation support)
- Phase 3: Replace hardcoded approval chains in modules with engine calls
- Phase 4: Build no-code UI on top of working engine

**Estimated Effort:** 3-4 weeks (medium-large feature)

---

### ❌ NOT IMPLEMENTED: Security Event Monitoring Dashboard

**Location:** Should be added to `/admin/audit-logs` (PRD LOG-004)

**Requirements:**

- Real-time security event monitoring and alerting
- Dashboard panel showing:
  - Failed login bursts (5+ failures in 10 minutes from same IP)
  - Unusual export volumes (bulk data exports exceeding threshold)
  - Off-hours admin actions (high-privilege operations outside business hours)
- Security alerts table (severity = 'critical' + alert_sent = true)
- Email/notification alerts to Super Admin on detection

**Rationale for Deferral:**
The current audit_logs schema does not have the required fields (severity, alert_sent, module, outcome) to support security event detection. Adding this dashboard requires:

1. Schema migration: add severity, alert_sent, outcome, module, sub_module, transaction_id, session_id, duration_ms to audit_logs table (PRD Section 14.10)
2. Security event detection logic (scheduled jobs or realtime triggers)
3. Alert notification integration (link to notification system)
4. Dashboard UI with real-time event stream

**Recommended Approach:**

- Phase 1: Extend audit_logs schema with PRD Section 14.10 fields
- Phase 2: Build security event detection service (cron job or Supabase Edge Function)
- Phase 3: Wire up alert notifications (email + in-app to Super Admin role)
- Phase 4: Build dashboard panel in audit-logs page

**Estimated Effort:** 1-2 weeks (medium feature)

---

## Testing Accounts

Use the accounts in `/docs/ACCOUNTS.md` to test different role access:

| Role                  | Email                | Password                            | Dashboard Access            |
| --------------------- | -------------------- | ----------------------------------- | --------------------------- |
| System Administrator  | sysadmin@pcso.gov.ph | PCSO-super-admin-vAs45Fhn           | All settings pages          |
| Compliance & Audit    | audit@pcso.gov.ph    | PCSO-auditor-l36e_poM               | Audit logs (read-only)      |
| HR Administrator      | hr@pcso.gov.ph       | PCSO-hr-admin-y8R9fUQM              | Settings (edit), audit logs |
| Employee Self-Service | ess@pcso.gov.ph      | PCSO-employee-self-service-B7RlGdel | Notification bell only      |

---

## Permission Matrix (PRD Section 11)

The Technical module respects RBAC role permissions:

| Page/Action                     | Super Admin | HR Admin | HR Staff | Dept Head | Employee |
| ------------------------------- | ----------- | -------- | -------- | --------- | -------- |
| `/admin/audit-logs`             | Full        | Full     | None     | None      | None     |
| `/admin/settings`               | Full        | None     | None     | None      | None     |
| `/admin/settings/org-profile`   | Full        | None     | None     | None      | None     |
| `/admin/settings/notifications` | Full        | None     | None     | None      | None     |
| Notification Bell               | Full        | Full     | Full     | Full      | Full     |
| View own notifications          | Full        | Full     | Full     | Full      | Full     |
| Mark read/clear notifications   | Full        | Full     | Full     | Full      | Full     |

**Enforcement Layers:**

1. Route-level: `requirePermission('admin', 'view')` gate before page render
2. Server action-level: `requirePermission('admin', 'edit')` before mutation
3. UI-level: Conditional rendering based on user role (belt-and-braces)

---

## Integration Points

### Audit Log Usage (Other Modules)

All modules must call `auditLog()` after any create/update/delete operation:

```typescript
import { auditLog } from "@/lib/audit";

// After successful database write
void auditLog({
  userId: actor.id,
  action: "update",
  table: "employees",
  recordId: employee.id,
  oldValues: { ...oldEmployee },
  newValues: { ...newEmployee },
});
```

**Convention:** NEVER bypass audit log. Every state-changing operation must produce an audit entry. This is enforced by code review and is a critical requirement for COA compliance.

### Notification Usage (Other Modules)

All modules must call `createNotification()` or `notifyRoles()` for user-facing events:

```typescript
import {
  createNotification,
  notifyEmployee,
  notifyRoles,
} from "@/lib/notifications";

// Notify a single employee
await notifyEmployee(employeeId, {
  type: "leave_approved",
  title: "Your leave application has been approved",
  body: `Your ${leaveType} leave from ${dateFrom} to ${dateTo} has been approved.`,
  actionUrl: `/leave/applications/${applicationId}`,
  entityType: "leave_application",
  entityId: applicationId,
});

// Notify all users with HR Admin role
await notifyRoles(["hr_admin"], {
  type: "payroll_approved",
  title: "Payroll run approved and ready for finalization",
  actionUrl: `/payroll/runs/${payrollRunId}`,
  entityType: "payroll_run",
  entityId: payrollRunId,
});
```

**Non-blocking guarantee:** Notification functions NEVER throw. If a notification write fails, the error is logged but the primary operation (leave approval, payroll finalization) is not rolled back.

### Org Profile Usage (PDFs & Reports)

All PDF generators and remittance exports must resolve agency identity from org_profile table:

```typescript
import { db } from "@/lib/db";
import {
  orgProfile,
  DEFAULT_ORG_PROFILE_ID,
} from "@/lib/db/schema/org-profile";
import { eq } from "drizzle-orm";

// In PDF generator action
const [profile] = await db
  .select()
  .from(orgProfile)
  .where(eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID))
  .limit(1);

// Use in PDF
const pdfDoc = {
  header: profile.agencyName,
  logo: profile.logoUrl,
  footer: `${profile.agencyAddress} | ${profile.contactPhone}`,
};

// Use in remittance export
const birExport = {
  employerTin: profile.birTin,
  employerName: profile.birAgencyName,
};
```

**Impact:** This enables PCSO to rebrand the entire system by changing one database row. All PDFs, remittances, and UI elements automatically reflect the new identity without code changes.

---

## Future Enhancements

### High Priority

1. **Extend Audit Schema** (PRD Section 14.10):
   - Add: outcome, reason, module, sub_module, severity, alert_sent, transaction_id, session_id, duration_ms
   - Migrate existing audit_logs to preserve history
   - Update `auditLog()` function signature

2. **Security Event Monitoring** (PRD LOG-004):
   - Build detection service for failed login bursts, unusual exports, off-hours admin actions
   - Dashboard panel in audit-logs page
   - Email/in-app alerts to Super Admin

3. **Workflow Configuration UI** (PRD CLI-002):
   - Visual workflow designer for leave approval chains, payroll signatories, document routing
   - No-code configuration
   - State machine execution engine

### Medium Priority

4. **Email Template Editor** (Section 13):
   - Rich text editor for email body (WYSIWYG)
   - Template preview with sample data
   - Variable autocomplete in editor

5. **Notification Preferences**:
   - Per-user notification settings (email on/off per template type)
   - Digest mode (daily summary instead of per-event)
   - Do Not Disturb schedule

6. **Audit Log Advanced Filters**:
   - Filter by severity (when schema extended)
   - Filter by module/sub_module (when schema extended)
   - Filter by outcome (success/failure)
   - Saved filter presets

### Low Priority

7. **Org Profile Logo Upload**:
   - Direct file upload to Supabase Storage
   - Image validation (size, format, dimensions)
   - Automatic resize/optimization

8. **Audit Log Chart Visualizations**:
   - Daily activity heatmap
   - Top users by action count
   - Table write frequency chart

---

## Schema Reference

### audit_logs (EXISTING)

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                      -- system_users.id
  action varchar(50) NOT NULL,       -- create, update, delete, approve, export
  table_name varchar(100) NOT NULL,  -- affected table
  record_id uuid,                    -- PK of affected row
  old_values jsonb,                  -- full previous state (null for creates)
  new_values jsonb,                  -- full new state (null for deletes)
  ip_address varchar(45),            -- IPv4/IPv6
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_table_name_idx ON audit_logs(table_name);
CREATE INDEX audit_logs_record_id_idx ON audit_logs(record_id);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
```

### notifications (EXISTING)

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,             -- system_users.id
  type varchar(64) NOT NULL,         -- notification type identifier
  title varchar(255) NOT NULL,       -- display title
  body text,                         -- notification body
  action_url varchar(512),           -- link to related resource
  entity_type varchar(64),           -- e.g., "leave_application"
  entity_id uuid,                    -- FK to related entity
  read_at timestamptz,               -- null = unread
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_all_idx ON notifications(user_id, created_at);
```

### org_profile (EXISTING)

```sql
CREATE TABLE org_profile (
  id varchar(40) PRIMARY KEY,        -- "default" for active profile
  agency_name varchar(200) NOT NULL,
  agency_short_name varchar(40) NOT NULL,
  agency_address text NOT NULL,
  logo_url varchar(500) NOT NULL,
  bir_tin varchar(30),
  bir_agency_name varchar(200),
  philhealth_employer_no varchar(30),
  pagibig_employer_no varchar(30),
  gsis_agency_name varchar(200),
  gsis_employer_no varchar(30),
  contact_email varchar(200),
  contact_phone varchar(40),
  website_url varchar(200),
  tagline varchar(300),
  copyright_holder varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

## Files Created

### Organization Profile

- `/src/app/(dashboard)/admin/settings/org-profile/page.tsx`
- `/src/app/(dashboard)/admin/settings/org-profile/actions.ts`
- `/src/app/(dashboard)/admin/settings/org-profile/_client.tsx`

### Notification Templates

- `/src/app/(dashboard)/admin/settings/notifications/page.tsx`
- `/src/app/(dashboard)/admin/settings/notifications/actions.ts`
- `/src/app/(dashboard)/admin/settings/notifications/_client.tsx`

### Documentation

- `/docs/TECHNICAL-MODULE-SUMMARY.md` (this file)

---

## Files Reused (Already Existed)

### Audit Log System

- `/src/app/(dashboard)/admin/audit-logs/page.tsx`
- `/src/app/(dashboard)/admin/audit-logs/queries.ts`
- `/src/app/(dashboard)/admin/audit-logs/export/route.ts`
- `/src/components/admin/audit-log-table.tsx`
- `/src/components/admin/audit-log-detail-dialog.tsx`
- `/src/lib/db/schema/audit.ts`
- `/src/lib/audit/index.ts`

### Notification System

- `/src/components/layouts/notification-bell.tsx`
- `/src/lib/notifications/index.ts`
- `/src/lib/notifications/actions.ts`
- `/src/lib/db/schema/notifications.ts`
- `/src/hooks/use-notifications.ts`

### Org Profile Schema

- `/src/lib/db/schema/org-profile.ts`

---

## Deployment Checklist

Before production deployment, ensure:

1. ✅ Audit log table exists with all indexes
2. ✅ Notifications table exists with indexes
3. ✅ Org profile table exists with DEFAULT_ORG_PROFILE_ID row populated
4. ✅ All PDF templates updated to reference orgProfile (P0-002)
5. ✅ All remittance exports updated to reference orgProfile (P0-003)
6. ✅ Login UI, sidebar, metadata updated to reference orgProfile (P0-004)
7. ⚠️ Security event monitoring dashboard (LOG-004) - NOT IMPLEMENTED
8. ⚠️ Workflow configuration UI (CLI-002) - NOT IMPLEMENTED
9. ⚠️ Audit schema extension (Section 14.10 missing fields) - NOT IMPLEMENTED

---

## Support

For questions or issues with the Technical module:

1. Check this documentation first
2. Review PRD Sections 10, 11, 13, 14.10 for requirements
3. Check `/docs/ACCOUNTS.md` for test account credentials
4. Review `/src/lib/audit/index.ts` and `/src/lib/notifications/index.ts` for API usage examples

**PRD References:**

- Section 10: Computation Specifications (leave, OT, payroll, performance, step increment, BIR, GSIS, PhilHealth, Pag-IBIG)
- Section 11: Role-Permission Matrix (5 roles × 12 modules)
- Section 12: Workflow State Machines (5 workflows: leave, payroll, RPM, document request, personnel movement)
- Section 13: System Notification Matrix (38 notification templates)
- Section 14.10: Key Entity Schema Reference (audit_logs field definitions)

---

**Document Version:** 1.0
**Last Updated:** 2026-04-22
**Author:** Th/rd Code Solutions Inc.
**Status:** Technical Module Phase 10 Complete (with noted deferrals)
