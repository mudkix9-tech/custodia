"use client";
import React, { useState, useEffect } from "react";

import { User, Bell, Save } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/utils/trpc';
import { NOTIFICATION_GROUPS } from '../notifications/page';

export default function ProfileSettingsPage() {
  const { data: session } = useSession();
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

  if (isLoading) return <div className="p-8">Loading profile...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">My Profile</h1>
          <p className="text-ink-600">Manage your personal settings and notification preferences.</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saved' && <span className="text-sm text-sage-600 font-medium">Saved</span>}
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 bg-ink-900 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Personal Info */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <User className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Email Address</label>
              <input
                type="email"
                value={session?.user?.email || ''}
                disabled
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Language</label>
              <select
                value={formData.language}
                onChange={e => setFormData({ ...formData, language: e.target.value })}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="de">German (Deutsch)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Timezone</label>
              <select
                value={formData.timezone}
                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="UTC">UTC</option>
                <option value="Europe/Berlin">Central European Time (CET/CEST)</option>
                <option value="Europe/London">Greenwich Mean Time (GMT/BST)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Personal Notification Overrides */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Bell className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">My Notification Preferences</h2>
          </div>

          <p className="text-sm text-ink-600 mb-6">
            Mute specific notifications that you don't want to receive. If unchecked, the organization default routing will be used.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-ink-900/10">
                  <th className="pb-3 text-[12px] font-bold text-ink-500 uppercase tracking-wider">Event Type</th>
                  <th className="pb-3 text-[12px] font-bold text-ink-500 uppercase tracking-wider text-center w-24">Email</th>
                  <th className="pb-3 text-[12px] font-bold text-ink-500 uppercase tracking-wider text-center w-24">Slack</th>
                  <th className="pb-3 text-[12px] font-bold text-ink-500 uppercase tracking-wider text-center w-24">In-App</th>
                </tr>
              </thead>
              <tbody className="text-[14px] text-ink-900">
                {NOTIFICATION_GROUPS.map((group, gIdx) => (
                  <React.Fragment key={gIdx}>
                    <tr className="bg-bone-50">
                      <td colSpan={4} className="py-2 px-3 text-[11px] font-bold text-ink-600 uppercase tracking-wider">{group.category}</td>
                    </tr>
                    {group.types.map(nt => (
                      <tr key={nt.key} className="border-b border-ink-900/5 last:border-0 hover:bg-ink-900/5">
                        <td className="py-3 px-3 font-medium text-ink-700">{nt.label}</td>
                        {['email', 'slack', 'in_app'].map(channel => (
                          <td key={channel} className="py-3 text-center align-middle">
                            <button
                              onClick={() => handleUserToggle(nt.key, channel)}
                              className={`w-5 h-5 flex items-center justify-center rounded-full mx-auto transition-colors ${isUserMuted(nt.key, channel) ? 'text-red-500 bg-red-50' : 'text-sage-500 bg-sage-50 hover:bg-sage-100'}`}
                              title={isUserMuted(nt.key, channel) ? "Unmute for me" : "Mute for me"}
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
