'use server';

/**
 * Performance module server actions — Senate HRIS Phase 12
 *
 * Covers: IPCRF lifecycle, OPCRF, Step Increments, Period management.
 *
 * Conventions (CONVENTIONS.md):
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs at the boundary.
 *  - Never bypass permission checks.
 *  - Never silently fail government-compliance computations.
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission, requireAuth } from '@/lib/auth/guards';
import {
  CreatePerformancePeriodSchema,
  UpdatePeriodStatusSchema,
  SaveIpcrfPlanningSchema,
  SubmitIpcrfPlanningSchema,
  SaveIpcrfMonitoringSchema,
  SaveIpcrfReviewSchema,
  SubmitIpcrfReviewSchema,
  ApproveRatingSchema,
  DisapproveRatingSchema,
  SaveOpcfrSchema,
  ProcessStepIncrementSchema,
  ApproveStepIncrementSchema,
  ImplementStepIncrementSchema,
  CancelStepIncrementSchema,
  InitializePerformanceRatingSchema,
} from '@/lib/validations/performance';
import {
  computeFinalRating,
  type KraRatingInput,
} from '@/lib/utils/performance/rating';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  params: {
    userId: string;
    action: string;
    tableName: string;
    recordId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  });

  if (error) {
    throw new Error(`Audit log write failed: ${error.message}`);
  }
}

// ─── Performance Period Actions ───────────────────────────────────────────────

export async function createPerformancePeriod(input: unknown): Promise<{ periodId: string }> {
  const parsed = CreatePerformancePeriodSchema.parse(input);
  const user = await requirePermission('performance', 'create');
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from('performance_periods')
    .select('id')
    .eq('year', parsed.year)
    .eq('semester', parsed.semester)
    .single();

  if (existing) {
    throw new Error(
      `A performance period for ${parsed.year}-S${parsed.semester} already exists.`,
    );
  }

  const { data, error } = await supabase
    .from('performance_periods')
    .insert({
      year: parsed.year,
      semester: parsed.semester,
      date_from: parsed.dateFrom,
      date_to: parsed.dateTo,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create performance period: ${error?.message}`);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'create',
    tableName: 'performance_periods',
    recordId: String(data.id),
    newValues: parsed,
  });

  revalidatePath('/performance/cycles');
  revalidatePath('/performance');

  return { periodId: String(data.id) };
}

export async function updatePeriodStatus(input: unknown): Promise<void> {
  const parsed = UpdatePeriodStatusSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const { data: period, error: fetchError } = await supabase
    .from('performance_periods')
    .select('id, status')
    .eq('id', parsed.periodId)
    .single();

  if (fetchError || !period) throw new Error('Performance period not found.');

  const oldValues = { status: period.status };

  const { error } = await supabase
    .from('performance_periods')
    .update({ status: parsed.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.periodId);

  if (error) throw new Error(`Failed to update period status: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'update',
    tableName: 'performance_periods',
    recordId: parsed.periodId,
    oldValues,
    newValues: { status: parsed.status },
  });

  revalidatePath('/performance/cycles');
  revalidatePath(`/performance/cycles/${parsed.periodId}`);
}

// ─── Initialize Performance Rating ───────────────────────────────────────────

/**
 * Creates a draft performance rating record for an employee + period.
 * Called when HR opens the IPCRF or OPCRF for an employee.
 */
