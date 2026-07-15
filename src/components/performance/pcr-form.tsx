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
  uploadPcrDocumentFile,
} from "@/lib/actions/performance-gaps";
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
}: PcrFormProps) {
  const router = useRouter();
  const unitLabel = variant === "dpcr" ? "Division" : "Branch";

  const [periodId, setPeriodId] = React.useState(periods[0]?.id ?? "");
  const [unitName, setUnitName] = React.useState(initial?.unitName ?? "");
  const [phase, setPhase] = React.useState<Phase>(initial?.phase ?? "planning");
  const [numerical, setNumerical] = React.useState(
    initial?.numericalRating ?? "",
  );
  const [adjectival, setAdjectival] = React.useState<Adjectival | "">(
    initial?.adjectivalRating ?? "",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);

  const numericalValue = numerical.trim() || undefined;
  const adjectivalValue: Adjectival | undefined = adjectival || undefined;

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
              adjectivalRating: adjectivalValue,
            })
          : await createBpcr({
              periodId,
              branchName: unitName,
              phase,
              numericalRating: numericalValue,
              adjectivalRating: adjectivalValue,
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
              adjectivalRating: adjectivalValue,
            })
          : await updateBpcr(initial.id, {
              branchName: unitName || undefined,
              phase,
              numericalRating: numericalValue,
              adjectivalRating: adjectivalValue,
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
          <label className={LABEL_CLASS} htmlFor="pcr-adjectival">
            Adjectival rating (optional)
          </label>
          <select
            id="pcr-adjectival"
            value={adjectival}
            onChange={(e) => setAdjectival(e.target.value as Adjectival | "")}
            className={INPUT_CLASS}
          >
            <option value="">—</option>
            {ADJECTIVALS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {sharedFields}
        {errorBlock}
        {savedMsg && <p className="text-xs text-emerald-600">{savedMsg}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-md bg-pcso-navy px-4 py-2 text-sm font-medium text-pcso-cream transition-colors hover:bg-pcso-navy-light disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={busy}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted/40"
            >
              Submit for approval
            </button>
          )}
        </div>
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
