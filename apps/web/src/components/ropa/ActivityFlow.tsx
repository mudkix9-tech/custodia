"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { useRopaVocabulary, type VocabGroup } from '@/utils/ropaVocabularies';

/**
 * D41. The data-flow view for one activity: sources → subjects → activity → data →
 * recipients → transfers.
 *
 * Every buyer asks to see this in a demo, and the reason it is worth building
 * properly is the same reason it is worth showing: it is the only view of an
 * Article 30 record where a **missing** piece is as visible as a present one. An
 * empty Recipients column and an activity that genuinely discloses to nobody look
 * identical on a diagram, which is why the negative assertions are printed beneath
 * it rather than left to inference.
 *
 * Rendered as CSS columns rather than SVG, deliberately. It has to print — Q132's
 * record view is the page a lawyer is handed — and an SVG graph with computed edge
 * routing does not reflow onto A4, does not scale text, and cannot be read by a
 * screen reader. Columns with labelled groups do all three.
 */

const KIND_ACCENT: Record<string, string> = {
  source: 'border-white/10',
  subject: 'border-white/10',
  activity: 'border-[#C9A227]/40',
  data: 'border-white/10',
  recipient: 'border-white/10',
  transfer: 'border-white/10',
};

const EMPHASIS_TEXT: Record<string, string> = {
  high: 'text-[#C9A227]',
  medium: 'text-[#F4F5F6]',
  low: 'text-[#9BA1A6]',
};

export function ActivityFlow({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.flow');
  const vocab = useRopaVocabulary();
  const { data, isLoading } = trpc.ropa.insights.flow.useQuery({ activityId });

  if (isLoading) return <p className="text-[13px] text-[#6E747A] py-8 text-center">{t('loading')}</p>;
  if (!data) return null;

  const nodeById = new Map(data.nodes.map((n: any) => [n.id, n]));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('title')}</h2>
        <p className="text-[12px] text-[#6E747A] mt-1">{t('subtitle')}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-3 min-w-max pb-2">
          {data.columns.map((column: any, index: number) => (
            <React.Fragment key={column.kind}>
              {index > 0 ? (
                <div className="flex items-center px-1 text-[#6E747A] text-[18px] shrink-0" aria-hidden="true">→</div>
              ) : null}
              <div className="w-52 shrink-0">
                <p className="text-[11px] uppercase tracking-wide text-[#6E747A] mb-2">{t(`column_${column.kind}` as any)}</p>
                <ul className="space-y-2">
                  {column.nodeIds.map((id: string) => {
                    const node: any = nodeById.get(id);
                    if (!node) return null;
                    return (
                      <li
                        key={id}
                        className={`bg-[#0D0F11] border rounded-xl px-3 py-2 ${KIND_ACCENT[node.kind] ?? 'border-white/10'}`}
                      >
                        <p className={`text-[12.5px] ${EMPHASIS_TEXT[node.emphasis ?? 'medium']}`}>{node.label}</p>
                        {node.vocab ? (
                          <p className="text-[11px] text-[#6E747A] mt-0.5">
                            {vocab.label(node.vocab.group as VocabGroup, node.vocab.value)}
                          </p>
                        ) : node.detail ? (
                          <p className="text-[11px] text-[#6E747A] mt-0.5 line-clamp-2">{node.detail}</p>
                        ) : null}
                        {node.meta?.isChild ? <p className="text-[11px] text-[#C9A227] mt-0.5">{t('children')}</p> : null}
                        {node.meta?.isSpecialCategory ? <p className="text-[11px] text-[#C9A227] mt-0.5">{t('special_category')}</p> : null}
                        {node.meta?.adequate === false ? <p className="text-[11px] text-[#C9A227] mt-0.5">{t('not_adequate')}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* J93's rule, applied to a diagram. A blank column and "this activity
          discloses to nobody" are different statements and a reader cannot tell
          them apart from an empty picture. */}
      {data.assertions.length > 0 ? (
        <ul className="space-y-1 border-t border-white/5 pt-3">
          {data.assertions.map((a: string) => (
            <li key={a} className="text-[12px] text-[#9BA1A6]">{a}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
