"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Network, Plus, Trash2, ShieldCheck, AlertTriangle, Link as LinkIcon, Search, Calendar, Check, X, ChevronDown, ChevronUp, AlertOctagon } from 'lucide-react';
import { format } from 'date-fns';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


/**
 * `catalogueOwned` says whether this organisation owns the vendor row itself --
 * i.e. it is a custom vendor it created, not a shared catalogue entry.
 *
 * The sub-processor table hangs off the *global* vendor, so a write to it moves
 * every tenant's derived risk score. The API therefore refuses `addLinked` /
 * `addUnlinked` / `remove` for anything this org does not own. Rendering the
 * controls anyway meant clicking "Add Sub-processor" on AWS returned
 * "Parent vendor not found" about a vendor plainly on the screen, so the
 * controls are hidden here and the reason is stated instead of guessed at.
 *
 * For a catalogue vendor the list is maintained by the change detector against
 * the vendor's own published page, which is what Article 28(2) actually asks
 * about; a per-organisation override table is the real fix and is not built yet.
 */
export function SubProcessorList({ vendorId, orgVendorId, catalogueOwned }: { vendorId: string; orgVendorId: string; catalogueOwned: boolean }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [addMode, setAddMode] = useState<'linked' | 'unlinked'>('linked');
  
  const [selectedSubProcessorId, setSelectedSubProcessorId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  
  const { data: subProcessors, isLoading } = trpc.vendors.subProcessors.list.useQuery({ parentVendorId: vendorId });
  const { data: globalVendors } = trpc.vendors.getAllGlobal.useQuery();
  
  const { data: changes, refetch: refetchChanges } = trpc.vendors.getSubProcessorChanges.useQuery({ orgVendorId });
  const reviewMutation = trpc.vendors.reviewSubProcessorChange.useMutation({
    onSuccess: () => {
      refetchChanges();
    }
  });

  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [reviewingChange, setReviewingChange] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  
  const addLinkedMutation = trpc.vendors.subProcessors.addLinked.useMutation();
  const addUnlinkedMutation = trpc.vendors.subProcessors.addUnlinked.useMutation();
  const removeMutation = trpc.vendors.subProcessors.remove.useMutation();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const t = useTranslations('vendors.sub_processors');
  const utils = trpc.useUtils();

  if (isLoading) return <div className="p-8 text-[#6E747A]">{t('loading')}</div>;

  // Both mutations are refused by the API for a vendor this organisation does not
  // own. The controls are hidden in that case, so these catches are a backstop
  // rather than the path -- but an unhandled rejection here is a modal that stays
  // open having silently done nothing.
  const handleAdd = async () => {
    try {
      if (addMode === 'linked') {
        await addLinkedMutation.mutateAsync({ parentVendorId: vendorId, subProcessorVendorId: selectedSubProcessorId });
      } else {
        await addUnlinkedMutation.mutateAsync({ parentVendorId: vendorId, name: manualName, country: manualCountry });
      }
    } catch (err: unknown) {
      toast(t('errors.add_failed'), {
        tone: 'error',
        description: err instanceof Error ? err.message : undefined,
      });
      return;
    }
    setShowAddModal(false);
    setSelectedSubProcessorId('');
    setManualName('');
    utils.vendors.subProcessors.list.invalidate({ parentVendorId: vendorId });
  };

  const handleRemove = async (id: string) => {
    try {
      await removeMutation.mutateAsync({ id });
    } catch (err: unknown) {
      toast(t('errors.remove_failed'), {
        tone: 'error',
        description: err instanceof Error ? err.message : undefined,
      });
      return;
    }
    utils.vendors.subProcessors.list.invalidate({ parentVendorId: vendorId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif text-[#F4F5F6] mb-1">{t('title')}</h3>
          <p className="text-[14px] text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
        {catalogueOwned ? (
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('add')}
          </Button>
        ) : (
          <div className="max-w-xs text-right text-[12px] text-[#6E747A] leading-relaxed">
            {t('catalogue_note')}
          </div>
        )}
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl overflow-hidden shadow-panel-elevated">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#08090A] text-[#6E747A] border-b border-white/10">
            <tr>
              <th className="px-6 py-3 font-medium">{t('col_name')}</th>
              <th className="px-6 py-3 font-medium">{t('col_jurisdiction')}</th>
              <th className="px-6 py-3 font-medium">{t('col_risk')}</th>
              <th className="px-6 py-3 font-medium">{t('col_added')}</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/5">
            {subProcessors?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[#6E747A]">
                  <Network className="w-12 h-12 text-[#6E747A] mx-auto mb-3" />
                  <p>{t('empty')}</p>
                </td>
              </tr>
            ) : (
              subProcessors?.map((sp) => (
                <tr key={sp.id} className="hover:bg-[#08090A]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#6E747A] font-bold border border-white/5">
                        {(sp.vendorData?.name || sp.name)?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-[#F4F5F6] flex items-center gap-2">
                          {sp.vendorData?.name || sp.name}
                          {sp.vendorData && <span title={t('linked_title')}><LinkIcon className="w-3 h-3 text-sage-500" /></span>}
                        </div>
                        <div className="text-xs text-[#6E747A]">{sp.purpose || t('purpose_default')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#9BA1A6]">
                    {sp.vendorData?.headquartersCountry || sp.country || t('unknown_country')}
                  </td>
                  <td className="px-6 py-4">
                    {sp.vendorData ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30">
                        <ShieldCheck className="w-3.5 h-3.5" /> {t('database_match')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-900/50">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t('unlisted_vendor')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[#6E747A] text-xs">
                    {format(new Date(sp.addedAt!), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {catalogueOwned && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(sp.id)}
                        className="text-[#6E747A] hover:text-red-500 hover:bg-transparent transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="bg-[#0D0F11] rounded-2xl shadow-panel-elevated w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-serif text-[#F4F5F6]">{t('modal.title')}</h3>
              <p className="text-sm text-[#6E747A] mt-1">{t('modal.subtitle')}</p>
            </div>
            
            <div className="flex border-b border-white/10 bg-[#08090A]">
              <Button 
                variant="ghost"
                onClick={() => setAddMode('linked')}
                className={`flex-1 rounded-none px-4 py-3 h-auto text-sm font-medium transition-colors ${addMode === 'linked' ? 'bg-[#0D0F11] text-[#C9A227] border-b-2 border-[#C9A227] hover:bg-[#0D0F11] hover:text-[#C9A227]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
              >
                {t('modal.tab_search')}
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setAddMode('unlinked')}
                className={`flex-1 rounded-none px-4 py-3 h-auto text-sm font-medium transition-colors ${addMode === 'unlinked' ? 'bg-[#0D0F11] text-[#C9A227] border-b-2 border-[#C9A227] hover:bg-[#0D0F11] hover:text-[#C9A227]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
              >
                {t('modal.tab_manual')}
              </Button>
            </div>

            <div className="p-6">
              {addMode === 'linked' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-5 h-5 text-[#6E747A] absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                    <Input 
                      type="text" 
                      placeholder={t('modal.search_placeholder')} 
                      className="w-full pl-10 pr-4"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border border-white/10 rounded-xl divide-y divide-ink-900/5">
                    {globalVendors?.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).map(v => (
                      <label key={v.id} className="flex items-center gap-3 p-3 hover:bg-[#08090A] cursor-pointer transition-colors">
                        <input 
                          type="radio" 
                          name="vendor" 
                          checked={selectedSubProcessorId === v.id}
                          onChange={() => setSelectedSubProcessorId(v.id)}
                          className="text-[#C9A227] focus:ring-[#C9A227]/40"
                        />
                        <div>
                          <div className="font-medium text-[#F4F5F6] text-sm">{v.name}</div>
                          <div className="text-xs text-[#6E747A]">{v.headquartersCountry || t('modal.unknown_location')}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-500/10 text-amber-300 text-xs p-3 rounded-lg border border-amber-900/50">
                    {t('modal.manual_warning')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('modal.company_name')}</label>
                    <Input 
                      type="text" 
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('modal.country_code')}</label>
                    <Input 
                      type="text" 
                      maxLength={2}
                      className="uppercase"
                      value={manualCountry}
                      onChange={(e) => setManualCountry(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-[#08090A]">
              <Button 
                variant="ghost"
                onClick={() => setShowAddModal(false)}
                className="text-[#9BA1A6] hover:text-[#F4F5F6]"
              >
                {t('modal.cancel')}
              </Button>
              <Button 
                onClick={handleAdd}
                disabled={addMode === 'linked' ? !selectedSubProcessorId : !manualName}
              >
                {t('modal.submit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="mt-12 border-t border-white/10 pt-8 space-y-6">
        <div>
          <h3 className="text-xl font-serif text-[#F4F5F6] mb-1">{t('history.title')}</h3>
          <p className="text-[14px] text-[#9BA1A6]">{t('history.subtitle')}</p>
        </div>

        {changes?.length === 0 ? (
          <div className="bg-[#08090A]/50 border border-white/5 rounded-xl p-6 text-center text-[#6E747A] text-sm">
            {t('history.empty')}
          </div>
        ) : (
          <div className="relative pl-6 border-l border-white/10 space-y-8">
            {changes?.map((ch) => {
              const isExpanded = expandedChangeId === ch.id;
              
              const oldSnapshot: string = ch.previousSnapshot || '';
              const newSnapshot: string = ch.newSnapshot || '';
              const oldLines = oldSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
              const newLines = newSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
              const oldSet = new Set(oldLines);
              const newSet = new Set(newLines);
              const addedLines = newLines.filter(line => !oldSet.has(line));
              const removedLines = oldLines.filter(line => !newSet.has(line));

              return (
                <div key={ch.id} className="relative group">
                  <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-[#0D0F11] bg-[#C9A227] ring-1 ring-white/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <Calendar className="w-1.5 h-1.5 text-white" />
                  </div>

                  <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-4 hover:border-white/20 transition-all">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[#F4F5F6] text-[15px]">
                            {t('change.detected')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border
                            ${ch.status === 'pending_review' ? 'bg-amber-500/10 text-amber-400 border-amber-900/50' :
                              ch.status === 'acknowledged' ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30' :
                              'bg-red-500/10 text-red-400 border-red-900/50'}`}
                          >
                            {t(`change.status.${ch.status}`)}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#6E747A]">
                          {t('change.detected_on', { when: format(new Date(ch.detectedAt), 'MMMM d, yyyy h:mm a') })}
                        </div>
                      </div>

                      {ch.status === 'pending_review' && (
                        <Button
                          onClick={() => {
                            setReviewingChange(ch);
                            setReviewNotes('');
                          }}
                        >
                          {t('change.review')}
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                          {t('change.summary', { added: addedLines.length, removed: removedLines.length })}
                        </span>
                        <Button
                          variant="ghost"
                          onClick={() => setExpandedChangeId(isExpanded ? null : ch.id)}
                          className="flex items-center gap-1 text-xs font-medium text-[#C9A227] hover:text-[#E5C463] hover:bg-transparent transition-colors"
                        >
                          {isExpanded ? (
                            <>{t('change.hide')} <ChevronUp className="w-3.5 h-3.5" /></>
                          ) : (
                            <>{t('change.show')} <ChevronDown className="w-3.5 h-3.5" /></>
                          )}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border border-white/10 rounded-xl overflow-hidden text-xs divide-y divide-ink-900/5 bg-[#08090A]/30">
                          {addedLines.length === 0 && removedLines.length === 0 ? (
                            <div className="p-4 text-[#6E747A] italic text-center">
                              {t('change.no_lines')}
                            </div>
                          ) : (
                            <div className="max-h-80 overflow-y-auto font-mono space-y-2 p-4">
                              {removedLines.map((line, i) => (
                                <div key={`rem-${i}`} className="bg-red-500/10 text-red-400 border-l-2 border-red-500 px-3 py-1.5 rounded flex items-start gap-2">
                                  <span className="font-bold shrink-0 text-red-400">-</span>
                                  <span className="break-all">{line}</span>
                                </div>
                              ))}
                              {addedLines.map((line, i) => (
                                <div key={`add-${i}`} className="bg-[#C9A227]/10 text-[#C9A227] border-l-2 border-[#C9A227]/50 px-3 py-1.5 rounded flex items-start gap-2">
                                  <span className="font-bold shrink-0 text-[#C9A227]">+</span>
                                  <span className="break-all">{line}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {ch.reviewedAt && (
                      <div className="border-t border-white/5 pt-4 flex items-start gap-3 bg-[#08090A]/50 p-3.5 rounded-xl border border-white/5 text-xs text-[#9BA1A6]">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 font-bold border border-white/5 text-[#E6E8EA]">
                          {ch.reviewerName?.charAt(0) || 'A'}
                        </div>
                        <div className="space-y-1">
                          <div className="font-semibold text-[#F4F5F6]">
                            {t('change.reviewed_by', { name: ch.reviewerName ?? '', when: format(new Date(ch.reviewedAt), 'MMM d, yyyy') })}
                          </div>
                          {ch.notes && <p className="italic text-[#6E747A]">"{ch.notes}"</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Dialog Modal */}
      {reviewingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="bg-[#0D0F11] rounded-2xl shadow-panel-elevated w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-serif text-[#F4F5F6]">{t('review.title')}</h3>
              <p className="text-sm text-[#6E747A] mt-1">{t('review.subtitle')}</p>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#6E747A] uppercase tracking-wider block">{t('review.diff_preview')}</span>
                <div className="border border-white/10 rounded-xl max-h-40 overflow-y-auto font-mono text-[11px] p-3 bg-[#08090A]/30 space-y-1">
                  {(() => {
                    const oldSnapshot: string = reviewingChange.previousSnapshot || '';
                    const newSnapshot: string = reviewingChange.newSnapshot || '';
                    const oldLines = oldSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
                    const newLines = newSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
                    const oldSet = new Set(oldLines);
                    const newSet = new Set(newLines);
                    const added = newLines.filter(line => !oldSet.has(line));
                    const removed = oldLines.filter(line => !newSet.has(line));

                    if (added.length === 0 && removed.length === 0) {
                      return <div className="text-[#6E747A] italic text-center p-2">{t('review.boilerplate_only')}</div>;
                    }
                    return (
                      <>
                        {removed.map((l, idx) => (
                          <div key={`rem-${idx}`} className="text-red-400">- {l}</div>
                        ))}
                        {added.map((l, idx) => (
                          <div key={`add-${idx}`} className="text-[#C9A227]">+ {l}</div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#F4F5F6]">{t('review.notes_label')}</label>
                <Textarea
                  className="min-h-[96px]"
                  placeholder={t('review.notes_placeholder')}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-900/50 rounded-xl p-4 flex gap-3">
                <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-amber-300 text-xs uppercase tracking-wider">{t('review.warning_title')}</h4>
                  <p className="text-xs text-amber-300 leading-normal">
                    {t('review.warning_body')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-between items-center bg-[#08090A]">
              <Button
                variant="ghost"
                onClick={() => setReviewingChange(null)}
                className="text-[#9BA1A6] hover:text-[#F4F5F6]"
              >
                {t('review.cancel')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await reviewMutation.mutateAsync({
                      changeId: reviewingChange.id,
                      status: 'objected',
                      notes: reviewNotes
                    });
                    setReviewingChange(null);
                  }}
                  disabled={reviewMutation.isPending}
                >
                  {t('review.object')}
                </Button>
                <Button
                  onClick={async () => {
                    await reviewMutation.mutateAsync({
                      changeId: reviewingChange.id,
                      status: 'acknowledged',
                      notes: reviewNotes
                    });
                    setReviewingChange(null);
                  }}
                  disabled={reviewMutation.isPending}
                >
                  {t('review.acknowledge')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
