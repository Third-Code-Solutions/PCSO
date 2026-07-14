# TOR Conformance Audit — PCSO HRS

**Audit date:** 2026-07-04 · **Baseline:** commit e325efe · **Method:** 5 parallel per-module codebase sweeps against `TOR-HS-System.md`
**Verification state at audit:** type-check clean · 936/936 unit tests green

> **Iteration 1 remediation applied 2026-07-05** (see §Iteration 1 Results at bottom).
> Post-iteration coverage: **IMPL 175 (64%) · PARTIAL 61 (22%) · MISSING 28 (10%) · N/A 8** — up from 45% IMPL at baseline.
> The per-item tables below are the BASELINE audit; consult §Iteration 1 Results for items closed since.

Statuses: **IMPL** (works end-to-end) · **PARTIAL** (schema-only, backend-only, or incomplete) · **MISSING** · **N/A** (infra/process item not expressible in code)

## Summary

| TOR Section                      | Items   | IMPL          | PARTIAL       | MISSING      | N/A        |
| -------------------------------- | ------- | ------------- | ------------- | ------------ | ---------- |
| 1.1 File Maintenance             | 58      | 12            | 40            | 6            | 0          |
| 1.2 Recruitment & Promotion      | 29      | 23            | 5             | 1            | 0          |
| 1.3 Personnel Information Mgmt   | 26      | 11            | 8             | 7            | 0          |
| 1.4 Leave Administration         | 14      | 7             | 4             | 3            | 0          |
| 1.5 Time & Attendance            | 15      | 5             | 7             | 3            | 0          |
| 1.6 Learning & Development       | 16      | 16            | 0             | 0            | 0          |
| 1.7 Performance Management       | 7       | 6             | 1             | 0            | 0          |
| 1.8 Payroll (+accounting row)    | 16      | 7             | 6             | 3            | 0          |
| 1.9 Employee Portal              | 13      | 5             | 7             | 1            | 0          |
| 2.1/2.2 EWBM (PRAISE + Wellness) | 5       | 5             | 0             | 0            | 0          |
| 3.1 Operating Environment        | 12      | 6             | 2             | 2            | 2          |
| 3.2 Security                     | 14      | 6             | 7             | 1            | 0          |
| 3.3 API                          | 16      | 5             | 4             | 5            | 2          |
| 3.4 Logging                      | 5       | 0             | 4             | 1            | 0          |
| 3.5 Client Environment           | 14      | 4             | 3             | 5            | 2          |
| 3.6 DB / Backup / Restore        | 12      | 5             | 3             | 2            | 2          |
| **Total**                        | **272** | **123 (45%)** | **101 (37%)** | **40 (15%)** | **8 (3%)** |

Sections 3.7 (supplier deliverables), 3.8 (eligibility), 3.9 (delivery schedule), V (warranty) are procurement/process items — tracked outside code.

## Top gaps by leverage (remediation order)

1. **File Maintenance module absent as a facility (1.1.56/57)** — 34 `fm_*` tables migrated but zero CRUD actions, zero UI, zero seeds; modules bypass FM with hardcoded pgEnums. Closing this flips ~40 PARTIAL items.
2. **No scheduler** — monthly accrual, sick-leave auto-approve (1.4.7), year-end forced-leave (1.4.10), annual retirement notices have correct logic but nothing fires them (no vercel.json crons, no /api/cron).
3. **Payroll data flow (1.8.1/1.8.11/1.8.13)** — no income/deduction CSV upload, no approval-gated salary adjustment, NOSA/NOSI generators TODO; Confidential Agents payroll type unmodeled (1.8.2); no include/exclude tagging (1.8.4); no signatory blocks on register (1.8.6).
4. **Document generators (1.3.8–1.3.12)** — Service Record, NOSI, NOSA, PDS CS-212, ad hoc certificates allocate serials but render no PDF; `step-increment-notice.tsx` built but unwired.
5. **Portal backends without UI (1.9.5/1.9.6/1.5.10)** — shift-change + DTR-correction server actions complete, no page consumes them; 201-upload (1.9.7), personnel movement (1.9.9), ID request (1.9.12) schema-only; promotion application missing (1.9.13).
6. **201-file data model thin (1.3.1)** — no dependents/education/eligibility/family/designation history; blocks PDS generator + qualification reports (1.3.4).
7. **Auth hardening (3.2.6/3.1.7/3.2.7)** — no MFA/TOTP; no Entra ID/SAML SSO (external tenant dependency).
8. **General integration API (3.3.x)** — REST surface is RPM-only; no OAuth2/API keys, batch, async queue, XML; RFC 7807 only on 429s; no accounting-system integration endpoint beyond journal-entries export.
9. **Logging depth (3.4.3/3.4.5)** — audit_logs has 6 of 11 required fields; no transaction log.
10. **Attendance engine shortcuts (1.5.2/1.5.4/1.5.9)** — no biometric device API (CSV only, staging tables orphaned); compute hardcodes default schedule + "ordinary" day type, ignores holidays/suspensions/per-employee schedules; no work-suspension table.
11. **Missing quick wins** — CSP/HSTS headers not emitted (3.2.12), no Dockerfile (3.1.2), no upload templates (3.5.8), leave attachments column absent (1.4.9), LWOP/sex-disaggregated leave reports stubbed (1.4.5/1.4.13/1.4.14).
12. **Workflow definition page (3.5.10) + digital signatures PAdES (3.5.11/12)** — absent.

