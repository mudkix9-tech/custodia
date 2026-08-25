"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Download, ShieldAlert, Check, Loader2, AlertTriangle } from 'lucide-react';
import {
  VENDOR_DATA_CATEGORIES,
  isKnownDataCategory,
  isSpecialDataCategory,
  MAX_DATA_CATEGORIES,
  MAX_DATA_CATEGORY_LENGTH,
} from '@/constants/vendorDataCategories';

const inputClass =
  'w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40';

/**
 * A text input that keeps its own draft and commits when the user leaves it.
 *
 * Declared at module scope, not inside the panel: a component defined during a
 * render is a new type on every pass, so React remounts it and a controlled
 * input loses focus — see the note in CLAUDE.md.
 *
 * The reason it exists at all is the pattern it replaces. The first version of
 * this panel bound `value` straight to server state, fired the mutation from
 * `onChange`, and set `disabled={mutation.isPending}`. Every keystroke therefore
 * disabled the field, which blurred it, and reverted the displayed value to
 * whatever the server last returned — so the form accepted one character per
 * click. The contact-email field was worse than that: `z.string().email()`
 * rejects "d", so the first keystroke failed validation, the field cleared, and
 * no email address could ever be entered at all.
 */
function DraftField({
  value,
  onCommit,
  placeholder,
  type = 'text',
  multiline = false,
  invalid,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  invalid?: (draft: string) => string | null;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const [focused, setFocused] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Adopt server changes only while the user is not typing into the field —
  // otherwise a refetch mid-edit overwrites what they are part-way through.
  React.useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const trimmed = draft.trim();
    if (trimmed === (value ?? '').trim()) return;
    const message = invalid?.(trimmed) ?? null;
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    onCommit(trimmed);
  };

  const shared = {
    value: draft,
    placeholder,
    'aria-label': ariaLabel,
    'aria-invalid': error ? true : undefined,
    onFocus: () => setFocused(true),
    onBlur: commit,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      if (error) setError(null);
    },
    className: inputClass,
  };

  return (
    <div className="space-y-1">
      {multiline
        ? <Textarea rows={2} {...shared} />
        : <Input
            type={type}
            {...shared}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            }}
          />}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

