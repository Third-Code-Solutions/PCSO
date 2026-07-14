"use client";

/**
 * PDS Profile extras card — CS Form 212 Section I extras + page-4 data that
 * live directly on the employees row: place of birth, height/weight, SSS,
 * telephone, permanent address, dual citizenship, government-issued ID,
 * questions 34–40, non-academic distinctions, and organization memberships.
 *
 * Edited via a single dialog that calls `updateEmployeePdsProfile`.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { updateEmployeePdsProfile } from "@/lib/actions/pimm/employee-201";
import { PDS_QUESTIONS } from "@/lib/utils/pimm/pds-questions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdsProfileData {
  placeOfBirth: string | null;
  heightM: string | null;
  weightKg: string | null;
  sssNo: string | null;
  telephoneNo: string | null;
  permanentAddressStreet: string | null;
  permanentAddressBarangay: string | null;
  permanentAddressCity: string | null;
  permanentAddressProvince: string | null;
  permanentAddressZipCode: string | null;
  dualCitizenshipType: string | null;
  dualCitizenshipCountry: string | null;
  governmentIssuedId: {
    idType?: string;
    idNo?: string;
    dateIssued?: string;
    placeIssued?: string;
  } | null;
  pdsQuestionnaire: Record<
    string,
    { answer: boolean; details?: string | null }
  > | null;
  nonAcademicDistinctions: string[] | null;
  organizationMemberships: string[] | null;
}

interface PdsProfileCardProps {
  employeeId: string;
  canEdit: boolean;
  profile: PdsProfileData;
}

/** Tri-state questionnaire answer used in the dialog. */
type QuestionChoice = "unanswered" | "yes" | "no";

interface QuestionFormEntry {
  choice: QuestionChoice;
  details: string;
}

