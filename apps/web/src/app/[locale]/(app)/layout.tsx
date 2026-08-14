// Authenticated dashboard: always needs per-request auth/session data,
// never statically prerender it (also avoids Next attempting to
// prerender every dashboard route at build time -- see e.g. the
// useSearchParams()-without-Suspense crash on /ropa/new).
export const dynamic = 'force-dynamic';

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { Announcer } from "@/components/layout/Announcer";
import { AiGuidancePanel } from "@/components/layout/AiGuidancePanel";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Announcer />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#0D0F11] focus:text-[#F4F5F6] focus:px-4 focus:py-2 focus:rounded focus:shadow-panel-elevated">
        Skip to main content
      </a>
      {/* The inherited colour is globals.css --foreground (#1F1B16), left over from the
          retired light theme; anything here that sets no colour of its own renders dark
          brown on the near-black shell. Anchor the app tree to the dark-surface primary. */}
      <div className="h-screen flex overflow-hidden text-[#E6E8EA]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#08090A] selection:bg-[#C9A227]/30">
          <OfflineBanner />
          <TrialBanner />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto outline-none relative">
            {/* Background decorations matching marketing design */}
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
            <div aria-hidden="true" className="absolute top-0 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none opacity-50" />
            
            <Header />
            <div className="relative z-10">
              {children}
            </div>
          </main>
        </div>
        <AiGuidancePanel />
        <CommandPalette />
      </div>
    </>
  );
}
