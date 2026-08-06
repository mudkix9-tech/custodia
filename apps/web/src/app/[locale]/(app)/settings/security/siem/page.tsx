// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSettingsToast } from '@/components/settings/SettingsToast';

export default function SiemSettingsPage() {
  const toast = useSettingsToast();
  const toastError = (msg: string) => toast(msg, 'error');
  const [siemEnabled, setSiemEnabled] = useState(false);
  const [siemEndpointUrl, setSiemEndpointUrl] = useState('');
  const [siemFormat, setSiemFormat] = useState('json');
  const [siemAuthHeader, setSiemAuthHeader] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const { data: siemSettings, isLoading, refetch } = trpc.settings.getSiemSettings.useQuery();
  const updateMutation = trpc.settings.updateSiemSettings.useMutation();
  const testMutation = trpc.settings.testSiemConnection.useMutation();

  useEffect(() => {
    if (siemSettings) {
      setSiemEnabled(siemSettings.siemEnabled || false);
      setSiemEndpointUrl(siemSettings.siemEndpointUrl || '');
      setSiemFormat(siemSettings.siemFormat || 'json');
      setSiemAuthHeader(siemSettings.siemAuthHeader || '');
    }
  }, [siemSettings]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        siemEnabled,
        siemEndpointUrl,
        siemFormat,
        siemAuthHeader,
      });
      toast('SIEM settings saved successfully');
      refetch();
    } catch (error: any) {
      toastError(`Failed to save settings: ${error.message}`);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await testMutation.mutateAsync();
      if (result.success) {
        toast(result.message || 'Test connection successful');
      } else {
        toastError(result.message || 'Test connection failed');
      }
    } catch (error: any) {
      toastError(`Test connection failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {siemSettings?.deliveryStatus && (
        <div className={`p-4 rounded-md border ${
          siemSettings.deliveryStatus.status === 'sent'
            ? 'bg-set-ok/12 border-green-200 text-set-ok'
            : siemSettings.deliveryStatus.status === 'failed'
            ? 'bg-set-danger/12 border-red-900/50 text-set-danger'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <div className="font-semibold">
            Status: {siemSettings.deliveryStatus.status.charAt(0).toUpperCase() + siemSettings.deliveryStatus.status.slice(1)}
          </div>
          {siemSettings.deliveryStatus.lastAttemptAt && (
            <div className="text-sm mt-1">
              Last Attempt: {new Date(siemSettings.deliveryStatus.lastAttemptAt).toLocaleString()}
            </div>
          )}
          {siemSettings.deliveryStatus.error && (
            <div className="text-sm mt-1 font-mono break-all">
              Error: {siemSettings.deliveryStatus.error}
            </div>
          )}
        </div>
      )}

      <div>
        <h1 className="mb-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">SIEM Integration</h1>
        <p className="text-set-fg-subtle">
          Stream audit logs to your security tool (Splunk, Datadog, Microsoft Sentinel) in real-time.
        </p>
      </div>

      <div className="bg-set-panel p-6 rounded-lg border border-set-line space-y-6 shadow-panel-elevated">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="siem-enabled" className="text-base font-medium text-set-fg">Enable SIEM Integration</Label>
            <p className="text-sm text-set-fg-subtle">
              When enabled, audit logs will be pushed to the configured endpoint.
            </p>
          </div>
          <Switch
            id="siem-enabled"
            checked={siemEnabled}
            onCheckedChange={setSiemEnabled}
          />
        </div>

        {siemEnabled && (
          <div className="space-y-4 pt-4 border-t border-set-line">
            <div className="space-y-2">
              <Label htmlFor="endpoint-url" className="text-set-fg">Endpoint URL</Label>
              <Input
                id="endpoint-url"
                placeholder="https://your-siem-instance.com/api/v1/logs"
                value={siemEndpointUrl}
                onChange={(e) => setSiemEndpointUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payload-format" className="text-set-fg">Payload Format</Label>
              <Select value={siemFormat} onValueChange={setSiemFormat}>
                <SelectTrigger id="payload-format">
                  <SelectValue placeholder="Select a format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="cef">CEF (Common Event Format)</SelectItem>
                  <SelectItem value="syslog">Syslog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-header" className="text-set-fg">Authorization Header (Optional)</Label>
              <Input
                id="auth-header"
                placeholder="Bearer your_token_here"
                value={siemAuthHeader}
                onChange={(e) => setSiemAuthHeader(e.target.value)}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={handleSave} disabled={updateMutation.isLoading}>
                {updateMutation.isLoading ? 'Saving...' : 'Save Configuration'}
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !siemEndpointUrl}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