export async function initializePerformanceRating(
  input: unknown,
): Promise<{ ratingId: string }> {
  const parsed = InitializePerformanceRatingSchema.parse(input);
  const user = await requirePermission('performance', 'create');
  const supabase = await createServerClient();

  // Check for duplicate
  const { data: existing } = await supabase
    .from('performance_ratings')
    .select('id')
    .eq('employee_id', parsed.employeeId)
    .eq('period_id', parsed.periodId)
    .eq('rating_type', parsed.ratingType)
    .single();

  if (existing) {
    return { ratingId: String(existing.id) };
  }

  const { data, error } = await supabase
    .from('performance_ratings')
    .insert({
      employee_id: parsed.employeeId,
      period_id: parsed.periodId,
      rating_type: parsed.ratingType,
      numerical_rating: '0',
      adjectival_rating: 'satisfactory',
      rated_by: user.id,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to initialize rating: ${error?.message}`);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'create',
    tableName: 'performance_ratings',
    recordId: String(data.id),
    newValues: parsed,
  });

  revalidatePath('/performance');
  revalidatePath('/performance/ipcrf');

  return { ratingId: String(data.id) };
}

// ─── IPCRF Phase 1: Planning ──────────────────────────────────────────────────

export async function saveIpcrfPlanning(input: unknown): Promise<void> {
  const parsed = SaveIpcrfPlanningSchema.parse(input);
  const user = await requireAuth();
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, employee_id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('Performance rating not found.');

  // Employees may edit their own draft; HR/admin may edit any
  if (
    user.role === 'employee_self_service' &&
    user.employeeId !== String(rating.employee_id)
  ) {
    throw new Error('Forbidden: you may only edit your own IPCRF.');
  }

  if (!['draft', 'submitted'].includes(String(rating.status))) {
    throw new Error('Cannot edit KRAs once the review phase has started.');
  }

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      kras: { items: parsed.kras },
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save IPCRF planning: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'update',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    newValues: { phase: 'planning', kraCount: parsed.kras.length },
  });

  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/planning`);
}

export async function submitIpcrfPlanning(input: unknown): Promise<void> {
  const parsed = SubmitIpcrfPlanningSchema.parse(input);
  const user = await requireAuth();
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, employee_id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('Performance rating not found.');

  if (
    user.role === 'employee_self_service' &&
    user.employeeId !== String(rating.employee_id)
  ) {
    throw new Error('Forbidden: you may only submit your own IPCRF.');
  }

  if (String(rating.status) !== 'draft') {
    throw new Error('Only draft ratings can be submitted for planning.');
  }

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      kras: { items: parsed.kras },
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to submit IPCRF planning: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'submit',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    newValues: { phase: 'planning', status: 'submitted', kraCount: parsed.kras.length },
  });

  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/planning`);
}

// ─── IPCRF Phase 2: Monitoring ────────────────────────────────────────────────

export async function saveIpcrfMonitoring(input: unknown): Promise<void> {
  const parsed = SaveIpcrfMonitoringSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('Performance rating not found.');

  if (!['submitted', 'reviewed'].includes(String(rating.status))) {
    throw new Error('Monitoring feedback can only be added to submitted ratings.');
  }

  // The schema stores all form phases in the kras JSONB column.
  // We use a flat envelope that stores both KRA items and phase metadata:
  // { items: KraRatingData[], monitoring: { supervisorFeedback, midYearRemarks, progressNotes } }
  // Fetch current kras to preserve existing KRA definitions.
  const { data: current } = await supabase
    .from('performance_ratings')
    .select('kras')
    .eq('id', parsed.performanceRatingId)
    .single();

  // kras column may be: an array (legacy) or an envelope object
  const existing: unknown = current?.kras;
  const existingItems: unknown[] = Array.isArray(existing)
    ? (existing as unknown[])
    : existing && typeof existing === 'object' && Array.isArray(
        (existing as Record<string, unknown>).items,
      )
    ? ((existing as Record<string, unknown>).items as unknown[])
    : [];

  const envelope = {
    items: existingItems,
    monitoring: {
      supervisorFeedback: parsed.supervisorFeedback ?? null,
      midYearRemarks: parsed.midYearRemarks ?? null,
      progressNotes: parsed.progressNotes ?? null,
    },
  };

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      kras: envelope,
      status: 'reviewed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save monitoring notes: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'update',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: 'monitoring',
      supervisorFeedback: parsed.supervisorFeedback,
      midYearRemarks: parsed.midYearRemarks,
    },
  });

  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/monitoring`);
}

// ─── IPCRF Phase 3: Review / Rating ──────────────────────────────────────────

export async function saveIpcrfReview(input: unknown): Promise<void> {
  const parsed = SaveIpcrfReviewSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('Performance rating not found.');

  if (!['reviewed', 'submitted'].includes(String(rating.status))) {
    throw new Error('Rating can only be entered for submitted or reviewed records.');
  }

  // Compute weighted final rating
  const kraInputs: KraRatingInput[] = parsed.kras.map((k) => ({
    weight: k.weight,
    rating: k.rating,
  }));

  const finalRating = computeFinalRating(kraInputs);
  if (!finalRating) {
    throw new Error('Could not compute final rating from the provided KRA data.');
  }

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      kras: { items: parsed.kras, raterRemarks: parsed.raterRemarks ?? null },
      numerical_rating: String(finalRating.numerical),
      adjectival_rating: finalRating.adjectival,
      rated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save review rating: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'update',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: 'review',
      numericalRating: finalRating.numerical,
      adjectivalRating: finalRating.adjectival,
    },
  });

  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/review`);
}

export async function submitIpcrfReview(input: unknown): Promise<void> {
  const parsed = SubmitIpcrfReviewSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const kraInputs: KraRatingInput[] = parsed.kras.map((k) => ({
    weight: k.weight,
    rating: k.rating,
  }));

  const finalRating = computeFinalRating(kraInputs);
  if (!finalRating) {
    throw new Error('Could not compute final rating from the provided KRA data.');
  }

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      kras: { items: parsed.kras, raterRemarks: parsed.raterRemarks ?? null },
      numerical_rating: String(finalRating.numerical),
      adjectival_rating: finalRating.adjectival,
      rated_by: user.id,
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to submit review: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'submit',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: 'review',
      status: 'submitted',
      numericalRating: finalRating.numerical,
      adjectivalRating: finalRating.adjectival,
    },
  });

  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/review`);
}

