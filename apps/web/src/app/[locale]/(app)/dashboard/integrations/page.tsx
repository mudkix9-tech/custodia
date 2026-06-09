// @ts-nocheck
"use client";
import { trpc } from '@/utils/trpc';
import { useConfirm } from '@/components/ui/ConfirmDialog';


export default function IntegrationsPage() {
  const { data: providers } = trpc.integrations.listProviders.useQuery();
  const { data: connections } = trpc.integrations.listConnections.useQuery({ organizationId: 'org-id-here' });
  const disconnectMutation = trpc.integrations.disconnect.useMutation();
  const { confirm, dialog } = useConfirm();

  const handleDisconnect = async (id: string) => {
    if (window.confirm('Disconnecting will disable automatic DSAR data discovery. Any in-progress DSAR searches will be marked as manual. Proceed?')) {
      await disconnectMutation.mutateAsync({ id });
      // Refetch connections (mocked for this example)
    }
  };

  return (
    <div className="p-8">
      {dialog}
      <h1 className="text-2xl font-bold mb-6">Integrations Marketplace</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers?.map((provider) => {
          const connection = connections?.find((c) => c.provider === provider.id);

          return (
            <div key={provider.id} className="border rounded-md p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">{provider.name}</h3>
                  {connection?.status === 'active' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">Connected</span>}
                  {connection?.status === 'error' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">Error</span>}
              </div>
              <div className="text-sm text-gray-600 space-y-2 mb-4">
                  <p>When connected, Privaro can:</p>
                  <ul className="list-disc pl-5">
                    <li>Auto-search {provider.name} contacts during DSAR processing</li>
                    <li>Auto-discover processing activities</li>
                    <li>Monitor stored personal data</li>
                  </ul>
                  <p className="mt-4 font-semibold">Data access: Read-only. Privaro never modifies your data.</p>

                  {connection && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md border">
                      <p><strong>Connected to:</strong> {connection.providerAccountName}</p>
                      <p><strong>Status:</strong> {connection.status}</p>
                      {connection.lastSyncAt && <p><strong>Last synced:</strong> {new Date(connection.lastSyncAt).toLocaleString()}</p>}
                    </div>
                  )}
              </div>
              <div>
                {connection && connection.status === 'active' ? (
                  <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors" onClick={() => handleDisconnect(connection.id)}>Disconnect</button>
                ) : (
                  <a className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors" href={`/api/integrations/${provider.id}/authorize?organizationId=org-id-here`}>
                      {connection?.status === 'error' ? 'Reconnect' : `Connect ${provider.name}`}
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