/** Saving / saved / failed, in the corner of the panel rather than on each field. */
function SaveState({ pending, error, savedLabel, savingLabel }: {
  pending: boolean;
  error: string | null;
  savedLabel: string;
  savingLabel: string;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-400">
        <AlertTriangle className="w-3.5 h-3.5" /> {error}
      </span>
    );
  }
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6E747A]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {savingLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6E747A]">
      <Check className="w-3.5 h-3.5" /> {savedLabel}
    </span>
  );
}

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
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // The blob is held until the document unloads otherwise — a few of these
      // per session is a few megabytes of CSV pinned in memory for no reason.
      URL.revokeObjectURL(url);
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
 * 28(3)(g) deletion-certificate reference.
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

  const refresh = () => {
    utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
    // The register's tiles and rows both move when a relationship changes: risk
    // is recomputed on save, and the status filter decides whether the row is
    // still in the default list at all.
    utils.vendors.getOrgVendors.invalidate();
    utils.vendors.getRiskStats.invalidate();
    utils.vendors.history.invalidate({ vendorId });
  };

  const updateMutation = trpc.vendors.updateOrgVendor.useMutation({ onSettled: refresh });
  const statusMutation = trpc.vendors.setStatus.useMutation({ onSettled: refresh });
  const attestMutation = trpc.vendors.attestReview.useMutation({ onSettled: refresh });

  const pending = updateMutation.isPending || statusMutation.isPending || attestMutation.isPending;
  const error = updateMutation.error?.message
    ?? statusMutation.error?.message
    ?? attestMutation.error?.message
    ?? null;

  const status = (orgVendor.status as string) || 'active';
  const isOffboarded = status === 'offboarded';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="font-semibold text-[#F4F5F6] text-sm">{t('relationship.title')}</h4>
        <SaveState
          pending={pending}
          error={error}
          savedLabel={t('relationship.saved')}
          savingLabel={t('relationship.saving')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.business_owner')}
          </label>
          <DraftField
            value={(orgVendor.businessOwner as string) ?? ''}
            placeholder={t('relationship.business_owner_placeholder')}
            ariaLabel={t('relationship.business_owner')}
            onCommit={(next) => updateMutation.mutate({ vendorId, businessOwner: next || null })}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.contact_email')}
          </label>
          <DraftField
            type="email"
            value={(orgVendor.contactEmail as string) ?? ''}
            placeholder="dpo@vendor.com"
            ariaLabel={t('relationship.contact_email')}
            // Validated here as well as on the server so the message names the
            // field rather than arriving as a tRPC error at the top of the panel.
            invalid={(draft) => (!draft || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft)
              ? null
              : t('relationship.contact_email_invalid'))}
            onCommit={(next) => updateMutation.mutate({ vendorId, contactEmail: next || null })}
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
          {orgVendor.processingRole === 'joint_controller' && (
            <p className="text-[11px] text-[#6E747A]">{t('relationship.joint_controller_hint')}</p>
          )}
        </div>

        {/* Article 30(1)(d): what data actually goes to this recipient. Feeds
            the special-category factor of the risk engine. */}
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.data_categories')}
          </label>
          <DataCategoriesEditor
            vendorId={vendorId}
            selected={(orgVendor.dataCategoriesShared as string[]) ?? []}
            onSaved={refresh}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.purpose')}
          </label>
          <DraftField
            multiline
            value={(orgVendor.purpose as string) ?? ''}
            placeholder={t('relationship.purpose_placeholder')}
            ariaLabel={t('relationship.purpose')}
            onCommit={(next) => updateMutation.mutate({ vendorId, purpose: next || null })}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.status')}
          </label>
          <Select
            value={status}
            onValueChange={(val) => statusMutation.mutate({ vendorId, status: val as 'active' | 'paused' | 'offboarded' })}
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
          {isOffboarded && orgVendor.offboardedAt && (
            <p className="text-[11px] text-[#6E747A]">
              {t('relationship.offboarded_on', { date: new Date(orgVendor.offboardedAt).toLocaleDateString() })}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            {t('relationship.next_review')}
          </label>
          <input
            type="date"
            value={orgVendor.nextReviewAt ? new Date(orgVendor.nextReviewAt).toISOString().split('T')[0] : ''}
            onChange={(e) => updateMutation.mutate({ vendorId, nextReviewAt: e.target.value || null })}
            aria-label={t('relationship.next_review')}
            className={inputClass}
          />
        </div>

        {isOffboarded && (
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
              {t('relationship.deletion_certificate')}
            </label>
            <DraftField
              value={(orgVendor.deletionCertificateRef as string) ?? ''}
              placeholder={t('relationship.deletion_certificate_placeholder')}
              ariaLabel={t('relationship.deletion_certificate')}
              // Commits on blur, once. Firing per keystroke re-stamped
              // `offboardedAt` on every character, so the recorded
              // end-of-processing date drifted to whenever the box was last
              // touched — the one date on this panel that is evidence.
              onCommit={(next) => statusMutation.mutate({
                vendorId,
                status: 'offboarded',
                deletionCertificateRef: next || null,
              })}
            />
            <p className="text-[11px] text-[#6E747A]">{t('relationship.deletion_certificate_hint')}</p>
          </div>
        )}
      </div>

      <ReviewAttestation
        vendorId={vendorId}
        lastReviewedAt={orgVendor.lastReviewedAt as string | null}
        pending={attestMutation.isPending}
        onAttest={(months) => attestMutation.mutate({ vendorId, nextReviewInMonths: months })}
      />
    </div>
  );
}

/**
 * D31 — reviewing is a statement, not a side effect of editing.
 *
 * `lastReviewedAt` used to be stamped by every save, which meant the
 * overdue-review rule could be silenced by typing in the notes box. It is its
 * own control now, and the only thing that writes that column.
 */
