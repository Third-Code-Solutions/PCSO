import "server-only";

import { lockKey, type Tx } from "@/lib/db/transaction";

/**
 * Serializes every attendance_logs writer for one employee — biometric
 * ingest, clock in/out, HR manual entry and edits, DTR corrections and OT
 * propagation — until the transaction ends, so none overwrites another.
 */
export function lockAttendanceLog(tx: Tx, employeeId: string): Promise<void> {
  return lockKey(tx, `attendance:log:${employeeId}`);
}
