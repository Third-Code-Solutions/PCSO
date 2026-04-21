# PHILIPPINE CHARITY SWEEPSTAKES OFFICE

_Human Resource System_

## PRODUCT REQUIREMENTS DOCUMENT

Version 1.2 \| April 2026 \| CONFIDENTIAL

**Prepared by Th/rd Code Solutions Inc.**

|                          |                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **Document Owner**       | Th/rd Code Solutions Inc.                                                               |
| **Prepared For**         | Philippine Charity Sweepstakes Office (PCSO)                                            |
| **Document Type**        | Product Requirements Document (PRD)                                                     |
| **Version**              | 1.2 — Third Release (Dashboards & Table of Contents)                                    |
| **Date**                 | April 2026                                                                              |
| **Classification**       | CONFIDENTIAL                                                                            |
| **Regulatory Framework** | CSC / GSIS / BIR / PhilHealth / Pag-IBIG / COA / NPC / DPA / DICT                       |
| **TOR Reference**        | PCSO Human Resource System Terms of Reference (PCSO-HRS-2025)                           |
| **Codebase Baseline**    | Senate HRIS worktree — ~48% TOR coverage at assessment date                             |
| **Change from v1.1**     | Added: Section 3.4 Role-Based Dashboards (7 dashboards). Added: Table of Contents page. |

## Table of Contents

_PCSO Human Resource System — PRD v1.2_

# 1. PRD Validation Statement

This document (v1.2) supersedes PRD v1.1. Version 1.1 resolved five categories of missing specification on compliance-critical logic; v1.2 adds role-based dashboard scoping and a navigable table of contents, both of which were flagged as clarity gaps during internal review. The following changes are in effect:

| **Gap Category**                                                                       | **v1.1 Status**         | **v1.2 Resolution**                                                             | **Section**       |
| -------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- | ----------------- |
| Computation Specifications (leave, payroll, OT, tardiness, step increment formulas)    | Missing                 | Fully specified with CSC/BIR/GSIS/PhilHealth/Pag-IBIG regulatory formulas       | Section 10        |
| Role-Permission Matrix (what each of 5 roles can do in each module)                    | Missing                 | Complete 8×12 permission matrix with granular action-level control              | Section 11        |
| Workflow State Machines (leave, payroll, RPM, document request states and transitions) | Missing                 | State diagrams for 5 core workflows with actors, conditions, and timeout rules  | Section 12        |
| System Notification Matrix (event-to-recipient trigger table)                          | Missing                 | 38 notification triggers mapped to recipients, channels, and template IDs       | Section 13        |
| Key Entity Schema Reference (field-level definitions for core tables)                  | Missing                 | 10 core entities with field names, types, constraints, and relationships        | Section 14        |
| Role-Based Dashboard Specification                                                     | Missing in v1.1         | 7 role-scoped dashboards defined with users, use cases, and isolation rationale | Section 3.4 (NEW) |
| Table of Contents                                                                      | Missing in v1.1         | Full navigable TOC generated on page 2                                          | Page 2 (NEW)      |
| Company name                                                                           | Nexlyr IT & AI Strategy | Th/rd Code Solutions Inc.                                                       | Throughout        |
| Document dates                                                                         | April 2025              | April 2026                                                                      | Throughout        |

# 2. Executive Summary

This Product Requirements Document (PRD) defines the complete functional, technical, and delivery requirements for the Philippine Charity Sweepstakes Office (PCSO) Human Resource System (HRS). It is derived from the official PCSO Terms of Reference (TOR), a comprehensive gap analysis of the existing codebase, and a strategic assessment of PCSO-specific operational needs.

The PCSO HRS shall automate and centralize all HR functions across PCSO's Head Office, NCL Department, STBR Department, Visayas Department, and Mindanao Department. The system must comply with all applicable Philippine government regulations including CSC Omnibus Rules, GSIS Act, TRAIN Law BIR withholding, PhilHealth, Pag-IBIG, COA standards, the Data Privacy Act of 2012 (RA 10173), and DICT Cloud-First Policy.

A technical baseline assessment reveals the existing codebase covers approximately 48% of TOR requirements. Three modules are absent entirely: Recruitment & Promotion (Module 2), Learning & Development (Module 6), and Employee Welfare & Benefits / PRAISE (Module 10). Senate-specific hardcoded values must be systematically replaced with PCSO identity before all other work proceeds.

| **Module**                              | **TOR Reqs** | **Covered** | **Coverage** | **Status** |
| --------------------------------------- | ------------ | ----------- | ------------ | ---------- |
| File Maintenance (FM)                   | 58           | 32          | 55%          | Partial    |
| Recruitment & Promotion (RPM)           | 29           | 3           | 10%          | Missing    |
| Personnel Information Management (PIMM) | 26           | 13          | 50%          | Partial    |
| Leave Administration (LAM)              | 14           | 11          | 75%          | Partial    |
| Time & Attendance (TAM)                 | 15           | 9           | 60%          | Partial    |
| Learning & Development (LDM)            | 16           | 1           | 5%           | Missing    |
| Performance Management (PMM)            | 7            | 5           | 70%          | Partial    |
| Payroll Module (PM)                     | 15           | 9           | 60%          | Partial    |
| Employee Portal (EPM)                   | 13           | 6           | 45%          | Partial    |
| Welfare & Benefits / PRAISE (EWBM)      | 5            | 0           | 0%           | Missing    |
| Technical / Infrastructure              | 50+          | ~27         | 45%          | Partial    |

# 3. Product Vision & Objectives

## 3.1 Vision Statement

To build the most compliant, capable, and innovative Human Resource System in Philippine government service — one that eliminates manual HR bottlenecks at PCSO, sets the technical standard for GOCC digital transformation, and demonstrates that government software can be both fully regulatory-compliant and genuinely excellent.

## 3.2 Strategic Objectives

- Achieve 100% compliance with all 200+ functional requirements defined in the PCSO HRS Terms of Reference.

- Centralize and automate all HR transactions across PCSO Head Office and four regional departments.

- Eliminate manual paper-based processes for leave, payroll, attendance, performance, and document requests.

- Ensure full compliance with CSC, GSIS, BIR, PhilHealth, Pag-IBIG, COA, NPC, DPA, and DICT regulations.

- Deliver a system supporting 900+ concurrent users at sub-3-second average response time.

- Establish an auditable, tamper-evident digital record system aligned with NAP archival standards.

- Introduce AI-augmented features that set a new benchmark for government HR platforms in the Philippines.

## 3.3 Stakeholders

| **Stakeholder**                      | **Role in System**                    | **Key Needs**                                                   |
| ------------------------------------ | ------------------------------------- | --------------------------------------------------------------- |
| PCSO General Manager                 | System Approver / Executive Dashboard | Workforce analytics, retirement forecasting, compliance reports |
| AGM – Administrative Sector          | Senior Approver                       | Org-wide performance, payroll oversight, HR policy enforcement  |
| HRD Manager / Division Chiefs        | Primary HR Operators                  | All HR transactions, document generation, workforce management  |
| HR Staff                             | Daily Users                           | Leave processing, payroll runs, attendance, document requests   |
| Department / Branch Managers         | Unit-Level Approvers                  | Team leave, OT, attendance, DTR corrections                     |
| Organic Employees (Permanent / Temp) | Employee Portal Users                 | Payslips, leave, DTR, document requests, self-service           |
| Non-Organic Personnel (JO / COS)     | Partial Portal Users                  | Payslips, DTR, contracts                                        |
| PCSO IT Department                   | System Administrators                 | User management, config, audit logs, backups                    |
| COA Auditors                         | External Auditor                      | Payroll registers, remittances, audit trails                    |
| CSC / NPC                            | Regulatory Bodies                     | Civil service rules compliance, data privacy standards          |

## 3.4 Role-Based Dashboards

The PCSO HRS exposes seven (7) role-scoped dashboards as the primary entry point for each user class. Dashboard separation is not cosmetic — each dashboard enforces the data-visibility, approval-scope, and audit-posture appropriate to its user class, aligned with the Role-Permission Matrix in Section 11 and the Notification Matrix in Section 13. The rationale for role separation follows Philippine government HRIS standards (CSC, COA, DBM) and the PCSO organizational structure defined in FM-001.

_All seven dashboards render on the same authenticated Next.js application; the dashboard shown after login is determined by the user's assigned RBAC role and an optional dashboard_profile attribute (used to distinguish Payroll, Executive, and Audit variants of HR Admin). No user has access to a dashboard outside their role scope, and no dashboard may bypass the server-action authorization layer specified in Section 11._

### 3.4.1 Summary of the Seven Dashboards

| **Dashboard**                   | **Primary Users**                        | **Separation Rationale**                  |
| ------------------------------- | ---------------------------------------- | ----------------------------------------- |
| 1\. Employee Self-Service (ESS) | All rank-and-file, JO, COS               | Read-heavy, scoped to own records         |
| 2\. Supervisor / Manager        | Division chiefs, dept heads, supervisors | Team-scoped approval workflows            |
| 3\. HR Administrator            | HRMD / HRD staff                         | Core HR transactional work                |
| 4\. Payroll & Compensation      | Payroll officers, accounting liaison     | Financial sensitivity & BIR/DBM audit     |
| 5\. Executive / Leadership      | GM, AGMs, Board of Directors             | Aggregated read-only analytics            |
| 6\. Compliance & Audit          | Internal Audit, COA liaison, DPO, Legal  | Read everywhere, write nowhere            |
| 7\. System Administrator        | IT / MIS team                            | Technical control plane, no HR data edits |

### 3.4.2 Dashboard Specifications

**D1. Employee Self-Service Dashboard (ESS)**

Users: All rank-and-file employees, Job Order (JO) and Contract of Service (COS) personnel.

**Primary Use Cases:**

- Personal data viewing and updates (subject to HRD approval per EPM-012).

- Leave applications using CSC Form 6 format (EPM-004).

- DTR viewing and correction requests (EPM-008).

- Payslip access for all payroll types including loans ledger (EPM-001).

- 201 file document self-upload and viewing (EPM-009).

- SALN submission tracking and PDS (CS Form 212) updates (EPM-012, PIM-022, PIM-023).

- Training history, confirmed attendance, and certificate download (EPM-002, LDM-014).

- Loan applications and amortization schedule viewing (PAY-009).

_Why Separate: This is the largest user population by headcount, operates under the strictest data scope (own records only), and is read-heavy. Isolating ESS simplifies security review and makes mobile-first rendering practical._

**D2. Supervisor / Manager Dashboard**

Users: Division Chiefs, Department Heads, Branch Managers, immediate supervisors.

**Primary Use Cases:**

- Approve or disapprove leave requests from direct reports (LAM-003, workflow 12.1).

- Review DTR of subordinates and endorse DTR correction requests (EPM-008).

- Conduct SPMS performance reviews — IPCRF and OPCRF signoff (PMM-001, PMM-002).

- Endorse training requests and confirm team participation (LDM-014).

- View team attendance analytics, absences, tardiness patterns (TAM-009, TAM-011).

- Provide succession planning inputs and endorse personnel movement requests (EPM-011, workflow 12.5).

_Why Separate: Supervisors require team-scoped visibility and approval workflows, but must be prevented from viewing records outside their reporting chain. The dashboard enforces scope via the Own Unit access level defined in Section 11._

**D3. HR Administrator Dashboard**

Users: HRMD / HRD staff — the primary HR operations team.

**Primary Use Cases:**

- 201 file management — creation, updates, document upload validation (PIM-001, PIM-004).

- Recruitment and selection end-to-end, compliant with CSC MC 14 s. 2018 (all of Module 2, RPM-001 to RPM-025).

- Appointment processing and employee auto-provisioning on RPM-023.

- PDS verification and approval of employee-submitted changes (EPM-012).

- PSIPOP and plantilla management (PIM-025, PIM-026).

- Employee movements — promotion, transfer, reassignment, detail (workflow 12.5).

- Clearance processing and retirement processing (PIM-024, EWB-003).

- Document generation — COE, Service Record, NOSI, NOSA, PDS, certificates (PIM-010 to PIM-018).

_Why Separate: This is the core transactional HR dashboard and carries the heaviest data-entry surface. Isolating it from Payroll and Executive views enforces least-privilege and keeps the UI focused on HR operational tasks._

**D4. Payroll & Compensation Dashboard**

Users: Payroll officers, accounting liaison (Payroll Master profile of HR Admin role).

**Primary Use Cases:**

- Payroll generation for all 8 payroll types (PAY-001 to PAY-008).

- SSS / GSIS / PhilHealth / Pag-IBIG remittances (PAY-016).

- BIR Form 2316 generation and 1601-C / 1604-C filings (PAY-016).

- Loan deductions, mandatory deductions, and running balance management (PAY-009).

- Hazard pay, PERA / RATA computation per Section 10.6 (PAY-003).

- 13th month, Mid-Year Bonus, Year-End Bonus, Cash Gift, PBB per TRAIN Law (PAY-005).

- Tax computation per TRAIN Law annualized method (Section 10.6).

- Bank hash file generation per PCSO-designated banks (PAY-010).

_Why Separate: Payroll carries the highest financial and audit sensitivity in the system. The separation satisfies COA segregation-of-duties expectations, enforces distinct approval chains (workflow 12.2), and isolates BIR and DBM compliance surface from general HR transactions._

**D5. Executive / Leadership Dashboard**

Users: General Manager, Assistant General Managers, Board of Directors.

**Primary Use Cases:**

- High-level workforce analytics — headcount, distribution, composition.

- Headcount vs plantilla utilization (PIM-025, PIM-026).

- Attrition trends and retirement cliff forecasting (Innovation Layer 6.3).

- Budget utilization (Personnel Services) — actual vs approved.

- Gender-disaggregated data for GAD compliance (LAM-010).

- Strategic HR KPIs — time-to-fill, training ROI, promotion rates.

- Branch performance comparisons across NCL, STBR, Visayas, Mindanao.

_Why Separate: Executive users consume aggregated visualizations, not transactional records. This dashboard is read-only and contains no direct action affordances. Restricting executives to a purpose-built visualization layer reduces accidental data modification risk and simplifies audit scope._

**D6. Compliance & Audit Dashboard**

Users: Internal Audit, COA liaison, Legal Department, Data Protection Officer (DPO).

**Primary Use Cases:**

- COA audit trails — payroll registers, remittances, disbursement records.

- CSC compliance reports — PDS submission, SALN filing, performance cycles.

- Data Privacy Act logs — access logs, consent records, data export history (LOG-001).

- SALN tracking and submission compliance by unit and period (PIM-022).

- RA 6713 compliance and disciplinary case tracking.

- Whistleblower records and investigation history (read-only).

_Why Separate: Audit integrity requires that auditors have read access to everything but modification rights to nothing. Separating this dashboard enforces the read-only posture at the UI level and satisfies independence requirements for both internal and external (COA) audit personnel._

**D7. System Administrator Dashboard**

