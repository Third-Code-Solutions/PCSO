"use client";

/**
 * PcrForm — create/edit form for DPCR (PMM-003) and BPCR (PMM-004).
 *
 * Writes to the SAME tables the DPCR/BPCR list + detail pages read
 * (dpcr_forms / bpcr_forms) via the create/update/submit server actions in
 * `@/lib/actions/performance-gaps`. On create, the user picks a rating period
 * (performance_periods); the action mirrors it into the FK-parent cycle.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createDpcr,
  updateDpcr,
  submitDpcr,
  createBpcr,
  updateBpcr,
  submitBpcr,
  reviewPcrForm,
  uploadPcrDocumentFile,
} from "@/lib/actions/performance-gaps";
import { ratingToAdjectival } from "@/lib/utils/performance/rating";
import { PerformanceDocUpload } from "./performance-doc-upload";

type Variant = "dpcr" | "bpcr";
type Phase = "planning" | "monitoring" | "review";
type Adjectival =
  | "outstanding"
  | "very_satisfactory"
  | "satisfactory"
  | "unsatisfactory"
  | "poor";

interface PeriodOption {
  id: string;
  label: string;
}

export interface PcrInitial {
  id: string;
  unitName: string;
  phase: Phase;
  numericalRating: string | null;
  adjectivalRating: Adjectival | null;
  status: string;
  scannedDocUrl: string | null;
}

interface PcrFormProps {
  variant: Variant;
  mode: "create" | "edit";
  periods?: PeriodOption[];
  initial?: PcrInitial;
  /** performance.approve — shows approve / return on a submitted form */
  canReview?: boolean;
}

const ADJECTIVALS: { value: Adjectival; label: string }[] = [
  { value: "outstanding", label: "Outstanding" },
  { value: "very_satisfactory", label: "Very Satisfactory" },
  { value: "satisfactory", label: "Satisfactory" },
  { value: "unsatisfactory", label: "Unsatisfactory" },
  { value: "poor", label: "Poor" },
];

const INPUT_CLASS =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const LABEL_CLASS = "text-xs font-medium text-muted-foreground";

