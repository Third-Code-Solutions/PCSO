# Dashboard Email Password DB Role Use case

1 Employee Self-Service ess@pcso.gov.ph PCSO-employee-self-service-B7RlGdel employee_self_service Rank-and-file: leave, DTR, payslips, 201, SALN, PDS
2 Supervisor / Manager supervisor@pcso.gov.ph PCSO-supervisor-tqCcVJI3 supervisor Approve leave, review DTR, SPMS reviews, team analytics
3 HR Administrator hr@pcso.gov.ph PCSO-hr-admin-y8R9fUQM hr_admin 201 file, recruitment, appointments, movements, clearance
4 Payroll & Compensation payroll@pcso.gov.ph PCSO-payroll-admin-2EBCCrQt payroll_admin Payroll runs, remittances (GSIS / PhilHealth / Pag-IBIG / BIR), bonuses
5 Executive / Leadership executive@pcso.gov.ph PCSO-executive-2_3XZENR executive Workforce analytics, headcount vs plantilla, GAD, KPIs (read-only)
6 Compliance & Audit audit@pcso.gov.ph PCSO-auditor-l36e_poM auditor COA, CSC, DPA logs, SALN tracking, RA 6713, DPO (read-only)
7 System Administrator sysadmin@pcso.gov.ph PCSO-super-admin-vAs45Fhn super_admin User provisioning, RBAC, health, integrations, security logs

## Platform / Operations tier (principal-level, read-only oversight)

These roles operate and assure the platform; they observe/audit read-only and do not perform HR data entry. Technical roles land on the System-Admin control-plane dashboard; QA on the Audit dashboard; the rest on the Executive read-only analytics dashboard.

8 Project / Program Manager pm@pcso.gov.ph PCSO-project-manager-Qm7xL2Pa project_manager Delivery oversight — org-wide read analytics
9 Solutions Architect architect@pcso.gov.ph PCSO-solutions-architect-Zr4vN9Kd solutions_architect System design review — org-wide read
10 Technical Lead (Backend) backend-lead@pcso.gov.ph PCSO-backend-lead-Wt6bH3Mq backend_lead Backend oversight — org-wide read
11 QA Lead qa-lead@pcso.gov.ph PCSO-qa-lead-Yp2cF8Rn qa_lead Quality assurance — audit/compliance read
12 DevOps / Platform Lead devops@pcso.gov.ph PCSO-devops-lead-Ld9kT4Bs devops_lead Control plane — health, integrations, security logs (read)
13 UX / UI Designer ux@pcso.gov.ph PCSO-ux-designer-Vx3mQ7Jw ux_ui_designer Experience review — org-wide read
14 Technical Writer techwriter@pcso.gov.ph PCSO-tech-writer-Ns8dR5Gh technical_writer Documentation — org-wide read
15 Foundation & Platform Engineer platform-eng@pcso.gov.ph PCSO-platform-eng-Kc6wP2Ft platform_engineer Control plane — integrations, health (read)
16 Integration Engineer integration@pcso.gov.ph PCSO-integration-eng-Hb4nZ9Lx integration_engineer Integrations/API — control plane read
17 QA Engineer qa-eng@pcso.gov.ph PCSO-qa-engineer-Dg7sM3Vq qa_engineer Test verification — audit/compliance read
18 Maintenance Engineer maintenance@pcso.gov.ph PCSO-maintenance-eng-Rf5tW8Cn maintenance_engineer Upkeep — control plane read
19 DevOps / Security & Hosting Ops secops@pcso.gov.ph PCSO-security-ops-Jq2xB6Kp security_ops_engineer Security & hosting — control plane, security logs (read)

---

# M9 & M10 Implementation Status

## Completed Tasks

### 1. Database Schema (portal-requests.ts)

✅ Created comprehensive schema for all portal extensions:

- `shiftChangeRequests` (EPM-007)
- `dtrCorrectionRequests` (EPM-008)
- `documentUploads` (EPM-009)
- `pdsUpdateRequests` (EPM-012)
- `idRequests` (EPM-013)
- `personnelMovementRequests` (EPM-011)

✅ Updated schema/index.ts to export portal-requests

### 2. Server Actions

✅ **Shift Change Actions** (`portal/shift-change.ts`):

- submitShiftChangeRequest(), supervisorReviewShiftChange(), processShiftChange()
- Get methods for employee, supervisor, and HR views

