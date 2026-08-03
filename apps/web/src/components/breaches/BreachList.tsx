import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function BreachList({ breaches, isLoading, isGroupContext }: { breaches: any[], isLoading: boolean, isGroupContext?: boolean }) {
  const t = useTranslations('breaches');
  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-12 bg-gray-200 rounded"></div></div>;

  if (breaches.length === 0) {
    return (
      <div className="text-center py-12 bg-[#0D0F11] dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('list.empty_title')}</h3>
        <p className="text-sm text-gray-500 mt-1">{t('list.empty_subtitle')}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'detected': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'assessing': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'notified': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'closed': return 'bg-green-500/20 text-green-400 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'high': return 'bg-red-500/20 text-red-400 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'unlikely': return 'bg-green-500/20 text-green-400 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-[#0D0F11] dark:bg-gray-800 shadow-panel-elevated rounded-xl overflow-hidden ring-1 ring-black ring-opacity-5">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            {isGroupContext && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('list.columns.entity')}</th>}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('list.columns.reference')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('list.columns.incident')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('list.columns.status')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('list.columns.risk_level')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('list.columns.discovered')}</th>
            <th className="px-6 py-3 relative"></th>
          </tr>
        </thead>
        <tbody className="bg-[#0D0F11] dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {breaches.map((b) => (
            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              {isGroupContext && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {b.organizationName || t('list.unknown')}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {b.referenceNumber}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="font-medium text-gray-900 dark:text-white">{b.title}</div>
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
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {new Date(b.discoveredAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link href={isGroupContext ? `/group/breaches/${b.id}` : `/breaches/${b.id}`} className="text-indigo-400 hover:text-indigo-300 dark:text-indigo-400 dark:hover:text-indigo-300">
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
