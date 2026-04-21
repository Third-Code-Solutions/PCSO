# LDM Server Actions - Usage Guide

Quick reference for using the Learning & Development Module server actions.

---

## 📦 Import Actions

```typescript
import {
  // Programs
  createTrainingProgram,
  updateTrainingProgram,
  listMandatoryPrograms,

  // Providers
  createTrainingProvider,
  listActiveProviders,

  // Runs
  scheduleTraining,
  submitScheduleForApproval,
  approveSchedule,
  computeTrainingCost,

  // Participants
  addParticipant,
  confirmAttendance,
  markParticipantCompleted,

  // Certificates
  generateTrainingCertificate,

  // Competency & TNA
  recordCompetencyAssessment,
  runTrainingNeedsAnalysis,

  // Compliance & Reports
  getMandatoryComplianceReport,
  getTrainingExpenseSummary,
} from "@/lib/actions/learning";
```

---

## 🎯 Common Use Cases

### 1. Create a Training Program

```typescript
const result = await createTrainingProgram({
  code: "TECH-001",
  title: "Advanced Database Management",
  lndType: "technical",
  objectives: "Master database optimization and security",
  targetAudience: ["specialists", "managers"],
  mandatoryFlag: false,
  budgetPhp: "50000.00",
  participantCount: 20,
  durationDays: 3,
  requirementsChecklist: [
    "Basic SQL knowledge",
    "Laptop with PostgreSQL installed",
  ],
  learningObjectives: [
    "Understand database indexing strategies",
    "Implement row-level security",
    "Optimize query performance",
  ],
});

// result.data contains the created program with generated ID
console.log(result.data.id);
```

### 2. Schedule a Training Run

```typescript
// Step 1: Create the run
const runResult = await scheduleTraining({
  programId: "uuid-of-program",
  providerId: "uuid-of-provider",
  scheduledStart: "2026-05-15T08:00:00Z",
  scheduledEnd: "2026-05-17T17:00:00Z",
  venue: "PCSO Training Center, Manila",
  facilitatorFees: "15000.00",
  venueCost: "10000.00",
  perParticipantCost: "2000.00",
  plannedHeadcount: 20,
  createdByEmployeeId: "uuid-of-hr-staff",
});

const runId = runResult.data.id;

// Step 2: Add participants
await addParticipant({
  runId,
  employeeId: "uuid-of-employee-1",
});

await addParticipant({
  runId,
  employeeId: "uuid-of-employee-2",
});

// Step 3: Submit for approval
await submitScheduleForApproval(runId);

// Step 4: Approve (by approver)
await approveSchedule(runId, "uuid-of-approver");
```

### 3. Record Attendance & Issue Certificate

```typescript
// During training session
await confirmAttendance({
  participantId: "uuid-of-participant",
  sessionDate: "2026-05-15",
  attendanceStatus: "present",
  timeIn: "2026-05-15T08:30:00Z",
  timeOut: "2026-05-15T17:00:00Z",
});

// After training completion
await markParticipantCompleted(
  "uuid-of-participant",
  95.5, // post-assessment score
);

// Generate certificate
const certResult = await generateTrainingCertificate({
  participantId: "uuid-of-participant",
  issuedByEmployeeId: "uuid-of-hr-admin",
});

// Certificate number: CT-2026-123456
console.log(certResult.data.certificateNumber);
console.log(certResult.data.qrTokenJwt); // 5-year JWT for verification
```

### 4. Run Training Needs Analysis

```typescript
// Record competency assessments
await recordCompetencyAssessment({
  employeeId: "uuid-of-employee",
  domain: "technical",
  competencyCode: "DATABASE_MGMT",
  score: 2.5,
  level: "developing",
  assessedAt: "2026-04-01",
  assessorEmployeeId: "uuid-of-supervisor",
  cycleYear: 2026,
});

// Run TNA to identify gaps
const tnaResult = await runTrainingNeedsAnalysis({
  employeeId: "uuid-of-employee",
  positionRequirements: [
    {
      competencyCode: "DATABASE_MGMT",
      requiredLevel: "proficient", // Gap: proficient (2) - developing (1) = 1 level
    },
    {
      competencyCode: "CLOUD_ARCHITECTURE",
      requiredLevel: "advanced", // Gap: 3 levels (no assessment exists)
    },
  ],
});

// tnaResult.data contains identified gaps with suggested training programs
```

### 5. Check Mandatory Compliance

```typescript
// Get overall compliance summary
const summary = await getComplianceSummary(2026);

console.log(`Compliance Rate: ${summary.complianceRate}%`);
console.log(`Total Employees: ${summary.totalEmployees}`);
console.log(`Total Required Completions: ${summary.totalRequiredCompletions}`);
console.log(`Total Compliant: ${summary.totalCompliantCompletions}`);

// Get detailed compliance report
const report = await getMandatoryComplianceReport({
  cycleYear: 2026,
  officeId: "uuid-of-office", // optional filter
  programId: "uuid-of-program", // optional filter
});

// Find non-compliant employees
const nonCompliant = report.filter((r) => !r.isCompliant);
console.log(`${nonCompliant.length} employees need follow-up`);
```

### 6. Generate Training Expense Report