Users: PCSO IT / MIS team (Super Admin role).

**Primary Use Cases:**

- User provisioning and deprovisioning via Entra ID SSO (SEC-004).

- Role management — RBAC assignment and dashboard_profile assignment.

- System health monitoring — uptime, queue depth, database performance (PERF-002).

- Backup status and restore testing verification (INF-004).

- Integration monitoring — GSIS, BIR, DBM, Computerized Accounting System (API-007).

- Security logs, failed login bursts, off-hours admin actions (LOG-004, N-037).

- Configuration management — org profile, workflow designer, notification templates.

_Why Separate: This is the technical control plane. System Administrators manage the application; they do not manipulate HR records in the course of that work. The separation prevents IT staff from having incidental access to sensitive HR data while performing their technical duties — a requirement under RA 10173 (Data Privacy Act) and OWASP least-privilege guidance._

### 3.4.3 Dashboard-to-Role Mapping

The seven dashboards map onto the five RBAC roles defined in Section 11 via the dashboard_profile attribute. The matrix below summarizes default access posture per dashboard against five representative module groups (Employee data, Attendance, Payroll, Performance, Audit logs). Exact access levels are authoritative in Section 11.

| **Dashboard**               | **Underlying Role / Profile**          | **Employee Data** | **Attendance** | **Payroll**    | **Performance** | **Audit Logs** |
| --------------------------- | -------------------------------------- | ----------------- | -------------- | -------------- | --------------- | -------------- |
| Employee Self-Service (ESS) | Employee                               | Own               | Own            | Own            | Own             | None           |
| Supervisor / Manager        | Dept Head                              | Own Unit          | Own Unit       | Own Unit       | Approve         | None           |
| HR Administrator            | HR Admin / HR Staff                    | Full              | Full           | Full           | Full            | None           |
| Payroll & Compensation      | HR Admin (Payroll Master profile)      | Read              | Read           | Full (Payroll) | None            | None           |
| Executive / Leadership      | HR Admin (Executive read-only profile) | Read All          | Read All       | Read All       | Read All        | None           |
| Compliance & Audit          | HR Admin (Audit read-only profile)     | Read All          | Read All       | Read All       | Read All        | Read All       |
| System Administrator        | Super Admin                            | Full              | Full           | Full           | Full            | Full           |

### 3.4.4 Implementation Notes

- Dashboard selection happens after authentication based on dashboard_profile; if a user has no profile assigned, the system defaults to the dashboard associated with their RBAC role.

- All dashboards share common components (notification bell, language switch, profile menu) and a common shell — dashboard-specific modules are lazy-loaded.

- The Executive, Payroll, and Audit dashboards are distinct UI profiles atop the HR Admin role; switching profiles requires Super Admin action and is logged in the audit trail.

- Every dashboard must visibly display the user's role and current data scope (e.g., "HR Admin — All Units" or "Dept Head — Charity Sector") in the top bar to prevent scope-confusion errors.

- All dashboards are responsive-first and render correctly on tablets; ESS additionally must render on mobile phones (employees in field offices).

# 4. Functional Requirements

Each module includes current coverage status, a requirements table with Req. ID, description, priority, and delivery phase. Priority: Critical (compliance blocker), High (user-visible gap), Medium (self-service gap), Low (enhancement).

**P0 Platform Rebrand & Org Restructure — Prerequisite (MISSING)**

All Senate-specific identity must be removed before any other development proceeds. A single orgProfile settings record in the database shall be the only source of truth for agency identity across 20+ affected files, 9 PDF templates, 4 remittance action files, login UI, sidebar, metadata, and environment defaults.

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                 | **Priority** | **Phase** |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| P0-001      | Create orgProfile database table with fields: agencyName, agencyShortName, agencyAddress, logoUrl, philhealthEmployerNo, pagibigEmployerNo, gsisAgencyName, birAgencyName, contactEmail, contactPhone. All identity references in codebase point to this table. | Critical     | P0        |
| P0-002      | Replace all 9 PDF template author/header fields with orgProfile.agencyName. Affected: payslip, payroll-register, payroll-batch-payslips, ipcrf-form, opcrf-form, step-increment-notice, dtr-batch, leave-form-6, saln-form.                                     | Critical     | P0        |
| P0-003      | Replace Senate employer IDs in BIR, PhilHealth, Pag-IBIG, and GSIS action files with orgProfile lookups.                                                                                                                                                        | Critical     | P0        |
| P0-004      | Update app metadata (layout.tsx), login panel, sidebar title, NEXT_PUBLIC_APP_NAME env default to use orgProfile.                                                                                                                                               | Critical     | P0        |
| P0-005      | Restructure office hierarchy: Charity Sector, Management Services Sector, Branches (NCL, STBR, Visayas, Mindanao), Head Office. Remove Senate committee data.                                                                                                   | Critical     | P0        |
| P0-006      | Replace demo seed employee positions with PCSO-contextual titles from SSL V and CPCS schedules.                                                                                                                                                                 | Critical     | P0        |
| P0-007      | Delete /demo directory (44 screenshots and capture scripts). Must not appear in production deliverable.                                                                                                                                                         | Critical     | P0        |

**M1 File Maintenance (FM) — 55% Covered (PARTIAL)**

File Maintenance is the master reference for all data options across all 11 modules (TOR 1.1.56). Approximately 30 lookup tables are missing, blocking RPM, LDM, and PIMM development.

| **Req. ID** | **Requirement**                                                                                                                                                 | **Priority** | **Phase** |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| FM-001      | PCSO Offices/Sector: Charity Sector, Management Services Sector, Branches (NCL, STBR, Visayas, Mindanao). All employee org assignments reference this.          | Critical     | P1        |
| FM-002      | Philippine Regions and Provinces (all 17 regions, 82 provinces). Required for employee profiles, applicant portal, SALN.                                        | Critical     | P1        |
| FM-003      | Eligibility / License + Eligibility Category (First Level, Second Level, CES). Required for RPM qualification screening.                                        | Critical     | P1        |
| FM-004      | Education Attainment (Elementary, High School, College, Post-Graduate, Doctorate). Required for PDS and RPM screening.                                          | High         | P1        |
| FM-005      | Basic Education / Degree / Course (e.g., BSIT, BSCS, AB Economics). Required for PDS Section 3 and RPM qualification matching.                                  | High         | P1        |
| FM-006      | Ethnic Group (all 175 Filipino ethnolinguistic groups per NSO). Required for PDS.                                                                               | Medium       | P1        |
| FM-007      | Profession (Doctor, Lawyer, Accountant, Engineer, etc.). Required for L&D specialist training classification.                                                   | Medium       | P1        |
| FM-008      | Relationship (Son, Daughter, Spouse, Mother, Father, etc.). Required for PDS dependents section.                                                                | Medium       | P1        |
| FM-009      | Religion lookup. Required for PDS.                                                                                                                              | Low          | P1        |
| FM-010      | Training Institution (Government / Private) with institutional names. Required for LDM provider profiles.                                                       | High         | P1        |
| FM-011      | L&D Type (Technical, Managerial, Supervisory, Foundational, Scholarship). Required for LDM training catalog.                                                    | High         | P1        |
| FM-012      | Training and Seminar Program Title lookup. Required for LDM catalog and employee training history in PDS.                                                       | High         | P1        |
| FM-013      | Work Schedule: schedule code, schedule name, time-in, time-out, break start, break end, total hours, grace period minutes, applicable days. Required for TAM.   | Critical     | P1        |
| FM-014      | Work Suspension (Typhoon, Family Day, etc.): suspension type, applicable date, applicable hours (half/full). Required for DTR calendar.                         | High         | P1        |
| FM-015      | Competency Baseline Assessment (Core, Technical, Leadership) linked to position levels. Required for LDM TNA.                                                   | Medium       | P1        |
| FM-016      | CPCS Salary Schedule: Job Grade 1-33 × 8 step matrix. Required for non-SSL V GOCC employees.                                                                    | Critical     | P1        |
| FM-017      | Job Grade Category (CEO, Senior Management, Middle Management, Supervisory, Clerical, Technical). Maps to CPCS.                                                 | Critical     | P1        |
| FM-018      | Mode of Separation (Optional Retirement, Compulsory Retirement, Resignation, Dismissal, Death, Redundancy, Transfer).                                           | High         | P1        |
| FM-019      | Longevity milestones (10, 15, 20, 25, 30, 35, 40, 45 years). Required for EWBM loyalty award generation.                                                        | High         | P1        |
| FM-020      | Document Type and Document Type Category. Required for 201-file management.                                                                                     | High         | P1        |
| FM-021      | Document Request types and Request Status (Pending, Processing, Ready, Released, Disapproved, Cancelled).                                                       | High         | P1        |
| FM-022      | Employment Document Signatories: configurable per document type, supports multi-level signatory chains.                                                         | Critical     | P1        |
| FM-023      | Document Certifier configuration per document type. Required for COE and Service Record serial number issuance.                                                 | Critical     | P1        |
| FM-024      | Position Classification (Unique, Career, Non-Career) and Position Level (First Level, Second Level, CES).                                                       | High         | P1        |
| FM-025      | School lookup (SUCs, private HEIs). Required for PDS educational background.                                                                                    | Low          | P1        |
| FM-026      | Nature of Work (Government, Private). Required for PDS work experience.                                                                                         | Low          | P1        |
| FM-027      | Designation lookup (OIC-\[Position Title\], etc.). Distinct from Position — designations are acting/temporary.                                                  | High         | P1        |
| FM-028      | Courtesy title (Mr., Ms., Dr., Atty., Engr., Arch., etc.).                                                                                                      | Low          | P1        |
| FM-029      | Country lookup (all UN member states). Required for PDS foreign travel section.                                                                                 | Low          | P1        |
| FM-030      | Size lookup for ID and uniform requests (XS, S, M, L, XL, XXL, XXXL).                                                                                           | Low          | P2        |
| FM-031      | All FM records support: add, edit, deactivate (soft delete), search, view. Deactivated records remain linked to historical data — deactivation is not deletion. | Critical     | P1        |
| FM-032      | FM is the single source of truth for all module dropdowns. No module may maintain a duplicate lookup that shadows an FM table.                                  | Critical     | P1        |

**M2 Recruitment & Promotion Module (RPM) — 10% Covered (MISSING)**

Complete hiring lifecycle from MRF through appointment. Auto-provisions new employee across all modules on appointment issuance. Must begin development in Week 1 in parallel with Phase 1 work. Estimated: 3-4 weeks.

### 4.2.1 Manpower Request & Publication

| **Req. ID** | **Requirement**                                                                                                                                      | **Priority** | **Phase** |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| RPM-001     | MRF with digital signature routing. Signatory chain configurable via FM. Statuses: Draft, Submitted, Approved, Returned. PDF generation for posting. | Critical     | P5        |
| RPM-002     | CSC Form No. 9 (Publication of Vacant Position) generated from approved MRF data, including all required CSC fields.                                 | Critical     | P5        |
| RPM-003     | Duplicate detection for same vacant position item number across active publications.                                                                 | High         | P5        |
| RPM-004     | Upload CSC-received publication confirmation. Store against publication record.                                                                      | High         | P5        |
| RPM-005     | MRF feedback notifications to requestor on each HRD action.                                                                                          | Medium       | P5        |

### 4.2.2 Applicant Portal

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                           | **Priority** | **Phase** |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| RPM-006     | Public-facing applicant portal accessible without internal login. Applicants register with email verification. Separate from PCSO internal auth.                                                                                                                          | Critical     | P5        |
| RPM-007     | Portal lists all currently published vacant positions with full qualification standards from FM.                                                                                                                                                                          | Critical     | P5        |
| RPM-008     | Online application with all required fields: personal info, educational background, work experience, eligibility, trainings, references.                                                                                                                                  | Critical     | P5        |
| RPM-009     | Scanned document upload: transcript, eligibility cert, PDS, cover letter. File size ≤ 10MB per document. Types: PDF, JPG, PNG. Validation required.                                                                                                                       | Critical     | P5        |
| RPM-010     | Real-time application status for applicant: Incomplete, Submitted, Under Review, Qualified, Not Qualified, Shortlisted, For Exam, For Interview, Results Released.                                                                                                        | High         | P5        |
| RPM-011     | Initial qualification screening: auto-compare applicant profile against CSC qualification standards. Compute match score (Education %, Eligibility Match, Experience Years vs Required). Display score to HRD reviewer. Score is advisory — HRD overrides final decision. | High         | P5        |
| RPM-012     | Notify disqualified applicants via email and portal with specific disqualification reason.                                                                                                                                                                                | High         | P5        |

### 4.2.3 Selection Process

| **Req. ID** | **Requirement**                                                                                                                                                      | **Priority** | **Phase** |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| RPM-013     | Generate Assessment Form listing all qualified applicants per position for HRD review. Printable PDF.                                                                | Critical     | P5        |
| RPM-014     | Exam scheduling: HRD sets date/time/venue. System notifies applicants via email and portal.                                                                          | High         | P5        |
| RPM-015     | Encode assessment ratings per qualification standard dimension: written exam score, interview rating, PE score, other criteria. Configurable weighting per position. | Critical     | P5        |
| RPM-016     | Notify applicants of exam results.                                                                                                                                   | High         | P5        |
| RPM-017     | Rating Sheet per position showing all applicants and scores in ranked order.                                                                                         | Critical     | P5        |
| RPM-018     | Summary of Ratings report ranked by total weighted score.                                                                                                            | Critical     | P5        |
| RPM-019     | Top 5 applicants list for General Manager. Auto-filtered by rank.                                                                                                    | Critical     | P5        |
| RPM-020     | Recommended applicants list for Board confirmation.                                                                                                                  | Critical     | P5        |
| RPM-021     | Notify applicants of interview schedule, and final results.                                                                                                          | High         | P5        |

### 4.2.4 Appointment & Auto-Provisioning

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                                                                                     | **Priority** | **Phase** |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| RPM-022     | Generate CSC Appointment, Position Description Form, Oath of Office, Assumption to Duty, and ATAF as PDF with configurable signatory slots. All fields auto-populated from applicant and position data.                                                                                                                             | Critical     | P5        |
| RPM-023     | On appointment issuance: atomically create employee record (201 file), plantilla entry, payroll profile, leave ledger (with opening balance if migrating), and attendance schedule. This single transaction is the source trigger for all new employee provisioning. If any sub-operation fails, entire appointment is rolled back. | Critical     | P5        |
| RPM-024     | Allow creation and update of employee profile from RPM, subject to HRD approval workflow.                                                                                                                                                                                                                                           | Critical     | P5        |
| RPM-025     | Generate ad hoc RPM reports per HRD templates.                                                                                                                                                                                                                                                                                      | Medium       | P5        |

**M3 Personnel Information Management (PIMM) — 50% Covered (PARTIAL)**

### 4.3.1 Employee 201 File

