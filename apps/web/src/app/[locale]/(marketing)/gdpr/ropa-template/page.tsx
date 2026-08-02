"use client";

import React from 'react';
import Link from 'next/link';
import { GdprGuideLayout } from '@/components/layout/GdprGuideLayout';

export default function RopaTemplatePage() {
  return (
    <GdprGuideLayout
      title="What is a ROPA? A Practical Template for Marketing Teams"
      category="Compliance Strategy"
      date="August 2, 2026"
    >
      <p className="lead text-lg text-text-muted mb-8">
        If you have ever stared at a blank spreadsheet titled "GDPR Compliance" and wondered what exactly you are supposed to put in it, you are not alone. 
      </p>
      <p className="mb-4">
        For most marketing teams and agency operators, the term ROPA (Record of Processing Activities) sounds like a dense regulatory artifact meant for enterprise lawyers. In reality, it is much simpler. A ROPA is essentially a master inventory of your data: what personal data you touch, why you have it, and where it goes.
      </p>
      <p className="mb-8">
        Under Article 30 of the GDPR, maintaining this record is a strict legal obligation. It is not a privacy policy you paste on your website, it is not a DPA you sign with a vendor, and it is not a cookie banner. It is a structured internal ledger. If a regulator audits your agency, or if an enterprise client sends you a security questionnaire, your ROPA is the very first thing they will ask to see.
      </p>

      <hr className="border-white/10 my-10" />

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The "Under 250 Employees" Myth</h2>
      <p className="mb-4">
        There is a pervasive myth in the agency world that small businesses are exempt from Article 30. Many operators read the first line of the exemption—which states that organizations with fewer than 250 employees don't need a ROPA—and they stop reading.
      </p>
      <p className="mb-4">
        Unfortunately, Article 30(5) has a major caveat. The exemption is immediately voided if your data processing is <strong>not occasional</strong>. 
      </p>
      <p className="mb-8">
        Think about what your agency does every day. Do you run CRM lists? Do you manage email marketing campaigns? Do you use Google Analytics or ad targeting pixels? None of these activities are "occasional." They are systematic, daily operations. Therefore, the employee count exemption does not apply to you. Marketing teams and digital agencies must maintain a ROPA, period.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Controller vs. Processor ROPAs: You Need Both</h2>
      <p className="mb-4">
        Most agencies actually need to maintain two distinct ROPAs, because you operate in two different legal capacities. 
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>Controller ROPA:</strong> This maps the data where you make the decisions. It covers your own employees, your agency's CRM, your newsletter subscribers, and your prospect lists. </li>
        <li><strong>Processor ROPA:</strong> This maps the data you handle on behalf of your clients. It covers every client engagement where you touch their data (e.g., managing their HubSpot, running their Shopify email lists).</li>
      </ul>
      <p className="mb-8">
        According to the GDPR, a Controller ROPA requires slightly more detailed fields (like the Lawful Basis for processing) than a Processor ROPA. Understanding this distinction is critical—we cover this dynamic extensively in our <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">GDPR compliance guide for agencies</Link>. Most agencies have zero of either.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Building Your ROPA: A Practical Example</h2>
      <p className="mb-4">
        Let's demystify what this actually looks like. A ROPA is essentially a matrix. Let's walk through building a single row in a Processor ROPA for a very common agency activity: <strong>Running email campaigns via Mailchimp for Client X.</strong>
      </p>
      <p className="mb-6">
        Here are the exact fields a regulator expects to see, mapped to our practical example:
      </p>

      <div className="bg-surface-panel-top border border-white/10 rounded-xl overflow-hidden mb-8">
        <div className="border-b border-white/10 bg-white/5 px-6 py-4">
          <h3 className="font-mono text-sm tracking-wide text-text-heading">ROPA ENTRY: CLIENT EMAIL MARKETING</h3>
        </div>
        <div className="p-6">
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Name of the Processing Activity</dt>
              <dd className="text-text-primary text-[15px]">Executing monthly promotional email campaigns for Client X.</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Controller Information</dt>
              <dd className="text-text-primary text-[15px]">Client X (You are the Processor, acting on their written instructions).</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Categories of Data Subjects</dt>
              <dd className="text-text-primary text-[15px]">Client X's active customers and newsletter subscribers.</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Categories of Personal Data</dt>
              <dd className="text-text-primary text-[15px]">Names, email addresses, IP addresses, and email engagement metrics (open rates).</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Categories of Recipients (Sub-processors)</dt>
              <dd className="text-text-primary text-[15px]">Mailchimp (Intuit), AWS (hosting data on Mailchimp's behalf).</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Cross-Border Transfers</dt>
              <dd className="text-text-primary text-[15px]">Yes, data is transferred to the US. Safeguards: EU-US Data Privacy Framework (Intuit/Mailchimp is DPF-certified) with Standard Contractual Clauses (SCCs) as fallback per the Mailchimp DPA.</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Retention Period</dt>
              <dd className="text-text-primary text-[15px]">Data is deleted or returned to Client X within 30 days of contract termination.</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Technical & Organizational Measures (TOMs)</dt>
              <dd className="text-text-primary text-[15px]">Data encrypted in transit (TLS) and at rest. Access restricted via SSO and mandatory 2FA for agency staff.</dd>
            </div>
          </dl>
        </div>
      </div>
      <p className="mb-8">
        That is it. If you build out rows like that for every tool and process your agency uses, you have a fully compliant ROPA.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Common Mistakes Agencies Make</h2>
      <p className="mb-4">
        When agencies attempt to build this in a spreadsheet, they usually run into a few common pitfalls:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>Being too vague:</strong> Listing your processing purpose simply as "marketing" will fail an audit. You must be specific (e.g., "B2B lead generation via LinkedIn Ads").</li>
        <li><strong>Ignoring internal data:</strong> Your ROPA isn't just about clients. You must document how you process your own employees' payroll data, HR records, and candidate resumes.</li>
        <li><strong>Missing cross-border transfers:</strong> Many US-based SaaS tools process EU data in American data centers. You must log these transfers and note the legal mechanism (like the Data Privacy Framework or SCCs) that makes them legal.</li>
        <li><strong>Treating it as a one-time project:</strong> A ROPA is not a "set it and forget it" task. A ROPA that was last updated 18 months ago is almost as legally useless as not having one at all.</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">How to Actually Maintain It</h2>
      <p className="mb-4">
        The biggest challenge isn't building the ROPA; it's keeping it accurate. To prevent your ROPA from rotting in a Google Drive folder, you must tie updates to operational trigger events.
      </p>
      <p className="mb-4">
        Make it a strict policy to update your ROPA whenever one of these four things happens:
      </p>
      <ol className="list-decimal pl-6 mb-6 space-y-2 text-text-primary">
        <li>You onboard a new client (new Processor entry).</li>
        <li>You add a new SaaS tool to your tech stack (new sub-processor/recipient).</li>
        <li>You start collecting a new category of data (e.g., you add phone numbers to a form).</li>
        <li>An employee is hired or leaves (affecting who has access to the data).</li>
      </ol>
      <p className="mb-8">
        If manually managing a spreadsheet sounds like a nightmare, this is exactly what Custodia's Activity Register module solves. It completely replaces the spreadsheet ROPA by syncing directly with your vendor stack, auto-populating sub-processor fields, and ensuring your records stay current without manual data entry.
      </p>
      <p>
        If you don't know whether your current ROPA (or lack of one) passes an audit, you can find out in 12 minutes by taking our <Link href="/assessment" className="text-accent-gold hover:underline">free GDPR gap assessment</Link>.
      </p>
    </GdprGuideLayout>
  );
}