```typescript
// Get summary
const expenseSummary = await getTrainingExpenseSummary(2026);

console.log(`Total Spend: PHP ${expenseSummary.totalExpense.toFixed(2)}`);
console.log(`Total Runs: ${expenseSummary.totalRuns}`);
console.log(`Total Participants: ${expenseSummary.totalParticipants}`);

// Breakdown by L&D type
Object.entries(expenseSummary.byType).forEach(([type, stats]) => {
  console.log(`${type}: ${stats.runs} runs, PHP ${stats.expense.toFixed(2)}`);
});

// Get detailed report with filters
const detailedReport = await getTrainingExpenseReport({
  cycleYear: 2026,
  lndType: "technical", // optional filter
  programId: "uuid-of-program", // optional filter
});
```

---

## 🔧 Advanced Patterns

### Multi-Level Approval Chain

```typescript
// Set up approval chain (3 levels)
await setupApprovalChain({
  runId: "uuid-of-run",
  approvers: [
    {
      approverEmployeeId: "uuid-of-division-chief",
      approverRole: "Division Chief",
      sequenceOrder: 1,
    },
    {
      approverEmployeeId: "uuid-of-hrd-manager",
      approverRole: "HRD Manager",
      sequenceOrder: 2,
    },
    {
      approverEmployeeId: "uuid-of-agm",
      approverRole: "AGM",
      sequenceOrder: 3,
    },
  ],
});

// Each approver must approve in sequence
await approveSchedule(runId, "uuid-of-division-chief"); // First approval
await approveSchedule(runId, "uuid-of-hrd-manager"); // Second approval
const finalApproval = await approveSchedule(runId, "uuid-of-agm"); // Final approval

if (finalApproval.allApproved) {
  console.log("Training run is now approved!");
}
```

### Batch Participant Management

```typescript
const employeeIds = [
  "uuid-employee-1",
  "uuid-employee-2",
  "uuid-employee-3",
  "uuid-employee-4",
  "uuid-employee-5",
];

// Add all participants
for (const employeeId of employeeIds) {
  await addParticipant({
    runId: "uuid-of-run",
    employeeId,
  });
}

// Get all participants with attendance
const participants = await getParticipantsByRun("uuid-of-run");

console.log(`Total Participants: ${participants.length}`);
console.log(
  `Completed: ${participants.filter((p) => p.status === "completed").length}`,
);
```

### Dynamic Cost Calculation

```typescript
// Cost updates automatically when you update the run
await updateTrainingRun({
  id: "uuid-of-run",
  perParticipantCost: "2500.00", // Updated from 2000
  facilitatorFees: "20000.00", // Updated from 15000
});

// Budget is auto-recomputed
const cost = await computeTrainingCost("uuid-of-run");

console.log(`Per Participant: PHP ${cost.perParticipantCost}`);
console.log(`Facilitator Fees: PHP ${cost.facilitatorFees}`);
console.log(`Venue Cost: PHP ${cost.venueCost}`);
console.log(`Total Cost: PHP ${cost.totalCost}`);
// Formula: (2500 × 20) + 20000 + 10000 = PHP 80,000
```

---

## 🚨 Error Handling

All actions return `{ success: true, data: T }` on success and throw errors on failure.

```typescript
try {
  const result = await createTrainingProgram({
    code: "TECH-001",
    title: "Database Management",
    lndType: "technical",
    targetAudience: ["specialists"],
    mandatoryFlag: false,
  });

  console.log("Program created:", result.data.id);
} catch (error) {
  if (error instanceof ZodError) {
    console.error("Validation failed:", error.errors);
  } else {
    console.error("Operation failed:", error.message);
  }
}
```

### Common Validation Errors

- **Duplicate code:** "Training program with code 'TECH-001' already exists"
- **Missing participant:** "Participant not found"
- **Invalid status:** "Cannot remove participant who has already completed the training"
- **Duplicate participant:** "Employee is already a participant in this training run"
- **Certificate exists:** "Certificate already exists for this participant"

---

## 📊 Data Structures

### Training Program

```typescript
{
  id: string;
  code: string;
  title: string;
  lndType: "technical" | "managerial" | "supervisory" | "foundational" | "scholarship";
  objectives?: string;
  targetAudience: Array<"all" | "supervisors" | "managers" | "rank_and_file" | "specialists">;
  mandatoryFlag: boolean;
  budgetPhp?: string;
  participantCount?: number;
  durationDays?: number;
  requirementsChecklist: string[];
  learningObjectives: string[];
}
```

### Training Run

```typescript
{
  id: string;
  runNumber: string; // TRUN-YYYY-NNNNNN
  programId: string;
  providerId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  venue: string;
  facilitatorFees: string;
  venueCost: string;
  perParticipantCost: string;
  plannedHeadcount: number;
  actualHeadcount: number;
  totalBudget: string; // Auto-computed
  status: "draft" |
    "for_approval" |
    "approved" |
    "scheduled" |
    "in_progress" |
    "completed" |
    "cancelled";
}
```

### Certificate

```typescript
{
  id: string;
  participantId: string;
  certificateNumber: string; // CT-YYYY-NNNNNN
  issuedAt: Date;
  issuedByEmployeeId: string;
  qrTokenJwt: string; // 5-year HS256 JWT
  pdfUrl?: string; // Supabase Storage URL (to be implemented)
}
```

---

## 🔗 Related Documentation

- [LDM Completion Summary](./LDM_COMPLETION_SUMMARY.md)
- [Database Schema](../src/lib/db/schema/learning.ts)
- [PRD Section 4.6](../CLAUDE.md#m6-learning--development-module-ldm--5-covered-missing)

---

**Last Updated:** April 2026
