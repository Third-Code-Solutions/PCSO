# Technical Module User Guide

## Quick Start

This guide shows you how to access and use the Technical module features in the PCSO HRIS.

## Access Requirements

**Required Role:** System Administrator (Super Admin)

**Test Account:**

- Email: `sysadmin@pcso.gov.ph`
- Password: `PCSO-super-admin-vAs45Fhn`

---

## 1. Audit Log Viewer

**URL:** [http://localhost:3000/admin/audit-logs](http://localhost:3000/admin/audit-logs)

**What it does:** Shows every create, update, delete, approve, and export operation in the system. COA-ready immutable audit trail.

**How to use:**

1. Navigate to Admin → Audit Logs
2. Use filters to narrow down results:
   - **Actor:** Select which user performed the action
   - **Table:** Select which database table was affected
   - **Action:** Filter by create, update, delete, approve, export
   - **Record ID:** Enter specific UUID to track one record's history
   - **Date Range:** From/To date pickers
   - **Rows/page:** 50, 100, or 200 results per page
3. Click "Apply filters" to search
4. Click "Clear" to reset all filters
5. Click row to expand and see full old/new values (JSONB diff)
6. Click "Export Excel" to download filtered results as spreadsheet

**Tips:**

- Use date range to find recent changes
- Use Record ID to see complete history of one employee, leave application, or payroll run
- Export to Excel for COA submission or forensic analysis
- Audit logs auto-refresh in realtime (new entries appear without page reload)

---

## 2. Organization Profile Settings

**URL:** [http://localhost:3000/admin/settings/org-profile](http://localhost:3000/admin/settings/org-profile)

**What it does:** Single source of truth for agency identity, remittance IDs, and contact info (PRD §P0-001).

**How to use:**

1. Navigate to Admin → Settings → Organization Profile
2. Fill in three sections:

### Identity Section

- **Agency Name:** Full legal name (e.g., "Philippine Charity Sweepstakes Office")
- **Short Name:** Acronym (e.g., "PCSO")
- **Address:** Full mailing address
- **Logo URL:** URL to agency seal image (used in navbar, PDFs, reports)
- **Tagline:** Optional motto (e.g., "Kaya natin, para sa bayan")
- **Copyright Holder:** Copyright notice footer text

### Remittance Employer Identifiers Section

- **BIR TIN:** Tax Identification Number (format: 000-000-000-000)
- **BIR Agency Name:** Name as registered with BIR
- **GSIS Employer No.:** GSIS employer registration number
- **GSIS Agency Name:** Name as registered with GSIS
- **PhilHealth Employer No.:** PhilHealth employer registration number
- **Pag-IBIG Employer No.:** Pag-IBIG employer registration number

### Contact Information Section

- **Email:** Public contact email (shown in footer and documents)
- **Phone:** Public contact phone (shown in footer and documents)
- **Website URL:** Agency website (linked in footer)

3. Click "Save Changes" to update
4. Click "Reset" to discard changes and restore original values

**What changes immediately:**

- Navbar logo and title
- Footer contact info
- All PDF templates (payslips, payroll registers, IPCRF forms, OPCRF forms, step increment notices, DTR batches, leave forms, SALN forms)
- All remittance exports (BIR, PhilHealth, Pag-IBIG, GSIS)
- Login panel
- Sidebar title
- Browser tab title

**Impact:** Changing agency name here instantly rebrands the entire system without code changes or redeployment.

---

## 3. Notification Templates

**URL:** [http://localhost:3000/admin/settings/notifications](http://localhost:3000/admin/settings/notifications)

**What it does:** Configure the 38 system notification templates (PRD Section 13). Toggle enable/disable and customize email content.

**How to use:**

1. Navigate to Admin → Settings → Notifications
2. Use search box to find templates by ID, title, type, or recipient
3. Click "Edit Template" on any card to open editor
4. In the editor:
   - Toggle "Enable Notification" switch (when disabled, notification will not be sent)
   - Edit "Email Subject" (200 char max)
   - Edit "Email Body" (5000 char max, plain text or HTML)
   - Use variables: `{employee_name}`, `{date}`, `{action}`, `{link}`, `{details}`
5. Click "Save Changes" to update template
6. Click "Cancel" to discard changes

**Template Categories:**

### Leave Notifications (N-001 to N-008)

- Leave submitted, approved, disapproved, cancelled
- Auto-approved (timeout), cancellation requested/approved
- Year-end forced leave deducted, LWOP notice

### Attendance Notifications (N-009 to N-012)

- Tardiness (single instance), habitual tardiness (10+ instances)
- OT submitted, OT approved

### Payroll Notifications (N-013 to N-014)

- Payslip available, payroll run approved

### Compliance Notifications (N-015 to N-017)

- SALN reminder, SALN deadline (7 days), PDS reminder

### Document Request Notifications (N-018 to N-019)

- Document request status update, document ready for pickup

### Step Increment Notifications (N-020 to N-022)

- Step increment eligible, NOSI issued, NOSA issued

### Performance Notifications (N-023 to N-024)

- Performance cycle opens, performance cycle deadline (7 days)

### Recruitment Notifications (N-025 to N-027)

- MRF action required, exam schedule, application result

### Training Notifications (N-028 to N-030)

- Training assigned, training approval, mandatory training reminder

### Welfare & Benefits Notifications (N-031 to N-033)

- Annual retirement notification, PRAISE advance notice, loyalty award eligible

### DTR Notifications (N-034 to N-035)

- DTR correction submitted, DTR correction approved

### Security Notifications (N-036 to N-038)

- SSO new device login, failed login burst (security alert), PBB list generated

**Tips:**

- Disable non-essential notifications to reduce email noise
- Customize email subject/body to match PCSO communication style
- Use variables for dynamic content (employee name, dates, links)
- Test notifications after editing by triggering the event (e.g., submit a leave application)

---

## 4. Notification Bell (All Users)

**Location:** Top navigation bar (bell icon)

**What it does:** Shows recent notifications with unread count badge. Available to all users (not just admins).

**How to use:**

1. Click bell icon in top navbar
2. Desktop: Opens popover with latest 20 notifications
3. Mobile: Opens full-screen dialog
4. Green dot = realtime connected, yellow = polling fallback, red = connection error
5. Click "Mark all as read" to mark all unread as read
6. Click individual notification to:
   - Mark as read (if unread)
   - Navigate to related page (if has action URL)
7. Click "Clear all" → "Delete everything" to permanently delete all notifications

**Visual Indicators:**

- Red badge: Unread count (hidden when zero)
- Gold dot: Unread notification
- No dot: Read notification
- Gray text: Notification timestamp ("2 minutes ago", "3 hours ago")

**Notification Types You'll See:**

- Leave approvals/disapprovals
- Payslip availability
- Document request updates
- Training assignments
- SALN/PDS reminders
- Performance evaluation deadlines
- Security alerts (failed logins, new device logins)

---

## 5. System Settings Overview (Existing)

**URL:** [http://localhost:3000/admin/settings](http://localhost:3000/admin/settings)

**What it does:** Configure system-wide settings (non-identity settings).

**Existing Settings:**

- Organization name (use org-profile page instead)
- Logo URL (use org-profile page instead)
- Organization address (use org-profile page instead)
- Email from address
- Payroll cutoff dates (1st period: day 15, 2nd period: day 31)
- Payroll release dates (1st period: day 20, 2nd period: day 5 of next month)

**Note:** Identity settings (org name, logo, address) should be edited via Organization Profile page (`/admin/settings/org-profile`) for consistency.

---

## Navigation Map

```
/admin
├── /audit-logs                         ✅ Audit Log Viewer
├── /settings                            ✅ System Settings
│   ├── /org-profile                    ✅ Organization Profile (NEW)
│   └── /notifications                  ✅ Notification Templates (NEW)
```

---

## Permission Matrix

| Feature                | Super Admin | HR Admin | Compliance & Audit | Employee |
| ---------------------- | ----------- | -------- | ------------------ | -------- |
| Audit Log Viewer       | ✅ Full     | ✅ Full  | ✅ Read-only       | ❌ None  |
| Org Profile Settings   | ✅ Edit     | ❌ None  | ❌ None            | ❌ None  |
| Notification Templates | ✅ Edit     | ❌ None  | ❌ None            | ❌ None  |
| System Settings        | ✅ Edit     | ❌ None  | ❌ None            | ❌ None  |
| Notification Bell      | ✅ View     | ✅ View  | ✅ View            | ✅ View  |

---

## Common Questions

### Q: Where do I change the agency name displayed in the navbar?

**A:** Admin → Settings → Organization Profile → Identity section → Agency Name field

### Q: How do I export audit logs for COA submission?

**A:** Admin → Audit Logs → Apply filters (date range, etc.) → Click "Export Excel" button

### Q: How do I disable email notifications for non-critical events?

**A:** Admin → Settings → Notifications → Find template → Edit Template → Toggle "Enable Notification" off

### Q: How do I see who accessed a specific employee record?

**A:** Admin → Audit Logs → Filter by Table: "employees" → Filter by Record ID: [employee UUID] → Apply filters

### Q: Can I customize the logo shown in PDF payslips?

**A:** Yes. Admin → Settings → Organization Profile → Identity section → Logo URL field (must be publicly accessible URL)

### Q: How do I change BIR TIN for remittance exports?

**A:** Admin → Settings → Organization Profile → Remittance Employer Identifiers section → BIR TIN field

### Q: Where do I see failed login attempts?

**A:** Admin → Audit Logs → Filter by Action: "login" (when implemented) → Apply filters

### Q: Can employees see the audit log?

**A:** No. Audit log is Super Admin and HR Admin only. Compliance & Audit role has read-only access.

---

## Troubleshooting

### Notification bell shows "Offline" (red dot)

- Check internet connection
- Refresh page
- If persists, check Supabase realtime connection status

### Audit log export fails

- Check filter date range (too wide = large file, may timeout)
- Reduce page size or narrow date range
- Try exporting in smaller batches

### Changes to org profile not reflecting immediately

- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check that Save Changes button was clicked (success toast should appear)

### Notification template changes not affecting sent notifications

- Changes apply to NEW notifications only (not retroactive)
- Trigger a new event (e.g., submit test leave application) to see updated template

---

## Support

For technical support or questions:

1. Check `/docs/TECHNICAL-MODULE-SUMMARY.md` for complete technical reference
2. Check `/docs/ACCOUNTS.md` for test account credentials
3. Review PRD Sections 10, 11, 13, 14.10 for requirements

**PRD References:**

- P0-001: Organization Profile (single source of truth)
- Section 11: Role-Permission Matrix
- Section 13: System Notification Matrix (38 templates)
- Section 14.10: Audit Log Schema
- LOG-001: Audit Log Requirements
- CLI-002: Workflow Configuration (not yet implemented)
- LOG-004: Security Event Monitoring (not yet implemented)

---

**Document Version:** 1.0
**Last Updated:** 2026-04-22
**Audience:** System Administrators, HR Administrators, Compliance & Audit Personnel
