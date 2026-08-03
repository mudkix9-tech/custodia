'use client';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { Tab } from '@headlessui/react';
import { Clock } from 'lucide-react';
import BreachCountdown from '@/components/breaches/BreachCountdown';
import RiskAssessmentMatrix from '@/components/breaches/RiskAssessmentMatrix';
import BreachNotificationDraft from '@/components/breaches/BreachNotificationDraft';
import BreachTasks from '@/components/breaches/BreachTasks';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function BreachWorkspace() {
  const { id } = useParams();
  const breachId = id as string;

  const { data: breach, isLoading, refetch } = trpc.breaches.getById.useQuery({ id: breachId });
  const { setContext } = useAiGuidanceStore();

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

  // Calculate remaining hours for Article 33 banner
  const remainingHours = useMemo(() => {
    if (!breach?.notificationDeadline) return null;
    const deadlineMs = new Date(breach.notificationDeadline).getTime();
    const nowMs = Date.now();
    const diffMs = deadlineMs - nowMs;
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
  }, [breach?.notificationDeadline]);

  if (isLoading) return <GenericWorkspaceSkeleton />;
  if (!breach) return <div className="p-6">Breach not found.</div>;

  const isNotified = breach.status === 'notified_authority' || breach.status === 'closed' || !!breach.authorityNotifiedAt;
  const isUrgent = remainingHours !== null && remainingHours <= 24 && !isNotified;
  const showBanner = remainingHours !== null && !isNotified && (breach.status === 'detected' || breach.status === 'assessing');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Article 33 Critical Countdown Banner */}
      {showBanner && (
        <div className={`rounded-xl p-4 flex items-center gap-4 ${
          isUrgent 
            ? 'bg-red-500/10 border-2 border-red-300 animate-pulse' 
            : 'bg-amber-500/10 border border-amber-900/50'
        }`}>
          <div className={`p-2 rounded-full ${isUrgent ? 'bg-red-500/20' : 'bg-amber-100'}`}>
            <Clock className={`w-5 h-5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-[14px] font-bold ${isUrgent ? 'text-red-400' : 'text-amber-800'}`}>
              Article 33 Notification Deadline: {remainingHours} hour{remainingHours !== 1 ? 's' : ''} remaining
            </h3>
            <p className={`text-[12.5px] ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              {isUrgent 
                ? 'CRITICAL: You must notify the supervisory authority without undue delay and within 72 hours of becoming aware of a personal data breach.'
                : 'Under GDPR Article 33, the supervisory authority must be notified within 72 hours unless the breach is unlikely to result in a risk to individuals.'
              }
            </p>
          </div>
        </div>
      )}
      
      {/* Critical Header / Countdown */}
      <div className="bg-[#0D0F11] dark:bg-gray-800 shadow-panel-elevated rounded-xl p-6 ring-1 ring-black ring-opacity-5 flex justify-between items-center relative overflow-hidden">
        {/* Red accent bar for severe cases */}
        {(breach.status === 'detected' || breach.status === 'assessing') && (
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500/100"></div>
        )}
        
        <div className="pl-2">
          <p className="text-xs font-semibold tracking-wider text-red-400 uppercase mb-1">Incident Reference: {breach.referenceNumber}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{breach.title}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">{breach.description}</p>
        </div>

        <div className="text-right flex items-center gap-6">
          <div className="text-sm">
            <span className="block text-gray-500 mb-1">Status</span>
            <span className="font-semibold capitalize px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">{breach.status}</span>
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
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800/50 p-1">
          {['Risk Assessment', 'Notification Drafts', 'Remediation Tasks', 'Timeline & Logs'].map((category) => (
            <Tab
              key={category}
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all',
                  selected
                    ? 'bg-[#0D0F11] text-red-400 dark:bg-gray-700 dark:text-red-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-[#0D0F11]/[0.12] hover:text-red-400 dark:hover:text-red-300'
                )
              }
            >
              {category}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-4">
          
          <Tab.Panel className="rounded-xl bg-[#0D0F11] dark:bg-gray-800 p-6 shadow-panel-elevated ring-1 ring-black ring-opacity-5">
            <RiskAssessmentMatrix breach={breach} onAssess={() => refetch()} />
          </Tab.Panel>

          <Tab.Panel className="rounded-xl bg-[#0D0F11] dark:bg-gray-800 p-6 shadow-panel-elevated ring-1 ring-black ring-opacity-5">
            <BreachNotificationDraft breachId={breach.id} />
          </Tab.Panel>

          <Tab.Panel className="rounded-xl bg-[#0D0F11] dark:bg-gray-800 p-6 shadow-panel-elevated ring-1 ring-black ring-opacity-5">
            <BreachTasks breachId={breach.id} />
          </Tab.Panel>

          <Tab.Panel className="rounded-xl bg-[#0D0F11] dark:bg-gray-800 p-6 shadow-panel-elevated ring-1 ring-black ring-opacity-5">
            <div className="prose dark:prose-invert">
              <h3>Timeline & Audit Logs</h3>
              <p>Chronological history of all actions related to this incident. Evidence stored here is immutable.</p>
              {/* Timeline component implementation... */}
              <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 mt-8 space-y-6">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-red-500/100 border-2 border-white dark:border-gray-800"></div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Incident Discovered</p>
                  <p className="text-xs text-gray-500">{new Date(breach.discoveredAt).toLocaleString()}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-gray-300 border-2 border-white dark:border-gray-800"></div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Case Created</p>
                  <p className="text-xs text-gray-500">{new Date(breach.createdAt!).toLocaleString()} by User</p>
                </div>
              </div>
            </div>
          </Tab.Panel>

        </Tab.Panels>
      </Tab.Group>

    </div>
  );
}
