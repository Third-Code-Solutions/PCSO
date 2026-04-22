"use client";

/**
 * RPM-014: Exam scheduling form.
 * HRD sets date/time/venue + dimensions for assessment.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusIcon, XIcon } from "lucide-react";
import type {
  AssessmentDimensionInput,
  CreateAssessmentInput,
} from "@/lib/actions/rpm/selection";

interface ExamSchedulerFormProps {
  vacancyId: string;
  createAssessmentAction: (
    input: CreateAssessmentInput,
  ) => Promise<{
    ok: boolean;
    error?: string;
    data?: { assessmentId: string };
  }>;
}

const DEFAULT_DIMENSIONS: AssessmentDimensionInput[] = [
  {
    key: "written_exam",
    label: "Written Exam",
    weight: 0.4,
    maxScore: 100,
  },
  {
    key: "interview",
    label: "Interview",
    weight: 0.4,
    maxScore: 100,
  },
  {
    key: "physical_exam",
    label: "Physical Exam",
    weight: 0.2,
    maxScore: 100,
  },
];

export function ExamSchedulerForm({
  vacancyId,
  createAssessmentAction,
}: ExamSchedulerFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examDate, setExamDate] = useState("");
  const [venue, setVenue] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dimensions, setDimensions] =
    useState<AssessmentDimensionInput[]>(DEFAULT_DIMENSIONS);

  const addDimension = () => {
    setDimensions([
      ...dimensions,
      { key: "other", label: "", weight: 0, maxScore: 100 },
    ]);
  };

  const removeDimension = (index: number) => {
    setDimensions(dimensions.filter((_, i) => i !== index));
  };

  const updateDimension = (
    index: number,
    field: keyof AssessmentDimensionInput,
    value: string | number,
  ) => {
    const updated = [...dimensions];
    updated[index] = { ...updated[index], [field]: value };
    setDimensions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      // Validate weights sum to 1.0
      const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        setError(
          `Dimension weights must sum to 1.0 (current: ${totalWeight.toFixed(2)})`,
        );
        setIsPending(false);
        return;
      }

      const result = await createAssessmentAction({
        vacancyId,
        examDate: new Date(examDate),
        venue,
        dimensions,
        instructions: instructions || undefined,
      });

      if (!result.ok) {
        setError(result.error ?? "Failed to create assessment");
        setIsPending(false);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Schedule Assessment</CardTitle>
        <CardDescription>
          Set exam date, venue, and rating dimensions for this vacancy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="examDate">Exam Date & Time *</Label>
              <Input
                id="examDate"
                type="datetime-local"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue *</Label>
              <Input
                id="venue"
                type="text"
                placeholder="e.g., PCSO Main Office Training Room"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (optional)</Label>
            <Textarea
              id="instructions"
              placeholder="Special instructions for applicants"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Assessment Dimensions</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addDimension}
              >
                <PlusIcon className="mr-1 h-4 w-4" />
                Add Dimension
              </Button>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
              {dimensions.map((dim, index) => (
                <div
                  key={index}
                  className="flex items-end gap-2 rounded-md border border-border bg-card p-3"
                >
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      type="text"
                      placeholder="e.g., Written Exam"
                      value={dim.label}
                      onChange={(e) =>
                        updateDimension(index, "label", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Weight</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={dim.weight}
                      onChange={(e) =>
                        updateDimension(
                          index,
                          "weight",
                          parseFloat(e.target.value),
                        )
                      }
                      required
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Max Score</Label>
                    <Input
                      type="number"
                      min="1"
                      value={dim.maxScore}
                      onChange={(e) =>
                        updateDimension(
                          index,
                          "maxScore",
                          parseInt(e.target.value, 10),
                        )
                      }
                      required
                    />
                  </div>
                  {dimensions.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeDimension(index)}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Weights must sum to 1.0. Current total:{" "}
              {dimensions.reduce((sum, d) => sum + d.weight, 0).toFixed(2)}
            </p>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
          >
            {isPending ? "Creating..." : "Create Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
