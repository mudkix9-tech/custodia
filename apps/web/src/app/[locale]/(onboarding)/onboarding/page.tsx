'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { Step1OrgProfile } from '@/components/onboarding/Step1OrgProfile';
import { Step2AddTools } from '@/components/onboarding/Step2AddTools';
import { Step3CreateActivities } from '@/components/onboarding/Step3CreateActivities';
import { Step4GeneratePolicy } from '@/components/onboarding/Step4GeneratePolicy';
import { Step5InviteTeam } from '@/components/onboarding/Step5InviteTeam';
import { Step6Complete } from '@/components/onboarding/Step6Complete';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [industry, setIndustry] = useState('marketing_agency');
  const [summary, setSummary] = useState({
    vendorsCount: 0,
    activitiesCount: 0,
    policyPublished: false,
    policyExists: false,
    invitesCount: 0,
    cookieCount: 0,
    domainName: '',
    isScanning: false,
    undocumentedVendorsCount: 0,
  });

  const { data: status, isLoading: statusLoading } = trpc.onboarding.getStatus.useQuery();
  const saveOrg = trpc.onboarding.saveOrgProfile.useMutation();
  const saveVendors = trpc.onboarding.saveVendors.useMutation();
  // getTemplates is a query, but we want to fetch it on demand, so we'll use useQuery with enabled: false or skip it
  // Actually, we can just use trpc.useUtils() or trpc.onboarding.getTemplates.useQuery with enabled flag.
  // Wait, the backend has getTemplates as a query!
  const getTemplates = trpc.onboarding.getTemplates.useQuery({ industry }, { enabled: false });
  const utils = trpc.useUtils();
  const createActivity = trpc.onboarding.createFromTemplate.useMutation();
  const createCustomActivity = trpc.onboarding.createCustomActivity.useMutation();
  const generatePolicy = trpc.onboarding.generatePolicy.useMutation();
  const publishPolicy = trpc.onboarding.publishPolicy.useMutation();
  const inviteTeam = trpc.onboarding.inviteTeam.useMutation();
  const completeOnboarding = trpc.onboarding.complete.useMutation();
  const dismiss = trpc.onboarding.dismiss.useMutation();

  const handleDismiss = async () => {
    await dismiss.mutateAsync();
    window.location.href = '/dashboard';
  };

  const [templates, setTemplates] = useState<any[]>([]);
  const [policyData, setPolicyData] = useState<any>(null);

  useEffect(() => {
    if (!statusLoading) {
      if (status?.onboardingCompleted) {
        router.push('/dashboard');
      } else if (status?.onboardingStep && status.onboardingStep > 0) {
        setCurrentStep(status.onboardingStep + 1);
        if (status.onboardingStep >= 1) {
          // fetch templates if resuming at step 3
          loadTemplates(industry);
        }
      }
      setSummary({
        vendorsCount: (status as any).vendorsCount || 0,
        activitiesCount: (status as any).activitiesCount || 0,
        policyPublished: (status as any).policyPublished || false,
        policyExists: (status as any).policyExists || false,
        invitesCount: (status as any).invitesCount || 0,
        cookieCount: (status as any).cookieCount || 0,
        domainName: (status as any).domainName || '',
        isScanning: (status as any).isScanning || false,
        undocumentedVendorsCount: (status as any).undocumentedVendorsCount || 0,
      });

      setLoading(false);
    }
  }, [status, statusLoading, router]);

  const loadTemplates = async (ind: string) => {
    const res = await utils.onboarding.getTemplates.fetch({ industry: ind });
    setTemplates(res);
  };

  const handleStep1 = async (data: any) => {
    setIndustry(data.industry);
    await saveOrg.mutateAsync(data);
    setCurrentStep(2);
  };

  const handleStep2 = async (tools: string[]) => {
    await saveVendors.mutateAsync({ vendorIds: tools }); // Note: mock tools are not real UUIDs, but backend handles it or we can ignore for this demo
    setSummary(prev => ({ ...prev, vendorsCount: tools.length }));
    await loadTemplates(industry);
    setCurrentStep(3);
  };

  const handleStep3 = async (templateIds: string[], customActivities: string[] = []) => {
    for (const id of templateIds) {
      await createActivity.mutateAsync({ templateId: id, industry });
    }
    for (const name of customActivities) {
      await createCustomActivity.mutateAsync({ name });
    }
    setSummary(prev => ({ ...prev, activitiesCount: templateIds.length + customActivities.length }));

    // Generate draft policy for step 4 preview
    if (templateIds.length > 0 || customActivities.length > 0 || summary.vendorsCount > 0) {
      const res = await generatePolicy.mutateAsync({});
      setPolicyData(res);
    }

    setCurrentStep(4);
  };

  const handleStep4 = async (publish: boolean) => {
    if (publish && policyData?.policyId) {
      await publishPolicy.mutateAsync({ policyId: policyData.policyId });
    }
    setSummary(prev => ({ ...prev, policyPublished: publish }));
    setCurrentStep(5);
  };

  const handleStep5 = async (invites: any[]) => {
    if (invites.length > 0) {
      await inviteTeam.mutateAsync({ invites });
    }
    setSummary(prev => ({ ...prev, invitesCount: invites.length }));
    setCurrentStep(6);
  };

  const handleComplete = async (targetPath?: string) => {
    await completeOnboarding.mutateAsync();
    window.location.href = targetPath || '/dashboard';
  };

  const companySize = (status?.settings as any)?.companySize || '1-4';

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <>
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center w-full shrink-0">
        <div className="flex items-center">
          <div className="text-xl font-bold text-gray-900">Custodia</div>
        </div>
        {currentStep < 6 ? (
          <button onClick={handleDismiss} className="text-sm text-gray-500 hover:text-gray-700">
            Save and exit
          </button>
        ) : (
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full font-semibold">
            Setup Complete
          </span>
        )}
      </header>
      <main className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full px-4 py-8">
        <OnboardingProgress currentStep={currentStep} totalSteps={6} />

        <div className="mt-8">
          {currentStep === 1 && <Step1OrgProfile onNext={handleStep1} />}
          {currentStep === 2 && <Step2AddTools onNext={handleStep2} industry={industry} />}
          {currentStep === 3 && <Step3CreateActivities templates={templates} onNext={handleStep3} />}
          {currentStep === 4 && <Step4GeneratePolicy policyPreview={policyData} onNext={handleStep4} />}
          {currentStep === 5 && <Step5InviteTeam onNext={handleStep5} companySize={companySize} />}
          {currentStep === 6 && <Step6Complete summary={summary} onComplete={handleComplete} />}
        </div>
      </main>
    </>
  );
}
