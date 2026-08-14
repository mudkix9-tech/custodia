import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        <Dialog.Panel className="mx-auto max-w-lg w-full rounded-xl bg-[#0D0F11] p-6 shadow-2xl ring-1 ring-red-500/50">
          <Dialog.Title className="text-lg font-bold text-[#F4F5F6] flex items-center">
            <span className="bg-red-500/20 text-red-400 p-1.5 rounded-md mr-3">🚨</span>
            Report New Incident
          </Dialog.Title>
          
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9BA1A6]">Incident Title</label>
              <Input
                type="text"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                placeholder="e.g., Unauthorized access to CRM"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#9BA1A6]">Description</label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Briefly describe what happened..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#9BA1A6]">Discovery Method</label>
                <Select
                  value={form.discoveryMethod}
                  onValueChange={val => setForm({...form, discoveryMethod: val})}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal_monitoring">Internal Monitoring</SelectItem>
                    <SelectItem value="employee_report">Employee Report</SelectItem>
                    <SelectItem value="vendor_notification">Vendor Notification</SelectItem>
                    <SelectItem value="customer_report">Customer Report</SelectItem>
                    <SelectItem value="external_audit">External Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#9BA1A6]">Discovered At</label>
                <Input
                  type="datetime-local"
                  value={form.discoveredAt}
                  onChange={e => setForm({...form, discoveredAt: e.target.value})}
                  className="mt-1 w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#9BA1A6]">Breach Type</label>
              <Select
                value={form.breachType}
                onValueChange={val => setForm({...form, breachType: val})}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidentiality">Confidentiality (Unauthorized Access/Disclosure)</SelectItem>
                  <SelectItem value="integrity">Integrity (Unauthorized Alteration)</SelectItem>
                  <SelectItem value="availability">Availability (Loss of Access/Destruction)</SelectItem>
                  <SelectItem value="mixed">Mixed/Multiple</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-white/10 pt-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[#9BA1A6]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => reportMutation.mutate({ ...form, discoveredAt: new Date(form.discoveredAt) })}
              disabled={reportMutation.isPending || !form.title}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {reportMutation.isPending ? 'Starting...' : 'Start Triage Process'}
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