export async function approveRating(input: unknown): Promise<void> {
  const parsed = ApproveRatingSchema.parse(input);
  const user = await requirePermission('performance', 'approve');
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('Performance rating not found.');
  if (String(rating.status) !== 'submitted') {
    throw new Error('Only submitted ratings can be approved.');
  }

  const oldValues = { status: rating.status };

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      status: 'approved',
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to approve rating: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'approve',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    oldValues,
    newValues: { status: 'approved', approvedBy: user.id, remarks: parsed.remarks },
  });

  revalidatePath('/performance');
  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

export async function disapproveRating(input: unknown): Promise<void> {
  const parsed = DisapproveRatingSchema.parse(input);
  const user = await requirePermission('performance', 'approve');
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('Performance rating not found.');
  if (String(rating.status) !== 'submitted') {
    throw new Error('Only submitted ratings can be disapproved.');
  }

  const oldValues = { status: rating.status };

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      status: 'disapproved',
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to disapprove rating: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'disapprove',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    oldValues,
    newValues: { status: 'disapproved', approvedBy: user.id, remarks: parsed.remarks },
  });

  revalidatePath('/performance');
  revalidatePath('/performance/ipcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

// ─── OPCRF Actions ────────────────────────────────────────────────────────────

export async function saveOpcrf(input: unknown): Promise<void> {
  const parsed = SaveOpcfrSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const kraInputs: KraRatingInput[] = parsed.kras.map((k) => ({
    weight: k.weight,
    rating: k.rating,
  }));

  const finalRating = computeFinalRating(kraInputs);
  if (!finalRating) {
    throw new Error('Could not compute OPCRF final rating from the provided KRA data.');
  }

  const { data: rating, error: fetchError } = await supabase
    .from('performance_ratings')
    .select('id, status')
    .eq('id', parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error('OPCRF rating record not found.');

  const { error } = await supabase
    .from('performance_ratings')
    .update({
      kras: { items: parsed.kras, raterRemarks: parsed.remarks ?? null },
      numerical_rating: String(finalRating.numerical),
      adjectival_rating: finalRating.adjectival,
      rated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save OPCRF: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'update',
    tableName: 'performance_ratings',
    recordId: parsed.performanceRatingId,
    newValues: {
      type: 'opcrf',
      numericalRating: finalRating.numerical,
      adjectivalRating: finalRating.adjectival,
    },
  });

  revalidatePath('/performance/opcrf');
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

// ─── Step Increment Actions ───────────────────────────────────────────────────

export async function processStepIncrement(
  input: unknown,
): Promise<{ stepIncrementId: string }> {
  const parsed = ProcessStepIncrementSchema.parse(input);
  const user = await requirePermission('performance', 'process');
  const supabase = await createServerClient();

  // Verify employee exists and get current step
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, step, salary_grade, position_title')
    .eq('id', parsed.employeeId)
    .is('deleted_at', null)
    .single();

  if (empError || !emp) throw new Error('Employee not found.');

  if (Number(emp.step) !== parsed.fromStep) {
    throw new Error(
      `Employee's current step (${emp.step}) does not match fromStep (${parsed.fromStep}).`,
    );
  }

  // Check for existing pending/approved increment
  const { data: existing } = await supabase
    .from('step_increments')
    .select('id, status')
    .eq('employee_id', parsed.employeeId)
    .in('status', ['pending', 'approved'])
    .single();

  if (existing) {
    throw new Error('Employee already has a pending or approved step increment.');
  }

  const { data, error } = await supabase
    .from('step_increments')
    .insert({
      employee_id: parsed.employeeId,
      from_step: parsed.fromStep,
      to_step: parsed.toStep,
      effectivity_date: parsed.effectivityDate,
      basis_period_ids: parsed.basisPeriodIds,
      status: 'pending',
      remarks: parsed.remarks ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create step increment: ${error?.message}`);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'create',
    tableName: 'step_increments',
    recordId: String(data.id),
    newValues: parsed,
  });

  revalidatePath('/performance/step-increments');
  revalidatePath(`/performance/step-increments/${parsed.employeeId}`);

  return { stepIncrementId: String(data.id) };
}

export async function approveStepIncrement(input: unknown): Promise<void> {
  const parsed = ApproveStepIncrementSchema.parse(input);
  const user = await requirePermission('performance', 'approve');
  const supabase = await createServerClient();

  const { data: increment, error: fetchError } = await supabase
    .from('step_increments')
    .select('id, employee_id, status, from_step, to_step')
    .eq('id', parsed.stepIncrementId)
    .single();

  if (fetchError || !increment) throw new Error('Step increment not found.');
  if (String(increment.status) !== 'pending') {
    throw new Error('Only pending step increments can be approved.');
  }

  const oldValues = { status: increment.status };

  const { error } = await supabase
    .from('step_increments')
    .update({
      status: 'approved',
      approved_by: user.id,
      remarks: parsed.remarks ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.stepIncrementId);

  if (error) throw new Error(`Failed to approve step increment: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'approve',
    tableName: 'step_increments',
    recordId: parsed.stepIncrementId,
    oldValues,
    newValues: { status: 'approved', approvedBy: user.id },
  });

  revalidatePath('/performance/step-increments');
  revalidatePath(`/performance/step-increments/${String(increment.employee_id)}`);
}

export async function implementStepIncrement(input: unknown): Promise<void> {
  const parsed = ImplementStepIncrementSchema.parse(input);
  const user = await requirePermission('performance', 'process');
  const supabase = await createServerClient();

  const { data: increment, error: fetchError } = await supabase
    .from('step_increments')
    .select('id, employee_id, status, from_step, to_step, effectivity_date')
    .eq('id', parsed.stepIncrementId)
    .single();

  if (fetchError || !increment) throw new Error('Step increment not found.');
  if (String(increment.status) !== 'approved') {
    throw new Error('Only approved step increments can be implemented.');
  }

  // Update the employee's step in their record
  const { error: empError } = await supabase
    .from('employees')
    .update({
      step: increment.to_step,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(increment.employee_id));

  if (empError) {
    throw new Error(`Failed to update employee step: ${empError.message}`);
  }

  const oldValues = { status: increment.status };

  const { error } = await supabase
    .from('step_increments')
    .update({
      status: 'implemented',
      remarks: parsed.remarks ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.stepIncrementId);

  if (error) throw new Error(`Failed to mark increment as implemented: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'implement',
    tableName: 'step_increments',
    recordId: parsed.stepIncrementId,
    oldValues,
    newValues: {
      status: 'implemented',
      employeeId: increment.employee_id,
      fromStep: increment.from_step,
      toStep: increment.to_step,
      effectivityDate: increment.effectivity_date,
    },
  });

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'update',
    tableName: 'employees',
    recordId: String(increment.employee_id),
    oldValues: { step: increment.from_step },
    newValues: { step: increment.to_step },
  });

  revalidatePath('/performance/step-increments');
  revalidatePath(`/performance/step-increments/${String(increment.employee_id)}`);
  revalidatePath('/employees');
}

export async function cancelStepIncrement(input: unknown): Promise<void> {
  const parsed = CancelStepIncrementSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const { data: increment, error: fetchError } = await supabase
    .from('step_increments')
    .select('id, employee_id, status')
    .eq('id', parsed.stepIncrementId)
    .single();

  if (fetchError || !increment) throw new Error('Step increment not found.');
  if (!['pending', 'approved'].includes(String(increment.status))) {
    throw new Error('Only pending or approved increments can be cancelled.');
  }

  const oldValues = { status: increment.status };

  const { error } = await supabase
    .from('step_increments')
    .update({
      status: 'cancelled',
      remarks: parsed.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.stepIncrementId);

  if (error) throw new Error(`Failed to cancel step increment: ${error.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'cancel',
    tableName: 'step_increments',
    recordId: parsed.stepIncrementId,
    oldValues,
    newValues: { status: 'cancelled', reason: parsed.reason },
  });

  revalidatePath('/performance/step-increments');
  revalidatePath(`/performance/step-increments/${String(increment.employee_id)}`);
}

// ─── Bulk Step Increment Processor ────────────────────────────────────────────

/**
 * Creates a pending step increment for every currently-eligible employee in
 * the provided IDs list. Skips employees that already have a pending or
 * approved increment, or that would move beyond step 8.
 *
 * Each created increment uses:
 *   - fromStep = employee.step
 *   - toStep   = employee.step + 1
 *   - effectivityDate = caller-supplied or the first day of next month
 *   - basisPeriodIds = most recent 3 approved IPCRF period_ids
 *
 * Every creation emits an audit log. Errors on individual employees are
 * captured and returned; they do not roll back the whole batch.
 */
export async function bulkProcessStepIncrements(input: unknown): Promise<{
  processed: number;
  skipped: number;
  failed: number;
  errors: Array<{ employeeId: string; message: string }>;
}> {
  const { z } = await import('zod');
  const BulkSchema = z.object({
    employeeIds: z.array(z.string().uuid()).min(1).max(500),
    effectivityDate: z.string().date().optional(),
  });
  const parsed = BulkSchema.parse(input);
  const user = await requirePermission('performance', 'edit');
  const supabase = await createServerClient();

  const defaultEffectivity = (() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toISOString().slice(0, 10);
  })();
  const effectivityDate = parsed.effectivityDate ?? defaultEffectivity;

  // Serialize concurrent bulk processors for the same effectivity batch.
  // Key follows the agent-15 spec: `step-increment:bulk:${cycleId}` — here
  // the effectivity date acts as the cycle identifier since a bulk run is
  // scoped to a single effectivity date.
  const lockKey = `step-increment:bulk:${effectivityDate}`;
  const { withSessionAdvisoryLock } = await import('@/lib/concurrency');

  return withSessionAdvisoryLock(lockKey, async () => {
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ employeeId: string; message: string }> = [];

  for (const employeeId of parsed.employeeIds) {
    try {
      const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('id, step')
        .eq('id', employeeId)
        .is('deleted_at', null)
        .single();

      if (empErr || !emp) {
        failed++;
        errors.push({ employeeId, message: 'Employee not found' });
        continue;
      }

      const fromStep = Number(emp.step);
      const toStep = fromStep + 1;
      if (fromStep >= 8) {
        skipped++;
        continue;
      }

      const { data: existing } = await supabase
        .from('step_increments')
        .select('id')
        .eq('employee_id', employeeId)
        .in('status', ['pending', 'approved'])
        .limit(1)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { data: recentApproved } = await supabase
        .from('performance_ratings')
        .select('period_id')
        .eq('employee_id', employeeId)
        .eq('rating_type', 'ipcrf')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(3);

      const periodIds = (recentApproved ?? [])
        .map((r) => String(r.period_id))
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      if (periodIds.length < 2) {
        skipped++;
        errors.push({
          employeeId,
          message: 'Need at least 2 approved IPCRF periods as basis',
        });
        continue;
      }

      const { data: created, error: createErr } = await supabase
        .from('step_increments')
        .insert({
          employee_id: employeeId,
          from_step: fromStep,
          to_step: toStep,
          effectivity_date: effectivityDate,
          basis_period_ids: periodIds,
          status: 'pending',
          remarks: 'Auto-processed via bulk eligibility run',
        })
        .select('id')
        .single();

      if (createErr || !created) {
        failed++;
        errors.push({
          employeeId,
          message: createErr?.message ?? 'Insert failed',
        });
        continue;
      }

      await writeAuditLog(supabase, {
        userId: user.id,
        action: 'bulk_create',
        tableName: 'step_increments',
        recordId: String(created.id),
        newValues: {
          employeeId,
          fromStep,
          toStep,
          effectivityDate,
          basisPeriodIds: periodIds,
          batchBy: user.id,
        },
      });

      processed++;
    } catch (err: unknown) {
      failed++;
      errors.push({
        employeeId,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  revalidatePath('/performance/step-increments');
  revalidatePath('/performance');

  return { processed, skipped, failed, errors };
  });
}

// ─── Employee-initiated IPCRF draft creation ──────────────────────────────────

/**
 * Convenience wrapper: creates (or reuses) a draft IPCRF record for the
 * currently authenticated employee against a given period.
 * Used by the self-service "Start my IPCRF" button.
 */
export async function startMyIpcrf(input: unknown): Promise<{ ratingId: string }> {
  const { z } = await import('zod');
  const Schema = z.object({ periodId: z.string().uuid('Invalid period ID.') });
  const parsed = Schema.parse(input);
  const user = await requireAuth();

  if (!user.employeeId) {
    throw new Error('No employee record is linked to your account.');
  }

  return initializePerformanceRating({
    employeeId: user.employeeId,
    periodId: parsed.periodId,
    ratingType: 'ipcrf',
  });
}