| **Req. ID** | **Requirement**                                                                                                                                                                                                   | **Priority** | **Phase** |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| PIM-001     | 201 file captures all TOR 1.3.1 fields: personal info, government IDs, employment details, educational background, eligibility, trainings, employment history, all document categories (Organic and Non-Organic). | Critical     | P2        |
| PIM-002     | Search employee by name (partial match) or employee number. Real-time filtering with debounce.                                                                                                                    | Critical     | Existing  |
| PIM-003     | List Organic (Permanent, Co-terminus, Temporary, CTI) and Non-Organic (Consultant, Confidential Agent, JO) employees separately.                                                                                  | Critical     | Existing  |
| PIM-004     | Employee and authorized HR staff may upload scanned documents to 201 file. All uploads go to staging. HRD validates before committing. Rejected uploads do not partially commit.                                  | High         | P2        |
| PIM-005     | Document request lifecycle tracking: Received → In Process → Ready → Released. Timestamps and processor logged at each step. Email notification to employee at each stage.                                        | High         | P2        |
| PIM-006     | Reports on employees with active reassignments, designations, and special orders including full transaction history.                                                                                              | High         | P2        |
| PIM-007     | HR staff accomplishment reports: number of service records processed, COEs issued, PDS updated, per period.                                                                                                       | Medium       | P2        |
| PIM-008     | Approving authority configuration by HR Administrators, no code changes required.                                                                                                                                 | High         | P2        |
| PIM-009     | Archived data per NAP guidelines: hire/separation dates, increments, bonuses, commendations, allowances. Soft-delete only — no permanent deletion of personnel records.                                           | High         | P2        |

### 4.3.2 Document Generators

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                                                                       | **Priority** | **Phase** |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| PIM-010     | Certificate of Employment (COE): system-generated serial number (COE-YYYY-NNNNNN), PCSO letterhead, employee name, position, period of employment, civil status, salary (optional field). Signatory configurable via FM.                                                                                              | Critical     | P2        |
| PIM-011     | COE with Remunerations: same as COE plus current monthly salary, allowances, and standard deductions pulled from latest payroll record. Separate serial sequence (COER-YYYY-NNNNNN).                                                                                                                                  | Critical     | P2        |
| PIM-012     | Service Record: full chronological employment history, all positions held, salary per appointment, leave without pay periods, step increments, designations. Serial number (SR-YYYY-NNNNNN).                                                                                                                          | Critical     | P2        |
| PIM-013     | Personal Data Sheet (CS Form 212): all 4 pages of official CSC format. Auto-populated from 201 file data. Editable by employee via portal subject to HRD approval. Section 31 (Skills/Hobbies) feeds EWBM wellness module.                                                                                            | Critical     | P2        |
| PIM-014     | NOSI (Notice of Salary Step Increment): serial number (NOSI-YYYY-NNNNNN). Auto-update 201 file salary field and step record upon issuance. Existing generator — add serial number and 201 auto-update.                                                                                                                | Critical     | P2        |
| PIM-015     | NOSA (Notice of Salary Adjustment): serial number (NOSA-YYYY-NNNNNN). Triggered by approved salary adjustment in Payroll. Auto-update 201 file salary field upon issuance.                                                                                                                                            | Critical     | P2        |
| PIM-016     | Centralized serial number system: one auto-increment sequence per document type, stored in a dedicated serial_sequences table (document_type, year, last_sequence). Sequences never reset or gap within a year. All issuances logged in serial_issuances audit table.                                                 | Critical     | P2        |
| PIM-017     | QR-code embedded in all generated PDFs. QR encodes a signed JWT (HS256, 5-year expiry) containing: document_type, serial_number, employee_id_hash, issued_at, issued_by. QR resolves to /verify/\[token\] public read-only endpoint confirming authenticity without exposing PII beyond what the document face shows. | High         | P4        |
| PIM-018     | Ad hoc certificate generator: HRD provides template with field placeholders, system substitutes from employee 201 data.                                                                                                                                                                                               | Medium       | P2        |

### 4.3.3 Workforce Reports

| **Req. ID** | **Requirement**                                                                                                                                                                                            | **Priority** | **Phase** |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| PIM-019     | Retirement eligibility list: optional (age ≥ 60 AND ≥ 15 years service) and compulsory (age ≥ 65). Filterable by office/sector/department/branch and date range. Includes months remaining to eligibility. | Critical     | P2        |
| PIM-020     | Loyalty award eligibility list: 10/15/20/25/30/35/40/45 year milestones. Based on hire date + current date. Filterable by unit.                                                                            | High         | P2        |
| PIM-021     | Step increment eligibility report (3-year CSC rule). Existing — validate formula alignment with Section 10.5.                                                                                              | High         | Existing  |
| PIM-022     | SALN submission tracking: submitted / not submitted per employee, by period, with tagging. Existing.                                                                                                       | High         | Existing  |
| PIM-023     | PDS submission tracking: submitted / not submitted, tagging functionality. New requirement.                                                                                                                | High         | P2        |
| PIM-024     | Office clearance processing list with tagging.                                                                                                                                                             | Medium       | P2        |
| PIM-025     | PCSO Plantilla Report (filled/unfilled/vacant). Existing.                                                                                                                                                  | High         | Existing  |
| PIM-026     | Personnel Complement reports. Existing.                                                                                                                                                                    | High         | Existing  |
| PIM-027     | Employee qualification reports: education, eligibility, trainings, experience. Filterable by unit.                                                                                                         | High         | P2        |
| PIM-028     | Ad hoc reports per HRD templates.                                                                                                                                                                          | Medium       | P2        |

**M4 Leave Administration Module (LAM) — 75% Covered (PARTIAL)**

Computation formulas for this module are fully specified in Section 10. All leave deduction logic must comply with CSC Omnibus Rules on Leave.

| **Req. ID** | **Requirement**                                                                                                                                                                                      | **Priority** | **Phase** |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| LAM-001     | Bulk upload of existing leave ledgers via CSV/Excel with field mapping UI. Validation preview before commit. Duplicate detection on employee ID + leave type + period.                               | Critical     | P3        |
| LAM-002     | Monthly leave credit accrual: auto-job runs on 1st of each month. Accrual formula: see Section 10.1. Log each accrual entry with reference to accrual_run ID.                                        | Critical     | Existing  |
| LAM-003     | Auto-deduct leave credits on leave application approval. Deduction logged with application reference ID and approver ID.                                                                             | Critical     | Existing  |
| LAM-004     | CSC Omnibus Rules leave computation: fractional day rules, half-day leave, LWOP. See Section 10.1 for formulas.                                                                                      | Critical     | Existing  |
| LAM-005     | LWOP list generation with employee, department, date range filters.                                                                                                                                  | High         | Existing  |
| LAM-006     | Auto-approval of sick leave if approver does not act within configurable timeout (default: 5 business days). System generates auto-approval audit log entry. Notify employee of auto-approval.       | Critical     | P3        |
| LAM-007     | Cancellation of approved leave (vacation, forced, special privilege). Employee requests cancellation → approver confirms → credits restored → audit logged.                                          | High         | Existing  |
| LAM-008     | Attachment upload for leaves requiring supporting documents (Medical Certificate, etc.). Files stored in Supabase Storage.                                                                           | High         | Existing  |
| LAM-009     | Year-end auto-deduction of unused forced leave. Scheduled job: December 31 at 23:55. Configurable per leave type. Generates audit entry per deduction.                                               | Critical     | P3        |
| LAM-010     | Leave reports: ledger per employee, balance, disapproved applications, LWOP by period, total applications, sex-disaggregated data, by leave type. All filterable by office/sector/department/branch. | High         | Existing  |
| LAM-011     | LWOP and No Filed Leave (NFL) notifications to employee and payroll section for salary deduction processing.                                                                                         | High         | P3        |
| LAM-012     | View Application for Leave (CSC Form 6) per employee. PDF output. Existing.                                                                                                                          | High         | Existing  |
| LAM-013     | Manual leave encoding and balance adjustment by HR Admin with approval workflow and audit trail.                                                                                                     | High         | Existing  |
| LAM-014     | Ad hoc leave reports per HRD templates.                                                                                                                                                              | Medium       | P3        |

**M5 Time & Attendance Module (TAM) — 60% Covered (PARTIAL)**

Computation formulas for overtime and tardiness are specified in Section 10.2 and 10.3.

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                                                         | **Priority** | **Phase** |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| TAM-001     | Shift schedule configuration UI: fixed shifts (weekly/monthly), flexible/gapped hours, date-range-specific schedules. Assign to individual employees or office groups. Each schedule stores: time_in, time_out, break_start, break_end, total_hours, applicable_days_of_week\[\], grace_period_minutes. | Critical     | P3        |
| TAM-002     | Grace period configuration per office or per shift schedule type. Tardiness computed only after grace period expires.                                                                                                                                                                                   | High         | P3        |
| TAM-003     | Lunch break tracking per work schedule. For schedules with a defined break window: record time-out for lunch, time-in on return. Undertime applies if return is late.                                                                                                                                   | High         | P3        |
| TAM-004     | Biometric BFR device integration via API: real-time push (webhook from device), scheduled pull (polling interval configurable), and manual trigger (authorized user action). Accept: CSV, JSON, XML raw exports from device vendor. CSV import path retained as guaranteed fallback.                    | Critical     | P3        |
| TAM-005     | Match raw TITO records to employees via employee/badge ID. Apply applicable shift schedule and holiday calendar. Flag unmatched records for HR review.                                                                                                                                                  | Critical     | P3        |
| TAM-006     | OT computation per CSC rules. See Section 10.2.                                                                                                                                                                                                                                                         | High         | Existing  |
| TAM-007     | DTR reports with embedded calendar: working days, legal holidays, declared holidays, non-working days, suspended days, filed leaves. Per employee and batch.                                                                                                                                            | Critical     | Existing  |
| TAM-008     | CSC Form 48 (Monthly Summary) generation. Existing.                                                                                                                                                                                                                                                     | Critical     | Existing  |
| TAM-009     | Attendance analytics reports: absences, tardiness/undertime, OT, perfect attendance, summary, tabulation. All filterable by branch/department/division/status/position.                                                                                                                                 | High         | Existing  |
| TAM-010     | Employee notification on tardiness instances and unauthorized absences. Threshold-based (e.g., flag after 3 consecutive absences without leave).                                                                                                                                                        | Medium       | P3        |
| TAM-011     | Management dashboards per TOR 1.5.15: Division Chiefs, Branch Managers, Department Managers, AGMs, GM — each sees KPIs scoped to their organizational unit.                                                                                                                                             | High         | P3        |
| TAM-012     | Ad hoc TAM reports per HRD templates.                                                                                                                                                                                                                                                                   | Medium       | P3        |

**M6 Learning & Development Module (LDM) — 5% Covered (MISSING)**

This module is entirely absent. Must begin development in Week 1 (Track B) in parallel with RPM. Estimated: 2-3 weeks.

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                                                                  | **Priority** | **Phase** |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| LDM-001     | Training program catalog: encode standard, specialized, and mandatory programs. Classify by L&D Type (FM), target audience (all/supervisors/managers/rank-and-file/specialists by profession). Each program record: title, type, objectives, target audience\[\], mandatory flag, required training_institution. | Critical     | P7        |
| LDM-002     | Per training program: budget, participant count, duration (days), requirements checklist\[\], learning objectives. All fields required before scheduling.                                                                                                                                                        | High         | P7        |
| LDM-003     | Training provider profiles: company name, accreditation, contact info, trainers/resource persons\[\], programs_offered\[\] linked to catalog.                                                                                                                                                                    | High         | P7        |
| LDM-004     | Automated training schedule generator based on program requirements, provider availability, and participant target count. Produces a proposed schedule for HRD review before finalization.                                                                                                                       | High         | P7        |
| LDM-005     | Automated cost computation per training run: (per-participant cost × headcount) + venue + facilitator fees. Generates budget summary PDF.                                                                                                                                                                        | High         | P7        |
| LDM-006     | Candidate classification per training: eligibility criteria — position level, department, competency_gap_tag, mandatory_status.                                                                                                                                                                                  | High         | P7        |
| LDM-007     | Mandatory training compliance: list employees required for each mandatory program. Flag employees who have not completed mandatory training within the current year. Exportable to Excel.                                                                                                                        | Critical     | P7        |
| LDM-008     | Training schedule approval workflow: multi-level, configurable via FM signatory chains. Statuses: Draft, For Approval, Approved, Cancelled. See Section 12 for state machine.                                                                                                                                    | Critical     | P7        |
| LDM-009     | Approved participant list per training run. Exportable, printable.                                                                                                                                                                                                                                               | High         | P7        |
| LDM-010     | Certificate of Training (CT) for participants. Serial number (CT-YYYY-NNNNNN) from centralized serial system. QR verification. PDF output.                                                                                                                                                                       | Critical     | P7        |
| LDM-011     | Yearly training expense reports: total spend, per-program, per-department, per-L&D-type. Exportable.                                                                                                                                                                                                             | High         | P7        |
| LDM-012     | Employee competency baseline assessment recording: Core/Technical/Leadership per FM Competency lookup. Track assessment date, assessor, and score.                                                                                                                                                               | High         | P7        |
| LDM-013     | TNA workflow: compare employee competency scores against position requirements. Identify gaps. Auto-suggest training program assignments based on gap tags.                                                                                                                                                      | High         | P7        |
| LDM-014     | Employee Portal: view scheduled trainings, confirm attendance, view training history and download certificates.                                                                                                                                                                                                  | Medium       | P7        |
| LDM-015     | Ad hoc LDM reports per HRD templates.                                                                                                                                                                                                                                                                            | Medium       | P7        |

**M7 Performance Management Module (PMM) — 70% Covered (PARTIAL)**

| **Req. ID** | **Requirement**                                                                                                                                                          | **Priority** | **Phase** |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | --------- |
| PMM-001     | IPCRF: planning, monitoring, and review phases. Numeric (1.00-5.00) and adjectival ratings. Existing and functional.                                                     | Critical     | Existing  |
| PMM-002     | OPCRF: office-level rating. Existing.                                                                                                                                    | Critical     | Existing  |
| PMM-003     | DPCR (Division Performance Commitment Review): division-level ratings. Signatory chains distinct from IPCRF. Rolls up to OPCRF.                                          | Critical     | P6        |
| PMM-004     | BPCR (Branch Performance Commitment Review): for NCL, STBR, Visayas, Mindanao. Same structure as DPCR but scoped to branch.                                              | Critical     | P6        |
| PMM-005     | Scanned document upload and storage for OPCRF, DPCR, BPCR, IPCRF per cycle per unit. File linked to performance_cycle_id + employee_id/unit_id.                          | High         | P6        |
| PMM-006     | Forced Ranking Percentage report: configurable distribution — Outstanding ≤ 10%, Very Satisfactory ≤ 25% of rated population. System flags violations. See Section 10.4. | High         | P6        |
| PMM-007     | PBB-qualified list: auto-generated per criteria — rating ≥ Satisfactory, no pending admin case, no AWOL in period, other configurable gates. Exportable for submission.  | Critical     | P6        |
| PMM-008     | Performance cycle management: create, open, close cycles by year/semester. HRD-controlled.                                                                               | High         | Existing  |
| PMM-009     | Step increment eligibility report per CSC 3-year rule. Existing — validate against Section 10.5 formula.                                                                 | High         | Existing  |
| PMM-010     | Ad hoc PMM reports per HRD templates.                                                                                                                                    | Medium       | P6        |

