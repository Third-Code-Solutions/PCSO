import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  trainingParticipants,
  trainingRuns,
  trainingPrograms,
  trainingCertificates,
} from "@/lib/db/schema/learning";
import { eq, desc } from "drizzle-orm";
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
import { Download, Calendar, Award, BookOpen } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "My Training History" };

function capitalize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusColor(
  status: string,
): "default" | "success" | "warning" | "muted" {
  switch (status) {
    case "completed":
      return "success";
    case "attended":
      return "success";
    case "confirmed":
      return "warning";
    case "nominated":
      return "muted";
    default:
      return "default";
  }
}

export default async function TrainingHistoryPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Employee Record</CardTitle>
            <CardDescription>
              Your account is not linked to an employee record. Training history
              is not available.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Fetch training participation history with related data
  const trainings = await db
    .select({
      participantId: trainingParticipants.id,
      status: trainingParticipants.status,
      confirmedAt: trainingParticipants.confirmedAt,
      completedAt: trainingParticipants.completedAt,
      postAssessmentScore: trainingParticipants.postAssessmentScore,
      runId: trainingRuns.id,
      runNumber: trainingRuns.runNumber,
      scheduledStart: trainingRuns.scheduledStart,
      scheduledEnd: trainingRuns.scheduledEnd,
      venue: trainingRuns.venue,
      programTitle: trainingPrograms.title,
      programCode: trainingPrograms.code,
      lndType: trainingPrograms.lndType,
      certificateId: trainingCertificates.id,
      certificateNumber: trainingCertificates.certificateNumber,
      certificatePdfUrl: trainingCertificates.pdfUrl,
    })
    .from(trainingParticipants)
    .innerJoin(trainingRuns, eq(trainingParticipants.runId, trainingRuns.id))
    .innerJoin(
      trainingPrograms,
      eq(trainingRuns.programId, trainingPrograms.id),
    )
    .leftJoin(
      trainingCertificates,
      eq(trainingCertificates.participantId, trainingParticipants.id),
    )
    .where(eq(trainingParticipants.employeeId, user.employeeId))
    .orderBy(desc(trainingRuns.scheduledStart));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Training History
          </h1>
          <p className="text-sm text-muted-foreground">
            View your training participation and download certificates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-pcso-navy" />
          <span className="font-mono text-lg font-semibold">
            {trainings.length}
          </span>
          <span className="text-sm text-muted-foreground">trainings</span>
        </div>
      </div>

      {/* Training List */}
      {trainings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No Training History
            </h3>
            <p className="text-sm text-muted-foreground">
              You have not been nominated or participated in any training
              programs yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trainings.map((training) => (
            <Card
              key={training.participantId}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {training.programCode}
                      </Badge>
                      <Badge variant="outline">
                        {capitalize(training.lndType)}
                      </Badge>
                      <Badge variant={getStatusColor(training.status)}>
                        {capitalize(training.status)}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">
                      {training.programTitle}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(
                          new Date(training.scheduledStart),
                          "MMM d, yyyy",
                        )}
                        {training.scheduledEnd &&
                          ` - ${format(new Date(training.scheduledEnd), "MMM d, yyyy")}`}
                      </span>
                      <span>Venue: {training.venue}</span>
                    </CardDescription>
                  </div>

                  {/* Certificate Download */}
                  {training.certificateNumber && training.certificatePdfUrl && (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <a
                        href={training.certificatePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download className="h-4 w-4" />
                        Certificate
                      </a>
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">Run Number</span>
                    <p className="font-mono font-medium">
                      {training.runNumber}
                    </p>
                  </div>

                  {training.confirmedAt && (
                    <div>
                      <span className="text-muted-foreground">Confirmed</span>
                      <p className="font-medium">
                        {format(new Date(training.confirmedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}

                  {training.completedAt && (
                    <div>
                      <span className="text-muted-foreground">Completed</span>
                      <p className="font-medium">
                        {format(new Date(training.completedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}

                  {training.postAssessmentScore && (
                    <div>
                      <span className="text-muted-foreground">Score</span>
                      <p className="font-mono font-semibold text-pcso-navy">
                        {Number(training.postAssessmentScore).toFixed(2)}
                      </p>
                    </div>
                  )}

                  {training.certificateNumber && (
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-pcso-gold" />
                      <div>
                        <span className="text-muted-foreground">
                          Certificate
                        </span>
                        <p className="font-mono text-xs">
                          {training.certificateNumber}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground">
        Training records are read-only. Contact HR for corrections or if a
        certificate is missing.
      </p>
    </div>
  );
}