---

## 1.1 File Maintenance (12 IMPL / 40 PARTIAL / 6 MISSING)

Structural finding: 34 `fm_*` tables defined (`src/lib/db/schema/fm-extensions.ts`) and migrated, but no seed data, no CRUD server actions, no UI route. Only 3 read-only consumers (ldm/tna, ewbm/praise, ewbm/loyalty).

| Item                               | Status  | Evidence                                     | Gap                         |
| ---------------------------------- | ------- | -------------------------------------------- | --------------------------- |
| 1.1.1 Degree/Course                | PARTIAL | fm-extensions.ts:65                          | schema only                 |
| 1.1.2 Blood Type                   | PARTIAL | employees.ts:53 enum                         | hardcoded enum              |
| 1.1.3 BIR Tax Schedule             | IMPL    | government-rates.ts:118 + admin/rates/bir    | —                           |
| 1.1.4 Branch and Division          | IMPL    | offices.ts:17 + admin/offices                | —                           |
| 1.1.5 Civil Status                 | PARTIAL | employees.ts:26 enum                         | hardcoded enum              |
| 1.1.6 Country                      | PARTIAL | fm-extensions.ts:713                         | schema only                 |
| 1.1.7 Courtesy                     | PARTIAL | fm-extensions.ts:692                         | schema only                 |
| 1.1.8 Department                   | IMPL    | offices.ts + admin/offices                   | —                           |
| 1.1.9 Designation                  | PARTIAL | fm-extensions.ts:671                         | schema only                 |
| 1.1.10 Document Request            | PARTIAL | fm-extensions.ts:489                         | module uses hardcoded enum  |
| 1.1.11 Disability                  | MISSING | only employees.isPwd bool                    | no lookup                   |
| 1.1.12 Extension Name              | MISSING | employees.suffix free text                   | no lookup                   |
| 1.1.13 Doc Signatories             | PARTIAL | fm-extensions.ts:527                         | schema only                 |
| 1.1.14 Document Type               | PARTIAL | fm-extensions.ts:463                         | bypassed by enum            |
| 1.1.15 Doc Type Category           | PARTIAL | fm-extensions.ts:449                         | unused                      |
| 1.1.16 Doc Certifier               | PARTIAL | fm-extensions.ts:555                         | schema only                 |
| 1.1.17 Education Attainment        | PARTIAL | fm-extensions.ts:46                          | schema only                 |
| 1.1.18 Eligibility/License         | MISSING | jsonb on vacancy only                        | no lookup table             |
| 1.1.19 Eligibility Category        | PARTIAL | fm-extensions.ts:25                          | schema only                 |
| 1.1.20 Employment Status           | PARTIAL | employees.ts:34/43 enums                     | hardcoded                   |
| 1.1.21 Ethnic Group                | PARTIAL | fm-extensions.ts:232                         | schema only                 |
| 1.1.22 Holiday                     | IMPL    | holidays.ts + admin/holidays                 | —                           |
| 1.1.23 Holiday Type                | PARTIAL | holidays.ts:16 enum                          | hardcoded                   |
| 1.1.24 L&D Type                    | PARTIAL | fm-extensions.ts:109                         | schema only                 |
| 1.1.25 Leave Type                  | PARTIAL | leave.ts:35 + seed                           | no maintenance UI           |
| 1.1.26 LWOP                        | PARTIAL | leave.ts isWithPay flag                      | no dedicated record         |
| 1.1.27 Longevity                   | PARTIAL | fm-extensions.ts:173                         | no CRUD UI                  |
| 1.1.28 Mode of Separation          | PARTIAL | fm-extensions.ts:424                         | schema only                 |
| 1.1.29 Nature of Work              | PARTIAL | fm-extensions.ts:650                         | schema only                 |
| 1.1.30 PCSO Offices/Sector         | IMPL    | offices.ts + admin/offices                   | —                           |
| 1.1.31 Regions & Provinces         | PARTIAL | fm-extensions.ts:194/212                     | unseeded, no UI             |
| 1.1.32 Position Classification     | PARTIAL | fm-extensions.ts:586                         | schema only                 |
| 1.1.33 Position Level              | PARTIAL | fm-extensions.ts:607                         | schema only                 |
| 1.1.34 Position w/ Item No.        | IMPL    | plantilla.ts + plantilla UI                  | —                           |
| 1.1.35 Profession                  | PARTIAL | fm-extensions.ts:253                         | schema only                 |
| 1.1.36 Qualification Standard      | PARTIAL | recruitment.ts:200 jsonb                     | no FM table                 |
| 1.1.37 Relationship                | PARTIAL | fm-extensions.ts:275                         | schema only                 |
| 1.1.38 Religion                    | PARTIAL | fm-extensions.ts:292                         | employee field free text    |
| 1.1.39 Request Status              | PARTIAL | fm-extensions.ts:505                         | bypassed by enum            |
| 1.1.40 Size                        | PARTIAL | fm-extensions.ts:738                         | schema only                 |
| 1.1.41 Gender/Sex                  | PARTIAL | employees.ts:20 enum                         | hardcoded                   |
| 1.1.42 Salary Grade SSL            | IMPL    | government-rates.ts:35 + admin/salary-grades | —                           |
| 1.1.43 CPCS Schedule               | PARTIAL | fm-extensions.ts:369                         | unseeded, no UI             |
| 1.1.44 Job Grade Category          | PARTIAL | fm-extensions.ts:398                         | schema only                 |
| 1.1.45 PhilHealth Deduction        | IMPL    | government-rates.ts:72 + admin/rates         | —                           |
| 1.1.46 Pag-Ibig Deduction          | IMPL    | government-rates.ts:96 + admin/rates         | —                           |
| 1.1.47 Provident Fund              | MISSING | —                                            | absent entirely             |
| 1.1.48 School                      | PARTIAL | fm-extensions.ts:628                         | schema only                 |
| 1.1.49 SL/VL Earned Daily          | PARTIAL | utils/leave/credits.ts                       | hardcoded in code           |
| 1.1.50 Training Institution        | IMPL    | learning.ts:133 + LDM UI                     | fm copy redundant           |
| 1.1.51 Computation Table           | MISSING | logic in utils/leave                         | no lookup table             |
| 1.1.52 Training Program Title      | IMPL    | learning.ts:95 + LDM UI                      | fm copy redundant           |
| 1.1.53 Work Schedule               | IMPL    | attendance workSchedules + UI                | fm copy redundant           |
| 1.1.54 Work Suspension             | PARTIAL | fm-extensions.ts:347                         | no UI, unused by compute    |
| 1.1.55 Competency Baseline         | PARTIAL | fm-extensions.ts:144                         | no CRUD UI                  |
| 1.1.56 FM central source           | PARTIAL | —                                            | modules use hardcoded enums |
| 1.1.57 add/edit/delete/search/view | MISSING | —                                            | no FM CRUD facility         |
| 1.1.58 Extensibility               | PARTIAL | migrations only                              | no runtime facility         |