**M8 Payroll Module (PM) — 60% Covered (PARTIAL)**

Mandatory deduction formulas are specified in Section 10.6 (BIR), 10.7 (GSIS), 10.8 (PhilHealth), 10.9 (Pag-IBIG). Payroll computation must use these formulas exactly.

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                                                                                     | **Priority** | **Phase** |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| PAY-001     | General Payroll (15th and 30th) with full mandatory deduction computation. Existing.                                                                                                                                                                                                                                                | Critical     | Existing  |
| PAY-002     | JO/COS Payroll: separate run for non-organic personnel. Existing.                                                                                                                                                                                                                                                                   | Critical     | Existing  |
| PAY-003     | RATA Payroll: eligible positions configurable. RATA is non-taxable per BIR rules up to the prescribed ceiling (currently PHP 35,000/month). Tax treatment: only the excess over ceiling is taxable.                                                                                                                                 | Critical     | P4        |
| PAY-004     | Cash Advance Payroll: encode request and issuance. Deduction schedule linked to loan ledger module. Running balance updated per deduction.                                                                                                                                                                                          | Critical     | P4        |
| PAY-005     | Benefits and Bonuses Payroll: Mid-Year Bonus (1 month basic), Year-End Bonus (1 month basic), Cash Gift (PHP 5,000). PBB (per approved PBB list from PMM). Tax treatment per BIR de minimis rules. Ceiling: PHP 90,000 total tax-exempt bonuses per year (TRAIN Law).                                                               | Critical     | P4        |
| PAY-006     | Salary Differential Payroll: retroactive pay adjustments. Period range selectable. Computed as (new rate - old rate) × applicable months. Subject to BIR withholding on the differential amount.                                                                                                                                    | Critical     | P4        |
| PAY-007     | Special Payroll with title configurable by Payroll Master per run. No mandatory deductions unless configured by Payroll Master.                                                                                                                                                                                                     | High         | P4        |
| PAY-008     | Magna Carta Benefits Payroll: Women (RA 9710) and PWD employees (RA 7277). Per applicable law provisions.                                                                                                                                                                                                                           | High         | P4        |
| PAY-009     | Loan ledger: principal, start date, end date, deduction_schedule (semi-monthly/monthly), deduction_amount, remarks, running_balance. Employee portal shows current balance and amortization schedule. Loans: GSIS personal loan, policy loan, emergency loan, multi-purpose loan; Pag-IBIG multi-purpose loan; PCSO in-house loans. | Critical     | P4        |
| PAY-010     | Bank hash file / CSV per PCSO-designated banks. Format: bank_account_no, employee_name, net_pay_amount, payroll_period. Column mapping configurable by Payroll Master per bank requirement.                                                                                                                                         | Critical     | P4        |
| PAY-011     | Salary update/adjustment: approval-gated. Triggers NOSA generation on approval. Auto-updates 201 file salary field.                                                                                                                                                                                                                 | Critical     | P4        |
| PAY-012     | Payroll register, summary, and payslip — all payroll types. Existing for General; extend.                                                                                                                                                                                                                                           | Critical     | P4        |
| PAY-013     | Tag employees for inclusion/exclusion per payroll run. Existing.                                                                                                                                                                                                                                                                    | High         | Existing  |
| PAY-014     | CSV/Excel income and deductions bulk upload. Existing.                                                                                                                                                                                                                                                                              | High         | Existing  |
| PAY-015     | API output endpoint for PCSO Computerized Accounting System: JSON/CSV export of payroll journal entries per period (debit: Personnel Services, credit: Due to BIR/GSIS/PhilHealth/Pag-IBIG/Cash). Format to be confirmed with PCSO Accounting.                                                                                      | Critical     | P10       |
| PAY-016     | All remittances (BIR 1601-C, 2316, 1604-C; PhilHealth RF-1; Pag-IBIG; GSIS) with CSV/XLSX export. Existing.                                                                                                                                                                                                                         | Critical     | Existing  |
| PAY-017     | Ad hoc payroll reports per HRD templates.                                                                                                                                                                                                                                                                                           | Medium       | P4        |

**M9 Employee Portal Module (EPM) — 45% Covered (PARTIAL)**

| **Req. ID** | **Requirement**                                                                                                                                                                                     | **Priority** | **Phase** |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| EPM-001     | Employee access to: payslips (all types), leave balances and ledger, DTR, 201 file documents, loan ledger and amortization. Existing for payslip/leave/DTR; extend for loans and new payroll types. | Critical     | P8        |
| EPM-002     | Access to scheduled trainings, confirmed participant lists, and downloadable training certificates.                                                                                                 | High         | P8        |
| EPM-003     | Memorandum Orders and Circulars: HR posts, employees view and acknowledge. Acknowledgement logged with timestamp.                                                                                   | Medium       | P8        |
| EPM-004     | Online leave application with attachments. Existing.                                                                                                                                                | Critical     | Existing  |
| EPM-005     | Online cancellation of approved leave. Existing.                                                                                                                                                    | High         | Existing  |
| EPM-006     | Online OT request with attachments. Existing.                                                                                                                                                       | High         | Existing  |
| EPM-007     | Work schedule/shift change request: employee submits reason and preferred schedule, supervisor approves, HR commits change.                                                                         | High         | P8        |
| EPM-008     | DTR correction request: employee submits for OB, pass-out, or special cases with supporting documents. Supervisor approves. HR Admin commits to DTR. Correction history logged.                     | High         | P8        |
| EPM-009     | 201 file document self-upload: employee uploads scan, goes to HRD staging queue. HRD validates and commits or rejects with reason.                                                                  | High         | P8        |
| EPM-010     | HR certification request queue: employee selects document type → HR processes → employee notified when ready → employee downloads PDF. Turnaround target: 3 working days (configurable).            | Critical     | P8        |
| EPM-011     | Personnel movement requests: reassignment, transfer, resignation, optional retirement. Multi-step workflow. See Section 12.5.                                                                       | High         | P8        |
| EPM-012     | PDS online update: employee submits proposed changes to PDS sections, HRD approves before committing. Section 31 updates propagate to EWBM wellness module.                                         | High         | P8        |
| EPM-013     | ID replacement/update/new issuance request: employee submits with size (FM lookup) and reason. HR processes offline; system tracks request status.                                                  | Medium       | P8        |
| EPM-014     | Online promotion application: pre-fills from employee 201 data, submits to RPM module applicant pipeline.                                                                                           | High         | P8        |
| EPM-015     | Official HR forms download: PDS, Office Clearance, SALN, PES Form, Pass-Out Slip, OB Form. Existing.                                                                                                | High         | Existing  |
| EPM-016     | Notification center: pending actions, approval decisions, HR announcements, compliance reminders. Existing.                                                                                         | High         | Existing  |

**M10 Employee Welfare & Benefits / PRAISE (EWBM) — 0% Covered (MISSING)**

| **Req. ID** | **Requirement**                                                                                                                                                                                                                                                                          | **Priority** | **Phase** |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| EWB-001     | Auto-generate loyalty award eligibility list for milestones: 10, 15, 20, 25, 30, 35, 40, 45 years. Base calculation: current_date - hire_date. Results cross-referenced with Longevity FM table. Filterable by office/sector/department/branch. Exportable for awards ceremony planning. | Critical     | P9        |
| EWB-002     | Historical awardees report per milestone year. Tracks previous award grants to prevent duplicate awarding.                                                                                                                                                                               | High         | P9        |
| EWB-003     | Annual retirement notification: list employees reaching optional (age 60 + 15 years service) or compulsory retirement (age 65) within the next 12 months. Sent to HRD as email and in-app notification on January 1 of each year.                                                        | Critical     | P9        |
| EWB-004     | Advance PRAISE incentive notification to Payroll Section: sent 30 days before payroll processing period for eligible employees.                                                                                                                                                          | Critical     | P9        |
| EWB-005     | Wellness report: extract PDS Section 31 (Special Skills and Hobbies) data, aggregate by office/department. Generate report for wellness program planning. Updated when PDS Section 31 is updated via EPM portal.                                                                         | Medium       | P9        |

# 5. Technical Requirements

## 5.1 Operating Environment

| **Req. ID** | **Requirement**                                                                                                                                                                                                            | **Priority** | **Phase** |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| INF-001     | Support both on-premises and cloud-based environments (DICT Cloud-First Policy).                                                                                                                                           | Critical     | P10       |
| INF-002     | Docker deployment: Dockerfile + docker-compose.yml delivered as part of deployment package. System must start with docker-compose up.                                                                                      | Critical     | P10       |
| INF-003     | Database: PostgreSQL via Supabase with written equivalency justification for MS SQL Server requirement (ACID-compliant, ISO 9075, HA, replication, automated backup). Supabase Pro/Enterprise tier minimum for production. | Critical     | Existing  |
| INF-004     | Redundant and failover infrastructure: Supabase HA replication documented in deployment guide.                                                                                                                             | Critical     | P10       |
| INF-005     | RBAC with minimum 5 roles: Super Admin, HR Admin, HR Staff, Department Head/Approver, Employee. See Section 11 for permission matrix.                                                                                      | Critical     | Existing  |
| INF-006     | Email notifications via SMTP for all transactional events. See Section 13 for notification matrix.                                                                                                                         | High         | Existing  |
| INF-007     | All data migration uses open formats (CSV, XML, JSON) with complete field mapping documentation.                                                                                                                           | Critical     | P11       |

## 5.2 Security

| **Req. ID** | **Requirement**                                                                                                                                                  | **Priority** | **Phase** |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| SEC-001     | HTTPS only. TLS 1.3. HTTP redirects to HTTPS. Existing.                                                                                                          | Critical     | Existing  |
| SEC-002     | AES-256 encryption at rest (Supabase). TLS 1.3 in transit. Existing.                                                                                             | Critical     | Existing  |
| SEC-003     | MFA via TOTP (authenticator app). Mandatory for Super Admin and HR Admin roles. Optional (strongly recommended) for others. Enforce via Supabase Auth MFA.       | Critical     | P10       |
| SEC-004     | Entra ID SAML 2.0 SSO: Supabase SAML provider configured with PCSO Entra ID as Identity Provider. Fallback to password auth for users without Entra ID accounts. | Critical     | P10       |
| SEC-005     | All DB queries via Drizzle ORM parameterized. No raw string SQL. Existing.                                                                                       | Critical     | Existing  |
| SEC-006     | Zod validation on all form inputs and server actions. Output encoding vs XSS. Existing.                                                                          | Critical     | Existing  |
| SEC-007     | Content Security Policy (CSP) headers. Disable XXE processing. Existing headers — add CSP.                                                                       | High         | P10       |
| SEC-008     | Principle of Least Privilege enforced per role. See Section 11.                                                                                                  | Critical     | Existing  |
| SEC-009     | SCA tool in CI/CD pipeline to identify vulnerable third-party dependencies.                                                                                      | High         | P10       |
| SEC-010     | Upload ALL-or-NOTHING: partial uploads must not partially commit. Validation before any DB write.                                                                | Critical     | P10       |

## 5.3 API

| **Req. ID** | **Requirement**                                                                                                                       | **Priority** | **Phase** |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| API-001     | Public REST API with OAuth 2.0. Also support API key/token auth for system integrations.                                              | Critical     | P10       |
| API-002     | RESTful CRUD endpoints. Naming: /api/v1/{resource}/{id}. Consistent conventions.                                                      | Critical     | P10       |
| API-003     | Batch operation endpoints for bulk reads and writes.                                                                                  | High         | P10       |
| API-004     | RFC 7807 standard error responses throughout.                                                                                         | High         | P10       |
| API-005     | Rate limiting per endpoint and per API key. Configurable.                                                                             | Critical     | P10       |
| API-006     | Async job queue for long-running operations (payroll, bulk exports, report generation).                                               | High         | P10       |
| API-007     | PCSO Computerized Accounting System integration: journal entry export endpoint (JSON/CSV/XML). Format confirmed with PCSO Accounting. | Critical     | P10       |
| API-008     | CSC system integration readiness: expose endpoints conformant with CSC-prescribed specs when published.                               | High         | P10       |

## 5.4 Logging

| **Req. ID** | **Requirement**                                                                                                                                                                               | **Priority** | **Phase** |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| LOG-001     | Audit Log: timestamp, IP, user/entity, action, object, outcome, reason, module, sub-module, severity, alert flag. Existing.                                                                   | Critical     | Existing  |
| LOG-002     | Error Log: timestamp, level, code, message, source, stack trace, affected data, environment info, user/session info.                                                                          | High         | P10       |
| LOG-003     | Transaction Log: transaction_id, timestamp, user/entity, affected data, details, status, source, destination, error info, duration_ms, size_bytes. Upgrade from current basic implementation. | Critical     | P10       |
| LOG-004     | Real-time security event monitoring and alerting: failed login bursts, unusual export volumes, off-hours admin actions.                                                                       | High         | P10       |
| LOG-005     | Sentry (or equivalent) for real-time exception tracking with alerts to system administrators.                                                                                                 | High         | P10       |

## 5.5 Performance

| **Req. ID** | **Requirement**                                                                                                            | **Priority** | **Phase** |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| PERF-001    | 900+ concurrent users at \< 3 second average response time. Load test documentation required before production deployment. | Critical     | P10       |
| PERF-002    | Database: 5,000 TPS minimum throughput. Supabase Pro/Enterprise required at production scale.                              | Critical     | P10       |
| PERF-003    | All report generation \> 5 seconds must use async job queue with progress indicator and email/notification on completion.  | High         | P10       |

## 5.6 Client & Digital Signatures

| **Req. ID** | **Requirement**                                                                                                                                                                       | **Priority** | **Phase** |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| CLI-001     | All major browsers: Chrome, Edge, Firefox, Opera, Safari. Last 2 major releases.                                                                                                      | Critical     | Existing  |
| CLI-002     | Configurable workflow designer page for HR processes: leave approval chains, payroll signatory order, document routing. No-code configuration.                                        | High         | P10       |
| CLI-003     | Digital signature integration: support PCSO's existing PKI solution; if absent, implement PAdES-compatible signing via pdf-lib + WebCrypto. Signature slot on all approval documents. | Critical     | P10       |
| CLI-004     | Standardized upload templates for all bulk imports (CSV, Excel with field mapping documentation).                                                                                     | High         | P3        |
| CLI-005     | All bulk uploads go through staging/preview before database commit.                                                                                                                   | Critical     | P3        |

