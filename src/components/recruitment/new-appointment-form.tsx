"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAppointment } from "@/lib/actions/recruitment-appointments";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function NewAppointmentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    applicationId: "",
    appointmentDate: "",
    effectiveDate: "",
    appointmentType: "permanent",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.applicationId) {
      toast.error("Please enter an application ID");
      return;
    }

    if (!formData.appointmentDate || !formData.effectiveDate) {
      toast.error("Please fill in all required dates");
      return;
    }

    startTransition(async () => {
      const result = await createAppointment(formData);
      if (result.success && result.appointmentId) {
        toast.success("Appointment created successfully");
        router.push(`/recruitment/appointments/${result.appointmentId}`);
      } else {
        toast.error(result.error ?? "Failed to create appointment");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointment Details</CardTitle>
        <CardDescription>
          Create appointment from qualified application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="applicationId">
              Application ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="applicationId"
              placeholder="Enter application UUID"
              value={formData.applicationId}
              onChange={(e) =>
                setFormData({ ...formData, applicationId: e.target.value })
              }
              required
            />
            <p className="text-xs text-muted-foreground">
              Application must be in &quot;results_released&quot; status
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">
                Appointment Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="appointmentDate"
                type="date"
                value={formData.appointmentDate}
                onChange={(e) =>
                  setFormData({ ...formData, appointmentDate: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveDate">
                Effective Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) =>
                  setFormData({ ...formData, effectiveDate: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointmentType">
              Appointment Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.appointmentType}
              onValueChange={(value) =>
                setFormData({ ...formData, appointmentType: value })
              }
            >
              <SelectTrigger id="appointmentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
                <SelectItem value="coterminous">Coterminous</SelectItem>
                <SelectItem value="cas">CAS</SelectItem>
                <SelectItem value="job_order">Job Order</SelectItem>
                <SelectItem value="cos">Contract of Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this appointment..."
              rows={4}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Appointment"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
