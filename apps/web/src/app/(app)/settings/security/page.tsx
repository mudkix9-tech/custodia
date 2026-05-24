"use client";

import { useState, useEffect } from 'react';
import { Shield, Key, Smartphone, Monitor } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/utils/trpc';
import { format } from 'date-fns';

export default function SecuritySettingsPage() {
  const { data: session } = useSession();

  const { data: activeSessions, refetch: refetchSessions } = trpc.security.listSessions.useQuery();
  const { data: userSettings, refetch: refetchUser } = trpc.settings.getUserSettings.useQuery();

  const changePassword = trpc.security.changePassword.useMutation();
  const revokeSession = trpc.security.revokeSession.useMutation();
  const revokeAllSessions = trpc.security.revokeAllSessions.useMutation();

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
    if (confirm("Are you sure you want to revoke all other sessions?")) {
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
      if (confirm('Are you sure you want to disable MFA? This decreases account security.')) {
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
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Security</h1>
          <p className="text-ink-600">Manage your password, MFA, and active sessions.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Password */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Key className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Current Password</label>
              <input
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
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
              {passwordStatus === 'saved' && <span className="text-sm text-sage-600">Password updated successfully</span>}
              {passwordStatus === 'error' && <span className="text-sm text-red-600">{passwordError}</span>}
            </div>
          </form>
        </div>

        {/* Multi-factor Authentication */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Smartphone className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Multi-factor Authentication (MFA)</h2>
          </div>

          <div className="flex items-center justify-between p-4 bg-bone-50 rounded-lg border border-ink-900/10 mb-4">
            <div>
              <p className="font-medium text-ink-900 text-sm">Authenticator App</p>
              <p className="text-sm text-ink-500 mt-1">
                 {mfaEnabled ? 'Enabled' : mfaState === 'enabling' || mfaState === 'verifying' ? 'Setup in progress...' : 'Not configured'}
              </p>
            </div>
            {mfaEnabled ? (
                <button
                  onClick={handleDisableMfa}
                  className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 shadow-sm"
                >
                  Disable MFA
                </button>
            ) : (
                <button
                  onClick={handleEnableMfaClick}
                  disabled={mfaState !== 'idle'}
                  className="bg-white border border-ink-900/20 text-ink-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-bone-100 shadow-sm disabled:opacity-50"
                >
                  Enable MFA
                </button>
            )}
          </div>

          {mfaState === 'verifying' && (
              <div className="p-4 border border-ink-900/10 rounded-lg space-y-4">
                  <p className="text-sm text-ink-600">Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy, 1Password).</p>
                  {mfaData.qrCodeUrl && (
                      <div className="bg-white p-2 border border-ink-900/10 inline-block rounded-lg">
                          <img src={mfaData.qrCodeUrl} alt="MFA QR Code" width={150} height={150} />
                      </div>
                  )}
                  <p className="text-xs text-ink-500 font-mono bg-bone-50 p-2 rounded inline-block">Secret: {mfaData.secret}</p>

                  <div className="flex gap-2 max-w-sm mt-4">
                      <input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={mfaToken}
                          onChange={(e) => setMfaToken(e.target.value)}
                          maxLength={6}
                          className="flex-1 bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                          onClick={handleVerifyMfa}
                          className="bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                          Verify
                      </button>
                  </div>
                  {mfaError && <p className="text-sm text-red-600">{mfaError}</p>}
              </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Monitor className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Active Sessions</h2>
          </div>

          <div className="space-y-4">
            {activeSessions?.length === 0 && (
              <p className="text-sm text-ink-500">No active sessions found.</p>
            )}

            {activeSessions?.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 bg-bone-50 rounded-lg border border-ink-900/10">
                <div className="flex items-center gap-4">
                  <Monitor className="w-8 h-8 text-ink-400" />
                  <div>
                    <p className="font-medium text-ink-900 text-sm flex items-center gap-2">
                      {session.device || 'Unknown Device'} • {session.browser || 'Unknown Browser'}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      {session.ipAddress || 'Unknown IP'} • Last active {session.lastActiveAt ? format(new Date(session.lastActiveAt), 'MMM d, h:mm a') : 'Unknown'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(session.id)}
                  className="text-xs font-medium text-ink-500 hover:text-red-600 bg-white border border-ink-900/10 px-3 py-1.5 rounded shadow-sm hover:border-red-200"
                >
                  Revoke
                </button>
              </div>
            ))}

            {activeSessions && activeSessions.length > 0 && (
              <button
                onClick={handleRevokeAll}
                className="text-sm font-medium text-red-600 hover:text-red-700 mt-4 block"
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
