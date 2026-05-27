"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';


import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { Users, MoreVertical, Shield, UserPlus, Mail, ShieldAlert, Loader2, Plus, Settings } from 'lucide-react';
import { format } from 'date-fns';

const MODULES = ['ROPA', 'Vendors', 'DSARs', 'Breaches', 'Training', 'Billing', 'Users'];
const ACTIONS = ['View', 'Edit', 'Manage'];

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'member';
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

  const [selectedUser, setSelectedUser] = useState<any | null>(null);

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
    } catch (e: any) {
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
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Team Management</h1>
          <p className="text-ink-600">Manage organization members, roles, and granular access permissions.</p>
        </div>
      </div>

      <div className="space-y-8 flex relative">
        <div className={`flex-1 space-y-8 transition-all ${selectedUser ? 'mr-[400px]' : ''}`}>
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-ink-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Invite New Members
                </h2>
                <button
                  type="button"
                  onClick={() => { setIsBulk(!isBulk); setInviteEmails(''); }}
                  className="text-sm text-sage-600 hover:text-sage-700 font-medium"
                >
                  {isBulk ? 'Single invite' : 'Bulk invite'}
                </button>
              </div>

              <form onSubmit={handleInvite} className={`flex gap-4 ${isBulk ? 'flex-col' : 'items-end'}`}>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-ink-900 mb-1.5">{isBulk ? 'Email Addresses (one per line)' : 'Email Address'}</label>
                  {isBulk ? (
                    <textarea
                      required
                      value={inviteEmails}
                      onChange={e => setInviteEmails(e.target.value)}
                      className="w-full bg-bone-50 border border-ink-900/10 rounded-lg p-3 text-sm h-32 resize-none"
                      placeholder="colleague1@example.com&#10;colleague2@example.com"
                    />
                  ) : (
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-ink-400" />
                      <input
                        type="email"
                        required
                        value={inviteEmails}
                        onChange={e => setInviteEmails(e.target.value)}
                        className="w-full bg-bone-50 border border-ink-900/10 rounded-lg pl-9 pr-3 py-2 text-sm"
                        placeholder="colleague@example.com"
                      />
                    </div>
                  )}
                </div>
                <div className={`${isBulk ? 'w-full' : 'w-48'}`}>
                  <label className="block text-sm font-medium text-ink-900 mb-1.5">Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviteStatus === 'sending'}
                  className={`bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${isBulk ? 'w-full' : 'h-[38px]'}`}
                >
                  {inviteStatus === 'sending' ? 'Sending...' : 'Send Invitations'}
                </button>
              </form>
              {inviteStatus === 'sent' && <p className="text-sm text-sage-600 mt-2">Invitations sent successfully!</p>}
              {inviteStatus === 'error' && <p className="text-sm text-red-600 mt-2">{inviteError}</p>}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-ink-900/10">
              <h2 className="text-lg font-medium text-ink-900 flex items-center gap-2">
                <Users className="w-5 h-5" /> Current Members
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bone-50 border-b border-ink-900/10 text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Joined</th>
                    {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/10 text-sm">
                  {team?.map((member) => (
                    <tr key={member.id} className="hover:bg-ink-900/5">
                      <td className="px-6 py-4 font-medium text-ink-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center font-medium text-xs">
                            {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                          </div>
                          {member.name || 'Invited User'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-ink-600">{member.email}</td>
                      <td className="px-6 py-4">
                        {isAdmin && member.id !== (session?.user as any)?.id ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value as any)}
                            className="bg-transparent border border-ink-900/20 rounded text-sm text-ink-700 focus:ring-sage-500 py-1 pl-2 pr-6"
                            disabled={member.role === 'owner' && !isOwner}
                          >
                            <option value="owner" disabled>Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-ink-100 text-ink-800 capitalize">
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink-500">
                        {member.invitedAt && !member.emailVerified ? (
                          <span className="text-clay-600 italic">Invited {format(new Date(member.invitedAt), 'MMM d, yyyy')}</span>
                        ) : member.createdAt ? (
                          format(new Date(member.createdAt), 'MMM d, yyyy')
                        ) : 'Unknown'}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedUser(selectedUser?.id === member.id ? null : member)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${selectedUser?.id === member.id ? 'bg-sage-100 text-sage-700' : 'bg-white border border-ink-900/10 text-ink-600 hover:bg-ink-900/5'}`}
                            >
                              Permissions
                            </button>
                            {member.id !== (session?.user as any)?.id && member.role !== 'owner' && (
                              <button
                                onClick={() => handleRemove(member.id, member.name || member.email)}
                                className="text-xs font-medium text-red-600 hover:bg-red-50 bg-white border border-red-200 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Remove
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
                <div className="p-8 text-center text-ink-500">No team members found.</div>
              )}
            </div>
          </div>

          {/* Pending Invitations Section */}
          <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden shadow-sm mt-8">
            <div className="p-6 border-b border-ink-900/10">
              <h2 className="text-lg font-medium text-ink-900 flex items-center gap-2">
                <Mail className="w-5 h-5" /> Pending Invitations
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-ink-900/10 text-sm">
                  {team?.filter(m => m.invitedAt && !m.emailVerified).map(member => (
                    <tr key={`invite-${member.id}`} className="hover:bg-ink-900/5">
                      <td className="px-6 py-4 font-medium text-ink-900">{member.email}</td>
                      <td className="px-6 py-4 capitalize text-ink-600">{member.role}</td>
                      <td className="px-6 py-4 text-ink-500 text-right">
                        <button className="text-xs font-medium bg-white border border-ink-900/10 text-ink-600 hover:bg-ink-900/5 px-3 py-1.5 rounded-md mr-2">Resend</button>
                        <button onClick={() => handleRemove(member.id, member.email)} className="text-xs font-medium text-red-600 hover:bg-red-50 bg-white border border-red-200 px-3 py-1.5 rounded-md">Cancel</button>
                      </td>
                    </tr>
                  ))}
                  {team?.filter(m => m.invitedAt && !m.emailVerified).length === 0 && (
                     <tr className="hover:bg-ink-900/5">
                       <td colSpan={3} className="px-6 py-4 text-ink-500 text-center">No pending invitations.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Slide-over Panel for Granular Permissions */}
        {selectedUser && (
          <div className="w-[380px] fixed top-[73px] bottom-0 right-0 bg-white border-l border-ink-900/10 shadow-xl z-30 overflow-y-auto">
            <div className="p-6 border-b border-ink-900/10 sticky top-0 bg-white z-10 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-ink-900">Edit Permissions</h3>
                <p className="text-sm text-ink-500 mt-1">{selectedUser.name}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-ink-400 hover:text-ink-900 bg-ink-900/5 hover:bg-ink-900/10 p-2 rounded-full transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="p-6">
              {selectedUser.role === 'owner' ? (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-lg text-sm border border-amber-200">
                  <ShieldAlert className="w-5 h-5 mb-2" />
                  Owner permissions cannot be restricted. They have full access to all modules.
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-ink-600 mb-4">
                    Override role-based access for specific modules. Green check grants access, red cross denies, gray dash inherits from role.
                  </p>

                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-900/10">
                        <th className="pb-2 font-medium text-ink-500 uppercase tracking-wider text-xs">Module</th>
                        {ACTIONS.map(a => (
                          <th key={a} className="pb-2 font-medium text-ink-500 uppercase tracking-wider text-xs text-center">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-900/5">
                      {MODULES.map(module => (
                        <tr key={module}>
                          <td className="py-3 font-medium text-ink-900">{module}</td>
                          {ACTIONS.map(action => {
                            const permState = (selectedUser.permissions || []).find((p: string) => p.startsWith(`${module}:${action}:`));
                            const state = permState ? permState.split(':')[2] : 'inherit';

                            return (
                              <td key={`${module}-${action}`} className="py-3 text-center">
                                <button
                                  onClick={() => handlePermissionChange(module, action, state === 'inherit' ? 'allow' : state === 'allow' ? 'deny' : 'inherit')}
                                  className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors ${
                                    state === 'allow' ? 'bg-sage-100 text-sage-600' :
                                    state === 'deny' ? 'bg-red-100 text-red-600' :
                                    'bg-bone-100 text-ink-300 hover:bg-bone-200'
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
                  <div className="pt-4 border-t border-ink-900/10 text-xs text-ink-500">
                    Changes save automatically and will invalidate the user's current session to enforce new permissions.
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
