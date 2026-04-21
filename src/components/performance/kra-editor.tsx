/**
 * KraEditor — interactive editor for Key Result Areas.
 *
 * Used in IPCRF planning phase to define KRAs with weights and targets,
 * and in the review phase to enter per-KRA ratings.
 *
 * Constraints:
 *  - 1 to 10 KRAs
 *  - Weights must sum to exactly 100%
 *  - Ratings (1.000–5.000) shown only in review mode
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { RatingInput } from "./rating-input";
import {
  TOTAL_KRA_WEIGHT,
  MAX_KRAS_PER_IPCRF,
} from "@/lib/constants/performance";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KraEntry {
  position: number;
  title: string;
  description: string;
  weight: number;
  successIndicators: string;
  baseline: string;
  actualAccomplishments: string;
  rating: number | "";
}

interface KraEditorProps {
  kras: KraEntry[];
  onChange: (kras: KraEntry[]) => void;
  mode: "planning" | "review";
  readonly?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyKra(position: number): KraEntry {
  return {
    position,
    title: "",
    description: "",
    weight: 0,
    successIndicators: "",
    baseline: "",
    actualAccomplishments: "",
    rating: "",
  };
}

function totalWeight(kras: KraEntry[]): number {
  return kras.reduce((sum, k) => sum + (k.weight || 0), 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KraEditor({
  kras,
  onChange,
  mode,
  readonly = false,
}: KraEditorProps) {
  const weightTotal = totalWeight(kras);
  const weightValid = Math.round(weightTotal) === TOTAL_KRA_WEIGHT;
  const canAddKra = kras.length < MAX_KRAS_PER_IPCRF && !readonly;

  function updateKra(index: number, updates: Partial<KraEntry>) {
    onChange(
      kras.map((kra, i) => (i === index ? { ...kra, ...updates } : kra)),
    );
  }

  function addKra() {
    if (!canAddKra) return;
    onChange([...kras, emptyKra(kras.length + 1)]);
  }

  function removeKra(index: number) {
    if (readonly) return;
    const updated = kras
      .filter((_, i) => i !== index)
      .map((kra, i) => ({ ...kra, position: i + 1 }));
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {/* Weight summary bar */}
      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2">
        <span className="text-sm text-muted-foreground">
          Total weight:{" "}
          <span
            className={cn(
              "font-semibold",
              weightValid ? "text-emerald-700" : "text-red-600",
            )}
          >
            {weightTotal}%
          </span>{" "}
          / 100%
        </span>
        {!weightValid && (
          <span className="text-xs text-red-600" role="alert">
            Weights must sum to exactly 100%.
          </span>
        )}
      </div>

      {/* KRA list */}
      <div className="space-y-3">
        {kras.map((kra, index) => (
          <KraCard
            key={kra.position}
            kra={kra}
            index={index}
            mode={mode}
            readonly={readonly}
            onUpdate={(updates) => updateKra(index, updates)}
            onRemove={() => removeKra(index)}
            showRemove={kras.length > 1}
          />
        ))}
      </div>

      {/* Add KRA button */}
      {canAddKra && (
        <button
          type="button"
          onClick={addKra}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed",
            "border-muted-foreground/30 py-3 text-sm text-muted-foreground",
            "hover:border-pcso-navy hover:text-pcso-navy transition-colors",
          )}
        >
          <span aria-hidden>+</span>
          Add KRA ({kras.length}/{MAX_KRAS_PER_IPCRF})
        </button>
      )}
    </div>
  );
}

// ─── KraCard sub-component ────────────────────────────────────────────────────

interface KraCardProps {
  kra: KraEntry;
  index: number;
  mode: "planning" | "review";
  readonly: boolean;
  onUpdate: (updates: Partial<KraEntry>) => void;
  onRemove: () => void;
  showRemove: boolean;
}

function KraCard({
  kra,
  index,
  mode,
  readonly,
  onUpdate,
  onRemove,
  showRemove,
}: KraCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pcso-navy text-xs font-bold text-pcso-cream">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            KRA {index + 1}
          </span>
        </div>
        {!readonly && showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove KRA ${index + 1}`}
            className="rounded p-1 text-muted-foreground/60 hover:text-red-600 transition-colors"
          >
            <span aria-hidden>×</span>
          </button>
        )}
      </div>

      <div className="grid gap-3">
        {/* Title */}
        <div>
          <label
            htmlFor={`kra-${index}-title`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            KRA Title <span className="text-red-500">*</span>
          </label>
          <input
            id={`kra-${index}-title`}
            type="text"
            value={kra.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            disabled={readonly}
            placeholder="e.g. Legislative Support"
            maxLength={200}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "border-input bg-background text-foreground",
            )}
          />
        </div>

        {/* Weight + Success Indicators (side by side on md+) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
          {/* Weight */}
          <div>
            <label
              htmlFor={`kra-${index}-weight`}
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Weight (%) <span className="text-red-500">*</span>
            </label>
            <input
              id={`kra-${index}-weight`}
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={kra.weight || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdate({ weight: isNaN(val) ? 0 : val });
              }}
              disabled={readonly}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-sm font-tabular-nums",
                "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input bg-background text-foreground",
              )}
            />
          </div>

          {/* Success Indicators */}
          <div>
            <label
              htmlFor={`kra-${index}-si`}
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Success Indicators / Targets{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              id={`kra-${index}-si`}
              value={kra.successIndicators}
              onChange={(e) => onUpdate({ successIndicators: e.target.value })}
              disabled={readonly}
              placeholder="Describe measurable targets and performance indicators"
              rows={2}
              maxLength={1000}
              className={cn(
                "w-full resize-none rounded-md border px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input bg-background text-foreground",
              )}
            />
          </div>
        </div>

        {/* Baseline (planning only) */}
        {mode === "planning" && (
          <div>
            <label
              htmlFor={`kra-${index}-baseline`}
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Baseline / Context
            </label>
            <input
              id={`kra-${index}-baseline`}
              type="text"
              value={kra.baseline}
              onChange={(e) => onUpdate({ baseline: e.target.value })}
              disabled={readonly}
              placeholder="Current state or reference point"
              maxLength={500}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input bg-background text-foreground",
              )}
            />
          </div>
        )}

        {/* Review mode: actual accomplishments + rating */}
        {mode === "review" && (
          <>
            <div>
              <label
                htmlFor={`kra-${index}-accomplishments`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Actual Accomplishments
              </label>
              <textarea
                id={`kra-${index}-accomplishments`}
                value={kra.actualAccomplishments}
                onChange={(e) =>
                  onUpdate({ actualAccomplishments: e.target.value })
                }
                disabled={readonly}
                placeholder="Describe what was accomplished for this KRA"
                rows={2}
                maxLength={1000}
                className={cn(
                  "w-full resize-none rounded-md border px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:ring-offset-1",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "border-input bg-background text-foreground",
                )}
              />
            </div>

            <RatingInput
              id={`kra-${index}-rating`}
              label="Rating (1.000 – 5.000)"
              value={kra.rating}
              onChange={(val) => onUpdate({ rating: val })}
              disabled={readonly}
              showAdjectival
            />
          </>
        )}
      </div>
    </div>
  );
}
