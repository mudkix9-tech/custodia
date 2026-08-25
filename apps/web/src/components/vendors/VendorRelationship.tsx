"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Download } from 'lucide-react';

/**
 * D33 — the vendor record's audit trail, rendered as a timeline.
 *
 * Reads the same audit_logs rows every tRPC mutation writes through the
 * middleware; the API renders each stored diff with the same field labels the
 * ROPA history uses, so a reader sees "DPA status · not signed → signed"
 * rather than a jsonb blob.
 */
export function VendorHistory({ vendorId }: { vendorId: string }) {
  const t = useTranslations('vendors');
  const utils = trpc.useUtils();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.vendors.history.useInfiniteQuery(
    { vendorId, limit: 25 },
    { getNextPageParam: (lastPage: any) => lastPage.nextCursor },
  );

  const exportMutation = trpc.vendors.exportHistoryCsv.useMutation({
    onSuccess: ({ csv, filename }) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      utils.vendors.history.invalidate({ vendorId });
    },
  });

  if (isLoading) {
    return <p className="text-[13px] text-[#6E747A]">{t('history.loading')}</p>;
  }

  const entries = data?.pages.flatMap((page: any) => page.entries) ?? [];

  if (entries.length === 0) {
    return (
      <div className="bg-[#08090A] rounded-xl border border-white/10 p-8 text-center">
        <History className="w-6 h-6 text-[#6E747A] mx-auto mb-3" />
        <p className="text-[13px] text-[#9BA1A6]">{t('history.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[#6E747A]">{t('history.description')}</p>
        <Button
          variant="outline"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate({ vendorId })}
          className="bg-[#08090A] border-white/10 hover:bg-white/5 text-[#9BA1A6] h-8 px-3 text-xs gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          {t('history.export')}
        </Button>
      </div>

      <ol className="relative border-l border-white/10 ml-3 space-y-6">
        {entries.map((entry: any) => (
          <li key={entry.id} className="ml-6">
            <span className={`absolute -left-[5px] flex w-2.5 h-2.5 rounded-full mt-1.5 ${
              entry.changeType === 'create' ? 'bg-[#C9A227]'
                : entry.changeType === 'delete' ? 'bg-red-400'
                : entry.changeType === 'update' ? 'bg-sky-400'
                : 'bg-[#6E747A]'
            }`} />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[13px] font-medium text-[#F4F5F6]">{entry.description || entry.action}</span>
              <time className="text-[11px] text-[#6E747A]">
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </div>
            {entry.userEmail && (
              <div className="text-[11px] text-[#9BA1A6] mt-0.5">{entry.userEmail}</div>
            )}
            {(entry.renderedChanges ?? []).length > 0 && (
              <div className="mt-2 space-y-1 bg-[#08090A] rounded-lg border border-white/5 p-3">
                {(entry.renderedChanges as Array<{ label: string; before: string; after: string }>).map((change) => (
                  <div key={change.label} className="text-[12px] leading-relaxed">
                    <span className="text-[#9BA1A6] font-medium">{change.label}: </span>
                    <span className="text-[#6E747A] line-through mr-2">{change.before}</span>
                    <span className="text-[#F4F5F6]">{change.after}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {hasNextPage && (
        <div className="text-center pt-2">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
            className="bg-[#08090A] border-white/10 hover:bg-white/5 text-[#9BA1A6] text-xs"
          >
            {t('history.load_more')}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * D32/D30 — the editable relationship record: owner, contact, criticality,
 * processing role, purpose, review date, lifecycle status and the Art.
 * 28(3)(g) deletion-certificate reference. Every field writes through
 * updateOrgVendor / setStatus, which recalculate risk where it changes.
 */
export function VendorRelationshipPanel({
  vendorId,
  orgVendor,
}: {
  vendorId: string;
  orgVendor: Record<string, any>;
}) {
  const t = useTranslations('vendors');
  const utils = trpc.useUtils();
  const updateMutation = trpc.vendors.updateOrgVendor.useMutation({
    onSettled: () => utils.vendors.getOrgVendorDetails.invalidate({ vendorId }),
  });
  const statusMutation = trpc.vendors.setStatus.useMutation({
    onSettled: () => utils.vendors.getOrgVendorDetails.invalidate({ vendorId }),
  });

  const [purposeDraft, setPurposeDraft] = React.useState(orgVendor.purpose ?? '');
  React.useEffect(() => setPurposeDraft(orgVendor.purpose ?? ''), [orgVendor.purpose]);

  const inputClass = 'w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40';

  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-[#F4F5F6] text-sm">{t('relationship.title')}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.business_owner')}
          </label>
          <Input
            value={(orgVendor.businessOwner as string) ?? ''}
            placeholder={t('relationship.business_owner_placeholder')}
            onChange={(e) => updateMutation.mutate({ vendorId, businessOwner: e.target.value || null })}
            disabled={updateMutation.isPending}
            onBlur={(e) => updateMutation.mutate({ vendorId, businessOwner: e.target.value || null })}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.contact_email')}
          </label>
          <Input
            type="email"
            value={(orgVendor.contactEmail as string) ?? ''}
            placeholder="dpo@vendor.com"
            onChange={(e) => updateMutation.mutate({ vendorId, contactEmail: e.target.value || null })}
            disabled={updateMutation.isPending}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.criticality')}
          </label>
          <Select
            value={(orgVendor.criticality as string) || 'unset'}
            onValueChange={(val) => updateMutation.mutate({ vendorId, criticality: val === 'unset' ? null : val as any })}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">{t('relationship.unset')}</SelectItem>
              <SelectItem value="low">{t('criticality.low')}</SelectItem>
              <SelectItem value="medium">{t('criticality.medium')}</SelectItem>
              <SelectItem value="high">{t('criticality.high')}</SelectItem>
              <SelectItem value="critical">{t('criticality.critical')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.processing_role')}
          </label>
          <Select
            value={(orgVendor.processingRole as string) || 'unset'}
            onValueChange={(val) => updateMutation.mutate({ vendorId, processingRole: val === 'unset' ? null : val as any })}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">{t('relationship.unset')}</SelectItem>
              <SelectItem value="processor">{t('role.processor')}</SelectItem>
              <SelectItem value="joint_controller">{t('role.joint_controller')}</SelectItem>
              <SelectItem value="independent_controller">{t('role.independent_controller')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Article 30(1)(d): what data actually goes to this recipient. Feeds
            the special-category factor of the risk engine. */}
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.data_categories')}
          </label>
          <DataCategoriesEditor vendorId={vendorId} selected={(orgVendor.dataCategoriesShared as string[]) ?? []} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.purpose')}
          </label>
          <Textarea
            rows={2}
            value={purposeDraft}
            placeholder={t('relationship.purpose_placeholder')}
            onChange={(e) => setPurposeDraft(e.target.value)}
            onBlur={() => {
              if ((orgVendor.purpose ?? '') !== purposeDraft) {
                updateMutation.mutate({ vendorId, purpose: purposeDraft || null });
              }
            }}
            disabled={updateMutation.isPending}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.next_review')}
          </label>
          <input
            type="date"
            value={orgVendor.nextReviewAt ? new Date(orgVendor.nextReviewAt).toISOString().split('T')[0] : ''}
            onChange={(e) => updateMutation.mutate({ vendorId, nextReviewAt: e.target.value || null })}
            disabled={updateMutation.isPending}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.status')}
          </label>
          <Select
            value={(orgVendor.status as string) || 'active'}
            onValueChange={(val) => statusMutation.mutate({ orgVendorId: orgVendor.id, status: val as 'active' | 'paused' | 'offboarded' })}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('status.active')}</SelectItem>
              <SelectItem value="paused">{t('status.paused')}</SelectItem>
              <SelectItem value="offboarded">{t('status.offboarded')}</SelectItem>
            </SelectContent>
          </Select>
          {orgVendor.offboardedAt && (
            <p className="text-[11px] text-[#6E747A]">
              {t('relationship.offboarded_on', { date: new Date(orgVendor.offboardedAt).toLocaleDateString() })}
            </p>
          )}
        </div>

        {orgVendor.status === 'offboarded' && (
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
              {t('relationship.deletion_certificate')}
            </label>
            <Input
              value={(orgVendor.deletionCertificateRef as string) ?? ''}
              placeholder={t('relationship.deletion_certificate_placeholder')}
              onChange={(e) => statusMutation.mutate({
                orgVendorId: orgVendor.id,
                status: 'offboarded',
                deletionCertificateRef: e.target.value || null,
              })}
              disabled={statusMutation.isPending}
              className={inputClass}
            />
            <p className="text-[11px] text-[#6E747A]">{t('relationship.deletion_certificate_hint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Chip editor for dataCategoriesShared -- the Art. 30(1)(d) write path (D2). */
function DataCategoriesEditor({ vendorId, selected }: { vendorId: string; selected: string[] }) {
  const t = useTranslations('vendors');
  const utils = trpc.useUtils();
  const updateMutation = trpc.vendors.updateOrgVendor.useMutation({
    onSettled: () => utils.vendors.getOrgVendorDetails.invalidate({ vendorId }),
  });
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const commit = (next: string[]) => {
    updateMutation.mutate({ vendorId, dataCategoriesShared: next });
  };

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (value.length > 120) {
      setError(t('relationship.category_too_long'));
      return;
    }
    if (selected.some((c) => c.toLowerCase() === value.toLowerCase())) {
      setError(t('relationship.category_duplicate'));
      return;
    }
    setError(null);
    setDraft('');
    commit([...selected, value]);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={t('relationship.category_placeholder')}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          disabled={updateMutation.isPending}
          className="flex-1 bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={updateMutation.isPending || !draft.trim()}
          className="bg-[#08090A] border-white/10 hover:bg-white/5 text-[#9BA1A6]"
        >
          {t('relationship.category_add')}
        </Button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((category) => (
            <button
              key={category}
              type="button"
              disabled={updateMutation.isPending}
              onClick={() => commit(selected.filter((c) => c !== category))}
              className="inline-flex items-center gap-1.5 bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] text-[12px] font-medium px-2.5 py-1 rounded-lg hover:border-[#C9A227]/60 transition-colors disabled:opacity-50"
            >
              {category}
              <span aria-hidden className="text-[14px] leading-none">×</span>
              <span className="sr-only">{t('relationship.category_remove')}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
