"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
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
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */ | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: {} as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['customRoles'],
    queryFn: () => trpc.customRoles.list.query()
  });

  const createRole = useMutation({
    mutationFn: (data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => trpc.customRoles.create.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRoles'] });
      setIsCreating(false);
      setFormData({ name: '', description: '', permissions: {} });
    }
  });

  const updateRole = useMutation({
    mutationFn: (data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => trpc.customRoles.update.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRoles'] });
      setSelectedRole(null);
    }
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => trpc.customRoles.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRoles'] });
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
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings/team" className="text-ink-500 hover:text-ink-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Custom Roles</h1>
          <p className="text-ink-500 mt-1">Configure granular permissions for your team members.</p>
        </div>
        {!isCreating && !selectedRole && (
          <button
            onClick={handleCreate}
            className="ml-auto flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-lg hover:bg-sage-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Role
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-ink-900/10 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-ink-900/10 font-medium">Existing Roles</div>
            <div className="divide-y divide-ink-900/10">
              {roles?.map((role: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
                <div
                  key={role.id}
                  className={`p-4 cursor-pointer transition-colors ${selectedRole?.id === role.id ? 'bg-sage-50 border-l-4 border-sage-600' : 'hover:bg-ink-50'}`}
                  onClick={() => handleEdit(role)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-ink-900 flex items-center gap-2">
                        {role.name}
                        {role.isDefault && (
                          <span className="text-[10px] bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Default</span>
                        )}
                      </div>
                      <div className="text-sm text-ink-500 mt-1">{role.description}</div>
                    </div>
                  </div>
                </div>
              ))}
              {roles?.length === 0 && (
                <div className="p-8 text-center text-ink-500 text-sm">No custom roles found.</div>
              )}
            </div>
          </div>
        </div>

        {(isCreating || selectedRole) && (
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl border border-ink-900/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-ink-900/10 flex justify-between items-center bg-ink-50">
                <h2 className="text-lg font-medium">{isCreating ? 'Create New Role' : 'Edit Role'}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsCreating(false); setSelectedRole(null); }}
                    className="px-4 py-2 text-sm border border-ink-900/10 rounded-lg hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={createRole.isPending || updateRole.isPending}
                    className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Role
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Role Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                      disabled={selectedRole?.isDefault}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                      disabled={selectedRole?.isDefault}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-sm font-medium text-ink-900">Permissions Matrix</h3>
                    {selectedRole && !selectedRole.isDefault && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this role? Users with this role will lose their custom permissions.')) {
                            deleteRole.mutate(selectedRole.id);
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete Role
                      </button>
                    )}
                  </div>

                  <div className="border border-ink-900/10 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-ink-50 border-b border-ink-900/10">
                        <tr>
                          <th className="px-4 py-3 font-medium text-ink-500">Module</th>
                          <th className="px-4 py-3 font-medium text-ink-500">Permissions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-900/5">
                        {MODULES.map(module => (
                          <tr key={module} className="hover:bg-ink-50/50">
                            <td className="px-4 py-3 font-medium text-ink-900 capitalize w-1/4 align-top pt-4">
                              {module}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-4">
                                {MODULE_ACTIONS[module]?.map(action => (
                                  <label key={`${module}-${action}`} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-ink-900/20 text-sage-600 focus:ring-sage-500 w-4 h-4"
                                      checked={!!formData.permissions?.[module]?.[action]}
                                      onChange={(e) => handlePermissionChange(module, action, e.target.checked)}
                                    />
                                    <span className="text-ink-600 capitalize">{action}</span>
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
