// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import WebhookDeliveryLog from '@/components/developers/WebhookDeliveryLog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ExternalLink, Copy, Check, Eye, EyeOff, Key, Plus, Trash2, Webhook, Activity, AlertCircle } from 'lucide-react';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';


function Card({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-6 ${className || ''}`}>{children}</div>;
}

const ALL_EVENTS = [
  'ropa.created', 'ropa.updated', 'ropa.deleted',
  'vendor.added', 'vendor.removed', 'vendor.dpa_status_changed', 'vendor.breach_reported',
  'dsar.created', 'dsar.status_changed', 'dsar.completed',
  'breach.reported', 'breach.status_changed',
];

export default function DevelopersSettingsPage() {
  const [isKeyModalOpen, setKeyModalOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['read']);
  const [keyAllowedIps, setKeyAllowedIps] = useState('');

  const [isWebhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const keysQuery = trpc.apiKeys.list.useQuery();
  const webhooksQuery = trpc.webhooks.list.useQuery();

  const createKeyMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setNewKey(data.fullKey);
      utils.apiKeys.list.invalidate();
    }
  });

  const revokeKeyMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => utils.apiKeys.list.invalidate()
  });

  const createWebhookMutation = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      setWebhookModalOpen(false);
      setWebhookUrl('');
      setWebhookEvents([]);
      utils.webhooks.list.invalidate();
    }
  });

  const { confirm, dialog } = useConfirm();
  const deleteWebhookMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => utils.webhooks.list.invalidate()
  });

  const testWebhookMutation = trpc.webhooks.test.useMutation();

  const handleCreateKey = () => {
    createKeyMutation.mutate({
      name: keyName,
      scopes: keyScopes,
      allowedIps: keyAllowedIps ? keyAllowedIps.split(',').map(ip => ip.trim()) : null
    });
  };

  const handleCreateWebhook = () => {
    createWebhookMutation.mutate({ url: webhookUrl, events: webhookEvents });
  };

  const toggleEvent = (event: string) => {
    setWebhookEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Developers</h1>
        <p className="text-slate-500">Manage API keys and Webhooks for external integrations</p>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800">API Keys</h2>
          <button
            className="bg-slate-900 text-white px-4 py-2 rounded-md font-medium text-sm"
            onClick={() => setKeyModalOpen(true)}
          >
            Create API Key
          </button>
        </div>

        <div className="space-y-4">
          {keysQuery.data?.length === 0 && <p className="text-slate-500 text-sm">No API keys found.</p>}
          {keysQuery.data?.map(key => (
            <div key={key.id} className="flex justify-between items-center border border-slate-200 p-4 rounded-md bg-slate-50">
              <div>
                <p className="font-medium text-slate-900 flex items-center gap-2">
                  {key.name}
                  {key.revokedAt && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Revoked</span>}
                </p>
                <div className="text-sm font-mono text-slate-500 mt-1">{key.prefix}••••••••</div>
                <div className="text-xs text-slate-400 mt-1">
                  Scopes: {(key.scopes as string[]).join(', ')} •
                  IPs: {key.allowedIps ? (key.allowedIps as string[]).join(', ') : 'Any'} •
                  Uses: {key.requestCount}
                </div>
              </div>
              {!key.revokedAt && (
                <button
                  className="text-red-600 hover:text-red-700 text-sm font-medium border border-red-200 px-3 py-1.5 rounded bg-white"
                  onClick={async () => { const confirmed = await confirm({ title: 'Revoke API Key?', description: 'This will instantly disable the key. Any applications using it will lose access.', variant: 'destructive', confirmText: 'Revoke' }); if (confirmed) revokeKeyMutation.mutate({ id: key.id }); }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Webhooks</h2>
          <button
            className="bg-slate-900 text-white px-4 py-2 rounded-md font-medium text-sm"
            onClick={() => setWebhookModalOpen(true)}
          >
            Add Webhook
          </button>
        </div>

        <div className="space-y-4">
          {webhooksQuery.data?.length === 0 && <p className="text-slate-500 text-sm">No webhooks found.</p>}
          {webhooksQuery.data?.map(hook => (
            <div key={hook.id} className="border border-slate-200 p-4 rounded-md bg-slate-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-900">{hook.url}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Subscribed to: {(hook.events as string[]).length} events
                  </p>
                  {!hook.isActive && <p className="text-xs text-red-500 mt-1">Disabled due to consecutive failures</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-slate-600 hover:text-slate-900 text-sm font-medium border border-slate-200 px-3 py-1.5 rounded bg-white"
                    onClick={() => {
                      testWebhookMutation.mutate({ id: hook.id }, {
                        onSuccess: () => alert('Test event successfully dispatched!'),
                        onError: (e) => alert('Failed to dispatch test event: ' + e.message)
                      });
                    }}
                    disabled={testWebhookMutation.isPending}
                  >
                    Send Test
                  </button>
                  <button
                    className="text-red-600 hover:text-red-700 text-sm font-medium border border-red-200 px-3 py-1.5 rounded bg-white"
                    onClick={async () => {
                      const confirmed = await confirm({ title: 'Delete webhook?', description: 'This will permanently delete the webhook and stop sending events.', variant: 'destructive' });
                      if (confirmed) deleteWebhookMutation.mutate({ id: hook.id });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <WebhookDeliveryLog webhookId={hook.id} />
            </div>
          ))}
        </div>
      </Card>

      {isKeyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">Create API Key</h3>
            {!newKey ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 rounded-md focus:ring-1 focus:ring-slate-900"
                    placeholder="e.g. Production Zapier"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scopes</label>
                  <div className="flex gap-2 text-sm">
                    {['read', 'write', 'delete'].map(scope => (
                      <label key={scope} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keyScopes.includes(scope)}
                          onChange={(e) => {
                            if (e.target.checked) setKeyScopes(p => [...p, scope]);
                            else setKeyScopes(p => p.filter(s => s !== scope));
                          }}
                        /> {scope}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Allowed IPs (Optional, comma-separated)</label>
                  <input
                    type="text"
                    value={keyAllowedIps}
                    onChange={e => setKeyAllowedIps(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 rounded-md focus:ring-1 focus:ring-slate-900"
                    placeholder="e.g. 192.168.1.1, 10.0.0.1"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button onClick={() => setKeyModalOpen(false)} className="px-4 py-2 text-slate-600 hover:text-slate-900">Cancel</button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!keyName || createKeyMutation.isPending}
                    className="bg-slate-900 text-white px-4 py-2 rounded-md disabled:opacity-50"
                  >
                    Generate Key
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 text-red-800 text-sm font-medium rounded-md border border-red-200">
                  This key will only be shown once. Copy it now and store it securely.
                </div>
                <div className="bg-slate-100 border border-slate-200 p-4 rounded-md font-mono text-sm break-all text-slate-900">
                  {newKey}
                </div>
                <button
                  onClick={() => { setKeyModalOpen(false); setNewKey(null); setKeyName(''); setKeyScopes(['read']); setKeyAllowedIps(''); }}
                  className="w-full bg-slate-900 text-white px-4 py-2 rounded-md font-medium"
                >
                  I&apos;ve copied the key
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isWebhookModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">Add Webhook</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payload URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 rounded-md focus:ring-1 focus:ring-slate-900"
                  placeholder="https://example.com/api/webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Events to send</label>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1">
                  {ALL_EVENTS.map(event => (
                    <label key={event} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={webhookEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-slate-300"
                      />
                      <span className="font-mono text-slate-700">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => setWebhookModalOpen(false)} className="px-4 py-2 text-slate-600 hover:text-slate-900">Cancel</button>
                <button
                  onClick={handleCreateWebhook}
                  disabled={!webhookUrl || webhookEvents.length === 0 || createWebhookMutation.isPending}
                  className="bg-slate-900 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  Add Webhook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
