import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        <Header />
        <main className="flex-1 overflow-auto bg-bone-50">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
