// @ts-nocheck
"use client";
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { trpc } from '@/utils/trpc';
import { useConfirm } from '@/components/ui/ConfirmDialog';


export default function IntegrationsPage() {
  const t = useTranslations('settings.integrations');
  const { data: session } = useSession();
  const orgId = (session?.user as any)?.orgId;
  const { data: providers } = trpc.integrations.listProviders.useQuery();
  // The org comes from the session on the server now; this used to send the
  // literal string 'org-id-here', which failed the uuid check on every load.
  const { data: connections } = trpc.integrations.listConnections.useQuery();
  const disconnectMutation = trpc.integrations.disconnect.useMutation();
  const utils = trpc.useUtils();
  const { confirm, dialog } = useConfirm();

  const handleDisconnect = async (id: string) => {
    const ok = await confirm({
      title: t('disconnect_title'),
      description: t('disconnect_warning'),
      confirmText: t('disconnect_confirm'),
      variant: 'destructive',
    });
    if (ok) {
      await disconnectMutation.mutateAsync({ id });
      await utils.integrations.listConnections.invalidate();
    }
  };

  return (
    <div className="p-8">
      {dialog}
      <h1 className="text-2xl font-bold mb-6">{t('marketplace_title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers?.map((provider) => {
          const connection = connections?.find((c) => c.provider === provider.id);

          return (
            <div key={provider.id} className="border rounded-md p-4 bg-[#0D0F11] shadow-panel-elevated">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">{provider.name}</h3>
                  {connection?.status === 'active' && <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm">{t('status.connected')}</span>}
                  {connection?.status === 'error' && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-sm">{t('status.error')}</span>}
              </div>
              <div className="text-sm text-[#9BA1A6] space-y-2 mb-4">
                  <p>{t('features.title')}</p>
                  <ul className="list-disc pl-5">
                    <li>{t('features.auto_search', { providerName: provider.name })}</li>
                    <li>{t('features.auto_discover')}</li>
                    <li>{t('features.monitor')}</li>
                  </ul>
                  <p className="mt-4 font-semibold">{t('read_only_note')}</p>

                  {connection && (
                    <div className="mt-4 p-4 bg-white/5 rounded-md border">
                      <p><strong>{t('connection.connected_to')}</strong> {connection.providerAccountName}</p>
                      <p><strong>{t('connection.status')}</strong> {connection.status}</p>
                      {connection.lastSyncAt && <p><strong>{t('connection.last_synced')}</strong> {new Date(connection.lastSyncAt).toLocaleString()}</p>}
                    </div>
                  )}
              </div>
              <div>
                {connection && connection.status === 'active' ? (
                  <button className="bg-red-500/100 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors" onClick={() => handleDisconnect(connection.id)}>{t('actions.disconnect')}</button>
                ) : (
                  <a className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors" href={`/api/integrations/${provider.id}/authorize?organizationId=${orgId ?? ''}`}>
                      {connection?.status === 'error' ? t('actions.reconnect') : t('actions.connect_provider', { providerName: provider.name })}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
