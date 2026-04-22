"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateAppointmentDocuments } from "@/lib/actions/recruitment-appointments";
import { FileText, Download, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AppointmentDocumentsCardProps {
  appointment: {
    id: string;
    status: string | null;
    provisioned: boolean | null;
    generatedDocuments: unknown;
  };
}

const documentLabels: Record<string, string> = {
  csc_appointment: "CSC Appointment",
  position_description: "Position Description Form",
  oath_of_office: "Oath of Office",
  assumption_to_duty: "Assumption to Duty",
  ataf: "ATAF",
};

export function AppointmentDocumentsCard({
  appointment,
}: AppointmentDocumentsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [generated, setGenerated] = useState(appointment.generatedDocuments);

  const docs =
    generated && typeof generated === "object"
      ? (generated as Record<string, string>)
      : null;

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateAppointmentDocuments({
        appointmentId: appointment.id,
      });
      if (result.success && result.documents) {
        setGenerated(result.documents);
        toast.success("Documents generated successfully");
      } else {
        toast.error(result.error ?? "Failed to generate documents");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Generated Documents</CardTitle>
            <CardDescription>
              CSC appointment documents (RPM-022)
            </CardDescription>
          </div>
          {!docs && appointment.status !== "provisioned" && (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-1.5 h-4 w-4" />
                  Generate All
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!docs ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No documents generated yet. Click &quot;Generate All&quot; to
              create appointment documents.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(documentLabels).map(([key, label]) => {
              const url = docs[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-pcso-navy hover:underline flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
