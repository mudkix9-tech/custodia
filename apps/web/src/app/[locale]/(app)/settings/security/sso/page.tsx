"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/**
 * SSO is not yet self-serve.
 *
 * What was here before was a working-looking form: "Configure Connection" called
 * `updateOrgSettings({})` — an empty object — and then said "SSO Settings saved
 * (mock)" in an `alert()`, and the Enforce toggle had an empty handler and no
 * `checked` prop, so it moved and meant nothing. An enterprise buyer evaluating
 * this page would have concluded SSO worked, configured it, and found password
 * login still open.
 *
 * Until the connection API exists, the page says so and gives a route to the
 * humans who can set it up. The fields stay visible but disabled, so a buyer can
 * still see exactly what onboarding will ask for.
 */
export default function SSOSettingsPage() {
  const t = useTranslations('settings');
  const { data: orgSettings, isLoading } = trpc.settings.getOrgSettings.useQuery();
  const [metadataUrl, setMetadataUrl] = useState('');
  const [provider, setProvider] = useState('OktaSAML');

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-6 h-6 text-set-fg-subtle" /></div>;
  }

  const isEnterprise = orgSettings?.subscriptionTier === 'enterprise';

  return (
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24 rise-in">
      <div className="mb-8">
        <h1 className="mb-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">{t('sso.title')}</h1>
        <p className="mt-2 text-sm text-set-fg-subtle">{t('sso.subtitle')}</p>
      </div>

      <div className="mb-6 flex gap-4 rounded-xl border border-set-gold/30 bg-set-gold/10 p-6">
        <ShieldCheck className="h-6 w-6 shrink-0 text-set-gold" />
        <div className="min-w-0">
          <h2 className="font-medium text-set-fg">
            {isEnterprise ? t('sso.gate_enterprise') : t('sso.gate_upgrade')}
          </h2>
          <p className="mt-1 text-sm text-set-fg-muted">
            {t('sso.gate_description')}
          </p>
          <a
            href="mailto:support@custodia.io?subject=SSO%20configuration%20request"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-set-gold px-4 py-2 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-set-gold-hi"
          >
            <Mail className="h-4 w-4" />
            {isEnterprise ? t('sso.cta_enterprise') : t('sso.cta_upgrade')}
          </a>
        </div>
      </div>

      <div className="bg-set-panel hairline rounded-xl shadow-panel-elevated overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-set-fg">{t('sso.connection')}</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-set-fg-subtle">
              {t('sso.not_configured')}
            </span>
          </div>
          <p className="mb-6 text-sm text-set-fg-subtle">
            {t('sso.connection_note')}
          </p>

          <fieldset disabled className="space-y-6 max-w-lg opacity-60">
            <div>
              <Label className="block text-sm font-medium text-set-fg mb-1.5">{t('sso.provider')}</Label>
              <Select value={provider} onValueChange={setProvider}>
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
              <Label className="block text-sm font-medium text-set-fg mb-1.5">{t('sso.metadata_url')}</Label>
              <Input
                type="url"
                value={metadataUrl}
                onChange={(e) => setMetadataUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </fieldset>

          <div className="mt-12 pt-8 border-t border-white/10">
            <h2 className="text-lg font-medium text-set-fg mb-4">{t('sso.enforcement')}</h2>
            <div className="flex items-center justify-between max-w-lg opacity-60">
              <div>
                <div className="text-sm font-medium text-set-fg">{t('sso.enforce')}</div>
                <div className="text-sm text-set-fg-subtle">
                  {t('sso.enforce_description')}
                </div>
              </div>
              <Switch checked={false} disabled aria-label={t('sso.enforce_aria')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
