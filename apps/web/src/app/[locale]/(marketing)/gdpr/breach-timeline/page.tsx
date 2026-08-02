"use client";

import React from 'react';
import Link from 'next/link';
import { GdprGuideLayout } from '@/components/layout/GdprGuideLayout';

export default function BreachTimelinePage() {
  return (
    <GdprGuideLayout
      title="The 72-Hour Breach Notification Timeline Step by Step"
      category="Breach Response"
      date="August 2, 2026"
    >
      <p className="lead text-lg text-text-muted mb-8">
        For many EU agency operators and small business owners, the statutory rule requiring organizations to report a data breach within three days is a familiar concept. In theory, a 72-hour window sounds entirely manageable. However, the practical reality of navigating a breach response is often chaotic and unforgiving. When a crisis hits, those hours evaporate rapidly into technical triage, internal debates, and legal reviews. The window provides virtually no slack once you account for the real work involved in detecting, assessing, and reporting the incident. 
      </p>
      <p className="mb-8">
        This guide breaks the 72-hour window down into concrete, actionable phases so you can visualize exactly where the time goes. By treating this timeline like a pilot's pre-flight checklist, you can navigate the crisis calmly and practically, avoiding the chaotic scrambling that leads to regulatory fines.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Hour Zero: The True Meaning of "Becoming Aware"</h2>
      <p className="mb-4">
        The most dangerous misconception about the General Data Protection Regulation (GDPR) is when the reporting clock actually starts ticking. Under Article 33(1), an organization must notify the competent supervisory authority without undue delay and, where feasible, not later than 72 hours after having become aware of the breach. 
      </p>
      <p className="mb-4">
        "Becoming aware" does not mean the moment your Chief Executive Officer is formally briefed, nor does it mean the moment your IT department finalizes a comprehensive forensic investigation. According to the European Data Protection Board (EDPB), awareness legally begins the precise moment any employee in your organization has a reasonable degree of certainty that a security incident has occurred and that personal data was compromised. 
      </p>
      <p className="mb-8">
        If a junior account manager realizes on a Friday evening that they accidentally attached an unencrypted client database to an email sent to an unauthorized vendor, your regulatory clock starts running immediately. The fact that management is out of the office for the weekend does not pause the countdown. This is why your internal reporting culture must be frictionless—employees must escalate anomalies immediately, because the 72-hour timer is running whether leadership formally acknowledges the incident or not.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Hours 0–6: Containment and Initial Triage</h2>
      <p className="mb-4">
        The first six hours are the most critical for stopping the bleeding. Your incident response team must immediately initiate two parallel workstreams: technical containment and compliance scoping. A common operational failure among small businesses is executing these steps sequentially, meaning they wait for technical containment to completely conclude before beginning their legal and administrative assessment. In practice, technical containment can take days, so a sequential approach practically guarantees a missed deadline.
      </p>
      <p className="mb-4">
        On the technical side, focus entirely on immediate isolation. You must swiftly lock down compromised administrative accounts, revoke active sharing links, cycle API keys, and isolate affected database servers from the rest of the local network. Do not wipe systems or delete logs in a panic; you must preserve forensic evidence to fully understand the scope of the breach later.
      </p>
      <p className="mb-8">
        Simultaneously, your designated compliance lead must log the exact discovery time in an internal document, establishing your definitive "Hour Zero". Begin scoping the impact immediately by asking preliminary questions: What specific data is involved? Are we looking at basic contact information, or does this involve sensitive financial records? By running technical triage and compliance scoping concurrently, you preserve evidence while gathering the essential parameters needed for your formal risk assessment.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Hours 6–24: Structured Risk Assessment</h2>
      <p className="mb-4">
        With the immediate technical bleeding stopped, you must transition from crisis management into a structured risk assessment. Do not burn precious hours in subjective internal debates about whether the breach feels "serious enough" to report. 
      </p>
      <p className="mb-4">
        Instead, rely on your pre-built assessment checklist and apply the <Link href="/gdpr/data-breach-response" className="text-accent-gold hover:underline">ENISA severity methodology</Link> to evaluate the risk objectively based on the data context, ease of identification, and circumstances of the breach. 
      </p>
      <p className="mb-4">
        Based on this score, use your established decision tree to determine if the breach crosses the regulatory notification threshold (a risk to individuals) or triggers mandatory individual notifications (a high risk). 
      </p>
      <p className="mb-8">
        If your agency acts as a data processor for a client, this 6-to-24-hour block is where time is most critical. Standard B2B Data Processing Agreements (DPAs) establish a strict contractual window of 24 to 48 hours for <Link href="/gdpr/dsar-controller-processor" className="text-accent-gold hover:underline">processor notification obligations</Link>. You must inform your client promptly so they can begin their own 72-hour regulatory clock. 
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Hours 24–48: Drafting the Notification</h2>
      <p className="mb-4">
        If your assessment concludes that the breach is reportable, the second day must be dedicated to drafting the actual notification. To save time, you should populate your <Link href="/gdpr/incident-response-plan" className="text-accent-gold hover:underline">pre-drafted DPA notification template</Link> rather than attempting to write a complex legal document from scratch during a live crisis. 
      </p>
      <p className="mb-4">
        Under Article 33(3), your notification to the supervisory authority must contain four brief elements:
      </p>
      <ol className="list-decimal pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Nature of the breach:</strong> Categories and approximate numbers of individuals and records affected.</li>
        <li><strong>Contact details:</strong> Name and direct contact information for your DPO or primary incident response lead.</li>
        <li><strong>Likely consequences:</strong> An objective assessment of what could happen to the individuals involved.</li>
        <li><strong>Remedial measures:</strong> The exact steps taken or proposed to contain the breach and mitigate impacts.</li>
      </ol>
      <p className="mb-8">
        If your risk assessment triggered a "high risk" rating, this is also the precise time to begin drafting plain-language individual notifications to the affected data subjects. While it is prudent to have your legal counsel review the drafts, do not allow prolonged legal revisions to block your submission timeline.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Hours 48–72: Review, Submit, and Document</h2>
      <p className="mb-4">
        The final 24 hours of your window are dedicated to final quality assurance, official submission, and internal compliance logging. Review the drafted notification against the latest facts provided by your technical team to ensure basic accuracy before filing.
      </p>
      <p className="mb-4">
        A very common time-trap agencies fall into during this phase is withholding the notification entirely because the technical investigation is not completely finished. Do not wait. The GDPR explicitly permits phased reporting. If you do not have all the facts, submit an initial notification within the 72-hour window using the information you currently possess, and clearly state that a deeper investigation is ongoing.
      </p>
      <p className="mb-8">
        Once you have hit "submit" on your supervisory authority's web portal, your immediate regulatory deadline is met. Finally, log the entire incident—regardless of its severity—in your <Link href="/gdpr/incident-response-plan" className="text-accent-gold hover:underline">internal breach register</Link> to satisfy Article 33(5) accountability requirements.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">After 72 Hours: What Happens Next</h2>
      <p className="mb-4">
        After the intense 72-hour window closes, your agency transitions from acute crisis management to long-term risk mitigation and governance. If you utilized the phased reporting mechanism, you must maintain regular contact with your supervisory authority, providing structured updates as your technical and forensic findings crystallize. 
      </p>
      <p className="mb-4">
        If your ongoing investigation reveals that the breach was far worse than initially thought—escalating the risk to a "high risk" level for individuals who were not previously notified—those communications must be dispatched directly to the affected data subjects without undue delay.
      </p>
      <p className="mb-8">
        Finally, conduct an internal post-incident review. Analyze the root cause of the breach, identify why your initial technical or organizational defenses failed, and evaluate how your incident response team performed under pressure. Update your security protocols, patch vulnerabilities, and revise your incident response plan based on the lessons learned so you are better prepared for future anomalies.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">What Happens If You Miss the Deadline?</h2>
      <p className="mb-4">
        Failing to meet the 72-hour statutory deadline is not treated as a minor administrative oversight. The consequences extend far beyond simple procedural fines. 
      </p>
      <p className="mb-4">
        Under the GDPR, failing to notify the supervisory authority on time is an independent violation carrying maximum administrative penalties of up to €10 million or 2% of your organization's global annual turnover, whichever is higher. 
      </p>
      <p className="mb-8">
        More importantly, regulators actively view a missed or delayed notification as an aggravating factor when calculating the final penalty for the underlying data security failure. If your agency suffers a breach due to weak access controls, the resulting fine will be significantly amplified if you also fail to report the incident on time. Supervisory authorities interpret a late notification as direct evidence of a poor organizational accountability culture and a systemic failure of internal governance. If you are forced to submit late, you must provide a rigorously documented, highly justifiable reason for the delay alongside your submission, but the damage to your regulatory standing is often already done.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Conclusion</h2>
      <p className="mb-4">
        The 72-hour window is unforgiving, but it is manageable if your agency is prepared. Surviving a breach requires shifting from ad-hoc crisis management to a structured, repeatable workflow. By breaking the timeline down into discrete phases—detection, containment, assessment, and submission—your team can navigate the regulatory requirements methodically. 
      </p>
      <p>
        Custodia's breach module tracks the timeline automatically, ensuring your team executes every required step before the window closes. Ensure your agency is prepared before an incident strikes by taking a <Link href="/assessment" className="text-accent-gold hover:underline">free assessment</Link>.
      </p>
    </GdprGuideLayout>
  );
}
