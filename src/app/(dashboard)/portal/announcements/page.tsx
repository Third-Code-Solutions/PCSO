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
import { CheckCircle2, Megaphone, Loader2 } from "lucide-react";
import {
  getAnnouncements,
  acknowledgeAnnouncement,
} from "@/lib/actions/portal/announcements";
import { toast } from "sonner";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  type: string;
  publishedAt: Date;
  expiresAt: Date | null;
  acknowledged: Date | null;
}

function capitalize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const result = await getAnnouncements();
      if (result.success) {
        setAnnouncements(result.data);
      } else {
        toast.error("Failed to load announcements");
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleAcknowledge = (announcementId: string) => {
    startTransition(async () => {
      const result = await acknowledgeAnnouncement(announcementId);
      if (result.success) {
        toast.success("Announcement acknowledged");
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === announcementId ? { ...a, acknowledged: new Date() } : a,
          ),
        );
      } else {
        toast.error("Failed to acknowledge", { description: result.error });
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Memorandums & Circulars
          </h1>
          <p className="text-sm text-muted-foreground">
            HR announcements and official notices
          </p>
        </div>
        <Megaphone className="h-8 w-8 text-pcso-navy" />
      </div>

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No Announcements
            </h3>
            <p className="text-sm text-muted-foreground">
              There are no active memorandums or circulars at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map((announcement) => (
            <Card
              key={announcement.id}
              className={
                announcement.acknowledged
                  ? "border-muted bg-muted/20"
                  : "border-pcso-navy/20 bg-card"
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">
                        {capitalize(announcement.type)}
                      </Badge>
                      {announcement.acknowledged && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">
                      {announcement.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Published{" "}
                      {format(
                        new Date(announcement.publishedAt),
                        "MMM d, yyyy",
                      )}
                      {announcement.expiresAt &&
                        ` • Expires ${format(new Date(announcement.expiresAt), "MMM d, yyyy")}`}
                    </CardDescription>
                  </div>

                  {!announcement.acknowledged && (
                    <Button
                      size="sm"
                      onClick={() => handleAcknowledge(announcement.id)}
                      disabled={isPending}
                      className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                    >
                      {isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      <CheckCircle2 className="h-4 w-4" />
                      Acknowledge
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground">
                  <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">
                    {announcement.content}
                  </div>
                </div>

                {announcement.acknowledged && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    You acknowledged this on{" "}
                    {format(
                      new Date(announcement.acknowledged),
                      "MMM d, yyyy h:mm a",
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Acknowledgement confirms you have read and understood the memorandum.
        This is logged in the system.
      </p>
    </div>
  );
}
