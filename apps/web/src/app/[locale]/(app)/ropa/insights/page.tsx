"use client";

import React from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Compass, ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { RegisterInsights } from '@/components/ropa/RegisterInsights';

/**
 * D42, D43, P123, P125. What the register can say about itself.
 *
 * Full-bleed rather than the default measure: the data map is a four-column table
 * beside a facet rail, and at the reading width it wraps into something nobody can
 * scan.
 */
export default function RopaInsightsPage() {
  const router = useRouter();
  const t = useTranslations('ropa.insights');
  const tr = useTranslations('ropa');

  return (
    <PageShell width="wide" className="fade-up space-y-8">
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
              <Compass className="w-5 h-5 text-[#C9A227]" />
            </div>
            {t('title')}
          </h1>
          <p className="text-[13.5px] text-[#6E747A] mt-2 max-w-2xl">{t('subtitle')}</p>
        </div>
      </div>

      <RegisterInsights />
    </PageShell>
  );
}
