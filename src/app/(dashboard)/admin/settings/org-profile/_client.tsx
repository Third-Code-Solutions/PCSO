"use client";

import * as React from "react";
import { useTransition } from "react";
import { Building2, Globe, Mail, Phone, FileText, Hash } from "lucide-react";
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
import { toast } from "sonner";
import { saveOrgProfile, type OrgProfileInput } from "./actions";

interface OrgProfileFormProps {
  initial: OrgProfileInput;
}

export function OrgProfileForm({ initial }: OrgProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = React.useState(initial);

  const handleChange =
    (field: keyof OrgProfileInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveOrgProfile(formData);
      if (result.success) {
        toast.success("Organization profile updated successfully");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-pcso-navy" />
            Identity
          </CardTitle>
          <CardDescription>
            Agency name, logo, and address displayed throughout the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agencyName">
                Agency Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="agencyName"
                value={formData.agencyName}
                onChange={handleChange("agencyName")}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agencyShortName">
                Short Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="agencyShortName"
                value={formData.agencyShortName}
                onChange={handleChange("agencyShortName")}
                required
                maxLength={40}
                placeholder="PCSO"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agencyAddress">
              Address <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="agencyAddress"
              value={formData.agencyAddress}
              onChange={handleChange("agencyAddress")}
              required
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">
              Logo URL <span className="text-red-600">*</span>
            </Label>
            <Input
              id="logoUrl"
              type="url"
              value={formData.logoUrl}
              onChange={handleChange("logoUrl")}
              required
              maxLength={500}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              URL to PCSO seal image (displayed in navbar, PDFs, and reports)
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={formData.tagline ?? ""}
                onChange={handleChange("tagline")}
                maxLength={300}
                placeholder="Kaya natin, para sa bayan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="copyrightHolder">Copyright Holder</Label>
              <Input
                id="copyrightHolder"
                value={formData.copyrightHolder ?? ""}
                onChange={handleChange("copyrightHolder")}
                maxLength={200}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remittance IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-pcso-navy" />
            Remittance Employer Identifiers
          </CardTitle>
          <CardDescription>
            Used in BIR, GSIS, PhilHealth, and Pag-IBIG remittance exports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="birTin">BIR TIN</Label>
              <Input
                id="birTin"
                value={formData.birTin ?? ""}
                onChange={handleChange("birTin")}
                maxLength={30}
                placeholder="000-000-000-000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birAgencyName">BIR Agency Name</Label>
              <Input
                id="birAgencyName"
                value={formData.birAgencyName ?? ""}
                onChange={handleChange("birAgencyName")}
                maxLength={200}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gsisEmployerNo">GSIS Employer No.</Label>
              <Input
                id="gsisEmployerNo"
                value={formData.gsisEmployerNo ?? ""}
                onChange={handleChange("gsisEmployerNo")}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gsisAgencyName">GSIS Agency Name</Label>
              <Input
                id="gsisAgencyName"
                value={formData.gsisAgencyName ?? ""}
                onChange={handleChange("gsisAgencyName")}
                maxLength={200}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="philhealthEmployerNo">
                PhilHealth Employer No.
              </Label>
              <Input
                id="philhealthEmployerNo"
                value={formData.philhealthEmployerNo ?? ""}
                onChange={handleChange("philhealthEmployerNo")}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pagibigEmployerNo">Pag-IBIG Employer No.</Label>
              <Input
                id="pagibigEmployerNo"
                value={formData.pagibigEmployerNo ?? ""}
                onChange={handleChange("pagibigEmployerNo")}
                maxLength={30}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-pcso-navy" />
            Contact Information
          </CardTitle>
          <CardDescription>
            Displayed in footer and system-generated documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                <Mail className="mr-1 inline h-4 w-4" />
                Email
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail ?? ""}
                onChange={handleChange("contactEmail")}
                maxLength={200}
                placeholder="info@pcso.gov.ph"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">
                <Phone className="mr-1 inline h-4 w-4" />
                Phone
              </Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone ?? ""}
                onChange={handleChange("contactPhone")}
                maxLength={40}
                placeholder="+63 2 8733 8877"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">
              <Globe className="mr-1 inline h-4 w-4" />
              Website URL
            </Label>
            <Input
              id="websiteUrl"
              type="url"
              value={formData.websiteUrl ?? ""}
              onChange={handleChange("websiteUrl")}
              maxLength={200}
              placeholder="https://www.pcso.gov.ph"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setFormData(initial)}
          disabled={isPending}
        >
          Reset
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-pcso-navy hover:bg-pcso-navy-light"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
