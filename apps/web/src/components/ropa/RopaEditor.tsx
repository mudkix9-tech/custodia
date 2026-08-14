// @ts-nocheck
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { Save, ArrowLeft, AlertCircle, Info, ExternalLink, X, Lightbulb } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FieldError } from '@/components/ui/FieldError';
import { announce } from '@/components/layout/Announcer';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { DataCategoriesTab } from './tabs/DataCategoriesTab';
import { RecipientsTab } from './tabs/RecipientsTab';
import { TransfersTab } from './tabs/TransfersTab';
import { DpiaTab } from './tabs/DpiaTab';
import { HistoryTab } from './tabs/HistoryTab';

const TABS = [
  { id: 'general', label: 'tabs.general' },
  { id: 'legal', label: 'tabs.legal' },
  { id: 'data', label: 'tabs.data' },
  { id: 'recipients', label: 'tabs.recipients' },
  { id: 'transfers', label: 'tabs.transfers' },
  { id: 'retention', label: 'tabs.retention' },
  { id: 'security', label: 'tabs.security' },
  { id: 'dpia', label: 'tabs.dpia' },
  { id: 'history', label: 'tabs.history' },
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
  const t = useTranslations('ropa.editor');
  const searchParams = useSearchParams();
  const isNew = !initialData;
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const { register, control, handleSubmit, formState: { errors }, watch, setValue } = useForm({
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

  const { setContext, openPanel, registerApplyCallback, unregisterApplyCallback } = useAiGuidanceStore();

  const handleFieldChange = (field: any, value: any) => {
    setValue(field, value, { shouldDirty: true });
  };

  // Register AI apply callback so the sidebar can inject values into this form
  useEffect(() => {
    registerApplyCallback((field: string, value: any) => {
      if (field === 'lawfulBasis') {
        setValue('lawfulBasis', value, { shouldDirty: true });
      } else if (field === 'retention') {
        handleFieldChange('retentionPeriod', value);
      } else if (field === 'dataCategories') {
        // Data categories are managed via a sub-tab; store them for later application
        // For now, just announce the suggestion
        announce(t('ai_suggested_data', { count: (value || []).length }));
      }
    });
    return () => unregisterApplyCallback();
  }, []);

  // Set AI guidance context when the form loads or activity data changes
  useEffect(() => {
    if (initialData?.id || formData.name) {
      setContext({
        module: 'ropa',
        entityId: initialData?.id || undefined,
        formData: {
          name: formData.name,
          purpose: formData.purpose,
          description: formData.description,
          lawfulBasis: formData.lawfulBasis,
          retentionPeriod: formData.retentionPeriod,
        }
      });
    }
  }, [initialData?.id]);

  const handleAiAssist = () => {
    setContext({
      module: 'ropa',
      entityId: initialData?.id || undefined,
      formData: {
        name: formData.name,
        purpose: formData.purpose,
        description: formData.description,
        lawfulBasis: formData.lawfulBasis,
        retentionPeriod: formData.retentionPeriod,
      }
    });
    openPanel();
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
      announce(t('saved_success'));
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
      <div className="border-b border-ink-900/8 bg-[#08090A]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <Button 
              variant="ghost"
              size="icon"
              onClick={() => router.push('/ropa')}
              className="text-[#6E747A] hover:text-[#F4F5F6]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-[20px] font-serif tracking-tight text-[#F4F5F6]">
                {isNew ? t('new_activity') : formData.name || t('untitled')}
              </h1>
              {!isNew && (
                <div className="flex items-center gap-2 mt-1 text-[12px]">
                  <span className={`px-2 py-0.5 rounded-md ${
                    formData.status === 'active' ? 'bg-[#C9A227]/10 text-[#C9A227]' : 
                    'bg-white/5 text-[#6E747A]'
                  }`}>
                    {formData.status}
                  </span>
                  
                  {/* Save Status Indicator */}
                  {autoSaveTabs.includes(activeTab) && (
                    <span className="text-[#6E747A] flex items-center gap-1">
                      {saveStatus === 'saving' && <span className="animate-pulse">{t('saving')}</span>}
                      {saveStatus === 'saved' && <span className="text-[#C9A227] flex items-center gap-1"><Save className="w-3 h-3"/> {t('saved')}</span>}
                      {saveStatus === 'error' && <span className="text-clay-600 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {t('error_saving')}</span>}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant="outline"
                type="button"
                onClick={handleAiAssist}
                className="bg-amber-500/10 hover:bg-amber-500/15 border-amber-900/50 text-amber-800 transition-colors flex items-center gap-1.5"
              >
                <Lightbulb className="w-4 h-4" /> {t('help_me_fill')}
              </Button>
            )}
            {isNew && (
              <Button 
                onClick={handleCreate}
                disabled={!formData.name || !formData.purpose}
                className="flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> {t('create_activity')}
              </Button>
            )}
          </div>
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
                    ? 'border-[#C9A227] text-[#C9A227] font-medium' 
                    : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/10'
                }`}
              >
                {t(tab.label as any)}
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
            className="mb-6 bg-blue-500/10 border border-blue-200 text-blue-800 px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>{t('regulatory_impacts_notice', { count: relevantImpacts.length })}</span>
            </div>
          </div>
        )}

        {relevantImpacts.length > 0 && showImpacts && (
          <div className="mb-6 bg-blue-500/50 border border-blue-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-500/10">
              <div className="flex items-center gap-2 font-medium text-blue-900 text-sm">
                <Info className="w-4 h-4" /> {t('regulatory_impacts')}
              </div>
              <button onClick={() => setShowImpacts(false)} className="text-blue-500 hover:text-blue-400">
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
                      <h4 className="font-semibold text-[#F4F5F6] text-[14px] mb-1">{update.title}</h4>
                      <p className="text-[#9BA1A6] text-[13px] mb-2">{activityImpact?.reason}</p>
                      <a href={update.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] font-medium text-blue-400 hover:underline">
                        {t('view_full_update')} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <button 
                      onClick={() => acknowledgeMutation.mutate({ assessmentId: impact.id })}
                      disabled={acknowledgeMutation.isPending}
                      className="shrink-0 bg-[#0D0F11] border border-blue-200 hover:border-blue-400 text-blue-400 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                    >
                      {t('acknowledge')}
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
            <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('general.title')}</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.activity_name')} <span className="text-clay-600">*</span></label>
                <Input 
                  {...register('name')}
                  placeholder={t('general.activity_name_ph')}
                />
                {errors.name && <FieldError>{errors.name.message as string}</FieldError>}
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.purpose')} <span className="text-clay-600">*</span></label>
                <Textarea 
                  {...register('purpose')}
                  rows={3}
                  placeholder={t('general.purpose_ph')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.description')}</label>
                <Textarea 
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={2}
                />
              </div>

              {!isNew && allClients.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-ink-900/8">
                  <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.client_assignment')}</label>
                  <p className="text-[12px] text-[#6E747A] mb-2">{t('general.client_assignment_desc')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                    {allClients.map((client: any) => (
                      <label key={client.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        assignedClientIds.includes(client.id) ? 'border-indigo-500/30 bg-indigo-500/15' : 'border-white/10 hover:border-ink-900/30'
                      }`}>
                        <Switch 
                          checked={assignedClientIds.includes(client.id)}
                          onCheckedChange={() => handleClientToggle(client.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-[13px] font-medium text-[#F4F5F6]">{client.name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-ink-900/8">
                <div className="space-y-2">
                  <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.status')}</label>
                  <Select 
                    value={formData.status}
                    onValueChange={(value) => handleFieldChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('general.status_draft')}</SelectItem>
                      <SelectItem value="active">{t('general.status_active')}</SelectItem>
                      <SelectItem value="under_review">{t('general.status_under_review')}</SelectItem>
                      <SelectItem value="archived">{t('general.status_archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.risk_level')}</label>
                  <Select 
                    value={formData.riskLevel}
                    onValueChange={(value) => handleFieldChange('riskLevel', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('general.risk_low')}</SelectItem>
                      <SelectItem value="medium">{t('general.risk_medium')}</SelectItem>
                      <SelectItem value="high">{t('general.risk_high')}</SelectItem>
                      <SelectItem value="critical">{t('general.risk_critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-ink-900/8">
                <label className="flex items-start gap-3 p-3 bg-white/50 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                  <Switch 
                    checked={formData.isSystematicMonitoring || false}
                    onCheckedChange={(checked) => handleFieldChange('isSystematicMonitoring', checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-[13.5px] font-medium text-[#F4F5F6]">{t('general.systematic_monitoring')}</p>
                    <p className="text-[12px] text-[#6E747A]">{t('general.systematic_monitoring_desc')}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Legal Basis */}
        {activeTab === 'legal' && !isNew && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('legal.title')}</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('legal.lawful_basis')} <span className="text-clay-600">*</span></label>
                <Controller
                  name="lawfulBasis"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('legal.select_lawful_basis')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consent">{t('legal.consent')}</SelectItem>
                        <SelectItem value="contract">{t('legal.contract')}</SelectItem>
                        <SelectItem value="legal_obligation">{t('legal.legal_obligation')}</SelectItem>
                        <SelectItem value="vital_interests">{t('legal.vital_interests')}</SelectItem>
                        <SelectItem value="public_task">{t('legal.public_task')}</SelectItem>
                        <SelectItem value="legitimate_interest">{t('legal.legitimate_interest')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.lawfulBasis && <FieldError>{errors.lawfulBasis.message as string}</FieldError>}
              </div>

              {formData.lawfulBasis === 'legitimate_interest' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <h3 className="text-[13px] font-medium text-amber-400 mb-1">{t('legal.lia_required')}</h3>
                  <p className="text-[12.5px] text-[#9BA1A6] mb-3">{t('legal.lia_desc')}</p>
                  <Button variant="outline" className="px-3 py-1.5 h-auto text-[12.5px]">
                    {t('legal.start_lia')}
                  </Button>
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
            <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('retention.title')}</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('retention.retention_period')} <span className="text-clay-600">*</span></label>
                <Select 
                  value={formData.retentionPeriod || ''}
                  onValueChange={(value) => handleFieldChange('retentionPeriod', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('retention.select_retention')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6_months">{t('retention.6_months')}</SelectItem>
                    <SelectItem value="1_year">{t('retention.1_year')}</SelectItem>
                    <SelectItem value="3_years">{t('retention.3_years')}</SelectItem>
                    <SelectItem value="5_years">{t('retention.5_years')}</SelectItem>
                    <SelectItem value="duration_of_contract">{t('retention.duration_of_contract')}</SelectItem>
                    <SelectItem value="indefinite">{t('retention.indefinite')}</SelectItem>
                    <SelectItem value="custom">{t('retention.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('retention.justification')} <span className="text-clay-600">*</span></label>
                <Textarea 
                  value={formData.retentionJustification || ''}
                  onChange={(e) => handleFieldChange('retentionJustification', e.target.value)}
                  rows={3}
                  placeholder={t('retention.justification_ph')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('retention.next_review')}</label>
                  <Input 
                    type="date"
                    value={formData.retentionReviewDate ? new Date(formData.retentionReviewDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleFieldChange('retentionReviewDate', e.target.value ? new Date(e.target.value) : null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('retention.deletion_procedure')}</label>
                <Textarea 
                  value={formData.deletionProcedure || ''}
                  onChange={(e) => handleFieldChange('deletionProcedure', e.target.value)}
                  rows={2}
                  placeholder={t('retention.deletion_procedure_ph')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Security Measures */}
        {activeTab === 'security' && !isNew && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('security.title')}</h2>
              
              <div className="space-y-3">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('security.standard_measures')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'encryption_at_rest', label: t('security.encryption_at_rest') },
                    { id: 'encryption_in_transit', label: t('security.encryption_in_transit') },
                    { id: 'access_controls', label: t('security.access_controls') },
                    { id: 'mfa', label: t('security.mfa') },
                    { id: 'pseudonymization', label: t('security.pseudonymization') },
                    { id: 'anonymization', label: t('security.anonymization') },
                    { id: 'regular_backups', label: t('security.backups') },
                    { id: 'audit_logging', label: t('security.audit_logs') },
                  ].map(measure => (
                    <label key={measure.id} className="flex items-start gap-3 p-3 bg-white/50 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                      <Switch 
                        checked={Array.isArray(formData.securityMeasures) && formData.securityMeasures.includes(measure.id)}
                        onCheckedChange={(checked) => {
                          const current = Array.isArray(formData.securityMeasures) ? formData.securityMeasures : [];
                          const updated = checked 
                            ? [...current, measure.id]
                            : current.filter((m: string) => m !== measure.id);
                          handleFieldChange('securityMeasures', updated);
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-[13px] font-medium text-[#F4F5F6]">{measure.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('security.additional_notes')}</label>
                <Textarea 
                  value={formData.securityMeasuresDetail || ''}
                  onChange={(e) => handleFieldChange('securityMeasuresDetail', e.target.value)}
                  rows={3}
                  placeholder={t('security.additional_notes_ph')}
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
