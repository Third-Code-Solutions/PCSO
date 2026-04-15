import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Sign In',
    template: '%s — Senate HRIS',
  },
};

/**
 * Auth shell layout.
 *
 * Split-panel design:
 * - Left (hidden on mobile): Senate navy hero with seal placeholder and gold accents.
 * - Right: Scrollable form area on a light cream background.
 *
 * Children render in the right panel.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left hero panel ─────────────────────────────────────────────── */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col items-center justify-between
                   bg-senate-navy text-white p-12 flex-shrink-0 relative overflow-hidden"
      >
        {/* Decorative gold ring accent */}
        <div
          className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full
                     border border-senate-gold/20"
        />
        <div
          className="absolute -bottom-24 -right-24 w-[360px] h-[360px] rounded-full
                     border border-senate-gold/10"
        />

        {/* Top wordmark */}
        <div className="relative z-10 self-start">
          <p className="text-senate-gold text-xs tracking-[0.25em] uppercase font-sans font-medium">
            Republic of the Philippines
          </p>
          <h1 className="font-serif text-2xl font-semibold mt-1 leading-snug">
            Senate of the Philippines
          </h1>
        </div>

        {/* Center seal placeholder */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Seal placeholder — replace with <Image> once /public/seal.png is available */}
          <div
            className="w-40 h-40 rounded-full border-2 border-senate-gold/60 flex items-center
                       justify-center bg-senate-navy-light"
          >
            <span className="text-senate-gold/40 text-xs tracking-widest uppercase">Seal</span>
          </div>

          <div className="text-center">
            <p className="font-serif text-xl text-white/90 font-medium">
              Human Resource Information System
            </p>
            <p className="text-senate-gold-light/70 text-sm mt-2 font-sans">
              Empowering Senate personnel administration
            </p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10 self-start">
          <div className="w-8 h-px bg-senate-gold mb-4" />
          <p className="text-white/40 text-xs font-sans leading-relaxed max-w-[280px]">
            Secure, compliant HR management for the Senate of the Philippines. All access is logged
            and audited.
          </p>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <main className="flex-1 bg-senate-cream flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile-only top bar */}
        <div className="lg:hidden bg-senate-navy px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-senate-gold/60 bg-senate-navy-light" />
          <div>
            <p className="text-white text-sm font-medium font-serif leading-none">
              Senate HRIS
            </p>
            <p className="text-senate-gold/70 text-xs mt-0.5">Republic of the Philippines</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        <footer className="px-6 py-4 text-center">
          <p className="text-xs text-slate-400 font-sans">
            &copy; {new Date().getFullYear()} Senate of the Philippines. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
