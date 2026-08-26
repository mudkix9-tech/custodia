"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import {
  Inbox,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Shield,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { VendorIntakeModal } from './VendorIntakeModal';

export function VendorIntakeTab() {
  const t = useTranslations('vendors');
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending_review' | 'approved' | 'rejected'
  >('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRejectId, setSelectedRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const utils = trpc.useUtils();
  const listQuery = trpc.vendorIntake.list.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const approveMutation = trpc.vendorIntake.approve.useMutation({
    onSuccess: (data) => {
      toast(t('intake.toast_approved'));
      utils.vendorIntake.list.invalidate();
      utils.vendors.getOrgVendors.invalidate();
      utils.vendors.getRiskStats.invalidate();
    },
    onError: (err) => {
      toast(err.message, { tone: 'error' });
    },
  });

  const rejectMutation = trpc.vendorIntake.reject.useMutation({
    onSuccess: () => {
      toast(t('intake.toast_rejected'));
      setSelectedRejectId(null);
      setRejectReason('');
      utils.vendorIntake.list.invalidate();
    },
    onError: (err) => {
      toast(err.message, { tone: 'error' });
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate({ id });
  };

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRejectId || !rejectReason.trim()) return;
    rejectMutation.mutate({
      id: selectedRejectId,
      rejectionReason: rejectReason.trim(),
    });
  };

  const items = listQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#0D0F11] border border-white/10 rounded-2xl">
        <div>
          <h3 className="text-base font-semibold text-[#F4F5F6] flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#C9A227]" />
            {t('intake.title')}
          </h3>
          <p className="text-xs text-[#9BA1A6] mt-0.5">{t('intake.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-[#08090A] border border-white/10 rounded-xl p-1 text-xs">
            {(['all', 'pending_review', 'approved', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg transition-colors capitalize ${
                  statusFilter === st
                    ? 'bg-white/10 text-[#F4F5F6] font-medium'
                    : 'text-[#9BA1A6] hover:text-[#F4F5F6]'
                }`}
              >
                {st === 'all'
                  ? t('intake.filter_all')
                  : st === 'pending_review'
                  ? t('intake.status_pending')
                  : st === 'approved'
                  ? t('intake.status_approved')
                  : t('intake.status_rejected')}
              </button>
            ))}
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#C9A227] text-black rounded-xl hover:bg-[#d6ad30] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('intake.new_request')}
          </button>
        </div>
      </div>

      {/* Requests List */}
      {listQuery.isLoading ? (
        <div className="p-8 text-center text-sm text-[#9BA1A6]">{t('intake.loading')}</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-[#0D0F11] border border-white/10 rounded-2xl">
          <Inbox className="w-10 h-10 text-[#6E747A] mx-auto mb-3" />
          <p className="text-sm text-[#9BA1A6]">{t('intake.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((req) => {
            const isPending = req.status === 'pending_review';
            const categories = (req.dataCategories as string[]) || [];

            return (
              <div
                key={req.id}
                className="p-5 bg-[#0D0F11] border border-white/10 rounded-2xl hover:border-white/20 transition-colors space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-sm font-semibold text-[#F4F5F6]">{req.vendorName}</h4>
                      {req.vendorWebsite && (
                        <a
                          href={req.vendorWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#9BA1A6] hover:text-[#C9A227] flex items-center gap-1 transition-colors"
                        >
                          {req.vendorWebsite.replace(/^https?:\/\/(www\.)?/, '')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : req.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : req.status === 'more_info_requested'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/20'
                        }`}
                      >
                        {req.status === 'pending_review'
                          ? t('intake.status_pending')
                          : req.status === 'approved'
                          ? t('intake.status_approved')
                          : req.status === 'rejected'
                          ? t('intake.status_rejected')
                          : t('intake.status_more_info')}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#9BA1A6] border border-white/10 uppercase">
                        {req.criticality || 'medium'}
                      </span>
                    </div>

                    <div className="text-xs text-[#9BA1A6] flex flex-wrap items-center gap-x-4 gap-y-1">
                      {req.category && <span>{t('intake.field_category')}: {req.category}</span>}
                      {req.businessOwner && <span>{t('intake.field_owner')}: {req.businessOwner}</span>}
                      {req.requesterName && <span>{t('intake.col_requester')}: {req.requesterName}</span>}
                      <span>{t('intake.col_date')}: {new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isPending && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={approveMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('intake.approve')}
                      </button>
                      <button
                        onClick={() => setSelectedRejectId(req.id)}
                        disabled={rejectMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('intake.reject')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Purpose & Data Categories */}
                {req.purpose && (
                  <div className="text-xs text-[#9BA1A6] bg-[#08090A] p-2.5 rounded-xl border border-white/5">
                    <span className="font-medium text-[#F4F5F6]">{t('intake.label_purpose')} </span>
                    {req.purpose}
                  </div>
                )}

                {categories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#6E747A]">{t('intake.label_data_categories')}</span>
                    {categories.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-[#9BA1A6] border border-white/5"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {req.reviewNotes && (
                  <div className="text-xs text-[#9BA1A6] border-l-2 border-white/20 pl-3 py-0.5">
                    <span className="text-[#6E747A]">{t('intake.label_compliance_notes')} </span>
                    {req.reviewNotes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {selectedRejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-[#F4F5F6]">{t('intake.reject_title')}</h3>
            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                  {t('intake.reject_reason')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('intake.reject_placeholder')}
                  className="w-full px-3 py-2 bg-[#08090A] border border-white/10 rounded-lg text-sm text-[#F4F5F6] placeholder-[#6E747A] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRejectId(null)}
                  className="px-3 py-1.5 text-xs text-[#9BA1A6] hover:text-[#F4F5F6]"
                >
                  {t('import.common_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50"
                >
                  {t('intake.reject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Request Modal */}
      <VendorIntakeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => utils.vendorIntake.list.invalidate()}
      />
    </div>
  );
}
