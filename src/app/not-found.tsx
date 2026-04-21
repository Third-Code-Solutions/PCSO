import Link from "next/link";
import type { Metadata } from "next";
import { Compass, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * Global 404 page. Kept deliberately calm and navigable — no stack traces,
 * no scary red UI. Offers a clear way back to familiar ground.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pcso-cream">
          <Compass className="h-7 w-7 text-pcso-navy" aria-hidden />
        </div>

        <p className="mt-4 font-mono text-xs tracking-widest text-muted-foreground">
          ERROR 404
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&rsquo;re looking for may have been moved, renamed, or is
          no longer available. Double-check the URL, or head back to a safe
          spot.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Go to dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to start
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
