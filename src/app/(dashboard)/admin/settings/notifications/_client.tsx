"use client";

import * as React from "react";
import { useState } from "react";
import { Bell, Mail, Search, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateNotificationTemplate } from "./actions";
import type { NotificationTemplate } from "./templates";
import { cn } from "@/lib/utils/cn";

interface NotificationTemplatesClientProps {
  templates: NotificationTemplate[];
}

export function NotificationTemplatesClient({
  templates,
}: NotificationTemplatesClientProps) {
  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<NotificationTemplate | null>(null);

  const filtered = templates.filter(
    (t) =>
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase()) ||
      t.recipient.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, title, type, or recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {templates.length} templates
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onEdit={setEditingTemplate}
          />
        ))}
      </div>

      {/* Edit Dialog */}
      {editingTemplate && (
        <EditTemplateDialog
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: NotificationTemplate;
  onEdit: (template: NotificationTemplate) => void;
}

function TemplateCard({ template, onEdit }: TemplateCardProps) {
  const channelParts = template.channel.split("_");
  const hasInApp = channelParts.includes("in") || channelParts.includes("app");
  const hasEmail = channelParts.includes("email");

  return (
    <Card className={cn(!template.enabled && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{template.id}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {template.title}
            </CardDescription>
          </div>
          <Badge
            variant={template.enabled ? "default" : "secondary"}
            className="shrink-0"
          >
            {template.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {hasInApp && (
            <Badge variant="outline" className="gap-1">
              <Bell className="h-3 w-3" />
              In-App
            </Badge>
          )}
          {hasEmail && (
            <Badge variant="outline" className="gap-1">
              <Mail className="h-3 w-3" />
              Email
            </Badge>
          )}
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <span className="font-medium">Type:</span> {template.type}
          </p>
          <p>
            <span className="font-medium">Recipient:</span> {template.recipient}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(template)}
          className="w-full gap-2"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit Template
        </Button>
      </CardContent>
    </Card>
  );
}

interface EditTemplateDialogProps {
  template: NotificationTemplate;
  onClose: () => void;
}

function EditTemplateDialog({ template, onClose }: EditTemplateDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const [enabled, setEnabled] = useState(template.enabled);
  const [emailSubject, setEmailSubject] = useState(template.emailSubject);
  const [emailBody, setEmailBody] = useState(template.emailBody);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateNotificationTemplate({
        id: template.id,
        enabled,
        emailSubject,
        emailBody,
      });
      if (result.success) {
        toast.success("Template updated successfully");
        onClose();
      } else {
        toast.error(result.error ?? "Failed to update template");
      }
    });
  };

  const hasChanges =
    enabled !== template.enabled ||
    emailSubject !== template.emailSubject ||
    emailBody !== template.emailBody;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template.id}: {template.title}
          </DialogTitle>
          <DialogDescription>
            Configure notification behavior and email template content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="enabled" className="text-base">
                Enable Notification
              </Label>
              <p className="text-sm text-muted-foreground">
                When disabled, this notification will not be sent
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Metadata (read-only) */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <div>
              <span className="font-medium">Type:</span> {template.type}
            </div>
            <div>
              <span className="font-medium">Recipient:</span>{" "}
              {template.recipient}
            </div>
            <div>
              <span className="font-medium">Channel:</span> {template.channel}
            </div>
          </div>

          {/* Email Subject */}
          <div className="space-y-2">
            <Label htmlFor="emailSubject">Email Subject</Label>
            <Input
              id="emailSubject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              maxLength={200}
              placeholder="Email subject line"
            />
            <p className="text-xs text-muted-foreground">
              Variables: {"{employee_name}"}, {"{date}"}, {"{action}"}
            </p>
          </div>

          {/* Email Body */}
          <div className="space-y-2">
            <Label htmlFor="emailBody">Email Body</Label>
            <Textarea
              id="emailBody"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              maxLength={5000}
              rows={12}
              placeholder="Email body content..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Plain text or HTML. Variables: {"{employee_name}"}, {"{link}"},{" "}
              {"{details}"}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            className="bg-pcso-navy hover:bg-pcso-navy-light"
          >
            <Check className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