## 1.2 Recruitment & Promotion (23 IMPL / 5 PARTIAL / 1 MISSING)

| Item                                           | Status  | Evidence                               | Gap                                                 |
| ---------------------------------------------- | ------- | -------------------------------------- | --------------------------------------------------- |
| 1.2.1 MRF prepare/submit                       | IMPL    | actions/rpm/mrf.ts:143+                | e-sign not wired                                    |
| 1.2.2 MRF for publication                      | IMPL    | mrf.ts:372,481                         | —                                                   |
| 1.2.3 MRF feedback                             | IMPL    | mrf.ts:433                             | —                                                   |
| 1.2.4 CSC Form 9                               | IMPL    | mrf.ts:561 + pdf/csc-form-9.tsx        | —                                                   |
| 1.2.5 Duplicate detection                      | IMPL    | mrf.ts:644                             | —                                                   |
| 1.2.6 CSC-received upload                      | IMPL    | mrf.ts:616                             | —                                                   |
| 1.2.7 Applicant portal                         | IMPL    | (applicant-portal) routes + api/rpm    | —                                                   |
| 1.2.8 Scanned docs                             | IMPL    | api/rpm/applications/[id]/documents    | —                                                   |
| 1.2.9 Application status                       | IMPL    | recruitment.ts:71 enum                 | —                                                   |
| 1.2.10 Auto qualification eval                 | IMPL    | utils/rpm/qualification-score.ts       | —                                                   |
| 1.2.11 Validation module                       | IMPL    | applicants.ts:253                      | —                                                   |
| 1.2.12 View positions applied                  | IMPL    | applicants.ts:123,183                  | —                                                   |
| 1.2.13 Assessment Form                         | IMPL    | selection.ts:544                       | —                                                   |
| 1.2.14 Qualified-for-exam list                 | IMPL    | selection.ts:261                       | —                                                   |
| 1.2.15 Exam schedule notify                    | IMPL    | selection.ts:288                       | in-app only, email not wired                        |
| 1.2.16 Not-qualified notify                    | PARTIAL | applicants.ts:379                      | stub — no email/portal send                         |
| 1.2.17 Assessment encoding                     | IMPL    | selection.ts:210,324                   | —                                                   |
| 1.2.18 Exam results notify                     | IMPL    | selection.ts:882                       | —                                                   |
| 1.2.19 Rating Sheet                            | IMPL    | selection.ts:607                       | —                                                   |
| 1.2.20 Interview schedule notify               | PARTIAL | selection.ts:769                       | no interview-schedule entity                        |
| 1.2.21 Summary of Ratings                      | PARTIAL | rating-sheet.tsx                       | no distinct report                                  |
| 1.2.22 Top 5 list                              | IMPL    | selection.ts:650                       | —                                                   |
| 1.2.23 Board recommendation                    | IMPL    | selection.ts:769                       | —                                                   |
| 1.2.24 Status notify                           | PARTIAL | selection.ts:916                       | email TODO                                          |
| 1.2.25 Appointment docs                        | IMPL    | appointment.ts:213-352                 | —                                                   |
| 1.2.26 201 creation                            | IMPL    | utils/rpm/auto-provision.ts:140        | —                                                   |
| 1.2.27 Plantilla/SR/Payroll/Leave provisioning | PARTIAL | auto-provision.ts:174,221              | payroll deferred, SR not seeded, no schedule assign |
| 1.2.28 Profile update w/ approval              | IMPL    | portal-requests.ts:187 + pds-update.ts | —                                                   |
| 1.2.29 Ad hoc reports                          | MISSING | —                                      | no template report builder                          |

## 1.3 PIMM (11 IMPL / 8 PARTIAL / 7 MISSING)

