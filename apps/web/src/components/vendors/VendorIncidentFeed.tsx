"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { ShieldAlert, Calendar, ExternalLink, ShieldCheck, AlertOctagon, Check, X, MessageSquare, Landmark, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

export function VendorIncidentFeed({ vendorId }: { vendorId: string }) {
  const t = useTranslations('vendors.incidents');
  const { data: incidents, isLoading, refetch } = trpc.vendors.getIncidentsForVendor.useQuery({ vendorId });
  const reviewMutation = trpc.vendors.reviewIncidentAlert.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'acknowledged' | 'action_taken' | 'dismissed'>('acknowledged');
  const [notes, setNotes] = useState('');

  if (isLoading) return <div className="p-8 text-[#6E747A]">{t('loading')}</div>;

  const handleReviewSubmit = async (alertId: string) => {
    await reviewMutation.mutateAsync({
      alertId,
      status: reviewStatus,
      actionNotes: notes
    });
    setActiveAlertId(null);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-serif text-[#F4F5F6] mb-1">{t('title')}</h3>
        <p className="text-[14px] text-[#9BA1A6]">{t('subtitle')}</p>
      </div>

      {incidents?.length === 0 ? (
        <div className="bg-[#08090A]/50 border border-white/5 rounded-xl p-8 text-center text-[#6E747A] text-sm">
          <ShieldCheck className="w-12 h-12 text-sage-500 mx-auto mb-3" />
          <p className="font-semibold text-[#F4F5F6]">{t('empty_title')}</p>
          <p className="text-xs text-[#6E747A] mt-1">{t('empty_body')}</p>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-white/10 space-y-8">
          {incidents?.map((inc) => {
            // alertId is null for an incident this organisation has no alert row
            // for, and activeAlertId starts null — so a plain equality check
            // opened the review form on every unalerted incident at once.
            const isReviewOpen = inc.alertId != null && activeAlertId === inc.alertId;
            const severityColor = 
              inc.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-900/50' :
              inc.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-900/50' :
              inc.severity === 'medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
              'bg-gray-50 text-gray-700 border-gray-200';

            return (
              <div key={inc.id} className="relative group">
                {/* Timeline node icon */}
                <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-white ring-1 ring-ink-900/10 flex items-center justify-center
                  ${inc.incidentType === 'breach' ? 'bg-red-600' : inc.incidentType === 'fine' ? 'bg-amber-600' : 'bg-[#C9A227]'}`}>
                  <Calendar className="w-1.5 h-1.5 text-white" />
                </div>

                <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-4 hover:border-white/20 transition-all">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${severityColor}`}>
                          {t(`severity.${inc.severity}`)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border-white/10 text-[#E6E8EA] uppercase tracking-wider">
                          {t(`type.${inc.incidentType}`)}
                        </span>
                        {inc.alertId && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider
                            ${inc.alertStatus === 'unread' ? 'bg-red-500/10 text-red-400 border-red-900/50 animate-pulse' :
                              inc.alertStatus === 'acknowledged' ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30' :
                              inc.alertStatus === 'action_taken' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
                              'bg-gray-50 text-gray-700 border-gray-200'}`}
                          >
                            {t('alert_label', { status: t(`alert_status.${inc.alertStatus}`) })}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-[#F4F5F6] mt-1">{inc.title}</h4>
                      <p className="text-[12px] text-[#6E747A]">
                        {t('meta', {
                          when: inc.incidentDate ? format(new Date(inc.incidentDate), 'MMMM d, yyyy') : t('date_unknown'),
                          source: inc.sourceName || t('default_source'),
                        })}
                      </p>
                    </div>

                    {inc.sourceUrl && (
                      <a 
                        href={inc.sourceUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#C9A227] hover:text-[#E5C463] transition-colors font-medium border border-white/10 px-3 py-1.5 rounded-lg hover:bg-[#08090A]"
                      >
                        {t('source')} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <p className="text-[14px] text-[#E6E8EA] leading-relaxed whitespace-pre-line">{inc.summary}</p>

                  {/* Fine Details */}
                  {inc.incidentType === 'fine' && inc.fineAmount && (
                    <div className="bg-amber-500/50 border border-amber-900/50 rounded-xl p-4 flex items-center gap-3">
                      <Landmark className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">{t('penalty')}</span>
                        <span className="text-lg font-bold text-amber-300 font-serif">
                          {Number(inc.fineAmount).toLocaleString()} {inc.fineCurrency || 'EUR'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Impact categories */}
                  {inc.affectedDataCategories && inc.affectedDataCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wider block">{t('affected_categories')}</span>
                      <div className="flex flex-wrap gap-2">
                        {inc.affectedDataCategories.map((cat, idx) => (
                          <span key={idx} className="bg-[#08090A] border border-white/5 text-[#9BA1A6] text-[11px] px-2 py-0.5 rounded font-medium">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Action Box for breaches */}
                  {inc.incidentType === 'breach' && (
                    <div className="bg-red-500/40 border border-red-900/40 rounded-xl p-4 flex gap-3">
                      <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-red-950 uppercase tracking-wider block">{t('art33_title')}</span>
                        <p className="text-xs text-red-300 leading-relaxed">
                          {t('art33_body')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Review History Banner */}
                  {inc.alertId && inc.alertStatus !== 'unread' && (
                    <div className="bg-[#08090A]/50 border border-white/5 rounded-xl p-4 flex gap-3 text-xs text-[#9BA1A6]">
                      <MessageSquare className="w-4 h-4 text-[#6E747A] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-semibold text-[#F4F5F6]">
                          {t('reviewed_by', { name: inc.reviewerName || t('default_reviewer') })}
                        </div>
                        {inc.actionNotes && (
                          <p className="italic text-[#6E747A]">"{inc.actionNotes}"</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review controls trigger */}
                  {inc.alertId && inc.alertStatus === 'unread' && !isReviewOpen && (
                    <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                      <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" /> {t('action_required')}
                      </span>
                      <button
                        onClick={() => {
                          setActiveAlertId(inc.alertId);
                          setReviewStatus('acknowledged');
                          setNotes('');
                        }}
                        className="bg-ink-900 hover:bg-ink-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-panel-elevated"
                      >
                        {t('respond')}
                      </button>
                    </div>
                  )}

                  {/* Inline Response Review Form */}
                  {isReviewOpen && (
                    <div className="border-t border-white/10 pt-6 space-y-4 animate-in slide-in-from-top duration-200">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[#6E747A] uppercase tracking-wider">{t('select_action')}</label>
                        <div className="grid grid-cols-3 gap-3">
                          <button
                            type="button"
                            onClick={() => setReviewStatus('acknowledged')}
                            className={`px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all uppercase tracking-wider
                              ${reviewStatus === 'acknowledged' 
                                ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#C9A227] ring-2 ring-[#C9A227]/30' 
                                : 'bg-[#0D0F11] border-white/10 text-[#6E747A] hover:border-white/20'}`}
                          >
                            {t('actions.acknowledged')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewStatus('action_taken')}
                            className={`px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all uppercase tracking-wider
                              ${reviewStatus === 'action_taken' 
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 ring-2 ring-blue-500/10' 
                                : 'bg-[#0D0F11] border-white/10 text-[#6E747A] hover:border-white/20'}`}
                          >
                            {t('actions.action_taken')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewStatus('dismissed')}
                            className={`px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all uppercase tracking-wider
                              ${reviewStatus === 'dismissed' 
                                ? 'bg-gray-100 border-gray-300 text-gray-800 ring-2 ring-gray-500/10' 
                                : 'bg-[#0D0F11] border-white/10 text-[#6E747A] hover:border-white/20'}`}
                          >
                            {t('actions.dismissed')}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[#6E747A] uppercase tracking-wider">{t('notes_label')}</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={t('notes_placeholder')}
                          className="w-full min-h-20 px-3 py-2 border border-white/20 rounded-xl outline-none focus:border-[#C9A227]/50 focus:ring-1 focus:ring-[#C9A227]/40 text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 bg-[#08090A] p-3 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setActiveAlertId(null)}
                          className="px-4 py-2 text-xs font-medium text-[#9BA1A6] hover:text-[#F4F5F6]"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => inc.alertId && handleReviewSubmit(inc.alertId)}
                          disabled={reviewMutation.isPending}
                          className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-panel-elevated disabled:opacity-50"
                        >
                          {t('submit')}
                        </button>
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
  );
}
