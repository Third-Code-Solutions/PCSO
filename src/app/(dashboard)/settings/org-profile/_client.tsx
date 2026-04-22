"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrgProfile } from "@/lib/actions/settings";
import type { OrgProfile } from "@/lib/db/schema";

interface OrgProfileFormProps {
  profile: OrgProfile;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  );
}

export function OrgProfileForm({ profile }: OrgProfileFormProps) {
  const [formData, setFormData] = useState(profile);

  async function handleSubmit(data: FormData) {
    try {
      await updateOrgProfile(data);
      toast.success("Organization profile updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Agency Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Agency Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="agencyName">Agency Name (Full)</Label>
            <Input
              id="agencyName"
              name="agencyName"
              defaultValue={formData.agencyName}
              required
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="agencyShortName">Short Name / Acronym</Label>
            <Input
              id="agencyShortName"
              name="agencyShortName"
              defaultValue={formData.agencyShortName}
              required
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={formData.logoUrl}
              required
              maxLength={500}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="agencyAddress">Agency Address</Label>
            <Textarea
              id="agencyAddress"
              name="agencyAddress"
              defaultValue={formData.agencyAddress}
              required
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Remittance Employer Identifiers */}
      <Card>
        <CardHeader>
          <CardTitle>Remittance Employer Identifiers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="birTin">BIR TIN</Label>
            <Input
              id="birTin"
              name="birTin"
              defaultValue={formData.birTin || ""}
              maxLength={30}
            />
          </div>
          <div>
            <Label htmlFor="birAgencyName">BIR Agency Name</Label>
            <Input
              id="birAgencyName"
              name="birAgencyName"
              defaultValue={formData.birAgencyName || ""}
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="philhealthEmployerNo">
              PhilHealth Employer No.
            </Label>
            <Input
              id="philhealthEmployerNo"
              name="philhealthEmployerNo"
              defaultValue={formData.philhealthEmployerNo || ""}
              maxLength={30}
            />
          </div>
          <div>
            <Label htmlFor="pagibigEmployerNo">Pag-IBIG Employer No.</Label>
            <Input
              id="pagibigEmployerNo"
              name="pagibigEmployerNo"
              defaultValue={formData.pagibigEmployerNo || ""}
              maxLength={30}
            />
          </div>
          <div>
            <Label htmlFor="gsisAgencyName">GSIS Agency Name</Label>
            <Input
              id="gsisAgencyName"
              name="gsisAgencyName"
              defaultValue={formData.gsisAgencyName || ""}
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="gsisEmployerNo">GSIS Employer No.</Label>
            <Input
              id="gsisEmployerNo"
              name="gsisEmployerNo"
              defaultValue={formData.gsisEmployerNo || ""}
              maxLength={30}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={formData.contactEmail || ""}
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              defaultValue={formData.contactPhone || ""}
              maxLength={40}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              defaultValue={formData.websiteUrl || ""}
              maxLength={200}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
