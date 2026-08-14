"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/utils/trpc';
import { Plus, Save, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const MODULES = ['ropa', 'vendors', 'dsar', 'breaches', 'policies', 'consent', 'training', 'audit', 'clients', 'settings', 'billing', 'developers', 'team'];
const ACTIONS = ['view', 'edit', 'delete', 'manage', 'export', 'respond', 'report', 'notify', 'publish', 'configure', 'invite'];

const MODULE_ACTIONS: Record<string, string[]> = {
  ropa: ['view', 'edit', 'delete', 'export'],
  vendors: ['view', 'edit', 'delete'],
  dsar: ['view', 'manage', 'respond'],
  breaches: ['view', 'report', 'manage', 'notify'],
  policies: ['view', 'edit', 'publish'],
  consent: ['view', 'configure'],
  training: ['view', 'manage'],
  audit: ['view', 'export'],
  clients: ['view', 'manage'],
  settings: ['view', 'manage'],
  billing: ['view', 'manage'],
  developers: ['view', 'manage'],
  team: ['view', 'invite', 'manage'],
};

export default function RolesPage() {
  const utils = trpc.useUtils();
  const [selectedRole, setSelectedRole] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */ | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: {} as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ });

  const { data: roles, isLoading } = trpc.customRoles.list.useQuery();

  const createRole = trpc.customRoles.create.useMutation({
    onSuccess: () => {
      utils.customRoles.list.invalidate();
      setIsCreating(false);
      setFormData({ name: '', description: '', permissions: {} });
    }
  });

  const updateRole = trpc.customRoles.update.useMutation({
    onSuccess: () => {
      utils.customRoles.list.invalidate();
      setSelectedRole(null);
    }
  });

  const deleteRole = trpc.customRoles.delete.useMutation({
    onSuccess: () => {
      utils.customRoles.list.invalidate();
    }
  });

  const handleEdit = (role: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {}
    });
    setSelectedRole(role);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setFormData({ name: '', description: '', permissions: {} });
    setIsCreating(true);
    setSelectedRole(null);
  };

  const handleSave = () => {
    if (isCreating) {
      createRole.mutate(formData);
    } else if (selectedRole) {
      updateRole.mutate({ id: selectedRole.id, ...formData });
    }
  };

  const handlePermissionChange = (module: string, action: string, checked: boolean) => {
    setFormData(prev => {
      const newPerms = { ...prev.permissions };
      if (!newPerms[module]) newPerms[module] = {};
      newPerms[module][action] = checked;
      return { ...prev, permissions: newPerms };
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24 rise-in">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings/team" className="text-set-fg-subtle hover:text-set-fg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-set-fg">Custom Roles</h1>
          <p className="text-set-fg-subtle mt-1">Configure granular permissions for your team members.</p>
        </div>
        {!isCreating && !selectedRole && (
          <button
            onClick={handleCreate}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-set-gold text-[#0A0A0A] hover:bg-set-gold-hi transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Role
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-set-line bg-set-panel shadow-panel-elevated overflow-hidden">
            <div className="p-4 border-b border-set-line font-medium">Existing Roles</div>
            <div className="divide-y divide-set-line-soft">
              {roles?.map((role: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
                <div
                  key={role.id}
                  className={`p-4 cursor-pointer transition-colors ${selectedRole?.id === role.id ? 'bg-set-gold/10 border-l-2 border-set-gold' : 'hover:bg-set-row-hover'}`}
                  onClick={() => handleEdit(role)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-set-fg flex items-center gap-2">
                        {role.name}
                        {role.isDefault && (
                          <span className="text-[10px] bg-white/10 text-set-fg-muted px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Default</span>
                        )}
                      </div>
                      <div className="text-sm text-set-fg-subtle mt-1">{role.description}</div>
                    </div>
                  </div>
                </div>
              ))}
              {roles?.length === 0 && (
                <div className="p-8 text-center text-set-fg-subtle text-sm">No custom roles found.</div>
              )}
            </div>
          </div>
        </div>

        {(isCreating || selectedRole) && (
          <div className="md:col-span-2">
            <div className="rounded-xl border border-set-line bg-set-panel shadow-panel-elevated overflow-hidden">
              <div className="p-6 border-b border-set-line flex justify-between items-center bg-set-sunken">
                <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">{isCreating ? 'Create New Role' : 'Edit Role'}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsCreating(false); setSelectedRole(null); }}
                    className="px-4 py-2 text-sm border border-set-line rounded-lg hover:bg-set-panel transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={createRole.isPending || updateRole.isPending}
                    className="px-4 py-2 text-sm rounded-lg font-semibold bg-set-gold text-[#0A0A0A] hover:bg-set-gold-hi transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Role
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-set-fg mb-1">Role Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-set-line-strong rounded-lg focus:ring-2 focus:ring-set-gold focus:border-transparent outline-none"
                      disabled={selectedRole?.isDefault}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-set-fg mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-3 py-2 border border-set-line-strong rounded-lg focus:ring-2 focus:ring-set-gold focus:border-transparent outline-none"
                      disabled={selectedRole?.isDefault}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-sm font-medium text-set-fg">Permissions Matrix</h3>
                    {selectedRole && !selectedRole.isDefault && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this role? Users with this role will lose their custom permissions.')) {
                            deleteRole.mutate({ id: selectedRole.id });
                          }
                        }}
                        className="text-xs text-set-danger hover:text-set-danger flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete Role
                      </button>
                    )}
                  </div>

                  <div className="border border-set-line rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-set-sunken border-b border-set-line">
                        <tr>
                          <th className="px-4 py-3 font-medium text-set-fg-subtle">Module</th>
                          <th className="px-4 py-3 font-medium text-set-fg-subtle">Permissions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-set-line-soft">
                        {MODULES.map(module => (
                          <tr key={module} className="hover:bg-set-row-hover/50">
                            <td className="px-4 py-3 font-medium text-set-fg capitalize w-1/4 align-top pt-4">
                              {module}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-4">
                                {MODULE_ACTIONS[module]?.map(action => (
                                  <label key={`${module}-${action}`} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-set-line-strong text-set-gold focus:ring-set-gold w-4 h-4"
                                      checked={!!formData.permissions?.[module]?.[action]}
                                      onChange={(e) => handlePermissionChange(module, action, e.target.checked)}
                                    />
                                    <span className="text-set-fg-muted capitalize">{action}</span>
                                  </label>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
