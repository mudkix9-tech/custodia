"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { Save, ArrowLeft, AlertCircle, Info, ExternalLink, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FieldError } from '@/components/ui/FieldError';
import { announce } from '@/components/layout/Announcer';

import { DataCategoriesTab } from './tabs/DataCategoriesTab';
import { RecipientsTab } from './tabs/RecipientsTab';
import { TransfersTab } from './tabs/TransfersTab';
import { DpiaTab } from './tabs/DpiaTab';
import { HistoryTab } from './tabs/HistoryTab';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'legal', label: 'Legal Basis' },
  { id: 'data', label: 'Data Categories' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'retention', label: 'Retention' },
  { id: 'security', label: 'Security' },
  { id: 'dpia', label: 'DPIA' },
  { id: 'history', label: 'History' },
];

const ropaSchema = z.object({
  name: z.string().min(1, 'Activity name is required'),
  purpose: z.string().min(10, 'Purpose must be at least 10 characters'),
  description: z.string().optional(),
  status: z.string(),
  riskLevel: z.string(),
  lawfulBasis: z.string().min(1, 'Lawful basis is required'),
  lawfulBasisNotes: z.string().optional(),
  isSystematicMonitoring: z.boolean().optional(),
  isLargeScale: z.boolean().optional(),
  isAutomatedDecisionMaking: z.boolean().optional(),
  retentionSchedule: z.string().optional(),
  retentionReviewDate: z.date().nullable().optional(),
  securityMeasures: z.array(z.string()).optional(),
  securityNotes: z.string().optional()
});

