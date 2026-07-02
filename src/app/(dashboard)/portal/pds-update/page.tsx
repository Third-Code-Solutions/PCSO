"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UserPen, AlertCircle } from "lucide-react";
import {
  getMyPdsUpdateRequests,
  submitPdsUpdateRequest,
} from "@/lib/actions/portal/pds-update";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PdsUpdateRequest } from "@/lib/db/schema";

// PDS Section 31 (Special Skills & Hobbies) self-update — EPM-012.
// The employee proposes changes; HRD approves before they commit to the 201
// file (employees.special_skills_hobbies), which feeds the EWBM wellness report.

type ReqStatus = PdsUpdateRequest["status"];

const STATUS_LABELS: Record<string, string> = {
  submitted: "Pending HR Review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "success" | "warning" | "outline"
> = {
  submitted: "warning",
  approved: "success",
  rejected: "destructive",
};

function toList(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function fromList(list: unknown): string {
  return Array.isArray(list) ? list.filter((x) => typeof x === "string").join(", ") : "";
}

export default function PortalPdsUpdatePage() {
  const [requests, setRequests] = useState<PdsUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasEmployee, setHasEmployee] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [skills, setSkills] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setHasEmployee(false);
        setLoading(false);
        return;
      }
      await loadRequests();
    }
    init();
  }, []);

  async function loadRequests() {
    try {
      const result = await getMyPdsUpdateRequests();
      if ("data" in result) {
        setRequests(result.data);
        // Prefill from the most recent request's proposed Section 31 values.
        const latest = result.data.find((r) => r.sectionUpdated === "section_31");
        if (latest && latest.proposedChanges && typeof latest.proposedChanges === "object") {
          const pc = latest.proposedChanges as Record<string, unknown>;
          setSkills(fromList(pc.skills));
          setHobbies(fromList(pc.hobbies));
        }
      } else {
        setHasEmployee(false);
      }
    } catch {
      toast.error("Failed to load PDS update history");
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }
    startTransition(async () => {
      const result = await submitPdsUpdateRequest({
        sectionUpdated: "section_31",
        proposedChanges: { skills: toList(skills), hobbies: toList(hobbies) },
        currentValues: {},
        reason: reason.trim(),
        supportingDocumentUrls: [],
      });
      if ("data" in result) {
        toast.success("PDS update submitted for HR approval");
        setReason("");
        await loadRequests();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pcso-navy" />
      </div>
    );
  }

  if (!hasEmployee) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to enable
            self-service PDS updates.
          </CardContent>
        </Card>
      </div>
    );
  }

  const pending = requests.some((r) => r.status === "submitted");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Update PDS — Special Skills &amp; Hobbies
          </h1>
          <p className="text-sm text-muted-foreground">
            Personal Data Sheet Section 31. Changes require HR approval before
            they are committed to your 201 file.
          </p>
        </div>
        <UserPen className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      <Card className="border-pcso-navy/20">
        <CardHeader>
          <CardTitle className="text-lg">Proposed Changes</CardTitle>
          <CardDescription>
            Enter comma-separated values. HR reviews before your record is
            updated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skills">Special Skills</Label>
            <Input
              id="skills"
              placeholder="e.g. Public speaking, Data analysis, First aid"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hobbies">Hobbies</Label>
            <Input
              id="hobbies"
              placeholder="e.g. Basketball, Photography, Gardening"
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for update *</Label>
            <Textarea
              id="reason"
              placeholder="Briefly explain why you are updating this section (min. 10 characters)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          {pending && (
            <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              You have a pending PDS update awaiting HR review. Submitting again
              creates a new request.
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isPending || reason.trim().length < 10}
              className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for Approval
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-pcso-navy">Request History</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PDS update requests yet.
          </p>
        ) : (
          requests.map((req) => (
            <Card key={req.id} className="border-pcso-navy/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[req.status] ?? "secondary"}>
                      {STATUS_LABELS[req.status] ?? req.status}
                    </Badge>
                    <span className="text-sm font-medium capitalize">
                      {req.sectionUpdated.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(req.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {req.reason && (
                  <p className="text-muted-foreground">{req.reason}</p>
                )}
                {req.status === "rejected" && req.rejectionReason && (
                  <p className="text-rose-700">
                    <span className="font-medium">HR:</span> {req.rejectionReason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
