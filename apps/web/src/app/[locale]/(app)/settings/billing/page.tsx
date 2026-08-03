'use client';

import { useState, useEffect } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TIERS = [
  {
    id: 'professional',
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_PROFESSIONAL_PRICE_ID || 'pri_01professional',
    isCustom: false,
  },
  {
    id: 'enterprise',
    isCustom: true,
  }
];

export default function BillingPage() {
  const t = useTranslations('settings.billing');
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [isInitializing, setIsInitializing] = useState(true);
  const { data: session } = useSession();
  const user = session?.user as any;
  const subscriptionStatus = (session as any)?.subscriptionStatus;
  const trialEndsAt = (session as any)?.trialEndsAt;
  
  const isExpiredTrial = subscriptionStatus === 'trialing' && trialEndsAt && Date.now() > trialEndsAt;
  const isPastDue = subscriptionStatus === 'past_due';
  const isCanceled = subscriptionStatus === 'canceled';
  const isLocked = isExpiredTrial || isPastDue || isCanceled;

  const { data: stats } = trpc.settings.getUsageStats.useQuery(undefined, {
    enabled: isLocked,
  });

  useEffect(() => {
    initializePaddle({
      environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as 'sandbox' | 'production') || 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_token',
    }).then((paddleInstance) => {
      setPaddle(paddleInstance);
      setIsInitializing(false);
    });
  }, []);

  const handleUpgrade = (priceId: string) => {
    if (!paddle || !user?.organizationId) return;

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { organizationId: user.organizationId },
      customer: {
        email: user.email,
      },
      settings: {
        displayMode: 'overlay',
        theme: 'light',
        locale: 'en',
        allowLogout: false,
      },
    });
  };

  const renderCTA = (tier: any) => {
    if (tier.isCustom) {
      return (
        <a
          href="/contact"
          className="block text-center w-full py-2.5 px-4 bg-transparent border border-ink-700 text-[#F4F5F6] rounded-lg hover:bg-ink-800 transition-colors font-medium text-sm"
        >
          {t('cta.contact_us')}
        </a>
      );
    }

    if (!subscriptionStatus || subscriptionStatus === 'trialing') {
      return (
        <button
          onClick={() => handleUpgrade(tier.paddlePriceId)}
          className="w-full py-2.5 px-4 bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition-colors font-medium text-sm"
        >
          {t('cta.subscribe', { name: tier.name })}
        </button>
      );
    }

    let badgeText = t('cta.current_plan');
    let badgeColors = "bg-green-500/10 text-green-500 border border-green-500/20";

    switch (subscriptionStatus) {
      case 'active':
        badgeText = t('cta.current_plan');
        badgeColors = "bg-green-500/10 text-green-500 border border-green-500/20";
        break;
      case 'past_due':
      case 'unpaid':
        badgeText = t('cta.payment_failed');
        badgeColors = "bg-red-500/10 text-red-500 border border-red-500/20";
        break;
      case 'canceled':
        badgeText = t('cta.canceled');
        badgeColors = "bg-[#2D3135] text-[#9BA1A6] border border-white/10";
        break;
      case 'paused':
        badgeText = t('cta.paused');
        badgeColors = "bg-amber-500/10 text-amber-500 border border-amber-500/20";
        break;
    }

    return (
      <div className={`w-full py-2.5 px-4 rounded-lg text-center font-medium text-sm ${badgeColors}`}>
        {badgeText}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {isLocked && (
        <div className="bg-accent-500/10 border border-accent-500/20 rounded-2xl p-6 mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-500/20 mb-4">
            <CheckCircle className="w-6 h-6 text-accent-500" />
          </div>
          <h2 className="text-xl font-bold text-[#F4F5F6] mb-2">
            {isExpiredTrial && t('locked.trial_ended')}
            {isPastDue && t('locked.payment_failed')}
            {isCanceled && t('locked.canceled')}
          </h2>
          <p className="text-[#9BA1A6] max-w-lg mx-auto mb-6">
            {isExpiredTrial && t('locked.trial_ended_desc')}
            {isPastDue && t('locked.payment_failed_desc')}
            {isCanceled && t('locked.canceled_desc')}
          </p>
          
          {stats && (
             <div className="flex items-center justify-center gap-8 border-t border-white/10 pt-6 mt-6">
               <div className="text-center">
                 <div className="text-2xl font-serif text-[#F4F5F6]">{stats.ropaEntries}</div>
                 <div className="text-xs text-[#9BA1A6] uppercase tracking-wider mt-1">{t('stats.ropa_entries')}</div>
               </div>
               <div className="w-px h-10 bg-white/10"></div>
               <div className="text-center">
                 <div className="text-2xl font-serif text-[#F4F5F6]">{stats.vendorsTracked}</div>
                 <div className="text-xs text-[#9BA1A6] uppercase tracking-wider mt-1">{t('stats.vendors_tracked')}</div>
               </div>
             </div>
          )}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-serif text-[#F4F5F6]">{t('title')}</h1>
        <p className="text-[#9BA1A6] mt-2">{t('subtitle')}</p>
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-3xl p-8 shadow-panel-elevated">
        <h2 className="text-lg font-bold text-[#F4F5F6] mb-6">{t('available_plans')}</h2>
        
        {isInitializing ? (
           <div className="text-[#6E747A] animate-pulse">{t('initializing')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIERS.map(tier => {
              const features: string[] = t.raw(`plans.${tier.id}.features`);
              const name = t(`plans.${tier.id}.name`);
              return (
              <div key={tier.id} className="border border-white/10 rounded-2xl p-6 flex flex-col hover:border-accent-500 transition-colors">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-[#F4F5F6]">{name}</h3>
                  <div className="text-3xl font-serif font-medium text-[#F4F5F6] mt-2">{t(`plans.${tier.id}.price`)}<span className="text-sm font-sans text-[#6E747A]">/mo</span></div>
                  <p className="text-sm text-[#9BA1A6] mt-2 min-h-[40px]">{t(`plans.${tier.id}.description`)}</p>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#E6E8EA]">
                      <CheckCircle className="w-5 h-5 text-accent-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {renderCTA({ ...tier, name })}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
