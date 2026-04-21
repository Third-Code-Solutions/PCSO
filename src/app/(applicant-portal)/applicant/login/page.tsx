import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/applicant-portal/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function ApplicantLoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          Applicant portal
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0b1d3a]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[#4b4943]">
          Don&rsquo;t have an account yet?{" "}
          <Link
            href="/applicant/register"
            className="font-medium text-[#0b1d3a] underline"
          >
            Register
          </Link>
          .
        </p>
      </header>

      <section className="rounded-2xl border border-[#e7ddc7] bg-white p-6 shadow-sm sm:p-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}
