"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { submitDocumentRequest } from "@/lib/actions/documents/document-request-actions";

const documentTypeOptions = [
  { value: "COE", label: "Certificate of Employment" },
  { value: "COE_REMUNERATION", label: "COE with Remunerations" },
  { value: "SERVICE_RECORD", label: "Service Record" },
  { value: "PDS", label: "Personal Data Sheet (CS Form 212)" },
  { value: "NOSI", label: "Notice of Salary Step Increment" },
  { value: "NOSA", label: "Notice of Salary Adjustment" },
  { value: "CLEARANCE", label: "Office Clearance" },
  { value: "CERTIFICATE_TRAINING", label: "Certificate of Training" },
  { value: "AD_HOC", label: "Ad Hoc Certificate" },
];

interface Employee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  positionTitle: string;
}

interface NewRequestFormProps {
  employees: Employee[];
}

export function NewRequestForm({ employees }: NewRequestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!employeeId || !documentType) {
      setError("Employee and document type are required.");
      return;
    }

    startTransition(async () => {
      const result = await submitDocumentRequest({
        employeeId,
        documentType: documentType as Parameters<
          typeof submitDocumentRequest
        >[0]["documentType"],
        purpose: purpose || undefined,
        remarks: remarks || undefined,
      });

      if (result.success) {
        router.push("/employees/documents/requests");
      } else {
        setError(result.error ?? "Failed to submit request.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="employee">Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Select an employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.lastName}, {emp.firstName} — {emp.employeeNo}
                    {emp.positionTitle ? ` (${emp.positionTitle})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="documentType">
                <SelectValue placeholder="Select document type..." />
              </SelectTrigger>
              <SelectContent>
                {documentTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              placeholder="e.g., For loan application, for employment abroad..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Additional Remarks</Label>
            <Textarea
              id="remarks"
              placeholder="Any additional notes or instructions..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3 justify-end">
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
              className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
