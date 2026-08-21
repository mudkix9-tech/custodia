"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';


import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ControllerIdentityPanel } from '@/components/clients/ControllerIdentityPanel';
import { trpc } from '@/utils/trpc';
import { DataGrid } from 'ui';
import { 
  Building2, Globe, FileText, CheckCircle2, Clock, ShieldCheck, 
  Settings, Download, Share2, Eye, Link as LinkIcon, Unlink, Trash2,
  AlertTriangle
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useToast } from '@/components/ui/Toast';

export default function ClientDetailPage() {
  const t = useTranslations('clients.detail');
  const params = useParams();
  const id = params.id as string;
  const { data: client, isLoading } = trpc.clients.get.useQuery({ id });
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) return <GenericWorkspaceSkeleton />;
  if (!client) return <div className="p-8 text-red-400">{t('not_found')}</div>;

  const tabs = ['overview', 'ropa', 'vendors', 'report', 'portal'] as const;

  return (
    <div className="max-w-[1200px] mx-auto p-8 fade-up space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 text-xl font-bold text-[#F4F5F6]">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-serif text-[#F4F5F6]">{client.name}</h1>
            <div className="text-[#6E747A] text-[14px] flex items-center gap-4 mt-1">
              <span>{client.industry || t('no_industry')}</span>
              <span>&bull;</span>
              <span>{client.countryCode || t('unknown_location')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex gap-8">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-[14px] font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-[#C9A227] text-[#C9A227]'
                  : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/20'
              }`}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && <OverviewTab client={client} />}
        {activeTab === 'ropa' && <ActivitiesTab client={client} />}
        {activeTab === 'vendors' && <VendorsTab client={client} />}
        {activeTab === 'report' && <ReportTab client={client} />}
        {activeTab === 'portal' && <PortalPreviewTab client={client} />}
      </div>
    </div>
  );
}

function OverviewTab({ client }: { client: any }) {
  const t = useTranslations('clients.detail');
  const { confirm, dialog: confirmDialog } = useConfirm();
  const utils = trpc.useUtils();
  const togglePortal = trpc.clients.togglePortal.useMutation();
  const rotateToken = trpc.clients.rotateToken.useMutation();
  const updateDpa = trpc.clients.updateDpa.useMutation();

  const handleTogglePortal = async () => {
    await togglePortal.mutateAsync({ id: client.id, enabled: !client.portalEnabled });
    utils.clients.get.invalidate({ id: client.id });
  };

  const handleRotate = async () => {
    // Native confirm() has no room to say what breaks. Every portal link already
    // sent to this client stops working, which is worth spelling out.
    const ok = await confirm({
      title: t('portal.regenerate_title'),
      description: t('portal.regenerate_description'),
      confirmText: t('portal.regenerate_confirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    await rotateToken.mutateAsync({ id: client.id });
    utils.clients.get.invalidate({ id: client.id });
  };

  const handleDpaStatusChange = async (e: any) => {
    await updateDpa.mutateAsync({ 
      id: client.id, 
      dpaStatus: e.target.value,
      dpaSignedAt: e.target.value === 'signed' ? new Date().toISOString() : null,
      dpaExpiresAt: e.target.value === 'signed' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() : null
    });
    utils.clients.get.invalidate({ id: client.id });
  };

  const portalUrl = client.portalEnabled && client.portalToken 
    ? `${window.location.origin}/portal/${client.portalToken}`
    : '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {confirmDialog}
      {/* Left Col - Info */}
      <div className="space-y-8 md:col-span-2">
        <section className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <h3 className="text-lg font-bold text-[#F4F5F6] mb-4">{t('details.title')}</h3>
          <div className="grid grid-cols-2 gap-y-6">
            <div>
              <div className="text-[12px] text-[#6E747A] font-medium uppercase tracking-wider">{t('details.legal_name')}</div>
              <div className="text-[15px] text-[#F4F5F6] mt-1">{client.legalName || '-'}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6E747A] font-medium uppercase tracking-wider">{t('details.contact_name')}</div>
              <div className="text-[15px] text-[#F4F5F6] mt-1">{client.contactName || '-'}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6E747A] font-medium uppercase tracking-wider">{t('details.contact_email')}</div>
              <div className="text-[15px] text-[#F4F5F6] mt-1">{client.contactEmail || '-'}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6E747A] font-medium uppercase tracking-wider">{t('details.created_at')}</div>
              <div className="text-[15px] text-[#F4F5F6] mt-1">{new Date(client.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </section>

        {/* N114. Art. 30(2)(a) needs this client's identity as a controller, not
            the agency's. Beside the CRM details rather than inside them, because
            what is being recorded is the contents of a statutory record. */}
        <ControllerIdentityPanel client={client} />

        <section className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#F4F5F6]">{t('dpa.title')}</h3>
          </div>
          <p className="text-[14px] text-[#9BA1A6] mb-6">
            {t('dpa.description')}
          </p>
          
          <div className="grid grid-cols-2 gap-6 bg-[#08090A] p-6 rounded-xl border border-white/5">
            <div>
              <label className="block text-[12px] font-medium text-[#6E747A] uppercase tracking-wider mb-2">{t('dpa.status')}</label>
              <select 
                value={client.dpaStatus} 
                onChange={handleDpaStatusChange}
                disabled={updateDpa.isPending}
                className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="not_started">{t('dpa.options.not_started')}</option>
                <option value="pending">{t('dpa.options.pending')}</option>
                <option value="signed">{t('dpa.options.signed')}</option>
                <option value="expired">{t('dpa.options.expired')}</option>
              </select>
            </div>
            
            {client.dpaStatus === 'signed' && (
              <>
                <div>
                  <label className="block text-[12px] font-medium text-[#6E747A] uppercase tracking-wider mb-2">{t('dpa.signed_date')}</label>
                  <div className="text-[14px] font-medium text-[#F4F5F6] py-2">
                    {client.dpaSignedAt ? new Date(client.dpaSignedAt).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6E747A] uppercase tracking-wider mb-2">{t('dpa.expiry_date')}</label>
                  <div className="text-[14px] font-medium text-[#F4F5F6] py-2">
                    {client.dpaExpiresAt ? new Date(client.dpaExpiresAt).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6E747A] uppercase tracking-wider mb-2">{t('dpa.document')}</label>
                  <button className="text-[14px] font-medium text-[#C9A227] hover:text-[#C9A227] py-2 inline-flex items-center gap-1.5">
                    <Download className="w-4 h-4" /> {t('dpa.upload')}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Right Col - Portal */}
      <div className="space-y-6">
        <section className={`border rounded-2xl p-6 shadow-panel-elevated ${client.portalEnabled ? 'bg-indigo-500/10 border-indigo-900/50' : 'bg-[#0D0F11] border-white/10'}`}>
          <div className="flex items-center gap-3 mb-4">
            <Globe className={`w-6 h-6 ${client.portalEnabled ? 'text-indigo-400' : 'text-[#6E747A]'}`} />
            <h3 className="text-lg font-bold text-[#F4F5F6]">{t('portal.title')}</h3>
          </div>
          
          <p className="text-[14px] text-[#9BA1A6] mb-6">
            {t('portal.description')}
          </p>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={client.portalEnabled} onChange={handleTogglePortal} disabled={togglePortal.isPending} />
                <div className={`block w-10 h-6 rounded-full transition-colors ${client.portalEnabled ? 'bg-indigo-500/100' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-[#0D0F11] w-4 h-4 rounded-full transition-transform ${client.portalEnabled ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <span className="text-[14px] font-medium text-[#F4F5F6]">{t('portal.enable')}</span>
            </label>

            {client.portalEnabled && (
              <div className="pt-4 border-t border-indigo-900/50 space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-indigo-300/70 uppercase tracking-wider mb-1">{t('portal.secret_url')}</label>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={portalUrl} 
                      className="w-full bg-[#0D0F11] border border-indigo-900/50 rounded-lg px-3 py-2 text-[13px] text-[#9BA1A6] font-mono"
                    />
                    <button 
                      onClick={() => navigator.clipboard.writeText(portalUrl)}
                      className="bg-[#0D0F11] border border-indigo-900/50 text-indigo-400 hover:bg-indigo-500/10 px-3 py-2 rounded-lg"
                    >
                      {t('portal.copy')}
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={handleRotate}
                  disabled={rotateToken.isPending}
                  className="text-[13px] text-red-400 hover:text-red-400 font-medium inline-flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" /> {t('portal.regenerate')}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <h3 className="text-[15px] font-bold text-[#F4F5F6] mb-4">{t('stats.title')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-[#9BA1A6]">{t('stats.activities')}</span>
              <span className="font-bold text-[#F4F5F6] bg-white/5 px-2.5 py-0.5 rounded-full text-[13px]">
                {client.processingActivities?.length || 0}
              </span>
            </div>
            {/* Vendor count would require fetching the vendors related to these activities */}
          </div>
        </section>
      </div>
    </div>
  );
}

function ActivitiesTab({ client }: { client: any }) {
  const t = useTranslations('clients.detail');
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const unlink = trpc.clients.unlinkActivity.useMutation();
  const { confirm, dialog } = useConfirm();
  const utils = trpc.useUtils();

  const handleUnlink = async (activityId: string) => {
    const confirmed = await confirm({
      title: t('activities.unlink_title'),
      description: t('activities.unlink_description'),
      variant: 'destructive',
      confirmText: t('activities.unlink_confirm'),
    });
    if (confirmed) {
      await unlink.mutateAsync({ clientId: client.id, processingActivityId: activityId });
      utils.clients.get.invalidate({ id: client.id });
    }
  };

  const activities = client.processingActivities.map((cpa: any) => cpa.processingActivity);

  const columns = [
    {
      accessorKey: 'name',
      header: t('activities.columns.activity'),
      cell: ({ row }: any) => (
        <div>
          <Link href={`/ropa/${row.original.id}`} className="font-medium text-[#F4F5F6] hover:text-[#C9A227] block">
            {row.original.name}
          </Link>
          <div className="text-[13px] text-[#6E747A] truncate max-w-[300px]">{row.original.purpose}</div>
        </div>
      )
    },
    {
      accessorKey: 'lawfulBasis',
      header: t('activities.columns.lawful_basis'),
      cell: ({ getValue }: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-white/5 text-[#E6E8EA] uppercase tracking-wider">
          {getValue()?.replace('_', ' ')}
        </span>
      )
    },
    {
      accessorKey: 'riskLevel',
      header: t('activities.columns.risk_level'),
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val === 'high') return <span className="text-red-400 font-bold uppercase text-[12px] tracking-wider">{t('risk.high')}</span>;
        return <span className="text-[#C9A227] font-bold uppercase text-[12px] tracking-wider">{t(`risk.${val || 'low'}`)}</span>;
      }
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <button 
          onClick={() => handleUnlink(row.original.id)}
          className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition-colors"
          title={t('activities.unlink')}
        >
          <Unlink className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#0D0F11] p-6 rounded-2xl border border-white/10 shadow-panel-elevated">
        <div>
          <h2 className="text-lg font-bold text-[#F4F5F6]">{t('activities.title')}</h2>
          <p className="text-[14px] text-[#9BA1A6] mt-1">{t('activities.description')}</p>
        </div>
        <button 
          onClick={() => setIsLinkOpen(true)}
          className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-medium text-[14px] px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <LinkIcon className="w-4 h-4" /> {t('activities.link')}
        </button>
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        <DataGrid 
          columns={columns}
          data={activities}
          emptyStateMessage={t('activities.empty')}
        />
      </div>

      <LinkActivityModal 
        clientId={client.id} 
        isOpen={isLinkOpen} 
        onClose={() => setIsLinkOpen(false)} 
        existingActivityIds={activities.map((a: any) => a.id)}
      />
    </div>
  );
}

function LinkActivityModal({ clientId, isOpen, onClose, existingActivityIds }: any) {
  const t = useTranslations('clients.detail');
  const { data } = trpc.ropa.list.useQuery({ limit: 100 }, { enabled: isOpen });
  const allActivities = data?.data || [];
  const linkBulk = trpc.clients.linkActivitiesBulk.useMutation();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const availableActivities = allActivities.filter((a: any) => 
    !existingActivityIds.includes(a.id) &&
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleLink = async () => {
    if (selected.length === 0) return;
    await linkBulk.mutateAsync({ clientId, activityIds: selected });
    utils.clients.get.invalidate({ id: clientId });
    setSelected([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
      <div className="bg-[#0D0F11] border-white/10 rounded-2xl w-full max-w-[600px] overflow-hidden flex flex-col shadow-2xl h-[600px]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#08090A]">
          <div>
            <h2 className="text-xl font-serif text-[#F4F5F6]">{t('link_modal.title')}</h2>
            <p className="text-[13px] text-[#6E747A] mt-1">{t('link_modal.description')}</p>
          </div>
          <button onClick={onClose} aria-label={t('link_modal.close')} className="text-[#6E747A] hover:text-[#F4F5F6] text-2xl leading-none">&times;</button>
        </div>
        
        <div className="p-4 border-b border-white/5">
          <input 
            type="text"
            placeholder={t('link_modal.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#08090A] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {availableActivities.length === 0 ? (
            <div className="text-center text-[#6E747A] py-8">{t('link_modal.empty')}</div>
          ) : (
            availableActivities.map((act: any) => (
              <label key={act.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                selected.includes(act.id) ? 'border-[#C9A227]/50 bg-[#C9A227]/10' : 'border-white/10 hover:border-ink-900/30'
              }`}>
                <input 
                  type="checkbox" 
                  checked={selected.includes(act.id)} 
                  onChange={() => toggleSelect(act.id)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-[#F4F5F6]">{act.name}</div>
                  <div className="text-[13px] text-[#6E747A] line-clamp-1">{act.purpose}</div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-[#08090A] flex justify-between items-center">
          <div className="text-[13px] text-[#9BA1A6] font-medium">
            {t('link_modal.selected', { count: selected.length })}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[14px] font-medium text-[#9BA1A6] hover:text-[#F4F5F6] bg-[#0D0F11] border border-white/10 rounded-xl">{t('link_modal.cancel')}</button>
            <button 
              onClick={handleLink}
              disabled={selected.length === 0 || linkBulk.isPending}
              className="px-4 py-2 text-[14px] font-medium text-[#08090A] bg-[#C9A227] hover:bg-[#E5C463] rounded-xl disabled:opacity-50"
            >
              {t('link_modal.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VendorsTab({ client }: { client: any }) {
  const t = useTranslations('clients.detail');
  // In a real app, this would make an API call to resolve the vendor graph.
  // For UI representation, we just display the concept.
  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-12 shadow-panel-elevated text-center">
      <Globe className="w-12 h-12 text-[#6E747A] mx-auto mb-4" />
      <h3 className="text-xl font-bold text-[#F4F5F6] mb-2">{t('vendors.title')}</h3>
      <p className="text-[15px] text-[#9BA1A6] max-w-md mx-auto mb-6">
        {t('vendors.description')}
      </p>
      <p className="text-[14px] text-indigo-400 font-medium">
        {t('vendors.note')}
      </p>
    </div>
  );
}

function ReportTab({ client }: { client: any }) {
  const t = useTranslations('clients.detail');
  const toast = useToast();
  const generate = trpc.clients.generateComplianceReport.useMutation();
  
  const handleGenerate = async () => {
    const res = await generate.mutateAsync({ id: client.id });
    // The URL was previously only ever shown inside an alert(), where it could
    // not be clicked; open it instead.
    window.open(res.url, '_blank', 'noopener,noreferrer');
    toast(t('report.ready'), { description: t('report.ready_description') });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-8 shadow-panel-elevated flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-[#F4F5F6] mb-2">{t('report.title')}</h2>
        <p className="text-[15px] text-[#9BA1A6] max-w-lg mb-8">
          {t('report.description', { name: client.name })}
        </p>
        <button 
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="bg-red-500/100 hover:bg-red-600 text-white font-medium px-6 py-3 rounded-xl flex items-center gap-2 shadow-panel-elevated transition-all"
        >
          {generate.isPending ? t('report.generating') : <><Download className="w-5 h-5" /> {t('report.generate')}</>}
        </button>
      </div>
    </div>
  );
}

function PortalPreviewTab({ client }: { client: any }) {
  const t = useTranslations('clients.detail');

  if (!client.portalEnabled) {
    return (
      <div className="bg-[#08090A] border border-white/10 rounded-2xl p-12 text-center text-[#6E747A]">
        {t('preview.disabled')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[#0D0F11] px-6 py-4 rounded-xl border border-white/10">
        <div className="text-[14px] text-[#9BA1A6] font-medium">
          {t('preview.description', { name: client.name })}
        </div>
        <Link 
          href={`/portal/${client.portalToken}`} 
          target="_blank"
          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-400 font-medium text-[14px]"
        >
          {t('preview.open')} <Share2 className="w-4 h-4" />
        </Link>
      </div>

      <div className="border-[8px] border-ink-900 rounded-[2rem] overflow-hidden shadow-2xl h-[800px] relative bg-[#0D0F11]">
        {/* Simple browser chrome */}
        <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex gap-2 items-center">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 mx-4 bg-[#0D0F11] rounded-md border border-white/10 px-3 py-1 text-[12px] text-[#6E747A] flex items-center gap-2">
            <Globe className="w-3 h-3" />
            https://custodia.io/portal/{client.portalToken.substring(0, 10)}...
          </div>
        </div>
        
        {/* The iframe rendering the actual public page */}
        <iframe 
          src={`/portal/${client.portalToken}`} 
          className="w-full h-[calc(100%-48px)] border-0"
          title={t('preview.iframe_title')}
        />
      </div>
    </div>
  );
}
