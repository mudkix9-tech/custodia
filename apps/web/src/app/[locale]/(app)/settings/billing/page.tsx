'use client';

import { useState, useEffect } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { trpc } from '@/utils/trpc';
import { useSession } from 'next-auth/react';
import { CheckCircle } from 'lucide-react';

const TIERS = [
  {
    id: 'professional',
    name: 'Professional',
    price: '€99',
    description: 'The complete OS for growing agencies.',
    features: ['Unlimited users & activities', 'Unlimited vendors & DPIAs', 'Cookie consent (50 domains)', 'AI compliance advisor (2,000 queries)'],
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_PROFESSIONAL_PRICE_ID || 'pri_01professional',
  }
];

export default function BillingPage() {
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
    if (!paddle || !user?.orgId) return;

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { organizationId: user.orgId },
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {isLocked && (
        <div className="bg-accent-500/10 border border-accent-500/20 rounded-2xl p-6 mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-500/20 mb-4">
            <CheckCircle className="w-6 h-6 text-accent-500" />
          </div>
          <h2 className="text-xl font-bold text-[#F4F5F6] mb-2">
            {isExpiredTrial && "Your trial has ended."}
            {isPastDue && "Your payment failed."}
            {isCanceled && "Your subscription was canceled."}
          </h2>
          <p className="text-[#9BA1A6] max-w-lg mx-auto mb-6">
            {isExpiredTrial && "Subscribe to keep access to your compliance data."}
            {isPastDue && "Update your billing details to restore access to your account."}
            {isCanceled && "Resubscribe to restore access to your account."}
          </p>
          
          {stats && (
             <div className="flex items-center justify-center gap-8 border-t border-white/10 pt-6 mt-6">
               <div className="text-center">
                 <div className="text-2xl font-serif text-[#F4F5F6]">{stats.ropaEntries}</div>
                 <div className="text-xs text-[#9BA1A6] uppercase tracking-wider mt-1">ROPA Entries</div>
               </div>
               <div className="w-px h-10 bg-white/10"></div>
               <div className="text-center">
                 <div className="text-2xl font-serif text-[#F4F5F6]">{stats.vendorsTracked}</div>
                 <div className="text-xs text-[#9BA1A6] uppercase tracking-wider mt-1">Vendors Tracked</div>
               </div>
             </div>
          )}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-serif text-[#F4F5F6]">Billing & Subscriptions</h1>
        <p className="text-[#9BA1A6] mt-2">Manage your plan and payment methods.</p>
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-3xl p-8 shadow-panel-elevated">
        <h2 className="text-lg font-bold text-[#F4F5F6] mb-6">Available Plans</h2>
        
        {isInitializing ? (
           <div className="text-[#6E747A] animate-pulse">Initializing billing system...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIERS.map(tier => (
              <div key={tier.id} className="border border-white/10 rounded-2xl p-6 flex flex-col hover:border-accent-500 transition-colors">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-[#F4F5F6]">{tier.name}</h3>
                  <div className="text-3xl font-serif font-medium text-[#F4F5F6] mt-2">{tier.price}<span className="text-sm font-sans text-[#6E747A]">/mo</span></div>
                  <p className="text-sm text-[#9BA1A6] mt-2 min-h-[40px]">{tier.description}</p>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#E6E8EA]">
                      <CheckCircle className="w-5 h-5 text-accent-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(tier.paddlePriceId)}
                  className="w-full py-2.5 px-4 bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition-colors font-medium text-sm"
                >
                  Upgrade to {tier.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
