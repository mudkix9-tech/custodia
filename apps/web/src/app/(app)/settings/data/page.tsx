"use client";

import { useState } from 'react';
import { Database, Download, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/utils/trpc';

export default function DataPrivacySettingsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isOwner = userRole === 'owner';

  const requestExport = trpc.data.requestExport.useMutation();
  const scheduleDeletion = trpc.data.scheduleDeletion.useMutation();

  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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
    if (confirm("Are you absolutely sure you want to permanently delete this organization? This action cannot be undone and will begin a 30-day deletion grace period.")) {
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
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Data & Privacy</h1>
          <p className="text-ink-600">Export your organization's data or delete your account.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Data Export */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Download className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Export Data</h2>
          </div>

          <p className="text-sm text-ink-600 mb-6 max-w-2xl">
            You can request a complete export of your organization's data. This includes all processing activities, vendor assessments, DSAR records, breaches, and uploaded documents.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              disabled={exportStatus === 'loading'}
              className="bg-white border border-ink-900/20 text-ink-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-bone-100 shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {exportStatus === 'loading' ? 'Requesting...' : 'Download All Data'}
            </button>
            <p className="text-xs text-ink-500">
              A zip file will be sent to your email when ready.
            </p>
          </div>

          {exportStatus === 'success' && (
            <div className="mt-4 p-3 bg-sage-50 text-sage-800 text-sm rounded-lg border border-sage-200">
              Export requested successfully! You will receive an email when it is ready.
            </div>
          )}
          {exportStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-50 text-red-800 text-sm rounded-lg border border-red-200">
              Failed to request data export. Please try again later.
            </div>
          )}
        </div>

        {/* Data Retention Information */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Database className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Data Retention Policy</h2>
          </div>

          <ul className="list-disc pl-5 space-y-2 text-sm text-ink-600">
            <li><strong>Active account data:</strong> retained as long as your account is active</li>
            <li><strong>Consent records:</strong> retained for 5 years after collection (regulatory requirement)</li>
            <li><strong>Audit logs:</strong> retained for 3 years after the event</li>
            <li><strong>Deleted account data:</strong> permanently removed 30 days after deletion request</li>
            <li><strong>Backups:</strong> purged within 90 days of deletion</li>
          </ul>
        </div>

        {/* Account Deletion */}
        {isOwner && (
          <div className="bg-red-50/50 rounded-2xl border border-red-200 p-6">
            <div className="flex items-center gap-2 mb-6 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-lg font-medium">Danger Zone</h2>
            </div>

            <p className="text-sm text-red-800 mb-6 max-w-2xl">
              Permanently delete this organization and all of its data. This action cannot be undone. Data will be hard-deleted after a 30-day grace period.
            </p>

            <button
              onClick={handleDelete}
              disabled={deleteStatus === 'loading' || deleteStatus === 'success'}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {deleteStatus === 'loading' ? 'Scheduling Deletion...' : deleteStatus === 'success' ? 'Scheduled' : 'Delete Organization'}
            </button>

            {deleteStatus === 'success' && (
              <div className="mt-4 p-3 bg-red-100 text-red-800 text-sm rounded-lg border border-red-300">
                Organization scheduled for deletion.
              </div>
            )}
            {deleteStatus === 'error' && (
              <div className="mt-4 p-3 bg-red-50 text-red-800 text-sm rounded-lg border border-red-200">
                Failed to schedule organization for deletion.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
