import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/applicant-portal/register-form";

export const metadata: Metadata = { title: "Register" };

export default function ApplicantRegisterPage() {
  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          Step 1 · Create account
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0b1d3a]">
          Register to apply
        </h1>
        <p className="mt-2 text-sm text-[#4b4943]">
          Already have an account?{" "}
          <Link
            href="/applicant/login"
            className="font-medium text-[#0b1d3a] underline"
          >
            Sign in instead
          </Link>
          .
        </p>
      </header>

      <section className="rounded-2xl border border-[#e7ddc7] bg-white p-6 shadow-sm sm:p-8">
        <RegisterForm />
      </section>
    </div>
  );
}
