'use client';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Tab } from '@headlessui/react';
import { Clock } from 'lucide-react';
import BreachCountdown from '@/components/breaches/BreachCountdown';
import RiskAssessmentMatrix from '@/components/breaches/RiskAssessmentMatrix';
import BreachNotificationDraft from '@/components/breaches/BreachNotificationDraft';
import BreachTasks from '@/components/breaches/BreachTasks';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { useDeadlineCountdown, formatDeadline } from '@/hooks/useDeadlineCountdown';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function BreachWorkspace() {
  const t = useTranslations('breaches.workspace');
  const { id } = useParams();
  const breachId = id as string;

  const { data: breach, isLoading, refetch } = trpc.breaches.getById.useQuery({ id: breachId });
  const { setContext } = useAiGuidanceStore();
  const locale = useLocale();

  const [activeTab, setActiveTab] = useState(0);

  // Set AI guidance context when breach data loads
  useEffect(() => {
    if (breach) {
      setContext({
        module: 'breaches',
        entityId: breachId,
        formData: {
          title: breach.title,
          description: breach.description,
          discoveredAt: breach.discoveredAt,
          dataCategoriesAffected: breach.dataCategoriesAffected,
          estimatedRecordsAffected: breach.estimatedRecordsAffected,
        }
      });
    }
  }, [breachId, breach?.status]);

  // Article 33's 72 hours run in real time, so the banner has to as well. This
  // was a useMemo keyed on the deadline: it computed once at mount and then
  // stood still. Hooks run before the early returns below, hence the optional
  // chaining rather than a guard.
  const alreadyNotified =
    breach?.status === 'notified_authority' ||
    breach?.status === 'notified' ||
    breach?.status === 'closed' ||
    !!breach?.authorityNotifiedAt;
  const countdown = useDeadlineCountdown(breach?.notificationDeadline, alreadyNotified);

  if (isLoading) return <GenericWorkspaceSkeleton />;
  if (!breach) return <div className="p-6">{t('not_found')}</div>;

  const isNotified = alreadyNotified;
  // Under 24 hours, or already past the deadline, is the escalated state.
  const isUrgent = !!countdown && !isNotified && (countdown.expired || countdown.hoursRemaining < 24);
  const showBanner = !!countdown && !isNotified && (breach.status === 'detected' || breach.status === 'assessing');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Article 33 Critical Countdown Banner */}
      {showBanner && (
        <div className={`rounded-xl p-4 flex items-center gap-4 ${
          isUrgent 
            ? 'bg-red-500/10 border-2 border-red-500/30 motion-safe:animate-pulse' 
            : 'bg-amber-500/10 border border-amber-900/50'
        }`}>
          <div className={`p-2 rounded-full ${isUrgent ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
            <Clock className={`w-5 h-5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-[14px] font-bold ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              {countdown!.expired
                ? t('banner.expired')
                : t('banner.remaining', {
                    hours: countdown!.hours,
                    minutes: String(countdown!.minutes).padStart(2, '0'),
                  })}
            </h3>
            <p className={`text-[12px] tabular-nums ${isUrgent ? 'text-red-300/80' : 'text-amber-300/80'}`}>
              {t('banner.due', { date: formatDeadline(breach.notificationDeadline as string, locale) })}
            </p>
            <p className={`text-[12.5px] ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              {isUrgent ? t('banner.urgent') : t('banner.normal')}
            </p>
          </div>
        </div>
      )}
      
      {/* Critical Header / Countdown */}
      <div className="bg-[#0D0F11] shadow-panel-elevated rounded-xl p-6 border border-white/10 flex justify-between items-center relative overflow-hidden">
        {/* Red accent bar for severe cases */}
        {(breach.status === 'detected' || breach.status === 'assessing') && (
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500/100"></div>
        )}
        
        <div className="pl-2">
          <p className="text-xs font-semibold tracking-wider text-red-400 uppercase mb-1">{t('reference', { reference: breach.referenceNumber })}</p>
          <h1 className="text-2xl font-bold text-[#F4F5F6]">{breach.title}</h1>
          <p className="text-sm text-[#9BA1A6] mt-1 max-w-3xl">{breach.description}</p>
        </div>

        <div className="text-right flex items-center gap-6">
          <div className="text-sm">
            <span className="block text-[#9BA1A6] mb-1">{t('status')}</span>
            <span className="font-semibold px-2 py-1 bg-white/10 rounded-md">{t(`statuses.${breach.status ?? 'detected'}`)}</span>
          </div>
          <BreachCountdown 
            deadline={breach.notificationDeadline as string} 
            status={breach.status || 'detected'}
            notifiedAt={breach.authorityNotifiedAt as string | null}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
        <Tab.List className="flex space-x-1 rounded-xl bg-white/10 p-1">
          {(['risk', 'drafts', 'tasks', 'timeline'] as const).map((category) => (
            <Tab
              key={category}
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all',
                  selected
                    ? 'bg-[#0D0F11] text-red-400 shadow'
                    : 'text-[#9BA1A6] hover:bg-[#0D0F11]/[0.12] hover:text-red-400'
                )
              }
            >
              {t(`tabs.${category}`)}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-4">
          
          <Tab.Panel className="rounded-xl bg-[#0D0F11] p-6 shadow-panel-elevated border border-white/10">
            <RiskAssessmentMatrix breach={breach} onAssess={() => refetch()} />
          </Tab.Panel>

          <Tab.Panel className="rounded-xl bg-[#0D0F11] p-6 shadow-panel-elevated border border-white/10">
            <BreachNotificationDraft breachId={breach.id} />
          </Tab.Panel>

          <Tab.Panel className="rounded-xl bg-[#0D0F11] p-6 shadow-panel-elevated border border-white/10">
            <BreachTasks breachId={breach.id} />
          </Tab.Panel>

          <Tab.Panel className="rounded-xl bg-[#0D0F11] p-6 shadow-panel-elevated border border-white/10">
            <div className="prose prose-invert">
              <h3>{t('timeline.title')}</h3>
              <p>{t('timeline.description')}</p>
              {/* Timeline component implementation... */}
              <div className="border-l-2 border-white/10 pl-4 mt-8 space-y-6">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-red-500/100 border-2 border-white"></div>
                  <p className="text-sm font-medium text-[#F4F5F6]">{t('timeline.discovered')}</p>
                  <p className="text-xs text-[#9BA1A6]">{new Date(breach.discoveredAt).toLocaleString()}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-white/10 border-2 border-white"></div>
                  <p className="text-sm font-medium text-[#F4F5F6]">{t('timeline.created')}</p>
                  <p className="text-xs text-[#9BA1A6]">{t('timeline.created_by', {
                    date: new Date(breach.createdAt!).toLocaleString(),
                    user: (breach as any).createdByName ?? t('timeline.unknown_user'),
                  })}</p>
                </div>
              </div>
            </div>
          </Tab.Panel>

        </Tab.Panels>
      </Tab.Group>

    </div>
  );
}
