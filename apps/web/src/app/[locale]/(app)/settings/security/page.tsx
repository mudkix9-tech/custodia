// @ts-nocheck
"use client";

import { useState, useEffect } from 'react';

import { useSession } from 'next-auth/react';
import { trpc } from '@/utils/trpc';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Shield, Key, Smartphone, Monitor, Clock, LogOut, CheckCircle2 } from 'lucide-react';

import { format } from 'date-fns';

export default function SecuritySettingsPage() {
  const { data: session } = useSession();

  const { data: activeSessions, refetch: refetchSessions } = trpc.security.listSessions.useQuery();
  const { data: userSettings, refetch: refetchUser } = trpc.settings.getUserSettings.useQuery();

  const changePassword = trpc.security.changePassword.useMutation();
  const revokeSession = trpc.security.revokeSession.useMutation();
  const revokeAllSessions = trpc.security.revokeAllSessions.useMutation();
  const { confirm, dialog } = useConfirm();

  const enableMfa = trpc.security.enableMfa.useMutation();
  const verifyMfa = trpc.security.verifyMfa.useMutation();
  const disableMfa = trpc.security.disableMfa.useMutation();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState('');

  const [mfaState, setMfaState] = useState<'idle' | 'enabling' | 'verifying'>('idle');
  const [mfaData, setMfaData] = useState<{qrCodeUrl?: string, secret?: string}>({});
  const [mfaToken, setMfaToken] = useState('');
  const [mfaError, setMfaError] = useState('');

  const mfaEnabled = (userSettings as any)?.mfaEnabled;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match");
      setPasswordStatus('error');
      return;
    }

    setPasswordStatus('saving');
    setPasswordError('');

    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordStatus('saved');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordStatus('idle'), 3000);
      refetchSessions();
    } catch (e: any) {
      setPasswordStatus('error');
      setPasswordError(e.message || "Failed to change password");
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeSession.mutateAsync({ sessionId: id });
      refetchSessions();
    } catch (e) {
      console.error(e);
      alert('Failed to revoke session');
    }
  };

  const handleRevokeAll = async () => {
    const confirmed = await confirm({ title: 'Revoke all other sessions?', description: 'This will log out all other devices.', variant: 'destructive', confirmText: 'Revoke All' });
    if (confirmed) {
      try {
        await revokeAllSessions.mutateAsync({});
        refetchSessions();
      } catch (e) {
        console.error(e);
        alert('Failed to revoke sessions');
      }
    }
  };

  const handleEnableMfaClick = async () => {
    setMfaState('enabling');
    try {
        const result = await enableMfa.mutateAsync();
        setMfaData(result);
        setMfaState('verifying');
    } catch (e: any) {
        setMfaError(e.message || 'Failed to initiate MFA');
        setMfaState('idle');
    }
  };

  const handleVerifyMfa = async () => {
    try {
        await verifyMfa.mutateAsync({ token: mfaToken });
        refetchUser();
        setMfaState('idle');
        setMfaToken('');
    } catch (e: any) {
        setMfaError(e.message || 'Invalid token');
    }
  };

  const handleDisableMfa = async () => {
    const confirmed = await confirm({ title: 'Disable MFA?', description: 'Are you sure you want to disable MFA? This decreases account security.', variant: 'destructive', confirmText: 'Disable' });
    if (confirmed) {
        try {
            await disableMfa.mutateAsync();
            refetchUser();
        } catch(e: any) {
            alert(e.message || 'Failed to disable MFA');
        }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">Security</h1>
          <p className="text-[#9BA1A6]">Manage your password, MFA, and active sessions.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Password */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Key className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Current Password</label>
              <input
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="pt-2 flex items-center gap-4">
              <button
                type="submit"
                disabled={passwordStatus === 'saving'}
                className="bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50"
              >
                {passwordStatus === 'saving' ? 'Updating...' : 'Update Password'}
              </button>
              {passwordStatus === 'saved' && <span className="text-sm text-[#C9A227]">Password updated successfully</span>}
              {passwordStatus === 'error' && <span className="text-sm text-red-400">{passwordError}</span>}
            </div>
          </form>
        </div>

        {/* Multi-factor Authentication */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Smartphone className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">Multi-factor Authentication (MFA)</h2>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#08090A] rounded-lg border border-white/10 mb-4">
            <div>
              <p className="font-medium text-[#F4F5F6] text-sm">Authenticator App</p>
              <p className="text-sm text-[#6E747A] mt-1">
                 {mfaEnabled ? 'Enabled' : mfaState === 'enabling' || mfaState === 'verifying' ? 'Setup in progress...' : 'Not configured'}
              </p>
            </div>
            {mfaEnabled ? (
                <button
                  onClick={handleDisableMfa}
                  className="bg-[#0D0F11] border border-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/10 shadow-panel-elevated"
                >
                  Disable MFA
                </button>
            ) : (
                <button
                  onClick={handleEnableMfaClick}
                  disabled={mfaState !== 'idle'}
                  className="bg-[#0D0F11] border border-white/20 text-[#F4F5F6] px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 shadow-panel-elevated disabled:opacity-50"
                >
                  Enable MFA
                </button>
            )}
          </div>

          {mfaState === 'verifying' && (
              <div className="p-4 border border-white/10 rounded-lg space-y-4">
                  <p className="text-sm text-[#9BA1A6]">Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy, 1Password).</p>
                  {mfaData.qrCodeUrl && (
                      <div className="bg-[#0D0F11] p-2 border border-white/10 inline-block rounded-lg">
                          <img src={mfaData.qrCodeUrl} alt="MFA QR Code" width={150} height={150} />
                      </div>
                  )}
                  <p className="text-xs text-[#6E747A] font-mono bg-[#08090A] p-2 rounded inline-block">Secret: {mfaData.secret}</p>

                  <div className="flex gap-2 max-w-sm mt-4">
                      <input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={mfaToken}
                          onChange={(e) => setMfaToken(e.target.value)}
                          maxLength={6}
                          className="flex-1 bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                          onClick={handleVerifyMfa}
                          className="bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                          Verify
                      </button>
                  </div>
                  {mfaError && <p className="text-sm text-red-400">{mfaError}</p>}
              </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Monitor className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">Active Sessions</h2>
          </div>

          <div className="space-y-4">
            {activeSessions?.length === 0 && (
              <p className="text-sm text-[#6E747A]">No active sessions found.</p>
            )}

            {activeSessions?.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 bg-[#08090A] rounded-lg border border-white/10">
                <div className="flex items-center gap-4">
                  <Monitor className="w-8 h-8 text-[#6E747A]" />
                  <div>
                    <p className="font-medium text-[#F4F5F6] text-sm flex items-center gap-2">
                      {session.device || 'Unknown Device'} • {session.browser || 'Unknown Browser'}
                    </p>
                    <p className="text-xs text-[#6E747A] mt-1">
                      {session.ipAddress || 'Unknown IP'} • Last active {session.lastActiveAt ? format(new Date(session.lastActiveAt), 'MMM d, h:mm a') : 'Unknown'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(session.id)}
                  className="text-xs font-medium text-[#6E747A] hover:text-red-400 bg-[#0D0F11] border border-white/10 px-3 py-1.5 rounded shadow-panel-elevated hover:border-red-900/50"
                >
                  Revoke
                </button>
              </div>
            ))}

            {activeSessions && activeSessions.length > 0 && (
              <button
                onClick={handleRevokeAll}
                className="text-sm font-medium text-red-400 hover:text-red-400 mt-4 block"
              >
                Revoke all other sessions
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
