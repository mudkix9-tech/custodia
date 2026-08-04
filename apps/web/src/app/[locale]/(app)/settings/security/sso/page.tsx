"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

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
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-6 h-6 text-[#6E747A]" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif text-[#F4F5F6]">Single Sign-On (SSO)</h1>
        <p className="mt-2 text-sm text-[#6E747A]">Configure SAML or OIDC single sign-on for your organization.</p>
      </div>

      <div className="bg-[#0D0F11] hairline rounded-xl shadow-panel-elevated overflow-hidden">
        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-medium text-[#F4F5F6] mb-4">SSO Connection</h2>

          <div className="space-y-6 max-w-lg">
            <div>
              <Label className="block text-sm font-medium text-[#E6E8EA] mb-1.5">Identity Provider</Label>
              <Select
                value={provider}
                onValueChange={setProvider}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OktaSAML">Okta</SelectItem>
                  <SelectItem value="AzureSAML">Azure AD</SelectItem>
                  <SelectItem value="GoogleOAuth">Google Workspace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium text-[#E6E8EA] mb-1.5">IdP Metadata URL</Label>
              <Input
                type="url"
                value={metadataUrl}
                onChange={(e) => setMetadataUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <Button
              onClick={handleSaveSSO}
            >
              Configure Connection
            </Button>
          </div>

          <div className="mt-12 pt-8 border-t border-ink-100">
             <h2 className="text-lg font-medium text-[#F4F5F6] mb-4">Enforcement</h2>
             <div className="flex items-center justify-between max-w-lg">
                <div>
                  <div className="text-sm font-medium text-[#F4F5F6]">Enforce SSO</div>
                  <div className="text-sm text-[#6E747A]">Require all members to use SSO. Password login will be disabled.</div>
                </div>
                <Switch 
                  onCheckedChange={handleToggleEnforce}
                />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