# 6. Innovation Layer — Beyond TOR Compliance

These features are additive and do not risk core TOR compliance if descoped. They position the PCSO HRS as the most advanced government HR platform in the Philippines.

## 6.1 QR-Verified Document Authenticity

Every generated PDF (COE, Service Record, NOSI, NOSA, CT, etc.) embeds a QR code containing a signed JWT. The QR resolves to a public read-only verification portal confirming authenticity, date issued, and issuing officer — without exposing PII beyond what the document face shows. Directly addresses document fraud in Philippine government HR.

## 6.2 AI-Powered HR Policy Assistant

A context-aware assistant trained on CSC Omnibus Rules, GSIS Act, BIR withholding rules, and PCSO HR policies. HR staff and employees ask natural-language questions and receive cited, policy-grounded answers. Eliminates the most common HR bottleneck: policy interpretation delays that stall leave approvals, payroll corrections, and disciplinary proceedings.

## 6.3 Predictive Workforce Intelligence Dashboard

Executive dashboard for GM and AGMs surfacing: attrition risk scores per employee (step-increment stagnation + performance trend + tenure), retirement cliff forecasting by department over 3-year horizon, succession gap identification (positions with no qualified internal candidates), and training ROI metrics. No equivalent capability exists in any currently deployed Philippine government HRIS.

## 6.4 Unified HR Compliance Calendar

System-generated calendar auto-populating all HR deadlines per employee and unit: SALN filing windows, PDS submission deadlines, performance evaluation periods, mandatory training due dates, remittance schedules, loyalty award review dates. Delivered as in-system calendar and email digest.

## 6.5 Smart Recruitment Pre-Screening

When an application arrives via the portal, the system auto-compares the applicant against CSC qualification standards and computes a match score across 4 dimensions: Education Match, Eligibility Match, Experience Years vs Required, Training Match. HRD sees the score before manual review. Built on deterministic rules — fully auditable and COA-defensible.

# 7. Supplier Deliverables

All deliverables in TOR Section 3.7 are required for contract acceptance. VA/PenTest must be contracted by Week 2 of development to avoid timeline risk.

| **TOR Ref.** | **Deliverable**                                                                                                                   | **Format** | **Due**        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| 3.7.1        | Data Dictionary: all entities, attributes, data types, sizes, formats, allowable values, validation rules, relationships, source. | Word/PDF   | Phase 11       |
| 3.7.2        | UML Diagrams (10): Architecture, DFD, Use Case, Class, Sequence, Activity, State, Deployment, ERD, Component.                     | PDF        | Phase 11       |
| 3.7.3        | System Manuals (6): Participation, Trainer, Train-the-Trainer, Operations, Technical, Evaluation.                                 | Word/PDF   | Phase 11       |
| 3.7.4        | GUI Field-to-Database Mapping: all screens mapped to source tables, stored procs, and DB components.                              | Word/PDF   | Phase 11       |
| 3.7.5        | Vulnerability Assessment Report — DICT-accredited provider, final production version.                                             | PDF        | Phase 10       |
| 3.7.6        | Penetration Testing Report — DICT-accredited provider, final production version.                                                  | PDF        | Phase 10       |
| 3.7.7        | Software Composition Analysis report: third-party component vulnerabilities identified and mitigated.                             | PDF        | Phase 10       |
| 3.7.10       | Unlimited perpetual licenses for all software components.                                                                         | Legal      | Contract Award |
| 3.7.11       | Training plan: all PCSO employees, technical and non-technical, at 5 locations.                                                   | Word/PDF   | Phase 11       |
| 3.7.12       | DB offload scripts by date range, exportable to portable media.                                                                   | SQL        | Phase 11       |
| 3.9.1        | In-person training at: Head Office, NCL, STBR, Visayas, Mindanao.                                                                 | On-site    | Month 4        |
| 3.9.2        | System delivery within 3 months NTP. Production deployment by Month 4.                                                            | Deployed   | Month 4        |

# 8. Delivery Roadmap

Eleven phases. Phases 5 and 7 must begin in Week 1 in parallel with Phases 0 and 1. Total scope: 14–17 weeks. TOR delivery window: 12 weeks from NTP. Parallel execution of Track A (core) and Track B (new modules) is the only path to on-time delivery.

| **Phase / Duration** | **Title**             | **Key Deliverables**                                                                                                                                       |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 (1–2 days)        | Rebrand & Restructure | orgProfile table, all Senate strings replaced, PCSO office hierarchy, demo seed, /demo removed.                                                            |
| P1 (3–4 days)        | File Maintenance      | 30+ FM lookup tables (FM-001 to FM-032). Unblocks RPM, LDM, PIMM.                                                                                          |
| P2 (1 week)          | PIMM Documents        | COE, COE w/Remunerations, Service Record, PDS (CS 212), NOSA, serial number system, retirement/loyalty lists.                                              |
| P3 (3–5 days)        | Leave & TAM Gaps      | Shift schedule UI, grace periods, lunch break tracking, auto-approve on timeout, year-end forced leave deduct, biometric API, LWOP notifications.          |
| P4 (1.5–2 weeks)     | Payroll Completion    | 6 missing payroll types, loan ledger, bank hash file, NOSA trigger, accounting API output.                                                                 |
| P5 (3–4 weeks)       | Module 2: Recruitment | MRF, CSC Form 9, applicant portal, qualification screening, selection process, top-5 list, appointment docs, auto-provisioning.                            |
| P6 (1 week)          | PMM Gaps              | DPCR, BPCR, scanned doc upload, forced ranking, PBB-qualified list.                                                                                        |
| P7 (2–3 weeks)       | Module 6: L&D         | Training catalog, provider profiles, TNA, scheduling, cost computation, participant lists, training certificates, mandatory compliance.                    |
| P8 (1–1.5 weeks)     | Employee Portal       | Loans, training view, memos, shift change, DTR correction, 201 upload, HR cert request, personnel movement, PDS update, ID request, promotion application. |
| P9 (1 week)          | Module 10: EWBM       | Loyalty award list, retirement notifications, PRAISE advance notification, wellness skills/hobbies report.                                                 |
| P10 (2 weeks)        | Technical Compliance  | MFA, Entra ID SSO, Docker, transaction logging, digital sigs, workflow designer, API (OAuth2, rate limiting, RFC 7807, async queue), load test.            |
| P11 (2 weeks)        | Deliverables Package  | Data Dictionary, 10 UML diagrams, 6 manuals, GUI mapping, VA/PenTest (procure external), SCA, training plan, DB scripts.                                   |

**CRITICAL: Phases 5 (RPM) and 7 (LDM) are the two longest builds. Both must start Week 1 in parallel with P0/P1. Sequential treatment of these modules makes on-time delivery impossible within the TOR's 3-month window.**

## 8.1 Parallel Execution Plan (12-Week Sprint)

| **Week** | **Track A — Core / Infrastructure**                      | **Track B — New Modules**                                      |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| W1–2     | P0 Rebrand + P1 FM Tables                                | P5 RPM: MRF, CSC Form 9, Applicant Portal                      |
| W3–4     | P2 PIMM Documents + P3 Leave/TAM Gaps                    | P5 RPM: Selection Process, Appointment Docs, Auto-Provisioning |
| W5–6     | P4 Payroll: RATA, Cash Advance, Loans, Bank Hash         | P7 LDM: Training Catalog, Provider Profiles, TNA               |
| W7–8     | P4 Payroll: Benefits, Differential, Special, Magna Carta | P7 LDM: Scheduling, Cost, Certificates, Reports                |
| W9–10    | P6 PMM Gaps + P9 EWBM + P8 Portal                        | P10 Technical Compliance (MFA, SSO, Docker, API)               |
| W11–12   | P10 Completion + UAT Support                             | P11 Deliverables Package + VA/PenTest Coordination             |

# 9. Acceptance Criteria

## 9.1 Functional Acceptance

- All 200+ TOR functional requirements (Sections 1.1–2.2) demonstrated in UAT with PCSO HR staff as test users.

- All 11 modules operational with zero Critical defects outstanding.

- All PDF generators producing output with correct PCSO identity, serial numbers, and CSC/BIR/GSIS/PhilHealth/Pag-IBIG-compliant formatting.

- End-to-end leave workflow: application → approval → deduction → payslip reflection → DTR update.

- New employee onboarding: RPM appointment issuance atomically provisions employee across all modules in a single transaction.

- Full payroll cycle: computation using formulas in Section 10, register generation, bank hash file export, all 4 remittance batches.

- All 7 dashboards render for their respective roles with correct scope enforcement per Section 3.4 and Section 11.

## 9.2 Technical Acceptance

- Load test result: 900+ concurrent users, \< 3 second average response time, 5,000 TPS minimum. Test report with k6 or Locust output submitted.

- VA Report from DICT-accredited provider: zero Critical or High findings unresolved.

- Penetration Test Report from DICT-accredited provider: zero Critical findings unresolved.

- MFA demonstrated for Super Admin and HR Admin roles.

- Entra ID SAML SSO login demonstrated.

- Docker deployment: docker-compose up produces fully functional system.

- Full audit trail: all sensitive actions logged with required fields in Section 5.4. Demonstrated via admin audit log viewer.

- Uploads: rejected files must not partially commit to database. Demonstrated by abort-mid-upload test.

## 9.3 Documentation Acceptance

- Data Dictionary covering all database entities submitted as Word/PDF.

- All 10 UML diagrams submitted in editable + PDF format.

- All 6 system manuals submitted and reviewed by PCSO TWG.

- GUI field-to-database mapping document submitted.

- Training delivery plan submitted and sessions scheduled for all 5 locations.

# 10. Computation Specifications

This section defines the exact computational logic developers must implement. All formulas are derived from applicable Philippine laws and CSC rules. Any deviation requires written approval from PCSO HRD.

## 10.1 Leave Credit Accrual & Deduction (CSC Omnibus Rules on Leave)

### 10.1.1 Monthly Accrual

- Vacation Leave (VL) earned: 1.25 days per month.

- Sick Leave (SL) earned: 1.25 days per month.

- Annual total: 15 VL + 15 SL = 30 days per year.

- Accrual condition: employee must have at least 1 day of paid service in the month. LWOP months with zero paid service days receive no accrual.

- First 6 months probationary: leave credits accrue but cannot be used until probationary period is completed.

- JO and COS personnel: no leave credits. Not entitled to leave benefits under CSC rules.

### 10.1.2 Leave Deduction Rules

- Whole-day absence: deduct 1.000 day from applicable leave type balance.

- Half-day absence (AM or PM): deduct 0.500 day.

- Absence without filed leave (AWOL): deduct from VL balance if available; else record as LWOP.

- LWOP salary deduction formula: (Monthly Basic Salary / Working Days in Month) × Number of LWOP Days.

- Undertime deduction (per minute): (Monthly Basic Salary / (Working Days in Month × Hours Per Day × 60)) × Undertime Minutes.

- Tardiness deduction: same rate as undertime. Applied only after grace period expires.

### 10.1.3 Forced / Mandatory Leave

- Eligibility: employees with VL balance ≥ 10 days as of December 31.

- Mandatory usage: 5 working days of VL must be used as forced leave within the calendar year.

- If unused by December 31: system auto-deducts 5 days from VL balance via scheduled job.

- Employees with VL balance \< 10 days: not subject to forced leave.

### 10.1.4 Leave Monetization (at Separation/Retirement)

- VL: all accumulated credits, no cap, paid at daily rate = Monthly Basic Salary / 22.

- SL: first 50 percent of accumulated SL credits monetized; balance forfeited. Capped at 15 days unless CSC issues updated rules.

- Daily rate formula: Monthly Basic Salary / 22 working days.

## 10.2 Overtime Computation

Government employees earn Compensatory Time Off (CTO) for overtime rendered, not monetary OT, unless PCSO has a specific Board-approved OT pay policy. If PCSO has a monetary OT policy, apply the following rates:

- Regular weekday OT: 125% of hourly rate per CSC and labor standards analogy.

- Rest day OT (if monetized): 130% of hourly rate.

- Regular holiday OT: 200% for first 8 hours; excess hours at 230%.

- Special non-working day OT: 130% of hourly rate.

- Night differential (10:00 PM – 6:00 AM): additional 10% of hourly rate per hour worked within this window.

- Hourly rate = Monthly Basic Salary / (22 working days × 8 hours).

- If PCSO policy provides CTO (not monetary): 1 hour OT = 1 hour CTO for weekday; 1.5 hours CTO for rest day/holiday OT. System tracks CTO balance in a separate leave-type ledger.

_Implementation note: The system must allow PCSO HR to configure whether OT is monetary or CTO-based. This is set at system initialization and is not user-changeable without Super Admin access._

## 10.3 Tardiness & Undertime

- Tardiness minutes = MAX(0, actual_time_in_minutes_since_midnight - (scheduled_time_in_minutes_since_midnight + grace_period_minutes)).

- Undertime minutes = MAX(0, scheduled_time_out_minutes_since_midnight - actual_time_out_minutes_since_midnight).

- Habitual tardiness threshold: 10 or more instances of tardiness within a calendar month, regardless of total minutes. Flag for HR review and generate notice.

- Habitual tardiness definition is per CSC rules: tardiness 10 times a month for at least 2 months in a semester, or 2 consecutive months during the year.

- Salary deduction for tardiness/undertime applies per Section 10.1.2 formula.

## 10.4 Performance Rating Computation

### 10.4.1 Adjectival Rating Scale (CSC MC 13, s. 1999)

| **Numerical Rating Range** | **Adjectival Equivalent** | **Abbreviation** |
| -------------------------- | ------------------------- | ---------------- |
| 4.500 – 5.000              | Outstanding               | O                |
| 3.500 – 4.499              | Very Satisfactory         | VS               |
| 2.500 – 3.499              | Satisfactory              | S                |
| 1.500 – 2.499              | Unsatisfactory            | US               |
| Below 1.500                | Poor                      | P                |

### 10.4.2 Forced Ranking Limits

- Outstanding: maximum 10% of total rated population per office/department per rating period.

- Very Satisfactory: maximum 25% of total rated population.

- If computed counts exceed these limits, system flags the violation and prevents submission.

- Rounding rule: when 10% of population is \< 1 (e.g., team of 5: 10% = 0.5), the limit is rounded up to 1.

### 10.4.3 PBB Qualification Gates

- Gate 1 — Rating: IPCRF rating for current year ≥ Satisfactory (numerical ≥ 2.500).

- Gate 2 — Administrative: no pending administrative case as of qualification date.

- Gate 3 — Attendance: no AWOL in rating period (or as defined by PCSO PBB policy).

- Gate 4 — SALN: SALN filed within prescribed period.

- All 4 gates must pass. System generates list only for employees meeting all gates. Configurable gates by HR Admin.

## 10.5 Step Increment Eligibility

- Regulatory basis: CSC MC 6, s. 2012; DBM-CSC Joint Circular No. 1, s. 2012.

