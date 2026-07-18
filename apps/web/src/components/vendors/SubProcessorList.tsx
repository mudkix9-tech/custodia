// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Network, Plus, Trash2, ShieldCheck, AlertTriangle, Link as LinkIcon, Search, Calendar, Check, X, ChevronDown, ChevronUp, AlertOctagon } from 'lucide-react';
import { format } from 'date-fns';
import { useConfirm } from '@/components/ui/ConfirmDialog';


export function SubProcessorList({ vendorId, orgVendorId }: { vendorId: string; orgVendorId: string }) {
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
  const utils = trpc.useUtils();

  if (isLoading) return <div className="p-8 text-ink-500">Loading sub-processors...</div>;

  const handleAdd = async () => {
    if (addMode === 'linked') {
      await addLinkedMutation.mutateAsync({ parentVendorId: vendorId, subProcessorVendorId: selectedSubProcessorId });
    } else {
      await addUnlinkedMutation.mutateAsync({ parentVendorId: vendorId, name: manualName, country: manualCountry });
    }
    setShowAddModal(false);
    setSelectedSubProcessorId('');
    setManualName('');
    utils.vendors.subProcessors.list.invalidate({ parentVendorId: vendorId });
  };

  const handleRemove = async (id: string) => {
    await removeMutation.mutateAsync({ id });
    utils.vendors.subProcessors.list.invalidate({ parentVendorId: vendorId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif text-ink-900 mb-1">Sub-processors Chain</h3>
          <p className="text-[14px] text-ink-600">Track third-party vendors used by this vendor to process your data.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-sage-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Sub-processor
        </button>
      </div>

      <div className="bg-white border border-ink-900/10 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-bone-50 text-ink-500 border-b border-ink-900/10">
            <tr>
              <th className="px-6 py-3 font-medium">Sub-processor</th>
              <th className="px-6 py-3 font-medium">Jurisdiction</th>
              <th className="px-6 py-3 font-medium">Risk Status</th>
              <th className="px-6 py-3 font-medium">Added</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/5">
            {subProcessors?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-ink-500">
                  <Network className="w-12 h-12 text-ink-200 mx-auto mb-3" />
                  <p>No sub-processors recorded.</p>
                </td>
              </tr>
            ) : (
              subProcessors?.map((sp) => (
                <tr key={sp.id} className="hover:bg-bone-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-bone-100 flex items-center justify-center text-ink-500 font-bold border border-ink-900/5">
                        {(sp.vendorData?.name || sp.name)?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-ink-900 flex items-center gap-2">
                          {sp.vendorData?.name || sp.name}
                          {sp.vendorData && <span title="Linked to Global Database"><LinkIcon className="w-3 h-3 text-sage-500" /></span>}
                        </div>
                        <div className="text-xs text-ink-500">{sp.purpose || 'General processing'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-ink-600">
                    {sp.vendorData?.headquartersCountry || sp.country || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    {sp.vendorData ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-sage-50 text-sage-700 border border-sage-200">
                        <ShieldCheck className="w-3.5 h-3.5" /> Database Match
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" /> Unlisted Vendor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink-500 text-xs">
                    {format(new Date(sp.addedAt!), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleRemove(sp.id)}
                      className="text-ink-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-ink-900/10">
              <h3 className="text-xl font-serif text-ink-900">Add Sub-processor</h3>
              <p className="text-sm text-ink-500 mt-1">Connect a third-party vendor handling data for this service.</p>
            </div>
            
            <div className="flex border-b border-ink-900/10 bg-bone-50">
              <button 
                onClick={() => setAddMode('linked')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${addMode === 'linked' ? 'bg-white text-sage-700 border-b-2 border-sage-600' : 'text-ink-500 hover:text-ink-900'}`}
              >
                Search Database
              </button>
              <button 
                onClick={() => setAddMode('unlinked')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${addMode === 'unlinked' ? 'bg-white text-sage-700 border-b-2 border-sage-600' : 'text-ink-500 hover:text-ink-900'}`}
              >
                Manual Entry
              </button>
            </div>

            <div className="p-6">
              {addMode === 'linked' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-5 h-5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search global vendor database..." 
                      className="w-full pl-10 pr-4 py-2 border border-ink-900/20 rounded-xl outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border border-ink-900/10 rounded-xl divide-y divide-ink-900/5">
                    {globalVendors?.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).map(v => (
                      <label key={v.id} className="flex items-center gap-3 p-3 hover:bg-bone-50 cursor-pointer transition-colors">
                        <input 
                          type="radio" 
                          name="vendor" 
                          checked={selectedSubProcessorId === v.id}
                          onChange={() => setSelectedSubProcessorId(v.id)}
                          className="text-sage-600 focus:ring-sage-500"
                        />
                        <div>
                          <div className="font-medium text-ink-900 text-sm">{v.name}</div>
                          <div className="text-xs text-ink-500">{v.headquartersCountry || 'Unknown location'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200">
                    Use manual entry only if the vendor doesn't exist in our global database. Manual sub-processors do not receive automated risk scores.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-1">Company Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-ink-900/20 rounded-xl outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-1">Country Code (e.g., US, IE)</label>
                    <input 
                      type="text" 
                      maxLength={2}
                      className="w-full px-4 py-2 border border-ink-900/20 rounded-xl outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 uppercase"
                      value={manualCountry}
                      onChange={(e) => setManualCountry(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-ink-900/10 flex justify-end gap-3 bg-bone-50">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-900"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdd}
                disabled={addMode === 'linked' ? !selectedSubProcessorId : !manualName}
                className="bg-sage-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-sage-600 transition-colors disabled:opacity-50"
              >
                Add Sub-processor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="mt-12 border-t border-ink-900/10 pt-8 space-y-6">
        <div>
          <h3 className="text-xl font-serif text-ink-900 mb-1">Sub-processor Change History</h3>
          <p className="text-[14px] text-ink-600">Track and respond to changes detected on the public sub-processor webpage of this vendor.</p>
        </div>

        {changes?.length === 0 ? (
          <div className="bg-bone-50/50 border border-ink-900/5 rounded-xl p-6 text-center text-ink-500 text-sm">
            No changes have been detected or recorded for this vendor.
          </div>
        ) : (
          <div className="relative pl-6 border-l border-ink-200 space-y-8">
            {changes?.map((ch) => {
              const isExpanded = expandedChangeId === ch.id;
              
              const oldSnapshot = ch.previousSnapshot || '';
              const newSnapshot = ch.newSnapshot || '';
              const oldLines = oldSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
              const newLines = newSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
              const oldSet = new Set(oldLines);
              const newSet = new Set(newLines);
              const addedLines = newLines.filter(line => !oldSet.has(line));
              const removedLines = oldLines.filter(line => !newSet.has(line));

              return (
                <div key={ch.id} className="relative group">
                  <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-white bg-sage-600 ring-1 ring-ink-900/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <Calendar className="w-1.5 h-1.5 text-white" />
                  </div>

                  <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm space-y-4 hover:border-ink-900/20 transition-all">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-ink-900 text-[15px]">
                            Change Detected
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border
                            ${ch.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              ch.status === 'acknowledged' ? 'bg-sage-50 text-sage-700 border-sage-200' :
                              'bg-red-50 text-red-700 border-red-200'}`}
                          >
                            {ch.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[12px] text-ink-500">
                          Detected on {format(new Date(ch.detectedAt), 'MMMM d, yyyy h:mm a')}
                        </div>
                      </div>

                      {ch.status === 'pending_review' && (
                        <button
                          onClick={() => {
                            setReviewingChange(ch);
                            setReviewNotes('');
                          }}
                          className="bg-ink-900 text-white hover:bg-ink-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          Review &amp; Respond
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                          Summary of Changes ({addedLines.length} additions, {removedLines.length} removals)
                        </span>
                        <button
                          onClick={() => setExpandedChangeId(isExpanded ? null : ch.id)}
                          className="flex items-center gap-1 text-xs font-medium text-sage-600 hover:text-sage-800 transition-colors"
                        >
                          {isExpanded ? (
                            <>Hide Changes <ChevronUp className="w-3.5 h-3.5" /></>
                          ) : (
                            <>Show Changes <ChevronDown className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border border-ink-900/10 rounded-xl overflow-hidden text-xs divide-y divide-ink-900/5 bg-bone-50/30">
                          {addedLines.length === 0 && removedLines.length === 0 ? (
                            <div className="p-4 text-ink-500 italic text-center">
                              No line additions or removals detected (boilerplate update).
                            </div>
                          ) : (
                            <div className="max-h-80 overflow-y-auto font-mono space-y-2 p-4">
                              {removedLines.map((line, i) => (
                                <div key={`rem-${i}`} className="bg-red-50 text-red-800 border-l-2 border-red-500 px-3 py-1.5 rounded flex items-start gap-2">
                                  <span className="font-bold shrink-0 text-red-600">-</span>
                                  <span className="break-all">{line}</span>
                                </div>
                              ))}
                              {addedLines.map((line, i) => (
                                <div key={`add-${i}`} className="bg-sage-50 text-sage-800 border-l-2 border-sage-500 px-3 py-1.5 rounded flex items-start gap-2">
                                  <span className="font-bold shrink-0 text-sage-600">+</span>
                                  <span className="break-all">{line}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {ch.reviewedAt && (
                      <div className="border-t border-ink-900/5 pt-4 flex items-start gap-3 bg-bone-50/50 p-3.5 rounded-xl border border-ink-900/5 text-xs text-ink-600">
                        <div className="w-8 h-8 rounded-full bg-bone-100 flex items-center justify-center shrink-0 font-bold border border-ink-900/5 text-ink-700">
                          {ch.reviewerName?.charAt(0) || 'A'}
                        </div>
                        <div className="space-y-1">
                          <div className="font-semibold text-ink-900">
                            Reviewed by {ch.reviewerName} on {format(new Date(ch.reviewedAt), 'MMM d, yyyy')}
                          </div>
                          {ch.notes && <p className="italic text-ink-500">"{ch.notes}"</p>}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-ink-900/10">
              <h3 className="text-xl font-serif text-ink-900">Respond to Sub-processor Change</h3>
              <p className="text-sm text-ink-500 mt-1">Review the detected page differences and submit your response.</p>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block">Detected Diff Preview</span>
                <div className="border border-ink-900/10 rounded-xl max-h-40 overflow-y-auto font-mono text-[11px] p-3 bg-bone-50/30 space-y-1">
                  {(() => {
                    const oldSnapshot = reviewingChange.previousSnapshot || '';
                    const newSnapshot = reviewingChange.newSnapshot || '';
                    const oldLines = oldSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
                    const newLines = newSnapshot.split('\n').map(l => l.trim()).filter(Boolean);
                    const oldSet = new Set(oldLines);
                    const newSet = new Set(newLines);
                    const added = newLines.filter(line => !oldSet.has(line));
                    const removed = oldLines.filter(line => !newSet.has(line));

                    if (added.length === 0 && removed.length === 0) {
                      return <div className="text-ink-500 italic text-center p-2">Boilerplate updates only.</div>;
                    }
                    return (
                      <>
                        {removed.map((l, idx) => (
                          <div key={`rem-${idx}`} className="text-red-700">- {l}</div>
                        ))}
                        {added.map((l, idx) => (
                          <div key={`add-${idx}`} className="text-sage-700">+ {l}</div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-ink-900">Review Notes</label>
                <textarea
                  className="w-full min-h-24 px-4 py-2 border border-ink-900/20 rounded-xl outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 text-sm"
                  placeholder="Record your assessment, e.g. 'AWS Dublin region added; complies with hosting preferences.'"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertOctagon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-amber-900 text-xs uppercase tracking-wider">DPA Objection Clause Warning</h4>
                  <p className="text-xs text-amber-800 leading-normal">
                    Objecting to a sub-processor change is a legally significant action under GDPR.
                    Under your DPA terms, you may have the right to terminate the agreement.
                    Review your DPA clause coverage for termination provisions.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-ink-900/10 flex justify-between items-center bg-bone-50">
              <button
                onClick={() => setReviewingChange(null)}
                className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-900"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await reviewMutation.mutateAsync({
                      changeId: reviewingChange.id,
                      status: 'objected',
                      notes: reviewNotes
                    });
                    setReviewingChange(null);
                  }}
                  disabled={reviewMutation.isPending}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors shadow-sm disabled:opacity-50"
                >
                  Object to Change
                </button>
                <button
                  onClick={async () => {
                    await reviewMutation.mutateAsync({
                      changeId: reviewingChange.id,
                      status: 'acknowledged',
                      notes: reviewNotes
                    });
                    setReviewingChange(null);
                  }}
                  disabled={reviewMutation.isPending}
                  className="bg-sage-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sage-600 transition-colors shadow-sm disabled:opacity-50"
                >
                  Acknowledge Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
