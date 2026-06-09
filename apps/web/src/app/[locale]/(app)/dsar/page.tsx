import { DsarDashboardClient } from '@/components/dsar/DsarDashboardClient';

export default function DsarDashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-1">DSAR Automation</h1>
          <p className="text-sm text-ink-600">Manage Data Subject Access Requests within the legal 30-day deadline.</p>
        </div>
      </div>
      
      <DsarDashboardClient />
    </div>
  );
}