- Eligibility condition 1: at least 3 consecutive years of service in current step with at least Satisfactory (numerical ≥ 2.500) performance rating in each of those 3 years.

- Eligibility condition 2: no pending administrative case.

- Eligibility condition 3: not a JO, COS, consultant, or confidential agent.

- Reference date: date of last step increment (or date of original appointment if never incremented).

- System computes eligibility date = last_increment_date + 3 years. If 3 consecutive satisfactory ratings are on record, marks employee as 'Eligible for NOSI'.

- After NOSI issuance: reset reference date to NOSI issuance date. Next eligibility date = NOSI issuance date + 3 years.

- Maximum step: Step 8. Employees at Step 8 are not eligible for further step increments.

## 10.6 BIR Withholding Tax (TRAIN Law, RA 10963, effective 2023 onwards)

Monthly withholding tax on compensation income (Table B — Monthly, for annualized method divide by 12):

| **Monthly Taxable Income Range** | **Base Tax**   | **Rate on Excess**             |
| -------------------------------- | -------------- | ------------------------------ |
| PHP 0 – PHP 20,833               | PHP 0.00       | 0%                             |
| PHP 20,833 – PHP 33,332          | PHP 0.00       | 20% of excess over PHP 20,833  |
| PHP 33,333 – PHP 66,666          | PHP 2,500.00   | 25% of excess over PHP 33,333  |
| PHP 66,667 – PHP 166,666         | PHP 10,833.33  | 30% of excess over PHP 66,667  |
| PHP 166,667 – PHP 666,666        | PHP 40,833.33  | 32% of excess over PHP 166,667 |
| Over PHP 666,667                 | PHP 200,833.33 | 35% of excess over PHP 666,667 |

- Taxable compensation = Monthly Basic Salary + taxable allowances - mandatory deductions (GSIS + PhilHealth + Pag-IBIG employee shares are pre-tax deductions).

- BIR de minimis exemptions: 13th month pay and other bonuses up to PHP 90,000/year are non-taxable.

- RATA: non-taxable up to the prescribed RATA ceiling (currently PHP 35,000/month for applicable positions). Only the excess is included in taxable income.

- System must re-compute withholding on every payroll run based on year-to-date income to avoid under/over-withholding. Use annualized method per BIR Revenue Regulations.

## 10.7 GSIS Contributions (RA 8291)

- Employee share: 9% of monthly compensation.

- Government (employer) share: 12% of monthly compensation.

- Monthly compensation includes basic salary and other compensation subject to GSIS.

- GSIS Personal Life Insurance (PLI): included within the 9% employee share.

- Government Service Insurance (GSI): included within the 9%.

- Retirement fund contributions: included within the 9% employee / 12% employer shares.

- JO and COS personnel: not covered by GSIS. No deduction.

## 10.8 PhilHealth Contributions (RA 7875, as amended; 2024 rates)

- Premium rate: 5% of monthly basic salary (as of 2024 per PhilHealth Circular No. 2023-0014).

- Employee share: 2.5% of monthly basic salary.

- Employer share: 2.5% of monthly basic salary.

- Salary floor: PHP 10,000 (minimum monthly premium = PHP 500.00; employee share = PHP 250.00).

- Salary ceiling: PHP 100,000 (maximum monthly premium = PHP 5,000.00; employee share = PHP 2,500.00).

- For salaries between floor and ceiling: employee contribution = 2.5% × monthly basic salary.

- JO and COS personnel: PhilHealth contribution depends on their contract terms. Configurable per employee record.

## 10.9 Pag-IBIG / HDMF Contributions (RA 9679)

- Monthly salary ≤ PHP 1,500: employee share = 1% of monthly salary.

- Monthly salary \> PHP 1,500: employee share = 2% of monthly salary.

- Employer counterpart: always 2% of monthly salary.

- Maximum monthly salary credit for contribution purposes: PHP 5,000.

- Therefore maximum employee monthly contribution: PHP 100.00 (2% of PHP 5,000).

- Therefore maximum employer monthly contribution: PHP 100.00.

- Employees may opt to contribute beyond the required amount (voluntary contribution). System must accept voluntary top-up amounts and include in remittance.

# 11. Role-Permission Matrix

Five system roles are defined. The matrix below specifies access level per module per role. Access levels: Full (read + write + approve + delete), Write (read + write), Read (read only), Own (own records only — employee portal scope), None (no access).

_Implementation note: Permissions are enforced at two layers — (1) middleware route-gating before page load, and (2) server action authorization check before any database write. Both layers are mandatory. A server action must never rely solely on front-end route gating._

| **Module / Function**                    | **Super Admin** | **HR Admin** | **HR Staff**   | **Dept Head**    | **Employee**     |
| ---------------------------------------- | --------------- | ------------ | -------------- | ---------------- | ---------------- |
| File Maintenance (all lookup tables)     | Full            | Full         | Read           | None             | None             |
| Employee 201 File — View                 | Full            | Full         | Full           | Own Unit Read    | Own Only         |
| Employee 201 File — Edit                 | Full            | Full         | Write (staged) | None             | Own (via Portal) |
| Document Generation (COE, SR, PDS, etc.) | Full            | Full         | Write          | Read (own unit)  | Request Only     |
| Serial Number Administration             | Full            | Full         | None           | None             | None             |
| Leave Application — Submit               | Full            | Full         | Own Only       | Own Only         | Own Only         |
| Leave Application — Approve              | Full            | Full         | Own Unit       | Own Unit         | None             |
| Leave Credits — Adjust (manual)          | Full            | Full         | Write (staged) | None             | None             |
| Leave Reports — All Units                | Full            | Full         | Full           | Own Unit         | None             |
| Attendance — Clock In/Out                | Full            | Full         | Own Only       | Own Only         | Own Only         |
| Attendance — Edit (correction)           | Full            | Full         | Write (staged) | Own Unit Approve | Request Only     |
| DTR Reports — All Units                  | Full            | Full         | Full           | Own Unit         | Own Only         |
| Biometric Device Config                  | Full            | Full         | None           | None             | None             |
| Shift Schedule Config                    | Full            | Full         | Write          | Read             | None             |
| Payroll Run — Create/Edit                | Full            | Full         | None           | None             | None             |
| Payroll Run — Approve/Finalize           | Full            | Full         | None           | None             | None             |
| Payslip — View                           | Full            | Full         | Full           | Own Unit         | Own Only         |
| Loan Ledger — View                       | Full            | Full         | Full           | Own Unit         | Own Only         |
| Loan Ledger — Edit                       | Full            | Full         | Write          | None             | None             |
| BIR/GSIS/PhilHealth/Pag-IBIG Remittances | Full            | Full         | Write          | None             | None             |
| Bank Hash File Generation                | Full            | Full         | Write          | None             | None             |
| Recruitment — MRF Create                 | Full            | Full         | Write          | Write (own unit) | None             |
| Recruitment — Applicant Portal           | Full            | Full         | Full           | Read             | Read (own app)   |
| Recruitment — Selection Process          | Full            | Full         | Full           | Read             | None             |
| Appointment Documents                    | Full            | Full         | Write          | None             | None             |
| Performance IPCRF/OPCRF                  | Full            | Full         | Full           | Own Unit Full    | Own Only         |
| Performance DPCR/BPCR                    | Full            | Full         | Full           | Own Unit Full    | None             |
| Performance Reports                      | Full            | Full         | Full           | Own Unit         | None             |
| L&D Training Catalog — Edit              | Full            | Full         | Write          | None             | None             |
| L&D Training Schedule — Approve          | Full            | Full         | None           | Approve          | None             |
| L&D Training — View & Confirm Attendance | Full            | Full         | Full           | Own Unit         | Own Only         |
| L&D Certificates                         | Full            | Full         | Full           | Own Unit         | Own Only         |
| EWBM / PRAISE Reports                    | Full            | Full         | Full           | Read             | None             |
| Org Profile / Settings                   | Full            | None         | None           | None             | None             |
| User Management                          | Full            | None         | None           | None             | None             |
| Audit Log — View                         | Full            | Full         | None           | None             | None             |
| System Workflow Configuration            | Full            | Full         | None           | None             | None             |
| API Key Management                       | Full            | None         | None           | None             | None             |

# 12. Workflow State Machines

Each workflow below defines: states, transition triggers, actor responsible for each transition, and configurable timeout rules where applicable. These state machines must be implemented exactly as specified to ensure audit trail completeness.

## 12.1 Leave Application Workflow

| **From State**         | **Trigger**                    | **To State**                   | **Actor**            | **Timeout / Rule**                                                |
| ---------------------- | ------------------------------ | ------------------------------ | -------------------- | ----------------------------------------------------------------- |
| —                      | Employee submits application   | PENDING                        | Employee             | —                                                                 |
| PENDING                | Approver approves              | APPROVED                       | Dept Head / HR Staff | Auto-approve to APPROVED after 5 business days (SL only, LAM-006) |
| PENDING                | Approver disapproves           | DISAPPROVED                    | Dept Head / HR Staff | —                                                                 |
| PENDING                | Employee withdraws             | CANCELLED                      | Employee             | Before any approver action only                                   |
| APPROVED               | Employee requests cancellation | CANCELLATION_REQUESTED         | Employee             | Leave must not yet be consumed (future/current period)            |
| CANCELLATION_REQUESTED | Approver confirms cancellation | CANCELLED                      | Dept Head / HR Staff | Credits restored upon transition to CANCELLED                     |
| CANCELLATION_REQUESTED | Approver denies cancellation   | APPROVED                       | Dept Head / HR Staff | Leave remains approved                                            |
| APPROVED               | Year-end auto-deduct job       | CONSUMED_AUTO                  | System Scheduler     | Forced/Mandatory leave only; December 31                          |
| APPROVED               | Period passes                  | CONSUMED                       | System Scheduler     | Date-based auto-transition after leave period ends                |
| DISAPPROVED            | — Terminal State —             | No further transitions         |                      |                                                                   |
| CANCELLED              | — Terminal State —             | Credits restored; audit logged |                      |                                                                   |

## 12.2 Payroll Run Workflow

| **From State** | **Trigger**                      | **To State**                                                          | **Actor**           | **Rule**                                                               |
| -------------- | -------------------------------- | --------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| —              | HR Staff creates new run         | DRAFT                                                                 | HR Admin / HR Staff | Payroll type, period, and included employees defined                   |
| DRAFT          | HR Staff submits for computation | COMPUTING                                                             | System              | Async job; deductions computed per Section 10.6–10.9                   |
| COMPUTING      | Computation completes            | COMPUTED                                                              | System              | Results available for review; no changes to included employees allowed |
| COMPUTED       | HR Staff submits for review      | FOR_APPROVAL                                                          | HR Staff            | Payroll register generated for approver                                |
| FOR_APPROVAL   | Approver approves                | APPROVED                                                              | HR Admin            | Budget officer signatory also required per PCSO policy                 |
| FOR_APPROVAL   | Approver returns                 | DRAFT                                                                 | HR Admin            | Returns to DRAFT for correction; all computation cleared               |
| APPROVED       | Payroll Master finalizes         | FINALIZED                                                             | HR Admin            | Bank hash file generated; payslips accessible to employees             |
| FINALIZED      | Remittance submission            | REMITTED                                                              | HR Admin            | GSIS/PhilHealth/Pag-IBIG/BIR batches marked as submitted               |
| FINALIZED      | — Terminal State —               | No modifications after FINALIZED. Corrections via adjustment payroll. |                     |                                                                        |

## 12.3 RPM Recruitment Pipeline Workflow

| **Stage / State**  | **Entry Condition**                                           | **Exit Conditions**                                   | **Responsible**      |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------- | -------------------- |
| MRF_DRAFT          | HR staff creates MRF                                          | Submitted for approval / Cancelled                    | HR Staff             |
| MRF_PENDING        | MRF submitted                                                 | Approved (proceeds) / Returned to DRAFT               | Dept Head → AGM → GM |
| PUBLISHED          | MRF approved; vacancy posted on portal + CSC Form 9 generated | Application window closes (date-based)                | HRD                  |
| APPLICATION_REVIEW | Applications received                                         | Qualified/Not qualified status set for each applicant | HR Staff             |
| EXAM_SCHEDULED     | Qualified list confirmed by HRD                               | Exam date passes                                      | HR Staff             |
| RATED              | Exam results encoded                                          | Ranking finalized                                     | HR Staff             |
| SHORTLISTED        | Top 5 list approved by GM                                     | Interview scheduled                                   | HRD / GM             |
| FOR_BOARD          | Recommended list submitted to Board                           | Board action received                                 | Board                |
| APPOINTED          | Board confirms; appointment docs generated                    | Employee auto-provisioned across all modules          | HRD                  |
| CLOSED             | Appointment issued or position withdrawn                      | Terminal                                              | HRD                  |

## 12.4 Document Request Workflow

| **From State** | **Trigger**                                            | **To State**                            | **Actor**                            | **SLA**                                                  |
| -------------- | ------------------------------------------------------ | --------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| —              | Employee submits document request via portal           | RECEIVED                                | Employee                             | —                                                        |
| RECEIVED       | HR Staff accepts and begins processing                 | IN_PROCESS                              | HR Staff                             | Within 1 business day of receipt                         |
| IN_PROCESS     | HR Staff generates and signs document                  | READY                                   | HR Staff                             | Target: 3 working days from RECEIVED (configurable)      |
| READY          | System notifies employee; employee views/downloads PDF | RELEASED                                | System (auto on download) / HR Staff | —                                                        |
| RECEIVED       | HR Staff disapproves request (insufficient basis)      | DISAPPROVED                             | HR Staff                             | With stated reason; employee notified via email + portal |
| IN_PROCESS     | HR Staff cannot process (missing 201 data)             | ON_HOLD                                 | HR Staff                             | Employee notified of required information                |
| ON_HOLD        | Employee provides required info                        | IN_PROCESS                              | Employee                             | —                                                        |
| RELEASED       | — Terminal State —                                     | —                                       |                                      |                                                          |
| DISAPPROVED    | — Terminal State —                                     | Employee may re-submit with corrections |                                      |                                                          |

## 12.5 Personnel Movement Request Workflow

| **Movement Type**             | **States**                                          | **Approvers**                                         | **Outputs**                                                                       |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Reassignment                  | DRAFT → SUBMITTED → ENDORSED → APPROVED → EFFECTED  | Dept Head → HRD Manager → AGM                         | Updated 201 file; updated office assignment; Special Order PDF                    |
| Transfer (to another unit)    | DRAFT → SUBMITTED → ENDORSED → APPROVED → EFFECTED  | Current Dept Head → Receiving Dept Head → HRD Manager | Updated 201 file; Transfer Order PDF; Service Record entry                        |
| Resignation                   | DRAFT → SUBMITTED → ACCEPTED → CLEARED → SEPARATED  | HRD Manager                                           | Clearance form, final pay computation trigger, 201 file status update to Resigned |
| Optional Retirement           | DRAFT → SUBMITTED → VERIFIED → APPROVED → SEPARATED | HRD Manager → GSIS Coordination                       | GSIS retirement application documents, leave monetization computation, final pay  |
| Detail (temporary assignment) | DRAFT → SUBMITTED → APPROVED → EFFECTED → REVERTED  | HRD Manager                                           | Detail Order PDF; reverts to original unit on end date                            |

