"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import React, { useState, useEffect } from "react";

import { User, Bell, Save } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { NOTIFICATION_GROUPS } from '../notifications/page';

export default function ProfileSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.profile');
  const { data: userSettings, isLoading } = trpc.settings.getUserSettings.useQuery();
  const updateUserSettings = trpc.settings.updateUserSettings.useMutation();

  const [formData, setFormData] = useState({
    name: '',
    timezone: 'UTC',
    language: 'en',
  });

  const [userOverrides, setUserOverrides] = useState<Record<string, { mutedChannels: string[] }>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (userSettings) {
      setFormData({
        name: userSettings.name || '',
        timezone: (userSettings as any).timezone || 'UTC',
        language: (userSettings as any).language || 'en',
      });
      setUserOverrides((userSettings.notificationOverrides as any) || {});
    }
  }, [userSettings]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await updateUserSettings.mutateAsync({
        ...formData,
        notificationOverrides: userOverrides,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
    }
  };

  const handleUserToggle = (type: string, channel: string) => {
    const currentMuted = userOverrides[type]?.mutedChannels || [];
    const newMuted = currentMuted.includes(channel)
      ? currentMuted.filter(c => c !== channel)
      : [...currentMuted, channel];

    setUserOverrides({ ...userOverrides, [type]: { mutedChannels: newMuted } });
  };

  const isUserMuted = (type: string, channel: string) => {
    if (!userOverrides[type]) return false;
    return userOverrides[type].mutedChannels.includes(channel);
  };

  if (isLoading) return <GenericWorkspaceSkeleton />;

  return (
    <div className="max-w-4xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saved' && <span className="text-sm text-[#C9A227] font-medium">Saved</span>}
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 bg-ink-900 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saveStatus === 'saving' ? t('saving') : t('save_changes')}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Personal Info */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <User className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('personal_information.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('personal_information.full_name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F4F5F6] focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('personal_information.email_address')}</label>
              <input
                type="email"
                value={session?.user?.email || ''}
                disabled
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#9BA1A6] opacity-60 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('personal_information.language')}</label>
              <select
                value={formData.language}
                onChange={e => setFormData({ ...formData, language: e.target.value })}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F4F5F6] focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] outline-none transition-all"
              >
                <option value="en">English</option>
                <option value="de">German (Deutsch)</option>
                <option value="fr">French (Français)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('personal_information.timezone')}</label>
              <select
                value={formData.timezone}
                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F4F5F6] focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] outline-none transition-all"
              >
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                <option value="Europe/Helsinki">Europe/Helsinki (EET/EEST)</option>
                <option value="Europe/Athens">Europe/Athens (EET/EEST)</option>
                <option value="Europe/Bucharest">Europe/Bucharest (EET/EEST)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="America/Denver">America/Denver (MST/MDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Personal Notification Overrides */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated overflow-hidden">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Bell className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('notification_preferences.title')}</h2>
          </div>

          <p className="text-sm text-[#9BA1A6] mb-6">
            {t('notification_preferences.description')}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider">{t('notification_preferences.event_type')}</th>
                  <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider text-center w-24">{t('notification_preferences.email')}</th>
                  <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider text-center w-24">{t('notification_preferences.slack')}</th>
                  <th className="pb-3 text-[12px] font-bold text-[#6E747A] uppercase tracking-wider text-center w-24">{t('notification_preferences.in_app')}</th>
                </tr>
              </thead>
              <tbody className="text-[14px] text-[#F4F5F6]">
                {NOTIFICATION_GROUPS.map((group, gIdx) => (
                  <React.Fragment key={gIdx}>
                    <tr className="bg-[#08090A]">
                      <td colSpan={4} className="py-2 px-3 text-[11px] font-bold text-[#9BA1A6] uppercase tracking-wider">{group.category}</td>
                    </tr>
                    {group.types.map(nt => (
                      <tr key={nt.key} className="border-b border-white/5 last:border-0 hover:bg-ink-900/5">
                        <td className="py-3 px-3 font-medium text-[#E6E8EA]">{nt.label}</td>
                        {['email', 'slack', 'in_app'].map(channel => (
                          <td key={channel} className="py-3 text-center align-middle">
                            <button
                              onClick={() => handleUserToggle(nt.key, channel)}
                              className={`w-5 h-5 flex items-center justify-center rounded-full mx-auto transition-colors ${isUserMuted(nt.key, channel) ? 'text-red-500 bg-red-500/10' : 'text-sage-500 bg-[#C9A227]/10 hover:bg-[#C9A227]/20'}`}
                              title={isUserMuted(nt.key, channel) ? t('notification_preferences.unmute') : t('notification_preferences.mute')}
                            >
                              {isUserMuted(nt.key, channel) ? <Bell className="w-3 h-3 line-through" /> : <Bell className="w-3 h-3" />}
                            </button>
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
  );
}
