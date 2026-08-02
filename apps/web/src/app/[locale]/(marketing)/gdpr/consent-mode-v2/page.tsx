"use client";

import React from 'react';
import Link from 'next/link';
import { GdprGuideLayout } from '@/components/layout/GdprGuideLayout';

export default function ConsentModePage() {
  return (
    <GdprGuideLayout
      title="Why Google Consent Mode v2 Matters for Your Clients"
      category="Compliance Strategy"
      date="August 2, 2026"
    >
      <p className="lead text-lg text-text-muted mb-8">
        If your agency manages Google Ads, GA4, or Meta campaigns for clients in the EU, you have undoubtedly seen the barrage of emails from Google about Consent Mode v2. 
      </p>
      <p className="mb-8">
        For many marketers, these updates felt like just another technical hoop to jump through. But misconfigured consent no longer just creates legal risk—it actively degrades your clients' ad performance and attribution data. And when ROAS plummets because conversions aren't tracking, your agency is the one they will blame. Here is what you actually need to know about Google Consent Mode v2, without the developer jargon.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">What Actually Changed with Consent Mode v2?</h2>
      <p className="mb-4">
        Historically, Consent Mode was Google's recommended way to adjust how its tags behaved based on user consent choices. As of March 2024, it is no longer optional. The Digital Markets Act (DMA) designated Google as a "gatekeeper," forcing them to obtain verifiable consent signals before processing EEA user data for ads, which is why Google then mandated Consent Mode v2 for all publishers.
      </p>
      <p className="mb-4">
        Consent Mode v2 requires your website's Consent Management Platform (CMP) to pass granular consent signals to Google tags. Specifically, it introduced two new parameters:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><code>ad_user_data</code>: Sets consent for sending user data to Google for advertising purposes.</li>
        <li><code>ad_personalization</code>: Sets consent for personalized advertising (remarketing).</li>
      </ul>
      <p className="mb-8">
        Without these signals actively passing "granted," conversion data stops flowing properly to Google Ads and GA4.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Basic vs. Advanced Implementation: The Real Tradeoff</h2>
      <p className="mb-4">
        When implementing Consent Mode v2, you have two distinct paths, and you need to explain the tradeoff honestly to your clients.
      </p>
      <p className="mb-4">
        <strong>Basic Consent Mode</strong> is the legally safest route. All Google tags are completely blocked until the user explicitly clicks "Accept." If the user ignores the banner or clicks "Reject," absolutely no data is sent to Google. It is a clean implementation, but you lose all pre-consent data, which can severely impact tracking volume.
      </p>
      <p className="mb-4">
        <strong>Advanced Consent Mode</strong> allows Google tags to load immediately in a restricted state. If the user denies consent, the tags don't read or write cookies, but they do send "cookieless pings" back to Google containing non-identifying information (like timestamp, user agent, and referrer). Google then uses conversion modeling to fill the gaps in your data.
      </p>
      <p className="mb-8">
        While Advanced Mode gives you better attribution modeling, it is more legally contentious. Certain Data Protection Authorities (DPAs), such as the French CNIL, have taken strict views on whether these "cookieless pings" still constitute reading/writing to a user's terminal equipment under the ePrivacy Directive. You must assess your clients' risk tolerance before defaulting to Advanced.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">What Breaks When You Ignore It?</h2>
      <p className="mb-4">
        If you deploy campaigns to EEA users without a properly configured Consent Mode v2 setup, the impact is immediate and visible in your dashboards:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>Conversion Tracking Gaps:</strong> Google Ads will drop unconsented conversions entirely without modeling to backfill them, making your client's Return on Ad Spend (ROAS) appear artificially terrible.</li>
        <li><strong>Audience Degradation:</strong> Your audience lists in Google Ads will stop populating with new EEA users.</li>
        <li><strong>Remarketing Failures:</strong> Without the <code>ad_personalization</code> signal, you cannot run retargeting campaigns to site visitors.</li>
        <li><strong>GA4 Blindspots:</strong> Your analytics reporting will suffer from severe data gaps, making behavioral analysis nearly impossible.</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The IAB TCF Connection</h2>
      <p className="mb-4">
        You have likely seen the acronym "IAB TCF" (Transparency and Consent Framework) thrown around alongside Consent Mode v2. The TCF is a standardized framework created by the interactive advertising bureau to communicate consent signals across the ad-tech ecosystem, not just to Google.
      </p>
      <p className="mb-8">
        If your clients run programmatic ads, or utilize Meta alongside Google, a CMP that supports both TCF signaling and Google Consent Mode v2 is now table stakes. A fragmented setup where Google gets signals but Meta doesn't is a recipe for compliance failures and attribution messes.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Enforcement Reality and Agency Liability</h2>
      <p className="mb-4">
        European DPAs are not sitting idle; they are actively using automated tools to scan websites for non-compliant cookie and tracking setups. We have seen a wave of enforcement actions across the EU specifically targeting sites that drop tracking cookies before consent is given or use deceptive "dark patterns" in their banners.
      </p>
      <p className="mb-8">
        When an agency deploys a cookie banner or a GTM container on a client site, they are taking on liability. If your implementation doesn't meet current standards, you aren't just putting your client at risk for fines—you are exposing your own agency to breach of contract claims. This is why having a holistic strategy, as we outlined in our <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">GDPR compliance guide for agencies</Link>, is critical.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">What a Properly Configured Setup Looks Like</h2>
      <p className="mb-4">
        A compliant and functional setup isn't just a banner that looks pretty. Under the hood, it requires:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>Prior Consent:</strong> Absolutely no marketing or analytics cookies fire before the user clicks "Accept" (unless you are meticulously operating under Advanced Mode).</li>
        <li><strong>Equal Prominence:</strong> The "Reject All" button must be just as visible and easy to click as the "Accept All" button.</li>
        <li><strong>Granular Controls:</strong> Users must be able to consent to analytics without consenting to advertising.</li>
        <li><strong>Signal Passthrough:</strong> The CMP must accurately map the user's choices to the corresponding Consent Mode v2 tags (<code>ad_user_data</code>, etc.).</li>
        <li><strong>Audit Trails:</strong> A secure, timestamped log proving exactly when and how a specific user gave consent.</li>
      </ul>
      <p className="mb-8">
        Custodia's Cookie Consent CMP module was built specifically for this reality—it is fully compatible with both Google Consent Mode v2 and IAB TCF out of the box, and maintains the required cryptographic audit logging automatically.
      </p>
      <p>
        If you are not sure whether your clients' current consent setups would survive a DPA scan or are actively degrading your campaign performance, you can find out in 12 minutes by taking our <Link href="/assessment" className="text-accent-gold hover:underline">free GDPR gap assessment</Link>.
      </p>
    </GdprGuideLayout>
  );
}
