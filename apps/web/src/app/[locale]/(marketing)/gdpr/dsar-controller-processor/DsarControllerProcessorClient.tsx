"use client";

import React from 'react';
import Link from 'next/link';
import { GdprGuideLayout } from '@/components/marketing/GdprGuideLayout';

export default function DsarControllerProcessorPage() {
  return (
    <GdprGuideLayout
      title="How to Handle a DSAR When You're Both Controller and Processor"
      category="Rights & Obligations"
      date="August 2, 2026"
      ctaHeading="Is your agency prepared for a DSAR?"
      ctaBody="Custodia's DSAR automation module centralizes intake, tracks deadlines, and generates response packages automatically. If you don't have a DSAR process documented, find out in 12 minutes whether that's one of your gaps."
    >
      <p className="lead text-lg text-text-muted mb-8">
        An email lands in your agency's shared inbox: <em>"I am writing to formally request a copy of all personal data you hold on me under Article 15 of the GDPR, as well as the immediate deletion of this data under Article 17."</em> 
      </p>

      <p className="mb-4">
        If you are like most agency operators or marketing managers, your first reaction is panic. Your second is confusion. Do you handle this yourself? Do you forward it to your client? Do you delete the data, or are you legally required to keep it?
      </p>

      <p className="mb-8">
        The answer depends entirely on whose data it is and in what capacity your agency holds it. When you operate as both a data controller and a data processor simultaneously, a Data Subject Access Request (DSAR) becomes a jurisdictional puzzle. Let's break down exactly how to solve it.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">What a DSAR Actually Is (in 30 Seconds)</h2>
      
      <p className="mb-8">
        Under Articles 15 through 22 of the GDPR, individuals have specific fundamental rights over their personal data. They have the right to access it, rectify (correct) it, erase it, restrict its processing, port it to another service, and object to its use. A DSAR is simply the mechanism by which an individual exercises those rights. It doesn't have to follow a specific legal format; an email saying "what data do you have on me?" is a valid DSAR and starts the legal clock ticking.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Dual-Role Problem</h2>

      <p className="mb-4">
        Agencies operate in a unique environment. You are <strong>controllers</strong> of your own data (your employees, your sales prospects, your newsletter subscribers). But you are also <strong>processors</strong> of your clients' data (managing a client's HubSpot instance, running their email campaigns, handling their customer lists).
      </p>

      <p className="mb-8">
        When a DSAR arrives, the very first question you must ask is never "how do I respond?" Instead, it must be: <strong>"Which hat am I wearing for this specific data?"</strong> (For a deeper dive into this distinction, see our <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">GDPR compliance guide for agencies</Link>).
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Scenario A: You're the Controller</h2>

      <p className="mb-4">
        <strong>The Situation:</strong> Someone on your agency's own mailing list, a former job applicant, or an ex-employee submits a DSAR.
      </p>

      <p className="mb-4">
        <strong>Your Action:</strong> This is fully your responsibility. You are the controller, and the buck stops with you. You have exactly <strong>one calendar month</strong> from the date of receipt to respond to the request. 
      </p>

      <p className="mb-4">
        Here is what your response actually requires:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>Verify identity:</strong> Before handing over personal data, ensure the person asking is who they claim to be. (Handing data to an impersonator is a data breach).</li>
        <li><strong>Search all systems:</strong> You must locate where their data exists across your entire infrastructure. This includes your CRM, email inboxes, Slack channels, Google Drive folders, and analytics platforms. (This is why having an accurate <Link href="/gdpr/ropa-template" className="text-accent-gold hover:underline">ROPA</Link> is non-negotiable—you can't search if you don't know where to look).</li>
        <li><strong>Compile and deliver:</strong> Export the data and deliver it securely in a commonly used electronic format.</li>
      </ul>

      <p className="mb-8">
        <strong>A note on erasure:</strong> If their DSAR includes a request for deletion (the "right to be forgotten"), you must comply and purge their data from your systems <em>unless</em> you have a supervening legal obligation to retain it (e.g., keeping financial transaction records for tax authorities).
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Scenario B: You're the Processor</h2>

      <p className="mb-4">
        <strong>The Situation:</strong> Someone contacts your agency directly about data you hold purely on behalf of a client. For example, a customer replies to an email campaign you manage for Client X via Mailchimp, demanding to know what data you have on them.
      </p>

      <p className="mb-4">
        <strong>Your Action:</strong> Stop. Do not fulfill this request yourself. Do not delete their data. Do not export their profile. As a processor, you do not have the legal authority to make decisions about this data.
      </p>

      <p className="mb-8">
        Your legal obligation is to notify your client (the controller) <strong>without undue delay</strong> so that they can handle the response. Your Data Processing Agreement (DPA) with the client should specify exactly how quickly you must notify them (often 24 to 48 hours) and what assistance you must provide in gathering the data. If your standard DPA does not explicitly cover DSAR handling procedures, that is a massive compliance gap you need to fix immediately.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Scenario C: The Messy One (Both Hats at Once)</h2>

      <p className="mb-4">
        <strong>The Situation:</strong> The same person exists in both your controller data and your processor data. Imagine a scenario where a marketing director at a target company is on your agency's prospecting newsletter (Controller data), but they are also a registered user in a SaaS platform you are currently marketing for one of your clients (Processor data).
      </p>

      <p className="mb-4">
        <strong>Your Action:</strong> You now have two parallel, distinct legal obligations.
      </p>

      <ol className="list-decimal pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>Wear the Controller Hat:</strong> You must independently fulfill the DSAR for the data your agency controls (the prospecting newsletter data). Search your CRM, compile the data, and deliver it (or delete it, if requested) within one month.</li>
        <li><strong>Wear the Processor Hat:</strong> You must immediately notify your client that a DSAR was received concerning a user in their database. You then assist the client in fulfilling <em>their</em> DSAR process according to your DPA.</li>
      </ol>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Operational Playbook</h2>

      <p className="mb-4">
        You cannot wait until a DSAR arrives to figure out this workflow. The one-month deadline is unforgiving. Every agency should have the following operational playbook documented and ready:
      </p>

      <ul className="list-disc pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>A dedicated intake channel:</strong> Establish a `privacy@youragency.com` alias so requests don't get lost in support queues or personal inboxes.</li>
        <li><strong>An identity verification template:</strong> A standard reply asking for reasonable proof of identity before proceeding.</li>
        <li><strong>A documented search procedure:</strong> A checklist of exactly which SaaS tools, shared drives, and communication platforms must be queried.</li>
        <li><strong>Response templates:</strong> Pre-written emails for acknowledging the request, delivering the data, confirming deletion, or explaining why deletion isn't legally possible.</li>
        <li><strong>An escalation path for processor DSARs:</strong> Clear instructions for your team on how to instantly route a request to the correct client contact.</li>
        <li><strong>A DSAR tracking log:</strong> A secure ledger tracking the request from receipt to completion to prove your accountability to regulators.</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Common Mistakes to Avoid</h2>

      <ul className="list-disc pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>Responding to a processor DSAR without notifying the client:</strong> You just made an unauthorized decision about data you don't own.</li>
        <li><strong>Missing the one-month deadline:</strong> Usually happens because the email sat in a shared generic inbox for three weeks before someone realized what it was.</li>
        <li><strong>Failing to search all systems:</strong> You checked your CRM and exported the profile, but you forgot to search Slack, Google Drive, or your billing software. The DSAR covers <em>all</em> personal data.</li>
        <li><strong>Not verifying identity:</strong> Blindly handing over a complete dossier of personal information to an email address without verifying they are the actual data subject is a severe data breach.</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Bottom Line</h2>

      <p className="mb-8">
        When a DSAR hits your inbox, take a breath and figure out your role. If it's your data, execute your search-and-compile process. If it's your client's data, sound the alarm and pass it up the chain. Understanding the difference is what separates compliant agencies from those facing massive liability. 
      </p>
    </GdprGuideLayout>
  );
}
