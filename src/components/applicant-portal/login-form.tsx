"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  applicantLoginFormSchema,
  type ApplicantLoginFormInput,
} from "@/lib/validations/welfare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setApplicantToken } from "@/lib/applicant-portal/session";

interface LoginResponse {
  data: {
    token: string;
    applicant: { id: string; status: string };
    tokenType: string;
    expiresInSeconds: number;
  };
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplicantLoginFormInput>({
    resolver: zodResolver(applicantLoginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch("/api/rpm/applicants/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const problem = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(problem.detail ?? "Invalid email or password");
      }
      const json = (await res.json()) as LoginResponse;
      setApplicantToken(json.data.token);

      const target =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/applicant/dashboard";
      router.push(target);
      router.refresh();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Sign-in failed");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
