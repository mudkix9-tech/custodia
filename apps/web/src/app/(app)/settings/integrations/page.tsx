"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { Plug, Zap } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Plus, Check, ExternalLink, ShieldAlert, ArrowRight } from 'lucide-react';

import { useSession } from 'next-auth/react';

export default function IntegrationsSettingsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isEditable = userRole === 'admin' || userRole === 'owner';
  const orgId = (session?.user as any)?.orgId;

  const { data: providers, isLoading: providersLoading } = trpc.integrations.listProviders.useQuery();
  const { data: connections, refetch } = trpc.integrations.listConnections.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );
  const disconnectMutation = trpc.integrations.disconnect.useMutation();
  const { confirm, dialog } = useConfirm();

  const handleDisconnect = async (id: string) => {
    if (!isEditable) return;
    if (window.confirm('Disconnecting will disable automatic DSAR data discovery. Any in-progress DSAR searches will be marked as manual. Proceed?')) {
      await disconnectMutation.mutateAsync({ id });
      refetch();
    }
  };

  if (providersLoading) return <GenericWorkspaceSkeleton />;

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Integrations</h1>
          <p className="text-ink-600">Connect CRM and marketing tools for automated DSAR discovery.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers?.map((provider) => {
          const connection = connections?.find((c) => c.provider === provider.id);

          return (
            <div key={provider.id} className="bg-white rounded-2xl border border-ink-900/10 p-6 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-bone-50 flex items-center justify-center border border-ink-900/10">
                    <Plug className="w-5 h-5 text-ink-900" />
                  </div>
                  <h3 className="text-lg font-medium text-ink-900">{provider.name}</h3>
                </div>
                {connection?.status === 'active' && (
                  <span className="bg-sage-50 text-sage-700 border border-sage-200 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage-500"></span> Connected
                  </span>
                )}
                {connection?.status === 'error' && (
                  <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Error
                  </span>
                )}
              </div>

              <div className="text-sm text-ink-600 space-y-3 mb-6 flex-1">
                <p>When connected, Privaro can:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                    <span>Auto-search {provider.name} contacts during DSAR processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                    <span>Auto-discover processing activities</span>
                  </li>
                </ul>

                {connection && (
                  <div className="mt-4 p-4 bg-bone-50 rounded-xl border border-ink-900/10 text-xs space-y-1.5">
                    <p><strong className="text-ink-900">Connected to:</strong> {connection.providerAccountName}</p>
                    {connection.lastSyncAt && (
                      <p><strong className="text-ink-900">Last synced:</strong> {new Date(connection.lastSyncAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-ink-900/10 mt-auto">
                {connection && connection.status === 'active' ? (
                  <button
                    disabled={!isEditable}
                    className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    onClick={() => handleDisconnect(connection.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <a
                    className={`block text-center w-full bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 transition-colors ${!isEditable ? 'opacity-50 pointer-events-none' : ''}`}
                    href={`/api/integrations/${provider.id}/authorize?organizationId=${orgId}`}
                  >
                    {connection?.status === 'error' ? 'Reconnect' : 'Connect'}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-medium text-ink-900 mb-4">Coming Soon</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 grayscale">
          {['Xero', 'QuickBooks', 'ActiveCampaign', 'Brevo'].map(name => (
            <div key={name} className="bg-white border border-ink-900/10 rounded-xl p-4 flex items-center justify-between">
              <span className="font-medium text-ink-900">{name}</span>
              <button className="text-xs font-medium text-ink-500 hover:text-ink-900 bg-bone-50 px-2 py-1 rounded">Request</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
