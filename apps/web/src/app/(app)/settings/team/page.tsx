"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Shield, Plus, Users, Mail, Loader2, MoreVertical, ShieldAlert } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const { data: teamMembers, isLoading, refetch } = trpc.team.list.useQuery();
  const inviteMutation = trpc.team.invite.useMutation();
  const updateRoleMutation = trpc.team.updateRole.useMutation();
  const removeMutation = trpc.team.remove.useMutation();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', name: '', role: 'member' as any });

  const isOwnerOrAdmin = (session?.user as any)?.role === 'owner' || (session?.user as any)?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteMutation.mutateAsync(inviteData);
      setInviteData({ email: '', name: '', role: 'member' });
      setIsInviteOpen(false);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Failed to invite user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: any) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      refetch();
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    try {
      await removeMutation.mutateAsync({ userId });
      refetch();
    } catch (error: any) {
      alert(error.message || 'Failed to remove user');
    }
  };

  return (
    <div className="flex-1 p-8 bg-bone-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-ink-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-card border border-ink-900/8">
                <Users className="w-5 h-5 text-sage-600" />
              </div>
              Team Management
            </h1>
            <p className="text-[13.5px] text-ink-500 mt-2">
              Manage your agency team members, roles, and access permissions.
            </p>
          </div>
          
          {isOwnerOrAdmin && (
            <button 
              onClick={() => setIsInviteOpen(true)}
              className="px-4 py-2 bg-sage-700 hover:bg-sage-600 text-bone-50 font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 shadow-card"
            >
              <Plus className="w-4 h-4" />
              Invite Member
            </button>
          )}
        </div>

        {/* Invite Modal */}
        {isInviteOpen && (
          <div className="bg-white hairline rounded-2xl p-6 shadow-sm fade-up border-l-4 border-l-sage-500">
            <h2 className="text-[15px] font-medium text-ink-900 mb-4">Invite New Team Member</h2>
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[12px] font-medium text-ink-700">Name</label>
                <input 
                  required
                  value={inviteData.name}
                  onChange={e => setInviteData({...inviteData, name: e.target.value})}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13px] text-ink-900" 
                  placeholder="Jane Doe" 
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[12px] font-medium text-ink-700">Email Address</label>
                <input 
                  type="email" required
                  value={inviteData.email}
                  onChange={e => setInviteData({...inviteData, email: e.target.value})}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13px] text-ink-900" 
                  placeholder="jane@agency.com" 
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[12px] font-medium text-ink-700">Role</label>
                <select 
                  value={inviteData.role}
                  onChange={e => setInviteData({...inviteData, role: e.target.value as any})}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13px] text-ink-900"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex gap-2">
                <button type="submit" disabled={inviteMutation.isPending} className="flex-1 py-2 bg-sage-700 text-bone-50 text-[13px] font-medium rounded-lg hover:bg-sage-600 transition-colors">
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                </button>
                <button type="button" onClick={() => setIsInviteOpen(false)} className="px-4 py-2 bg-bone-100 text-ink-700 text-[13px] font-medium rounded-lg hover:bg-bone-200 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team List */}
        <div className="bg-white hairline rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-sage-600" /></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-ink-900/10 bg-bone-50/50">
                  <th className="px-6 py-4 text-[12px] font-medium text-ink-500 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-[12px] font-medium text-ink-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-[12px] font-medium text-ink-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-medium text-ink-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/10">
                {teamMembers?.map((member) => (
                  <tr key={member.id} className="hover:bg-bone-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-bone-100 text-ink-700 flex items-center justify-center font-medium text-[13px]">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-medium text-ink-900">{member.name}</div>
                          <div className="text-[12px] text-ink-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isOwnerOrAdmin && member.role !== 'owner' ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="bg-bone-50 hairline rounded-md px-2 py-1 text-[12.5px] text-ink-700 focus:outline-none focus:ring-1 focus:ring-sage-500/20"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium ${
                          member.role === 'owner' ? 'bg-amber-50 text-amber-700' :
                          member.role === 'admin' ? 'bg-sage-50 text-sage-700' :
                          'bg-bone-100 text-ink-600'
                        }`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[12px] text-ink-500 flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${member.lastLoginAt ? 'bg-sage-500' : 'bg-amber-400'}`} />
                        {member.lastLoginAt ? 'Active' : 'Invited'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isOwnerOrAdmin && member.id !== session?.user?.id && member.role !== 'owner' && (
                        <button 
                          onClick={() => handleRemove(member.id)}
                          className="text-[12px] font-medium text-clay-600 hover:bg-clay-50 px-3 py-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-500/20 rounded-xl p-4 flex gap-3 mt-6">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-[13px] text-amber-800 leading-relaxed">
            <strong>Role Permissions:</strong> Owners and Admins have full access to billing, team management, and all ROPA features. Members can view and edit ROPAs. Viewers have read-only access.
          </div>
        </div>

      </div>
    </div>
  );
}
