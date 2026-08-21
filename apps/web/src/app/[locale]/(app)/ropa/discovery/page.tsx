"use client";

import React from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Radar, ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { DiscoveryQueue } from '@/components/ropa/DiscoveryQueue';

/**
 * C34–C36. What the register is missing, from evidence the product already holds.
 *
 * This is the answer to "why does a forty-person company still spend the afternoon
 * typing": most of what belongs in their register is already somewhere in this
 * product — in the vendor list they built, in the tracker scan they ran, in the
 * systems they connected — and nothing had ever compared the three against the
 * register.
 */
export default function RopaDiscoveryPage() {
  const router = useRouter();
  const t = useTranslations('ropa.discovery');
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
              <Radar className="w-5 h-5 text-[#C9A227]" />
            </div>
            {t('title')}
          </h1>
          <p className="text-[13.5px] text-[#6E747A] mt-2 max-w-2xl">{t('subtitle')}</p>
        </div>
      </div>

      <DiscoveryQueue />
    </PageShell>
  );
}