| Item                                        | Status  | Evidence                                               | Gap                                                                          |
| ------------------------------------------- | ------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1.3.1 Personnel info completeness           | PARTIAL | employees.ts:66-151                                    | no dependents/education/eligibility/family/designation/salary-history fields |
| 1.3.2 Search                                | IMPL    | pimm/employees.ts:311                                  | —                                                                            |
| 1.3.3 Organic/non-organic listing           | MISSING | appointmentType enum                                   | lacks Consultant/Confidential Agent/CTI + categorized listing                |
| 1.3.4 Qualification reports                 | PARTIAL | workforce-reports.ts:613                               | education/eligibility null                                                   |
| 1.3.5 Scanned upload w/ validation          | IMPL    | pimm/employee-documents.ts                             | —                                                                            |
| 1.3.6 COE w/ serial                         | IMPL    | documents/coe-generator.tsx:149                        | —                                                                            |
| 1.3.7 COE w/ remunerations                  | IMPL    | document-request-actions.ts:481                        | —                                                                            |
| 1.3.8 Service Record                        | PARTIAL | serial only                                            | no PDF generator                                                             |
| 1.3.9 NOSI                                  | PARTIAL | serial; step-increment-notice.tsx unwired              | not connected                                                                |
| 1.3.10 NOSA                                 | PARTIAL | serial only                                            | no generator                                                                 |
| 1.3.11 PDS                                  | PARTIAL | serial only                                            | no CS Form 212 PDF                                                           |
| 1.3.12 Ad hoc certificates                  | PARTIAL | serial only                                            | no template engine                                                           |
| 1.3.13 Retirement list                      | IMPL    | workforce-reports.ts:127                               | —                                                                            |
| 1.3.14 Loyalty list                         | IMPL    | workforce-reports.ts:295                               | —                                                                            |
| 1.3.15 Step increment list                  | MISSING | (exists in PMM queries:601 but no PIMM report surface) | wire to PIMM reports                                                         |
| 1.3.16 SALN tracking                        | IMPL    | saln/tracking + admin                                  | —                                                                            |
| 1.3.17 PDS tracking                         | IMPL    | workforce-reports.ts:385                               | —                                                                            |
| 1.3.18 Clearance list                       | IMPL    | workforce-reports.ts:493                               | —                                                                            |
| 1.3.19 NAP archival report                  | MISSING | —                                                      | absent                                                                       |
| 1.3.20 Plantilla report                     | IMPL    | plantilla/queries.ts                                   | —                                                                            |
| 1.3.21 Personnel complement                 | MISSING | —                                                      | no headcount/gender/main-vs-branch report                                    |
| 1.3.22 Approving authority update           | MISSING | signatory TODO                                         | no configurable store                                                        |
| 1.3.23 Request tracking                     | IMPL    | document-request-actions.ts                            | —                                                                            |
| 1.3.24 HR accomplishment reports            | MISSING | —                                                      | absent                                                                       |
| 1.3.25 Reassignment/designation/SO tracking | PARTIAL | portal-requests.ts:253                                 | schema-only                                                                  |
| 1.3.26 Ad hoc reports                       | MISSING | —                                                      | absent                                                                       |

## 1.4 LAM (7 IMPL / 4 PARTIAL / 3 MISSING)

| Item                          | Status  | Evidence                       | Gap                                       |
| ----------------------------- | ------- | ------------------------------ | ----------------------------------------- |
| 1.4.1 Ledger upload           | IMPL    | leave-gaps.ts + bulk-ledger.ts | —                                         |
| 1.4.2 Auto credit calc        | IMPL    | utils/leave/credits.ts:186     | not cron-scheduled                        |
| 1.4.3 Auto deduction          | IMPL    | leave/actions.ts:284           | —                                         |
| 1.4.4 CSC Omnibus computation | IMPL    | utils/leave + attendance/rules | —                                         |
| 1.4.5 LWOP list               | MISSING | —                              | report absent                             |
| 1.4.6 LWOP/NFL notifications  | PARTIAL | lwop-notifications.ts          | zero call sites                           |
| 1.4.7 Sick-leave auto-approve | PARTIAL | auto-approve-sick-leave.ts:56  | no scheduler, hardcoded 5d                |
| 1.4.8 Cancellation            | IMPL    | leave/actions.ts:963           | —                                         |
| 1.4.9 Attachments             | MISSING | no column                      | applyLeave stores none                    |
| 1.4.10 Year-end forced deduct | PARTIAL | year-end-forced-leave.ts:45    | no trigger, config hardcoded              |
| 1.4.11 CSC Form 6 view        | IMPL    | approvals UI + CSV             | Form-6 PDF built, unwired                 |
| 1.4.12 Manual encoding/adjust | IMPL    | leave/actions.ts:1336          | —                                         |
| 1.4.13 Reports                | PARTIAL | queries.ts:518                 | sex-disaggregated/LWOP-period stubs empty |
| 1.4.14 Ad hoc                 | MISSING | leave-gaps.ts:467 stub         | returns empty                             |

## 1.5 TAM (5 IMPL / 7 PARTIAL / 3 MISSING)

