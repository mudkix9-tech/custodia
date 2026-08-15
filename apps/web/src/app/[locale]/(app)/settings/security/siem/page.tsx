'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/Toast';

export default function SiemSettingsPage() {
  const t = useTranslations('settings');
  const toast = useToast();
  const toastError = (msg: string) => toast(msg, { tone: 'error' });
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
      toast(t('siem.saved'));
      refetch();
    } catch (error: any) {
      toastError(t('siem.save_failed', { message: error.message }));
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await testMutation.mutateAsync();
      if (result.success) {
        toast(result.message || t('siem.test_success'));
      } else {
        toastError(result.message || t('siem.test_failed'));
      }
    } catch (error: any) {
      toastError(t('siem.test_error', { message: error.message }));
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div>{t('loading')}</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {siemSettings?.deliveryStatus && (
        <div className={`p-4 rounded-md border ${
          siemSettings.deliveryStatus.status === 'sent'
            ? 'bg-set-ok/12 border-green-500/25 text-set-ok'
            : siemSettings.deliveryStatus.status === 'failed'
            ? 'bg-set-danger/12 border-red-900/50 text-set-danger'
            : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-300'
        }`}>
          <div className="font-semibold">
            {t('siem.status', { status: t(`siem.delivery_status.${siemSettings.deliveryStatus.status}`) })}
          </div>
          {siemSettings.deliveryStatus.lastAttemptAt && (
            <div className="text-sm mt-1">
              {t('siem.last_attempt', { date: new Date(siemSettings.deliveryStatus.lastAttemptAt).toLocaleString() })}
            </div>
          )}
          {siemSettings.deliveryStatus.error && (
            <div className="text-sm mt-1 font-mono break-all">
              {t('siem.error', { message: siemSettings.deliveryStatus.error })}
            </div>
          )}
        </div>
      )}

      <div>
        <h1 className="mb-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">{t('siem.title')}</h1>
        <p className="text-set-fg-subtle">
          {t('siem.subtitle')}
        </p>
      </div>

      <div className="bg-set-panel p-6 rounded-lg border border-set-line space-y-6 shadow-panel-elevated">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="siem-enabled" className="text-base font-medium text-set-fg">{t('siem.enable')}</Label>
            <p className="text-sm text-set-fg-subtle">
              {t('siem.enable_description')}
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
              <Label htmlFor="endpoint-url" className="text-set-fg">{t('siem.endpoint')}</Label>
              <Input
                id="endpoint-url"
                placeholder={t('siem.endpoint_placeholder')}
                value={siemEndpointUrl}
                onChange={(e) => setSiemEndpointUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payload-format" className="text-set-fg">{t('siem.format')}</Label>
              <Select value={siemFormat} onValueChange={setSiemFormat}>
                <SelectTrigger id="payload-format">
                  <SelectValue placeholder={t('siem.format_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="cef">CEF (Common Event Format)</SelectItem>
                  <SelectItem value="syslog">Syslog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-header" className="text-set-fg">{t('siem.auth_header')}</Label>
              <Input
                id="auth-header"
                placeholder={t('siem.auth_header_placeholder')}
                value={siemAuthHeader}
                onChange={(e) => setSiemAuthHeader(e.target.value)}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('siem.saving') : t('siem.save')}
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !siemEndpointUrl}
              >
                {isTesting ? t('siem.testing') : t('siem.test')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
