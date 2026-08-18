"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { Save, ArrowLeft, AlertCircle, Info, ExternalLink, X, Lightbulb, FileText, ShieldCheck } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FieldError } from '@/components/ui/FieldError';
import { announce } from '@/components/layout/Announcer';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { useTranslations } from 'next-intl';
import { isRetentionPreset, isCustomRetention, normaliseLawfulBasis } from '@/utils/ropaFormat';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import NextLink from 'next/link';
import { CompletenessPanel, CompletenessRing, type Requirement } from './CompletenessPanel';
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
  role: z.string(),
  controllerName: z.string().optional(),
  lawfulBasis: z.string().min(1, 'Lawful basis is required'),
  lawfulBasisNotes: z.string().optional(),
  isSystematicMonitoring: z.boolean().optional(),
  isLargeScale: z.boolean().optional(),
  // Art. 22. `isAutomatedDecisionMaking` was a form field with no column behind it —
  // Drizzle dropped it silently on every save. The real columns are these.
  involvesProfiling: z.boolean().optional(),
  involvesAutomatedDecisionMaking: z.boolean().optional(),
  admLogic: z.string().nullable().optional(),
  admSignificance: z.string().nullable().optional(),
  admHumanIntervention: z.string().nullable().optional(),
  businessOwnerId: z.string().nullable().optional(),
  privacyOwnerId: z.string().nullable().optional(),
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
      role: 'controller',
      controllerName: '',
      lawfulBasis: '',
      lawfulBasisNotes: '',
      isSystematicMonitoring: false,
      isLargeScale: false,
      involvesProfiling: false,
      involvesAutomatedDecisionMaking: false,
      admLogic: '',
      admSignificance: '',
      admHumanIntervention: '',
      businessOwnerId: null,
      privacyOwnerId: null,
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
  // B23. Set when a save is refused because the record cannot be published; cleared
  // once the user either fixes the blockers or records an exception.
  const [publicationRefusal, setPublicationRefusal] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  // Seeded from the loaded value: anything that is not one of the six presets is the
  // user's own wording — including the ten onboarding templates that seed prose, which
  // rendered as an empty select and were overwritten with 5_years on any interaction.
  const [retentionIsCustom, setRetentionIsCustom] = useState(
    initialData?.retentionPeriod === 'custom' || isCustomRetention(initialData?.retentionPeriod)
  );

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

  // B18. team.list is already org-scoped and returns only the public columns.
  const { data: orgMembers = [] } = trpc.team.list.useQuery(undefined, { enabled: !isNew });

  // B25/B26. Server-scored, so the ring and the panel agree with the gate that
  // actually refuses the save — a second implementation here would drift from it.
  const { data: completeness } = trpc.ropa.completeness.useQuery(
    { id: initialData?.id },
    { enabled: !isNew },
  );

  const { data: impacts = [] } = trpc.regulatory.listUnacknowledgedImpacts.useQuery(undefined, { enabled: !isNew });
  const [showImpacts, setShowImpacts] = useState(false);
  const acknowledgeMutation = trpc.regulatory.acknowledgeImpact.useMutation({
    onSuccess: () => utils.regulatory.listUnacknowledgedImpacts.invalidate()
  });

  // listUnacknowledgedImpacts returns { update, matches }, where each match is a
  // regulatory_update_matches row keyed by matchedEntityType/matchedEntityId.
  // This used to read impact.affectedActivities, which is not a field on either
  // shape — so .some() ran on undefined and threw the moment an organisation had
  // any unacknowledged impact, taking the whole activity editor down with it.
  const relevantImpacts = impacts.filter(impact =>
    impact.matches.some(
      (m: any) => m.matchedEntityType === 'processing_activity' && m.matchedEntityId === initialData?.id,
    ),
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

  // `watch()` hands back a fresh object on every render, so an effect that depends on
  // it re-runs on every render — including the renders the save itself causes, through
  // setSaveStatus, the optimistic setData in onMutate, and the ropa.get invalidation in
  // onSettled, each of which produces a new `data` object in the page above. An activity
  // left open therefore issued an UPDATE plus an audit_logs INSERT every 0.5–2 seconds,
  // indefinitely. Depending on the serialised values instead of the object's identity is
  // what breaks it: after a save the signature matches, and the effect returns early.
  const formSignature = JSON.stringify(formData);
  const lastSavedSignature = useRef<string | null>(null);
  // Captured on the first render, before any edit, rather than the first time the
  // effect runs: deep-linking to ?tab=dpia, linking a DPIA and then switching to
  // General would otherwise adopt the edited values as the baseline and never save.
  if (lastSavedSignature.current === null) lastSavedSignature.current = formSignature;

  // The lock compares against the last updatedAt *we* wrote, not the one on the prop.
  // initialData only refreshes when the onSettled refetch lands, and the save that
  // fires before it does was reporting "The record was updated by someone else" on a
  // record nobody else had touched.
  const lastUpdatedAt = useRef<string | undefined>(initialData?.updatedAt);

  useEffect(() => {
    if (isNew || !autoSaveTabs.includes(activeTab)) return;

    if (lastSavedSignature.current === formSignature) return;

    const timer = setTimeout(async () => {
      const saving = formSignature;
      setSaveStatus('saving');
      try {
        const saved = await updateMutation.mutateAsync({
          id: initialData.id,
          updatedAt: lastUpdatedAt.current,
          data: formData
        });
        lastSavedSignature.current = saving;
        if (saved?.updatedAt) lastUpdatedAt.current = new Date(saved.updatedAt).toISOString();
        setSaveStatus('saved');
        announce(t('saved_success'));
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        setSaveStatus('error');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formSignature, activeTab]);


  const handleCreate = async () => {
    setSaveStatus('saving');
    try {
      const res = await createMutation.mutateAsync(formData);
      router.push(`/ropa/${res.id}`);
    } catch (e) {
      setSaveStatus('error');
    }
  };

  /**
   * B23. Publication is its own act, not something the Status dropdown does on the
   * way past. That is the whole finding: "draft versus active is currently a
   * costume" — any activity could wear 'active' with no name, no basis, no subject
   * categories and no retention, and the register then showed a regulator a
   * published record answering none of Art. 30(1).
   *
   * Routing it through a button rather than the autosaved dropdown also keeps the
   * refusal legible. A server that rejects one field of a debounced whole-form save
   * can only report "Error saving"; a button can say which Articles are unanswered
   * and offer the exception in the same breath.
   */
  const handlePublish = async (reason?: string) => {
    setSaveStatus('saving');
    setPublicationRefusal(null);
    try {
      const saved = await updateMutation.mutateAsync({
        id: initialData.id,
        updatedAt: lastUpdatedAt.current,
        data: { ...formData, status: 'active' },
        publicationExceptionReason: reason,
      });
      handleFieldChange('status', 'active');
      lastSavedSignature.current = JSON.stringify({ ...formData, status: 'active' });
      if (saved?.updatedAt) lastUpdatedAt.current = new Date(saved.updatedAt).toISOString();
      setSaveStatus('saved');
      setShowExceptionForm(false);
      setExceptionReason('');
      announce(t('saved_success'));
      setTimeout(() => setSaveStatus('idle'), 2000);
      utils.ropa.completeness.invalidate({ id: initialData.id });
    } catch (err: any) {
      setSaveStatus('idle');
      if (err?.data?.code === 'PRECONDITION_FAILED') {
        setPublicationRefusal(err.message);
      } else {
        setSaveStatus('error');
      }
    }
  };

  const blockers: Requirement[] = (completeness?.blockers as Requirement[] | undefined) ?? [];
  const missing: Requirement[] = (completeness?.missing as Requirement[] | undefined) ?? [];
  const isPublished = formData.status === 'active';

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
            {!isNew && completeness && (
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                title={t('completeness.ring_title', { score: completeness.score })}
                className="mr-1"
              >
                <CompletenessRing score={completeness.score} />
              </button>
            )}
            {!isNew && (
              <NextLink
                href={`/ropa/${initialData.id}/record`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-[13px] text-[#9BA1A6] hover:text-[#F4F5F6] hover:border-white/20 transition-colors"
              >
                <FileText className="w-4 h-4" /> {t('full_record')}
              </NextLink>
            )}
            {!isNew && !isPublished && (
              <Button
                type="button"
                onClick={() => (blockers.length > 0 ? setShowExceptionForm(true) : handlePublish())}
                className="flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> {t('publish')}
              </Button>
            )}
            {!isNew && (
              <Button
                variant="outline"
                type="button"
                onClick={handleAiAssist}
                className="bg-amber-500/10 hover:bg-amber-500/15 border-amber-900/50 text-amber-300 transition-colors flex items-center gap-1.5"
              >
                <Lightbulb className="w-4 h-4" /> {t('help_me_fill')}
              </Button>
            )}
            {isNew && (
              <Button 
                onClick={handleCreate}
                disabled={!formData.name || !formData.purpose || !formData.lawfulBasis}
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
        
        {!isNew && showExceptionForm && (
          <div className="mb-6 bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[14px] font-medium text-[#F4F5F6]">{t('gate.title')}</h3>
                <p className="text-[12.5px] text-[#9BA1A6] mt-1">{t('gate.description')}</p>
              </div>
              <button
                onClick={() => { setShowExceptionForm(false); setPublicationRefusal(null); }}
                aria-label={t('gate.close')}
                className="text-[#6E747A] hover:text-[#F4F5F6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-1.5">
              {blockers.map((b) => (
                <li key={b.id} className="flex items-start gap-2 text-[12.5px]">
                  <AlertCircle className="w-4 h-4 text-clay-600 mt-0.5 shrink-0" />
                  <span>
                    <span className="text-[#F4F5F6]">{b.label}</span>
                    <span className="text-[#6E747A]"> — {b.article}</span>
                    {b.detail && <span className="block text-[#6E747A]">{b.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('gate.exception_label')}</label>
              <Textarea
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                rows={3}
                placeholder={t('gate.exception_ph')}
              />
              <p className="text-[12px] text-[#6E747A]">{t('gate.exception_hint')}</p>
            </div>

            {publicationRefusal && (
              <div className="bg-clay-600/10 border border-clay-600/25 text-clay-600 px-4 py-2.5 rounded-xl text-[13px]">
                {publicationRefusal}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePublish(exceptionReason)}
                disabled={exceptionReason.trim().length < 10 || saveStatus === 'saving'}
              >
                {t('gate.publish_anyway')}
              </Button>
              <Button variant="ghost" onClick={() => { setShowExceptionForm(false); setPublicationRefusal(null); }}>
                {t('gate.cancel')}
              </Button>
            </div>
          </div>
        )}

        {!isNew && isPublished && initialData?.publicationExceptionReason && (
          <div className="mb-6 bg-amber-500/10 border border-amber-900/50 text-amber-300 px-4 py-3 rounded-xl text-[12.5px]">
            <span className="font-medium">{t('gate.published_with_exception')}</span>{' '}
            {initialData.publicationExceptionReason}
          </div>
        )}

        {relevantImpacts.length > 0 && !showImpacts && (
          <div 
            onClick={() => setShowImpacts(true)}
            className="mb-6 bg-blue-500/10 border border-blue-500/25 text-blue-300 px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-center justify-between cursor-pointer hover:bg-blue-500/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>{t('regulatory_impacts_notice', { count: relevantImpacts.length })}</span>
            </div>
          </div>
        )}

        {relevantImpacts.length > 0 && showImpacts && (
          <div className="mb-6 bg-blue-500/50 border border-blue-500/25 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/25 bg-blue-500/10">
              <div className="flex items-center gap-2 font-medium text-blue-300 text-sm">
                <Info className="w-4 h-4" /> {t('regulatory_impacts')}
              </div>
              <button onClick={() => setShowImpacts(false)} className="text-blue-500 hover:text-blue-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-blue-200/50">
              {relevantImpacts.map((impact: any) => {
                const update = impact.update as any;
                const activityMatch = impact.matches.find(
                  (m: any) => m.matchedEntityType === 'processing_activity' && m.matchedEntityId === initialData.id,
                );
                return (
                  <div key={update.id} className="p-4 flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                      <h4 className="font-semibold text-[#F4F5F6] text-[14px] mb-1">{update.title}</h4>
                      <p className="text-[#9BA1A6] text-[13px] mb-2">{activityMatch?.aiExplanation}</p>
                      <a href={update.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] font-medium text-blue-400 hover:underline">
                        {t('view_full_update')} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <button 
                      onClick={() => acknowledgeMutation.mutate({ updateId: update.id })}
                      disabled={acknowledgeMutation.isPending}
                      className="shrink-0 bg-[#0D0F11] border border-blue-500/25 hover:border-blue-400 text-blue-400 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
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

              {isNew && (
                <div className="space-y-2 pt-4 border-t border-ink-900/8">
                  <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('legal.lawful_basis')} *</label>
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
                  <p className="text-[12px] text-[#6E747A]">{t('legal.role_hint')}</p>
                </div>
              )}

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
                      {/* 'active' is set by Publish, not chosen here. It is the one
                          status that asserts something to a regulator, and it has a
                          gate in front of it — a dropdown that quietly sets it is
                          exactly the costume B23 describes. Still offered when the
                          record already holds it, so the select is never empty. */}
                      {isPublished && <SelectItem value="active">{t('general.status_active')}</SelectItem>}
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

              {/* B18. Two owners, because they are two different people: the business
                  owner knows what the activity does, the privacy owner answers for it.
                  An unowned activity is the one that goes stale. */}
              {!isNew && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-ink-900/8">
                  <div className="space-y-2">
                    <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.business_owner')}</label>
                    <Select
                      value={formData.businessOwnerId || 'none'}
                      onValueChange={(v) => handleFieldChange('businessOwnerId', v === 'none' ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder={t('general.owner_unassigned')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('general.owner_unassigned')}</SelectItem>
                        {orgMembers.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[12px] text-[#6E747A]">{t('general.business_owner_hint')}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('general.privacy_owner')}</label>
                    <Select
                      value={formData.privacyOwnerId || 'none'}
                      onValueChange={(v) => handleFieldChange('privacyOwnerId', v === 'none' ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder={t('general.owner_unassigned')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('general.owner_unassigned')}</SelectItem>
                        {orgMembers.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[12px] text-[#6E747A]">{t('general.privacy_owner_hint')}</p>
                  </div>
                </div>
              )}

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

            {/* A12. Art. 22. The flags alone were never the record: 22(3) requires a
                human who can intervene, and 13(2)(f)/14(2)(g) require the logic and
                the envisaged consequences. Disclosed progressively, because a payroll
                activity should not be asked any of this. */}
            {!isNew && (
              <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5 fade-up">
                <div className="border-b border-ink-900/8 pb-3">
                  <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('adm.title')}</h2>
                  <p className="text-[12px] text-[#6E747A] mt-1">{t('adm.subtitle')}</p>
                </div>

                <label className="flex items-start gap-3 p-3 bg-white/50 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                  <Switch
                    checked={formData.involvesProfiling || false}
                    onCheckedChange={(checked) => handleFieldChange('involvesProfiling', checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-[13.5px] font-medium text-[#F4F5F6]">{t('adm.profiling')}</p>
                    <p className="text-[12px] text-[#6E747A]">{t('adm.profiling_desc')}</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-white/50 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                  <Switch
                    checked={formData.involvesAutomatedDecisionMaking || false}
                    onCheckedChange={(checked) => handleFieldChange('involvesAutomatedDecisionMaking', checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-[13.5px] font-medium text-[#F4F5F6]">{t('adm.solely_automated')}</p>
                    <p className="text-[12px] text-[#6E747A]">{t('adm.solely_automated_desc')}</p>
                  </div>
                </label>

                {formData.involvesAutomatedDecisionMaking && (
                  <div className="space-y-4 pl-3 border-l-2 border-[#C9A227]/30">
                    <div className="space-y-2">
                      <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('adm.logic')}</label>
                      <Textarea
                        value={formData.admLogic || ''}
                        onChange={(e) => handleFieldChange('admLogic', e.target.value)}
                        rows={3}
                        placeholder={t('adm.logic_ph')}
                      />
                      <p className="text-[12px] text-[#6E747A]">{t('adm.logic_hint')}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('adm.significance')}</label>
                      <Textarea
                        value={formData.admSignificance || ''}
                        onChange={(e) => handleFieldChange('admSignificance', e.target.value)}
                        rows={2}
                        placeholder={t('adm.significance_ph')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('adm.human_intervention')}</label>
                      <Textarea
                        value={formData.admHumanIntervention || ''}
                        onChange={(e) => handleFieldChange('admHumanIntervention', e.target.value)}
                        rows={2}
                        placeholder={t('adm.human_intervention_ph')}
                      />
                      <p className="text-[12px] text-[#6E747A]">{t('adm.human_intervention_hint')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* B26. Last on the tab rather than first: it is a checklist for a record
                being finished, not the first thing a new one should present. */}
            {!isNew && completeness && (
              <CompletenessPanel
                score={completeness.score}
                missing={missing}
                onGoToTab={(tab) => setActiveTab(tab)}
              />
            )}
          </div>
        )}

        {/* Tab 2: Legal Basis */}
        {activeTab === 'legal' && !isNew && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5 fade-up">
              <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('legal.title')}</h2>
              
              <div className="space-y-2">
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('legal.lawful_basis')} <span className="text-clay-600">*</span></label>
                <div className="mb-6">
                  <Label className="block text-sm font-medium text-[#E6E8EA] mb-1.5">{t('legal.role')}</Label>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="controller">{t('legal.role_controller')}</SelectItem>
                          <SelectItem value="joint_controller">{t('legal.role_joint_controller')}</SelectItem>
                          <SelectItem value="processor">{t('legal.role_processor')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="mt-1.5 text-[12px] text-[#6E747A]">{t('legal.role_hint')}</p>
                </div>

                {formData.role === 'processor' && (
                  <div className="mb-6">
                    <Label className="block text-sm font-medium text-[#E6E8EA] mb-1.5">
                      {t('legal.controller_name')}
                    </Label>
                    <Controller
                      name="controllerName"
                      control={control}
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} placeholder={t('legal.controller_name_placeholder')} />
                      )}
                    />
                    <p className="mt-1.5 text-[12px] text-[#6E747A]">{t('legal.controller_name_hint')}</p>
                  </div>
                )}

                <Controller
                  name="lawfulBasis"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={normaliseLawfulBasis(field.value)}>
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

              {normaliseLawfulBasis(formData.lawfulBasis) === 'legitimate_interest' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <h3 className="text-[13px] font-medium text-amber-400 mb-1">{t('legal.lia_required')}</h3>
                  {/* The "Start / View LIA" button that sat here had no onClick and
                      nothing to route to: legitimate_interest_assessments carries the
                      full three-part test and has zero procedures. The advice is
                      correct and stays; the control that promised to act on it does
                      not. Building the LIA is F55. */}
                  <p className="text-[12.5px] text-[#9BA1A6]">{t('legal.lia_desc')}</p>
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
                  value={retentionIsCustom ? 'custom' : (formData.retentionPeriod || '')}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setRetentionIsCustom(true);
                      // The old Custom option stored this literal string. It is not a
                      // retention period, so it does not belong in the text field.
                      if (formData.retentionPeriod === 'custom') handleFieldChange('retentionPeriod', '');
                      return;
                    }
                    setRetentionIsCustom(false);
                    handleFieldChange('retentionPeriod', value);
                  }}
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
                {retentionIsCustom && (
                  <Input
                    value={formData.retentionPeriod === 'custom' ? '' : (formData.retentionPeriod || '')}
                    onChange={(e) => handleFieldChange('retentionPeriod', e.target.value)}
                    placeholder={t('retention.custom_ph')}
                  />
                )}
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
