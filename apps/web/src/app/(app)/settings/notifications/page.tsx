"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, Save } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';

export const NOTIFICATION_GROUPS = [
  {
    category: 'DSARs',
    types: [
      { key: 'dsar.received', label: 'New DSAR received' },
      { key: 'dsar.deadline_warning_7d', label: 'DSAR deadline warning (7d)' },
      { key: 'dsar.deadline_warning_3d', label: 'DSAR deadline warning (3d)' },
      { key: 'dsar.overdue', label: 'DSAR overdue' },
      { key: 'dsar.reply_received', label: 'DSAR subject reply received' },
    ]
  },
  {
    category: 'Breaches',
    types: [
      { key: 'breach.reported', label: 'New breach reported' },
      { key: 'breach.deadline_48h', label: 'Breach notification deadline (48h)' },
      { key: 'breach.deadline_12h', label: 'Breach notification deadline (12h)' },
      { key: 'breach.overdue', label: 'Breach overdue' },
    ]
  },
  {
    category: 'Vendors & Compliance',
    types: [
      { key: 'vendor.dpa_expiring_30d', label: 'Vendor DPA expiring (30d)' },
      { key: 'vendor.dpa_expired', label: 'Vendor DPA expired' },
      { key: 'compliance.gap_detected', label: 'Compliance gap detected' },
      { key: 'training.assigned', label: 'Training assigned' },
      { key: 'policy.out_of_sync', label: 'Policy out of sync with ROPA' },
    ]
  }
];

export default function NotificationsSettingsPage() {
  const { data: session } = useSession();
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
      alert('Failed to save settings');
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
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Platform Settings</h1>
          <p className="text-ink-600">Manage integrations and global notification routing.</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saved' && <span className="text-sm text-sage-600 font-medium">Saved</span>}
          <button
            onClick={handleSave}
            disabled={updateOrgMutation.isPending || updateUserMutation.isPending || saveStatus === 'saving'}
            className="flex items-center gap-2 bg-[var(--org-primary,#2c3e38)] text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Col: Integrations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-ink-900/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-900">Slack Integration</h3>
                <p className="text-[12px] text-ink-500">Route alerts to a channel</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[13px] font-medium text-ink-900">Incoming Webhook URL</label>
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={slackUrl}
                onChange={e => setSlackUrl(e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-[14px] disabled:opacity-50"
              />
              <p className="text-[11px] text-ink-500 leading-snug">Create an Incoming Webhook in your Slack workspace settings and paste the URL here to enable Slack notifications.</p>
            </div>
          </div>
        </div>

        {/* Right Col: Routing Matrix */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-ink-900/10 p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-ink-900" />
              <h2 className="text-lg font-medium text-ink-900">Notification Routing</h2>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 text-sm text-blue-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p><strong>Admin Note:</strong> The checkboxes control the organization-wide defaults. Individual team members can click the bell icon next to a channel to mute it for themselves personally.</p>
              </div>
            </div>

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
                            <td key={channel} className="py-3 text-center align-middle relative group">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={isOrgChannelActive(nt.key, channel)}
                                  onChange={() => handleOrgToggle(nt.key, channel)}
                                  disabled={!isEditable}
                                  className="rounded border-ink-900/20 text-sage-600 focus:ring-sage-600 w-4 h-4 cursor-pointer disabled:opacity-50"
                                  title="Organization Default"
                                />
                                {isOrgChannelActive(nt.key, channel) && (
                                  <button
                                    onClick={() => handleUserToggle(nt.key, channel)}
                                    className={`w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isUserMuted(nt.key, channel) ? 'opacity-100 text-red-500 bg-red-50' : 'text-ink-400 hover:bg-ink-900/10'}`}
                                    title={isUserMuted(nt.key, channel) ? "Unmute for me" : "Mute for me"}
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
