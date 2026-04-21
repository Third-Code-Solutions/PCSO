/**
 * IpcrfForm — client-side form container that orchestrates the 3-phase IPCRF.
 *
 * Delegates KRA editing to KraEditor and rating display to RatingBadge.
 * Calls server actions on submit.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { KraEditor, type KraEntry } from "./kra-editor";
import { RatingBadge } from "./rating-badge";
import { computeFinalRating } from "@/lib/utils/performance/rating";
import type { KraRatingData } from "@/app/(dashboard)/performance/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "planning" | "monitoring" | "review";

interface IpcrfFormProps {
  phase: Phase;
  ratingId: string;
  initialKras?: KraRatingData[];
  supervisorFeedback?: string;
  midYearRemarks?: string;
  readonly?: boolean;
  onSave: (data: IpcrfFormData) => Promise<void>;
  onSubmit: (data: IpcrfFormData) => Promise<void>;
}

export interface IpcrfFormData {
  kras: KraEntry[];
  supervisorFeedback: string;
  midYearRemarks: string;
  raterRemarks: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kraDataToEntry(d: KraRatingData): KraEntry {
  return {
    position: d.position,
    title: d.title,
    description: d.description ?? "",
    weight: d.weight,
    successIndicators: d.successIndicators,
    baseline: d.baseline ?? "",
    actualAccomplishments: d.actualAccomplishments ?? "",
    rating: typeof d.rating === "number" ? d.rating : "",
  };
}

function defaultKra(): KraEntry {
  return {
    position: 1,
    title: "",
    description: "",
    weight: 100,
    successIndicators: "",
    baseline: "",
    actualAccomplishments: "",
    rating: "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IpcrfForm({
  phase,
  ratingId,
  initialKras,
  supervisorFeedback: initFeedback = "",
  midYearRemarks: initRemarks = "",
  readonly = false,
  onSave,
  onSubmit,
}: IpcrfFormProps) {
  const [kras, setKras] = React.useState<KraEntry[]>(
    initialKras && initialKras.length > 0
      ? initialKras.map(kraDataToEntry)
      : [defaultKra()],
  );
  const [supervisorFeedback, setSupervisorFeedback] =
    React.useState(initFeedback);
  const [midYearRemarks, setMidYearRemarks] = React.useState(initRemarks);
  const [raterRemarks, setRaterRemarks] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Live final rating computation (review phase only)
  const finalRating = React.useMemo(() => {
    if (phase !== "review") return null;
    const inputs = kras
      .filter((k) => typeof k.rating === "number")
      .map((k) => ({ weight: k.weight, rating: k.rating as number }));
    if (inputs.length === 0 || inputs.length < kras.length) return null;
    return computeFinalRating(inputs);
  }, [kras, phase]);

  const formData: IpcrfFormData = {
    kras,
    supervisorFeedback,
    midYearRemarks,
    raterRemarks,
  };

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* KRA Editor (planning + review phases) */}
      {(phase === "planning" || phase === "review") && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Key Result Areas (KRAs)
          </h3>
          <KraEditor
            kras={kras}
            onChange={setKras}
            mode={phase === "planning" ? "planning" : "review"}
            readonly={readonly}
          />
        </section>
      )}

      {/* Monitoring: supervisor feedback fields */}
      {phase === "monitoring" && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Mid-Year Monitoring
          </h3>

          <div>
            <label
              htmlFor="supervisor-feedback"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Supervisor Feedback
            </label>
            <textarea
              id="supervisor-feedback"
              value={supervisorFeedback}
              onChange={(e) => setSupervisorFeedback(e.target.value)}
              disabled={readonly}
              rows={4}
              maxLength={2000}
              placeholder="Provide mid-year feedback on performance and progress…"
              className={cn(
                "w-full resize-none rounded-md border px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input bg-background text-foreground",
              )}
            />
          </div>

          <div>
            <label
              htmlFor="mid-year-remarks"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Mid-Year Remarks
            </label>
            <textarea
              id="mid-year-remarks"
              value={midYearRemarks}
              onChange={(e) => setMidYearRemarks(e.target.value)}
              disabled={readonly}
              rows={3}
              maxLength={2000}
              placeholder="Additional notes, coaching discussions, adjustments…"
              className={cn(
                "w-full resize-none rounded-md border px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input bg-background text-foreground",
              )}
            />
          </div>
        </section>
      )}

      {/* Review: rater remarks + live final rating */}
      {phase === "review" && (
        <section className="space-y-4">
          <div>
            <label
              htmlFor="rater-remarks"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Rater&apos;s Remarks
            </label>
            <textarea
              id="rater-remarks"
              value={raterRemarks}
              onChange={(e) => setRaterRemarks(e.target.value)}
              disabled={readonly}
              rows={3}
              maxLength={2000}
              placeholder="Overall assessment and development recommendations…"
              className={cn(
                "w-full resize-none rounded-md border px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input bg-background text-foreground",
              )}
            />
          </div>

          {/* Live computed final rating */}
          {finalRating && (
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Computed Final Rating:
                </span>
                <RatingBadge
                  adjectival={finalRating.adjectival}
                  numerical={finalRating.numerical}
                  size="lg"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Actions */}
      {!readonly && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || submitting}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || submitting}
            className={cn(
              "rounded-md bg-pcso-navy px-4 py-2 text-sm font-medium text-pcso-cream",
              "hover:bg-pcso-navy-light transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      )}

      {/* Suppress unused ratingId lint */}
      <input type="hidden" name="rating-id" value={ratingId} />
    </div>
  );
}
