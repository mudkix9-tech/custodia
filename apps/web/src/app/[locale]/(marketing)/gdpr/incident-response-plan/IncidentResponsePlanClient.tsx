"use client";

import React from 'react';
import { Link } from '@/i18n/routing';
import { GdprGuideLayout } from '@/components/marketing/GdprGuideLayout';

export default function IncidentResponsePlanPage() {
  return (
    <GdprGuideLayout
      title="Building an Incident Response Plan Before You Need One"
      category="Breach Response"
      date="August 2, 2026"
    >
      <p className="lead text-lg text-text-muted mb-8">
        Every agency operator hopes they will never have to deal with a personal data breach. But under the General Data Protection Regulation (GDPR), a breach is rarely a dramatic cyberattack orchestrated by international hackers. Far more often, it is a routine operational mistake: an account manager emails a client spreadsheet to the wrong recipient, a remote employee leaves an unencrypted laptop at a train station, or a database administrator accidentally deletes a folder without a backup. 
      </p>
      <p className="mb-4">
        If your agency handles personal data, an incident is a matter of "when," not "if." The challenge is not just preventing mistakes, but knowing exactly how to react when they happen. Without a documented incident response plan in place, an everyday administrative error can rapidly escalate into a significant regulatory failure. 
      </p>
      <p className="mb-8">
        This guide outlines how to build a lightweight, practical breach response plan on a Tuesday afternoon. It is designed for agencies of 10 to 50 employees who need a reliable operational checklist to confidently manage a crisis without needing a 40-page enterprise cybersecurity manual.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">1. Why You Need a Plan Before an Incident Happens</h2>
      <p className="mb-4">
        The primary reason you need a response plan is the GDPR’s unyielding regulatory timeline. Under Article 33, organizations must notify their competent supervisory authority of a qualifying personal data breach without undue delay and, where feasible, no later than 72 hours after becoming aware of it.
      </p>
      <p className="mb-4">
        The clock starts ticking the moment your organization "becomes aware" of the incident. Awareness does not mean waiting until a forensic IT investigation is complete; it means having a reasonable degree of certainty that personal data has been compromised. If a junior employee realizes they sent an unencrypted client list to a competitor, your 72-hour window has officially opened.
      </p>
      <p className="mb-8">
        Seventy-two hours is an incredibly short amount of time. If you do not have a plan, you will waste the first 48 hours trapped in operational panic. Your team will scramble to figure out who is in charge, which supervisory authority actually holds jurisdiction over the data, what your contractual notification windows are with your clients, and what details need to be collected. Panic and improvisation lead to delayed notifications, fragmented decision-making, and significantly worse regulatory outcomes. Building the machinery now ensures that when the clock starts, your team executes a predictable, calm workflow.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">2. Designate Your Response Roles</h2>
      <p className="mb-4">
        In a massive enterprise, incident response involves a dedicated committee of security engineers, PR executives, and legal counsel. In a 10-50 person agency, that structure is unnecessary and overly complex. You only need to designate two or three specific people to handle the entire workflow. 
      </p>
      <p className="mb-4">
        Instead of drawing up a complex organizational chart, focus on naming specific operational roles so everyone knows exactly who holds authority during an incident:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-3 text-text-primary">
        <li>
          <strong>The person who receives the report:</strong> This is the first responder. When an employee discovers a mistake, they alert this person immediately. This individual logs the exact time of discovery to start the 72-hour clock and coordinates with IT to execute immediate technical containment (like locking a compromised account or wiping a lost device). This is typically an Operations Manager or an IT Lead.
        </li>
        <li>
          <strong>The person who decides whether to notify:</strong> This person holds the ultimate authority. They review the facts, assess the risk level of the incident, decide whether the breach legally crosses the threshold for regulatory notification, and coordinate with external legal counsel if necessary. In an agency, this is usually the Managing Director, the CEO, or the Data Protection Officer (DPO). 
        </li>
        <li>
          <strong>The person who handles communications:</strong> Managing communications while trying to contain a breach is a recipe for mistakes. This role is dedicated strictly to managing the notification queues, filling out the reporting templates, and communicating directly with affected clients or individuals. An Account Director or Client Success Lead is often best suited for this.
        </li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">3. Build an Intake and Detection Channel</h2>
      <p className="mb-4">
        The largest vulnerability in most small businesses is not a weak firewall; it is an employee sitting on a mistake because they are afraid of getting fired. If an account manager accidentally misconfigures a cloud storage folder, leaving it public for a week, their first instinct might be to quietly fix it and hope nobody notices. By the time a client or regulator flags the exposure, the 72-hour window is long gone, and the agency is in clear violation of the law.
      </p>
      <p className="mb-4">
        You must build a friction-free internal detection channel. Set up a dedicated, permanent email alias (like <code>privacy@youragency.com</code>) that routes directly to the person who receives the report and the person deciding on notification. 
      </p>
      <p className="mb-8">
        More importantly, establish a strict "no blame" internal reporting culture. Your internal guidance must explicitly state that if an employee suspects something has gone wrong with personal data, they must report it to the privacy alias immediately, with the guarantee of zero disciplinary retaliation for the mistake. The primary corporate objective is rapid containment and legal compliance, which is impossible if your team hides incidents out of fear.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">4. The Assessment Checklist</h2>
      <p className="mb-4">
        Once an incident is reported and the immediate technical bleeding is stopped, your team must rapidly assess the situation. Use a standardized checklist to evaluate the incident against the GDPR’s three core breach categories: confidentiality (unauthorized access or disclosure), integrity (unauthorized alteration), and availability (accidental loss or destruction).
      </p>
      <p className="mb-4">Walk through the following questions immediately:</p>
      <ul className="list-disc pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>What data was involved?</strong> Was it standard business contact information, or sensitive data like financial records or health information?</li>
        <li><strong>How many people are affected?</strong> Is this an isolated incident affecting one person, or a systemic failure exposing thousands of records?</li>
        <li><strong>Can the data be recovered?</strong> If records were deleted, do you have an isolated offline backup to restore from, or is the loss permanent?</li>
        <li><strong>Was the data encrypted?</strong> If a laptop was stolen but possessed state-of-the-art full disk encryption and a strong passcode, the data is unintelligible and the risk is drastically reduced.</li>
      </ul>
      <p className="mb-8">
        To remove subjective guesswork from this process, implement a structured scoring model. We highly recommend using the ENISA severity methodology, which calculates risk based on Data Processing Context (data sensitivity), Ease of Identification, and the Circumstances of the Breach. Review our <Link href="/gdpr/data-breach-response" className="text-accent-gold hover:underline">detailed guide on data breach response</Link> to see how this risk scoring methodology categorizes breaches.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">5. The Notification Decision Tree</h2>
      <p className="mb-4">
        Your risk assessment directly dictates your legal obligations under the GDPR. The GDPR operates on a risk-based threshold, meaning not every mistake requires a phone call to the authorities. Use this simple decision tree:
      </p>
      <ul className="list-disc pl-6 mb-4 space-y-3 text-text-primary">
        <li>
          <strong>No Risk:</strong> The incident is unlikely to result in a risk to individuals (e.g., an encrypted laptop is lost, or an email is sent to a trusted partner who confirms immediate deletion). You do not notify the regulator or the individuals. You only document the incident internally.
        </li>
        <li>
          <strong>Risk:</strong> The breach is likely to result in a risk to the rights and freedoms of individuals. You must notify your competent supervisory authority (DPA) within 72 hours.
        </li>
        <li>
          <strong>High Risk:</strong> The breach poses a significant threat, such as identity theft, financial fraud, or discrimination. You must notify the DPA within 72 hours, <em>and</em> you must notify the affected individuals directly without undue delay.
        </li>
      </ul>
      <p className="mb-8">
        Crucially, you must understand your operational role. If your agency is acting as a <strong>data processor</strong>—meaning you are handling a dataset on behalf of a corporate client—you do not notify the DPA or the individuals directly. Your legal obligation is to notify your data controller (the client) without undue delay. In B2B relationships, your Data Processing Agreement (DPA) will typically specify that you must notify the controller within a strict 24 to 48-hour window so they can manage their own 72-hour regulatory clock. To navigate these multi-party contract structures effectively, review our <Link href="/gdpr/dsar-controller-processor" className="text-accent-gold hover:underline">controller vs. processor DSAR guide</Link>.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">6. Prepare Response Templates</h2>
      <p className="mb-4">
        Drafting regulatory notifications or client apologies from scratch during an active crisis guarantees critical errors, omissions, and delays. Your incident response plan should include pre-drafted templates with blank fields ready to be populated. You do not want to be debating the tone of an email at 2 AM on a Saturday.
      </p>
      <p className="mb-4">Maintain these four templates:</p>
      <ul className="list-disc pl-6 mb-6 space-y-3 text-text-primary">
        <li>
          <strong>Internal Incident Report Form:</strong> A simple intake form for the employee discovering the breach to log the facts. <em>Example prompt: "Describe the incident, exact time of internal discovery, affected systems, and immediate containment measures taken."</em>
        </li>
        <li>
          <strong>DPA Notification Letter:</strong> A standardized form addressing the requirements of Article 33(3). <em>Example opening: "We are writing to notify you of a personal data breach in accordance with Article 33 of the GDPR, discovered on [Date/Time], involving [Categories of Data]."</em> (Remember that GDPR allows phased reporting; you can submit an initial form within 72 hours and provide more details later if your investigation is ongoing).
        </li>
        <li>
          <strong>Client Notification Email (Processor Breaches):</strong> A concise, factual template informing a data controller that a dataset you process for them has been compromised. <em>Example opening: "We are writing to inform you of a security incident involving personal data that we process on your behalf, and to outline the immediate containment steps we have taken."</em>
        </li>
        <li>
          <strong>Individual Notification Letter (High-Risk Controller Breaches):</strong> A plain-language letter for affected consumers. <em>Example opening: "We are writing to inform you of a security incident that may have exposed your [Data Categories], and to provide you with concrete steps you can take to protect yourself."</em>
        </li>
      </ul>
      <p className="mb-8">
        For seamless execution, Custodia's breach management module provides pre-built templates, automated risk assessment scoring, and real-time 72-hour tracking built directly into the platform.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">7. The Breach Register: Document Everything</h2>
      <p className="mb-4">
        A dangerous assumption is that if an incident is classified as "no risk" and doesn't require an external report, it can be fixed and forgotten. Under Article 33(5) of the GDPR, this is illegal. 
      </p>
      <p className="mb-4">
        Controllers must document <em>all</em> personal data breaches, regardless of severity. You must maintain an internal breach register that records the facts relating to the incident, its effects, and the remedial actions taken. 
      </p>
      <p className="mb-8">
        If a regulator audits your agency, they will demand to see this register. It serves as your definitive proof of accountability, demonstrating that you are actively monitoring your security environment and that your decisions <em>not</em> to report certain breaches were justified by objective risk assessments. Failing to log an incident is an independent regulatory infraction, even if the breach itself was entirely harmless. 
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">8. Test and Review</h2>
      <p className="mb-4">
        A documented response plan that sits unread in a shared drive provides a false sense of security. Your plan is only proven when the controls are actively tested. To build actual operational muscle memory, your designated response team must run a tabletop exercise every six months or after any major change. 
      </p>
      <p className="mb-4">
        Pick a highly realistic, mundane scenario—such as an employee CC'ing an entire client list instead of using BCC, or a remote worker losing their backpack. Spend 30 minutes walking through the plan step-by-step: How is it reported? Who calculates the ENISA severity score? Which notification template do we use? This exercise will immediately expose your gaps, such as outdated client contact directories or confusion over which supervisory authority you actually report to. 
      </p>
      <p className="mb-8">
        For broader context on establishing a comprehensive privacy posture across your agency, consult our <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">GDPR compliance guide for agencies</Link>. Remember to review and update your incident response plan whenever you adopt new SaaS processing tools, onboard new enterprise clients, or change your core operational personnel.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Conclusion</h2>
      <p className="mb-4">
        Operational readiness under the GDPR does not require complex security infrastructures or expensive external consultants. It simply requires a predictable, structured workflow. By establishing a frictionless intake channel, defining clear internal roles, and preparing your templates in advance, your agency can confidently navigate the demanding 72-hour regulatory window without panic. 
      </p>
      <p>
        Ensure your agency has the internal machinery ready before the clock starts ticking. Evaluate your current operational readiness by taking our <Link href="/assessment" className="text-accent-gold hover:underline">free gap assessment</Link>.
      </p>
    </GdprGuideLayout>
  );
}
