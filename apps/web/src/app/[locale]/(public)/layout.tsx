import React from 'react';
import { plexSans, plexMono, spectral } from '../fonts';

// DSAR intake, assessment flow, client portal auth funnel -- session/token
// gated, never statically prerender it.
export const dynamic = 'force-dynamic';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout for the funnel (no sidebar, no marketing nav) —
  // dark/gold visual system, matching the marketing homepage.
  return (
    <div
      className={`min-h-screen bg-[#08090A] text-[#E6E8EA] selection:bg-[#C9A227] selection:text-[#08090A] flex flex-col relative overflow-hidden [font-family:var(--font-plex-sans)] font-light antialiased ${plexSans.variable} ${plexMono.variable} ${spectral.variable}`}
    >
      {/* Background decorations matching visual system */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
      <div aria-hidden="true" className="absolute top-0 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none opacity-50" />
      <div className="relative z-10 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
