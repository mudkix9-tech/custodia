import React from 'react';

// Onboarding is only ever reached post-signup/auth; never statically
// prerender it (also lets us avoid Next attempting to prerender the
// "use client" pages under this route group at build time).
export const dynamic = 'force-dynamic';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#08090A] text-[#E6E8EA] flex flex-col relative overflow-hidden">
      {/* Background decorations matching brand visual system */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
      <div aria-hidden="true" className="absolute top-0 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none opacity-50" />
      <div className="relative z-10 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
