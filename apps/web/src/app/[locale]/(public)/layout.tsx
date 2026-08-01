import React from 'react';
import { IBM_Plex_Sans, IBM_Plex_Mono, Spectral } from 'next/font/google';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
  display: 'swap',
});

const spectral = Spectral({
  subsets: ['latin'],
  variable: '--font-spectral',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

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
