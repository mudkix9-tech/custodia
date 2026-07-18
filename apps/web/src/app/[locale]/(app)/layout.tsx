import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-ink-900 focus:px-4 focus:py-2 focus:rounded focus:shadow-xl">
        Skip to main content
      </a>
      <div className="h-screen flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-bone-50">
          <OfflineBanner />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto outline-none">
            <Header />
            {children}
          </main>
        </div>
        <AiGuidancePanel />
        <CommandPalette />
      </div>
    </>
  );
}
