"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RopaEditor } from '@/components/ropa/RopaEditor';
import { DraftPanel } from '@/components/ropa/DraftPanel';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Sparkles, PencilLine } from 'lucide-react';

/**
 * C37. Two ways to start a record: describe it, or type it.
 *
 * The choice is offered rather than defaulted, because they suit different people.
 * A DPO recording an activity they already understand wants the form. Someone
 * handed "we use Intercom for live chat with European customers" and asked to make
 * an Article 30 record of it wants the draft — and what makes the draft worth
 * having is that they still read and accept every field.
 */
export default function NewRopaPage() {
  const t = useTranslations('ropa.draft');
  const [mode, setMode] = useState<'form' | 'draft'>('form');

  if (mode === 'form') {
    return (
      <div>
        <div className="mx-auto w-full max-w-[1240px] px-8 pt-8">
          <Button variant="ghost" onClick={() => setMode('draft')} className="text-[#9BA1A6]">
            <Sparkles className="w-4 h-4" aria-hidden="true" /> {t('switch_to_draft')}
          </Button>
        </div>
        <RopaEditor />
      </div>
    );
  }

  return (
    <PageShell width="narrow" className="fade-up space-y-6">
      <Button variant="ghost" onClick={() => setMode('form')} className="text-[#9BA1A6]">
        <PencilLine className="w-4 h-4" aria-hidden="true" /> {t('switch_to_form')}
      </Button>
      <DraftPanel />
    </PageShell>
  );
}
