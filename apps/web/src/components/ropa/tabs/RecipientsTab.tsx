"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, Building2, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useRopaVocabulary, type VocabGroup } from '@/utils/ropaVocabularies';

import Link from 'next/link';

export function RecipientsTab({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.recipients');
  // Risk levels are register vocabulary and already translated there.
  const tRopa = useTranslations('ropa');
  const vocab = useRopaVocabulary();
  const utils = trpc.useUtils();
  const { data: recipients = [], isLoading } = trpc.ropa.recipients.list.useQuery({ processingActivityId: activityId });
  const { data: orgVendorsResp } = trpc.vendors.getOrgVendors.useQuery({ limit: 100 });
  const orgVendors = orgVendorsResp?.data || [];
  
  const createMutation = trpc.ropa.recipients.create.useMutation();
  const updateMutation = trpc.ropa.recipients.update.useMutation();
  const deleteMutation = trpc.ropa.recipients.delete.useMutation();
  const { confirm, dialog } = useConfirm();

  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customName, setCustomName] = useState('');

  const refresh = () => {
    utils.ropa.recipients.list.invalidate({ processingActivityId: activityId });
    utils.ropa.completeness.invalidate({ id: activityId });
  };

  const handleInlineEdit = async (rowId: string, columnId: string, value: any) => {
    await updateMutation.mutateAsync({ id: rowId, data: { [columnId]: value } });
    refresh();
  };

  const handleAddVendor = async () => {
    if (!selectedVendorId) return;
    const vendor = orgVendors.find((v: any) => v.id === selectedVendorId) as any;
    if (!vendor) return;

    await createMutation.mutateAsync({
      processingActivityId: activityId,
      recipientType: 'vendor',
      name: vendor.name,
      vendorId: vendor.id,
      // A defensible default rather than a guess: a vendor linked to a processing
      // activity is a processor in the overwhelming majority of cases, and the role
      // is editable in the grid. Left null it would show as an Art. 28 gap on a row
      // the user has just answered.
      role: 'processor',
    });
    setSelectedVendorId('');
    refresh();
    utils.ropa.transfers.list.invalidate(); // Because a transfer might have been auto-created
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      recipientType: 'other',
      name: customName,
      // Deliberately unset. A hand-typed recipient could be an internal team, a
      // regulator or an independent controller, and guessing would put an answer in
      // the register that nobody gave.
    });
    setCustomName('');
    refresh();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('remove_title'),
      description: t('remove_body'),
      variant: 'destructive',
      confirmText: t('remove'),
    });
    if (confirmed) {
      await deleteMutation.mutateAsync({ id });
      refresh();
    }
  };

  // R142. Takes the vocabulary *group* rather than a pre-built option array, so the
  // labels resolve through the catalogue in the reader's language rather than
  // arriving as English literals from a module-level constant.
  const SelectCell = ({ getValue, row, column, table, group, placeholder, label }: any) => (
    <Select
      value={getValue() || 'none'}
      onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val === 'none' ? null : val)}
    >
      <SelectTrigger
        aria-label={label}
        className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40"
      >
        <SelectValue placeholder={placeholder}>{vocab.label(group as VocabGroup, getValue())}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {vocab.options(group as VocabGroup).map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const columns = [
    {
      accessorKey: 'name',
      header: t('col_name'),
      cell: ({ row }: any) => {
        const { vendorData, name } = row.original;
        if (vendorData) {
          return (
            <Link href={`/vendors/${vendorData.id}`} className="font-medium text-[#F4F5F6] hover:text-[#C9A227] transition-colors flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
              {name}
            </Link>
          );
        }
        return <span className="text-[#F4F5F6] font-medium">{name}</span>;
      },
    },
    {
      accessorKey: 'recipientCategory',
      header: t('col_category'),
      // Art. 30(1)(d) asks for the categories of recipient, which is what has to be
      // shown when the name is commercially confidential or the list runs long.
      cell: (props: any) => <SelectCell {...props} group="recipient_category" placeholder={t('not_categorised')} label={t('col_category')} />,
    },
    {
      accessorKey: 'role',
      header: t('col_role'),
      // Whether this is a processor, a joint controller or an independent controller
      // decides whether Art. 28 applies, whether Art. 26 applies, and whether the
      // disclosure hands over controllership. `recipientType` says none of that.
      cell: (props: any) => <SelectCell {...props} group="recipient_role" placeholder={t('not_stated')} label={t('col_role')} />,
    },
    {
      id: 'dpaStatus',
      header: t('col_dpa'),
      cell: ({ row }: any) => {
        const { vendorData } = row.original;
        if (!vendorData) return <span className="text-[#6E747A] text-[13px]">-</span>;
        
        const status = vendorData.dpaStatus;
        if (status === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#C9A227]/10 text-[#C9A227]"><ShieldCheck className="w-3 h-3" aria-hidden="true" /> {t('dpa_signed')}</span>;
        if (status === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400"><AlertTriangle className="w-3 h-3" aria-hidden="true" /> {t('dpa_expired')}</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400">{t('dpa_missing')}</span>;
      }
    },
    {
      id: 'riskScore',
      header: t('col_risk'),
      cell: ({ row }: any) => {
        const { vendorData } = row.original;
        if (!vendorData) return <span className="text-[#6E747A] text-[13px]">-</span>;

        const score = vendorData.riskScore || 0;
        const level = vendorData.riskLevel || 'low';

        let colorClass = "text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/30";
        if (level === 'critical') colorClass = "text-red-400 bg-red-500/10 border-red-900/50 font-bold";
        else if (level === 'high') colorClass = "text-orange-300 bg-orange-500/10 border-orange-500/25 font-semibold";
        else if (level === 'medium') colorClass = "text-amber-400 bg-amber-500/10 border-amber-900/50";

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border ${colorClass}`}>
            {tRopa(`risk_levels.${level}`)} ({score})
          </span>
        );
      }
    },
    {
      id: 'location',
      header: t('col_location'),
      cell: ({ row }: any) => {
        const { vendorData } = row.original;
        if (!vendorData) return <span className="text-[#6E747A] text-[13px]">-</span>;

        return (
          <div className="flex items-center gap-1.5 text-[13px] text-[#9BA1A6]">
            <Globe className="w-3.5 h-3.5 text-[#6E747A]" aria-hidden="true" />
            {vendorData.headquartersCountry || t('unknown')}
            {vendorData.usingEuHosting && <span className="text-[#C9A227] font-medium">{t('eu_hosted')}</span>}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label={t('remove')}
          onClick={() => handleDelete(row.original.id)} 
          className="w-7 h-7 text-[#6E747A] hover:text-clay-600 hover:bg-white/5"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
      size: 50,
    }
  ];

  return (
    <div className="space-y-6 fade-up">
      {dialog}
      <div className="bg-[#08090A] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
        <h2 className="text-[15px] font-semibold text-[#F4F5F6] mb-4">{t('add_title')}</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Add Vendor Link */}
          <div className="space-y-3">
            <label htmlFor="recipient-vendor" className="text-[13px] font-medium text-[#E6E8EA] block">{t('link_vendor')}</label>
            <div className="flex gap-3">
              <Select 
                value={selectedVendorId || 'none'}
                onValueChange={val => setSelectedVendorId(val === 'none' ? '' : val)}
              >
                <SelectTrigger id="recipient-vendor" className="flex-1">
                  <SelectValue placeholder={t('select_vendor')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('select_vendor')}</SelectItem>
                  {orgVendors.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddVendor}
                disabled={!selectedVendorId || createMutation.isPending}
              >
                {t('link')}
              </Button>
            </div>
            <p className="text-[12px] text-[#6E747A]">{t('link_hint')}</p>
          </div>

          {/* Add Custom Recipient */}
          <div className="space-y-3 md:border-l md:border-white/10 md:pl-8">
            <label htmlFor="recipient-custom" className="text-[13px] font-medium text-[#E6E8EA] block">{t('add_other')}</label>
            <div className="flex gap-3">
              <Input
                id="recipient-custom"
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder={t('other_ph')}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleAddCustom}
                disabled={!customName.trim() || createMutation.isPending}
              >
                {t('add')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        <DataGrid
          mode="full"
          columns={columns as any}
          data={recipients}
          isLoading={isLoading}
          onInlineEdit={handleInlineEdit}
          emptyStateMessage={t('empty')}
        />
      </div>
    </div>
  );
}
