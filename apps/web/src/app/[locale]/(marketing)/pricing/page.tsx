"use client";

import React, { useState } from 'react';
import { Check, Info, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const PRICING = [
  { name: 'Professional', price: '99', yearly: '79', desc: 'The complete OS for growing agencies.', cta: 'Start free trial', href: '/signup', features: ['Unlimited users & processing activities', 'Unlimited vendors & DPIAs', 'Cookie consent (50 domains)', 'AI compliance advisor (2,000 queries)'], popular: true },
  { name: 'Enterprise', price: 'Custom', yearly: 'Custom', desc: 'For large organizations needing custom compliance controls.', cta: 'Contact us', href: '/contact', features: ['Everything in Professional', 'Custom data residency', 'SSO & Custom Roles', 'Dedicated Account Manager', 'REST APIs (Read & Write)'], popular: false },
];

const FAQS = [
  { q: "Do you offer a free trial for paid plans?", a: "Yes, we offer a time-limited free trial. No credit card required to start." },
  { q: "Can I upgrade or downgrade at any time?", a: "Absolutely. You can change your plan at any time. Prorated charges or credits will be applied automatically." },
  { q: "Are there any setup fees?", a: "No, there are no hidden fees or setup costs. You only pay the monthly or annual subscription price." },
  { q: "Do you have special pricing for non-profits?", a: "Yes, we offer a 50% discount for registered non-profits. Please contact our support team to apply." },
  { q: "What happens if I go over my plan limits?", a: "We'll notify you when you approach your limits. You can choose to upgrade your plan to accommodate your growth." },
  { q: "Is my data secure?", a: "Security is our top priority. All data is encrypted at rest and in transit. We are hosted on AWS in the EU and are working towards SOC 2 Type II certification." },
  { q: "Do you sign a Data Processing Agreement (DPA)?", a: "Yes, a standard DPA is included in our terms of service for all paid plans, ensuring GDPR compliance for your use of Custodia." },
  { q: "Can I export my data if I cancel?", a: "Yes, you can export all your data (ROPA, vendor lists, policies) at any time, even if you decide to cancel your subscription." }
];

export default function PricingPage() {
  const [annualBilling, setAnnualBilling] = useState(true);

  return (
    <div className="pt-24 pb-32">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-20 text-center">
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight">Simple, transparent pricing.</h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto mb-10">Start with our free assessment, then upgrade when you need to automate your compliance workflow.</p>

        <div className="inline-flex items-center bg-bone-100 border border-ink-900/5 p-1 rounded-xl mx-auto">
          <button onClick={() => setAnnualBilling(false)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${!annualBilling ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>
            Monthly
          </button>
          <button onClick={() => setAnnualBilling(true)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annualBilling ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>
            Annually <span className="text-[10px] uppercase bg-sage-100 text-sage-700 px-1.5 py-0.5 rounded-md font-bold">-20%</span>
          </button>
        </div>
        {annualBilling && <p className="text-sm text-sage-700 mt-4 font-medium">Save up to €432/year with annual billing</p>}
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6">
          {PRICING.map((plan, i) => (
            <div key={i} className={`relative bg-bone-50 rounded-2xl p-8 flex flex-col shadow-sm ${plan.popular ? 'border border-sage-500/50 ring-1 ring-sage-500/20' : 'hairline'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-8 bg-sage-600 text-bone-50 text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-full">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-ink-900 mb-2">{plan.name}</h3>
              <p className="text-ink-500 text-sm mb-6 min-h-[40px]">{plan.desc}</p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-ink-900 tracking-tight">{plan.price === 'Custom' ? '' : '€'}{annualBilling ? plan.yearly : plan.price}</span>
                {plan.price !== 'Custom' && <span className="text-ink-400 text-sm font-medium">/mo</span>}
              </div>
              <Link href={plan.href} className={`w-full py-3 rounded-xl text-sm font-semibold transition-all mb-8 flex justify-center items-center ${plan.popular ? 'bg-sage-600 text-bone-50 hover:bg-sage-500 shadow-card' : 'bg-bone-100 text-ink-900 hover:bg-bone-200'}`}>
                {plan.cta}
              </Link>
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">What&apos;s included</div>
              <ul className="space-y-4 mt-auto">
                {plan.features.map((feat, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-ink-600">
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.popular ? 'text-sage-600' : 'text-ink-300'}`} />
                    <span className="leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>


      {/* FAQs */}
      <section className="max-w-3xl mx-auto px-6 mb-32">
        <h2 className="text-3xl font-serif text-ink-900 mb-10 text-center tracking-tight">Frequently asked questions</h2>
        <div className="space-y-6">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl hairline shadow-sm">
              <h3 className="text-lg font-bold text-ink-900 mb-2 flex items-start gap-3">
                <Info className="w-5 h-5 text-ink-400 shrink-0 mt-0.5" />
                {faq.q}
              </h3>
              <p className="text-ink-500 text-sm leading-relaxed pl-8">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 text-center">
        <div className="bg-sage-50 border border-sage-500/20 p-12 rounded-3xl relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sage-100/80 to-transparent pointer-events-none"/>
           <div className="relative z-10">
              <ShieldCheck className="w-12 h-12 text-sage-600 mx-auto mb-6" />
              <h2 className="text-3xl font-serif text-ink-900 mb-4 tracking-tight">Start with a free assessment</h2>
              <p className="text-ink-600 mb-8 max-w-lg mx-auto">See where you stand in 3 minutes. Upgrade when you&apos;re ready to fix the gaps.</p>
              <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
                 Take the assessment <ArrowRight className="w-4 h-4"/>
              </Link>
           </div>
        </div>
      </section>
    </div>
  );
}
