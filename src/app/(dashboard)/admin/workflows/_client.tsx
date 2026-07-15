"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Sprout,
  Trash2,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  seedDefaultWorkflows,
  toggleWorkflowActive,
  upsertWorkflowDefinition,
} from "@/lib/actions/admin/workflows";
import {
  ACTOR_ROLE_OPTIONS,
  actorLabel,
  PROCESS_LABELS,
  STEP_KIND_LABELS,
  WORKFLOW_PROCESS_KEY_LIST,
  WORKFLOW_STEP_KINDS,
  type WorkflowDefinitionDto,
  type WorkflowProcessKey,
  type WorkflowStepKind,
} from "@/lib/workflows/constants";

const CUSTOM_ACTOR = "__custom__";

interface EditorStep {
  label: string;
  actor: string;
  kind: WorkflowStepKind;
  /** Kept as a string for the number input; "" = no SLA. */
  slaDays: string;
  notes: string;
}

interface EditorState {
  processKey: WorkflowProcessKey;
  name: string;
  description: string;
  isActive: boolean;
  steps: EditorStep[];
}

function blankStep(): EditorStep {
  return {
    label: "",
    actor: "hr_admin",
    kind: "process",
    slaDays: "",
    notes: "",
  };
}

function editorFromDefinition(
  processKey: WorkflowProcessKey,
  def: WorkflowDefinitionDto | undefined,
): EditorState {
  if (!def) {
    return {
      processKey,
      name: PROCESS_LABELS[processKey].replace(/\s*\(.*\)$/, ""),
      description: "",
      isActive: true,
      steps: [blankStep()],
    };
  }
  return {
    processKey,
    name: def.name,
    description: def.description ?? "",
    isActive: def.isActive,
    steps: [...def.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        label: step.label,
        actor: step.actor,
        kind: (WORKFLOW_STEP_KINDS as readonly string[]).includes(step.kind)
          ? (step.kind as WorkflowStepKind)
          : "process",
        slaDays: step.slaDays == null ? "" : String(step.slaDays),
        notes: step.notes ?? "",
      })),
  };
}

type Props = {
  definitions: WorkflowDefinitionDto[];
  canWrite: boolean;
};

