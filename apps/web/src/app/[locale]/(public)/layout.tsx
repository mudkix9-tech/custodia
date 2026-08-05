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
      className={`min-h-screen bg-[#08090A] text-[#E6E8EA] selection:bg-[#C9A227] selection:text-[#08090A] flex flex-col [font-family:var(--font-plex-sans)] font-light antialiased ${plexSans.variable} ${plexMono.variable} ${spectral.variable}`}
    >
      {children}
    </div>
  );
}
