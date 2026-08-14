'use client';

import { useTranslations } from 'next-intl';
import { DsarDashboardClient } from '@/components/dsar/DsarDashboardClient';

export default function GroupDsarDashboardPage() {
  const t = useTranslations('group');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-1">{t('dsar_page.title')}</h1>
          <p className="text-sm text-[#9BA1A6]">{t('dsar_page.subtitle')}</p>
        </div>
      </div>
      
      <DsarDashboardClient isGroupContext={true} />
    </div>
  );
}
