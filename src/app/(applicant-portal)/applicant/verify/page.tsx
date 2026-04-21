"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Status = "pending" | "success" | "error";

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = React.useState<Status>("pending");
  const [message, setMessage] = React.useState<string>("Verifying your email…");

  React.useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    const controller = new AbortController();
    fetch(`/api/rpm/applicants/verify/${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const problem = (await res.json().catch(() => ({}))) as {
            detail?: string;
          };
          throw new Error(problem.detail ?? "Verification failed.");
        }
        setStatus("success");
        setMessage("Your email has been verified. You can now sign in.");
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Verification failed.");
      });

    return () => controller.abort();
  }, [token]);

  return (
    <div className="mx-auto max-w-md">
      <section className="rounded-2xl border border-[#e7ddc7] bg-white p-8 shadow-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d2c]">
          Email verification
        </p>
        <h1
          className="mt-3 font-serif text-2xl font-semibold text-[#0b1d3a]"
          aria-live="polite"
        >
          {status === "pending" && "Verifying…"}
          {status === "success" && "Email verified"}
          {status === "error" && "Verification failed"}
        </h1>
        <p className="mt-3 text-sm text-[#4b4943]">{message}</p>
        {status === "success" && (
          <div className="mt-6">
            <Button
              asChild
              className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
            >
              <Link href="/applicant/login">Sign in</Link>
            </Button>
          </div>
        )}
        {status === "error" && (
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/applicant/register">Register again</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ApplicantVerifyPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyInner />
    </React.Suspense>
  );
}
