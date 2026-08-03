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