# 13. System Notification Matrix

All notifications are delivered via: (1) in-app notification bell, and (2) email via SMTP. Email templates are stored in /src/lib/email/templates/ and are configurable by HR Admin. Recipient columns indicate the user role(s) who receive each notification.

| **ID** | **Trigger Event**                           | **Primary Recipient**               | **Secondary Recipient**  | **Channel**    | **Template ID**             |
| ------ | ------------------------------------------- | ----------------------------------- | ------------------------ | -------------- | --------------------------- |
| N-001  | Leave application submitted                 | Approver (Dept Head / HR Staff)     | —                        | In-App + Email | leave_submitted             |
| N-002  | Leave application approved                  | Employee                            | HR Staff (copy)          | In-App + Email | leave_approved              |
| N-003  | Leave application disapproved               | Employee                            | —                        | In-App + Email | leave_disapproved           |
| N-004  | Leave auto-approved (approver timeout)      | Employee                            | HR Admin (audit flag)    | In-App + Email | leave_auto_approved         |
| N-005  | Leave cancellation request submitted        | Original Approver                   | HR Staff                 | In-App + Email | leave_cancel_requested      |
| N-006  | Leave cancellation approved                 | Employee                            | —                        | In-App + Email | leave_cancel_approved       |
| N-007  | Year-end forced leave auto-deducted         | Employee                            | HR Staff                 | In-App + Email | leave_forced_deduct         |
| N-008  | LWOP incurred (no filed leave)              | Employee                            | Payroll Section          | In-App + Email | lwop_notice                 |
| N-009  | Tardiness notification (single instance)    | Employee                            | —                        | In-App         | tardiness_single            |
| N-010  | Habitual tardiness (10+ instances/month)    | Employee                            | HR Staff + Dept Head     | In-App + Email | tardiness_habitual          |
| N-011  | OT request submitted                        | Approver                            | —                        | In-App + Email | ot_submitted                |
| N-012  | OT request approved                         | Employee                            | —                        | In-App + Email | ot_approved                 |
| N-013  | Payslip available                           | Employee                            | —                        | In-App + Email | payslip_available           |
| N-014  | Payroll run approved (HR staff)             | HR Staff                            | —                        | In-App         | payroll_approved            |
| N-015  | SALN filing period opening                  | All permanent/coterminous employees | HR Admin                 | Email          | saln_reminder               |
| N-016  | SALN filing deadline (7 days remaining)     | Employees who haven't filed         | HR Admin                 | Email          | saln_deadline               |
| N-017  | PDS submission reminder                     | Employees with no current PDS       | HR Admin                 | Email          | pds_reminder                |
| N-018  | Document request status update              | Employee                            | —                        | In-App + Email | doc_request_update          |
| N-019  | Document request ready for pickup/download  | Employee                            | —                        | In-App + Email | doc_request_ready           |
| N-020  | Step increment eligibility reached          | Employee                            | HR Admin                 | In-App + Email | step_increment_eligible     |
| N-021  | NOSI issued                                 | Employee                            | —                        | In-App + Email | nosi_issued                 |
| N-022  | NOSA issued                                 | Employee                            | —                        | In-App + Email | nosa_issued                 |
| N-023  | Performance evaluation period opens         | All ratees in active cycle          | HR Admin                 | Email          | perf_cycle_open             |
| N-024  | Performance evaluation deadline (7 days)    | Employees with pending IPCRF        | Supervisors              | Email          | perf_cycle_deadline         |
| N-025  | MRF action required                         | Approver in chain                   | —                        | In-App + Email | mrf_action_required         |
| N-026  | Exam schedule notification (applicant)      | External Applicant                  | —                        | Email          | rpf_exam_schedule           |
| N-027  | Application result notification (applicant) | External Applicant                  | —                        | Email          | rpf_result                  |
| N-028  | Training schedule assigned                  | Employee                            | Dept Head                | In-App + Email | training_assigned           |
| N-029  | Training schedule approval required         | Approver                            | —                        | In-App + Email | training_approval           |
| N-030  | Mandatory training compliance reminder      | Non-compliant employees             | HR Staff                 | Email          | training_mandatory_reminder |
| N-031  | Annual retirement notification              | HRD Manager                         | AGM                      | Email          | retirement_annual           |
| N-032  | PRAISE incentive advance notice to Payroll  | Payroll Master                      | HR Admin                 | Email          | praise_advance_notice       |
| N-033  | Loyalty award eligibility                   | HRD Manager                         | —                        | Email          | loyalty_award_eligible      |
| N-034  | DTR correction request submitted            | Approver                            | —                        | In-App         | dtr_correction_submitted    |
| N-035  | DTR correction approved                     | Employee                            | HR Admin                 | In-App + Email | dtr_correction_approved     |
| N-036  | Entra ID SSO login from new device          | Employee                            | HR Admin (if suspicious) | Email          | sso_new_device              |
| N-037  | Failed login burst (5+ failures in 10 min)  | HR Admin (security alert)           | Super Admin              | Email          | security_login_burst        |
| N-038  | PBB qualification list generated            | HRD Manager                         | Payroll Master           | In-App + Email | pbb_list_generated          |

# 14. Key Entity Schema Reference

The following tables define the key fields for each core entity. This is not a complete data dictionary (see deliverable 3.7.1 for the full dictionary) but provides sufficient field-level specification for developers to begin schema implementation. All tables must include: id (uuid, PK), created_at (timestamptz), updated_at (timestamptz), deleted_at (timestamptz nullable for soft delete).

## 14.1 employees

| **Column**           | **Type**      | **Nullable** | **Notes**                                                                                    |
| -------------------- | ------------- | ------------ | -------------------------------------------------------------------------------------------- |
| id                   | uuid          | No           | PK, default gen_random_uuid()                                                                |
| employee_number      | varchar(20)   | No           | Unique. Format: PCSO-YYYY-NNNN. System-generated.                                            |
| last_name            | varchar(100)  | No           | —                                                                                            |
| first_name           | varchar(100)  | No           | —                                                                                            |
| middle_name          | varchar(100)  | Yes          | —                                                                                            |
| extension_name       | varchar(10)   | Yes          | FK → fm_extension_names. Jr., Sr., II, III                                                   |
| date_of_birth        | date          | No           | —                                                                                            |
| gender               | varchar(10)   | No           | ENUM: male, female, other                                                                    |
| civil_status         | varchar(20)   | No           | FK → fm_civil_statuses                                                                       |
| blood_type           | varchar(5)    | Yes          | FK → fm_blood_types                                                                          |
| place_of_birth       | varchar(200)  | Yes          | —                                                                                            |
| current_address      | text          | Yes          | —                                                                                            |
| permanent_address    | text          | Yes          | —                                                                                            |
| email_address        | varchar(200)  | No           | Unique                                                                                       |
| contact_number       | varchar(20)   | Yes          | —                                                                                            |
| tin                  | varchar(20)   | Yes          | —                                                                                            |
| gsis_id              | varchar(30)   | Yes          | —                                                                                            |
| philhealth_id        | varchar(30)   | Yes          | —                                                                                            |
| pagibig_id           | varchar(30)   | Yes          | —                                                                                            |
| sss_id               | varchar(30)   | Yes          | Non-organic only                                                                             |
| appointment_type     | varchar(30)   | No           | ENUM: permanent, temporary, coterminous, cas, job_order, cos, consultant, confidential_agent |
| employment_status    | varchar(30)   | No           | ENUM: active, on_leave, suspended, resigned, retired, terminated, deceased                   |
| office_id            | uuid          | No           | FK → offices.id                                                                              |
| position_id          | uuid          | No           | FK → positions.id                                                                            |
| item_number          | varchar(20)   | Yes          | Plantilla item number. Null for non-organic.                                                 |
| salary_grade         | integer       | Yes          | 1–33. For SSL V employees.                                                                   |
| step_increment       | integer       | Yes          | 1–8.                                                                                         |
| monthly_salary       | numeric(12,2) | No           | Current effective salary.                                                                    |
| salary_schedule_type | varchar(10)   | No           | ENUM: ssl_v, cpcs                                                                            |
| date_hired           | date          | No           | —                                                                                            |
| date_last_promotion  | date          | Yes          | —                                                                                            |
| date_last_increment  | date          | Yes          | —                                                                                            |
| bank_account_number  | varchar(30)   | Yes          | For bank hash file generation                                                                |
| bank_name            | varchar(100)  | Yes          | —                                                                                            |
| profile_photo_url    | text          | Yes          | Supabase Storage URL                                                                         |
| user_id              | uuid          | Yes          | FK → auth.users. Null until portal account created.                                          |

## 14.2 leave_applications

| **Column**                | **Type**     | **Nullable** | **Notes**                                                                                        |
| ------------------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------ |
| id                        | uuid         | No           | PK                                                                                               |
| employee_id               | uuid         | No           | FK → employees.id                                                                                |
| leave_type_id             | uuid         | No           | FK → fm_leave_types.id                                                                           |
| date_from                 | date         | No           | —                                                                                                |
| date_to                   | date         | No           | —                                                                                                |
| number_of_days            | numeric(5,1) | No           | Computed. Excludes weekends and holidays.                                                        |
| is_half_day               | boolean      | No           | Default false                                                                                    |
| half_day_period           | varchar(2)   | Yes          | ENUM: AM, PM. Required if is_half_day = true.                                                    |
| reason                    | text         | Yes          | —                                                                                                |
| status                    | varchar(30)  | No           | ENUM: pending, approved, disapproved, cancelled, cancellation_requested, consumed, consumed_auto |
| approver_id               | uuid         | Yes          | FK → employees.id                                                                                |
| approved_at               | timestamptz  | Yes          | —                                                                                                |
| disapproval_reason        | text         | Yes          | Required when status = disapproved                                                               |
| attachment_paths          | jsonb        | Yes          | Array of Supabase Storage URLs                                                                   |
| auto_approved             | boolean      | No           | Default false. True if approved by timeout job.                                                  |
| auto_approved_at          | timestamptz  | Yes          | Timestamp of auto-approval trigger                                                               |
| payroll_deduction_applied | boolean      | No           | Default false. Set true when LWOP deduction is applied in payroll.                               |

## 14.3 payroll_runs

| **Column**             | **Type**      | **Nullable** | **Notes**                                                                                              |
| ---------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| id                     | uuid          | No           | PK                                                                                                     |
| payroll_type           | varchar(30)   | No           | ENUM: general, jo_cos, rata, cash_advance, benefits_bonuses, salary_differential, special, magna_carta |
| period_start           | date          | No           | —                                                                                                      |
| period_end             | date          | No           | —                                                                                                      |
| run_date               | date          | No           | Actual processing date                                                                                 |
| status                 | varchar(30)   | No           | ENUM: draft, computing, computed, for_approval, approved, finalized, remitted                          |
| title                  | varchar(200)  | Yes          | Required for special payroll type (Payroll Master sets this)                                           |
| total_gross            | numeric(15,2) | Yes          | Computed on finalization                                                                               |
| total_deductions       | numeric(15,2) | Yes          | —                                                                                                      |
| total_net              | numeric(15,2) | Yes          | —                                                                                                      |
| prepared_by_id         | uuid          | No           | FK → employees.id                                                                                      |
| approved_by_id         | uuid          | Yes          | FK → employees.id                                                                                      |
| approved_at            | timestamptz   | Yes          | —                                                                                                      |
| finalized_by_id        | uuid          | Yes          | FK → employees.id                                                                                      |
| finalized_at           | timestamptz   | Yes          | —                                                                                                      |
| bank_hash_generated    | boolean       | No           | Default false                                                                                          |
| bank_hash_generated_at | timestamptz   | Yes          | —                                                                                                      |

## 14.4 payroll_records

| **Column**          | **Type**      | **Nullable** | **Notes**                                                             |
| ------------------- | ------------- | ------------ | --------------------------------------------------------------------- |
| id                  | uuid          | No           | PK                                                                    |
| payroll_run_id      | uuid          | No           | FK → payroll_runs.id                                                  |
| employee_id         | uuid          | No           | FK → employees.id                                                     |
| basic_salary        | numeric(12,2) | No           | —                                                                     |
| gross_pay           | numeric(12,2) | No           | basic + taxable allowances                                            |
| bir_withholding     | numeric(10,2) | No           | Computed per Section 10.6                                             |
| gsis_employee       | numeric(10,2) | No           | 9% of monthly compensation                                            |
| gsis_employer       | numeric(10,2) | No           | 12% of monthly compensation                                           |
| philhealth_employee | numeric(10,2) | No           | Per Section 10.8                                                      |
| philhealth_employer | numeric(10,2) | No           | Per Section 10.8                                                      |
| pagibig_employee    | numeric(10,2) | No           | Per Section 10.9                                                      |
| pagibig_employer    | numeric(10,2) | No           | Per Section 10.9                                                      |
| loan_deductions     | numeric(10,2) | No           | Default 0. Sum of all active loan deductions for this period.         |
| other_deductions    | numeric(10,2) | No           | Default 0. From CSV bulk upload.                                      |
| other_income        | numeric(10,2) | No           | Default 0. Allowances, reimbursements.                                |
| net_pay             | numeric(12,2) | No           | gross_pay - total_deductions                                          |
| included            | boolean       | No           | False if tagged for exclusion                                         |
| exclusion_reason    | text          | Yes          | Required if included = false                                          |
| ytd_taxable_income  | numeric(15,2) | No           | Running year-to-date taxable income for annualized withholding method |

## 14.5 attendance_records

| **Column**           | **Type**    | **Nullable** | **Notes**                                                                 |
| -------------------- | ----------- | ------------ | ------------------------------------------------------------------------- |
| id                   | uuid        | No           | PK                                                                        |
| employee_id          | uuid        | No           | FK → employees.id                                                         |
| attendance_date      | date        | No           | —                                                                         |
| time_in              | timestamptz | Yes          | Null = absent or not yet clocked in                                       |
| time_out             | timestamptz | Yes          | Null = not yet clocked out                                                |
| lunch_out            | timestamptz | Yes          | If schedule has explicit lunch break                                      |
| lunch_in             | timestamptz | Yes          | —                                                                         |
| schedule_id          | uuid        | No           | FK → work_schedules.id. Schedule applicable on this date.                 |
| tardiness_minutes    | integer     | No           | Default 0. Computed.                                                      |
| undertime_minutes    | integer     | No           | Default 0. Computed.                                                      |
| overtime_minutes     | integer     | No           | Default 0. From approved OT request.                                      |
| source               | varchar(20) | No           | ENUM: biometric_api, biometric_upload, manual_hr, manual_employee_request |
| source_reference     | text        | Yes          | Raw biometric record ID or correction request ID                          |
| is_holiday           | boolean     | No           | True if date is in holidays table                                         |
| holiday_type         | varchar(20) | Yes          | regular, special_non_working, special_working. Null if not holiday.       |
| is_suspended         | boolean     | No           | True if date/hours in work_suspensions table                              |
| leave_application_id | uuid        | Yes          | FK → leave_applications.id. Set if absent due to approved leave.          |
| corrected            | boolean     | No           | Default false. True if manually corrected after biometric capture.        |
| correction_reason    | text        | Yes          | Required if corrected = true                                              |

