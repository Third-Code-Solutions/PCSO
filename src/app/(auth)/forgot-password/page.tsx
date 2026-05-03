"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { sendPasswordReset } from "./actions";

// ─── Schema ───────────────────────────────────────────────────────────────────

const ForgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type ForgotPasswordFields = z.infer<typeof ForgotPasswordSchema>;

// ─── Minimal primitives (mirrors login page; intentionally not extracted to avoid
//     coupling with components that don't exist yet in this phase) ──────────────

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-slate-700 mb-1.5 font-sans"
    >
      {children}
    </label>
  );
}

function Input({
  id,
  type = "text",
  placeholder,
  autoComplete,
  disabled,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm
                 text-slate-900 placeholder:text-slate-400 shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-pcso-navy focus:border-transparent
                 disabled:opacity-60 disabled:cursor-not-allowed transition"
      suppressHydrationWarning
      {...rest}
    />
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600 font-sans">{message}</p>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFields>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordFields) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await sendPasswordReset(data);
      if (result.success) {
        setSubmitted(true);
      } else {
        setServerError(
          result.error ?? "Something went wrong. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-pcso-navy
                     transition-colors font-sans mb-5"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to sign in
        </Link>

        <div className="w-8 h-0.5 bg-pcso-gold mb-4" />
        <h2 className="font-serif text-2xl font-semibold text-pcso-navy leading-snug">
          Reset your password
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 font-sans">
          Enter your PCSO email address and we&rsquo;ll send you a reset link.
        </p>
      </div>

      {/* Success state */}
      {submitted ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-pcso-gold/40 bg-pcso-gold/10 px-5 py-5 space-y-2">
            <p className="text-sm font-semibold text-pcso-navy font-sans">
              Check your email
            </p>
            <p className="text-sm text-slate-600 font-sans">
              If an account exists for{" "}
              <span className="font-medium text-pcso-navy">
                {getValues("email")}
              </span>
              , we&rsquo;ve sent a password reset link. Check your inbox and
              spam folder.
            </p>
            <p className="text-xs text-slate-400 font-sans mt-1">
              The link expires in 60 minutes.
            </p>
          </div>

          <Link
            href="/login"
            className="block w-full text-center rounded-lg border border-slate-200 bg-white
                       px-4 py-2.5 text-sm font-semibold text-pcso-navy shadow-sm
                       hover:bg-slate-50 transition-colors font-sans"
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          <div>
            <Label htmlFor="fp-email">Email address</Label>
            <Input
              id="fp-email"
              type="email"
              placeholder="you@pcso.gov.ph"
              autoComplete="email"
              disabled={isSubmitting}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-pcso-navy px-4 py-2.5 text-sm font-semibold
                       text-white shadow-sm hover:bg-pcso-navy-light focus:outline-none
                       focus:ring-2 focus:ring-pcso-navy focus:ring-offset-2
                       disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-sans"
          >
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>

          <p className="text-xs text-slate-400 font-sans text-center">
            Only official PCSO email addresses are supported.
          </p>
        </form>
      )}
    </div>
  );
}
