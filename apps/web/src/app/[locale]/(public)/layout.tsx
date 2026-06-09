import React from 'react';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout for the funnel (no sidebar, no marketing nav)
  return (
    <div className="min-h-screen bg-bone-50 text-ink-900 selection:bg-sage-500/30 flex flex-col font-sans">
      {children}
    </div>
  );
}
