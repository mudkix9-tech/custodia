import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ShieldCheck, Server, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { buildMarketingMetadata } from '../../../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  return buildMarketingMetadata({ locale, path: `/gdpr/vendors/${slug}` });
}

export default async function VendorGDPRPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const vendorSlug = resolvedParams.slug;
  const vendorName = vendorSlug.charAt(0).toUpperCase() + vendorSlug.slice(1).replace(/-/g, ' ');

  // Mock data for the template
  const vendorData = {
    name: vendorName,
    hq: "United States",
    category: "Marketing / Analytics",
    dpaAvailable: true,
    euHostingAvailable: true,
    transferMechanism: "Standard Contractual Clauses (SCCs) + Data Privacy Framework",
    subProcessorsCount: 12,
    status: "Compliant with Configuration",
  };

  return (
    <div className="pt-24 pb-32">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <Link href="/blog" className="text-ink-500 hover:text-ink-900 text-sm mb-6 inline-block transition-colors">
          ← Back to GDPR Knowledge Hub
        </Link>
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
           <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-serif text-ink-900 mb-4 tracking-tight">
                Is {vendorData.name} GDPR Compliant? <br/>What You Need to Know
              </h1>
              <p className="text-xl text-ink-500">
                A complete breakdown of {vendorData.name}'s privacy posture, sub-processors, and what your agency needs to do to use them legally.
              </p>
           </div>
           <div className="bg-white p-6 rounded-2xl hairline shadow-sm text-center min-w-[250px]">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-widest mb-2">Overall Status</div>
              {vendorData.status.includes('Compliant') ? (
                 <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="w-10 h-10 text-sage-600"/>
                    <span className="font-bold text-sage-700">{vendorData.status}</span>
                 </div>
              ) : (
                 <div className="flex flex-col items-center gap-2">
                    <AlertTriangle className="w-10 h-10 text-amber-500"/>
                    <span className="font-bold text-amber-600">{vendorData.status}</span>
                 </div>
              )}
           </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

           {/* Left Column: Details */}
           <div className="lg:col-span-2 space-y-12">

              {/* Overview */}
              <div>
                 <h2 className="text-2xl font-bold text-ink-900 mb-6 border-b border-ink-900/10 pb-4">Vendor Overview</h2>
                 <div className="grid grid-cols-2 gap-6 bg-bone-50 p-6 rounded-2xl">
                    <div>
                       <div className="text-sm text-ink-500 mb-1">Headquarters</div>
                       <div className="font-medium text-ink-900">{vendorData.hq}</div>
                    </div>
                    <div>
                       <div className="text-sm text-ink-500 mb-1">Category</div>
                       <div className="font-medium text-ink-900">{vendorData.category}</div>
                    </div>
                    <div>
                       <div className="text-sm text-ink-500 mb-1">Transfer Mechanism</div>
                       <div className="font-medium text-ink-900">{vendorData.transferMechanism}</div>
                    </div>
                    <div>
                       <div className="text-sm text-ink-500 mb-1">Sub-processors</div>
                       <div className="font-medium text-ink-900">{vendorData.subProcessorsCount} known sub-processors</div>
                    </div>
                 </div>
              </div>

              {/* Compliance Status */}
              <div>
                 <h2 className="text-2xl font-bold text-ink-900 mb-6 border-b border-ink-900/10 pb-4">GDPR Compliance Status</h2>
                 <ul className="space-y-4">
                    <li className="flex items-start gap-4">
                       {vendorData.dpaAvailable ? <CheckCircle2 className="w-6 h-6 text-sage-600 shrink-0"/> : <XCircle className="w-6 h-6 text-clay-500 shrink-0"/>}
                       <div>
                          <div className="font-bold text-ink-900">Data Processing Agreement (DPA) Available</div>
                          <div className="text-ink-500 text-sm">{vendorData.name} provides a standard DPA that you must sign or accept in their settings before processing personal data.</div>
                       </div>
                    </li>
                    <li className="flex items-start gap-4">
                       {vendorData.euHostingAvailable ? <CheckCircle2 className="w-6 h-6 text-sage-600 shrink-0"/> : <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0"/>}
                       <div>
                          <div className="font-bold text-ink-900">EU Hosting Available</div>
                          <div className="text-ink-500 text-sm">You can select an EU data center (e.g., Frankfurt or Dublin) during setup to keep data within the EEA.</div>
                       </div>
                    </li>
                 </ul>
              </div>

              {/* Action Items */}
              <div className="bg-sage-50 border border-sage-500/20 p-8 rounded-3xl">
                 <h2 className="text-2xl font-bold text-ink-900 mb-4">What you need to do</h2>
                 <p className="text-ink-600 mb-6">To use {vendorData.name} compliantly as an agency, you must:</p>
                 <ol className="list-decimal list-inside space-y-3 text-ink-700">
                    <li>Sign their Data Processing Agreement (DPA).</li>
                    <li>Configure EU hosting in your account settings (if applicable).</li>
                    <li>Update your Record of Processing Activities (ROPA).</li>
                    <li>List them in your Privacy Policy as a sub-processor.</li>
                 </ol>
              </div>

           </div>

           {/* Right Column: CTA */}
           <div className="lg:col-span-1">
              <div className="bg-ink-900 text-bone-50 p-8 rounded-3xl sticky top-32">
                 <Server className="w-10 h-10 text-sage-500 mb-6"/>
                 <h3 className="text-2xl font-bold mb-4">Track {vendorData.name}'s compliance automatically.</h3>
                 <p className="text-ink-300 mb-8 text-sm leading-relaxed">
                    Stop manually checking for vendor updates. Custodia tracks {vendorData.name} and 1,000+ other tools, alerting you if their DPA or hosting changes.
                 </p>
                 <Link href="/assessment" className="flex bg-sage-600 hover:bg-sage-500 text-bone-50 text-sm font-semibold py-3 px-6 rounded-xl transition-all items-center justify-center gap-2 w-full shadow-card">
                    Start free assessment <ArrowRight className="w-4 h-4"/>
                 </Link>
              </div>
           </div>

        </div>
      </section>
    </div>
  );
}

// Generate static params for the 50 specified vendors
export async function generateStaticParams() {
  const vendors = [
    'hubspot', 'mailchimp', 'google-analytics', 'facebook-pixel', 'hotjar',
    'slack', 'aws', 'vercel', 'stripe', 'mixpanel', 'segment', 'salesforce',
    'zendesk', 'intercom', 'figma', 'notion', 'linear', 'github', 'zoom', 'teams'
    // Placeholder for 30 more to reach 50 as requested
  ];

  return vendors.map((vendor) => ({
    slug: vendor,
  }));
}