export function RopaEditor({ initialData = null }: { initialData?: any }) {
  const router = useRouter();
  const isNew = !initialData;
  const [activeTab, setActiveTab] = useState('general');
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    resolver: zodResolver(ropaSchema),
    defaultValues: initialData || {
      name: '',
      purpose: '',
      description: '',
      status: 'draft',
      riskLevel: 'low',
      lawfulBasis: '',
      lawfulBasisNotes: '',
      isSystematicMonitoring: false,
      isLargeScale: false,
      isAutomatedDecisionMaking: false,
      retentionSchedule: '',
      retentionReviewDate: null,
      securityMeasures: [],
      securityNotes: ''
    }
  });
  const formData = watch();

  const handleFieldChange = (field: any, value: any) => {
    setValue(field, value, { shouldDirty: true });
  };

  const [assignedClientIds, setAssignedClientIds] = useState<string[]>(
    initialData?.clients?.map((c: any) => c.clientId) || []
  );

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const utils = trpc.useUtils();
  const createMutation = trpc.ropa.create.useMutation();
  const updateMutation = trpc.ropa.update.useMutation({
    onMutate: async (newUpdate) => {
      await utils.ropa.get.cancel({ id: newUpdate.id });
      const previousData = utils.ropa.get.getData({ id: newUpdate.id });
      if (previousData) {
        utils.ropa.get.setData({ id: newUpdate.id }, {
          ...previousData,
          ...newUpdate.data,
        } as any);
      }
      return { previousData };
    },
    onError: (err, newUpdate, context) => {
      if (context?.previousData) {
        utils.ropa.get.setData({ id: newUpdate.id }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      utils.ropa.get.invalidate({ id: variables.id });
      utils.ropa.list.invalidate();
    },
  });

  const updateClientsMutation = trpc.clients.updateActivitiesBulk.useMutation();
  const { data: clientsData } = trpc.clients.list.useQuery({ limit: 100 });
  const allClients = clientsData?.data || [];

  const { data: impacts = [] } = trpc.regulatory.listUnacknowledgedImpacts.useQuery(undefined, { enabled: !isNew });
  const [showImpacts, setShowImpacts] = useState(false);
  const acknowledgeMutation = trpc.regulatory.acknowledgeImpact.useMutation({
    onSuccess: () => utils.regulatory.listUnacknowledgedImpacts.invalidate()
  });

  const relevantImpacts = impacts.filter(impact => 
    (impact.affectedActivities as any[]).some(a => a.activityId === initialData?.id)
  );

  const handleClientToggle = async (clientId: string) => {
    if (isNew) return; // Cannot assign clients before activity is created
    const newSelected = assignedClientIds.includes(clientId)
      ? assignedClientIds.filter(id => id !== clientId)
      : [...assignedClientIds, clientId];
      
    setAssignedClientIds(newSelected);
    await updateClientsMutation.mutateAsync({
      processingActivityId: initialData.id,
      clientIds: newSelected
    });
  };

  // Debounced auto-save logic for form tabs (1, 2, 6, 7)
  const autoSaveTabs = ['general', 'legal', 'retention', 'security'];
  
  useEffect(() => {
    if (isNew || !autoSaveTabs.includes(activeTab)) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await updateMutation.mutateAsync({
          id: initialData.id,
          updatedAt: initialData.updatedAt,
          data: formData
        });
        setSaveStatus('saved');
      announce('Processing activity saved successfully.');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        setSaveStatus('error');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, activeTab]);


  const handleCreate = async () => {
    setSaveStatus('saving');
    try {
      const res = await createMutation.mutateAsync(formData);
      router.push(`/ropa/${res.id}`);
    } catch (e) {
      setSaveStatus('error');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-ink-900/8 bg-bone-50/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <button 
              onClick={() => router.push('/ropa')}
              className="p-2 hover:bg-bone-100 rounded-lg text-ink-500 hover:text-ink-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[20px] font-serif tracking-tight text-ink-900">
                {isNew ? 'New Processing Activity' : formData.name || 'Untitled Activity'}
              </h1>
              {!isNew && (
                <div className="flex items-center gap-2 mt-1 text-[12px]">
                  <span className={`px-2 py-0.5 rounded-md ${
                    formData.status === 'active' ? 'bg-sage-50 text-sage-700' : 
                    'bg-bone-100 text-ink-500'
                  }`}>
                    {formData.status}
                  </span>
                  
                  {/* Save Status Indicator */}
                  {autoSaveTabs.includes(activeTab) && (
                    <span className="text-ink-500 flex items-center gap-1">
                      {saveStatus === 'saving' && <span className="animate-pulse">Saving...</span>}
                      {saveStatus === 'saved' && <span className="text-sage-700 flex items-center gap-1"><Save className="w-3 h-3"/> Saved</span>}
                      {saveStatus === 'error' && <span className="text-clay-600 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Error saving</span>}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {isNew && (
            <button 
              onClick={handleCreate}
              disabled={!formData.name || !formData.purpose}
              className="px-3 py-2 bg-sage-700 hover:bg-sage-600 disabled:opacity-50 text-bone-50 text-[13px] font-medium rounded-lg shadow-card transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Create Activity
            </button>
          )}
        </div>

        {/* Tabs Navigation */}
        {!isNew && (
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto hide-scrollbar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-[13.5px] whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id 
                    ? 'border-sage-700 text-sage-700 font-medium' 
                    : 'border-transparent text-ink-500 hover:text-ink-900 hover:border-ink-900/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6">
        
        {relevantImpacts.length > 0 && !showImpacts && (
          <div 
            onClick={() => setShowImpacts(true)}
            className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span>{relevantImpacts.length} regulatory update(s) may affect this activity. Review updates →</span>
            </div>
          </div>
        )}

        {relevantImpacts.length > 0 && showImpacts && (
          <div className="mb-6 bg-blue-50/50 border border-blue-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 font-medium text-blue-900 text-sm">
                <Info className="w-4 h-4" /> Regulatory Impacts
              </div>
              <button onClick={() => setShowImpacts(false)} className="text-blue-500 hover:text-blue-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-blue-200/50">
              {relevantImpacts.map(impact => {
                const update = impact.update as any;
                const activityImpact = (impact.affectedActivities as any[]).find(a => a.activityId === initialData.id);
                return (
                  <div key={impact.id} className="p-4 flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                      <h4 className="font-semibold text-ink-900 text-[14px] mb-1">{update.title}</h4>
                      <p className="text-ink-600 text-[13px] mb-2">{activityImpact?.reason}</p>
                      <a href={update.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline">
                        View full update <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <button 
                      onClick={() => acknowledgeMutation.mutate({ assessmentId: impact.id })}
                      disabled={acknowledgeMutation.isPending}
                      className="shrink-0 bg-white border border-blue-200 hover:border-blue-400 text-blue-700 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                    >
                      Acknowledge
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Render Tab 1: General */}
        {(activeTab === 'general' || isNew) && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-bone-50 hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-ink-900 border-b border-ink-900/8 pb-3">General Information</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Activity Name <span className="text-clay-600">*</span></label>
                <input 
                  type="text" 
                  {...register('name')}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  placeholder="e.g. Employee Payroll Processing"
                />
                {errors.name && <FieldError>{errors.name.message as string}</FieldError>}
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Purpose of Processing <span className="text-clay-600">*</span></label>
                <textarea 
                  {...register('purpose')}
                  rows={3}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  placeholder="Describe exactly why this processing occurs..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Description</label>
                <textarea 
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={2}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                />
              </div>

              {!isNew && allClients.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-ink-900/8">
                  <label className="text-[12.5px] font-medium text-ink-700">Client Assignment (Agency Feature)</label>
                  <p className="text-[12px] text-ink-500 mb-2">Select which clients this processing activity serves. It will appear on their compliance portals.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                    {allClients.map((client: any) => (
                      <label key={client.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        assignedClientIds.includes(client.id) ? 'border-indigo-300 bg-indigo-50/50' : 'border-ink-900/10 hover:border-ink-900/30'
                      }`}>
                        <input 
                          type="checkbox"
                          checked={assignedClientIds.includes(client.id)}
                          onChange={() => handleClientToggle(client.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-[13px] font-medium text-ink-900">{client.name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-ink-900/8">
                <div className="space-y-2">
                  <label className="text-[12.5px] font-medium text-ink-700">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="under_review">Under Review</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[12.5px] font-medium text-ink-700">Risk Level</label>
                  <select 
                    value={formData.riskLevel}
                    onChange={(e) => handleFieldChange('riskLevel', e.target.value)}
                    className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-ink-900/8">
                <label className="flex items-start gap-3 p-3 bg-bone-100/50 rounded-xl cursor-pointer hover:bg-bone-100 transition-colors">
                  <input 
                    type="checkbox"
                    checked={formData.isSystematicMonitoring || false}
                    onChange={(e) => handleFieldChange('isSystematicMonitoring', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-ink-900/20 text-sage-600 focus:ring-sage-500/20"
                  />
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-900">Systematic Monitoring</p>
                    <p className="text-[12px] text-ink-500">Processing involves regular and systematic monitoring of data subjects on a large scale.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Legal Basis */}
        {activeTab === 'legal' && !isNew && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-bone-50 hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-ink-900 border-b border-ink-900/8 pb-3">Legal Basis Configuration</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Lawful Basis (Art. 6) <span className="text-clay-600">*</span></label>
                <select 
                  {...register('lawfulBasis')}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                >
                  <option value="" disabled>Select Lawful Basis...</option>
                  <option value="consent">Consent (Art. 6(1)(a))</option>
                  <option value="contract">Contract (Art. 6(1)(b))</option>
                  <option value="legal_obligation">Legal Obligation (Art. 6(1)(c))</option>
                  <option value="vital_interests">Vital Interests (Art. 6(1)(d))</option>
                  <option value="public_task">Public Task (Art. 6(1)(e))</option>
                  <option value="legitimate_interest">Legitimate Interest (Art. 6(1)(f))</option>
                </select>
                {errors.lawfulBasis && <FieldError>{errors.lawfulBasis.message as string}</FieldError>}
              </div>

              {formData.lawfulBasis === 'legitimate_interest' && (
                <div className="p-4 bg-amber-50 border border-amber-500/20 rounded-xl">
                  <h3 className="text-[13px] font-medium text-amber-600 mb-1">Legitimate Interest Assessment (LIA) Required</h3>
                  <p className="text-[12.5px] text-ink-600 mb-3">You must conduct and document an LIA when relying on legitimate interests.</p>
                  <button className="px-3 py-1.5 bg-white text-ink-800 text-[12.5px] hairline rounded-md hover:bg-bone-100 transition-colors">
                    Start / View LIA
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Tab 3: Data Categories */}
        {activeTab === 'data' && !isNew && (
          <DataCategoriesTab activityId={initialData.id} />
        )}

        {/* Tab 4: Recipients */}
        {activeTab === 'recipients' && !isNew && (
          <RecipientsTab activityId={initialData.id} />
        )}

        {/* Tab 5: Transfers */}
        {activeTab === 'transfers' && !isNew && (
          <TransfersTab activityId={initialData.id} />
        )}

        {/* Tab 6: Retention */}
        {activeTab === 'retention' && !isNew && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-bone-50 hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-ink-900 border-b border-ink-900/8 pb-3">Data Retention Policy</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Retention Period <span className="text-clay-600">*</span></label>
                <select 
                  value={formData.retentionPeriod || ''}
                  onChange={(e) => handleFieldChange('retentionPeriod', e.target.value)}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                >
                  <option value="" disabled>Select Retention Period...</option>
                  <option value="6_months">6 Months</option>
                  <option value="1_year">1 Year</option>
                  <option value="3_years">3 Years</option>
                  <option value="5_years">5 Years</option>
                  <option value="duration_of_contract">Duration of Contract</option>
                  <option value="indefinite">Indefinite (Requires strong justification)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Justification for Retention Period <span className="text-clay-600">*</span></label>
                <textarea 
                  value={formData.retentionJustification || ''}
                  onChange={(e) => handleFieldChange('retentionJustification', e.target.value)}
                  rows={3}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  placeholder="Explain why this data must be kept for this period (e.g., statutory requirements, business needs)..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[12.5px] font-medium text-ink-700">Next Review Date</label>
                  <input 
                    type="date"
                    value={formData.retentionReviewDate ? new Date(formData.retentionReviewDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleFieldChange('retentionReviewDate', e.target.value ? new Date(e.target.value) : null)}
                    className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-ink-700">Deletion Procedure</label>
                <textarea 
                  value={formData.deletionProcedure || ''}
                  onChange={(e) => handleFieldChange('deletionProcedure', e.target.value)}
                  rows={2}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  placeholder="How is this data securely destroyed at the end of its lifecycle?"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Security Measures */}
        {activeTab === 'security' && !isNew && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-bone-50 hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-ink-900 border-b border-ink-900/8 pb-3">Technical & Organizational Measures (TOMs)</h2>
              
              <div className="space-y-3">
                <label className="text-[12.5px] font-medium text-ink-700">Standard Security Measures</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'encryption_at_rest', label: 'Encryption at Rest' },
                    { id: 'encryption_in_transit', label: 'Encryption in Transit (TLS/SSL)' },
                    { id: 'access_controls', label: 'Role-Based Access Controls (RBAC)' },
                    { id: 'mfa', label: 'Multi-Factor Authentication (MFA)' },
                    { id: 'pseudonymization', label: 'Pseudonymization' },
                    { id: 'anonymization', label: 'Data Anonymization' },
                    { id: 'regular_backups', label: 'Regular Backups' },
                    { id: 'audit_logging', label: 'System Audit Logging' },
                  ].map(measure => (
                    <label key={measure.id} className="flex items-start gap-3 p-3 bg-bone-100/50 rounded-xl cursor-pointer hover:bg-bone-100 transition-colors">
                      <input 
                        type="checkbox"
                        checked={Array.isArray(formData.securityMeasures) && formData.securityMeasures.includes(measure.id)}
                        onChange={(e) => {
                          const current = Array.isArray(formData.securityMeasures) ? formData.securityMeasures : [];
                          const updated = e.target.checked 
                            ? [...current, measure.id]
                            : current.filter((m: string) => m !== measure.id);
                          handleFieldChange('securityMeasures', updated);
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-ink-900/20 text-sage-600 focus:ring-sage-500/20"
                      />
                      <span className="text-[13px] font-medium text-ink-900">{measure.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <label className="text-[12.5px] font-medium text-ink-700">Additional Security Details</label>
                <textarea 
                  value={formData.securityMeasuresDetail || ''}
                  onChange={(e) => handleFieldChange('securityMeasuresDetail', e.target.value)}
                  rows={3}
                  className="w-full bg-bone-50 hairline rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                  placeholder="Describe any other specific technical or organizational measures..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: DPIA */}
        {activeTab === 'dpia' && !isNew && (
          <DpiaTab 
            activityId={initialData.id} 
            dpiaId={formData.dpiaId} 
            onDpiaLinked={(id) => handleFieldChange('dpiaId', id)} 
          />
        )}

        {/* Tab 9: History */}
        {activeTab === 'history' && !isNew && (
          <HistoryTab activityId={initialData.id} />
        )}

        {/* Additional tabs will be built incrementally */}
      </div>
    </div>
  );
}