| Item                            | Status  | Evidence                          | Gap                                                    |
| ------------------------------- | ------- | --------------------------------- | ------------------------------------------------------ |
| 1.5.1 Shift schedules           | PARTIAL | attendance.ts:44 + schedules UI   | fixed weekly only; assignment tables unused by compute |
| 1.5.2 Biometric API             | MISSING | import/actions.ts CSV only        | no device API/push/poll; staging tables orphaned       |
| 1.5.3 TITO file upload          | IMPL    | import/actions.ts:217             | xlsx not parsed                                        |
| 1.5.4 Data association          | PARTIAL | import/actions.ts:175             | ignores schedule/holiday/suspension                    |
| 1.5.5 Grace periods             | IMPL    | attendance.ts:55 + rules.ts:58    | —                                                      |
| 1.5.6 Lunch TITO                | PARTIAL | schema present                    | no capture path                                        |
| 1.5.7 OT approval               | IMPL    | overtime/actions.ts:141           | —                                                      |
| 1.5.8 OT auto-compute           | IMPL    | compute.ts:164,200                | —                                                      |
| 1.5.9 DTR w/ calendar           | PARTIAL | DtrCalendar logs only             | no holidays/suspensions/leaves embedded                |
| 1.5.10 DTR corrections view     | PARTIAL | portal/dtr-correction.ts complete | no UI route                                            |
| 1.5.11 Tardiness/absence notify | MISSING | anomaly display only              | nothing dispatched                                     |
| 1.5.12 DTR reports              | PARTIAL | analytics + timesheets CSV        | office filter only; missing 2.5-day/tabulation         |
| 1.5.13 Form 48                  | IMPL    | dtr/actions.ts:58 CSV             | PDF unwired                                            |
| 1.5.14 Ad hoc                   | MISSING | —                                 | absent                                                 |
| 1.5.15 Role dashboards          | PARTIAL | dashboard/page.tsx:269            | generic roles, not per-TOR-position                    |

## 1.6 LDM — 16/16 IMPL ✅ (evidence: schema/learning.ts, actions/ldm/_, utils/ldm/_)

## 1.7 PMM — 6 IMPL / 1 PARTIAL (1.7.7 ad hoc = parametrized export only)

## 1.8 Payroll (7 IMPL / 6 PARTIAL / 3 MISSING)

| Item                             | Status  | Evidence                               | Gap                                                          |
| -------------------------------- | ------- | -------------------------------------- | ------------------------------------------------------------ |
| 1.8.1 Income/deduction upload    | MISSING | —                                      | no CSV/Excel import                                          |
| 1.8.2 All payroll types          | PARTIAL | payroll.ts:29-38 (8 scopes)            | Confidential Agents type absent                              |
| 1.8.3 Auto deductions            | IMPL    | utils/payroll/deductions.ts + tax.ts   | —                                                            |
| 1.8.4 Include/exclude tagging    | PARTIAL | actions.ts:232-275                     | scope-auto only, no per-employee tags                        |
| 1.8.5 Loan details               | IMPL    | payroll.ts:303-336 + loans/actions     | —                                                            |
| 1.8.6 Signatories w/ workflow    | PARTIAL | lock→approve→release chain             | no configurable signatories; register lacks signature blocks |
| 1.8.7 Register                   | IMPL    | pdf/payroll-register.tsx               | —                                                            |
| 1.8.8 Summary                    | IMPL    | payroll/[periodId]/page.tsx            | —                                                            |
| 1.8.9 Bank hash CSV              | IMPL    | bank-configs/actions.ts:237-307        | —                                                            |
| 1.8.10 Step increment report     | IMPL    | utils/performance/step-eligibility.ts  | —                                                            |
| 1.8.11 Salary update w/ approval | MISSING | —                                      | no workflow                                                  |
| 1.8.12 201 auto-update on salary | PARTIAL | step-increment path only               | blocked by 1.8.11                                            |
| 1.8.13 NOSA/NOSI 201 update      | PARTIAL | enum values only                       | generators TODO                                              |
| 1.8.14 Report registers          | PARTIAL | fixed set                              | not HRD-configurable                                         |
| 1.8.15 Ad hoc                    | MISSING | —                                      | absent                                                       |
| 1.8.16 Accounting posting        | IMPL    | api/payroll/journal-entries (JSON+CSV) | —                                                            |

## 1.9 Employee Portal (5 IMPL / 7 PARTIAL / 1 MISSING)

| Item                         | Status  | Evidence                                  | Gap                                     |
| ---------------------------- | ------- | ----------------------------------------- | --------------------------------------- |
| 1.9.1 Records access         | PARTIAL | payslips/leave/DTR/training/announcements | loans ledger + 201 docs not ESS-exposed |
| 1.9.2 Leave apply            | IMPL    | leave/apply                               | —                                       |
| 1.9.3 Leave cancel           | IMPL    | leave/actions.ts:963                      | —                                       |
| 1.9.4 OT request             | IMPL    | attendance/overtime/new                   | —                                       |
| 1.9.5 Shift change           | PARTIAL | portal/shift-change.ts                    | no UI page                              |
| 1.9.6 DTR correction         | PARTIAL | portal/dtr-correction.ts                  | no UI page                              |
| 1.9.7 201 upload             | PARTIAL | portal-requests.ts:152                    | schema-only                             |
| 1.9.8 Certification requests | IMPL    | portal/document-requests                  | —                                       |
| 1.9.9 Personnel movement     | PARTIAL | portal-requests.ts:253                    | schema-only                             |
| 1.9.10 HR forms              | PARTIAL | SALN/CSC-9/Form-6 PDFs                    | no PDS/PES/Clearance/Pass-Out/OB        |
| 1.9.11 PDS update            | IMPL    | portal/pds-update                         | —                                       |
| 1.9.12 ID request            | PARTIAL | portal-requests.ts:222                    | schema-only                             |
| 1.9.13 Promotion application | MISSING | —                                         | absent                                  |

