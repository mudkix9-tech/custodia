"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import React, { useState, useEffect } from "react";

import { User, Bell, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { NOTIFICATION_GROUPS } from '../notifications/page';
import { SettingsPage, SettingsHeader } from '@/components/settings/SettingsPage';
import { SettingsCard, SettingsCardHeader, SettingsField } from '@/components/settings/SettingsCard';

export default function ProfileSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.profile');
  const tNotifications = useTranslations('settings.notifications');
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
    <SettingsPage>
      <SettingsHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {saveStatus === 'saved' && (
              <span className="text-[12.5px] font-medium text-set-gold">{t('saved')}</span>
            )}
            <Button onClick={handleSave} disabled={saveStatus === 'saving'} className="gap-2">
              <Save className="w-4 h-4" /> {saveStatus === 'saving' ? t('saving') : t('save_changes')}
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {/* Personal Info */}
        <SettingsCard className="rise-in">
          <SettingsCardHeader icon={User} title={t('personal_information.title')} />

          <div className="grid max-w-2xl grid-cols-1 gap-5 px-[22px] pb-[22px] md:grid-cols-2">
            <SettingsField label={t('personal_information.full_name')}>
              <Input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </SettingsField>
            <SettingsField label={t('personal_information.email_address')}>
              <Input
                type="email"
                value={session?.user?.email || ''}
                disabled
              />
            </SettingsField>
            <SettingsField label={t('personal_information.language')}>
              <Select
                value={formData.language}
                onValueChange={v => setFormData({ ...formData, language: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">German (Deutsch)</SelectItem>
                  <SelectItem value="fr">French (Français)</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>
            <SettingsField label={t('personal_information.timezone')}>
              <Select
                value={formData.timezone}
                onValueChange={v => setFormData({ ...formData, timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                  <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                  <SelectItem value="Europe/Helsinki">Europe/Helsinki (EET/EEST)</SelectItem>
                  <SelectItem value="Europe/Athens">Europe/Athens (EET/EEST)</SelectItem>
                  <SelectItem value="Europe/Bucharest">Europe/Bucharest (EET/EEST)</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                  <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                  <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                  <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>
          </div>
        </SettingsCard>

        {/* Personal Notification Overrides */}
        <SettingsCard className="overflow-hidden">
          <SettingsCardHeader
            icon={Bell}
            title={t('notification_preferences.title')}
            description={t('notification_preferences.description')}
          />

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-set-line-rail">
                  <th className="set-eyebrow px-[22px] pb-2.5 tracking-[0.14em]">{t('notification_preferences.event_type')}</th>
                  <th className="set-eyebrow w-24 pb-2.5 text-center tracking-[0.14em]">{t('notification_preferences.email')}</th>
                  <th className="set-eyebrow w-24 pb-2.5 text-center tracking-[0.14em]">{t('notification_preferences.slack')}</th>
                  <th className="set-eyebrow w-24 pb-2.5 text-center tracking-[0.14em]">{t('notification_preferences.in_app')}</th>
                </tr>
              </thead>
              <tbody className="text-[13.5px] text-set-fg">
                {NOTIFICATION_GROUPS.map((group, gIdx) => (
                  <React.Fragment key={gIdx}>
                    <tr className="bg-set-sunken">
                      <td colSpan={4} className="set-eyebrow px-[22px] py-2 tracking-[0.14em]">{tNotifications(`events.${group.categoryKey}` as any)}</td>
                    </tr>
                    {group.types.map(nt => (
                      <tr key={nt.key} className="border-b border-set-line-soft transition-colors last:border-0 hover:bg-set-row-hover">
                        <td className="px-[22px] py-3 font-medium text-set-fg">{tNotifications(`events.${nt.key}` as any)}</td>
                        {['email', 'slack', 'in_app'].map(channel => (
                          <td key={channel} className="py-3 text-center align-middle">
                            <Button
                              variant="ghost"
                              onClick={() => handleUserToggle(nt.key, channel)}
                              className={`mx-auto h-6 w-6 rounded-full p-0 transition-colors ${isUserMuted(nt.key, channel) ? 'bg-set-danger/12 text-set-danger hover:bg-set-danger/20' : 'bg-set-gold/12 text-set-gold hover:bg-set-gold/20'}`}
                              title={isUserMuted(nt.key, channel) ? t('notification_preferences.unmute') : t('notification_preferences.mute')}
                            >
                              {isUserMuted(nt.key, channel) ? <Bell className="h-3 w-3 line-through" /> : <Bell className="h-3 w-3" />}
                            </Button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>

      </div>
    </SettingsPage>
  );
}
