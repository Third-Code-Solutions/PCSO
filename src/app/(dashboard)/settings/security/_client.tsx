"use client";

/**
 * MFA (TOTP) management client — TOR 3.2.6 / SEC-003.
 *
 * Enrollment runs entirely against Supabase Auth from the browser:
 *   enroll → QR code + secret → challenge → verify (session becomes AAL2).
 * Server actions add the audit trail and password-confirmed unenroll.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/auth/permissions";
import { recordTotpEnrollment, unenrollTotp } from "./actions";

interface TotpFactorRow {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string | null;
}

interface EnrollmentState {
  factorId: string;
  /** SVG data URI produced by Supabase for the provisioning QR. */
  qrCode: string;
  /** Base32 secret for manual entry. */
  secret: string;
}

interface SecurityClientProps {
  isMandatory: boolean;
  role: Role;
}

export function SecurityClient({ isMandatory, role }: SecurityClientProps) {
  const supabase = React.useMemo(() => createBrowserClient(), []);
  const router = useRouter();

  const [factors, setFactors] = React.useState<TotpFactorRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [enrollment, setEnrollment] = React.useState<EnrollmentState | null>(
    null,
  );
  const [verifyCode, setVerifyCode] = React.useState("");
  const [pending, setPending] = React.useState(false);

  // Unenroll dialog state
  const [unenrollTarget, setUnenrollTarget] =
    React.useState<TotpFactorRow | null>(null);
  const [unenrollPassword, setUnenrollPassword] = React.useState("");

  const loadFactors = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        toast.error("Could not load authenticator factors.");
        return;
      }
      const totpFactors = data.all
        .filter((f) => f.factor_type === "totp")
        .map((f) => ({
          id: f.id,
          friendlyName: f.friendly_name ?? null,
          status: f.status,
          createdAt: f.created_at ?? null,
        }));
      setFactors(totpFactors);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const pendingFactors = factors.filter(
    (f) => f.status === "unverified" && f.id !== enrollment?.factorId,
  );

  // ── Enroll ─────────────────────────────────────────────────────────────────

  async function handleStartEnrollment() {
    setPending(true);
    try {
      const friendlyName = `PCSO HRIS (${new Date().toISOString().slice(0, 10)})`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (error || !data) {
        toast.error("Could not start enrollment", {
          description: error?.message,
        });
        return;
      }
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setVerifyCode("");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    const code = verifyCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setPending(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (challengeError || !challenge) {
        toast.error("Could not start the verification challenge.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        toast.error("Invalid or expired code", {
          description: "Check your authenticator app and try again.",
        });
        return;
      }

      // Server-side audit entry (validated against the admin factor list).
      const audit = await recordTotpEnrollment({
        factorId: enrollment.factorId,
      });
      if (!audit.success) {
        toast.warning("Enrolled, but the audit record could not be written.");
      } else {
        toast.success("Two-factor authentication enabled");
      }

      setEnrollment(null);
      setVerifyCode("");
      await loadFactors();
      router.refresh(); // clears the enrollment banner immediately
    } finally {
      setPending(false);
    }
  }

  async function handleCancelEnrollment() {
    if (!enrollment) return;
    setPending(true);
    try {
      // Removing an UNVERIFIED factor needs no password confirmation.
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    } catch {
      // Best-effort cleanup — an abandoned unverified factor is harmless.
    } finally {
      setEnrollment(null);
      setVerifyCode("");
      setPending(false);
      void loadFactors();
    }
  }

  async function handleRemovePendingFactor(factorId: string) {
    setPending(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error("Could not remove the pending factor.");
        return;
      }
      toast.success("Pending setup removed");
      await loadFactors();
    } finally {
      setPending(false);
    }
  }

  // ── Unenroll (verified) ────────────────────────────────────────────────────

  async function handleConfirmUnenroll(e: React.FormEvent) {
    e.preventDefault();
    if (!unenrollTarget) return;

    setPending(true);
    try {
      const result = await unenrollTotp({
        factorId: unenrollTarget.id,
        password: unenrollPassword,
      });
      if (!result.success) {
        toast.error("Could not remove authenticator", {
          description: result.error,
        });
        return;
      }
      toast.success("Authenticator removed");
      setUnenrollTarget(null);
      setUnenrollPassword("");
      await loadFactors();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {isMandatory && verifiedFactors.length === 0 && !loading && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              Two-factor authentication is mandatory for your role (
              {role === "super_admin" ? "Super Admin" : "HR Admin"}).
            </p>
            <p className="mt-0.5 text-amber-800">
              Per SEC-003 / TOR 3.2.6, please enroll an authenticator app now.
              Enforcement banners will persist until enrollment is complete.
            </p>
          </div>
        </div>
      )}

      {/* Status card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Authenticator App (TOTP)
          </CardTitle>
          <CardDescription>
            Use Google Authenticator, Microsoft Authenticator, 1Password, or any
            TOTP-compatible app. Codes rotate every 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading factors…</p>
          ) : verifiedFactors.length === 0 ? (
            <div className="flex items-center justify-between rounded-md border border-dashed border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    No authenticator enrolled
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your account signs in with a password only.
                  </p>
                </div>
              </div>
              {!enrollment && (
                <Button
                  size="sm"
                  onClick={handleStartEnrollment}
                  disabled={pending}
                  className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
                >
                  {pending ? "Preparing…" : "Enable 2FA"}
                </Button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {verifiedFactors.map((factor) => (
                <li
                  key={factor.id}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {factor.friendlyName ?? "Authenticator app"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {factor.createdAt
                          ? `Enrolled ${new Date(factor.createdAt).toLocaleDateString()}`
                          : "Enrolled"}
                      </p>
                    </div>
                    <Badge variant="success">Verified</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      setUnenrollPassword("");
                      setUnenrollTarget(factor);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Abandoned setups from previous attempts */}
          {pendingFactors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Incomplete setups
              </p>
              <ul className="space-y-2">
                {pendingFactors.map((factor) => (
                  <li
                    key={factor.id}
                    className="flex items-center justify-between rounded-md border border-dashed border-border px-4 py-2.5"
                  >
                    <span className="text-sm text-muted-foreground">
                      {factor.friendlyName ?? "Unverified factor"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleRemovePendingFactor(factor.id)}
                    >
                      Discard
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrollment flow */}
      {enrollment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Finish setting up your authenticator
            </CardTitle>
            <CardDescription>
              Scan the QR code with your authenticator app, then enter the
              6-digit code it shows to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="flex flex-col items-center gap-3">
                {/* Supabase returns an SVG data URI */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrollment.qrCode}
                  alt="TOTP enrollment QR code"
                  width={176}
                  height={176}
                  className="h-44 w-44 rounded-md border border-border bg-white p-2"
                />
                <div className="max-w-[220px] text-center">
                  <p className="text-xs text-muted-foreground">
                    Can&apos;t scan? Enter this key manually:
                  </p>
                  <p className="mt-1 break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">
                    {enrollment.secret}
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleVerifyEnrollment}
                className="flex-1 space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="totp-verify-code">Verification code</Label>
                  <Input
                    id="totp-verify-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={8}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    disabled={pending}
                    className="max-w-[180px] text-center font-mono tracking-[0.3em]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={pending}
                    className="bg-pcso-navy text-white hover:bg-pcso-navy-light"
                  >
                    {pending ? "Verifying…" : "Verify and enable"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={handleCancelEnrollment}
                  >
                    Cancel setup
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store your authenticator safely. If you lose access, the PCSO
                  IT / MIS team must reset your enrollment.
                </p>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Password-confirmed unenroll dialog */}
      <Dialog
        open={unenrollTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnenrollTarget(null);
            setUnenrollPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove authenticator?</DialogTitle>
            <DialogDescription>
              {isMandatory
                ? "Two-factor authentication is mandatory for your role. Removing this authenticator will re-trigger enrollment prompts. Confirm your password to continue."
                : "Your account will fall back to password-only sign-in. Confirm your password to continue."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmUnenroll} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unenroll-password">Current password</Label>
              <Input
                id="unenroll-password"
                type="password"
                autoComplete="current-password"
                value={unenrollPassword}
                onChange={(e) => setUnenrollPassword(e.target.value)}
                disabled={pending}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setUnenrollTarget(null);
                  setUnenrollPassword("");
                }}
              >
                Keep 2FA
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || unenrollPassword.length === 0}
              >
                {pending ? "Removing…" : "Remove authenticator"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
