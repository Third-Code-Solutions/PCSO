import 'server-only';

import { db } from '@/lib/db';
import { systemUsers, offices, employees } from '@/lib/db/schema';
import { and, eq, ilike, or, desc, count, sql, type SQL } from 'drizzle-orm';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UsersQueryParams {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | '';
  officeId?: string;
  page?: number;
  pageSize?: number;
}

export interface UserListRow {
  id: string;
  email: string;
  role: string;
  officeName: string | null;
  employeeName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface UsersPage {
  rows: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
}

// ─── Paginated users with filters ────────────────────────────────────────────

export async function getUsersPage(params: UsersQueryParams): Promise<UsersPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [];

  if (params.role) conditions.push(eq(systemUsers.role, params.role as never));
  if (params.status === 'active') conditions.push(eq(systemUsers.isActive, true));
  if (params.status === 'inactive') conditions.push(eq(systemUsers.isActive, false));
  if (params.officeId) conditions.push(eq(systemUsers.officeId, params.officeId));
  if (params.search && params.search.trim().length > 0) {
    const needle = `%${params.search.trim()}%`;
    const searchClause = or(
      ilike(systemUsers.email, needle),
      ilike(employees.firstName, needle),
      ilike(employees.lastName, needle),
    );
    if (searchClause) conditions.push(searchClause);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult, activeCountResult, inactiveCountResult] = await Promise.all([
    db
      .select({
        id: systemUsers.id,
        email: systemUsers.email,
        role: systemUsers.role,
        isActive: systemUsers.isActive,
        lastLogin: systemUsers.lastLogin,
        createdAt: systemUsers.createdAt,
        authUid: systemUsers.authUid,
        officeName: offices.name,
        empFirstName: employees.firstName,
        empLastName: employees.lastName,
      })
      .from(systemUsers)
      .leftJoin(offices, eq(offices.id, systemUsers.officeId))
      .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
      .where(whereClause ?? sql`true`)
      .orderBy(desc(systemUsers.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(systemUsers)
      .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
      .where(whereClause ?? sql`true`),
    db
      .select({ value: count() })
      .from(systemUsers)
      .where(eq(systemUsers.isActive, true)),
    db
      .select({ value: count() })
      .from(systemUsers)
      .where(eq(systemUsers.isActive, false)),
  ]);

  const authUids = rows.map((r) => r.authUid).filter((v): v is string => v !== null);
  const lastSignInMap = await getLastSignInMap(authUids);

  const mapped: UserListRow[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    officeName: row.officeName,
    employeeName:
      row.empFirstName && row.empLastName ? `${row.empFirstName} ${row.empLastName}` : null,
    isActive: row.isActive,
    lastLogin:
      row.lastLogin instanceof Date ? row.lastLogin.toISOString() : (row.lastLogin as string | null),
    lastSignInAt: row.authUid ? (lastSignInMap.get(row.authUid) ?? null) : null,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt as string),
  }));

  const total = totalResult[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    rows: mapped,
    total,
    page,
    pageSize,
    totalPages,
    activeCount: activeCountResult[0]?.value ?? 0,
    inactiveCount: inactiveCountResult[0]?.value ?? 0,
  };
}

// ─── Supabase Auth last_sign_in_at lookup ────────────────────────────────────

/**
 * Resolves the `last_sign_in_at` timestamp for a set of auth UIDs by paging
 * through `auth.admin.listUsers()`. Supabase does not expose a filter-by-id API,
 * so we pull the whole list and map in memory. We cap pages to keep response
 * sizes bounded.
 */
async function getLastSignInMap(authUids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (authUids.length === 0) return map;
  const needed = new Set(authUids);

  try {
    const perPage = 200;
    // Cap at 10 pages (2,000 users) to bound admin page load time
    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: pageNum,
        perPage,
      });
      if (error || !data?.users) break;
      for (const user of data.users) {
        if (needed.has(user.id)) {
          map.set(user.id, user.last_sign_in_at ?? null);
        }
      }
      if (data.users.length < perPage) break;
      // Early exit if we've found all the UIDs we need
      if ([...needed].every((uid) => map.has(uid))) break;
    }
  } catch {
    // Best-effort only; don't fail the page if auth listing breaks
  }

  return map;
}

// ─── Filter options ──────────────────────────────────────────────────────────

export async function getOfficeOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: offices.id, name: offices.name, deletedAt: offices.deletedAt })
    .from(offices)
    .orderBy(offices.name);

  return rows
    .filter((r) => r.deletedAt === null)
    .map((r) => ({ id: r.id, name: r.name }));
}