const NONE_VALUE = "__none__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function display(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function questionFormFromStored(
  stored: PdsProfileData["pdsQuestionnaire"],
): Record<string, QuestionFormEntry> {
  const out: Record<string, QuestionFormEntry> = {};
  for (const q of PDS_QUESTIONS) {
    const entry = stored?.[q.key];
    out[q.key] = entry
      ? {
          choice: entry.answer ? "yes" : "no",
          details: entry.details ?? "",
        }
      : { choice: "unanswered", details: "" };
  }
  return out;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 font-medium">{value}</span>
    </div>
  );
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  step,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PdsProfileCard({
  employeeId,
  canEdit,
  profile,
}: PdsProfileCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<Record<string, QuestionFormEntry>>(
    {},
  );

  const permanentAddress =
    [
      profile.permanentAddressStreet,
      profile.permanentAddressBarangay,
      profile.permanentAddressCity,
      profile.permanentAddressProvince,
      profile.permanentAddressZipCode,
    ]
      .filter(Boolean)
      .join(", ") || null;

  const govId = profile.governmentIssuedId;
  const govIdDisplay =
    [govId?.idType, govId?.idNo].filter(Boolean).join(" — ") || null;

  const answeredCount = PDS_QUESTIONS.filter(
    (q) => profile.pdsQuestionnaire?.[q.key] != null,
  ).length;

  const dualCitizenship = profile.dualCitizenshipType
    ? `${profile.dualCitizenshipType === "by_naturalization" ? "By naturalization" : "By birth"}${
        profile.dualCitizenshipCountry
          ? ` — ${profile.dualCitizenshipCountry}`
          : ""
      }`
    : null;

  function openDialog() {
    setForm({
      placeOfBirth: profile.placeOfBirth ?? "",
      heightM: profile.heightM ?? "",
      weightKg: profile.weightKg ?? "",
      sssNo: profile.sssNo ?? "",
      telephoneNo: profile.telephoneNo ?? "",
      permanentAddressStreet: profile.permanentAddressStreet ?? "",
      permanentAddressBarangay: profile.permanentAddressBarangay ?? "",
      permanentAddressCity: profile.permanentAddressCity ?? "",
      permanentAddressProvince: profile.permanentAddressProvince ?? "",
      permanentAddressZipCode: profile.permanentAddressZipCode ?? "",
      dualCitizenshipType: profile.dualCitizenshipType ?? "",
      dualCitizenshipCountry: profile.dualCitizenshipCountry ?? "",
      govIdType: govId?.idType ?? "",
      govIdNo: govId?.idNo ?? "",
      govIdDateIssued: govId?.dateIssued ?? "",
      govIdPlaceIssued: govId?.placeIssued ?? "",
      distinctions: (profile.nonAcademicDistinctions ?? []).join("\n"),
      memberships: (profile.organizationMemberships ?? []).join("\n"),
    });
    setQuestions(questionFormFromStored(profile.pdsQuestionnaire));
    setOpen(true);
  }

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const hasGovId = [
        form.govIdType,
        form.govIdNo,
        form.govIdDateIssued,
        form.govIdPlaceIssued,
      ].some((v) => v && v.trim() !== "");

      const questionnaire: Record<
        string,
        { answer: boolean; details: string | null }
      > = {};
      for (const q of PDS_QUESTIONS) {
        const entry = questions[q.key];
        if (!entry || entry.choice === "unanswered") continue;
        questionnaire[q.key] = {
          answer: entry.choice === "yes",
          details: entry.details.trim() || null,
        };
      }

      const result = await updateEmployeePdsProfile({
        employeeId,
        placeOfBirth: form.placeOfBirth,
        heightM: form.heightM,
        weightKg: form.weightKg,
        sssNo: form.sssNo,
        telephoneNo: form.telephoneNo,
        permanentAddressStreet: form.permanentAddressStreet,
        permanentAddressBarangay: form.permanentAddressBarangay,
        permanentAddressCity: form.permanentAddressCity,
        permanentAddressProvince: form.permanentAddressProvince,
        permanentAddressZipCode: form.permanentAddressZipCode,
        dualCitizenshipType: form.dualCitizenshipType,
        dualCitizenshipCountry: form.dualCitizenshipCountry,
        governmentIssuedId: hasGovId
          ? {
              idType: form.govIdType,
              idNo: form.govIdNo,
              dateIssued: form.govIdDateIssued,
              placeIssued: form.govIdPlaceIssued,
            }
          : null,
        pdsQuestionnaire: questionnaire,
        nonAcademicDistinctions: splitLines(form.distinctions ?? ""),
        organizationMemberships: splitLines(form.memberships ?? ""),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("PDS profile updated");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update PDS profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-pcso-navy">
            PDS Profile
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CS Form 212 Section I extras, questions 34–40, and other information
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={openDialog}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit PDS Profile
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          <div className="divide-y divide-border">
            <InfoRow
              label="Place of Birth"
              value={display(profile.placeOfBirth)}
            />
            <InfoRow
              label="Height / Weight"
              value={
                profile.heightM || profile.weightKg
                  ? `${profile.heightM ?? "—"} m / ${profile.weightKg ?? "—"} kg`
                  : "—"
              }
            />
            <InfoRow label="SSS No." value={display(profile.sssNo)} />
            <InfoRow
              label="Telephone No."
              value={display(profile.telephoneNo)}
            />
            <InfoRow
              label="Dual Citizenship"
              value={display(dualCitizenship)}
            />
          </div>
          <div className="divide-y divide-border">
            <InfoRow
              label="Permanent Address"
              value={display(permanentAddress)}
            />
            <InfoRow
              label="Government-Issued ID"
              value={display(govIdDisplay)}
            />
            <InfoRow
              label="Questions 34–40"
              value={
                <Badge
                  variant={
                    answeredCount === PDS_QUESTIONS.length
                      ? "success"
                      : "warning"
                  }
                >
                  {answeredCount} of {PDS_QUESTIONS.length} answered
                </Badge>
              }
            />
            <InfoRow
              label="Distinctions"
              value={
                profile.nonAcademicDistinctions?.length
                  ? profile.nonAcademicDistinctions.join(", ")
                  : "—"
              }
            />
            <InfoRow
              label="Memberships"
              value={
                profile.organizationMemberships?.length
                  ? profile.organizationMemberships.join(", ")
                  : "—"
              }
            />
          </div>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit PDS Profile</DialogTitle>
            <DialogDescription>
              CS Form 212 personal-information extras and page-4 questionnaire.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabeledInput
                id="pds-placeOfBirth"
                label="Place of Birth"
                value={form.placeOfBirth ?? ""}
                onChange={(v) => setField("placeOfBirth", v)}
              />
            </div>
            <LabeledInput
              id="pds-heightM"
              label="Height (m)"
              type="number"
              step="0.01"
              placeholder="1.65"
              value={form.heightM ?? ""}
              onChange={(v) => setField("heightM", v)}
            />
            <LabeledInput
              id="pds-weightKg"
              label="Weight (kg)"
              type="number"
              step="0.1"
              placeholder="62.5"
              value={form.weightKg ?? ""}
              onChange={(v) => setField("weightKg", v)}
            />
            <LabeledInput
              id="pds-sssNo"
              label="SSS No."
              value={form.sssNo ?? ""}
              onChange={(v) => setField("sssNo", v)}
            />
            <LabeledInput
              id="pds-telephoneNo"
              label="Telephone No."
              value={form.telephoneNo ?? ""}
              onChange={(v) => setField("telephoneNo", v)}
            />

            <div className="space-y-1.5">
              <Label htmlFor="pds-dualType" className="text-xs">
                Dual Citizenship
              </Label>
              <Select
                value={form.dualCitizenshipType || NONE_VALUE}
                onValueChange={(v) =>
                  setField("dualCitizenshipType", v === NONE_VALUE ? "" : v)
                }
              >
                <SelectTrigger id="pds-dualType">
                  <SelectValue placeholder="Not a dual citizen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not a dual citizen</SelectItem>
                  <SelectItem value="by_birth">Dual — by birth</SelectItem>
                  <SelectItem value="by_naturalization">
                    Dual — by naturalization
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <LabeledInput
              id="pds-dualCountry"
              label="Dual Citizenship Country"
              value={form.dualCitizenshipCountry ?? ""}
              onChange={(v) => setField("dualCitizenshipCountry", v)}
            />

            <div className="sm:col-span-2">
              <Separator className="my-1" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permanent Address (Item 18)
              </p>
            </div>
            <div className="sm:col-span-2">
              <LabeledInput
                id="pds-permStreet"
                label="House / Block / Lot No., Street, Subdivision"
                value={form.permanentAddressStreet ?? ""}
                onChange={(v) => setField("permanentAddressStreet", v)}
              />
            </div>
            <LabeledInput
              id="pds-permBarangay"
              label="Barangay"
              value={form.permanentAddressBarangay ?? ""}
              onChange={(v) => setField("permanentAddressBarangay", v)}
            />
            <LabeledInput
              id="pds-permCity"
              label="City / Municipality"
              value={form.permanentAddressCity ?? ""}
              onChange={(v) => setField("permanentAddressCity", v)}
            />
            <LabeledInput
              id="pds-permProvince"
              label="Province"
              value={form.permanentAddressProvince ?? ""}
              onChange={(v) => setField("permanentAddressProvince", v)}
            />
            <LabeledInput
              id="pds-permZip"
              label="Zip Code"
              value={form.permanentAddressZipCode ?? ""}
              onChange={(v) => setField("permanentAddressZipCode", v)}
            />

            <div className="sm:col-span-2">
              <Separator className="my-1" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Government-Issued ID (signature block)
              </p>
            </div>
            <LabeledInput
              id="pds-govIdType"
              label="ID Type"
              placeholder="Passport, GSIS, PRC, Driver's License…"
              value={form.govIdType ?? ""}
              onChange={(v) => setField("govIdType", v)}
            />
            <LabeledInput
              id="pds-govIdNo"
              label="ID / License / Passport No."
              value={form.govIdNo ?? ""}
              onChange={(v) => setField("govIdNo", v)}
            />
            <LabeledInput
              id="pds-govIdDate"
              label="Date of Issuance"
              type="date"
              value={form.govIdDateIssued ?? ""}
              onChange={(v) => setField("govIdDateIssued", v)}
            />
            <LabeledInput
              id="pds-govIdPlace"
              label="Place of Issuance"
              value={form.govIdPlaceIssued ?? ""}
              onChange={(v) => setField("govIdPlaceIssued", v)}
            />

            <div className="sm:col-span-2">
              <Separator className="my-1" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other Information (Items 32–33) — one entry per line
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pds-distinctions" className="text-xs">
                Non-Academic Distinctions / Recognition
              </Label>
              <Textarea
                id="pds-distinctions"
                rows={3}
                value={form.distinctions ?? ""}
                onChange={(e) => setField("distinctions", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pds-memberships" className="text-xs">
                Membership in Association / Organization
              </Label>
              <Textarea
                id="pds-memberships"
                rows={3}
                value={form.memberships ?? ""}
                onChange={(e) => setField("memberships", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Separator className="my-1" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Questions 34–40
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Leave a question unanswered to keep it blank for hand fill-in on
                the printed PDS.
              </p>
            </div>
            {PDS_QUESTIONS.map((q) => {
              const entry = questions[q.key] ?? {
                choice: "unanswered" as QuestionChoice,
                details: "",
              };
              return (
                <div key={q.key} className="space-y-1.5 sm:col-span-2">
                  <p className="text-xs leading-snug">{q.label}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={entry.choice}
                      onValueChange={(v) =>
                        setQuestions((prev) => ({
                          ...prev,
                          [q.key]: {
                            ...entry,
                            choice: v as QuestionChoice,
                          },
                        }))
                      }
                    >
                      <SelectTrigger
                        className="sm:w-40"
                        aria-label={`Answer for question ${q.key}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unanswered">
                          — Unanswered —
                        </SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                    {entry.choice === "yes" ? (
                      <Input
                        className="flex-1"
                        placeholder={q.detailsPrompt}
                        aria-label={`Details for question ${q.key}`}
                        value={entry.details}
                        onChange={(e) =>
                          setQuestions((prev) => ({
                            ...prev,
                            [q.key]: { ...entry, details: e.target.value },
                          }))
                        }
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save PDS Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
