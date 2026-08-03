"use client";

import { useState } from 'react';
import { Database, Download, AlertTriangle } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

import { useSession } from 'next-auth/react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';

export default function DataPrivacySettingsPage() {
  const t = useTranslations('settings.data');
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isOwner = userRole === 'owner';

  const requestExport = trpc.data.requestExport.useMutation();
  const scheduleDeletion = trpc.data.scheduleDeletion.useMutation();

  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const { confirm, dialog } = useConfirm();
  const org = trpc.settings.getOrgSettings.useQuery();

  const handleExport = async () => {
    setExportStatus('loading');
    try {
      await requestExport.mutateAsync();
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 5000);
    } catch (e) {
      console.error(e);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 5000);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: t('deletion.confirm_title'),
      description: t('deletion.confirm_description'),
      requireTyping: org.data?.name || t('deletion.confirm_word'),
      confirmText: t('deletion.confirm_text'),
      variant: 'destructive',
    });
    if (confirmed) {
      setDeleteStatus('loading');
      try {
        await scheduleDeletion.mutateAsync();
        setDeleteStatus('success');
      } catch (e) {
        console.error(e);
        setDeleteStatus('error');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Data Export */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Download className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('export.title')}</h2>
          </div>

          <p className="text-sm text-[#9BA1A6] mb-6 max-w-2xl">
            {t('export.description')}
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              disabled={exportStatus === 'loading'}
              className="bg-[#0D0F11] border border-white/20 text-[#F4F5F6] px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 shadow-panel-elevated flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {exportStatus === 'loading' ? t('export.requesting') : t('export.download')}
            </button>
            <p className="text-xs text-[#6E747A]">
              {t('export.email_notice')}
            </p>
          </div>

          {exportStatus === 'success' && (
            <div className="mt-4 p-3 bg-[#C9A227]/10 text-sage-800 text-sm rounded-lg border border-[#C9A227]/30">
              {t('export.success')}
            </div>
          )}
          {exportStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-900/50">
              {t('export.error')}
            </div>
          )}
        </div>

        {/* Data Retention Information */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Database className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('retention.title')}</h2>
          </div>

          <ul className="list-disc pl-5 space-y-2 text-sm text-[#9BA1A6]">
            <li><strong>{t('retention.active_label')}</strong> {t('retention.active')}</li>
            <li><strong>{t('retention.consent_label')}</strong> {t('retention.consent')}</li>
            <li><strong>{t('retention.audit_label')}</strong> {t('retention.audit')}</li>
            <li><strong>{t('retention.deleted_label')}</strong> {t('retention.deleted')}</li>
            <li><strong>{t('retention.backups_label')}</strong> {t('retention.backups')}</li>
          </ul>
        </div>

        {/* Account Deletion */}
        {isOwner && (
          <div className="bg-red-500/10/50 rounded-2xl border border-red-900/50 p-6">
            <div className="flex items-center gap-2 mb-6 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-lg font-medium">{t('deletion.title')}</h2>
            </div>

            <p className="text-sm text-red-400 mb-6 max-w-2xl">
              {t('deletion.description')}
            </p>

            <button
              onClick={handleDelete}
              disabled={deleteStatus === 'loading' || deleteStatus === 'success'}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {deleteStatus === 'loading' ? t('deletion.scheduling') : deleteStatus === 'success' ? t('deletion.scheduled') : t('deletion.delete')}
            </button>

            {deleteStatus === 'success' && (
              <div className="mt-4 p-3 bg-red-500/20 text-red-400 text-sm rounded-lg border border-red-300">
                {t('deletion.success')}
              </div>
            )}
            {deleteStatus === 'error' && (
              <div className="mt-4 p-3 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-900/50">
                {t('deletion.error')}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
