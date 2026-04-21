"use server";

/**
 * LDM Cost server actions — DB-backed.
 *
 * Scope: LDM-005 (recompute training-run cost + render budget-summary PDF).
 */

import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { trainingRuns } from "@/lib/db/schema/learning";
import { requirePermission } from "@/lib/auth/guards";
import {
  computeBreakdown,
  computeRunTotal,
  type CostInput,
} from "@/lib/utils/ldm/cost-calculator";
import { TrainingBudgetSummary } from "@/components/pdf/training-budget-summary";

import { _readRun } from "./scheduling";
import type { TrainingRun } from "@/lib/utils/ldm/schedule-generator";

export type { TrainingRun } from "@/lib/utils/ldm/schedule-generator";

type Result<T> = { data: T } | { error: string };

export interface BudgetSummaryContext {
  agencyName: string;
  programName: string;
  providerName: string;
  preparedBy?: string;
}

/**
 * Recompute and persist `totalBudget` for the run from its current cost
 * fields. Safe to call repeatedly.
 */
export async function recomputeRunCost(
  runId: string,
): Promise<Result<TrainingRun>> {
  try {
    await requirePermission("learning", "edit");

    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };

    const cost: CostInput = {
      perParticipantCost: run.perParticipantCost,
      plannedHeadcount: run.plannedHeadcount,
      venueCost: run.venueCost,
      facilitatorFees: run.facilitatorFees,
    };
    const totalBudget = computeRunTotal(cost);

    await db
      .update(trainingRuns)
      .set({ totalBudget: String(totalBudget), updatedAt: new Date() })
      .where(eq(trainingRuns.id, runId));

    const refreshed = await _readRun(runId);
    return {
      data: refreshed ?? {
        ...run,
        totalBudget,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to recompute cost.",
    };
  }
}

/**
 * Render the training-run budget summary PDF.
 */
export async function generateBudgetSummaryPdf(
  runId: string,
  context: BudgetSummaryContext,
): Promise<Buffer> {
  const run = await _readRun(runId);
  if (!run) throw new Error(`Training run ${runId} not found`);

  const breakdown = computeBreakdown({
    perParticipantCost: run.perParticipantCost,
    plannedHeadcount: run.plannedHeadcount,
    venueCost: run.venueCost,
    facilitatorFees: run.facilitatorFees,
  });

  const element = React.createElement(TrainingBudgetSummary, {
    agencyName: context.agencyName,
    programName: context.programName,
    providerName: context.providerName,
    preparedBy: context.preparedBy,
    runPeriod: { startDate: run.startDate, endDate: run.endDate },
    breakdown,
  });

  const doc = element as unknown as React.ReactElement<DocumentProps>;
  return (await renderToBuffer(doc)) as unknown as Buffer;
}
