"use client";

import React from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { CalendarClock, ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { RetentionWorkbench } from '@/components/ropa/RetentionWorkbench';

/**
 * E47–E52. Retention management, out of the register's Retention tab and into an
 * object of its own.
 *
 * A retention rule belongs to the organisation, not to one activity — the Companies
 * Act six-year period applies to nine activities and is owned by one person. The
 * per-activity tab is where a record says which rule it follows; this is where the
 * rules live, get reviewed, and produce the disposal evidence an auditor asks for.
 */
export default function RopaRetentionPage() {
  const router = useRouter();
  const t = useTranslations('ropa.retention');
  const tr = useTranslations('ropa');

  return (
    <PageShell className="fade-up space-y-8">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/ropa')}
          aria-label={tr('record.back')}
          className="text-[#6E747A] hover:text-[#F4F5F6] mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] tracking-tight flex items-center gap-3">
            <div className="p-2 bg-[#0D0F11] rounded-xl shadow-card border border-white/10">
              <CalendarClock className="w-5 h-5 text-[#C9A227]" />
            </div>
            {t('title')}
          </h1>
          <p className="text-[13.5px] text-[#6E747A] mt-2 max-w-2xl">{t('subtitle')}</p>
        </div>
      </div>

      <RetentionWorkbench />
    </PageShell>
  );
}
