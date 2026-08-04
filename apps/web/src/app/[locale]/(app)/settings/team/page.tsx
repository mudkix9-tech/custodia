// @ts-nocheck
"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';


import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Users, MoreVertical, Shield, UserPlus, Mail, ShieldAlert, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { setIsBulk(!isBulk); setInviteEmails(''); }}
                  className="text-sm text-[#C9A227] hover:text-[#C9A227] hover:bg-[#C9A227]/10 font-medium"
                >
                  {isBulk ? t('invite.single_invite') : t('invite.bulk_invite')}
                </Button>
              </div>

              <form onSubmit={handleInvite} className={`flex gap-4 ${isBulk ? 'flex-col' : 'items-end'}`}>
                <div className="flex-1">
                  <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{isBulk ? t('invite.email_bulk') : t('invite.email_single')}</Label>
                  {isBulk ? (
                    <textarea
                      required
                      value={inviteEmails}
                      onChange={e => setInviteEmails(e.target.value)}
                      className="w-full bg-[#08090A] border border-white/10 rounded-lg p-3 text-sm h-32 resize-none text-[#F4F5F6] focus:outline-none focus:ring-1 focus:border-[#C9A227] focus:ring-[#C9A227]"
                      placeholder={t('invite.email_placeholder_bulk')}
                    />
                  ) : (
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#6E747A]" />
                      <Input
                        type="email"
                        required
                        value={inviteEmails}
                        onChange={e => setInviteEmails(e.target.value)}
                        className="pl-9"
                        placeholder={t('invite.email_placeholder_single')}
                      />
                    </div>
                  )}
                </div>
                <div className={`${isBulk ? 'w-full' : 'w-48'}`}>
                  <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('invite.role')}</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={v => setInviteRole(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{t('invite.roles.admin')}</SelectItem>
                      <SelectItem value="member">{t('invite.roles.member')}</SelectItem>
                      <SelectItem value="viewer">{t('invite.roles.viewer')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={inviteStatus === 'sending'}
                  className={`${isBulk ? 'w-full' : ''}`}
                >
                  {inviteStatus === 'sending' ? t('invite.sending') : t('invite.send')}
                </Button>
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
                          <Select
                            value={member.customRoleId || member.role}
                            onValueChange={(v) => handleUpdateRole(member.id, v as any)}
                            disabled={member.role === 'owner' && !isOwner}
                          >
                            <SelectTrigger className="w-32 bg-transparent h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <div className="px-2 py-1 text-[11px] font-semibold text-[#6E747A] uppercase">{t('members.roles.basic_roles')}</div>
                                <SelectItem value="owner" disabled>{t('members.roles.owner')}</SelectItem>
                                <SelectItem value="admin">{t('members.roles.admin')}</SelectItem>
                                <SelectItem value="member">{t('members.roles.member')}</SelectItem>
                                <SelectItem value="viewer">{t('members.roles.viewer')}</SelectItem>
                              </SelectGroup>
                              {typeof customRoles !== 'undefined' && customRoles && customRoles.length > 0 && (
                                <SelectGroup>
                                  <div className="px-2 py-1 text-[11px] font-semibold text-[#6E747A] uppercase mt-2">{t('members.roles.custom_roles')}</div>
                                  {customRoles.map((cr: any) => (
                                    <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                            </SelectContent>
                          </Select>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUser(selectedUser?.id === member.id ? null : member)}
                              className={`${selectedUser?.id === member.id ? 'bg-sage-100/20 text-[#C9A227] border-[#C9A227]/50' : ''}`}
                            >
                              {t('members.permissions')}
                            </Button>
                            {member.id !== (session?.user as { id?: string })?.id && member.role !== 'owner' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemove(member.id, member.name || member.email)}
                              >
                                {t('members.remove')}
                              </Button>
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
                        <Button variant="outline" size="sm" className="mr-2">{t('pending.resend')}</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRemove(member.id, member.email)}>{t('pending.cancel')}</Button>
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
              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="text-[#6E747A] hover:text-[#F4F5F6] rounded-full">
                <Plus className="w-5 h-5 rotate-45" />
              </Button>
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handlePermissionChange(module, action, state === 'inherit' ? 'allow' : state === 'allow' ? 'deny' : 'inherit')}
                                  className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors ${
                                    state === 'allow' ? 'bg-sage-100 text-[#C9A227] hover:bg-[#C9A227]/20' :
                                    state === 'deny' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                                    'bg-white/5 text-white/20 hover:bg-white/10'
                                  }`}
                                >
                                  {state === 'allow' ? '✓' : state === 'deny' ? '×' : '-'}
                                </Button>
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
