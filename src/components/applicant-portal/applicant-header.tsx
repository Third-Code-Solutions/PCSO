"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  clearApplicantToken,
  useApplicantSessionHint,
} from "@/lib/applicant-portal/session";

/**
 * Minimalist public header for the applicant portal.
 *
 * Deliberately distinct from the internal AppSidebar / TopNav — no internal
 * role awareness, no supabase session check. The "logout" action just clears
 * the browser-held applicant JWT and bounces to /apply.
 */
export function ApplicantHeader() {
  const router = useRouter();
  const hasSession = useApplicantSessionHint();

  function handleLogout() {
    clearApplicantToken();
    router.replace("/apply");
    router.refresh();
  }

  return (
    <header className="border-b border-[#e7ddc7] bg-[#faf6ec]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/apply" className="group flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c7a24a]/40 bg-[#0b1d3a] text-[0.6rem] font-semibold uppercase tracking-widest text-[#d4af37]"
          >
            PCSO
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d2c]">
              Republic of the Philippines
            </p>
            <p className="font-serif text-lg font-semibold text-[#0b1d3a] group-hover:underline">
              Apply to PCSO
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/apply">Vacancies</Link>
          </Button>
          {hasSession ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/applicant/dashboard">My applications</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleLogout}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/applicant/login">Log in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-[#0b1d3a] hover:bg-[#0a1830]"
              >
                <Link href="/applicant/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
