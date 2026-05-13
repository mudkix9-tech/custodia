import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { trpc } from '@/utils/trpc';

export default function ReportBreachModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const reportMutation = trpc.breaches.report.useMutation({
    onSuccess: () => onSuccess()
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    discoveryMethod: 'internal_monitoring',
    discoveredAt: new Date().toISOString().slice(0, 16),
    breachType: 'confidentiality',
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg w-full rounded-xl bg-white dark:bg-gray-800 p-6 shadow-2xl ring-1 ring-red-500/50">
          <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <span className="bg-red-100 text-red-600 p-1.5 rounded-md mr-3">🚨</span>
            Report New Incident
          </Dialog.Title>
          
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Incident Title</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                placeholder="e.g., Unauthorized access to CRM"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows={3}
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Briefly describe what happened..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Discovery Method</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={form.discoveryMethod}
                  onChange={e => setForm({...form, discoveryMethod: e.target.value})}
                >
                  <option value="internal_monitoring">Internal Monitoring</option>
                  <option value="employee_report">Employee Report</option>
                  <option value="vendor_notification">Vendor Notification</option>
                  <option value="customer_report">Customer Report</option>
                  <option value="external_audit">External Audit</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Discovered At</label>
                <input
                  type="datetime-local"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={form.discoveredAt}
                  onChange={e => setForm({...form, discoveredAt: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Breach Type</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={form.breachType}
                onChange={e => setForm({...form, breachType: e.target.value})}
              >
                <option value="confidentiality">Confidentiality (Unauthorized Access/Disclosure)</option>
                <option value="integrity">Integrity (Unauthorized Alteration)</option>
                <option value="availability">Availability (Loss of Access/Destruction)</option>
                <option value="mixed">Mixed/Multiple</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => reportMutation.mutate({ ...form, discoveredAt: new Date(form.discoveredAt) })}
              disabled={reportMutation.isPending || !form.title}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 flex items-center"
            >
              {reportMutation.isPending ? 'Starting...' : 'Start Triage Process'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