## 2. EWBM — 5/5 IMPL ✅ (loyalty.ts, retirement.ts, praise.ts, wellness.ts) — retirement notices manual-trigger, cron pending

## 3. Technical (per-item detail)

**3.1:** 3.1.1 PARTIAL (cloud only, no on-prem packaging) · 3.1.2 MISSING (no Docker) · 3.1.3/3.1.4 N/A · 3.1.5 IMPL (Postgres=equivalent) · 3.1.6 N/A (platform) · 3.1.7 MISSING (no SAML/OAuth/LDAP SSO) · 3.1.8 IMPL (RBAC) · 3.1.9 IMPL · 3.1.10 IMPL · 3.1.11 IMPL (Resend) · 3.1.12 PARTIAL (MFA absent)

**3.2:** 3.2.1 PARTIAL (no HSTS emitted) · 3.2.2 IMPL · 3.2.3 PARTIAL (column encryption future) · 3.2.4 PARTIAL (CSP missing) · 3.2.5 IMPL · 3.2.6 PARTIAL (no MFA) · 3.2.7 MISSING (no Entra) · 3.2.8 PARTIAL (no masking) · 3.2.9 IMPL · 3.2.10 IMPL · 3.2.11 PARTIAL (CSP+HSTS absent) · 3.2.12 PARTIAL (no CSP header) · 3.2.13 IMPL · 3.2.14 IMPL (all-or-nothing uploads)

**3.3:** 3.3.1 MISSING (no CAS integration) · 3.3.2 MISSING · 3.3.3 PARTIAL (JWT for RPM only; no OAuth2/API keys) · 3.3.4 IMPL · 3.3.5 PARTIAL (RPM-only CRUD) · 3.3.6 MISSING (no batch) · 3.3.7 IMPL · 3.3.8 IMPL · 3.3.9 MISSING (no XML) · 3.3.10 PARTIAL · 3.3.11 IMPL (rate limiting) · 3.3.12 IMPL · 3.3.13 N/A · 3.3.14 PARTIAL (7807 on 429 only) · 3.3.15 MISSING (no async queue) · 3.3.16 PARTIAL (forms only, no CSC API)

**3.4:** 3.4.1 PARTIAL (no suspicious-activity alerting) · 3.4.2 PARTIAL (no transaction log) · 3.4.3 PARTIAL (6/11 audit fields — missing outcome, reason, module, sub-module, severity, alerts) · 3.4.4 PARTIAL (Sentry, no error-code field) · 3.4.5 MISSING (no transaction-log table)

**3.5:** 3.5.1 IMPL · 3.5.2 IMPL · 3.5.3 IMPL · 3.5.4 PARTIAL · 3.5.5 PARTIAL · 3.5.6 PARTIAL · 3.5.7 IMPL · 3.5.8 MISSING (no standardized templates) · 3.5.9 IMPL (staging/review) · 3.5.10 MISSING (no workflow definition page) · 3.5.11 MISSING (JWT/QR verify ≠ digital signature) · 3.5.12 MISSING (no PKI/PAdES) · 3.5.13 N/A · 3.5.14 MISSING (no load test)

**3.6:** 3.6.1 N/A · 3.6.2 IMPL · 3.6.3 MISSING (no Entra DB auth) · 3.6.4 PARTIAL · 3.6.5 N/A · 3.6.6 IMPL · 3.6.7 PARTIAL · 3.6.8 MISSING (no unmask alerting) · 3.6.9 IMPL · 3.6.10 IMPL · 3.6.11 IMPL (documented PITR) · 3.6.12 PARTIAL (CSV only)

---

## Iteration 1 Results (2026-07-05)

**Closed MISSING→IMPL (12):** 1.1.11 disabilities · 1.1.12 extension names · 1.1.18 eligibilities/licenses · 1.1.47 provident fund rates · 1.1.51 leave computation table (CSC 30-row accrual seed) · 1.1.57 FM CRUD facility (`/admin/file-maintenance`, 35 lookups, generic add/edit/deactivate/search/view, audit-logged) · 1.4.5 LWOP list report · 1.4.9 leave attachments (upload→signed-URL view; fixed latent bug where SL>3-day applications were unsubmittable) · 1.4.14 leave ad hoc reports · 3.1.2 Docker (Dockerfile+compose+standalone) · 3.4.5 transaction_logs · 3.5.8 standardized upload templates.

**Closed PARTIAL→IMPL (41):** 29 FM lookups now schema+UI+seed (1.1.1, .6, .7, .9, .10, .13–.17, .19, .21, .24, .27–.29, .31–.33, .35, .37–.40, .43, .44, .48, .54, .55 — seeded: 17 regions, 82 provinces, 32 ethnic groups, 15 religions, 20 relationships, 60 countries, 24 professions, 30 degree courses, 24 schools, doc types/categories/statuses, competencies, job grade categories, longevity milestones) · 1.4.7 sick-leave auto-approve (daily cron + config table) · 1.4.10 year-end forced leave (Dec 31 cron) · 1.4.13 leave reports (sex-disaggregated, filed totals day/month/year, disapproved, CSV exports) · 1.5.10 DTR-correction UI (employee + supervisor + HR surfaces) · 1.9.5 shift-change portal · 1.9.6 DTR-correction portal · 2.1.3 retirement notices (Jan 1 cron) · 3.2.1 HSTS · 3.2.11/3.2.12 CSP emitted · 3.4.2/3.4.3 audit log full 11-field set (outcome/reason/module/sub-module/severity/alert_sent).

