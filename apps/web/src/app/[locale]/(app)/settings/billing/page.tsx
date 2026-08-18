'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

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
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { data: session, update } = useSession();
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

  const syncSubscriptionSession = useCallback(async () => {
    setIsSyncing(true);
    try {
      const updated = await update();
      const status = (updated as any)?.subscriptionStatus;
      const trialEnd = (updated as any)?.trialEndsAt;
      const active = status === 'active' || (status === 'trialing' && (!trialEnd || Date.now() <= trialEnd));
      if (active) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (e) {
      console.error('Failed to sync session:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [update, router]);

  const handleCheckoutCompleted = useCallback(async () => {
    setIsActivating(true);
    let attempts = 0;
    const maxAttempts = 8;
    const poll = async () => {
      attempts++;
      try {
        const updated = await update();
        const status = (updated as any)?.subscriptionStatus;
        if (status === 'active') {
          setIsActivating(false);
          router.push('/dashboard');
          router.refresh();
          return;
        }
      } catch (e) {
        console.error('Error during post-checkout sync:', e);
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 1500);
      } else {
        setIsActivating(false);
        router.push('/dashboard');
        router.refresh();
      }
    };
    setTimeout(poll, 1500);
  }, [update, router]);

  useEffect(() => {
    initializePaddle({
      environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as 'sandbox' | 'production') || 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_token',
      eventCallback: (event) => {
        if (event.name === 'checkout.completed') {
          handleCheckoutCompleted();
        }
      },
    }).then((paddleInstance) => {
      setPaddle(paddleInstance);
      setIsInitializing(false);
    });
  }, [handleCheckoutCompleted]);

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
          className="block text-center w-full py-2.5 px-4 bg-transparent border border-set-line-strong text-set-fg rounded-lg hover:bg-[#131316] transition-colors font-medium text-sm"
        >
          {t('cta.contact_us')}
        </a>
      );
    }

    if (!subscriptionStatus || subscriptionStatus === 'trialing') {
      return (
        <button
          onClick={() => handleUpgrade(tier.paddlePriceId)}
          className="w-full py-2.5 px-4 bg-set-gold text-[#0A0A0A] hover:bg-set-gold-hi rounded-lg transition-colors font-medium text-sm"
        >
          {t('cta.subscribe', { name: tier.name })}
        </button>
      );
    }

    let badgeText = t('cta.current_plan');
    let badgeColors = "bg-set-ok/12 text-set-ok border border-green-500/20";

    switch (subscriptionStatus) {
      case 'active':
        badgeText = t('cta.current_plan');
        badgeColors = "bg-set-ok/12 text-set-ok border border-green-500/20";
        break;
      case 'past_due':
      case 'unpaid':
        badgeText = t('cta.payment_failed');
        badgeColors = "bg-set-danger/12 text-set-danger border border-set-danger/30";
        break;
      case 'canceled':
        badgeText = t('cta.canceled');
        badgeColors = "bg-[#2D3135] text-set-fg-muted border border-set-line";
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
    <div className="mx-auto max-w-[1040px] space-y-5 px-8 pt-10 pb-24 rise-in">
      {isActivating && (
        <div className="bg-set-gold/10 border border-set-gold/30 rounded-2xl p-6 mb-8 text-center flex items-center justify-center gap-3 text-set-fg">
          <Loader2 className="w-5 h-5 text-set-gold animate-spin" />
          <span className="font-medium text-sm">{t('activating')}</span>
        </div>
      )}

      {isLocked && !isActivating && (
        <div className="bg-accent-500/10 border border-accent-500/20 rounded-2xl p-6 mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-500/20 mb-4">
            <CheckCircle className="w-6 h-6 text-accent-500" />
          </div>
          <h2 className="text-xl font-bold text-set-fg mb-2">
            {isExpiredTrial && t('locked.trial_ended')}
            {isPastDue && t('locked.payment_failed')}
            {isCanceled && t('locked.canceled')}
          </h2>
          <p className="text-set-fg-muted max-w-lg mx-auto mb-4">
            {isExpiredTrial && t('locked.trial_ended_desc')}
            {isPastDue && t('locked.payment_failed_desc')}
            {isCanceled && t('locked.canceled_desc')}
          </p>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={syncSubscriptionSession}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-set-fg bg-set-panel border border-set-line hover:border-set-line-strong rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? t('syncing') : t('sync_status')}
            </button>
          </div>
          
          {stats && (
             <div className="flex items-center justify-center gap-8 border-t border-set-line pt-6 mt-6">
               <div className="text-center">
                 <div className="text-2xl font-serif text-set-fg">{stats.ropaEntries}</div>
                 <div className="text-xs text-set-fg-muted uppercase tracking-wider mt-1">{t('stats.ropa_entries')}</div>
               </div>
               <div className="w-px h-10 bg-set-line"></div>
               <div className="text-center">
                 <div className="text-2xl font-serif text-set-fg">{stats.vendorsTracked}</div>
                 <div className="text-xs text-set-fg-muted uppercase tracking-wider mt-1">{t('stats.vendors_tracked')}</div>
               </div>
             </div>
          )}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-serif text-set-fg">{t('title')}</h1>
        <p className="text-set-fg-muted mt-2">{t('subtitle')}</p>
      </div>

      <div className="bg-set-panel border border-set-line rounded-3xl p-8 shadow-panel-elevated">
        <h2 className="text-lg font-bold text-set-fg mb-6">{t('available_plans')}</h2>
        
        {isInitializing ? (
           <div className="text-set-fg-subtle animate-pulse">{t('initializing')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIERS.map(tier => {
              const features: string[] = t.raw(`plans.${tier.id}.features`);
              const name = t(`plans.${tier.id}.name`);
              return (
              <div key={tier.id} className="border border-set-line rounded-2xl p-6 flex flex-col hover:border-accent-500 transition-colors">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-set-fg">{name}</h3>
                  <div className="text-3xl font-serif font-medium text-set-fg mt-2">{t(`plans.${tier.id}.price`)}<span className="text-sm font-sans text-set-fg-subtle">/mo</span></div>
                  <p className="text-sm text-set-fg-muted mt-2 min-h-[40px]">{t(`plans.${tier.id}.description`)}</p>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-set-fg">
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
