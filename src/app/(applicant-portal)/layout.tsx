import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ApplicantHeader } from "@/components/applicant-portal/applicant-header";

export const metadata: Metadata = {
  title: {
    default: "Apply to PCSO",
    template: "%s · PCSO Careers",
  },
  description:
    "Public careers portal for the Philippine Charity Sweepstakes Office (PCSO).",
};

/**
 * Public-facing applicant portal shell.
 *
 * Deliberately distinct from the internal (dashboard) layout: no sidebar,
 * no Supabase session check, no RoleGate. The only "auth" here is the
 * applicant JWT stored client-side after /applicant/login.
 */
export default function ApplicantPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fdf8e9] text-[#1c1b1a]">
      <ApplicantHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14"
      >
        {children}
      </main>
      <footer className="border-t border-[#e7ddc7] bg-[#faf6ec]">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-[#6a5a2b] sm:px-6">
          <p>
            © {new Date().getFullYear()} Philippine Charity Sweepstakes Office.
            All rights reserved.
          </p>
          <p>
            This portal only handles employment applications. Personal data is
            processed under the Data Privacy Act.
          </p>
        </div>
      </footer>
    </div>
  );
}
