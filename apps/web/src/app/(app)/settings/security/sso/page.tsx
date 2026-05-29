"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function SSOSettingsPage() {
  const { data: orgSettings, isLoading, refetch } = trpc.settings.getOrgSettings.useQuery();
  const updateSettings = trpc.settings.updateOrgSettings.useMutation({
    onSuccess: () => refetch(),
  });

  const [metadataUrl, setMetadataUrl] = useState('');
  const [provider, setProvider] = useState('OktaSAML');

  const handleSaveSSO = async () => {
    // In a real implementation, you would send this to the API which uses WorkOS
    // to create the connection, and returns the ssoConnectionId to save.
    // For now we just mock saving the state.

    await updateSettings.mutateAsync({
       // Update properties mapped to ssoEnabled, ssoProvider etc if exposed by updateOrgSettings
       // In a full implementation, you'd add a specific API for configuring SSO connection.
       // This is a simplified frontend UI mock.
    });
    alert('SSO Settings saved (mock)');
  };

  const handleToggleEnforce = async (enforce: boolean) => {
      // API call to set ssoEnforced
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-6 h-6 text-ink-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif text-ink-900">Single Sign-On (SSO)</h1>
        <p className="mt-2 text-sm text-ink-500">Configure SAML or OIDC single sign-on for your organization.</p>
      </div>

      <div className="bg-white hairline rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-medium text-ink-900 mb-4">SSO Connection</h2>

          <div className="space-y-6 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Identity Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 bg-bone-50 hairline rounded-lg text-sm text-ink-900 focus:ring-2 focus:ring-sage-500/20 outline-none"
              >
                <option value="OktaSAML">Okta</option>
                <option value="AzureSAML">Azure AD</option>
                <option value="GoogleOAuth">Google Workspace</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">IdP Metadata URL</label>
              <input
                type="url"
                value={metadataUrl}
                onChange={(e) => setMetadataUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-bone-50 hairline rounded-lg text-sm text-ink-900 focus:ring-2 focus:ring-sage-500/20 outline-none"
              />
            </div>

            <button
              onClick={handleSaveSSO}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Configure Connection
            </button>
          </div>

          <div className="mt-12 pt-8 border-t border-ink-100">
             <h2 className="text-lg font-medium text-ink-900 mb-4">Enforcement</h2>
             <div className="flex items-center justify-between max-w-lg">
                <div>
                  <div className="text-sm font-medium text-ink-900">Enforce SSO</div>
                  <div className="text-sm text-ink-500">Require all members to use SSO. Password login will be disabled.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-bone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
                </label>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
