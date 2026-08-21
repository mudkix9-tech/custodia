"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataGrid } from 'ui';
import { TransferTiaPanel } from '../TransferTiaPanel';
import { trpc } from '@/utils/trpc';
import { Trash2, ExternalLink, ShieldCheck, AlertTriangle, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EU_EEA_COUNTRIES, REST_OF_WORLD, countryName } from '@/utils/countries';
import { SCC_REPEALED_YEARS, normaliseTransferMechanism, useRopaVocabulary } from '@/utils/ropaVocabularies';

const toDateInput = (v: any) => (v ? new Date(v).toISOString().split('T')[0] : '');

export function TransfersTab({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.transfers');
  const vocab = useRopaVocabulary();
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.ropa.transfers.list.useQuery({ processingActivityId: activityId });
  const { data: orgVendorsResp } = trpc.vendors.getOrgVendors.useQuery({ limit: 100 });
  const orgVendors = orgVendorsResp?.data || [];
  // Adequacy is served rather than duplicated: it changes by Commission decision and
  // carries scope caveats, and a second copy in this workspace is what produced D17.
  const { data: destinations } = trpc.ropa.transferDestinations.useQuery();
  const createMutation = trpc.ropa.transfers.create.useMutation();
  const updateMutation = trpc.ropa.transfers.update.useMutation();
  const deleteMutation = trpc.ropa.transfers.delete.useMutation();
  const { confirm, dialog } = useConfirm();

  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => {
    utils.ropa.transfers.list.invalidate({ processingActivityId: activityId });
    utils.ropa.completeness.invalidate({ id: activityId });
  };

  /** H75: computed from the served list, never from a hardcoded EU-27 array. */
  const adequacyOf = (code?: string | null) => {
    if (!code || !destinations) return null;
    if (destinations.euEea.includes(code)) return { status: 'eu_eea' as const, scope: null as string | null };
    const decision = (destinations.adequacy as Record<string, { date: string; scope: string }>)[code];
    if (decision) return { status: 'adequate' as const, scope: decision.scope };
    return { status: 'third_country' as const, scope: null };
  };

  const handleAdd = async () => {
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      // destination_country is char(2). 'United States' is a Postgres 22001, which is
      // why every use of this button failed until the picker below existed to replace it.
      destinationCountry: 'US',
      // Not 'Standard Contractual Clauses (SCCs)'. A new row has not been assessed,
      // and defaulting to a mechanism asserts a Chapter V safeguard nobody chose.
      transferMechanism: 'pending_assessment',
    });
    refresh();
  };

  const handleInlineEdit = async (rowId: string, columnId: string, value: any) => {
    await updateMutation.mutateAsync({ id: rowId, data: { [columnId]: value } });
    refresh();
  };

  const handleFieldChange = async (rowId: string, field: string, value: any) => {
    await updateMutation.mutateAsync({ id: rowId, data: { [field]: value } });
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

  const EditableCell = ({ getValue, row, column, table }: any) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    const onBlur = () => {
      if (value !== initialValue) {
        table.options.meta?.updateData(row.index, column.id, value);
      }
    };

    return (
      <Input
        value={value || ''}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        className="bg-transparent border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#C9A227]/40 rounded px-2 py-1 h-8 w-full text-[#F4F5F6] placeholder:text-white/20"
      />
    );
  };

  const CountryCell = ({ getValue, row, column, table }: any) => {
    const value = getValue();
    const adequacy = adequacyOf(value);
    return (
      <div className="flex items-center gap-2">
        <Select
          value={value || 'none'}
          onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val)}
        >
          <SelectTrigger aria-label={t('col_country')} className="bg-transparent border-none shadow-none h-8 px-2 py-1 flex-1 text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
            <SelectValue placeholder={t('select_country')}>{countryName(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>{t('select_country')}</SelectItem>
            {[...EU_EEA_COUNTRIES, ...REST_OF_WORLD].map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {adequacy && (
          <span
            title={
              adequacy.status === 'eu_eea'
                ? t('adequacy_eea_title')
                : adequacy.status === 'adequate'
                  ? adequacy.scope === 'data_privacy_framework'
                    ? t('adequacy_dpf_title')
                    : adequacy.scope === 'commercial'
                      ? t('adequacy_commercial_title')
                      : t('adequacy_full_title')
                  : t('adequacy_third_title')
            }
            className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              adequacy.status === 'eu_eea'
                ? 'bg-white/5 text-[#9BA1A6] border-white/10'
                : adequacy.status === 'adequate'
                  ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-900/50'
            }`}
          >
            {adequacy.status === 'eu_eea'
              ? t('badge_eea')
              : adequacy.status === 'adequate'
                ? (adequacy.scope === 'full' ? t('badge_adequate') : t('badge_adequate_partial'))
                : t('badge_third')}
          </span>
        )}
      </div>
    );
  };

  const MechanismCell = ({ getValue, row, column, table }: any) => {
    // Existing rows hold either the tab's old prose or the auto-create slug (D43);
    // normalising on read is what stops the picker rendering blank over them.
    const value = normaliseTransferMechanism(getValue());
    return (
      <Select
        value={value || 'none'}
        onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val)}
      >
        <SelectTrigger aria-label={t('col_mechanism')} className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
          <SelectValue placeholder={vocab.label('transfer_mechanism', 'pending_assessment')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>{t('select_mechanism')}</SelectItem>
          {vocab.options('transfer_mechanism').map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const VendorSelectCell = ({ getValue, row, column, table }: any) => {
    const value = getValue();
    return (
      <Select
        value={value || 'none'}
        onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val === 'none' ? null : val)}
      >
        <SelectTrigger aria-label={t('col_vendor')} className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
          <SelectValue placeholder={t('no_vendor')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('no_vendor')}</SelectItem>
          {orgVendors.map((ov: any) => (
            <SelectItem key={ov.id} value={ov.id}>{ov.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const TiaStatusCell = ({ row }: any) => {
    const transfer = row.original;
    if (!transfer.vendorId) return <span className="text-xs text-[#6E747A]">{t('tia_link_vendor')}</span>;

    if (transfer.tiaCompleted) {
      if (transfer.tiaRiskLevel === 'critical') {
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-medium border border-red-900/50">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {t('tia_suspended')}
            </span>
            <Link href={`/vendors/${transfer.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]">
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-[#C9A227]/10 text-[#C9A227] px-2 py-1 rounded text-xs font-medium border border-[#C9A227]/30">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" /> {t('tia_completed')}
          </span>
          <Link href={`/vendors/${transfer.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]">
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-medium border border-amber-900/50">
          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {t('tia_required')}
        </span>
        <Link href={`/vendors/${transfer.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]">
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    );
  };

  const columns = [
    {
      id: 'expander',
      header: '',
      cell: ({ row }: any) => (
        <button
          onClick={() => setExpanded(expanded === row.original.id ? null : row.original.id)}
          aria-label={expanded === row.original.id ? t('hide_detail') : t('show_detail')}
          aria-expanded={expanded === row.original.id}
          className="text-[#6E747A] hover:text-[#F4F5F6] transition-colors"
        >
          {expanded === row.original.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ),
      size: 32,
    },
    {
      accessorKey: 'destinationCountry',
      header: t('col_country'),
      cell: CountryCell,
    },
    {
      accessorKey: 'destinationEntity',
      header: t('col_importer'),
      cell: EditableCell,
    },
    {
      accessorKey: 'transferMechanism',
      header: t('col_mechanism'),
      cell: MechanismCell,
    },
    {
      accessorKey: 'vendorId',
      header: t('col_vendor'),
      cell: VendorSelectCell,
    },
    {
      id: 'tiaStatus',
      header: t('col_tia'),
      cell: TiaStatusCell,
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

  const detail = data.find((d: any) => d.id === expanded) as any;
  const detailMechanism = detail ? normaliseTransferMechanism(detail.transferMechanism) : null;
  const detailAdequacy = detail ? adequacyOf(detail.destinationCountry) : null;

  const dateField = (label: string, field: string, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={`transfer-${field}`} className="text-[12px] text-[#9BA1A6]">{label}</label>
      <Input
        id={`transfer-${field}`}
        type="date"
        key={`${detail.id}-${field}`}
        defaultValue={toDateInput(detail[field])}
        onBlur={(e) => {
          const next = e.target.value ? new Date(e.target.value) : null;
          const current = toDateInput(detail[field]);
          if (e.target.value !== current) handleFieldChange(detail.id, field, next);
        }}
      />
      {hint && <p className="text-[12px] text-[#6E747A]">{hint}</p>}
    </div>
  );

  const textField = (label: string, field: string, placeholder?: string, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={`transfer-${field}`} className="text-[12px] text-[#9BA1A6]">{label}</label>
      <Input
        id={`transfer-${field}`}
        key={`${detail.id}-${field}`}
        defaultValue={detail[field] || ''}
        placeholder={placeholder}
        onBlur={(e) => e.target.value !== (detail[field] || '') && handleFieldChange(detail.id, field, e.target.value || null)}
      />
      {hint && <p className="text-[12px] text-[#6E747A]">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6 fade-up">
      {dialog}
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-2">{t('title')}</h2>
        <p className="text-[12px] text-[#6E747A] mb-4">{t('subtitle')}</p>
        <DataGrid
          mode="compact"
          columns={columns as any}
          data={data}
          isLoading={isLoading}
          enableInlineAdd={true}
          onAddRow={handleAdd}
          onInlineEdit={handleInlineEdit}
          emptyStateMessage={t('empty')}
        />
      </div>

      {detail && (
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-6 fade-up">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-[14px] font-medium text-[#F4F5F6] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
                {countryName(detail.destinationCountry) || detail.destinationCountry}
                {detail.destinationEntity && <span className="text-[#6E747A] font-normal">· {detail.destinationEntity}</span>}
              </h3>
              <p className="text-[12px] text-[#6E747A]">{vocab.label('transfer_mechanism', detailMechanism) || t('no_mechanism')}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(null)} className="text-[#6E747A] hover:text-[#F4F5F6]">
              {t('close')}
            </Button>
          </div>

          {detailAdequacy?.status !== 'third_country' && detailMechanism && detailMechanism !== 'adequacy_decision' && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12.5px] text-[#9BA1A6]">
              {detailAdequacy?.status === 'eu_eea'
                ? t('note_inside_eea', { country: countryName(detail.destinationCountry) })
                : t('note_adequate', { country: countryName(detail.destinationCountry) })}
            </div>
          )}

          {detailMechanism === 'pending_assessment' && (
            <div className="bg-amber-500/10 border border-amber-900/50 rounded-xl px-4 py-3 text-[12.5px] text-amber-300">
              {t('note_no_mechanism')}
            </div>
          )}

          {/* ---- SCCs ------------------------------------------------------ */}
          {detailMechanism === 'scc' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('scc_title')} <span className="text-[11px] text-[#6E747A] font-normal">{t('art_46_2_c')}</span>
              </h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="transfer-sccYear" className="text-[12px] text-[#9BA1A6]">{t('clause_set')}</label>
                  <Select
                    value={detail.sccYear || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'sccYear', v === 'none' ? null : v)}
                  >
                    <SelectTrigger id="transfer-sccYear"><SelectValue placeholder={t('select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('not_specified')}</SelectItem>
                      {vocab.options('scc_year').map((y) => (
                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {SCC_REPEALED_YEARS.includes(detail.sccYear) && (
                    <p className="text-[12px] text-clay-600 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                      {t('scc_repealed')}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="transfer-sccModule" className="text-[12px] text-[#9BA1A6]">{t('module')}</label>
                  <Select
                    value={detail.sccModule || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'sccModule', v === 'none' ? null : v)}
                  >
                    <SelectTrigger id="transfer-sccModule"><SelectValue placeholder={t('select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('not_specified')}</SelectItem>
                      {vocab.options('scc_module').map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-[#6E747A]">{t('module_hint')}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {dateField(t('execution_date'), 'executionDate')}
                {dateField(t('expiry_date'), 'expiryDate', t('expiry_hint'))}
              </div>

              {textField(t('signatories'), 'signatories', t('signatories_ph'))}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detail.annexesComplete || false}
                  onChange={(e) => handleFieldChange(detail.id, 'annexesComplete', e.target.checked)}
                  className="mt-1 rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
                />
                <div>
                  <p className="text-[13px] font-medium text-[#F4F5F6]">{t('annexes')}</p>
                  <p className="text-[12px] text-[#6E747A]">{t('annexes_hint')}</p>
                </div>
              </label>
            </section>
          )}

          {/* ---- DPF ------------------------------------------------------- */}
          {detailMechanism === 'dpf' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">{vocab.label('transfer_mechanism', 'dpf')}</h4>
              <p className="text-[12px] text-[#6E747A]">{t('dpf_hint')}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {textField(t('dpf_number'), 'dpfCertificationNumber', t('dpf_number_ph'))}
                <div className="space-y-1.5">
                  <label htmlFor="transfer-dpfScope" className="text-[12px] text-[#9BA1A6]">{t('dpf_scope')}</label>
                  <Select
                    value={detail.dpfScope || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'dpfScope', v === 'none' ? null : v)}
                  >
                    <SelectTrigger id="transfer-dpfScope"><SelectValue placeholder={t('select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('not_specified')}</SelectItem>
                      {vocab.options('dpf_scope').map((sc) => (
                        <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-[#6E747A]">{t('dpf_scope_hint')}</p>
                </div>
              </div>
              {dateField(t('dpf_expiry'), 'dpfExpiryDate', t('dpf_expiry_hint'))}
            </section>
          )}

          {/* ---- BCRs ------------------------------------------------------ */}
          {detailMechanism === 'bcr' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('bcr_title')} <span className="text-[11px] text-[#6E747A] font-normal">{t('art_47')}</span>
              </h4>
              {textField(t('bcr_reference'), 'bcrReference', t('bcr_reference_ph'))}
              {dateField(t('approval_date'), 'executionDate')}
            </section>
          )}

          {/* ---- Adequacy -------------------------------------------------- */}
          {detailMechanism === 'adequacy_decision' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('adequacy_title')} <span className="text-[11px] text-[#6E747A] font-normal">{t('art_45')}</span>
              </h4>
              {textField(
                t('decision_reference'),
                'adequacyDecisionReference',
                t('decision_reference_ph'),
                detailAdequacy?.status === 'third_country'
                  ? t('adequacy_none_hint')
                  : detailAdequacy?.scope === 'commercial'
                    ? t('adequacy_commercial_hint')
                    : detailAdequacy?.scope === 'data_privacy_framework'
                      ? t('adequacy_dpf_hint')
                      : undefined,
              )}
            </section>
          )}

          {/* ---- Article 49 ------------------------------------------------ */}
          {detailMechanism === 'art49_derogation' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('derogation_title')} <span className="text-[11px] text-[#6E747A] font-normal">{t('art_49')}</span>
              </h4>
              <p className="text-[12px] text-[#6E747A]">{t('derogation_hint')}</p>
              <div className="space-y-1.5">
                <label htmlFor="transfer-art49" className="text-[12px] text-[#9BA1A6]">{t('which_derogation')}</label>
                <Select
                  value={detail.article49SubReason || 'none'}
                  onValueChange={(v) => handleFieldChange(detail.id, 'article49SubReason', v === 'none' ? null : v)}
                >
                  <SelectTrigger id="transfer-art49"><SelectValue placeholder={t('select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('not_specified')}</SelectItem>
                    {vocab.options('article_49_sub_reason').map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.article49SubReason && vocab.hint('article_49_sub_reason', detail.article49SubReason) && (
                  <p className="text-[12px] text-[#9BA1A6] bg-white/5 rounded-xl px-3 py-2">
                    {vocab.hint('article_49_sub_reason', detail.article49SubReason)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="transfer-art49just" className="text-[12px] text-[#9BA1A6]">
                  {t('justification')} <span className="text-clay-600" aria-hidden="true">*</span>
                </label>
                <Textarea
                  id="transfer-art49just"
                  key={`${detail.id}-art49just`}
                  defaultValue={detail.article49Justification || ''}
                  onBlur={(e) => e.target.value !== (detail.article49Justification || '') && handleFieldChange(detail.id, 'article49Justification', e.target.value || null)}
                  rows={3}
                  placeholder={t('art49_justification_ph')}
                />
              </div>
            </section>
          )}

          {/* ---- Everything else ------------------------------------------- */}
          {(detailMechanism === 'other' || detailMechanism === 'codes_of_conduct' || detailMechanism === 'certification') && (
            <section className="space-y-3">
              <label htmlFor="transfer-mechdetail" className="text-[12px] text-[#9BA1A6]">
                {t('mechanism_detail')} <span className="text-clay-600" aria-hidden="true">*</span>
              </label>
              <Textarea
                id="transfer-mechdetail"
                key={`${detail.id}-mechdetail`}
                defaultValue={detail.mechanismDetail || ''}
                onBlur={(e) => e.target.value !== (detail.mechanismDetail || '') && handleFieldChange(detail.id, 'mechanismDetail', e.target.value || null)}
                rows={3}
                placeholder={t('mechanism_detail_ph')}
              />
            </section>
          )}

          {/* ---- Common notes ---------------------------------------------- */}
          <section className="space-y-3 border-t border-white/10 pt-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={detail.tiaRequired || false}
                onChange={(e) => handleFieldChange(detail.id, 'tiaRequired', e.target.checked)}
                className="mt-1 rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
              />
              <div>
                <p className="text-[13px] font-medium text-[#F4F5F6]">{t('tia_needed')}</p>
                <p className="text-[12px] text-[#6E747A]">{t('tia_needed_hint')}</p>
              </div>
            </label>
          </section>

          {/* F58. The assessment for *this* transfer, inside the transfer's own
              detail panel. `tia.ts` files one per vendor, which cannot describe an
              organisation sending two different data sets to the same processor
              under two different mechanisms. */}
          <section className="border-t border-white/10 pt-5">
            <TransferTiaPanel transferId={detail.id} />
          </section>
        </div>
      )}
    </div>
  );
}
