"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { 
  ShieldCheck, 
  X, 
  Sparkles, 
  Lock, 
  Globe, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Cpu
} from 'lucide-react';

interface TrustCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
  website?: string | null;
}

export function TrustCenterModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  website,
}: TrustCenterModalProps) {
  const t = useTranslations('vendors');
  const toast = useToast();
  const utils = trpc.useUtils();

  const [url, setUrl] = useState(website ? `https://trust.${website.replace(/^https?:\/\//, '')}` : '');
  const [rawContent, setRawContent] = useState('');

  const ingestMutation = trpc.vendors.ingestTrustCenter.useMutation({
    onSuccess: (data) => {
      toast(t('trust_center.success_toast', { name: vendorName }), {
        description: t('trust_center.success_detail', { count: data.profile.certifications.length }),
      });
      utils.vendors.getOrgVendorDetails.invalidate();
      utils.vendors.getOrgVendors.invalidate();
      utils.vendors.getConcentrationAnalytics.invalidate();
      onClose();
    },
    onError: (err) => {
      toast(t('trust_center.error_toast'), {
        tone: 'error',
        description: err.message,
      });
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() && !rawContent.trim()) {
      toast(t('trust_center.missing_input'), { tone: 'error' });
      return;
    }
    ingestMutation.mutate({
      vendorId,
      trustCenterUrl: url.trim() || undefined,
      rawContent: rawContent.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#C9A227]/10 text-[#C9A227]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#F4F5F6]">
                {t('trust_center.modal_title')}
              </h3>
              <p className="text-xs text-[#9BA1A6] mt-0.5">
                {t('trust_center.modal_subtitle', { name: vendorName })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9BA1A6] hover:text-[#F4F5F6] hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#9BA1A6]">
              {t('trust_center.url_label')}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://trust.safebase.io/vendor or https://trust.vanta.com/..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090A] border border-white/10 text-sm text-[#F4F5F6] placeholder-[#6E747A] focus:outline-none focus:border-[#C9A227] transition-colors"
            />
            <p className="text-[11px] text-[#6E747A]">
              {t('trust_center.url_hint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#9BA1A6]">
              {t('trust_center.content_label')}
            </label>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              rows={4}
              placeholder={t('trust_center.content_placeholder')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090A] border border-white/10 text-xs text-[#F4F5F6] placeholder-[#6E747A] focus:outline-none focus:border-[#C9A227] transition-colors resize-none font-mono"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#08090A] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#C9A227]">
              <Sparkles className="h-3.5 w-3.5" />
              {t('trust_center.what_is_extracted')}
            </div>
            <ul className="text-[11px] text-[#9BA1A6] space-y-1 list-disc pl-4">
              <li>{t('trust_center.extract_1')}</li>
              <li>{t('trust_center.extract_2')}</li>
              <li>{t('trust_center.extract_3')}</li>
              <li>{t('trust_center.extract_4')}</li>
            </ul>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#9BA1A6] hover:text-[#F4F5F6] hover:bg-white/5 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={ingestMutation.isPending}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-[#C9A227] text-black font-semibold hover:bg-[#b08d20] disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {ingestMutation.isPending && (
                <div className="animate-spin h-3 w-3 border-2 border-black border-t-transparent rounded-full" />
              )}
              {t('trust_center.ingest_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