**Strengthened:** 1.4.2 monthly accrual now cron-scheduled with idempotency guard · 1.4.6 LWOP notices wired (HR-triggered; NFL auto-detect deferred to attendance-engine iteration — stays PARTIAL).

**New infra:** `file_maintenance` RBAC resource (Super Admin + HR Admin full, oversight read-only) · 4 Vercel crons behind CRON_SECRET · CSP/HSTS headers · migrations 2026-07-04-01/02/03/14 · +35 unit tests (971 total, all green; production build verified).

## Iteration 2 Results (2026-07-11)

**Payroll batch (TOR 1.8):**

- **1.8.1 income/deduction bulk upload → IMPL (backend + compute).** `payroll_employee_inputs` committed rows are now consumed by `processPayroll` (injected as post-tax `otherAdjustments`) and survive re-processing. Parse/validate/stage/commit chain (`bulk-inputs.ts`, `payroll-gaps.ts`) with SEC-010 all-or-nothing + advisory lock. _Deferred: upload/preview UI page + include/exclude toggle UI._
- **1.8.2 Confidential Agents payroll type → IMPL.** `confidential_agents` scope now handled in `computeRecordForScope` (was falling through to `default: throw` — every employee errored). Computed with JO/COS deduction rules; no in-run loan collection.
- **1.8.4 include/exclude tagging → IMPL (enforced).** `setRecordInclusion` action + `included`/`exclusion_reason` columns. Excluded records are now omitted from the **bank hash file** (was a payment bug — excluded staff still got paid), the **register**, and **period totals**; kept visible in the record list for re-inclusion. _Note: remittance (BIR/GSIS/PhilHealth/Pag-IBIG) + journal-entry exports still omit the `included` filter — latent only (no exclude-UI caller of `setRecordInclusion` ships this release); MUST be added in the same PR as the include/exclude UI._
- **1.8.6 register signatories → IMPL.** Configurable chain (`fm_document_signatories`, FM-maintained) resolved server-side and rendered as a Prepared/Certified/Approved signature band on the register PDF.
- **1.8.15 payroll ad-hoc report → PARTIAL (backend ready).** `getPayrollAdHocReport` + `report-builder` column catalog complete/tested. _Deferred: reports UI page._

**PIMM document generators (TOR 1.3):**

- **1.3.8 Service Record → IMPL.** `service-record-generator` wired into `processDocumentRequest` (serial `SR-…`, `buildServiceHistory`, PDF, storage, audit).
- **1.3.11 PDS CS-212 → IMPL (data-backed sections).** `pds-generator` wired (serial `PDS-…`). Family/education/eligibility/voluntary sections render blank pending the 201-file expansion (Iter 3).
- **1.3.12 ad-hoc certificate → IMPL.** `adhoc-generator` (template-driven, refuses on unresolved placeholders) + template picker in the process-request form + `getActiveCertificateTemplates`.
- Fixed misleading state: SERVICE_RECORD/PDS/AD_HOC previously marked "ready" with a null document URL yet notified the employee — now produce real PDFs.

**Correctness / fail-safe:**

- `payroll/types.ts` `isRegularEmployee` inverted to an **allowlist** (organic types) with `isJobOrderOrCOS` derived as its complement — future non-organic enum values fail SAFE (no benefits). Regression-guarded by `types.test.ts`.
- Step-increment eligibility (`getEligibleEmployeesForStepIncrement`) gained the organic allowlist (TOR §10.5 cond. 3 — JO/COS/consultant/confidential excluded).
- `implementStepIncrement` now resets `employees.date_last_increment` (CSC 3-year clock, §10.5).
- `nosi_document_url` schema/migration type drift aligned to `text`.

**Deploy pipeline fix (was silently orphaning migrations):**

- `deploy-production.yml` / `deploy-staging.yml` `db:apply-sql` glob widened `2026-07-03-*` → `2026-07-*` so the `2026-07-04-*` (Iter 1) and `2026-07-05-*` (Iter 2) dated migrations reach the gated pipeline (previously only `2026-07-03-*` was applied; Iter-1 tables reached prod only via manual application).

**Verified:** type-check clean · lint · production build (exit 0) · 1036/1036 unit tests (+4 new). Prod DB probe confirmed the 6 `2026-07-05-*` migrations are additive/backward-compatible (enum ADD VALUE + new tables/columns) and applied ahead of the code deploy.

**Deferred to Iter 2b / Iter 3 (schema/PDF scaffolding ships as safe unused code):**

- NOSA generator + salary-adjustment workflow/UI (1.8.11/1.8.12/1.8.13) — `salary_adjustments` table + `SalaryAdjustmentNoticePdf` present but no actions/UI.
- NOSI PDF wiring (1.3.9 / PIM-014) — `StepIncrementNoticePdf` + `nosi_serial`/`nosi_document_url` columns present but the PDF is not yet generated (avoids adding non-atomic multi-step writes to the Supabase-client step-increment path).
- Payroll income/deduction upload UI, include/exclude toggle UI, payroll reports UI.
- Remittance/journal `included` filter (see 1.8.4 note).

## Iteration 3 Results (2026-07-15)

**201-file expansion (TOR 1.3):**

