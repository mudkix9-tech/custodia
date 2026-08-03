import { DsarDashboardClient } from '@/components/dsar/DsarDashboardClient';
import { useTranslations } from 'next-intl';

export default function DsarDashboardPage() {
  const t = useTranslations('dsar');
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-1">{t('title')}</h1>
          <p className="text-sm text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
      </div>
      
      <DsarDashboardClient />
    </div>
  );
}
