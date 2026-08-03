// @ts-nocheck
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
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">Integrations</h1>
          <p className="text-[#9BA1A6]">Connect CRM and marketing tools for automated DSAR discovery.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers?.map((provider) => {
          const connection = connections?.find((c) => c.provider === provider.id);

          return (
            <div key={provider.id} className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 flex flex-col h-full shadow-panel-elevated hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#08090A] flex items-center justify-center border border-white/10">
                    <Plug className="w-5 h-5 text-[#F4F5F6]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#F4F5F6]">{provider.name}</h3>
                </div>
                {connection?.status === 'active' && (
                  <span className="bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]/100"></span> Connected
                  </span>
                )}
                {connection?.status === 'error' && (
                  <span className="bg-red-500/10 text-red-400 border border-red-900/50 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/100"></span> Error
                  </span>
                )}
              </div>

              <div className="text-sm text-[#9BA1A6] space-y-3 mb-6 flex-1">
                <p>When connected, Custodia can:</p>
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
                  <div className="mt-4 p-4 bg-[#08090A] rounded-xl border border-white/10 text-xs space-y-1.5">
                    <p><strong className="text-[#F4F5F6]">Connected to:</strong> {connection.providerAccountName}</p>
                    {connection.lastSyncAt && (
                      <p><strong className="text-[#F4F5F6]">Last synced:</strong> {new Date(connection.lastSyncAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 mt-auto">
                {connection && connection.status === 'active' ? (
                  <button
                    disabled={!isEditable}
                    className="w-full bg-[#0D0F11] border border-red-900/50 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
        <h3 className="text-lg font-medium text-[#F4F5F6] mb-4">Coming Soon</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 grayscale">
          {['Xero', 'QuickBooks', 'ActiveCampaign', 'Brevo'].map(name => (
            <div key={name} className="bg-[#0D0F11] border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <span className="font-medium text-[#F4F5F6]">{name}</span>
              <button className="text-xs font-medium text-[#6E747A] hover:text-[#F4F5F6] bg-[#08090A] px-2 py-1 rounded">Request</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
