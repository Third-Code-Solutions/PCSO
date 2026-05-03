import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: {
    default: "Sign In",
    template: "%s — PCSO HRIS",
  },
};

/**
 * Auth shell layout.
 *
 * Split-panel design:
 * - Left (hidden on mobile): PCSO navy hero with the official seal.
 * - Right: Scrollable form area on a light cream background.
 *
 * Children render in the right panel.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left hero panel ─────────────────────────────────────────────── */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col items-center justify-between
                   bg-pcso-navy text-white p-12 flex-shrink-0 relative overflow-hidden"
      >
        <div
          className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full
                     border border-pcso-gold/20"
        />
        <div
          className="absolute -bottom-24 -right-24 w-[360px] h-[360px] rounded-full
                     border border-pcso-gold/10"
        />

        <div className="relative z-10 self-start">
          <p className="text-pcso-gold text-xs tracking-[0.25em] uppercase font-sans font-medium">
            Republic of the Philippines
          </p>
          <h1 className="font-serif text-2xl font-semibold mt-1 leading-snug">
            Philippine Charity Sweepstakes Office
          </h1>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-44 h-44 rounded-full bg-white/5 ring-2 ring-pcso-gold/60 p-3 flex items-center justify-center">
            <Image
              src="/logos/pcso-official.png"
              alt="PCSO seal"
              width={160}
              height={160}
              className="drop-shadow-xl"
            />
          </div>

          <div className="text-center">
            <p className="font-serif text-xl text-white/90 font-medium">
              Human Resource Information System
            </p>
            <p className="text-pcso-gold-light/80 text-sm mt-2 font-sans">
              Empowering PCSO personnel administration
            </p>
          </div>
        </div>

        <div className="relative z-10 self-start">
          <div className="w-8 h-px bg-pcso-gold mb-4" />
          <p className="text-white/50 text-xs font-sans leading-relaxed max-w-[280px]">
            Secure, compliant HR management for the Philippine Charity
            Sweepstakes Office. All access is logged and audited.
          </p>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <main className="flex-1 bg-pcso-cream flex flex-col min-h-screen overflow-y-auto">
        <div className="lg:hidden bg-pcso-navy px-6 py-4 flex items-center gap-3">
          <Image
            src="/logos/pcso-official.png"
            alt="PCSO seal"
            width={36}
            height={36}
            className="shrink-0"
          />
          <div>
            <p className="text-white text-sm font-medium font-serif leading-none">
              PCSO HRIS
            </p>
            <p className="text-pcso-gold/80 text-xs mt-0.5">
              Republic of the Philippines
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        <footer className="px-6 py-4 text-center">
          <p className="text-xs text-slate-400 font-sans">
            &copy; {new Date().getFullYear()} Philippine Charity Sweepstakes
            Office. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
