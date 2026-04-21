# Leave Administration Module (LAM) - Utilities

This directory contains utilities for the PCSO HRIS Leave Administration Module (M4/LAM), implementing the requirements defined in the PRD.

## Implemented PRD Gaps

### LAM-006: Auto-approval of Sick Leave After 5 Business Days

**File:** `auto-approve-sick-leave.ts`

**Requirement:** Automatically approve sick leave applications that have been pending for more than 5 business days without approver action.

**Implementation:**

- Queries all pending sick leave applications
- Calculates business days waiting (excluding weekends)
- Auto-approves applications exceeding the 5-day threshold
- Sets `autoApproved` flag and `autoApprovedAt` timestamp
- Creates audit log entries for each auto-approval
- Notifies both the employee and HR admins

**Scheduling:** Should run daily via cron job (recommended: 6:00 AM)

**Usage:**

```typescript
import { autoApproveSickLeave } from "@/lib/utils/leave/auto-approve-sick-leave";

// Auto-approve with default 5 business day timeout
const result = await autoApproveSickLeave();

// Or specify custom timeout
const result = await autoApproveSickLeave(7); // 7 business days
```

**Returns:**

```typescript
{
  processed: number; // Number of applications auto-approved
  errors: Array<{
    // Any errors encountered
    applicationId: string;
    message: string;
  }>;
}
```

---

### LAM-009: Year-End Forced Leave Auto-Deduction

**File:** `year-end-forced-leave.ts`

**Requirement:** Per CSC Omnibus Rules, employees with VL balance ≥ 10 days as of December 31 must use 5 days as forced leave. If unused, the system automatically deducts 5 days from their VL balance.

**Implementation:**

- Identifies employees with VL balance ≥ 10 days
- Checks if they've already used sufficient leave during the year
- Deducts 5 days from VL balance if forced leave not used
- Creates audit log entries with full deduction details
- Creates a `consumed_auto` leave application record for tracking
- Notifies affected employees
- Uses advisory locks to prevent race conditions

**Scheduling:** Should run once per year on December 31 at 23:55

**Usage:**

```typescript
import { yearEndForcedLeaveDeduction } from "@/lib/utils/leave/year-end-forced-leave";

// Deduct for current year
const result = await yearEndForcedLeaveDeduction();

// Or specify a different year
const result = await yearEndForcedLeaveDeduction(2024);
```

**Returns:**

```typescript
{
  processed: number; // Number of employees processed
  skipped: number; // Employees skipped (already used leave or balance < 10)
  errors: Array<{
    // Any errors encountered
    employeeId: string;
    message: string;
  }>;
}
```

---

### LAM-011: LWOP and No Filed Leave (NFL) Notifications

**File:** `lwop-notifications.ts`

**Requirement:** When an employee has LWOP (Leave Without Pay), notify both the employee and the payroll section for salary deduction processing.

**Implementation:**

Three notification functions:

1. **`notifyLWOP`** - Send LWOP notification for confirmed LWOP events
2. **`notifyNoFiledLeave`** - Notify about absences without filed leave applications
3. **`checkAndNotifyInsufficientCredits`** - Proactive warning for potential LWOP

**Usage:**

```typescript
import {
  notifyLWOP,
  notifyNoFiledLeave,
  checkAndNotifyInsufficientCredits,
} from "@/lib/utils/leave/lwop-notifications";

// Notify about confirmed LWOP
await notifyLWOP({
  employeeId: "uuid",
  lwopDays: 3,
  periodStart: "2024-01-15",
  periodEnd: "2024-01-17",
  reason: "insufficient_credits",
});

// Notify about no filed leave
await notifyNoFiledLeave("employee-uuid", ["2024-01-15", "2024-01-16"]);

// Check and warn about insufficient credits
await checkAndNotifyInsufficientCredits("employee-uuid", 5);
```

**Integration Points:**

- Should be called during attendance/DTR processing
- Should be called during leave application processing
- Should be called during payroll preparation

---

## Schema Changes

### Leave Applications Table

Added new columns to `leave_applications`:

```typescript
autoApproved: boolean("auto_approved").notNull().default(false);
autoApprovedAt: timestamp("auto_approved_at", { withTimezone: true });
```

### Leave Application Status Enum

Added new statuses to `leave_application_status` enum:

```typescript
"cancellation_requested"; // For LAM-007 (cancellation workflow)
"consumed"; // When leave period has passed
"consumed_auto"; // When forced leave was auto-deducted
```

**Migration Required:**

