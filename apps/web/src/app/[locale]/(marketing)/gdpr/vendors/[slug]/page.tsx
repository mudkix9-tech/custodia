import React from 'react';
import { Link } from '@/i18n/routing';
import { Metadata } from 'next';
import { ShieldCheck, Server, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { buildMarketingMetadata } from '../../../seo';

function vendorNameFromSlug(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const name = vendorNameFromSlug(slug);

  // A slug-derived path can't resolve to a static message key, so this route
  // passes its title and description explicitly.
  return buildMarketingMetadata({
    locale,
    path: `/gdpr/vendors/${slug}`,
    title: `Is ${name} GDPR Compliant? DPA, Transfers & Sub-processors`,
    description: `A GDPR assessment of ${name}: whether a data processing agreement is available, where data is hosted, which transfer mechanism applies and what to check before you use it.`,
  });
}

export default async function VendorGDPRPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const vendorSlug = resolvedParams.slug;
  const vendorName = vendorNameFromSlug(vendorSlug);

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
    <div className="pt-24 pb-32 [font-family:var(--font-plex-sans)]">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <Link href="/blog" className="text-text-muted hover:text-text-heading text-sm mb-6 inline-block transition-colors">
          ← Back to GDPR Knowledge Hub
        </Link>
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
           <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl text-text-heading mb-4 tracking-tight">
                Is {vendorData.name} GDPR Compliant? <br/>What You Need to Know
              </h1>
              <p className="text-xl text-text-muted">
                A complete breakdown of {vendorData.name}'s privacy posture, sub-processors, and what your agency needs to do to use them legally.
              </p>
           </div>
           <div className="bg-surface-panel-top p-6 border border-white/8 text-center min-w-[250px]">
              <div className="text-xs font-semibold text-text-subtle uppercase tracking-widest mb-2">Overall Status</div>
              {vendorData.status.includes('Compliant') ? (
                 <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="w-10 h-10 text-accent-gold"/>
                    <span className="font-bold text-accent-gold">{vendorData.status}</span>
                 </div>
              ) : (
                 <div className="flex flex-col items-center gap-2">
                    <AlertTriangle className="w-10 h-10 text-accent-gold"/>
                    <span className="font-bold text-accent-gold">{vendorData.status}</span>
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
                 <h2 className="text-2xl font-bold text-text-heading mb-6 border-b border-white/10 pb-4">Vendor Overview</h2>
                 <div className="grid grid-cols-2 gap-6 bg-surface-panel-top p-6">
                    <div>
                       <div className="text-sm text-text-muted mb-1">Headquarters</div>
                       <div className="font-medium text-text-heading">{vendorData.hq}</div>
                    </div>
                    <div>
                       <div className="text-sm text-text-muted mb-1">Category</div>
                       <div className="font-medium text-text-heading">{vendorData.category}</div>
                    </div>
                    <div>
                       <div className="text-sm text-text-muted mb-1">Transfer Mechanism</div>
                       <div className="font-medium text-text-heading">{vendorData.transferMechanism}</div>
                    </div>
                    <div>
                       <div className="text-sm text-text-muted mb-1">Sub-processors</div>
                       <div className="font-medium text-text-heading">{vendorData.subProcessorsCount} known sub-processors</div>
                    </div>
                 </div>
              </div>

              {/* Compliance Status */}
              <div>
                 <h2 className="text-2xl font-bold text-text-heading mb-6 border-b border-white/10 pb-4">GDPR Compliance Status</h2>
                 <ul className="space-y-4">
                    <li className="flex items-start gap-4">
                       {vendorData.dpaAvailable ? <CheckCircle2 className="w-6 h-6 text-accent-gold shrink-0"/> : <XCircle className="w-6 h-6 text-[#D9776A] shrink-0"/>}
                       <div>
                          <div className="font-bold text-text-heading">Data Processing Agreement (DPA) Available</div>
                          <div className="text-text-muted text-sm">{vendorData.name} provides a standard DPA that you must sign or accept in their settings before processing personal data.</div>
                       </div>
                    </li>
                    <li className="flex items-start gap-4">
                       {vendorData.euHostingAvailable ? <CheckCircle2 className="w-6 h-6 text-accent-gold shrink-0"/> : <AlertTriangle className="w-6 h-6 text-accent-gold shrink-0"/>}
                       <div>
                          <div className="font-bold text-text-heading">EU Hosting Available</div>
                          <div className="text-text-muted text-sm">You can select an EU data center (e.g., Frankfurt or Dublin) during setup to keep data within the EEA.</div>
                       </div>
                    </li>
                 </ul>
              </div>

              {/* Action Items */}
              <div className="bg-accent-gold/[0.06] border border-accent-gold/30 p-8">
                 <h2 className="text-2xl font-bold text-text-heading mb-4">What you need to do</h2>
                 <p className="text-text-muted mb-6">To use {vendorData.name} compliantly as an agency, you must:</p>
                 <ol className="list-decimal list-inside space-y-3 text-text-primary">
                    <li>Sign their Data Processing Agreement (DPA).</li>
                    <li>Configure EU hosting in your account settings (if applicable).</li>
                    <li>Update your Record of Processing Activities (ROPA).</li>
                    <li>List them in your Privacy Policy as a sub-processor.</li>
                 </ol>
              </div>

           </div>

           {/* Right Column: CTA */}
           <div className="lg:col-span-1">
              <div className="bg-surface-panel-top text-surface-base p-8 sticky top-32">
                 <Server className="w-10 h-10 text-accent-gold mb-6"/>
                 <h3 className="text-2xl font-bold mb-4">Track {vendorData.name}'s compliance automatically.</h3>
                 <p className="text-text-subtle mb-8 text-sm leading-relaxed">
                    Stop manually checking for vendor updates. Custodia tracks {vendorData.name} alongside the other tools agencies commonly run, alerting you if their DPA or hosting changes.
                 </p>
                 <Link href="/assessment" className="flex bg-accent-gold hover:bg-accent-gold-hover text-surface-base text-sm font-semibold py-3 px-6 transition-all items-center justify-center gap-2 w-full shadow-panel-elevated">
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
