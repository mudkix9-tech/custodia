"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { CheckCircle2, AlertTriangle, CircleDashed, Plus, ExternalLink, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Control-to-evidence linkage, which is what an auditor actually walks through.
 *
 * The module used to be a score, a gap list and an export: it could tell you
 * that you were 72% compliant but not point at the document that discharges
 * Article 30. Coverage here is per article, and an article counts as covered
 * only while at least one attached item is still in date — evidence that
 * expired last year demonstrates nothing.
 */

type CoverageArticle = {
  id: string;
  title: string;
  expects: string;
  chapter: string;
  evidenceCount: number;
  currentCount: number;
  expiredCount: number;
  status: string;
  lastCollectedAt: string | null;
};

const STATUS_STYLE: Record<string, { chip: string; Icon: typeof CheckCircle2 }> = {
  covered: { chip: 'bg-green-500/10 text-green-400 border-green-500/25', Icon: CheckCircle2 },
  expired: { chip: 'bg-amber-500/10 text-amber-400 border-amber-500/25', Icon: AlertTriangle },
  missing: { chip: 'bg-white/[0.06] text-[#6E747A] border-white/10', Icon: CircleDashed },
};

export function EvidenceLibrary() {
  const t = useTranslations('audit');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const utils = trpc.useUtils();

  const { data: coverage, isLoading } = trpc.audit.articleCoverage.useQuery();
  const { data: evidence } = trpc.audit.evidence.list.useQuery({});
  const [selected, setSelected] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const removeMutation = trpc.audit.evidence.remove.useMutation({
    onSuccess: () => {
      utils.audit.evidence.list.invalidate();
      utils.audit.articleCoverage.invalidate();
      toast(t('evidence_library.removed'));
    },
    onError: (err) => toast(t('evidence_library.remove_failed'), { tone: 'error', description: err.message }),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-[#6E747A]">{t('evidence_library.loading')}</div>;
  }
  if (!coverage) return null;

  const shown = selected
    ? coverage.articles.filter((a: CoverageArticle) => a.id === selected)
    : coverage.articles;

  const handleRemove = async (id: string, title: string) => {
    const ok = await confirm({
      title: t('evidence_library.remove_title', { title }),
      description: t('evidence_library.remove_description'),
      confirmText: t('evidence_library.remove_confirm'),
      variant: 'destructive',
    });
    if (ok) removeMutation.mutate({ id });
  };

  return (
    <div className="space-y-6">
      {dialog}

      {/* Headline. Deliberately separate from the compliance score: this measures
          documentation, not posture. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile label={t('evidence_library.summary.covered')} value={`${coverage.summary.covered}/${coverage.summary.total}`} tone="good" />
        <SummaryTile label={t('evidence_library.summary.expired')} value={coverage.summary.expired} tone={coverage.summary.expired > 0 ? 'warn' : 'neutral'} />
        <SummaryTile label={t('evidence_library.summary.missing')} value={coverage.summary.missing} tone={coverage.summary.missing > 0 ? 'bad' : 'neutral'} />
        <SummaryTile label={t('evidence_library.summary.documentation')} value={`${coverage.summary.percent}%`} tone="gold" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-serif text-[#F4F5F6]">{t('evidence_library.heading')}</h3>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-0.5 text-[11.5px] text-[#9BA1A6] hover:text-[#E6E8EA]"
            >
              {t('evidence_library.filter_chip', { id: selected })} <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463]"
        >
          <Plus className="h-4 w-4" /> {t('evidence_library.add')}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F11] shadow-panel-elevated">
        <ul className="divide-y divide-white/5">
          {shown.map((article: CoverageArticle) => {
            const { chip, Icon } = STATUS_STYLE[article.status] ?? STATUS_STYLE.missing;
            const items = (evidence ?? []).filter((e: any) => (e.articles as string[]).includes(article.id));

            return (
              <li key={article.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[12px] text-[#6E747A]">{t('evidence_library.article_prefix', { id: article.id })}</span>
                      <h4 className="text-[14.5px] font-medium text-[#F4F5F6]">{article.title}</h4>
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${chip}`}>
                        <Icon className="h-3 w-3" />
                        {t(`evidence_library.status.${article.status in STATUS_STYLE ? article.status : 'missing'}`)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#9BA1A6]">{article.expects}</p>
                  </div>
                  <button
                    onClick={() => setSelected(selected === article.id ? null : article.id)}
                    className="flex-none rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] text-[#9BA1A6] transition-colors hover:bg-white/5 hover:text-[#E6E8EA]"
                  >
                    {t('evidence_library.item_count', { count: items.length })}
                  </button>
                </div>

                {items.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-l border-white/10 pl-4">
                    {items.map((item: any) => {
                      const expired = item.validUntil && new Date(item.validUntil) <= new Date();
                      return (
                        <li key={item.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                          <span className="min-w-0 truncate">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#C9A227] hover:underline"
                              >
                                {item.title} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-[#E6E8EA]">{item.title}</span>
                            )}
                            {item.validUntil && (
                              <span className={expired ? 'ml-2 text-amber-400' : 'ml-2 text-[#6E747A]'}>
                                {expired
                                  ? t('evidence_library.expired_on', { date: new Date(item.validUntil).toLocaleDateString() })
                                  : t('evidence_library.review_by', { date: new Date(item.validUntil).toLocaleDateString() })}
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => handleRemove(item.id, item.title)}
                            aria-label={t('evidence_library.remove', { title: item.title })}
                            className="flex-none rounded p-1 text-[#6E747A] transition-colors hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {(evidence ?? []).length === 0 && (
          <EmptyState
            title={t('evidence_library.empty_title')}
            description={t('evidence_library.empty_description')}
            action={{ label: t('evidence_library.add'), onClick: () => setIsAdding(true) }}
          />
        )}
      </div>

      <AddEvidenceModal
        open={isAdding}
        onClose={() => setIsAdding(false)}
        articles={coverage.articles}
        preselected={selected}
      />
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: React.ReactNode; tone: 'good' | 'warn' | 'bad' | 'gold' | 'neutral' }) {
  const accent = {
    good: 'text-green-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    gold: 'text-[#C9A227]',
    neutral: 'text-[#F4F5F6]',
  }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D0F11] p-5 shadow-panel-elevated">
      <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-[#6E747A]">{label}</div>
      <div className={`font-serif text-3xl tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function AddEvidenceModal({
  open,
  onClose,
  articles,
  preselected,
}: {
  open: boolean;
  onClose: () => void;
  articles: CoverageArticle[];
  preselected: string | null;
}) {
  const t = useTranslations('audit');
  const toast = useToast();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [chosen, setChosen] = useState<string[]>(preselected ? [preselected] : []);

  const createMutation = trpc.audit.evidence.create.useMutation({
    onSuccess: () => {
      utils.audit.evidence.list.invalidate();
      utils.audit.articleCoverage.invalidate();
      toast(t('evidence_library.modal.added'));
      setTitle('');
      setUrl('');
      setValidUntil('');
      setChosen([]);
      onClose();
    },
    onError: (err) => toast(t('evidence_library.modal.failed'), { tone: 'error', description: err.message }),
  });

  if (!open) return null;

  const field =
    'w-full rounded-lg border border-white/10 bg-[#08090A] px-3 py-2 text-[14px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-evidence-title"
        className="rise-in flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#0D0F11] shadow-panel-elevated"
      >
        <div className="flex flex-none items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="add-evidence-title" className="font-serif text-lg text-[#F4F5F6]">{t('evidence_library.modal.title')}</h2>
          <button onClick={onClose} aria-label={t('evidence_library.modal.close')} className="rounded p-1 text-[#6E747A] hover:text-[#E6E8EA]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || chosen.length === 0) return;
            createMutation.mutate({
              title: title.trim(),
              articles: chosen,
              url: url.trim() || undefined,
              validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
            });
          }}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6"
        >
          <div>
            <label htmlFor="ev-title" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">
              {t('evidence_library.modal.what')} <span className="text-[#C9A227]">*</span>
            </label>
            <input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus
                   placeholder={t('evidence_library.modal.what_placeholder')} className={field} />
          </div>

          <div>
            <label htmlFor="ev-url" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">{t('evidence_library.modal.link')}</label>
            <input id="ev-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                   placeholder="https://…" className={field} />
          </div>

          <div>
            <label htmlFor="ev-valid" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">{t('evidence_library.modal.review_by')}</label>
            <input id="ev-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={field} />
            <p className="mt-1.5 text-[12px] text-[#6E747A]">
              {t('evidence_library.modal.review_by_help')}
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">
              {t('evidence_library.modal.articles')} <span className="text-[#C9A227]">*</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {articles.map((a) => {
                const on = chosen.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChosen((prev) => (on ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                    title={a.title}
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                      on
                        ? 'border-[#C9A227]/40 bg-[#C9A227]/15 text-[#C9A227]'
                        : 'border-white/10 text-[#9BA1A6] hover:text-[#E6E8EA]'
                    }`}
                  >
                    {t('evidence_library.article_prefix', { id: a.id })}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        <div className="flex flex-none justify-end gap-2.5 border-t border-white/10 px-6 py-4">
          <button onClick={onClose} type="button"
                  className="rounded-lg border border-white/10 px-4 py-2 text-[13.5px] text-[#E6E8EA] hover:bg-white/5">
            {t('evidence_library.modal.cancel')}
          </button>
          <button
            type="button"
            disabled={!title.trim() || chosen.length === 0 || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                title: title.trim(),
                articles: chosen,
                url: url.trim() || undefined,
                validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
              })
            }
            className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? t('evidence_library.modal.submitting') : t('evidence_library.modal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
