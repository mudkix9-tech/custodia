"use client";

import React from 'react';
import { Link } from '@/i18n/routing';
import { GdprGuideLayout } from '@/components/marketing/GdprGuideLayout';

export default function DataBreachResponsePage() {
  return (
    <GdprGuideLayout
      title="What Qualifies as a Personal Data Breach Under the GDPR"
      category="Breach Response"
      date="August 2, 2026"
    >
      <p className="lead text-lg text-text-muted mb-8">
        When you think of a data breach, you probably picture hackers bypassing firewalls to steal credit card numbers. But under the General Data Protection Regulation (GDPR), the vast majority of breaches are mundane, everyday operational mistakes. Failing to understand how the GDPR legally defines a breach leaves your agency completely exposed when an inevitable human error occurs.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">1. The GDPR Definition: Accidents Count</h2>
      <p className="mb-4">
        To understand what qualifies as a personal data breach, you have to look past traditional cybersecurity threats and focus on the strict text of the law. Article 4(12) of the GDPR defines a breach as any incident leading to the "accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data".
      </p>
      <p className="mb-4">
        The most important word in that definition is <em>accidental</em>. Under the GDPR, malicious intent is completely irrelevant. If a well-intentioned administrative mistake exposes, alters, or deletes client data, it carries the exact same legal weight as a targeted cyberattack.
      </p>
      <p className="mb-8">
        Furthermore, the rule applies to any personal data that is "transmitted, stored or otherwise processed". This means data does not need to be actively sitting on your main server to be breached. The definition applies equally to data moving across local networks, files synced to an employee's remote laptop, documents in cloud storage platforms, or even physical paper files. If an unauthorized deviation from your planned processing occurs, you have a breach.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">2. Real-World Examples You Probably Wouldn't Call a Breach</h2>
      <p className="mb-4">
        To bridge the gap between legal definitions and daily operations, let's look at concrete scenarios. The following six administrative mistakes are frequently dismissed by agencies as minor friction. Legally, each satisfies the statutory definition of a personal data breach:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-3 text-text-primary">
        <li><strong>Wrong-recipient email:</strong> You email a client's customer list to the wrong person. Even if the accidental recipient is a trusted vendor who immediately confirms they deleted the file, the unauthorized disclosure has already occurred, triggering a confidentiality breach under the law.</li>
        <li><strong>Lost corporate laptop:</strong> An employee leaves an unencrypted work laptop at a coffee shop. Because the device lacks full-disk encryption, any locally synced client files or cached credentials are automatically considered compromised, representing both a confidentiality and availability breach.</li>
        <li><strong>Accidental CRM deletion:</strong> A database administrator accidentally deletes historical lead records, and you don't have a backup. This is a textbook availability breach because you have failed to maintain the ongoing availability of your processing services, regardless of the fact that no hacker was involved.</li>
        <li><strong>Unauthorized database access:</strong> An employee snoops through a client's database they aren't authorized to view. Internal unauthorized access carries the exact same legal weight as an external breach; an employee viewing personal data without a legitimate business need is a direct breach of confidentiality.</li>
        <li><strong>CC instead of BCC:</strong> You send a bulk marketing email and paste the recipient list into the CC field, exposing everyone's email address. By revealing the identities of the recipients to each other, you have actively disclosed personal data without authorization, which frequently triggers mandatory individual notification if the context of the email is sensitive.</li>
        <li><strong>Misconfigured Google Drive link:</strong> You set a client folder containing lead profiles to "Anyone with the link can view". Removing authorization controls legally constitutes an unauthorized disclosure to the public internet, even if you have no forensic proof that anyone actually clicked the link or downloaded the files.</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">3. The Three Types of Breaches</h2>
      <p className="mb-4">
        The European Data Protection Board (EDPB) breaks personal data breaches into three specific categories. While corporate awareness is almost entirely focused on the first, the GDPR treats all three types of compromise equally:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-3 text-text-primary">
        <li><strong>Confidentiality:</strong> This is an unauthorized disclosure of, or access to, personal data. The wrong-recipient email and the misconfigured Drive link are classic confidentiality breaches.</li>
        <li><strong>Integrity:</strong> This involves the unauthorized or accidental alteration of personal data. If a synchronization error between two of your marketing tools corrupts a client's customer profiles, the factual accuracy of the data is modified, resulting in an integrity breach.</li>
        <li><strong>Availability:</strong> This is where many operators stumble. An availability breach is the accidental or unauthorized loss of access to, or destruction of, personal data. If you accidentally delete a database without an offline backup, or if ransomware locks your operational files, you have suffered an availability breach. It does not matter if nobody else actually saw the data—the loss of access itself is a breach of security.</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">4. When to Report: Assessing the Risk</h2>
      <p className="mb-4">
        You do not have to report every single breach to your data protection authority. The GDPR establishes a risk-based framework. You are only required to report an incident if it is "likely to result in a risk to the rights and freedoms of natural persons".
      </p>
      <p className="mb-4">
        To figure that out, you must conduct a structured risk assessment immediately upon discovering the incident. A highly practical framework for this is the ENISA severity methodology, which evaluates three primary factors:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-3 text-text-primary">
        <li><strong>Data Sensitivity:</strong> How sensitive is the data involved? Exposing standard business contact details generally represents a lower risk. Exposing special categories of data (like health information, political opinions, or biometric data), financial details, or passwords carries a significantly higher risk profile.</li>
        <li><strong>Ease of Identification:</strong> How easily can the people be identified from the exposed data? If the breached file was heavily encrypted or pseudonymized, the risk drops because it is difficult for an unauthorized recipient to link the data back to specific individuals.</li>
        <li><strong>Circumstances of the Breach:</strong> What is the operational context? Sending an email to a trusted, known vendor who confirms they deleted it carries a vastly different risk profile than leaving an unencrypted database exposed to the public internet.</li>
      </ul>
      <p className="mb-8">
        If your risk assessment concludes that the risk is "high," your obligations increase. You must notify your data protection authority, but you must <em>also</em> communicate the breach directly to the affected individuals without undue delay. This communication has to be written in clear, plain language, telling them exactly what happened and outlining the steps they should take to protect themselves. (For a deeper dive into managing individual communications and data subject rights, review our guide on <Link href="/gdpr/dsar-controller-processor" className="text-accent-gold hover:underline">how to handle a DSAR when you're both controller and processor</Link>).
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">5. The 72-Hour Timeline: The Clock Starts at "Awareness"</h2>
      <p className="mb-4">
        If your assessment shows a breach is reportable, Article 33 requires you to notify your data protection authority without undue delay and, where feasible, no later than 72 hours after having become aware of it. 
      </p>
      <p className="mb-4">
        The regulatory clock begins the exact moment your organization "becomes aware" of the breach. The EDPB clarifies that awareness means having a reasonable degree of certainty that a security incident has compromised personal data. Crucially, awareness is not limited to your IT security team or the C-suite. If a junior account manager realizes they CC'd the wrong marketing list, the 72-hour clock starts instantly. You cannot delay the timer by claiming you are waiting for a formal forensic investigation to finish.
      </p>
      <p className="mb-4">
        Your notification must include several specific elements:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>The Nature of the Breach:</strong> What happened, including the categories of data, the approximate number of records, and the number of people affected.</li>
        <li><strong>The Contact Points:</strong> The name and contact details of your Data Protection Officer (DPO) or primary contact.</li>
        <li><strong>The Likely Consequences:</strong> Your assessment of the potential adverse effects on the individuals involved.</li>
        <li><strong>The Remedial Measures:</strong> The steps you have taken, or plan to take, to fix the vulnerability and mitigate the negative impacts.</li>
      </ul>
      <p className="mb-8">
        If you cannot gather all of this information within 72 hours, the GDPR explicitly permits you to provide the information in phases. Submit an initial report within the 72-hour window with what you know, and update the authority as your investigation uncovers more details. 
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">6. Controller vs. Processor: Who Owns the Clock?</h2>
      <p className="mb-4">
        For B2B agencies, how you handle a breach depends entirely on whether you are acting as a data controller or a data processor for the specific dataset that was compromised.
      </p>
      <p className="mb-4">
        If your agency is acting as a data processor—for example, executing an email marketing campaign using a customer list provided directly by your client—your obligation is to notify the data controller (your client) without undue delay. As a processor, you do not notify the data protection authority or the affected individuals. 
      </p>
      <p className="mb-8">
        In practice, standard B2B Data Processing Agreements (DPAs) usually require the processor to notify the controller within a strict 24 to 48 hours. This compressed timeframe is necessary because the controller definitively owns the 72-hour regulatory clock. Their 72-hour window only begins when you officially notify them of the incident. To effectively map out these multi-party contract structures and understand your exact obligations, refer to our <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">ultimate GDPR compliance guide for agencies</Link>.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">7. Document ALL Breaches</h2>
      <p className="mb-4">
        One of the biggest compliance vulnerabilities for an agency is assuming that if a security incident is deemed low-risk and doesn't meet the reporting threshold, it can be quietly fixed and forgotten. This approach directly violates Article 33(5) of the GDPR, which requires you to document every single personal data breach internally.
      </p>
      <p className="mb-4">
        You must maintain an internal breach register for all incidents, irrespective of their risk profile. This register must clearly record:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>The Facts:</strong> What happened, when it occurred, and how it was discovered.</li>
        <li><strong>The Effects:</strong> The scope of the impact, including the volume and categories of data.</li>
        <li><strong>The Remedial Actions:</strong> The immediate containment steps you took and the long-term changes you implemented to prevent recurrence.</li>
      </ul>
      <p className="mb-8">
        Regulators routinely ask to inspect this internal register during audits to verify that you are actually tracking incidents and that your internal decisions <em>not</em> to report certain breaches were justified. To seamlessly manage this process, Custodia's breach management module structures your incident logging, risk assessments, and 72-hour timelines to keep you organized and audit-ready.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">8. The Digital Omnibus Reform</h2>
      <p className="mb-4">
        Looking ahead, agencies should monitor the proposed Digital Omnibus Reform. Right now, the GDPR utilizes two different thresholds: you must notify regulators if there is a "risk," but you only notify individuals if there is a "high risk". 
      </p>
      <p className="mb-4">
        This dual threshold has led to a flood of minor incident reports being sent to regulators, bogging down the system. The Digital Omnibus proposal seeks to align these standards by raising the regulatory reporting threshold to "high risk". 
      </p>
      <p className="mb-8">
        If passed, organizations would apply a single "high risk" standard across both obligations. However, this reform does not eliminate the duty to maintain accountability. The Article 33(5) obligation to document all breaches internally will remain entirely intact. A structured, rigorously maintained incident response process matters regardless of whether the reform passes, as regulators will continue to oversee your compliance through your internal documentation.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Conclusion</h2>
      <p>
        Breaches under the GDPR are not limited to external cyberattacks; they are overwhelmingly caused by everyday operational mistakes. Real security requires shifting from a purely technical cybersecurity mindset to a culture of operational compliance and response readiness. Take our <Link href="/assessment" className="text-accent-gold hover:underline">free gap assessment</Link> to identify and close your operational vulnerabilities today.
      </p>
    </GdprGuideLayout>
  );
}
