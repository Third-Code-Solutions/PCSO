-- Speed up the monthly timesheet status aggregate used by
-- /attendance/timesheets. Safe and idempotent for existing deployments.
CREATE INDEX IF NOT EXISTS dtr_periods_period_status_idx
  ON public.dtr_periods (period_start, status);
