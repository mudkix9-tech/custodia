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
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saved' && <span className="text-sm text-[#C9A227] font-medium">{t('saved')}</span>}
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
          <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F4F5F6]">{t('slack_integration.title')}</h3>
                <p className="text-[12px] text-[#6E747A]">{t('slack_integration.subtitle')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[13px] font-medium text-[#F4F5F6]">{t('slack_integration.webhook_url')}</label>
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={slackUrl}
                onChange={e => setSlackUrl(e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[14px] disabled:opacity-50"
              />
              <p className="text-[11px] text-[#6E747A] leading-snug">{t('slack_integration.webhook_hint')}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Routing Matrix */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-[#F4F5F6]" />
              <h2 className="text-lg font-medium text-[#F4F5F6]">{t('routing.title')}</h2>
            </div>

            <div className="bg-blue-500/10/50 border border-blue-900/50 rounded-xl p-4 mb-6 flex gap-3 text-sm text-blue-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p><strong>{t('routing.admin_note')}</strong> {t('routing.admin_note_text')}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider">{t('routing.event_type')}</th>
                    <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider text-center w-24">{t('routing.email')}</th>
                    <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider text-center w-24">{t('routing.slack')}</th>
                    <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider text-center w-24">{t('routing.in_app')}</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-[#F4F5F6]">
                  {NOTIFICATION_GROUPS.map((group, gIdx) => (
                    <React.Fragment key={gIdx}>
                      <tr className="bg-[#08090A]">
                        <td colSpan={4} className="py-2 px-3 text-[11px] font-bold text-[#9BA1A6] uppercase tracking-wider">{t(`events.${group.categoryKey}` as any)}</td>
                      </tr>
                      {group.types.map(nt => (
                        <tr key={nt.key} className="border-b border-white/5 last:border-0 hover:bg-ink-900/5">
                          <td className="py-3 px-3 font-medium text-[#E6E8EA]">{t(`events.${nt.key}` as any)}</td>
                          {['email', 'slack', 'in_app'].map(channel => (
                            <td key={channel} className="py-3 text-center align-middle relative group">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={isOrgChannelActive(nt.key, channel)}
                                  onChange={() => handleOrgToggle(nt.key, channel)}
                                  disabled={!isEditable}
                                  className="rounded border-white/20 text-[#C9A227] focus:ring-sage-600 w-4 h-4 cursor-pointer disabled:opacity-50"
                                  title={t('routing.org_default')}
                                />
                                {isOrgChannelActive(nt.key, channel) && (
                                  <button
                                    onClick={() => handleUserToggle(nt.key, channel)}
                                    className={`w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isUserMuted(nt.key, channel) ? 'opacity-100 text-red-500 bg-red-500/10' : 'text-[#6E747A] hover:bg-ink-900/10'}`}
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
