'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signInWithPassword, signInWithMagicLink } from './actions';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PasswordSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const MagicLinkSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

type PasswordFields = z.infer<typeof PasswordSchema>;
type MagicLinkFields = z.infer<typeof MagicLinkSchema>;

// ─── Minimal UI primitives (inline so we don't import non-existent shadcn files) ──

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
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
  type = 'text',
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
                 focus:outline-none focus:ring-2 focus:ring-senate-navy focus:border-transparent
                 disabled:opacity-60 disabled:cursor-not-allowed transition"
      {...rest}
    />
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600 font-sans">{message}</p>;
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-senate-navy px-4 py-2.5 text-sm font-semibold text-white
                 shadow-sm hover:bg-senate-navy-light focus:outline-none focus:ring-2
                 focus:ring-senate-navy focus:ring-offset-2 disabled:opacity-60
                 disabled:cursor-not-allowed transition-colors font-sans"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Error banner from URL params (e.g. callback failures) ───────────────────

const URL_ERROR_MESSAGES: Record<string, string> = {
  callback_failed: 'The sign-in link has expired or is invalid. Please try again.',
  missing_code: 'Invalid sign-in link. Please request a new one.',
  forbidden: 'You do not have permission to access that page.',
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? undefined;
  const urlError = searchParams.get('error');

  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [serverError, setServerError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Password form ──────────────────────────────────────────────────────────
  const {
    register: regPw,
    handleSubmit: handlePw,
    formState: { errors: pwErrors },
  } = useForm<PasswordFields>({ resolver: zodResolver(PasswordSchema) });

  // ── Magic link form ────────────────────────────────────────────────────────
  const {
    register: regMl,
    handleSubmit: handleMl,
    formState: { errors: mlErrors },
  } = useForm<MagicLinkFields>({ resolver: zodResolver(MagicLinkSchema) });

  async function onPasswordSubmit(data: PasswordFields) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithPassword({ ...data, next });
      if (result && !result.success) {
        setServerError(result.error ?? 'Sign in failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onMagicLinkSubmit(data: MagicLinkFields) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithMagicLink(data);
      if (result.success) {
        setMagicLinkSent(true);
      } else {
        setServerError(result.error ?? 'Failed to send magic link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const urlErrorMessage = urlError ? URL_ERROR_MESSAGES[urlError] : null;

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div>
        <div className="w-8 h-0.5 bg-senate-gold mb-4" />
        <h2 className="font-serif text-2xl font-semibold text-senate-navy leading-snug">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 font-sans">
          Sign in to the Senate HRIS portal
        </p>
      </div>

      {/* URL-param error (e.g. expired callback link) */}
      {urlErrorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {urlErrorMessage}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => { setMode('password'); setServerError(null); }}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium font-sans transition-colors ${
            mode === 'password'
              ? 'bg-senate-navy text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => { setMode('magic'); setServerError(null); }}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium font-sans transition-colors ${
            mode === 'magic'
              ? 'bg-senate-navy text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Magic link
        </button>
      </div>

      {/* Server error */}
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      {/* ── Password form ──────────────────────────────────────────────────── */}
      {mode === 'password' && (
        <form onSubmit={handlePw(onPasswordSubmit)} noValidate className="space-y-5">
          <div>
            <Label htmlFor="pw-email">Email address</Label>
            <Input
              id="pw-email"
              type="email"
              placeholder="you@senate.gov.ph"
              autoComplete="email"
              disabled={isSubmitting}
              {...regPw('email')}
            />
            <FieldError message={pwErrors.email?.message} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="pw-password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-senate-navy hover:text-senate-gold transition-colors font-sans"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="pw-password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isSubmitting}
              {...regPw('password')}
            />
            <FieldError message={pwErrors.password?.message} />
          </div>

          <SubmitButton loading={isSubmitting}>Sign in</SubmitButton>
        </form>
      )}

      {/* ── Magic link form ────────────────────────────────────────────────── */}
      {mode === 'magic' && !magicLinkSent && (
        <form onSubmit={handleMl(onMagicLinkSubmit)} noValidate className="space-y-5">
          <div>
            <Label htmlFor="ml-email">Email address</Label>
            <Input
              id="ml-email"
              type="email"
              placeholder="you@senate.gov.ph"
              autoComplete="email"
              disabled={isSubmitting}
              {...regMl('email')}
            />
            <FieldError message={mlErrors.email?.message} />
          </div>

          <SubmitButton loading={isSubmitting}>Send magic link</SubmitButton>

          <p className="text-xs text-slate-400 font-sans text-center">
            We&rsquo;ll email you a secure link — no password needed.
          </p>
        </form>
      )}

      {/* Magic link success state */}
      {mode === 'magic' && magicLinkSent && (
        <div className="rounded-lg border border-senate-gold/40 bg-senate-gold/10 px-5 py-4 text-center space-y-2">
          <p className="text-sm font-semibold text-senate-navy font-sans">Check your inbox</p>
          <p className="text-sm text-slate-600 font-sans">
            We&rsquo;ve sent a sign-in link to your email address. The link expires in 60 minutes.
          </p>
          <button
            type="button"
            onClick={() => setMagicLinkSent(false)}
            className="text-xs text-senate-navy underline hover:no-underline font-sans mt-1"
          >
            Use a different email
          </button>
        </div>
      )}

      {/* Divider with security note */}
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-400 font-sans text-center leading-relaxed">
          This system is for authorized Senate personnel only.
          <br />
          All sessions are monitored and audited.
        </p>
      </div>
    </div>
  );
}