export function PcrForm({
  variant,
  mode,
  periods = [],
  initial,
  canReview = false,
}: PcrFormProps) {
  const router = useRouter();
  const unitLabel = variant === "dpcr" ? "Division" : "Branch";

  const [periodId, setPeriodId] = React.useState(periods[0]?.id ?? "");
  const [unitName, setUnitName] = React.useState(initial?.unitName ?? "");
  const [phase, setPhase] = React.useState<Phase>(initial?.phase ?? "planning");
  const [numerical, setNumerical] = React.useState(
    initial?.numericalRating ?? "",
  );
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);

  const numericalValue = numerical.trim() || undefined;
  // Display only — the server derives the stored adjectival (PRD §10.4.1).
  const derivedAdjectival = numericalValue
    ? ratingToAdjectival(Number(numericalValue))
    : null;
  const derivedLabel = numericalValue
    ? (ADJECTIVALS.find((a) => a.value === derivedAdjectival)?.label ??
      "Out of range (1.000–5.000)")
    : "—";

  async function handleCreate(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!periodId) {
      setError("Select a rating period.");
      return;
    }
    setBusy(true);
    try {
      const res =
        variant === "dpcr"
          ? await createDpcr({
              periodId,
              divisionName: unitName,
              phase,
              numericalRating: numericalValue,
            })
          : await createBpcr({
              periodId,
              branchName: unitName,
              phase,
              numericalRating: numericalValue,
            });
      if (!res.success || !res.id) {
        setError(res.error ?? "Failed to create.");
        setBusy(false);
        return;
      }
      router.push(`/performance/${variant}/${res.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create.");
      setBusy(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!initial) return;
    setError(null);
    setSavedMsg(null);
    setBusy(true);
    try {
      const res =
        variant === "dpcr"
          ? await updateDpcr(initial.id, {
              divisionName: unitName || undefined,
              phase,
              numericalRating: numericalValue,
            })
          : await updateBpcr(initial.id, {
              branchName: unitName || undefined,
              phase,
              numericalRating: numericalValue,
            });
      if (!res.success) {
        setError(res.error ?? "Failed to save.");
      } else {
        setSavedMsg("Saved.");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitForApproval(): Promise<void> {
    if (!initial) return;
    setError(null);
    setBusy(true);
    try {
      const res =
        variant === "dpcr"
          ? await submitDpcr(initial.id)
          : await submitBpcr(initial.id);
      if (!res.success) setError(res.error ?? "Failed to submit.");
      else router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(decision: "approve" | "return"): Promise<void> {
    if (!initial) return;
    setError(null);
    setBusy(true);
    try {
      const res = await reviewPcrForm({
        variant,
        id: initial.id,
        decision,
        remarks: remarks.trim() || undefined,
      });
      if (!res.success) setError(res.error ?? "Failed to record the review.");
      else router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to record the review.",
      );
    } finally {
      setBusy(false);
    }
  }

  const sharedFields = (
    <>
      <div>
        <label className={LABEL_CLASS} htmlFor="pcr-unit">
          {unitLabel} name
        </label>
        <input
          id="pcr-unit"
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
          required
          placeholder={
            variant === "dpcr" ? "e.g. Finance Division" : "e.g. NCL Branch"
          }
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="pcr-phase">
          Phase
        </label>
        <select
          id="pcr-phase"
          value={phase}
          onChange={(e) => setPhase(e.target.value as Phase)}
          className={INPUT_CLASS}
        >
          <option value="planning">Planning</option>
          <option value="monitoring">Monitoring</option>
          <option value="review">Review</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="pcr-numerical">
            Numerical rating (optional)
          </label>
          <input
            id="pcr-numerical"
            type="number"
            step="0.001"
            min="1"
            max="5"
            value={numerical}
            onChange={(e) => setNumerical(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <span className={LABEL_CLASS}>Adjectival rating</span>
          <p className="mt-1 flex h-9 items-center text-sm" aria-live="polite">
            {derivedLabel}
          </p>
        </div>
      </div>
    </>
  );

  const errorBlock = error && (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </div>
  );

  if (mode === "create") {
    return (
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="pcr-period">
            Rating period
          </label>
          <select
            id="pcr-period"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            required
            className={INPUT_CLASS}
          >
            {periods.length === 0 ? (
              <option value="">
                No rating periods — create a performance cycle first
              </option>
            ) : (
              periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))
            )}
          </select>
        </div>
        {sharedFields}
        {errorBlock}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={busy || periods.length === 0}
            className="rounded-md bg-pcso-navy px-4 py-2 text-sm font-medium text-pcso-cream transition-colors hover:bg-pcso-navy-light disabled:opacity-50"
          >
            {busy ? "Creating…" : `Create ${variant.toUpperCase()}`}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={busy}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted/40"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const isDraft = initial?.status === "draft";
  const isSubmitted = initial?.status === "submitted";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Only drafts are editable; the server enforces the same rule. */}
        <fieldset disabled={!isDraft} className="space-y-4">
          {sharedFields}
        </fieldset>
        {errorBlock}
        {savedMsg && <p className="text-xs text-emerald-600">{savedMsg}</p>}
        {isDraft && (
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="rounded-md bg-pcso-navy px-4 py-2 text-sm font-medium text-pcso-cream transition-colors hover:bg-pcso-navy-light disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={busy}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted/40"
            >
              Submit for approval
            </button>
          </div>
        )}
        {isSubmitted && canReview && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className={LABEL_CLASS} htmlFor="pcr-remarks">
                Review remarks (required to return)
              </label>
              <textarea
                id="pcr-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={500}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleReview("approve")}
                disabled={busy}
                className="rounded-md bg-pcso-navy px-4 py-2 text-sm font-medium text-pcso-cream transition-colors hover:bg-pcso-navy-light disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReview("return")}
                disabled={busy || !remarks.trim()}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
              >
                Return to draft
              </button>
            </div>
          </div>
        )}
      </div>

      {initial && (
        <div className="border-t pt-4">
          <PerformanceDocUpload
            uploadAction={async (payload) => {
              const r = await uploadPcrDocumentFile({
                variant,
                formId: initial.id,
                ...payload,
              });
              if (!r.success) throw new Error(r.error ?? "Upload failed.");
            }}
          />
          {initial.scannedDocUrl && (
            <a
              href={initial.scannedDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-pcso-navy hover:underline"
            >
              View current scanned document
            </a>
          )}
        </div>
      )}
    </div>
  );
}
