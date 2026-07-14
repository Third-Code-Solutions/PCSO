"use client";

/**
 * Interview scheduling UI (TOR 1.2.20) — "Schedule Interview" dialog plus the
 * list of active interview batches for the vacancy. Server actions are
 * imported directly; results toast + refresh the page.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClockIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelInterviewSchedule,
  createInterviewSchedule,
} from "@/lib/actions/rpm/interviews";

export interface EligibleApplicantView {
  applicationId: string;
  applicantName: string;
  status: string;
  alreadyScheduled: boolean;
}

export interface InterviewScheduleView {
  id: string;
  /** ISO datetime string. */
  scheduledAt: string;
  venue: string;
  mode: string;
  panel: string | null;
  notes: string | null;
  notifiedAt: string | null;
  applicants: Array<{
    applicationId: string;
    applicationNumber: string;
    applicantName: string;
    status: string;
  }>;
}

interface InterviewSectionClientProps {
  vacancyId: string;
  canManage: boolean;
  eligible: EligibleApplicantView[];
  schedules: InterviewScheduleView[];
}

const MODE_LABELS: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  phone: "Phone",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InterviewSectionClient({
  vacancyId,
  canManage,
  eligible,
  schedules,
}: InterviewSectionClientProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [mode, setMode] = React.useState<string>("in_person");
  const [panel, setPanel] = React.useState("");
  const [notes, setNotes] = React.useState("");

  function toggle(applicationId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
  }

  function resetForm() {
    setSelected(new Set());
    setScheduledAt("");
    setVenue("");
    setMode("in_person");
    setPanel("");
    setNotes("");
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one applicant.");
      return;
    }
    if (!scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    setIsPending(true);
    try {
      const result = await createInterviewSchedule({
        vacancyId,
        applicationIds: Array.from(selected),
        scheduledAt: new Date(scheduledAt),
        venue,
        mode,
        panel: panel || undefined,
        notes: notes || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        `Interview scheduled — ${result.data.assigned} applicant(s) notified.`,
      );
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setIsPending(false);
    }
  }

  async function handleCancel(scheduleId: string) {
    if (
      !window.confirm(
        "Cancel this interview schedule? Assigned applicants will be notified.",
      )
    ) {
      return;
    }
    setCancellingId(scheduleId);
    try {
      const result = await cancelInterviewSchedule(scheduleId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Interview cancelled — ${result.data.unassigned} applicant(s) notified.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Interviews</CardTitle>
            <CardDescription>
              Group qualified or shortlisted applicants into interview batches
              (TOR 1.2.20). Applicants are notified by email and portal.
            </CardDescription>
          </div>
          {canManage && (
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
                  disabled={eligible.length === 0}
                >
                  <CalendarClockIcon className="mr-1.5 h-4 w-4" />
                  Schedule Interview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Schedule Interview</DialogTitle>
                  <DialogDescription>
                    Pick applicants and set the interview details. Each
                    applicant receives an email and a portal notification.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  {error && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Applicants</Label>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {eligible.map((a) => (
                        <label
                          key={a.applicationId}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selected.has(a.applicationId)}
                            onCheckedChange={() => toggle(a.applicationId)}
                            aria-label={`Select ${a.applicantName}`}
                          />
                          <span className="flex-1">{a.applicantName}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.status.replaceAll("_", " ")}
                            {a.alreadyScheduled ? " · scheduled" : ""}
                          </span>
                        </label>
                      ))}
                      {eligible.length === 0 && (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">
                          No eligible applicants.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="interview-datetime">
                        Date &amp; Time *
                      </Label>
                      <Input
                        id="interview-datetime"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mode *</Label>
                      <Select value={mode} onValueChange={setMode}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_person">In person</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interview-venue">Venue *</Label>
                    <Input
                      id="interview-venue"
                      type="text"
                      placeholder="e.g., PCSO Main Office Conference Room B"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interview-panel">Panel (optional)</Label>
                    <Input
                      id="interview-panel"
                      type="text"
                      placeholder="e.g., HRD Manager, Division Chief, AGM"
                      value={panel}
                      onChange={(e) => setPanel(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interview-notes">Notes (optional)</Label>
                    <Textarea
                      id="interview-notes"
                      placeholder="Instructions for applicants"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
                    >
                      {isPending ? "Scheduling…" : "Schedule & Notify"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No interviews scheduled yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Applicants</TableHead>
                  <TableHead>Notified</TableHead>
                  {canManage && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatDateTime(s.scheduledAt)}
                    </TableCell>
                    <TableCell>{s.venue}</TableCell>
                    <TableCell>{MODE_LABELS[s.mode] ?? s.mode}</TableCell>
                    <TableCell>
                      <span
                        title={s.applicants
                          .map((a) => a.applicantName)
                          .join(", ")}
                      >
                        {s.applicants.length > 0
                          ? `${s.applicants.length} — ${s.applicants
                              .slice(0, 3)
                              .map((a) => a.applicantName)
                              .join(", ")}${s.applicants.length > 3 ? "…" : ""}`
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.notifiedAt ? formatDateTime(s.notifiedAt) : "Pending"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(s.id)}
                          disabled={cancellingId === s.id}
                        >
                          <XIcon className="mr-1 h-3.5 w-3.5" />
                          {cancellingId === s.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