## 14.6 performance_cycles

| **Column**          | **Type**    | **Nullable** | **Notes**                                     |
| ------------------- | ----------- | ------------ | --------------------------------------------- |
| id                  | uuid        | No           | PK                                            |
| year                | integer     | No           | —                                             |
| semester            | integer     | No           | ENUM: 1, 2. 1 = Jan-Jun, 2 = Jul-Dec.         |
| status              | varchar(20) | No           | ENUM: open, closed                            |
| planning_deadline   | date        | No           | —                                             |
| monitoring_deadline | date        | No           | —                                             |
| review_deadline     | date        | No           | —                                             |
| created_by_id       | uuid        | No           | FK → employees.id (HR Admin who opened cycle) |
| closed_by_id        | uuid        | Yes          | FK → employees.id                             |
| closed_at           | timestamptz | Yes          | —                                             |

## 14.7 ipcrf_forms

| **Column**           | **Type**     | **Nullable** | **Notes**                                                          |
| -------------------- | ------------ | ------------ | ------------------------------------------------------------------ |
| id                   | uuid         | No           | PK                                                                 |
| performance_cycle_id | uuid         | No           | FK → performance_cycles.id                                         |
| employee_id          | uuid         | No           | FK → employees.id                                                  |
| rater_id             | uuid         | No           | FK → employees.id. Direct supervisor.                              |
| reviewer_id          | uuid         | Yes          | FK → employees.id. Division Chief or above.                        |
| phase                | varchar(20)  | No           | ENUM: planning, monitoring, review                                 |
| numerical_rating     | numeric(4,3) | Yes          | 1.000 – 5.000. Populated at review phase.                          |
| adjectival_rating    | varchar(20)  | Yes          | Outstanding, Very Satisfactory, Satisfactory, Unsatisfactory, Poor |
| status               | varchar(20)  | No           | ENUM: draft, submitted, reviewed, finalized                        |
| submitted_at         | timestamptz  | Yes          | —                                                                  |
| reviewed_at          | timestamptz  | Yes          | —                                                                  |
| scanned_doc_url      | text         | Yes          | Supabase Storage URL for uploaded scanned IPCRF                    |

## 14.8 serial_sequences

| **Column**      | **Type**     | **Nullable** | **Notes**                                                          |
| --------------- | ------------ | ------------ | ------------------------------------------------------------------ |
| id              | uuid         | No           | PK                                                                 |
| document_type   | varchar(50)  | No           | ENUM: COE, COER, SR, CT, NOSI, NOSA, etc. Unique + year composite. |
| year            | integer      | No           | Calendar year                                                      |
| last_sequence   | integer      | No           | Default 0. Increment before use.                                   |
| format_template | varchar(100) | No           | e.g., COE-{YYYY}-{NNNNNN}. Pads sequence to 6 digits.              |
| created_at      | timestamptz  | No           | —                                                                  |
| updated_at      | timestamptz  | No           | —                                                                  |

## 14.9 document_requests

| **Column**             | **Type**    | **Nullable** | **Notes**                                                         |
| ---------------------- | ----------- | ------------ | ----------------------------------------------------------------- |
| id                     | uuid        | No           | PK                                                                |
| employee_id            | uuid        | No           | FK → employees.id. Requestor.                                     |
| document_type_id       | uuid        | No           | FK → fm_document_types.id                                         |
| purpose                | text        | Yes          | Stated purpose by employee                                        |
| status                 | varchar(30) | No           | ENUM: received, in_process, on_hold, ready, released, disapproved |
| assigned_to_id         | uuid        | Yes          | FK → employees.id. HR Staff processing the request.               |
| received_at            | timestamptz | No           | —                                                                 |
| processed_at           | timestamptz | Yes          | When HR Staff begins processing                                   |
| ready_at               | timestamptz | Yes          | When document is ready for release                                |
| released_at            | timestamptz | Yes          | When employee downloads or physically receives                    |
| disapproval_reason     | text        | Yes          | Required if status = disapproved                                  |
| generated_document_url | text        | Yes          | Supabase Storage URL of the generated PDF                         |
| serial_number          | varchar(50) | Yes          | Populated from serial_sequences on generation                     |
| on_hold_reason         | text        | Yes          | Required if status = on_hold                                      |

## 14.10 audit_logs

| **Column**      | **Type**     | **Nullable** | **Notes**                                                       |
| --------------- | ------------ | ------------ | --------------------------------------------------------------- |
| id              | uuid         | No           | PK                                                              |
| timestamp       | timestamptz  | No           | Default now()                                                   |
| ip_address      | inet         | Yes          | —                                                               |
| user_id         | uuid         | Yes          | FK → auth.users.id. Null for system/scheduler events.           |
| employee_id     | uuid         | Yes          | FK → employees.id. Denormalized for quick filtering.            |
| action          | varchar(100) | No           | e.g., leave.approve, payroll.finalize, employee.update          |
| object_type     | varchar(100) | No           | e.g., leave_application, payroll_run                            |
| object_id       | uuid         | Yes          | ID of affected record                                           |
| outcome         | varchar(20)  | No           | ENUM: success, failure                                          |
| reason          | text         | Yes          | Human-readable reason for the action                            |
| module          | varchar(50)  | No           | e.g., LAM, PM, RPM                                              |
| sub_module      | varchar(50)  | Yes          | e.g., leave_application, payroll_deductions                     |
| severity        | varchar(10)  | No           | ENUM: info, warn, critical                                      |
| alert_sent      | boolean      | No           | Default false. True if a security alert notification was sent.  |
| transaction_id  | uuid         | Yes          | Groups related audit log entries from the same transaction      |
| session_id      | text         | Yes          | Browser session ID from Supabase Auth                           |
| payload_summary | jsonb        | Yes          | Non-sensitive summary of changed fields (before/after). No PII. |
| duration_ms     | integer      | Yes          | Duration of the operation in milliseconds                       |

# 15. Risk Register

| **Risk**                                                                                | **Severity** | **Mitigation**                                                                                                                      | **Owner**             |
| --------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Sequential RPM/LDM build causes 4-5 week schedule overrun against 3-month TOR window    | Critical     | Parallel Track A/B from Week 1 mandatory. Two developer tracks minimum.                                                             | Project Lead          |
| VA/PenTest vendor lead time (DICT-accredited firms are booked 4-6 weeks out)            | High         | Contract VA/PenTest vendor by Week 2 of development. Phase 10 completion is the dependency gate.                                    | Procurement           |
| Entra ID SAML configuration requires PCSO IT cooperation and may involve procurement    | High         | Initiate Entra ID requirements gathering with PCSO IT in Week 1. Configure Supabase SAML provider early.                            | Dev + PCSO IT         |
| PostgreSQL vs MS SQL Server TOR requirement: evaluating body may reject Postgres        | High         | Prepare written technical equivalency justification for TWG pre-bid approval. Document Supabase HA, replication, backup automation. | Dev Lead              |
| Digital signature depends on PCSO PKI availability (may not exist or not be documented) | Medium       | PAdES-compatible signing via pdf-lib + WebCrypto as fully functional fallback. Coordinate with PCSO IT Week 1.                      | Dev + PCSO IT         |
| Biometric device vendor may not support open API format                                 | Medium       | CSV/Excel import is guaranteed fallback. API integration documented as best-effort per device vendor.                               | Dev                   |
| Incomplete PCSO org data for seeding (positions, office hierarchy, salary data)         | Medium       | Request complete org data from PCSO HRD by Week 1. Use configurable hierarchy — no hardcoded PCSO-specific values.                  | PCSO HRD              |
| Supabase free tier insufficient for 900 concurrent users at production scale            | High         | Upgrade to Supabase Pro/Enterprise before load testing. Document production infrastructure tier in deployment guide.                | Dev + Infra           |
| BIR withholding tables or PhilHealth/Pag-IBIG rates change during development           | Medium       | Rates in database (FM tables) not hardcoded in business logic. Rate updates require only data changes, not code deployment.         | Dev                   |
| Accounting system format incompatible with initial API design                           | Medium       | Request PCSO Accounting system data format specification in Week 1. Do not build accounting API output without confirmed format.    | Dev + PCSO Accounting |

# 16. Appendix

## 16.1 Regulatory Compliance References

- Republic Act No. 12009 — New Government Procurement Act (competitive bidding requirements).

- CSC Omnibus Rules on Leave — leave credits, computation, mandatory leave types, LWOP rules.

- CSC MC No. 13, s. 1999 — Performance Evaluation System (IPCRF/OPCRF/DPCR/BPCR/adjectival ratings).

- CSC MC No. 6, s. 2012 — Step Increment Rules (3-year service requirement, eligibility conditions).

- DBM-CSC Joint Circular No. 1, s. 2012 — Rules on Step Increment for Government Personnel.

- Republic Act No. 8291 — GSIS Act of 1997 (contribution rates, coverage, JO/COS exclusions).

- Republic Act No. 10963 — TRAIN Law (revised income tax brackets effective 2023).

- BIR Revenue Regulations No. 8-2018 — TRAIN Law implementing rules for withholding tax on compensation.

- Republic Act No. 7875 as amended by RA 10606 — National Health Insurance Act (PhilHealth).

- PhilHealth Circular No. 2023-0014 — Premium contribution schedule (5%, effective 2024).

- Republic Act No. 9679 — Home Development Mutual Fund Law of 2009 (Pag-IBIG contribution structure).

- Republic Act No. 10173 — Data Privacy Act of 2012 (NPC/DPA compliance requirements).

- NPC Advisory Opinion — Guidelines on government agency HR data processing.

- DICT MC No. 005, s. 2017 — Cloud-First Policy (hosting requirements).

- GCG MC No. 2012-07 — Compensation and Position Classification System for GOCCs (Job Grade structure).

- Republic Act No. 6713 — Code of Conduct and Ethical Standards (SALN requirement).

- National Archives of the Philippines Act — NAP archival guidelines for government records.

- OWASP Top 10 (2023 edition) — Secure coding and web application security standards.

- RFC 7807 — Problem Details for HTTP APIs (standard error response format).

- SAML 2.0 / OAuth 2.0 / OIDC / LDAP — Identity and Access Management standards.

- NIST SP 800-63B — Digital Identity Guidelines (MFA implementation guidance).

## 16.2 Glossary

| **Term**  | **Definition**                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------- |
| ATAF      | Assumption to Duty / ATAF — CSC document confirming employee's assumption of duties on appointment        |
| BPCR      | Branch Performance Commitment Review — branch-level performance instrument (NCL, STBR, Visayas, Mindanao) |
| COA       | Commission on Audit — Philippine government supreme audit institution                                     |
| COE       | Certificate of Employment — HR document certifying employment status                                      |
| CPCS      | Compensation and Position Classification System — salary structure for GOCCs (Job Grades 1–33)            |
| CSC       | Civil Service Commission — central personnel agency of Philippine government                              |
| CTO       | Compensatory Time Off — government OT benefit (time off in lieu of monetary overtime pay)                 |
| DICT      | Department of Information and Communications Technology                                                   |
| DPCR      | Division Performance Commitment Review — division-level performance instrument                            |
| DPA / NPC | Data Privacy Act / National Privacy Commission — Philippine data protection law and regulator             |
| DTR       | Daily Time Record — official attendance record (CSC Form 48)                                              |
| GCG       | Governance Commission for GOCCs — oversight body for government corporations including PCSO               |
| GOCC      | Government-Owned and Controlled Corporation — PCSO's legal classification                                 |
| HRD       | Human Resources Department — PCSO's internal HR unit                                                      |
| HRS       | Human Resource System — the system being procured and developed                                           |
| IPCRF     | Individual Performance Commitment and Review Form — individual-level CSC performance instrument           |
| ISSP      | Information Systems Strategic Plan — PCSO's IT roadmap mandating the HRS                                  |
| JO / COS  | Job Order / Contract of Service — non-organic personnel types not covered by CSC/GSIS                     |
| LDM       | Learning and Development Module                                                                           |
| LWOP      | Leave Without Pay — absence deducted from salary; no leave credit available                               |
| MRF       | Manpower Request Form — official document initiating recruitment for a vacant position                    |
| NAP       | National Archives of the Philippines — archival standards authority                                       |
| NFL       | Notice of No Filed Leave — notice when LWOP is incurred without a leave application                       |
| NOSA      | Notice of Salary Adjustment — formal notification of salary change                                        |
| NOSI      | Notice of Salary Step Increment — formal notification of step increment grant                             |
| NTP       | Notice to Proceed — procurement document starting the contract period clock                               |
| OPCRF     | Office Performance Commitment and Review Form — office-level CSC performance instrument                   |
| PAdES     | PDF Advanced Electronic Signature — standard for digitally signing PDF documents                          |
| PBB       | Performance-Based Bonus — government bonus tied to annual performance ratings                             |
| PCSO      | Philippine Charity Sweepstakes Office                                                                     |
| PDS       | Personal Data Sheet — CS Form 212; official CSC personal information record                               |
| PRAISE    | Program on Awards and Incentives for Service Excellence — government recognition program                  |
| RATA      | Representation and Transportation Allowance — monthly allowance for qualifying positions                  |
| RBAC      | Role-Based Access Control — permission model restricting access by user role                              |
| RPM       | Recruitment and Promotion Module                                                                          |
| SALN      | Statement of Assets, Liabilities, and Net Worth — annual mandatory disclosure for government employees    |
| SCA       | Software Composition Analysis — tool for identifying vulnerabilities in third-party dependencies          |
| SSL V     | Salary Standardization Law V — current salary schedule for career government employees (SG 1–33)          |
| TNA       | Training Needs Analysis — identifying training requirements from competency gap assessment                |
| TOR       | Terms of Reference — PCSO's official procurement specifications for the HRS                               |
| TRAIN Law | Tax Reform for Acceleration and Inclusion Act (RA 10963) — revised income tax brackets                    |
| TWG       | Technical Working Group — PCSO's internal team that authored the TOR                                      |
| UAT       | User Acceptance Testing — formal testing with end-users before production sign-off                        |

**End of Document — PCSO Human Resource System PRD v1.2**

_Prepared by Th/rd Code Solutions Inc. \| April 2026 \| CONFIDENTIAL_
