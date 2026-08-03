"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { DataGrid } from 'ui';
import { Plus, Search, Building2, Globe, FileText, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function ClientsPage() {
  const t = useTranslations('clients');
  const {
    data: clientsResp,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.clients.list.useInfiniteQuery(
    { limit: 25 },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const clients = clientsResp?.pages.flatMap((page: any) => page.data) || [];
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = clients.filter((c: any) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 text-[#E6E8EA] font-semibold">
            {row.original.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link href={`/clients/${row.original.id}`} className="font-medium text-[#F4F5F6] hover:text-[#C9A227] transition-colors block">
              {row.original.name}
            </Link>
            {row.original.industry && <div className="text-[12px] text-[#6E747A] mt-0.5">{row.original.industry}</div>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contactEmail',
      header: t('columns.contact'),
      cell: ({ row }: any) => (
        <div>
          <div className="text-[13px] text-[#F4F5F6] font-medium">{row.original.contactName || '-'}</div>
          <div className="text-[12px] text-[#6E747A]">{row.original.contactEmail || '-'}</div>
        </div>
      )
    },
    {
      accessorKey: 'linkedActivitiesCount',
      header: t('columns.activities'),
      cell: ({ getValue }: any) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-900/50">
          {t('status.linked', { count: getValue() })}
        </span>
      )
    },
    {
      accessorKey: 'dpaStatus',
      header: t('columns.dpa_status'),
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30"><CheckCircle2 className="w-3.5 h-3.5"/> {t('status.signed')}</span>;
        if (val === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-red-500/10 text-red-400 border border-red-900/50"><Clock className="w-3.5 h-3.5"/> {t('status.expired')}</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-900/50"><FileText className="w-3.5 h-3.5"/> {t('status.pending')}</span>;
      }
    },
    {
      accessorKey: 'portalEnabled',
      header: t('columns.portal_status'),
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val) return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-green-500/10 text-green-400"><Globe className="w-3.5 h-3.5"/> {t('status.active')}</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-gray-100 text-gray-600">{t('status.disabled')}</span>;
      }
    }
  ];

  return (
    <div className="max-w-[1200px] mx-auto p-8 fade-up space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6] text-[15px]">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsAddOpen(true)} className="inline-flex items-center gap-2 bg-sage-700 hover:bg-sage-600 text-white text-[14px] font-medium px-4 py-2 rounded-xl transition-all shadow-card">
            <Plus className="w-4 h-4" /> {t('add_client')}
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#6E747A]" /> {t('total_clients')}
          </div>
          <div className="text-3xl font-serif text-[#F4F5F6]">{clients.length}</div>
        </div>
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#6E747A]" /> {t('active_portals')}
          </div>
          <div className="text-3xl font-serif text-[#F4F5F6]">{clients.filter((c: any) => c.portalEnabled).length}</div>
        </div>
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sage-500" /> {t('signed_dpas')}
          </div>
          <div className="text-3xl font-serif text-[#F4F5F6]">{clients.filter((c: any) => c.dpaStatus === 'signed').length}</div>
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-[#08090A]/50 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E747A]" />
            <input 
              type="text" 
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0D0F11] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
            />
          </div>
        </div>
        <DataGrid 
          mode="full"
          columns={columns as any}
          data={filteredClients}
          isLoading={isLoading}
          emptyStateMessage={t('empty_state')}
        />
        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors border border-white/10 shadow-panel-elevated disabled:opacity-50"
            >
              {isFetchingNextPage ? t('loading_more') : t('load_more')}
            </button>
          </div>
        )}
      </div>

      <AddClientModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}

function AddClientModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const t = useTranslations('clients');
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
      <div className="bg-[#0D0F11] border-white/10 rounded-2xl w-full max-w-[500px] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-serif text-[#F4F5F6]">{t('modal.title')}</h2>
          <button onClick={onClose} className="text-[#6E747A] hover:text-[#F4F5F6] text-2xl leading-none">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E6E8EA] mb-1">{t('modal.client_name')}</label>
            <input 
              required type="text"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-[#08090A] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              placeholder={t('modal.client_name_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#E6E8EA] mb-1">{t('modal.legal_name')}</label>
            <input 
              type="text"
              value={formData.legalName} onChange={e => setFormData({...formData, legalName: e.target.value})}
              className="w-full bg-[#08090A] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              placeholder={t('modal.legal_name_placeholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E6E8EA] mb-1">{t('modal.contact_name')}</label>
              <input 
                type="text"
                value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})}
                className="w-full bg-[#08090A] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E6E8EA] mb-1">{t('modal.contact_email')}</label>
              <input 
                type="email"
                value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})}
                className="w-full bg-[#08090A] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#E6E8EA] mb-1">{t('modal.industry')}</label>
            <input 
              type="text"
              value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})}
              className="w-full bg-[#08090A] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[14px] font-medium text-[#9BA1A6] hover:text-[#F4F5F6] bg-[#0D0F11] border border-white/10 rounded-xl">
              {t('modal.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-[14px] font-medium text-white bg-sage-700 hover:bg-sage-600 rounded-xl disabled:opacity-50">
              {createMutation.isPending ? t('modal.creating') : t('modal.create_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
