import { DsarDashboardClient } from '@/components/dsar/DsarDashboardClient';

export default function GroupDsarDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-1">Group DSAR Automation</h1>
          <p className="text-sm text-ink-600">Consolidated view of Data Subject Access Requests across your organization and subsidiaries.</p>
        </div>
      </div>
      
      <DsarDashboardClient isGroupContext={true} />
    </div>
  );
}
