-- Payroll integrity (TOR market-study gap analysis C-12, C-13, H-32).
--
-- 1. C-12: one payroll record per employee per period. Re-process used to
--    insert a second row next to an existing one (double pay). Duplicates are
--    removed first, keeping per (period, employee) the approved/paid row, else
--    the row with manual adjustments, else the newest. Only unadjusted
--    draft/override duplicates are deleted; if any duplicate cannot be removed
--    safely the unique index is skipped with a WARNING for manual review.
-- 2. H-32: Pag-IBIG max Monthly Fund Salary PHP 10,000 from February 2024
--    (HDMF Circular 460) — PHP 200 cap per side.
-- 3. C-13: correct the seeded 2023 TRAIN withholding rows to the official BIR
--    table (bracket floors 33,333 / 66,667 / ...; semi-monthly bases
--    4,270.70 / 16,770.70 / 91,770.70). Only rows still holding the exact old
--    seed values are touched.
--
-- Idempotent: safe to apply on every deploy.

DO $$
DECLARE
  remaining integer;
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_records') THEN
    WITH ranked AS (
      SELECT r.id,
             r.status,
             EXISTS (SELECT 1 FROM public.payroll_adjustments a WHERE a.record_id = r.id) AS has_adj,
             row_number() OVER (
               PARTITION BY r.period_id, r.employee_id
               ORDER BY (r.status IN ('approved', 'paid')) DESC,
                        EXISTS (SELECT 1 FROM public.payroll_adjustments a WHERE a.record_id = r.id) DESC,
                        r.created_at DESC,
                        r.id DESC
             ) AS rn
      FROM public.payroll_records r
    )
    DELETE FROM public.payroll_records p
    USING ranked
    WHERE p.id = ranked.id
      AND ranked.rn > 1
      AND ranked.status IN ('draft', 'override')
      AND NOT ranked.has_adj;

    SELECT count(*) INTO remaining FROM (
      SELECT 1 FROM public.payroll_records
      GROUP BY period_id, employee_id
      HAVING count(*) > 1
    ) d;

    IF remaining > 0 THEN
      RAISE WARNING 'payroll_records: % (period, employee) pairs still duplicated (approved/paid or adjusted rows) — unique index payroll_records_period_employee_uidx NOT created; resolve manually', remaining;
    ELSE
      CREATE UNIQUE INDEX IF NOT EXISTS payroll_records_period_employee_uidx
        ON public.payroll_records (period_id, employee_id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagibig_rates') THEN
    INSERT INTO public.pagibig_rates
      (employee_rate_low, employee_rate_high, employer_rate, salary_threshold, max_contribution, effective_date)
    SELECT 0.0100, 0.0200, 0.0200, 1500.00, 200.00, DATE '2024-02-01'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pagibig_rates WHERE effective_date = DATE '2024-02-01'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bir_tax_tables') THEN
    -- Monthly: old seed floors were "X.01" with ceilings one peso short.
    UPDATE public.bir_tax_tables t
    SET bracket_from = v.new_from, bracket_to = v.new_to
    FROM (VALUES
      (20833.01::numeric,  20833.00::numeric,  33333.00::numeric),
      (33332.01,           33333.00,           66667.00),
      (66666.01,           66667.00,           166667.00),
      (166666.01,          166667.00,          666667.00),
      (666666.01,          666667.00,          NULL)
    ) AS v(old_from, new_from, new_to)
    WHERE t.period_type = 'monthly'
      AND t.effective_date = DATE '2023-01-01'
      AND t.bracket_from = v.old_from;

    -- Semi-monthly: floors and bases.
    UPDATE public.bir_tax_tables t
    SET bracket_from = v.new_from, bracket_to = v.new_to, base_tax = v.new_base
    FROM (VALUES
      (10417.01::numeric,  0.00::numeric,      10417.00::numeric,  16667.00::numeric,  0.00::numeric),
      (16667.01,           937.50,             16667.00,           33333.00,           937.50),
      (33333.01,           4270.83,            33333.00,           83333.00,           4270.70),
      (83333.01,           16770.83,           83333.00,           333333.00,          16770.70),
      (333333.01,          91770.83,           333333.00,          NULL,               91770.70)
    ) AS v(old_from, old_base, new_from, new_to, new_base)
    WHERE t.period_type = 'semi_monthly'
      AND t.effective_date = DATE '2023-01-01'
      AND t.bracket_from = v.old_from
      AND t.base_tax = v.old_base;
  END IF;
END $$;
