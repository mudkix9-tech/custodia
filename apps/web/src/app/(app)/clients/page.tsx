"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { DataGrid } from 'ui';
import { Plus, Search, Building2, Globe, FileText, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

export default function ClientsPage() {
  const { data: clientsResp, isLoading } = trpc.clients.list.useQuery({} as any);
  const clients = (clientsResp as any)?.data || [];
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = clients.filter((c: any) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      accessorKey: 'name',
      header: 'Client Name',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bone-100 rounded-lg flex items-center justify-center border border-ink-900/10 text-ink-700 font-semibold">
            {row.original.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link href={`/clients/${row.original.id}`} className="font-medium text-ink-900 hover:text-sage-600 transition-colors block">
              {row.original.name}
            </Link>
            {row.original.industry && <div className="text-[12px] text-ink-500 mt-0.5">{row.original.industry}</div>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contactEmail',
      header: 'Primary Contact',
      cell: ({ row }: any) => (
        <div>
          <div className="text-[13px] text-ink-900 font-medium">{row.original.contactName || '-'}</div>
          <div className="text-[12px] text-ink-500">{row.original.contactEmail || '-'}</div>
        </div>
      )
    },
    {
      accessorKey: 'linkedActivitiesCount',
      header: 'Processing Activities',
      cell: ({ getValue }: any) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
          {getValue()} Linked
        </span>
      )
    },
    {
      accessorKey: 'dpaStatus',
      header: 'DPA Status',
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-sage-50 text-sage-700 border border-sage-200"><CheckCircle2 className="w-3.5 h-3.5"/> Signed</span>;
        if (val === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-red-50 text-red-700 border border-red-200"><Clock className="w-3.5 h-3.5"/> Expired</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-amber-50 text-amber-700 border border-amber-200"><FileText className="w-3.5 h-3.5"/> Pending</span>;
      }
    },
    {
      accessorKey: 'portalEnabled',
      header: 'Portal Status',
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val) return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-green-50 text-green-700"><Globe className="w-3.5 h-3.5"/> Active</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-gray-100 text-gray-600">Disabled</span>;
      }
    }
  ];

  return (
    <div className="max-w-[1200px] mx-auto p-8 fade-up space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-ink-900 mb-2">Client Management</h1>
          <p className="text-ink-600 text-[15px]">Manage clients, DPAs, and their secure compliance portals.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsAddOpen(true)} className="inline-flex items-center gap-2 bg-sage-700 hover:bg-sage-600 text-white text-[14px] font-medium px-4 py-2 rounded-xl transition-all shadow-card">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ink-400" /> Total Clients
          </div>
          <div className="text-3xl font-serif text-ink-900">{clients.length}</div>
        </div>
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-ink-400" /> Active Portals
          </div>
          <div className="text-3xl font-serif text-ink-900">{clients.filter((c: any) => c.portalEnabled).length}</div>
        </div>
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sage-500" /> Signed DPAs
          </div>
          <div className="text-3xl font-serif text-ink-900">{clients.filter((c: any) => c.dpaStatus === 'signed').length}</div>
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white border border-ink-900/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-ink-900/5 bg-bone-50/50 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input 
              type="text" 
              placeholder="Search clients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-ink-900/10 rounded-lg pl-9 pr-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
            />
          </div>
        </div>
        <DataGrid 
          mode="full"
          columns={columns as any}
          data={filteredClients}
          isLoading={isLoading}
          emptyStateMessage="No clients added yet. Click 'Add Client' to start managing agency clients."
        />
      </div>

      <AddClientModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}

function AddClientModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const createMutation = trpc.clients.create.useMutation();
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    contactName: '',
    contactEmail: '',
    industry: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync(formData);
    utils.clients.list.invalidate();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
      <div className="bg-white border-ink-900/10 rounded-2xl w-full max-w-[500px] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-ink-900/10 flex justify-between items-center">
          <h2 className="text-xl font-serif text-ink-900">Add New Client</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-2xl leading-none">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Client Name *</label>
            <input 
              required type="text"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              placeholder="e.g., Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Legal Entity Name</label>
            <input 
              type="text"
              value={formData.legalName} onChange={e => setFormData({...formData, legalName: e.target.value})}
              className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              placeholder="e.g., Acme Corporation LLC"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Contact Name</label>
              <input 
                type="text"
                value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Contact Email</label>
              <input 
                type="email"
                value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Industry</label>
            <input 
              type="text"
              value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})}
              className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[14px] font-medium text-ink-600 hover:text-ink-900 bg-white border border-ink-900/10 rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-[14px] font-medium text-white bg-sage-700 hover:bg-sage-600 rounded-xl disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
