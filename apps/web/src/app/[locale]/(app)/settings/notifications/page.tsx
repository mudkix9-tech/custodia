"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, Save } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export const NOTIFICATION_GROUPS = [
  {
    categoryKey: 'category_dsars',
    types: [
      { key: 'dsar.received' },
      { key: 'dsar.deadline_warning_7d' },
      { key: 'dsar.deadline_warning_3d' },
      { key: 'dsar.overdue' },
      { key: 'dsar.reply_received' },
    ]
  },
  {
    categoryKey: 'category_breaches',
    types: [
      { key: 'breach.reported' },
      { key: 'breach.deadline_48h' },
      { key: 'breach.deadline_12h' },
      { key: 'breach.overdue' },
    ]
  },
  {
    categoryKey: 'category_vendors',
    types: [
      { key: 'vendor.dpa_expiring_30d' },
      { key: 'vendor.dpa_expired' },
      { key: 'compliance.gap_detected' },
      { key: 'training.assigned' },
      { key: 'policy.out_of_sync' },
    ]
  }
];

export default function NotificationsSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.notifications');
  const userRole = (session?.user as any)?.role;
  const isEditable = userRole === 'admin' || userRole === 'owner';

  const { data: orgSettings, isLoading: isLoadingOrg } = trpc.settings.getOrgSettings.useQuery();
  const { data: userSettings, isLoading: isLoadingUser } = trpc.settings.getUserSettings.useQuery();

  const updateOrgMutation = trpc.settings.updateOrgSettings.useMutation();
  const updateUserMutation = trpc.settings.updateUserSettings.useMutation();

  const [slackUrl, setSlackUrl] = useState('');
  const [orgPrefs, setOrgPrefs] = useState<Record<string, { channels: string[] }>>({});
  const [userOverrides, setUserOverrides] = useState<Record<string, { mutedChannels: string[] }>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (orgSettings) {
      setSlackUrl(orgSettings.slackWebhookUrl || '');
      setOrgPrefs((orgSettings.notificationPreferences as any) || {});
    }
  }, [orgSettings]);

  useEffect(() => {
    if (userSettings) {
      setUserOverrides((userSettings.notificationOverrides as any) || {});
    }
  }, [userSettings]);

  if (isLoadingOrg || isLoadingUser) return <GenericWorkspaceSkeleton />;

  const handleOrgToggle = (type: string, channel: string) => {
    if (!isEditable) return;
    const currentChannels = orgPrefs[type]?.channels || ['email', 'in_app'];
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];

    setOrgPrefs({ ...orgPrefs, [type]: { channels: newChannels } });
  };

  const handleUserToggle = (type: string, channel: string) => {
    const currentMuted = userOverrides[type]?.mutedChannels || [];
    const newMuted = currentMuted.includes(channel)
      ? currentMuted.filter(c => c !== channel)
      : [...currentMuted, channel];

    setUserOverrides({ ...userOverrides, [type]: { mutedChannels: newMuted } });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      if (isEditable) {
        await updateOrgMutation.mutateAsync({
          slackWebhookUrl: slackUrl,
          notificationPreferences: orgPrefs
        });
      }
      await updateUserMutation.mutateAsync({
        notificationOverrides: userOverrides
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
      alert(t('failed_to_save'));
    }
  };

  const isOrgChannelActive = (type: string, channel: string) => {
    if (!orgPrefs[type]) return ['email', 'in_app'].includes(channel);
    return orgPrefs[type].channels.includes(channel);
  };

  const isUserMuted = (type: string, channel: string) => {
    if (!userOverrides[type]) return false;
    return userOverrides[type].mutedChannels.includes(channel);
  };

  return (
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24 rise-in">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <h1 className="mb-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">{t('title')}</h1>
          <p className="max-w-[52ch] text-sm leading-[1.55] text-set-fg-muted text-pretty">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saved' && <span className="text-sm text-set-gold font-medium">{t('saved')}</span>}
          <button
            onClick={handleSave}
            disabled={updateOrgMutation.isPending || updateUserMutation.isPending || saveStatus === 'saving'}
            className="flex items-center gap-2 bg-[var(--org-primary,#2c3e38)] text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saveStatus === 'saving' ? t('saving') : t('save_changes')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Col: Integrations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-[14px] border border-set-line bg-set-panel p-[22px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-set-fg">{t('slack_integration.title')}</h3>
                <p className="text-[12px] text-set-fg-subtle">{t('slack_integration.subtitle')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[13px] font-medium text-set-fg">{t('slack_integration.webhook_url')}</label>
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={slackUrl}
                onChange={e => setSlackUrl(e.target.value)}
                disabled={!isEditable}
                className="w-full bg-set-sunken border border-set-line rounded-lg px-3 py-2 text-[14px] disabled:opacity-50"
              />
              <p className="text-[11px] text-set-fg-subtle leading-snug">{t('slack_integration.webhook_hint')}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Routing Matrix */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[14px] border border-set-line bg-set-panel p-[22px] overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-set-fg" />
              <h2 className="text-lg font-medium text-set-fg">{t('routing.title')}</h2>
            </div>

            <div className="bg-blue-500/50 border border-blue-900/50 rounded-xl p-4 mb-6 flex gap-3 text-sm text-blue-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p><strong>{t('routing.admin_note')}</strong> {t('routing.admin_note_text')}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-set-line">
                    <th className="pb-3 text-[12px] font-bold text-set-fg-subtle uppercase tracking-wider">{t('routing.event_type')}</th>
                    <th className="pb-3 text-[12px] font-bold text-set-fg-subtle uppercase tracking-wider text-center w-24">{t('routing.email')}</th>
                    <th className="pb-3 text-[12px] font-bold text-set-fg-subtle uppercase tracking-wider text-center w-24">{t('routing.slack')}</th>
                    <th className="pb-3 text-[12px] font-bold text-set-fg-subtle uppercase tracking-wider text-center w-24">{t('routing.in_app')}</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-set-fg">
                  {NOTIFICATION_GROUPS.map((group, gIdx) => (
                    <React.Fragment key={gIdx}>
                      <tr className="bg-set-sunken">
                        <td colSpan={4} className="py-2 px-3 text-[11px] font-bold text-set-fg-muted uppercase tracking-wider">{t(`events.${group.categoryKey}` as any)}</td>
                      </tr>
                      {group.types.map(nt => (
                        <tr key={nt.key} className="border-b border-set-line-soft last:border-0 hover:bg-set-row-hover">
                          <td className="py-3 px-3 font-medium text-set-fg">{t(`events.${nt.key}` as any)}</td>
                          {['email', 'slack', 'in_app'].map(channel => (
                            <td key={channel} className="py-3 text-center align-middle relative group">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={isOrgChannelActive(nt.key, channel)}
                                  onChange={() => handleOrgToggle(nt.key, channel)}
                                  disabled={!isEditable}
                                  className="rounded border-set-line-strong text-set-gold focus:ring-set-gold w-4 h-4 cursor-pointer disabled:opacity-50"
                                  title={t('routing.org_default')}
                                />
                                {isOrgChannelActive(nt.key, channel) && (
                                  <button
                                    onClick={() => handleUserToggle(nt.key, channel)}
                                    className={`w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isUserMuted(nt.key, channel) ? 'opacity-100 text-set-danger bg-set-danger/12' : 'text-set-fg-subtle hover:bg-set-row-hover'}`}
                                    title={isUserMuted(nt.key, channel) ? t('routing.unmute') : t('routing.mute')}
                                  >
                                    <Bell className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
