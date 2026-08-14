import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { severityClasses } from '@/utils/severity';

export default function BreachList({ breaches, isLoading, isGroupContext }: { breaches: any[], isLoading: boolean, isGroupContext?: boolean }) {
  const t = useTranslations('breaches');
  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-12 bg-white/10 rounded"></div></div>;

  if (breaches.length === 0) {
    return (
      <div className="text-center py-12 bg-[#0D0F11] rounded-xl border border-dashed border-white/10">
        <h3 className="text-sm font-medium text-[#F4F5F6]">{t('list.empty_title')}</h3>
        <p className="text-sm text-[#9BA1A6] mt-1">{t('list.empty_subtitle')}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'detected': return 'bg-yellow-500/20 text-yellow-400';
      case 'assessing': return 'bg-orange-500/20 text-orange-400';
      case 'notified': return 'bg-blue-500/20 text-blue-400';
      case 'closed': return 'bg-green-500/20 text-green-400';
      default: return 'bg-white/10 text-[#E6E8EA]';
    }
  };

  // Breach likelihood shares the product-wide ramp; 'high' here is the top of
  // this scale, so it maps onto critical rather than the ramp's own 'high'.
  const getRiskColor = (risk: string) =>
    severityClasses(risk === 'high' ? 'critical' : risk === 'medium' ? 'high' : risk);

  return (
    <div className="bg-[#0D0F11] shadow-panel-elevated rounded-xl overflow-hidden border border-white/10">
      <table className="min-w-full divide-y divide-white/10">
        <thead className="bg-[#08090A]">
          <tr>
            {isGroupContext && <th className="px-6 py-3 text-left text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">{t('list.columns.entity')}</th>}
            <th className="px-6 py-3 text-left text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">{t('list.columns.reference')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">{t('list.columns.incident')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">{t('list.columns.status')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">{t('list.columns.risk_level')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">{t('list.columns.discovered')}</th>
            <th className="px-6 py-3 relative"></th>
          </tr>
        </thead>
        <tbody className="bg-[#0D0F11] divide-y divide-white/10">
          {breaches.map((b) => (
            <tr key={b.id} className="hover:bg-white/5">
              {isGroupContext && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#F4F5F6]">
                  {b.organizationName || t('list.unknown')}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#F4F5F6]">
                {b.referenceNumber}
              </td>
              <td className="px-6 py-4 text-sm text-[#9BA1A6]">
                <div className="font-medium text-[#F4F5F6]">{b.title}</div>
                <div className="truncate max-w-xs">{b.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(b.status)}`}>
                  {b.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRiskColor(b.riskToIndividuals || 'unassessed')}`}>
                  {b.riskToIndividuals || t('list.unassessed')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#9BA1A6]">
                {new Date(b.discoveredAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link href={isGroupContext ? `/group/breaches/${b.id}` : `/breaches/${b.id}`} className="text-indigo-400 hover:text-indigo-300">
                  {t('list.manage')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
