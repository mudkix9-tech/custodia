// @ts-nocheck
"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';


import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Users, MoreVertical, Shield, UserPlus, Mail, ShieldAlert, Plus } from 'lucide-react';
import { format } from 'date-fns';

const MODULES = ['ROPA', 'Vendors', 'DSARs', 'Breaches', 'Training', 'Billing', 'Users'];
const ACTIONS = ['View', 'Edit', 'Manage'];

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.team');
  const userRole = (session?.user as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.role || 'member';
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const isOwner = userRole === 'owner';

  const { data: team, isLoading, refetch } = trpc.team.list.useQuery();
  const updateRole = trpc.team.updateRole.useMutation();
  const updatePermissions = trpc.team.updatePermissions.useMutation();
  const removeMember = trpc.team.remove.useMutation();
  const { confirm, dialog } = useConfirm();
  const inviteMember = trpc.team.bulkInvite.useMutation(); // using bulk invite for single and multiple

  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteError, setInviteError] = useState('');
  const [isBulk, setIsBulk] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */ | null>(null);

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
    try {
      await updateRole.mutateAsync({ userId, role: newRole });
      refetch();
    } catch (e) {
      console.error(e);
      alert('Failed to update role');
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    const confirmed = await confirm({
      title: `Remove ${name}?`,
      description: `Are you sure you want to remove ${name} from the organization? They will lose access immediately.`,
      variant: 'destructive',
      confirmText: 'Remove',
    });
    if (confirmed) {
      try {
        await removeMember.mutateAsync({ userId });
        refetch();
      } catch (e) {
        console.error(e);
        alert('Failed to remove member');
      }
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatus('sending');
    setInviteError('');
    try {
      const emails = isBulk ? inviteEmails.split('\n').map(e => e.trim()).filter(e => e) : [inviteEmails];
      await inviteMember.mutateAsync({ emails, role: inviteRole });
      setInviteStatus('sent');
      setInviteEmails('');
      refetch();
      setTimeout(() => setInviteStatus('idle'), 3000);
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setInviteStatus('error');
      setInviteError(e.message || 'Failed to send invite');
    }
  };

  const handlePermissionChange = async (module: string, action: string, state: 'inherit' | 'allow' | 'deny') => {
    if (!selectedUser) return;

    // In a real app we'd construct a proper permission object mapping
    // This is simplified to show the concept
    const permString = `${module}:${action}:${state}`;
    const newPerms = [...(selectedUser.permissions || []).filter((p: string) => !p.startsWith(`${module}:${action}`)), permString];

    setSelectedUser({ ...selectedUser, permissions: newPerms });

    try {
      await updatePermissions.mutateAsync({ userId: selectedUser.id, permissions: newPerms });
      refetch();
    } catch (e) {
      console.error(e);
      alert('Failed to update permissions');
    }
  };

  if (isLoading) return <GenericWorkspaceSkeleton />;

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-8 flex relative">
        <div className={`flex-1 space-y-8 transition-all ${selectedUser ? 'mr-[400px]' : ''}`}>
          {isAdmin && (
            <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-[#F4F5F6] flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> {t('invite.title')}
                </h2>
                <button
                  type="button"
                  onClick={() => { setIsBulk(!isBulk); setInviteEmails(''); }}
                  className="text-sm text-[#C9A227] hover:text-[#C9A227] font-medium"
                >
                  {isBulk ? t('invite.single_invite') : t('invite.bulk_invite')}
                </button>
              </div>

              <form onSubmit={handleInvite} className={`flex gap-4 ${isBulk ? 'flex-col' : 'items-end'}`}>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{isBulk ? t('invite.email_bulk') : t('invite.email_single')}</label>
                  {isBulk ? (
                    <textarea
                      required
                      value={inviteEmails}
                      onChange={e => setInviteEmails(e.target.value)}
                      className="w-full bg-[#08090A] border border-white/10 rounded-lg p-3 text-sm h-32 resize-none"
                      placeholder={t('invite.email_placeholder_bulk')}
                    />
                  ) : (
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-[#6E747A]" />
                      <input
                        type="email"
                        required
                        value={inviteEmails}
                        onChange={e => setInviteEmails(e.target.value)}
                        className="w-full bg-[#08090A] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm"
                        placeholder={t('invite.email_placeholder_single')}
                      />
                    </div>
                  )}
                </div>
                <div className={`${isBulk ? 'w-full' : 'w-48'}`}>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('invite.role')}</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)}
                    className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="admin">{t('invite.roles.admin')}</option>
                    <option value="member">{t('invite.roles.member')}</option>
                    <option value="viewer">{t('invite.roles.viewer')}</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviteStatus === 'sending'}
                  className={`bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${isBulk ? 'w-full' : 'h-[38px]'}`}
                >
                  {inviteStatus === 'sending' ? t('invite.sending') : t('invite.send')}
                </button>
              </form>
              {inviteStatus === 'sent' && <p className="text-sm text-[#C9A227] mt-2">{t('invite.success')}</p>}
              {inviteStatus === 'error' && <p className="text-sm text-red-400 mt-2">{inviteError}</p>}
            </div>
          )}

          <div className="bg-[#0D0F11] rounded-2xl border border-white/10 overflow-hidden shadow-panel-elevated">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-medium text-[#F4F5F6] flex items-center gap-2">
                <Users className="w-5 h-5" /> {t('members.title')}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#08090A] border-b border-white/10 text-xs font-semibold text-[#6E747A] uppercase tracking-wider">
                    <th className="px-6 py-3">{t('members.columns.name')}</th>
                    <th className="px-6 py-3">{t('members.columns.email')}</th>
                    <th className="px-6 py-3">{t('members.columns.role')}</th>
                    <th className="px-6 py-3">{t('members.columns.joined')}</th>
                    {isAdmin && <th className="px-6 py-3 text-right">{t('members.columns.actions')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/10 text-sm">
                  {team?.map((member) => (
                    <tr key={member.id} className="hover:bg-ink-900/5">
                      <td className="px-6 py-4 font-medium text-[#F4F5F6]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sage-100 text-[#C9A227] flex items-center justify-center font-medium text-xs">
                            {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                          </div>
                          {member.name || t('members.invited_user')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#9BA1A6]">{member.email}</td>
                      <td className="px-6 py-4">
                        {isAdmin && member.id !== (session?.user as { id?: string })?.id ? (
                          <select
                            value={member.customRoleId || member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            className="bg-transparent border border-white/20 rounded text-sm text-[#E6E8EA] focus:ring-sage-500 py-1 pl-2 pr-6 max-w-[120px]"
                            disabled={member.role === 'owner' && !isOwner}
                          >
                            <optgroup label={t('members.roles.basic_roles')}>
                              <option value="owner" disabled>{t('members.roles.owner')}</option>
                              <option value="admin">{t('members.roles.admin')}</option>
                              <option value="member">{t('members.roles.member')}</option>
                              <option value="viewer">{t('members.roles.viewer')}</option>
                            </optgroup>
                            {customRoles && customRoles.length > 0 && (
                              <optgroup label={t('members.roles.custom_roles')}>
                                {customRoles.map((cr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
                                  <option key={cr.id} value={cr.id}>{cr.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-ink-100 text-[#E6E8EA] capitalize">
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#6E747A]">
                        {member.invitedAt && !member.emailVerified ? (
                          <span className="text-clay-600 italic">Invited {format(new Date(member.invitedAt), 'MMM d, yyyy')}</span>
                        ) : member.createdAt ? (
                          format(new Date(member.createdAt), 'MMM d, yyyy')
                        ) : t('members.unknown')}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedUser(selectedUser?.id === member.id ? null : member)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${selectedUser?.id === member.id ? 'bg-sage-100 text-[#C9A227]' : 'bg-[#0D0F11] border border-white/10 text-[#9BA1A6] hover:bg-ink-900/5'}`}
                            >
                              {t('members.permissions')}
                            </button>
                            {member.id !== (session?.user as { id?: string })?.id && member.role !== 'owner' && (
                              <button
                                onClick={() => handleRemove(member.id, member.name || member.email)}
                                className="text-xs font-medium text-red-400 hover:bg-red-500/10 bg-[#0D0F11] border border-red-900/50 px-3 py-1.5 rounded-md transition-colors"
                              >
                                {t('members.remove')}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {team?.length === 0 && (
                <div className="p-8 text-center text-[#6E747A]">{t('members.no_members')}</div>
              )}
            </div>
          </div>

          {/* Pending Invitations Section */}
          <div className="bg-[#0D0F11] rounded-2xl border border-white/10 overflow-hidden shadow-panel-elevated mt-8">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-medium text-[#F4F5F6] flex items-center gap-2">
                <Mail className="w-5 h-5" /> {t('pending.title')}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-ink-900/10 text-sm">
                  {team?.filter(m => m.invitedAt && !m.emailVerified).map(member => (
                    <tr key={`invite-${member.id}`} className="hover:bg-ink-900/5">
                      <td className="px-6 py-4 font-medium text-[#F4F5F6]">{member.email}</td>
                      <td className="px-6 py-4 capitalize text-[#9BA1A6]">{member.role}</td>
                      <td className="px-6 py-4 text-[#6E747A] text-right">
                        <button className="text-xs font-medium bg-[#0D0F11] border border-white/10 text-[#9BA1A6] hover:bg-ink-900/5 px-3 py-1.5 rounded-md mr-2">{t('pending.resend')}</button>
                        <button onClick={() => handleRemove(member.id, member.email)} className="text-xs font-medium text-red-400 hover:bg-red-500/10 bg-[#0D0F11] border border-red-900/50 px-3 py-1.5 rounded-md">{t('pending.cancel')}</button>
                      </td>
                    </tr>
                  ))}
                  {team?.filter(m => m.invitedAt && !m.emailVerified).length === 0 && (
                     <tr className="hover:bg-ink-900/5">
                       <td colSpan={3} className="px-6 py-4 text-[#6E747A] text-center">{t('pending.no_pending')}</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Slide-over Panel for Granular Permissions */}
        {selectedUser && (
          <div className="w-[380px] fixed top-[73px] bottom-0 right-0 bg-[#0D0F11] border-l border-white/10 shadow-panel-elevated z-30 overflow-y-auto">
            <div className="p-6 border-b border-white/10 sticky top-0 bg-[#0D0F11] z-10 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-[#F4F5F6]">{t('permissions.title')}</h3>
                <p className="text-sm text-[#6E747A] mt-1">{selectedUser.name}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-[#6E747A] hover:text-[#F4F5F6] bg-ink-900/5 hover:bg-ink-900/10 p-2 rounded-full transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="p-6">
              {selectedUser.role === 'owner' ? (
                <div className="bg-amber-500/10 text-amber-800 p-4 rounded-lg text-sm border border-amber-900/50">
                  <ShieldAlert className="w-5 h-5 mb-2" />
                  {t('permissions.owner_warning')}
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-[#9BA1A6] mb-4">
                    {t('permissions.description')}
                  </p>

                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="pb-2 font-medium text-[#6E747A] uppercase tracking-wider text-xs">{t('permissions.module')}</th>
                        {ACTIONS.map(a => (
                          <th key={a} className="pb-2 font-medium text-[#6E747A] uppercase tracking-wider text-xs text-center">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-900/5">
                      {MODULES.map(module => (
                        <tr key={module}>
                          <td className="py-3 font-medium text-[#F4F5F6]">{module}</td>
                          {ACTIONS.map(action => {
                            const permState = (selectedUser.permissions || []).find((p: string) => p.startsWith(`${module}:${action}:`));
                            const state = permState ? permState.split(':')[2] : 'inherit';

                            return (
                              <td key={`${module}-${action}`} className="py-3 text-center">
                                <button
                                  onClick={() => handlePermissionChange(module, action, state === 'inherit' ? 'allow' : state === 'allow' ? 'deny' : 'inherit')}
                                  className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors ${
                                    state === 'allow' ? 'bg-sage-100 text-[#C9A227]' :
                                    state === 'deny' ? 'bg-red-500/20 text-red-400' :
                                    'bg-white/5 text-white/20 hover:bg-white/10'
                                  }`}
                                >
                                  {state === 'allow' ? '✓' : state === 'deny' ? '×' : '-'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="pt-4 border-t border-white/10 text-xs text-[#6E747A]">
                    {t('permissions.footer')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