✅ **DTR Correction Actions** (`portal/dtr-correction.ts`):

- submitDtrCorrectionRequest(), supervisorReviewDtrCorrection(), processDtrCorrection()
- Get methods for employee, supervisor, and HR views

### 3. EWBM Module Status

✅ All EWBM pages already exist in `/welfare/*`
✅ All EWBM actions already exist in `ewbm/*.ts`

## Remaining Tasks

### Server Actions (Priority Order)

1. **Document Upload** (`portal/document-upload.ts`) - EPM-009
2. **PDS Update** (`portal/pds-update.ts`) - EPM-012
3. **ID Request** (`portal/id-request.ts`) - EPM-013
4. **Personnel Movement** (`portal/movement.ts`) - EPM-011

### UI Pages (Directories exist but empty)

All pages in `/portal/*` need implementation:

- shift-change/page.tsx
- dtr-correction/page.tsx
- document-upload/page.tsx
- pds-update/page.tsx
- id-request/page.tsx
- personnel-movement/page.tsx

### Shared Components Needed

Create in `src/components/portal/`:

- DocumentUploadZone - File upload with validation
- RequestStatusBadge - Status indicators
- ApprovalTimeline - Workflow visualization
- SupervisorReviewPanel - Approve/reject interface
- HRReviewPanel - HR processing interface

## Next Steps

1. Complete remaining 4 server action files
2. Create UI pages with forms and tables
3. Build shared components
4. Run database migrations
5. Test end-to-end workflows

---

# M3 PIMM Document Generators & Workforce Reports

**Module:** Personnel Information Management Module (PIMM)
**PRD Requirements:** PIM-005 through PIM-028
**Status:** ✅ Core Implementation Complete

## What Was Built

### 1. Document Request System (PIM-005, Section 12.4)

**Database Schema:**

- ✅ `src/lib/db/schema/document-requests.ts` — Document request table with state machine
- ✅ Exported in `src/lib/db/schema/index.ts`

**State Machine:**

```
RECEIVED → IN_PROCESS → READY → RELEASED (success path)
RECEIVED → DISAPPROVED (rejection path)
IN_PROCESS → ON_HOLD → IN_PROCESS (hold/resume cycle)
```

**Server Actions:** `src/lib/actions/documents/document-request-actions.ts`

- ✅ submitDocumentRequest, acceptDocumentRequest, processDocumentRequest
- ✅ putDocumentRequestOnHold, resumeDocumentRequest, releaseDocument
- ✅ disapproveDocumentRequest, getDocumentRequests, getDocumentRequestById

**UI Pages:**

- ✅ `/employees/documents/requests/page.tsx` — Request list with status tracking
- ✅ `/employees/documents/requests/[id]/page.tsx` — Request detail with timeline & action forms

**Action Forms:**

- ✅ `accept-request-form.tsx` — Transition: received → in_process
- ✅ `process-request-form.tsx` — Transition: in_process → ready (generates document)
- ✅ `hold-request-form.tsx` — Transition: in_process → on_hold
- ✅ `resume-request-form.tsx` — Transition: on_hold → in_process
- ✅ `release-request-form.tsx` — Transition: ready → released
- ✅ `disapprove-request-form.tsx` — Transition: received → disapproved

**Document Types:** COE, COE_REMUNERATION, SERVICE_RECORD, PDS, NOSI, NOSA, CLEARANCE, CERTIFICATE_TRAINING, AD_HOC

---

### 2. Document Generators (PIM-010, PIM-011)

**COE Generator:** `src/lib/actions/documents/coe-generator.ts`

- ✅ Serial number: `COE-YYYY-NNNNNN` (atomic via serial_sequences)
- ✅ PCSO letterhead from org_profile
- ✅ Employee details, position, employment period, civil status
- ✅ Optional salary field (configurable)
- ✅ PDF generation using @react-pdf/renderer
- ✅ Upload to Supabase Storage (documents/coe/)

**COE with Remunerations:**

- ✅ Same generator with `includeSalary: true`
- ✅ Serial: `COER-YYYY-NNNNNN`

**Still TODO:** SERVICE_RECORD, PDS, NOSI, NOSA, Ad hoc generators

---

### 3. Serial Number System (PIM-016)

**Files:**

- ✅ `src/lib/db/schema/serial-sequences.ts`
- ✅ `src/lib/db/serial-sequence-helpers.ts`

**Functions:**

