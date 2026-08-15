// @ts-nocheck
"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { Plug, Zap } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Plus, Check, ExternalLink, ShieldAlert, ArrowRight } from 'lucide-react';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export default function IntegrationsSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.integrations');
  const userRole = (session?.user as any)?.role;
  const isEditable = userRole === 'admin' || userRole === 'owner';
  const orgId = (session?.user as any)?.orgId;

  const { data: providers, isLoading: providersLoading } = trpc.integrations.listProviders.useQuery();
  const { data: connections, refetch } = trpc.integrations.listConnections.useQuery();
  const disconnectMutation = trpc.integrations.disconnect.useMutation();
  const { confirm, dialog } = useConfirm();

  const handleDisconnect = async (id: string) => {
    if (!isEditable) return;
    const ok = await confirm({
      title: t('disconnect_title'),
      description: t('disconnect_warning'),
      confirmText: t('disconnect_confirm'),
      variant: 'destructive',
    });
    if (ok) {
      await disconnectMutation.mutateAsync({ id });
      refetch();
    }
  };

  if (providersLoading) return <GenericWorkspaceSkeleton />;

  return (
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24 rise-in">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <h1 className="mb-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">{t('title')}</h1>
          <p className="max-w-[52ch] text-sm leading-[1.55] text-set-fg-muted text-pretty">{t('subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers?.map((provider) => {
          const connection = connections?.find((c) => c.provider === provider.id);

          return (
            <div key={provider.id} className="rounded-[14px] border border-set-line bg-set-panel p-[22px] flex flex-col h-full shadow-panel-elevated hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-set-sunken flex items-center justify-center border border-set-line">
                    <Plug className="w-5 h-5 text-set-fg" />
                  </div>
                  <h3 className="text-lg font-medium text-set-fg">{provider.name}</h3>
                </div>
                {connection?.status === 'active' && (
                  <span className="bg-set-gold/10 text-set-gold border border-set-gold/30 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-set-gold/100"></span> {t('status.connected')}
                  </span>
                )}
                {connection?.status === 'error' && (
                  <span className="bg-set-danger/12 text-set-danger border border-red-900/50 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-set-danger/120"></span> {t('status.error')}
                  </span>
                )}
              </div>

              <div className="text-sm text-set-fg-muted space-y-3 mb-6 flex-1">
                <p>{t('features.title')}</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                    <span>{t('features.auto_search', { providerName: provider.name })}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                    <span>{t('features.auto_discover')}</span>
                  </li>
                </ul>

                {connection && (
                  <div className="mt-4 p-4 bg-set-sunken rounded-xl border border-set-line text-xs space-y-1.5">
                    <p><strong className="text-set-fg">{t('connection.connected_to')}</strong> {connection.providerAccountName}</p>
                    {connection.lastSyncAt && (
                      <p><strong className="text-set-fg">{t('connection.last_synced')}</strong> {new Date(connection.lastSyncAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-set-line mt-auto">
                {connection && connection.status === 'active' ? (
                  <button
                    disabled={!isEditable}
                    className="w-full bg-set-panel border border-red-900/50 text-set-danger hover:bg-set-danger/12 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    onClick={() => handleDisconnect(connection.id)}
                  >
                    {t('actions.disconnect')}
                  </button>
                ) : (
                  <a
                    className={`block text-center w-full px-4 py-2 rounded-lg text-sm font-semibold bg-set-gold text-[#0A0A0A] hover:bg-set-gold-hi transition-colors ${!isEditable ? 'opacity-50 pointer-events-none' : ''}`}
                    href={`/api/integrations/${provider.id}/authorize?organizationId=${orgId}`}
                  >
                    {connection?.status === 'error' ? t('actions.reconnect') : t('actions.connect')}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-medium text-set-fg mb-4">{t('coming_soon')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 grayscale">
          {['Xero', 'QuickBooks', 'ActiveCampaign', 'Brevo'].map(name => (
            <div key={name} className="bg-set-panel border border-set-line rounded-xl p-4 flex items-center justify-between">
              <span className="font-medium text-set-fg">{name}</span>
              <button className="text-xs font-medium text-set-fg-subtle hover:text-set-fg bg-set-sunken px-2 py-1 rounded">{t('actions.request')}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
