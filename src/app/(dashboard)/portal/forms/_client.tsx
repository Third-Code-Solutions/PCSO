"use client";

/**
 * /portal/forms — client shell (TOR 1.9.10 / EPM-015).
 *
 * Card per official blank form; downloading renders the PDF server-side and
 * saves it via a data-URL anchor.
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateBlankHrForm } from "@/lib/actions/portal/forms";

interface FormEntry {
  key: string;
  title: string;
  description: string;
}

const FORMS: FormEntry[] = [
  {
    key: "pds",
    title: "Personal Data Sheet (CS Form 212)",
    description:
      "Official CSC personal information record. Submit accomplished PDS updates through Portal → Update PDS.",
  },
  {
    key: "leave_form_6",
    title: "Application for Leave (CSC Form 6)",
    description:
      "Blank leave application form. Online filing with auto-computed credits is under Leave → Apply.",
  },
  {
    key: "saln",
    title: "SALN Form",
    description:
      "Statement of Assets, Liabilities and Net Worth — annual filing required under RA 6713.",
  },
  {
    key: "office_clearance",
    title: "Office Clearance",
    description:
      "Accountability clearance for separation, retirement, transfer, or prolonged leave.",
  },
  {
    key: "pass_out_slip",
    title: "Pass-Out Slip",
    description:
      "Authorization slip for exits from the premises during work hours.",
  },
  {
    key: "ob_form",
    title: "Official Business (OB) Form",
    description:
      "Authorization to render duty outside the official station; credited on the DTR when approved.",
  },
  {
    key: "pes_form",
    title: "Performance Evaluation Sheet (PES)",
    description:
      "SPMS individual rating sheet with the CSC adjectival rating scale.",
  },
];

function triggerDownload(fileName: string, dataUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function FormsClient() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (formKey: string) => {
    setDownloading(formKey);
    try {
      const result = await generateBlankHrForm(formKey);
      if ("data" in result) {
        triggerDownload(result.data.fileName, result.data.dataUrl);
        toast.success("Form downloaded");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to download the form");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Official HR Forms
          </h1>
          <p className="text-sm text-muted-foreground">
            Download blank official forms for manual accomplishment. Where an
            online workflow exists, prefer filing through the portal.
          </p>
        </div>
        <FileText className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FORMS.map((form) => (
          <Card key={form.key} className="flex flex-col border-pcso-navy/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{form.title}</CardTitle>
              <CardDescription className="text-xs">
                {form.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={downloading !== null}
                onClick={() => handleDownload(form.key)}
              >
                {downloading === form.key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
