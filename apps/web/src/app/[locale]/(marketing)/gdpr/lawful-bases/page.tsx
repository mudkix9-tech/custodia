"use client";

import React from 'react';
import Link from 'next/link';
import { GdprGuideLayout } from '@/components/layout/GdprGuideLayout';

export default function LawfulBasesPage() {
  return (
    <GdprGuideLayout
      title="The Six Lawful Bases Under the GDPR and How to Choose the Right One"
      category="Data Processing"
      date="August 2, 2026"
      ctaHeading="Find out your GDPR score"
      ctaBody="As part of our compliance scoring, Custodia's gap assessment automatically checks whether your processing activities have documented lawful bases."
    >
      <p className="lead text-lg text-text-muted mb-8">
        If you run an agency, a SaaS product, or any modern business in the EU, you already know you can't just collect personal data because you feel like it. You need a "legal reason" to do so. Under the General Data Protection Regulation (GDPR), that reason is called a <strong>lawful basis</strong>.
      </p>

      <p className="mb-4">
        There are six lawful bases GDPR provides. You've probably seen the list. But if you're like most founders and marketing managers, mapping those six abstract legal concepts to your actual day-to-day business activities—like sending a newsletter, processing a payment, or tracking website analytics—feels like throwing darts in the dark.
      </p>

      <p className="mb-8">
        This isn't another legal textbook recitation of Article 6 of the GDPR. You don't need legalese; you need a decision framework. In this post, we'll break down exactly what each GDPR lawful basis means in plain English, provide concrete examples for when to use them, and show you how to avoid the most common trap businesses fall into: asking for consent when they shouldn't.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Why the Lawful Basis Matters Beyond Compliance</h2>
      
      <p className="mb-4">
        Picking a lawful basis isn't just about avoiding a fine. It's the foundational block of your entire data strategy. Here is why you need to get this right:
      </p>

      <ol className="list-decimal pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>You have to pick before you start processing:</strong> You cannot collect data first and figure out your lawful basis later. The basis must be established before the data is collected.</li>
        <li><strong>You cannot easily switch:</strong> If you choose one lawful basis and it later turns out to be invalid, you can't just swap it out for another one retroactively. If you get it wrong, every piece of data you collected under that incorrect basis is potentially unlawful and might need to be deleted.</li>
        <li><strong>It dictates data subject rights:</strong> The lawful basis you choose determines which rights your users have. For example, if you rely on consent, the user has the absolute right to have their data erased (the "right to be forgotten"). If you rely on a legal obligation, they don't.</li>
        <li><strong>It lives in your documentation:</strong> Your lawful basis isn't just a mental note. It must be explicitly documented in your Privacy Policy and your Record of Processing Activities (ROPA).</li>
      </ol>

      <p className="mb-8">
        Let's dive into the six lawful bases under the GDPR and how to apply them.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Six Lawful Bases GDPR Provides</h2>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-heading">1. Consent</h3>
      
      <p className="mb-4">
        <strong>What it actually means:</strong> Consent is the gold standard for transparency, but it comes with the heaviest operational burden. For consent to be valid under the GDPR, it must be freely given, specific, informed, and unambiguous. It usually requires a clear affirmative action (like ticking an unchecked box). Crucially, the user must be able to withdraw their consent at any time, just as easily as they gave it.
      </p>
      
      <p className="mb-4"><strong>Concrete business example:</strong></p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Do use it for:</strong> Newsletter signups, non-essential marketing cookies (like Facebook Pixel or Google Analytics), or selling data to third parties.</li>
        <li><strong>Don't use it for:</strong> Processing a customer's payment or delivering the core service they just bought.</li>
      </ul>
      
      <p className="mb-8">
        <strong>The Reality Check:</strong> If a user withdrawing their consent would break your service or make it impossible for you to fulfill a contract, <strong>consent was the wrong lawful basis</strong>. Never ask for consent if you aren't prepared to take "no" for an answer or if you're going to process the data anyway.
      </p>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-heading">2. Contractual Necessity</h3>
      
      <p className="mb-4">
        <strong>What it actually means:</strong> You need to process the personal data to fulfill a contract with the data subject, or because they asked you to do something before entering into a contract (like providing a quote).
      </p>

      <p className="mb-4"><strong>Concrete business example:</strong></p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Do use it for:</strong> Processing a credit card for an e-commerce order, taking a shipping address to deliver a physical product, or holding an email address to provide access to your SaaS platform.</li>
        <li><strong>Don't use it for:</strong> You cannot stretch "contractual necessity" to cover marketing, profiling, or product analytics just because someone happens to be a paying customer.</li>
      </ul>

      <p className="mb-8">
        <strong>The Reality Check:</strong> Ask yourself: <em>Could I still deliver the core service promised in the contract without this specific piece of data?</em> If the answer is yes, you cannot use contractual necessity for that data.
      </p>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-heading">3. Legal Obligation</h3>

      <p className="mb-4">
        <strong>What it actually means:</strong> You are required by a specific law (EU or Member State law) to process the personal data. You don't have a choice in the matter.
      </p>

      <p className="mb-4"><strong>Concrete business example:</strong></p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Do use it for:</strong> Keeping employee tax records, financial reporting, complying with anti-money laundering (AML) regulations, or responding to a valid court order.</li>
        <li><strong>Don't use it for:</strong> "Industry best practices" or obligations under a contract with a third party. It must be a statutory legal requirement.</li>
      </ul>

      <p className="mb-8">
        <strong>The Reality Check:</strong> This one is straightforward but narrow. If a government auditor or inspector asked why you have this data, could you point to a specific statute? If yes, this is your basis.
      </p>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-heading">4. Legitimate Interest</h3>

      <p className="mb-4">
        <strong>What it actually means:</strong> Legitimate interest is the most flexible lawful basis, but also the most abused. It allows you to process personal data without consent, provided your business interests are not overridden by the fundamental rights and freedoms of the individual.
      </p>

      <p className="mb-4">
        To use it, you must perform a three-part balancing test called a <strong>Legitimate Interest Assessment (LIA)</strong>:
      </p>
      <ol className="list-decimal pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>Purpose test:</strong> Are you pursuing a legitimate interest? (e.g., growing your business, preventing fraud).</li>
        <li><strong>Necessity test:</strong> Is the processing necessary for that purpose? (Could you achieve the goal with less data or in a less intrusive way?)</li>
        <li><strong>Balancing test:</strong> Do the individual's interests override your legitimate interest? (Would they reasonably expect this processing, and does it cause them unjustified harm?)</li>
      </ol>

      <p className="mb-4"><strong>Concrete business example:</strong></p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Do use it for:</strong> B2B cold email outreach (where permitted by national ePrivacy laws), direct marketing to your <em>existing</em> customers about similar products, fraud prevention, and network security.</li>
        <li><strong>Don't use it for:</strong> Intrusive profiling, tracking users across the web, or anything that would genuinely surprise or creep out the data subject.</li>
      </ul>

      <p className="mb-4">
        <strong>The Reality Check:</strong> Let's look at an LIA for B2B cold email outreach:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-2 text-text-primary">
        <li><em>Interest:</em> You want to sell your agency services to other businesses.</li>
        <li><em>Necessity:</em> You need to process their professional email address to contact them.</li>
        <li><em>Balancing:</em> As a B2B professional, receiving a relevant business pitch to a corporate email address is within reasonable expectations and poses minimal risk to their fundamental rights (provided you offer an easy opt-out). <em>Note: The outcome of this balancing test can vary significantly by jurisdiction because national ePrivacy rules layer on top. For instance, Germany's UWG makes unsolicited B2B email much harder than in the UK or Netherlands, meaning an LIA alone won't automatically legalize your outreach there.</em></li>
      </ul>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-heading">5. Vital Interests</h3>

      <p className="mb-4">
        <strong>What it actually means:</strong> You need to process the personal data to protect someone's life.
      </p>

      <p className="mb-4"><strong>Concrete business example:</strong></p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Do use it for:</strong> Providing a patient's medical history to a hospital during a life-threatening emergency when they are unconscious.</li>
        <li><strong>Don't use it for:</strong> Practically anything else.</li>
      </ul>

      <p className="mb-8">
        <strong>The Reality Check:</strong> If you run an agency, a marketing firm, or a B2B SaaS, it is almost guaranteed you will never use this lawful basis. We mention it only so you know all six.
      </p>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-heading">6. Public Task</h3>

      <p className="mb-4">
        <strong>What it actually means:</strong> You are processing data to carry out a specific task in the public interest or exercising official authority vested in you.
      </p>

      <p className="mb-4"><strong>Concrete business example:</strong></p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Do use it for:</strong> Government bodies processing tax returns, public schools keeping student records, or private companies exercising delegated state authority (like a private water company).</li>
        <li><strong>Don't use it for:</strong> Standard commercial activities.</li>
      </ul>

      <p className="mb-8">
        <strong>The Reality Check:</strong> Like Vital Interests, this is generally not relevant for private, commercial businesses.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Consent Trap: When Legitimate Interest is Better</h2>

      <p className="mb-4">
        Many agencies and small businesses fall into what we call the "Consent Trap." Because consent feels like the most polite and compliant option, they try to use it for everything.
      </p>

      <p className="mb-4">
        In reality, defaulting to consent creates massive operational headaches:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li>You have to build systems to track exactly when and how consent was given.</li>
        <li>You have to build mechanisms to allow users to easily withdraw it.</li>
        <li>You have to periodically refresh it.</li>
        <li><strong>Crucially, consent is fragile.</strong> If a user withdraws their consent, you must immediately stop processing their data and often delete it. One withdrawn consent can break an entire workflow.</li>
      </ul>

      <p className="mb-4">
        If you are processing data for network security, fraud prevention, or direct B2B marketing (where local laws allow), <strong>Legitimate Interest</strong> is often the far more appropriate choice. It accurately reflects the reality of the situation: you are running a business, you have a valid reason to process the data, you've ensured it doesn't harm the user, and you aren't pretending the user has absolute veto power over your internal security logs.
      </p>

      <p className="mb-8">
        Don't ask for permission if you don't actually need it—rely on Legitimate Interest and document your LIA instead.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">How This Connects to Your ROPA</h2>

      <p className="mb-4">
        Choosing the right GDPR lawful basis isn't just a mental exercise; it's a documentation requirement.
      </p>

      <p className="mb-4">
        Under Article 30 of the GDPR, businesses must maintain a Record of Processing Activities (ROPA). Your ROPA is essentially an inventory of what data you collect, why you collect it, where it goes, and—crucially—<strong>the lawful basis for each activity</strong>.
      </p>

      <p className="mb-4">
        Every single row in your ROPA needs a documented lawful basis. If you're using Legitimate Interest, your ROPA should reference the LIA you performed. If you can't articulate which of the six lawful bases applies to a specific processing activity, that activity is non-compliant and must be stopped.
      </p>

      <p className="mb-8">
        <em>Need help setting this up? Check out our <Link href="/gdpr/ropa-template" className="text-accent-gold hover:underline">guide on what a ROPA is and how to build one</Link>.</em>
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Bottom Line</h2>

      <p className="mb-4">
        You don't need a law degree to map out your lawful bases. You just need to look critically at why you are collecting data and choose the basis that reflects reality.
      </p>

      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li>Are they buying something? Contractual Necessity.</li>
        <li>Are you legally required to have it? Legal Obligation.</li>
        <li>Do you genuinely need their explicit permission for a non-essential activity? Consent.</li>
        <li>Are you pursuing a valid business goal that doesn't harm them? Legitimate Interest.</li>
      </ul>

      <p className="mb-8">
        If you're an agency operator looking at the broader picture of your compliance posture, mapping your lawful bases is step one. (For the rest of the steps, read our full <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">GDPR compliance guide for agencies</Link>).
      </p>
    </GdprGuideLayout>
  );
}
