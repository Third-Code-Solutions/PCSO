-- TOR 1.8.2 — Confidential Agents payroll type (PAY-002 family).
--
-- 1. payroll_period_scope += 'confidential_agents' — dedicated run scope for
--    Confidential Agent personnel (non-organic; JO/COS-style deduction rules:
--    no GSIS / PhilHealth / Pag-IBIG / PERA / RATA / longevity).
-- 2. appointment_type    += 'confidential_agent'  — non-organic appointment
--    type per PRD §14.1 (employees.appointment_type enum lacked it).
--
-- Idempotent: ALTER TYPE ... ADD VALUE IF NOT EXISTS, guarded per house style.
-- No new tables — no RLS changes required.

DO $$ BEGIN
  ALTER TYPE payroll_period_scope ADD VALUE IF NOT EXISTS 'confidential_agents';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE appointment_type ADD VALUE IF NOT EXISTS 'confidential_agent';
EXCEPTION WHEN duplicate_object THEN null; END $$;