```sql
-- Add new enum values
ALTER TYPE leave_application_status ADD VALUE 'cancellation_requested';
ALTER TYPE leave_application_status ADD VALUE 'consumed';
ALTER TYPE leave_application_status ADD VALUE 'consumed_auto';

-- Add new columns
ALTER TABLE leave_applications
  ADD COLUMN auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN auto_approved_at TIMESTAMPTZ;
```

---

## Cron Job Setup

See `cron-jobs.ts` for scheduling examples.

### Recommended Schedule

| Job                     | Frequency | Cron Expression | Description       |
| ----------------------- | --------- | --------------- | ----------------- |
| Auto-approve sick leave | Daily     | `0 6 * * *`     | 6:00 AM every day |
| Year-end forced leave   | Annual    | `55 23 31 12 *` | Dec 31, 23:55     |

### Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-approve-sick-leave",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/year-end-forced-leave",
      "schedule": "55 23 31 12 *"
    }
  ]
}
```

### API Route Example

```typescript
// app/api/cron/auto-approve-sick-leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAutoApproveSickLeaveJob } from "@/lib/utils/leave/cron-jobs";

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutoApproveSickLeaveJob();
  return NextResponse.json(result);
}
```

---

## Testing

### Unit Tests

Tests should be added for:

- Business day calculation logic
- Leave balance checking logic
- Notification payload generation

### Integration Tests

Integration tests should verify:

- Database transactions commit/rollback correctly
- Advisory locks prevent race conditions
- Audit logs are created for all operations
- Notifications are sent to correct recipients

### Manual Testing Checklist

- [ ] Auto-approve sick leave with various timeout scenarios
- [ ] Year-end deduction with edge cases (balance exactly 10, balance < 10)
- [ ] LWOP notifications for all three scenarios
- [ ] Concurrent operations (multiple jobs running simultaneously)
- [ ] Error recovery (database failures, notification failures)

---

## Compliance Notes

### CSC Omnibus Rules on Leave

- **Forced Leave:** Employees with VL ≥ 10 days must use 5 days per year
- **Auto-approval:** Sick leave approval should not be unreasonably delayed
- **LWOP:** Absences without approved leave or sufficient credits = no pay

### Audit Trail Requirements

All operations create audit log entries with:

- `userId`: null for system actions
- `action`: Descriptive action type (e.g., "auto_approve", "year_end_forced_deduct")
- `oldValues` and `newValues`: Full state change details
- Timestamps for compliance reporting

### Data Privacy Considerations

- Employee notifications include only necessary information
- Admin notifications include employee name/number for identification
- No sensitive personal information in notification bodies
- All notifications respect role-based access control

---

## Future Enhancements

### Holiday Calendar Integration

Currently, business day calculation excludes only weekends. Should integrate with:

- `holidays` table for Philippine public holidays
- `work_suspensions` table for declared non-working days
- Office-specific holiday calendars

### Forced Leave Tracking

Consider adding explicit forced leave tracking:

- Separate leave type or flag for forced leave applications
- Running count of forced leave days used per year
- Dashboard showing forced leave compliance per employee

### Advanced LWOP Processing

Future enhancements for LWOP:

- Integration with attendance module for automatic LWOP detection
- Payroll module integration for automatic salary deductions
- Monthly LWOP summary reports
- LWOP trend analysis and alerts

---

## Troubleshooting

### Auto-approval not working

1. Check if sick leave type exists: `SELECT * FROM leave_types WHERE code = 'SL'`
2. Verify pending applications exist: `SELECT * FROM leave_applications WHERE status = 'pending' AND leave_type_id = <sick-leave-id>`
3. Check audit logs for errors: `SELECT * FROM audit_logs WHERE action = 'auto_approve' ORDER BY created_at DESC`
4. Verify cron job is running: check server logs for `[cron] Starting auto-approve sick leave job...`

### Year-end deduction issues

1. Verify VL leave type exists: `SELECT * FROM leave_types WHERE code = 'VL'`
2. Check employee balances: `SELECT * FROM leave_credits WHERE leave_type_id = <vl-id> AND balance >= '10'`
3. Verify job timing: should only run on December 31
4. Check for transaction deadlocks in database logs

### Notifications not delivered

1. Verify notification service is configured
2. Check `notifications` table for entries: `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10`
3. Verify `system_users` active and linked to employees
4. Check console logs for notification failures

---

## Support

For questions or issues related to this implementation:

1. Check the PRD Section 4.4 (Leave Administration Module) for requirements
2. Review Section 10.1 for leave computation formulas
3. Review Section 12.1 for leave workflow state machine
4. Review Section 13 for notification matrix (N-001 to N-009)

## License

PCSO HRIS - Confidential and Proprietary