function ReviewAttestation({
  vendorId,
  lastReviewedAt,
  pending,
  onAttest,
}: {
  vendorId: string;
  lastReviewedAt: string | null;
  pending: boolean;
  onAttest: (months: number | null) => void;
}) {
  const t = useTranslations('vendors');
  const [months, setMonths] = React.useState('12');

  return (
    <div className="border-t border-white/10 pt-6 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[220px]">
        <p className="text-[13px] font-medium text-[#F4F5F6]">{t('relationship.review_title')}</p>
        <p className="text-[11px] text-[#6E747A] mt-0.5">
          {lastReviewedAt
            ? t('relationship.review_last', { date: new Date(lastReviewedAt).toLocaleDateString() })
            : t('relationship.review_never')}
        </p>
      </div>
      <Select value={months} onValueChange={setMonths}>
        <SelectTrigger className={`${inputClass} w-auto min-w-[160px]`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">{t('relationship.review_in_months', { months: 3 })}</SelectItem>
          <SelectItem value="6">{t('relationship.review_in_months', { months: 6 })}</SelectItem>
          <SelectItem value="12">{t('relationship.review_in_months', { months: 12 })}</SelectItem>
          <SelectItem value="24">{t('relationship.review_in_months', { months: 24 })}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        onClick={() => onAttest(Number(months))}
        disabled={pending}
        className="bg-[#C9A227] hover:bg-[#C9A227]/90 text-[#08090A] font-medium"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {t('relationship.review_attest')}
      </Button>
    </div>
  );
}

/**
 * D30 — removing a vendor from the register, with the consequences named first.
 *
 * Four tables cascade from the join row: completed questionnaires, questionnaire
 * invitations, the Art. 28(2) sub-processor change log and incident alerts. A
 * plain delete therefore destroyed the material the audit trail above it exists
 * to preserve, and the server now refuses unless the caller says otherwise. This
 * asks `unlinkImpact` first so "remove from register" is never the moment
 * somebody discovers they are deleting three completed assessments — and it
 * offers offboarding, which is almost always what was actually meant.
 */
export function UnlinkVendor({ vendorId }: { vendorId: string }) {
  const t = useTranslations('vendors');
  const utils = trpc.useUtils();
  const [open, setOpen] = React.useState(false);

  const { data: impact } = trpc.vendors.unlinkImpact.useQuery({ vendorId }, { enabled: open });
  const statusMutation = trpc.vendors.setStatus.useMutation({
    onSettled: () => {
      utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
      utils.vendors.getOrgVendors.invalidate();
      setOpen(false);
    },
  });
  const unlinkMutation = trpc.vendors.unlinkVendor.useMutation({
    onSuccess: () => {
      utils.vendors.getOrgVendors.invalidate();
      utils.vendors.getRiskStats.invalidate();
      window.location.href = '/vendors';
    },
  });

  const hasEvidence = (impact?.total ?? 0) > 0;

  return (
    <div className="space-y-3">
      {!open ? (
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="bg-[#08090A] border-red-900/40 text-red-300 hover:bg-red-500/5 hover:border-red-800/60"
        >
          {t('relationship.unlink')}
        </Button>
      ) : (
        <div className="border border-red-900/40 bg-red-500/5 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-[14px] font-medium text-[#F4F5F6]">{t('relationship.unlink_title')}</p>
            <p className="text-[12px] text-[#9BA1A6] mt-1">{t('relationship.unlink_body')}</p>
          </div>

          {hasEvidence && (
            <p className="text-[12px] text-red-300 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {t('relationship.unlink_evidence', { count: impact!.total })}
            </p>
          )}

          {unlinkMutation.error && (
            <p className="text-[12px] text-red-400">{unlinkMutation.error.message}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => statusMutation.mutate({ vendorId, status: 'offboarded' })}
              disabled={statusMutation.isPending}
              className="bg-[#C9A227] hover:bg-[#C9A227]/90 text-[#08090A] font-medium"
            >
              {t('relationship.unlink_offboard_instead')}
            </Button>
            <Button
              variant="outline"
              onClick={() => unlinkMutation.mutate({ vendorId, discardEvidence: hasEvidence })}
              disabled={unlinkMutation.isPending}
              className="bg-[#08090A] border-red-900/40 text-red-300 hover:bg-red-500/10"
            >
              {unlinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('relationship.unlink_confirm')}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="bg-[#08090A] border-white/10 text-[#9BA1A6]">
              {t('relationship.unlink_cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The Art. 30(1)(d) picker (D2).
 *
 * A controlled vocabulary rather than the free-text box this replaced. The
 * risk engine's Article 9 factor and the `missing_dpa_special_category` gap
 * rule both read this column, and they used to read it by scanning for English
 * words — so a German customer typing "Gesundheitsdaten" into a field whose own
 * placeholder was German got a silent "no special categories here". Keys are
 * locale-independent; the labels below come from the catalogue.
 *
 * Free text is still accepted, because no vocabulary covers everything and
 * refusing the value loses the fact. Anything unrecognised is kept verbatim and
 * marked as custom, and the server still runs it through the keyword fallback.
 */
function DataCategoriesEditor({
  vendorId,
  selected,
  onSaved,
}: {
  vendorId: string;
  selected: string[];
  onSaved: () => void;
}) {
  const t = useTranslations('vendors');
  const updateMutation = trpc.vendors.updateOrgVendor.useMutation({ onSettled: onSaved });
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const label = (key: string) =>
    (isKnownDataCategory(key) ? t(`data_category.${key}` as any) : key);

  const commit = (next: string[]) => {
    setError(null);
    updateMutation.mutate({ vendorId, dataCategoriesShared: next });
  };

  const add = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (value.length > MAX_DATA_CATEGORY_LENGTH) {
      setError(t('relationship.category_too_long'));
      return;
    }
    if (selected.length >= MAX_DATA_CATEGORIES) {
      setError(t('relationship.category_limit'));
      return;
    }
    if (selected.some((c) => c.toLowerCase() === value.toLowerCase())) {
      setError(t('relationship.category_duplicate'));
      return;
    }
    setDraft('');
    commit([...selected, value]);
  };

  const unselected = VENDOR_DATA_CATEGORIES.filter((c) => !selected.includes(c.key));

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((category) => {
            const special = isSpecialDataCategory(category);
            const custom = !isKnownDataCategory(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => commit(selected.filter((c) => c !== category))}
                title={t('relationship.category_remove')}
                className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                  special
                    ? 'bg-red-500/10 border-red-400/40 text-red-300 hover:border-red-400/70'
                    : 'bg-[#C9A227]/10 border-[#C9A227]/30 text-[#C9A227] hover:border-[#C9A227]/60'
                }`}
              >
                {special && <ShieldAlert className="w-3 h-3" aria-hidden />}
                {label(category)}
                {custom && <span className="text-[10px] opacity-70">({t('relationship.category_custom')})</span>}
                <span aria-hidden className="text-[14px] leading-none">×</span>
                <span className="sr-only">{t('relationship.category_remove')}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value="" onValueChange={(val) => add(val)}>
          <SelectTrigger className={`${inputClass} sm:w-72`} aria-label={t('relationship.data_categories')}>
            <SelectValue placeholder={t('relationship.category_pick')} />
          </SelectTrigger>
          <SelectContent>
            {unselected.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.special ? `⚠ ${t(`data_category.${option.key}` as any)}` : t(`data_category.${option.key}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 flex-1 min-w-[240px]">
          <Input
            value={draft}
            placeholder={t('relationship.category_placeholder')}
            aria-label={t('relationship.category_custom')}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
            className={`flex-1 ${inputClass}`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => add(draft)}
            disabled={!draft.trim()}
            className="bg-[#08090A] border-white/10 hover:bg-white/5 text-[#9BA1A6]"
          >
            {t('relationship.category_add')}
          </Button>
        </div>
      </div>

      {selected.some((c) => isSpecialDataCategory(c)) && (
        <p className="text-[11px] text-red-300/80">{t('relationship.category_special_note')}</p>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {updateMutation.error && (
        <p className="text-[11px] text-red-400">{updateMutation.error.message}</p>
      )}
    </div>
  );
}