- **1.3.1 → IMPL.** 7 new child tables (`employee_family_members`, `employee_education`, `employee_eligibilities`, `employee_work_experiences`, `employee_voluntary_works`, `employee_external_trainings`, `employee_designations`) + 16 CS Form 212 columns on `employees` (place of birth, height/weight, SSS, telephone, permanent address, dual citizenship, distinctions/memberships, page-4 questionnaire, gov't ID). 29 CRUD server actions (`pimm/employee-201.ts`), profile UI at `/employees/[id]/201`. Migration `2026-07-15-01`.
- **1.3.3 → IMPL.** `cti` + `consultant` appointment types added; ORGANIC/NON_ORGANIC allowlists centralized (`constants/appointment-types.ts`) and applied at all 11 gate sites (leave accrual/eligibility, payroll scopes, dashboard counts) — fail-safe posture regression-tested. Personnel Categories report + UI.
- **1.3.11 → IMPL (full).** PDS generator now renders Sections I–VIII + page-4 questionnaire from real data via pure `pds-mapper` (18 tests).
- **1.3.15/1.3.19/1.3.21/1.3.24 → IMPL.** Step-increment report surface, NAP archival, Personnel Complement (male/female, plantilla filled/vacant, HO-vs-branch), HR accomplishment (per-processor statistics) — actions + UIs + CSV.
- **1.3.25 → IMPL.** `employee_designations` history written on movement effect; designation CRUD in profile.
- **1.3.26 + 1.2.29 → IMPL.** Employee + Applications ad-hoc report builders (pure column catalog, 24 tests) + tabbed UI.
- **1.3.22 → IMPL.** FM-maintained signatory chains (`fm_document_signatories`, FM CRUD) now consumed by NOSA/NOSI issuance; payroll register already wired (Iter 2).

**Employee Portal (TOR 1.9):**

- **1.9.7 → IMPL.** 201 self-upload (`/portal/document-upload`, 7MB cap) + HR validation queue (`/employees/document-validation`) committing into `employee_documents`.
- **1.9.9 → IMPL.** Personnel movement submit/cancel + supervisor endorse + HR decide; on effect updates `employees.officeId` + designation history. (Separation status changes remain in HR module per §12.5.)
- **1.9.12 → IMPL.** ID requests (FM sizes) + HR processing queue.
- **1.9.13 → IMPL.** Internal promotion applications: `applications.employee_id` link, portal lists published vacancies, 201-prefilled application.
- **1.9.10 → IMPL.** Blank HR forms pack (PDS, Form 6, SALN, Office Clearance, Pass-Out, OB, PES) as server-rendered PDFs.
- **1.9.1 → IMPL.** `/portal/my-documents` (own committed 201 docs, signed URLs); loans/payslips already ESS-accessible.

**Payroll deferrals (TOR 1.8):**

- **1.8.11/1.8.12/1.8.13 + 1.3.10 → IMPL.** Salary adjustment workflow (create→approve/disapprove→effected) w/ NOSA serial + PDF + 201 grade/step update in one tx + notification; UI at `/payroll/salary-adjustments`. NOSI PDF now issued on step-increment implementation (serial + storage + notify; increment never rolled back on PDF failure).
- **1.8.1 → IMPL (full).** Inputs upload UI (`/payroll/[periodId]/inputs`): CSV template, staged preview, all-or-nothing commit.
- **1.8.4 → IMPL (full).** Include/exclude toggle UI w/ reason dialog; `included=true` filter added to ALL remittance queries (BIR 1601-C/2316, GSIS, PhilHealth, Pag-IBIG) + journal-entries API — closing the Iter-2 latent gap.
- **1.8.15 → IMPL (full).** Payroll ad-hoc reports UI (`/payroll/reports`).

**Verified:** type-check clean · lint clean · production build (all 18 new routes) · **1100/1100 unit tests** (+64: pds-mapper 18, adhoc-report 24, salary-adjustment 22). Migration `2026-07-15-01` (additive: 2 enum values, 16 columns, 7 tables + RLS, 1 FK column) applied to prod ahead of deploy.

## Remediation iterations (loop plan)

- **Iter 1:** FM module (generic CRUD + seeds + new lookups) · cron scheduler (accrual/sick-auto-approve/year-end/retirement) · CSP+HSTS · audit-log field expansion + transaction log · leave attachments · LWOP + advanced leave reports · portal UIs (shift-change, DTR-correction) · Docker · upload templates
- **Iter 2:** Payroll batch — income/deduction CSV upload, salary adjustment workflow + NOSA/NOSI generators + 201 sync, confidential_agents type, include/exclude tagging, signatory blocks · document generators (Service Record, PDS CS-212, ad hoc certs)
- **Iter 3:** 201-file expansion (dependents/education/eligibility) + organic/non-organic + PIMM reports (complement, NAP, HR accomplishment, step-increment surface) · portal completions (201 upload, personnel movement UI, ID request UI, promotion application, HR forms)
- **Iter 4:** Attendance engine (schedule/holiday/suspension-aware compute, biometric API, lunch TITO, notifications, report filters, Form 48/Form 6 PDF wiring) · interview scheduling + applicant email notifications
- **Iter 5:** API v1 (OAuth2/API keys, batch, async jobs, RFC 7807 everywhere, XML) · MFA · workflow definition page · digital signatures (PAdES) · monitoring/alerting · load-test harness · Entra SSO (needs PCSO tenant — external dependency)
