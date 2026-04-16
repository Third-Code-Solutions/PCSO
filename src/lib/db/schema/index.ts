/**
 * Drizzle schema barrel export.
 * Consumers: import { employees, payrollRecords } from '@/lib/db/schema'
 *
 * Import order is top-down; tables that reference other tables come
 * after the tables they reference.
 */

// Shared helpers (timestamps, softDelete)
export * from './_shared';

// No external dependencies
export * from './offices';

// Depends on offices
export * from './employees';

// Depend on offices + employees
export * from './plantilla';
export * from './appointments';
export * from './attendance';
export * from './leave';
export * from './performance';
export * from './saln';

// Payroll (depends on employees)
export * from './payroll';

// Government reference tables (no FK dependencies)
export * from './government-rates';

// Remittances (depends on employees)
export * from './remittances';

// GSIS compliance (depends on employees + payroll + remittances)
export * from './gsis';

// Audit (no FK deps at schema level)
export * from './audit';

// System users (depends on employees + offices)
export * from './users';

// Holidays + system settings (no FK deps)
export * from './holidays';

// Notifications (user_id is uuid only — no FK constraint at schema level)
export * from './notifications';
