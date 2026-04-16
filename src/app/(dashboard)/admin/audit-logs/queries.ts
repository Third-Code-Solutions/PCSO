import 'server-only';

import { db } from '@/lib/db';
import { auditLogs, systemUsers, employees } from '@/lib/db/schema';
import { and, eq, gte, lte, desc, sql, count } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditQueryParams {
  userId?: string;
  tableName?: string;
  action?: string;
  recordId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPageRow {
  id: string;
  timestamp: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditLogPage {
  rows: AuditLogPageRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Filter builder ──────────────────────────────────────────────────────────

function buildConditions(params: AuditQueryParams) {
  const conditions = [];
  if (params.userId) conditions.push(eq(auditLogs.userId, params.userId));
  if (params.tableName) conditions.push(eq(auditLogs.tableName, params.tableName));
  if (params.action) conditions.push(eq(auditLogs.action, params.action));
  if (params.recordId) conditions.push(eq(auditLogs.recordId, params.recordId));
  if (params.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(params.dateFrom)));
  if (params.dateTo) {
    conditions.push(lte(auditLogs.createdAt, new Date(params.dateTo + 'T23:59:59Z')));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ─── Paginated list ──────────────────────────────────────────────────────────

export async function getAuditLogsPage(params: AuditQueryParams): Promise<AuditLogPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const whereClause = buildConditions(params);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        userId: auditLogs.userId,
        sysUserEmail: systemUsers.email,
        empFirstName: employees.firstName,
        empLastName: employees.lastName,
      })
      .from(auditLogs)
      .leftJoin(systemUsers, eq(systemUsers.id, auditLogs.userId))
      .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
      .where(whereClause ?? sql`true`)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereClause ?? sql`true`),
  ]);

  const total = totalResult[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const mapped = rows.map((row) => ({
    id: row.id,
    timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    userName:
      row.empFirstName && row.empLastName ? `${row.empFirstName} ${row.empLastName}` : null,
    userEmail: row.sysUserEmail ?? null,
    action: row.action,
    tableName: row.tableName,
    recordId: row.recordId,
    oldValues: row.oldValues as Record<string, unknown> | null,
    newValues: row.newValues as Record<string, unknown> | null,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
  }));

  return { rows: mapped, total, page, pageSize, totalPages };
}

// ─── Distinct filter values ──────────────────────────────────────────────────

export interface AuditFilterOptions {
  tables: string[];
  actions: string[];
  users: { id: string; email: string; name: string | null }[];
}

export async function getAuditFilterOptions(): Promise<AuditFilterOptions> {
  const [tables, actions, users] = await Promise.all([
    db
      .selectDistinct({ tableName: auditLogs.tableName })
      .from(auditLogs)
      .orderBy(auditLogs.tableName),
    db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(auditLogs.action),
    db
      .select({
        id: systemUsers.id,
        email: systemUsers.email,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(systemUsers)
      .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
      .orderBy(systemUsers.email)
      .limit(500),
  ]);

  return {
    tables: tables.map((t) => t.tableName).filter(Boolean),
    actions: actions.map((a) => a.action).filter(Boolean),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : null,
    })),
  };
}