export function WorkflowsClient({ definitions, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const byKey = useMemo(() => {
    const map = new Map<string, WorkflowDefinitionDto>();
    for (const def of definitions) map.set(def.processKey, def);
    return map;
  }, [definitions]);

  const missingCount = WORKFLOW_PROCESS_KEY_LIST.filter(
    (key) => !byKey.has(key),
  ).length;

  function openEditor(processKey: WorkflowProcessKey) {
    setEditor(editorFromDefinition(processKey, byKey.get(processKey)));
  }

  function handleSeed() {
    startTransition(async () => {
      try {
        const { seeded } = await seedDefaultWorkflows();
        toast.success(
          seeded > 0
            ? `Seeded ${seeded} default workflow${seeded === 1 ? "" : "s"}`
            : "All workflows already configured",
        );
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to seed defaults";
        toast.error(message);
      }
    });
  }

  function handleToggle(def: WorkflowDefinitionDto, isActive: boolean) {
    startTransition(async () => {
      try {
        await toggleWorkflowActive({ id: def.id, isActive });
        toast.success(`${def.name} ${isActive ? "activated" : "deactivated"}`);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update workflow";
        toast.error(message);
      }
    });
  }

  async function handleSave() {
    if (!editor) return;
    if (editor.name.trim().length === 0) {
      toast.error("Workflow name is required");
      return;
    }
    for (const [index, step] of editor.steps.entries()) {
      if (step.label.trim().length === 0) {
        toast.error(`Step ${index + 1} needs a label`);
        return;
      }
      if (step.actor.trim().length === 0) {
        toast.error(`Step ${index + 1} needs an actor`);
        return;
      }
    }

    setSaving(true);
    try {
      await upsertWorkflowDefinition({
        processKey: editor.processKey,
        name: editor.name.trim(),
        description:
          editor.description.trim().length > 0
            ? editor.description.trim()
            : null,
        isActive: editor.isActive,
        steps: editor.steps.map((step) => ({
          label: step.label.trim(),
          actor: step.actor.trim(),
          kind: step.kind,
          slaDays: step.slaDays === "" ? null : Number(step.slaDays),
          notes: step.notes.trim().length > 0 ? step.notes.trim() : null,
        })),
      });
      toast.success("Workflow definition saved");
      setEditor(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save workflow";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function patchStep(index: number, patch: Partial<EditorStep>) {
    setEditor((state) => {
      if (!state) return state;
      const steps = state.steps.map((step, i) =>
        i === index ? { ...step, ...patch } : step,
      );
      return { ...state, steps };
    });
  }

  function moveStep(index: number, direction: -1 | 1) {
    setEditor((state) => {
      if (!state) return state;
      const target = index + direction;
      if (target < 0 || target >= state.steps.length) return state;
      const steps = [...state.steps];
      const current = steps[index];
      const other = steps[target];
      if (!current || !other) return state;
      steps[index] = other;
      steps[target] = current;
      return { ...state, steps };
    });
  }

  function removeStep(index: number) {
    setEditor((state) => {
      if (!state) return state;
      if (state.steps.length <= 1) return state;
      return { ...state, steps: state.steps.filter((_, i) => i !== index) };
    });
  }

  function addStep() {
    setEditor((state) =>
      state ? { ...state, steps: [...state.steps, blankStep()] } : state,
    );
  }

  return (
    <div className="space-y-4">
      {canWrite && missingCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
          <div>
            <p className="text-sm font-medium">
              {missingCount === WORKFLOW_PROCESS_KEY_LIST.length
                ? "No workflows configured yet."
                : `${missingCount} process${missingCount === 1 ? "" : "es"} not configured.`}
            </p>
            <p className="text-xs text-muted-foreground">
              Seed the default chains from PRD §12, then adjust steps as needed.
            </p>
          </div>
          <Button
            onClick={handleSeed}
            disabled={isPending}
            className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            <Sprout className="h-4 w-4" />
            {isPending ? "Seeding…" : "Seed defaults"}
          </Button>
        </div>
      )}

      {WORKFLOW_PROCESS_KEY_LIST.map((processKey) => {
        const def = byKey.get(processKey);
        return (
          <Card
            key={processKey}
            className={def?.isActive === false ? "opacity-60" : ""}
          >
            <CardHeader className="space-y-1 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {def ? def.name : PROCESS_LABELS[processKey]}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {processKey}
                  </Badge>
                  {def && !def.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  {def && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={def.isActive}
                        disabled={!canWrite || isPending}
                        onCheckedChange={(checked) =>
                          handleToggle(def, checked)
                        }
                      />
                      Active
                    </label>
                  )}
                  {canWrite && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openEditor(processKey)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {def ? "Edit steps" : "Configure"}
                    </Button>
                  )}
                </div>
              </div>
              {def?.description && (
                <p className="text-xs text-muted-foreground">
                  {def.description}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {def && def.steps.length > 0 ? (
                <StepChain steps={def.steps} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not configured —{" "}
                  {canWrite
                    ? "use Configure or Seed defaults"
                    : "no step chain defined yet"}
                  .
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ── Step editor dialog ── */}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editor ? PROCESS_LABELS[editor.processKey] : ""}
            </DialogTitle>
            <DialogDescription>
              Define the ordered step chain: who acts, what they do, and the SLA
              in business days. Changes are audit-logged.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wf-name">Workflow name</Label>
                  <Input
                    id="wf-name"
                    value={editor.name}
                    maxLength={200}
                    onChange={(e) =>
                      setEditor({ ...editor, name: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end justify-between gap-3 rounded-md border px-3 py-2">
                  <Label htmlFor="wf-active" className="pb-1">
                    Active
                  </Label>
                  <Switch
                    id="wf-active"
                    checked={editor.isActive}
                    onCheckedChange={(checked) =>
                      setEditor({ ...editor, isActive: checked })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wf-description">Description</Label>
                <Textarea
                  id="wf-description"
                  value={editor.description}
                  maxLength={1000}
                  rows={2}
                  onChange={(e) =>
                    setEditor({ ...editor, description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Steps (top to bottom = chain order)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={addStep}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add step
                  </Button>
                </div>

                {editor.steps.map((step, index) => (
                  <StepEditorRow
                    key={index}
                    index={index}
                    step={step}
                    isFirst={index === 0}
                    isLast={index === editor.steps.length - 1}
                    canRemove={editor.steps.length > 1}
                    onChange={(patch) => patchStep(index, patch)}
                    onMoveUp={() => moveStep(index, -1)}
                    onMoveDown={() => moveStep(index, 1)}
                    onRemove={() => removeStep(index)}
                  />
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {saving ? "Saving…" : "Save workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Step chain (read view) ──────────────────────────────────────────────────

function StepChain({ steps }: { steps: WorkflowDefinitionDto["steps"] }) {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ordered.map((step, index) => (
        <div
          key={`${step.order}-${step.label}`}
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pcso-navy text-[10px] font-semibold text-white">
              {step.order}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {actorLabel(step.actor)}
                {" · "}
                {STEP_KIND_LABELS[step.kind as WorkflowStepKind] ?? step.kind}
                {step.slaDays != null && ` · SLA ${step.slaDays}d`}
              </p>
            </div>
          </div>
          {index < ordered.length - 1 && (
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step editor row ─────────────────────────────────────────────────────────

function StepEditorRow({
  index,
  step,
  isFirst,
  isLast,
  canRemove,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  step: EditorStep;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<EditorStep>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const isKnownActor = ACTOR_ROLE_OPTIONS.some((o) => o.value === step.actor);
  const selectValue = isKnownActor ? step.actor : CUSTOM_ACTOR;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pcso-navy text-[10px] font-semibold text-white">
            {index + 1}
          </span>
          Step {index + 1}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isFirst}
            onClick={onMoveUp}
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isLast}
            onClick={onMoveDown}
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            disabled={!canRemove}
            onClick={onRemove}
            title="Remove step"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Label</Label>
          <Input
            value={step.label}
            maxLength={120}
            placeholder="e.g. Supervisor approves or disapproves"
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Actor</Label>
          <Select
            value={selectValue}
            onValueChange={(value) =>
              onChange({ actor: value === CUSTOM_ACTOR ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select actor" />
            </SelectTrigger>
            <SelectContent>
              {ACTOR_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_ACTOR}>
                Other (position title)…
              </SelectItem>
            </SelectContent>
          </Select>
          {selectValue === CUSTOM_ACTOR && (
            <Input
              value={step.actor}
              maxLength={120}
              placeholder="e.g. OIC-Division Chief, Budget Officer"
              onChange={(e) => onChange({ actor: e.target.value })}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Kind</Label>
          <Select
            value={step.kind}
            onValueChange={(value) =>
              onChange({ kind: value as WorkflowStepKind })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_STEP_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {STEP_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>SLA (business days)</Label>
          <Input
            type="number"
            min={0}
            max={365}
            value={step.slaDays}
            placeholder="No SLA"
            onChange={(e) => onChange({ slaDays: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input
            value={step.notes}
            maxLength={500}
            placeholder="Optional context shown to admins"
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
