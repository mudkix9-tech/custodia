"use client";

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { ShieldAlert, Plus, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

/**
 * F57. The register of assessments, which the module did not have.
 *
 * Everything about a DPIA was reachable only through a processing activity, so an
 * assessment covering four activities had to be found through whichever one
 * happened to be linked, and the questions a DPO is actually asked — which
 * assessments are unsigned, which are overdue for review, which carry a residual
 * risk high enough to need Article 36 prior consultation — had no answer.
 *
 * Those three are the filters, because they are the three that mean work.
 */

type Filter = 'all' | 'draft' | 'overdue' | 'prior_consultation';

export function DpiaListClient() {
  const t = useTranslations('ropa.dpia.module');
  const tRopa = useTranslations('ropa');
  const toast = useToast();
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [title, setTitle] = useState('');

  const { data: dpias, isLoading, refetch } = trpc.dpia.list.useQuery();
  const { data: templates } = trpc.dpia.templates.useQuery();
  const createFromTemplate = trpc.dpia.createFromTemplate.useMutation();

  const now = Date.now();

  const rows = useMemo(() => {
    const all = (dpias ?? []) as any[];
    if (filter === 'draft') return all.filter((d) => d.status !== 'signed_off');
    if (filter === 'overdue') return all.filter((d) => d.nextReviewAt && new Date(d.nextReviewAt).getTime() < now);
    if (filter === 'prior_consultation') return all.filter((d) => d.requiresPriorConsultation);
    return all;
  }, [dpias, filter, now]);

  const counts = useMemo(() => {
    const all = (dpias ?? []) as any[];
    return {
      all: all.length,
      draft: all.filter((d) => d.status !== 'signed_off').length,
      overdue: all.filter((d) => d.nextReviewAt && new Date(d.nextReviewAt).getTime() < now).length,
      prior_consultation: all.filter((d) => d.requiresPriorConsultation).length,
    };
  }, [dpias, now]);

  const handleCreate = async (templateId: string) => {
    try {
      const dpia = await createFromTemplate.mutateAsync({
        templateId,
        title: title.trim() || (templates ?? []).find((x: any) => x.id === templateId)?.title || templateId,
      });
      refetch();
      router.push(`/dpia/${dpia.id}`);
    } catch (err) {
      toast(t('create_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  const FilterTab = ({ id, label, count }: { id: Filter; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      className={`px-3 py-1.5 rounded-lg text-[12.5px] border transition-colors ${
        filter === id
          ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#C9A227]'
          : 'border-white/10 text-[#9BA1A6] hover:border-white/20'
      }`}
    >
      {label} <span className="text-[#6E747A]">{count}</span>
    </button>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] tracking-tight flex items-center gap-3">
            <div className="p-2 bg-[#0D0F11] rounded-xl shadow-card border border-white/10">
              <ShieldAlert className="w-5 h-5 text-[#C9A227]" aria-hidden="true" />
            </div>
            {t('title')}
          </h1>
          <p className="text-[13.5px] text-[#6E747A] mt-2 max-w-2xl">{t('subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          aria-expanded={showTemplates}
          className="px-4 py-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-medium text-[13px] rounded-lg flex items-center gap-2 shadow-card"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('new')}
        </button>
      </div>

      {showTemplates ? (
        <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('templates_title')}</h2>
            <p className="text-[12px] text-[#6E747A] mt-1 max-w-2xl">{t('templates_hint')}</p>
          </div>

          <div>
            <label htmlFor="dpia-title" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_title')}</label>
            <input
              id="dpia-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full max-w-lg bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(templates ?? []).map((template: any) => (
              <button
                key={template.id}
                type="button"
                disabled={createFromTemplate.isPending}
                onClick={() => handleCreate(template.id)}
                className="text-left rounded-xl border border-white/10 bg-[#0D0F11] p-4 hover:border-white/20 disabled:opacity-50"
              >
                <div className="text-[13px] font-medium text-[#F4F5F6]">{template.title}</div>
                <div className="text-[11.5px] text-[#6E747A] mt-1">{template.summary}</div>
                <div className="text-[11.5px] text-[#C9A227] mt-2">
                  {t('template_risks', { count: template.riskCount })}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <FilterTab id="all" label={t('filter_all')} count={counts.all} />
        <FilterTab id="draft" label={t('filter_draft')} count={counts.draft} />
        <FilterTab id="overdue" label={t('filter_overdue')} count={counts.overdue} />
        <FilterTab id="prior_consultation" label={t('filter_prior_consultation')} count={counts.prior_consultation} />
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center" role="status" aria-label={t('loading')}>
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/20 rounded-2xl bg-[#08090A]/50">
          <ShieldAlert className="w-6 h-6 text-[#6E747A] mx-auto mb-3" aria-hidden="true" />
          <p className="text-[13px] text-[#6E747A]">{filter === 'all' ? t('empty') : t('empty_filtered')}</p>
        </div>
      ) : (
        <div className="bg-[#08090A] hairline rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="px-5 py-3 text-[11.5px] font-medium text-[#6E747A]">{t('col_title')}</th>
                <th scope="col" className="px-5 py-3 text-[11.5px] font-medium text-[#6E747A]">{t('col_status')}</th>
                <th scope="col" className="px-5 py-3 text-[11.5px] font-medium text-[#6E747A]">{t('col_residual')}</th>
                <th scope="col" className="px-5 py-3 text-[11.5px] font-medium text-[#6E747A]">{t('col_review')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((dpia: any) => {
                const overdue = dpia.nextReviewAt && new Date(dpia.nextReviewAt).getTime() < now;
                return (
                  <tr
                    key={dpia.id}
                    onClick={() => router.push(`/dpia/${dpia.id}`)}
                    className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="text-[13px] text-[#F4F5F6]">{dpia.title}</div>
                      {dpia.requiresPriorConsultation ? (
                        <div className="text-[11.5px] text-clay-600 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          {t('needs_prior_consultation')}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#9BA1A6]">
                      <span className="inline-flex items-center gap-1.5">
                        {dpia.status === 'signed_off' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
                        ) : null}
                        {t(`status_${dpia.status}` as any)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#9BA1A6]">
                      {dpia.residualRiskLevel ? tRopa(`risk_levels.${dpia.residualRiskLevel}` as any) : '—'}
                    </td>
                    <td className="px-5 py-3 text-[12.5px]">
                      {dpia.nextReviewAt ? (
                        <span className={`inline-flex items-center gap-1.5 ${overdue ? 'text-amber-400' : 'text-[#9BA1A6]'}`}>
                          {overdue ? <Clock className="w-3.5 h-3.5" aria-hidden="true" /> : null}
                          {new Date(dpia.nextReviewAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[#6E747A]">{t('no_review_scheduled')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
