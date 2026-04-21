"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnContactInfo } from "./actions";
import type { UpdateOwnContactInfoInput } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableContactFields {
  phone: string | null;
  addressStreet: string | null;
  addressBarangay: string | null;
  addressCity: string | null;
  addressProvince: string | null;
  addressZipCode: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
}

interface EditContactDialogProps {
  initial: EditableContactFields;
}

// ─── Form field helper ────────────────────────────────────────────────────────

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );
}

// ─── Dialog component ─────────────────────────────────────────────────────────

export function EditContactDialog({ initial }: EditContactDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateOwnContactInfoInput>({
    phone: initial.phone ?? "",
    addressStreet: initial.addressStreet ?? "",
    addressBarangay: initial.addressBarangay ?? "",
    addressCity: initial.addressCity ?? "",
    addressProvince: initial.addressProvince ?? "",
    addressZipCode: initial.addressZipCode ?? "",
    emergencyContactName: initial.emergencyContactName ?? "",
    emergencyContactRelationship: initial.emergencyContactRelationship ?? "",
    emergencyContactPhone: initial.emergencyContactPhone ?? "",
  });

  const set = (field: keyof UpdateOwnContactInfoInput) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpen = () => {
    // Reset form to current saved values each time the dialog opens.
    setForm({
      phone: initial.phone ?? "",
      addressStreet: initial.addressStreet ?? "",
      addressBarangay: initial.addressBarangay ?? "",
      addressCity: initial.addressCity ?? "",
      addressProvince: initial.addressProvince ?? "",
      addressZipCode: initial.addressZipCode ?? "",
      emergencyContactName: initial.emergencyContactName ?? "",
      emergencyContactRelationship: initial.emergencyContactRelationship ?? "",
      emergencyContactPhone: initial.emergencyContactPhone ?? "",
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    setOpen(true);
  };

  const handleSubmit = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const result = await updateOwnContactInfo(form);
        if (result.success) {
          setSuccessMsg("Contact information updated.");
          toast.success("Contact information saved");
          // Refresh server data so the parent page reflects new values.
          router.refresh();
          setTimeout(() => setOpen(false), 600);
        } else {
          const msg =
            result.error ?? "An unexpected error occurred. Please try again.";
          setErrorMsg(msg);
          toast.error("Failed to save contact info", { description: msg });
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.";
        setErrorMsg(msg);
        toast.error("Failed to save contact info", { description: msg });
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="gap-1.5"
        aria-label="Edit contact and address information"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-pcso-navy">
              Edit Contact & Address
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Contact */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-pcso-navy">
                Contact
              </h3>
              <div className="space-y-3">
                <Field
                  id="phone"
                  label="Mobile Phone"
                  value={form.phone ?? ""}
                  onChange={set("phone")}
                  placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
                  type="tel"
                />
              </div>
            </section>

            {/* Current Address */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-pcso-navy">
                Current Address
              </h3>
              <div className="space-y-3">
                <Field
                  id="addressStreet"
                  label="Street / Building"
                  value={form.addressStreet ?? ""}
                  onChange={set("addressStreet")}
                  placeholder="House No., Street Name"
                />
                <Field
                  id="addressBarangay"
                  label="Barangay"
                  value={form.addressBarangay ?? ""}
                  onChange={set("addressBarangay")}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    id="addressCity"
                    label="City / Municipality"
                    value={form.addressCity ?? ""}
                    onChange={set("addressCity")}
                  />
                  <Field
                    id="addressProvince"
                    label="Province"
                    value={form.addressProvince ?? ""}
                    onChange={set("addressProvince")}
                  />
                </div>
                <Field
                  id="addressZipCode"
                  label="ZIP Code"
                  value={form.addressZipCode ?? ""}
                  onChange={set("addressZipCode")}
                  placeholder="e.g. 1000"
                />
              </div>
            </section>

            {/* Emergency Contact */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-pcso-navy">
                Emergency Contact
              </h3>
              <div className="space-y-3">
                <Field
                  id="emergencyContactName"
                  label="Full Name"
                  value={form.emergencyContactName ?? ""}
                  onChange={set("emergencyContactName")}
                />
                <Field
                  id="emergencyContactRelationship"
                  label="Relationship"
                  value={form.emergencyContactRelationship ?? ""}
                  onChange={set("emergencyContactRelationship")}
                  placeholder="e.g. Spouse, Parent, Sibling"
                />
                <Field
                  id="emergencyContactPhone"
                  label="Phone Number"
                  value={form.emergencyContactPhone ?? ""}
                  onChange={set("emergencyContactPhone")}
                  placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
                  type="tel"
                />
              </div>
            </section>

            {/* Feedback messages */}
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
              >
                {successMsg}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────

interface CopyButtonProps {
  value: string | null | undefined;
  label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable in some environments; silently ignore.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={copied ? "Copied!" : `Copy ${label}`}
      className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pcso-gold"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
