"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, Check, Info, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [isInitializing, setIsInitializing] = useState(true);
  const { data: session } = useSession();

  React.useEffect(() => {
    initializePaddle({
      environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as 'sandbox' | 'production') || 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_token',
    }).then((paddleInstance) => {
      setPaddle(paddleInstance);
      setIsInitializing(false);
    });
  }, []);

  const handleUpgrade = (tierId: 'starter' | 'professional' | 'agency') => {
    if (!session || !paddle) {
      window.location.href = '/login?callbackUrl=/pricing';
      return;
    }
    
    // Map tierId to actual Paddle Price IDs (which might differ based on annual/monthly)
    const priceId = isAnnual ? `price_${tierId}_annual` : `price_${tierId}_monthly`;
    
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { organizationId: (session.user as any)?.orgId },
      ...(session.user?.email ? { customer: { email: session.user.email } } : {}),
      settings: {
        displayMode: 'overlay',
        theme: 'light',
        locale: 'en',
        allowLogout: false,
      },
    });
  };

  const tiers = [
    {
      name: 'Starter',
      description: 'Perfect for small agencies needing basic Article 30 compliance.',
      price: { monthly: 39, annual: 31 },
      tierId: 'starter',
      features: ['ROPA Management', 'Gap Assessment Engine', 'Basic Audit Logs', 'Up to 2 team members']
    },
    {
      name: 'Professional',
      description: 'Full compliance suite with DSAR automation and vendor intelligence.',
      price: { monthly: 89, annual: 71 },
      tierId: 'professional',
      isPopular: true,
      features: ['Everything in Starter', 'Vendor Management & TIAs', 'DSAR Automation', 'Privacy Policy Generator', 'Unlimited team members', '14-day Free Trial']
    },
    {
      name: 'Agency',
      description: 'Multi-tenant architecture for managing your clients\' compliance.',
      price: { monthly: 179, annual: 143 },
      tierId: 'agency',
      features: ['Everything in Professional', 'Unlimited Clients', 'Client Trust Portals', 'White-labeled PDF Reports', 'Dedicated Account Manager']
    }
  ];

  return (
    <div className="min-h-screen bg-bone-50 text-ink-900 font-sans selection:bg-sage-500/30">
      <header className="p-6 border-b border-ink-900/5 flex justify-between items-center bg-bone-50">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-sage-700 rounded-lg flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-serif text-ink-900">Privaro</span>
        </Link>
        <div className="flex gap-4 items-center">
          {session ? (
            <Link href="/" className="text-[13px] font-medium text-sage-600 hover:text-sage-700">Go to Dashboard</Link>
          ) : (
            <Link href="/login" className="text-[13px] font-medium text-ink-600 hover:text-ink-900">Sign In</Link>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-6 text-ink-900">
            Simple, transparent pricing.
          </h1>
          <p className="text-[16px] text-ink-600 max-w-2xl mx-auto mb-10">
            Replace spreadsheets with a dynamic compliance operating system. Get started for free, upgrade when you need to automate.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-[14px] font-medium ${!isAnnual ? 'text-ink-900' : 'text-ink-500'}`}>Monthly</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 bg-sage-700 rounded-full transition-colors focus:outline-none"
            >
              <motion.div 
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                animate={{ left: isAnnual ? "30px" : "4px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-[14px] font-medium flex items-center gap-2 ${isAnnual ? 'text-ink-900' : 'text-ink-500'}`}>
              Annually <span className="text-[10px] font-bold uppercase tracking-wider text-sage-700 bg-sage-100 px-2 py-0.5 rounded-full">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-24 items-start">
          {tiers.map((tier) => (
            <div key={tier.name} className={`relative bg-white rounded-3xl p-8 border transition-all ${tier.isPopular ? 'border-sage-500 shadow-xl scale-105 z-10' : 'border-ink-900/10 shadow-sm mt-4'}`}>
              {tier.isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sage-500 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                  Most Popular
                </div>
              )}
              
              <h3 className="text-2xl font-serif text-ink-900 mb-2">{tier.name}</h3>
              <p className="text-[13px] text-ink-500 mb-6 min-h-[40px]">{tier.description}</p>
              
              <div className="mb-8">
                <span className="text-4xl font-bold text-ink-900">€{isAnnual ? tier.price.annual : tier.price.monthly}</span>
                <span className="text-ink-500 text-[14px]">/mo</span>
                {isAnnual && (
                  <div className="text-[12px] text-sage-600 font-medium mt-1">
                    Billed €{tier.price.annual * 12} yearly
                  </div>
                )}
              </div>

              <button 
                onClick={() => handleUpgrade(tier.tierId as any)}
                disabled={isInitializing}
                className={`w-full py-3.5 px-4 rounded-xl text-[14px] font-medium transition-all mb-8 flex items-center justify-center gap-2 shadow-card disabled:opacity-50
                  ${tier.isPopular ? 'bg-sage-700 text-white hover:bg-sage-600' : 'bg-bone-100 text-ink-900 hover:bg-bone-200'}`}
              >
                {isInitializing ? <Loader2 className="w-5 h-5 animate-spin" /> : (tier.tierId === 'professional' ? 'Start 14-day Free Trial' : 'Upgrade')}
              </button>

              <ul className="space-y-4">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-sage-500 shrink-0" />
                    <span className="text-[14px] text-ink-700 leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl font-serif text-center mb-10">Frequently Asked Questions</h3>
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-ink-900 mb-2">Do I need GDPR compliance?</h4>
              <p className="text-[14px] text-ink-600">Yes, if your agency processes the personal data of EU citizens, regardless of where your agency is located.</p>
            </div>
            <div>
              <h4 className="font-semibold text-ink-900 mb-2">Can I switch plans anytime?</h4>
              <p className="text-[14px] text-ink-600">Yes. Upgrades are prorated immediately. Downgrades take effect at the end of your current billing cycle.</p>
            </div>
            <div>
              <h4 className="font-semibold text-ink-900 mb-2">Is my data hosted in the EU?</h4>
              <p className="text-[14px] text-ink-600">Yes. All Privaro infrastructure and databases are hosted in AWS eu-west-1 (Dublin, Ireland).</p>
            </div>
            <div>
              <h4 className="font-semibold text-ink-900 mb-2">Do you provide VAT invoices?</h4>
              <p className="text-[14px] text-ink-600">Yes. You can enter your VAT number during checkout. We use Stripe Tax to automatically handle EU reverse-charge rules and issue compliant B2B invoices.</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