- generateSerialNumber(documentType, year?, tx?)
- getNextSequence(documentType, year?, tx?) — Atomic increment
- formatSerialNumber(documentType, sequence, year?)
- getCurrentSequence(documentType, year?, tx?)

**Thread Safety:** PostgreSQL INSERT...ON CONFLICT for atomic increment

---

### 4. Workforce Reports (PIM-019, PIM-020, PIM-023, PIM-024, PIM-027)

**Server Actions:** `src/lib/actions/reports/workforce-reports.ts`

#### Retirement Eligibility Report (PIM-019)

- ✅ `getRetirementEligibilityReport(filters)`
- ✅ Optional: age ≥60 AND ≥15yrs service
- ✅ Compulsory: age ≥65
- ✅ Look-ahead window (default: 12 months)
- ✅ UI: `/reports/workforce/retirement/page.tsx`

#### Loyalty Award Eligibility Report (PIM-020)

- ✅ `getLoyaltyAwardEligibilityReport(filters)`
- ✅ Milestones: 10, 15, 20, 25, 30, 35, 40, 45 years
- ✅ Year filter for awards planning
- ✅ UI: `/reports/workforce/loyalty/page.tsx`

#### PDS Submission Tracking (PIM-023)

- ⚠️ `getPDSSubmissionReport(filters)` — Placeholder (needs pds_submissions table)

#### Office Clearance Processing (PIM-024)

- ⚠️ `getClearanceReport(filters)` — Placeholder (needs clearances table)

#### Employee Qualifications (PIM-027)

- ⚠️ `getEmployeeQualificationsReport(filters)` — Placeholder (needs education/eligibility tables)

---

## Required Migrations

```sql
CREATE TABLE document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  document_type VARCHAR(30) NOT NULL,
  purpose TEXT,
  remarks TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  assigned_to_id UUID REFERENCES employees(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  disapproved_at TIMESTAMPTZ,
  on_hold_reason TEXT,
  disapproval_reason TEXT,
  serial_number VARCHAR(50),
  generated_document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_requests_employee_id ON document_requests(employee_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);
CREATE INDEX idx_document_requests_assigned_to_id ON document_requests(assigned_to_id);
CREATE INDEX idx_document_requests_serial_number ON document_requests(serial_number);
```

---

## Supabase Storage Required

**Bucket:** `documents` (public, 10MB limit, PDF only)

- Path: `{document_type}/{serial_number}.pdf`
- Example: `documents/coe/COE-2026-000042.pdf`

---

## Implementation Status

| PRD Req              | Status         | File(s)                                                                                                       |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| PIM-005              | ✅ Complete    | document-requests.ts, document-request-actions.ts, requests/page.tsx, requests/[id]/page.tsx + 6 action forms |
| PIM-010              | ✅ Complete    | coe-generator.ts                                                                                              |
| PIM-011              | ✅ Complete    | coe-generator.ts (includeSalary)                                                                              |
| PIM-016              | ✅ Complete    | serial-sequences.ts, serial-sequence-helpers.ts                                                               |
| PIM-019              | ✅ Complete    | workforce-reports.ts, /retirement/page.tsx                                                                    |
| PIM-020              | ✅ Complete    | workforce-reports.ts, /loyalty/page.tsx                                                                       |
| PIM-023              | ⚠️ Placeholder | workforce-reports.ts (needs table)                                                                            |
| PIM-024              | ⚠️ Placeholder | workforce-reports.ts (needs table)                                                                            |
| PIM-027              | ⚠️ Placeholder | workforce-reports.ts (needs table)                                                                            |
| PIM-012-015, 017-018 | ⏳ TODO        | (SERVICE_RECORD, PDS, NOSI, NOSA, QR, Ad hoc)                                                                 |

---

## Next Steps for M3 Completion

1. ~~**Document request detail page**~~ — ✅ Complete
2. **New request form page** — `/employees/documents/requests/new/page.tsx`
3. **Remaining document generators** — SR, PDS, NOSI, NOSA, Ad hoc
4. **QR code verification** — `/verify/[token]` endpoint + JWT signing
5. **Notification integration** — N-018, N-019, N-032
6. **Audit logging** — LOG-001 for all document operations
7. **Remaining report pages** — PDS, clearance, qualifications
8. **Excel export** — Add to all report pages
9. **Dynamic stats cards** — Replace placeholder 0s with real counts
