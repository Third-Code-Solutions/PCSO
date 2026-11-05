/**
 * MRF approval chain resolution (RPM-001 / FM-022).
 *
 * The chain is configured in fm_document_signatories under document type
 * "MRF" (File Maintenance → Document Signatories). Each FM row names a role
 * and a title, not a person, so the concrete approver is resolved here:
 *
 *   - head roles (dept_head / department_head / office_head) → the head of the
 *     requesting office, walking up the office hierarchy until a head is set
 *     (Admin → Offices → "Head employee").
 *   - any other role → the single active employee whose position title equals
 *     the FM signatory title (case-insensitive). When several match, the one
 *     in the closest office up the requesting office's hierarchy wins.
 *
 * `resolveMrfApprovers` is pure (unit-tested); `loadMrfApprovers` feeds it
 * from the database inside the caller's transaction.
 */

import { and, asc, eq, isNull } from "drizzle-orm";

import type { Tx } from "@/lib/db/transaction";
import { employees } from "@/lib/db/schema/employees";
import { fmDocumentSignatories } from "@/lib/db/schema/fm-extensions";
import { offices } from "@/lib/db/schema/offices";

export const MRF_DOC_TYPE = "MRF";

const HEAD_ROLES = new Set(["dept_head", "department_head", "office_head"]);
/** mrf_approvals.approver_role is varchar(30). */
const APPROVER_ROLE_MAX = 30;

export interface MrfSignatoryRow {
  signatoryRole: string;
  signatoryTitle: string;
  sequenceOrder: number;
}

export interface OfficeNode {
  id: string;
  parentId: string | null;
  headEmployeeId: string | null;
}

export interface ApproverCandidate {
  id: string;
  positionTitle: string;
  officeId: string | null;
}

export interface ResolvedMrfApprover {
  approverRole: string;
  approverEmployeeId: string;
  sequenceOrder: number;
}

export type ResolveMrfApproversResult =
  | { ok: true; approvers: ResolvedMrfApprover[] }
  | { ok: false; error: string };

const norm = (s: string) => s.trim().toLowerCase();

/** Office ids from the requesting office up to the root (cycle-guarded). */
function ancestorChain(
  officeId: string,
  byId: Map<string, OfficeNode>,
): OfficeNode[] {
  const chain: OfficeNode[] = [];
  const seen = new Set<string>();
  let cur = byId.get(officeId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export function resolveMrfApprovers(input: {
  rows: readonly MrfSignatoryRow[];
  mrfOfficeId: string;
  offices: readonly OfficeNode[];
  employees: readonly ApproverCandidate[];
}): ResolveMrfApproversResult {
  if (input.rows.length === 0) {
    return {
      ok: false,
      error:
        'No MRF approval chain is configured. Add the approvers under File Maintenance → Document Signatories with document type "MRF" (e.g. 1 dept_head, 2 agm, 3 gm), then submit again.',
    };
  }

  const byId = new Map(input.offices.map((o) => [o.id, o]));
  const chain = ancestorChain(input.mrfOfficeId, byId);
  const officeRank = new Map(chain.map((o, i) => [o.id, i]));
  const sorted = [...input.rows].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder,
  );

  const approvers: ResolvedMrfApprover[] = [];
  for (const [idx, row] of sorted.entries()) {
    const step = idx + 1;
    const role = norm(row.signatoryRole);
    let employeeId: string | null = null;

    if (HEAD_ROLES.has(role)) {
      employeeId = chain.find((o) => o.headEmployeeId)?.headEmployeeId ?? null;
      if (!employeeId) {
        return {
          ok: false,
          error: `MRF approval step ${step} (${row.signatoryTitle}) needs an office head, but neither the requesting office nor its parent offices have one. Set the head employee under Admin → Offices.`,
        };
      }
    } else {
      const title = norm(row.signatoryTitle);
      const matches = input.employees.filter(
        (e) => norm(e.positionTitle) === title,
      );
      if (matches.length === 0) {
        return {
          ok: false,
          error: `MRF approval step ${step}: no active employee has the position title "${row.signatoryTitle}". Fix the title under File Maintenance → Document Signatories (document type "MRF") or the employee's position title.`,
        };
      }
      if (matches.length === 1) {
        employeeId = matches[0]!.id;
      } else {
        const ranked = matches
          .filter((e) => e.officeId && officeRank.has(e.officeId))
          .sort(
            (a, b) =>
              officeRank.get(a.officeId!)! - officeRank.get(b.officeId!)!,
          );
        const best = ranked[0];
        const tie =
          ranked[1] &&
          officeRank.get(ranked[1].officeId!) ===
            officeRank.get(best!.officeId!);
        if (!best || tie) {
          return {
            ok: false,
            error: `MRF approval step ${step}: ${matches.length} active employees share the position title "${row.signatoryTitle}". Use a unique title for this signatory in File Maintenance → Document Signatories.`,
          };
        }
        employeeId = best.id;
      }
    }

    approvers.push({
      approverRole: row.signatoryRole.slice(0, APPROVER_ROLE_MAX),
      approverEmployeeId: employeeId,
      sequenceOrder: step,
    });
  }

  return { ok: true, approvers };
}

/** Load FM rows, the office tree and active employees, then resolve. */
export async function loadMrfApprovers(
  tx: Tx,
  mrfOfficeId: string,
): Promise<ResolveMrfApproversResult> {
  const [rows, officeRows, employeeRows] = await Promise.all([
    tx
      .select({
        signatoryRole: fmDocumentSignatories.signatoryRole,
        signatoryTitle: fmDocumentSignatories.signatoryTitle,
        sequenceOrder: fmDocumentSignatories.sequenceOrder,
      })
      .from(fmDocumentSignatories)
      .where(
        and(
          eq(fmDocumentSignatories.documentTypeCode, MRF_DOC_TYPE),
          eq(fmDocumentSignatories.isActive, true),
          isNull(fmDocumentSignatories.deletedAt),
        ),
      )
      .orderBy(asc(fmDocumentSignatories.sequenceOrder)),
    tx
      .select({
        id: offices.id,
        parentId: offices.parentId,
        headEmployeeId: offices.headEmployeeId,
      })
      .from(offices)
      .where(isNull(offices.deletedAt)),
    tx
      .select({
        id: employees.id,
        positionTitle: employees.positionTitle,
        officeId: employees.officeId,
      })
      .from(employees)
      .where(and(eq(employees.status, "active"), isNull(employees.deletedAt))),
  ]);

  return resolveMrfApprovers({
    rows,
    mrfOfficeId,
    offices: officeRows,
    employees: employeeRows,
  });
}
