"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, ExternalLink, ShieldCheck, AlertTriangle, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EU_EEA_COUNTRIES, REST_OF_WORLD, countryName } from '@/utils/countries';
import {
  TRANSFER_MECHANISMS,
  SCC_YEARS,
  SCC_MODULES,
  SCC_REPEALED_YEARS,
  ARTICLE_49_SUB_REASONS,
  DPF_SCOPES,
  normaliseTransferMechanism,
  labelFor,
} from '@/utils/ropaVocabularies';

const toDateInput = (v: any) => (v ? new Date(v).toISOString().split('T')[0] : '');

export function TransfersTab({ activityId }: { activityId: string }) {
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
      title: 'Remove transfer?',
      description: 'Are you sure you want to remove this data transfer?',
      variant: 'destructive',
      confirmText: 'Remove',
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
          <SelectTrigger className="bg-transparent border-none shadow-none h-8 px-2 py-1 flex-1 text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
            <SelectValue placeholder="Select a country...">{countryName(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>Select a country...</SelectItem>
            {[...EU_EEA_COUNTRIES, ...REST_OF_WORLD].map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {adequacy && (
          <span
            title={
              adequacy.status === 'eu_eea'
                ? 'Inside the EEA — Chapter V does not apply.'
                : adequacy.status === 'adequate'
                  ? adequacy.scope === 'data_privacy_framework'
                    ? 'Adequate for certified DPF entities only. An uncertified importer has no mechanism here.'
                    : adequacy.scope === 'commercial'
                      ? 'Adequacy does not reach public-sector or employee data.'
                      : 'Commission adequacy decision — no Art. 46 mechanism required.'
                  : 'Third country — an Art. 46 safeguard or an Art. 49 derogation is required.'
            }
            className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              adequacy.status === 'eu_eea'
                ? 'bg-white/5 text-[#9BA1A6] border-white/10'
                : adequacy.status === 'adequate'
                  ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-900/50'
            }`}
          >
            {adequacy.status === 'eu_eea' ? 'EEA' : adequacy.status === 'adequate' ? (adequacy.scope === 'full' ? 'Adequate' : 'Adequate*') : 'Third country'}
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
        <SelectTrigger className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
          <SelectValue placeholder="Not yet assessed" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>Select a mechanism...</SelectItem>
          {TRANSFER_MECHANISMS.map((m) => (
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
        <SelectTrigger className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
          <SelectValue placeholder="No vendor linked" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No vendor linked</SelectItem>
          {orgVendors.map((ov: any) => (
            <SelectItem key={ov.id} value={ov.id}>{ov.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const TiaStatusCell = ({ row }: any) => {
    const transfer = row.original;
    if (!transfer.vendorId) return <span className="text-xs text-[#6E747A]">Link vendor to assess</span>;

    if (transfer.tiaCompleted) {
      if (transfer.tiaRiskLevel === 'critical') {
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-medium border border-red-900/50">
              <AlertTriangle className="w-3 h-3" /> Suspended
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
            <ShieldCheck className="w-3 h-3" /> TIA: Completed
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
          <AlertTriangle className="w-3 h-3" /> TIA: Required
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
          aria-label={expanded === row.original.id ? 'Hide mechanism detail' : 'Show mechanism detail'}
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
      header: 'Destination Country',
      cell: CountryCell,
    },
    {
      accessorKey: 'destinationEntity',
      header: 'Importer',
      cell: EditableCell,
    },
    {
      accessorKey: 'transferMechanism',
      header: 'Transfer Mechanism',
      cell: MechanismCell,
    },
    {
      accessorKey: 'vendorId',
      header: 'Vendor (Data Importer)',
      cell: VendorSelectCell,
    },
    {
      id: 'tiaStatus',
      header: 'TIA Status',
      cell: TiaStatusCell,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
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
      <label className="text-[12px] text-[#9BA1A6]">{label}</label>
      <Input
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
      <label className="text-[12px] text-[#9BA1A6]">{label}</label>
      <Input
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
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-2">International Transfers</h2>
        <p className="text-[12px] text-[#6E747A] mb-4">
          Art. 30(1)(e) and Chapter V. Adequacy is computed from the Commission&apos;s decisions; expand a row to
          record the mechanism itself, which is what an auditor asks to see.
        </p>
        <DataGrid
          mode="compact"
          columns={columns as any}
          data={data}
          isLoading={isLoading}
          enableInlineAdd={true}
          onAddRow={handleAdd}
          onInlineEdit={handleInlineEdit}
          emptyStateMessage="No international transfers documented."
        />
      </div>

      {detail && (
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-6 fade-up">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-[14px] font-medium text-[#F4F5F6] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#6E747A]" />
                {countryName(detail.destinationCountry) || detail.destinationCountry}
                {detail.destinationEntity && <span className="text-[#6E747A] font-normal">· {detail.destinationEntity}</span>}
              </h3>
              <p className="text-[12px] text-[#6E747A]">{labelFor(TRANSFER_MECHANISMS, detailMechanism) || 'No mechanism chosen'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(null)} className="text-[#6E747A] hover:text-[#F4F5F6]">
              Close
            </Button>
          </div>

          {detailAdequacy?.status !== 'third_country' && detailMechanism && detailMechanism !== 'adequacy_decision' && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12.5px] text-[#9BA1A6]">
              {countryName(detail.destinationCountry)} {detailAdequacy?.status === 'eu_eea' ? 'is inside the EEA' : 'holds an adequacy decision'},
              so no Art. 46 safeguard is required. Recording one does no harm, but the adequacy decision is the mechanism.
            </div>
          )}

          {detailMechanism === 'pending_assessment' && (
            <div className="bg-amber-500/10 border border-amber-900/50 rounded-xl px-4 py-3 text-[12.5px] text-amber-300">
              This transfer has no mechanism yet. Choose one above — a transfer to a third country without an Art. 46
              safeguard or an Art. 49 derogation has no lawful route out of the EEA.
            </div>
          )}

          {/* ---- SCCs ------------------------------------------------------ */}
          {detailMechanism === 'scc' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                Standard Contractual Clauses <span className="text-[11px] text-[#6E747A] font-normal">Art. 46(2)(c)</span>
              </h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#9BA1A6]">Clause set</label>
                  <Select
                    value={detail.sccYear || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'sccYear', v === 'none' ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {SCC_YEARS.map((y) => (
                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {SCC_REPEALED_YEARS.includes(detail.sccYear) && (
                    <p className="text-[12px] text-clay-600 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      Repealed with effect from 27 December 2022. This transfer has no Art. 46 mechanism until it is
                      repapered onto the 2021 clauses.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#9BA1A6]">Module</label>
                  <Select
                    value={detail.sccModule || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'sccModule', v === 'none' ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {SCC_MODULES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-[#6E747A]">The module decides which party bears which obligation.</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {dateField('Execution date', 'executionDate')}
                {dateField('Expiry or review date', 'expiryDate', 'The EDPB expects transfers to be re-assessed periodically.')}
              </div>

              {textField('Signatories', 'signatories', 'Exporting and importing entities as signed.')}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detail.annexesComplete || false}
                  onChange={(e) => handleFieldChange(detail.id, 'annexesComplete', e.target.checked)}
                  className="mt-1 rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
                />
                <div>
                  <p className="text-[13px] font-medium text-[#F4F5F6]">Annexes completed</p>
                  <p className="text-[12px] text-[#6E747A]">
                    Annex I (parties, description of the transfer) and Annex II (technical and organisational measures).
                    Unexecuted annexes are the most common finding on an otherwise signed set of clauses.
                  </p>
                </div>
              </label>
            </section>
          )}

          {/* ---- DPF ------------------------------------------------------- */}
          {detailMechanism === 'dpf' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">EU–US Data Privacy Framework</h4>
              <p className="text-[12px] text-[#6E747A]">
                The framework covers certified organisations only, and only within the scope they certified for. Check
                the importer on the US Department of Commerce list before relying on it.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {textField('Certification number', 'dpfCertificationNumber', 'As listed on dataprivacyframework.gov')}
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#9BA1A6]">Certified scope</label>
                  <Select
                    value={detail.dpfScope || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'dpfScope', v === 'none' ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {DPF_SCOPES.map((sc) => (
                        <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-[#6E747A]">
                    An HR transfer to an importer certified for non-HR data alone has no mechanism.
                  </p>
                </div>
              </div>
              {dateField('Certification expiry', 'dpfExpiryDate', 'Certification is renewed annually. A lapsed one takes the mechanism with it.')}
            </section>
          )}

          {/* ---- BCRs ------------------------------------------------------ */}
          {detailMechanism === 'bcr' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                Binding Corporate Rules <span className="text-[11px] text-[#6E747A] font-normal">Art. 47</span>
              </h4>
              {textField('Approval reference', 'bcrReference', 'Lead supervisory authority and approval reference.')}
              {dateField('Approval date', 'executionDate')}
            </section>
          )}

          {/* ---- Adequacy -------------------------------------------------- */}
          {detailMechanism === 'adequacy_decision' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                Adequacy decision <span className="text-[11px] text-[#6E747A] font-normal">Art. 45</span>
              </h4>
              {textField(
                'Decision reference',
                'adequacyDecisionReference',
                'E.g. Commission Implementing Decision (EU) 2021/1772',
                detailAdequacy?.status === 'third_country'
                  ? 'This destination holds no adequacy decision on the Commission list. Check the mechanism.'
                  : detailAdequacy?.scope === 'commercial'
                    ? 'This decision does not reach public-sector or employee data.'
                    : detailAdequacy?.scope === 'data_privacy_framework'
                      ? 'US adequacy runs through the DPF and covers certified entities only — record it as DPF instead.'
                      : undefined,
              )}
            </section>
          )}

          {/* ---- Article 49 ------------------------------------------------ */}
          {detailMechanism === 'art49_derogation' && (
            <section className="space-y-4">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA]">
                Derogation <span className="text-[11px] text-[#6E747A] font-normal">Art. 49</span>
              </h4>
              <p className="text-[12px] text-[#6E747A]">
                Art. 49 is a derogation, not a safeguard. The EDPB reads it narrowly: it is for occasional,
                non-repetitive transfers, not for a standing data flow.
              </p>
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#9BA1A6]">Which derogation</label>
                <Select
                  value={detail.article49SubReason || 'none'}
                  onValueChange={(v) => handleFieldChange(detail.id, 'article49SubReason', v === 'none' ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {ARTICLE_49_SUB_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.article49SubReason && (
                  <p className="text-[12px] text-[#9BA1A6] bg-white/5 rounded-xl px-3 py-2">
                    {ARTICLE_49_SUB_REASONS.find((r) => r.value === detail.article49SubReason)?.hint}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#9BA1A6]">Justification <span className="text-clay-600">*</span></label>
                <Textarea
                  key={`${detail.id}-art49just`}
                  defaultValue={detail.article49Justification || ''}
                  onBlur={(e) => e.target.value !== (detail.article49Justification || '') && handleFieldChange(detail.id, 'article49Justification', e.target.value || null)}
                  rows={3}
                  placeholder="Why the conditions of this derogation are met, and why the transfer is occasional."
                />
              </div>
            </section>
          )}

          {/* ---- Everything else ------------------------------------------- */}
          {(detailMechanism === 'other' || detailMechanism === 'codes_of_conduct' || detailMechanism === 'certification') && (
            <section className="space-y-3">
              <label className="text-[12px] text-[#9BA1A6]">Mechanism detail <span className="text-clay-600">*</span></label>
              <Textarea
                key={`${detail.id}-mechdetail`}
                defaultValue={detail.mechanismDetail || ''}
                onBlur={(e) => e.target.value !== (detail.mechanismDetail || '') && handleFieldChange(detail.id, 'mechanismDetail', e.target.value || null)}
                rows={3}
                placeholder="The approved code or certification relied on, and its scope."
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
                <p className="text-[13px] font-medium text-[#F4F5F6]">A transfer impact assessment is required</p>
                <p className="text-[12px] text-[#6E747A]">
                  Schrems II. The outcome is recorded by the TIA itself and cannot be asserted here.
                </p>
              </div>
            </label>
          </section>
        </div>
      )}
    </div>
  );
}
