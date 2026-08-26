"use client";

import React, { useState } from 'react';
import { X, Building2, ShieldAlert } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';

export function VendorIntakeModal({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const t = useTranslations('vendors');
  const toast = useToast();

  const [vendorName, setVendorName] = useState('');
  const [vendorWebsite, setVendorWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [businessOwner, setBusinessOwner] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dataCategoriesInput, setDataCategoriesInput] = useState('');
  const [criticality, setCriticality] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [estimatedDataSubjects, setEstimatedDataSubjects] = useState('<1K');

  const submitMutation = trpc.vendorIntake.submit.useMutation({
    onSuccess: () => {
      toast(t('intake.toast_submitted'));
      setVendorName('');
      setVendorWebsite('');
      setCategory('');
      setBusinessOwner('');
      setPurpose('');
      setDataCategoriesInput('');
      setCriticality('medium');
      setEstimatedDataSubjects('<1K');
      onSubmitted?.();
      onClose();
    },
    onError: (err) => {
      toast(err.message, { tone: 'error' });
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || submitMutation.isPending) return;

    const dataCategories = dataCategoriesInput
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    submitMutation.mutate({
      vendorName: vendorName.trim(),
      vendorWebsite: vendorWebsite.trim() || undefined,
      category: category.trim() || undefined,
      businessOwner: businessOwner.trim() || undefined,
      purpose: purpose.trim() || undefined,
      dataCategories,
      criticality,
      estimatedDataSubjects,
    });
  };

  const field =
    'w-full px-3 py-2 bg-[#08090A] border border-white/10 rounded-lg text-sm text-[#F4F5F6] placeholder-[#6E747A] focus:outline-none focus:border-[#C9A227] transition-colors';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intake-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-xl bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#C9A227]/10 text-[#C9A227]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="intake-modal-title" className="text-lg font-semibold text-[#F4F5F6]">
                {t('intake.modal_title')}
              </h3>
              <p className="text-xs text-[#9BA1A6]">{t('intake.modal_subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-[#9BA1A6] hover:text-[#F4F5F6] hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                {t('intake.field_name')} <span className="text-[#C9A227]">*</span>
              </label>
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Supabase, Datadog"
                className={field}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                {t('intake.field_website')}
              </label>
              <input
                type="text"
                value={vendorWebsite}
                onChange={(e) => setVendorWebsite(e.target.value)}
                placeholder="https://vendor.com"
                className={field}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                {t('intake.field_category')}
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Cloud Hosting, CRM, Analytics"
                className={field}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                {t('intake.field_owner')}
              </label>
              <input
                type="text"
                value={businessOwner}
                onChange={(e) => setBusinessOwner(e.target.value)}
                placeholder="e.g. jane@company.com"
                className={field}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
              {t('intake.field_purpose')}
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Why does your team need this tool and what business process will it support?"
              className={field}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
              {t('intake.field_data_categories')}
            </label>
            <input
              type="text"
              value={dataCategoriesInput}
              onChange={(e) => setDataCategoriesInput(e.target.value)}
              placeholder="Comma-separated: contact_details, customer_support, telemetry"
              className={field}
            />
            <p className="text-[11px] text-[#6E747A] mt-1">
              Separate multiple categories with commas. Special category data (Art. 9) will trigger enhanced DPO review.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                {t('intake.field_criticality')}
              </label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value as any)}
                className={field}
              >
                <option value="low">Low (Non-essential tooling)</option>
                <option value="medium">Medium (Standard operational)</option>
                <option value="high">High (Core business service)</option>
                <option value="critical">Critical (Mission-critical / high volume)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1A6] mb-1">
                {t('intake.field_subjects')}
              </label>
              <select
                value={estimatedDataSubjects}
                onChange={(e) => setEstimatedDataSubjects(e.target.value)}
                className={field}
              >
                <option value="<1K">&lt; 1,000 subjects</option>
                <option value="1K-10K">1,000 – 10,000 subjects</option>
                <option value="10K-100K">10,000 – 100,000 subjects</option>
                <option value="100K+">100,000+ subjects</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#9BA1A6] hover:text-[#F4F5F6] transition-colors"
            >
              {t('import.common_cancel')}
            </button>
            <button
              type="submit"
              disabled={!vendorName.trim() || submitMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-[#C9A227] text-black rounded-lg hover:bg-[#d6ad30] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitMutation.isPending ? t('intake.submitting') : t('intake.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
