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
    <div className="min-h-screen bg-[#08090A] text-[#E6E8EA] flex flex-col">
      {children}
    </div>
  );
}
