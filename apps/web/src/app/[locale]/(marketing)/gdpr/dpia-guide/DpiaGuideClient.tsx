"use client";

import React from 'react';
import { Link } from '@/i18n/routing';
import { GdprGuideLayout } from '@/components/marketing/GdprGuideLayout';

export default function DpiaGuidePage() {
  return (
    <GdprGuideLayout
      title="When a DPIA Is Required and How to Run One"
      category="Data Processing"
      date="August 2, 2026"
    >
      <p className="lead text-lg text-text-muted mb-8">
        If you run a digital agency or a small-to-medium service business in the EU, it is easy to assume that Data Protection Impact Assessments (DPIAs) are exclusively an enterprise problem. Because GDPR enforcement headlines usually feature massive fines against big tech companies, smaller organizations often believe that highly structured risk assessments do not apply to them. 
      </p>
      <p className="mb-4">
        This is a dangerous misconception. Under the GDPR, the legal necessity of a DPIA is determined entirely by the risk profile of your data processing activities, not the size of your company or the budget of your compliance department. If your agency engages in tracking user behavior, building audience profiles, or migrating large client databases, you are likely crossing the threshold for a mandatory assessment. 
      </p>
      <p className="mb-8">
        This guide will demystify the DPIA requirement, helping you understand exactly when it applies to your operations and how to run one practically, without needing to hire an expensive external consultant. For a broader understanding of how these responsibilities fit into your overall client relationships, you can review our <Link href="/gdpr/compliance-guide-agencies" className="text-accent-gold hover:underline">GDPR compliance guide for agencies</Link>.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">1. What a DPIA Actually Is</h2>
      <p className="mb-4">
        A Data Protection Impact Assessment (DPIA) is a structured, systematic process designed to help you identify, evaluate, and minimize the data protection risks of a project before it begins. Governed by Article 35 of the GDPR, it is an essential operational tool for proving your accountability and building "data protection by design" into your workflows. 
      </p>
      <p className="mb-4">
        A common mistake is treating a DPIA like a retrospective security audit. It is not a test you run on systems that are already live. The law explicitly requires that a DPIA be carried out <em>prior</em> to the processing of personal data. It is a forward-looking exercise. 
      </p>
      <p className="mb-8">
        Furthermore, a DPIA is not just an IT security checklist. While standard security audits focus on protecting the company's digital assets from hackers, a DPIA focuses squarely on protecting the fundamental rights and freedoms of the individuals whose data you are processing. It forces you to evaluate how your proposed project might cause them physical, material, or non-material harm, such as discrimination, identity theft, financial loss, or simply a loss of control over their personal information.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">2. When Is a DPIA Mandatory? The Key Triggers</h2>
      <p className="mb-4">
        You are legally required to conduct a DPIA anytime a proposed processing activity is "likely to result in a high risk to the rights and freedoms of natural persons". To remove ambiguity, the GDPR and European regulators have established specific triggers.
      </p>
      
      <h3 className="text-xl mt-8 mb-3 font-medium text-text-primary">Article 35(3) Triggers and EDPB Criteria</h3>
      <p className="mb-4">
        Article 35(3) of the GDPR explicitly names three scenarios where a DPIA is always mandatory:
      </p>
      <ol className="list-decimal pl-6 mb-4 space-y-2 text-text-primary">
        <li><strong>Systematic and extensive profiling:</strong> Automated processing (like profiling) that evaluates personal aspects of an individual and leads to decisions that produce legal or similarly significant effects.</li>
        <li><strong>Large-scale special category data:</strong> Processing sensitive data (such as health, biometric, or genetic data) or criminal conviction data on a large scale. </li>
        <li><strong>Systematic monitoring of public areas:</strong> Observing or monitoring a publicly accessible area on a large scale.</li>
      </ol>
      <p className="mb-6">
        Because the statutory list is short, the European Data Protection Board (EDPB) published guidelines with additional high-risk criteria to help calibrate your assessments. The EDPB rule of thumb is that if your planned processing meets <strong>two or more</strong> of their criteria, a DPIA is almost certainly required. For agencies, the most relevant EDPB criteria include <em>evaluation or scoring</em> (profiling), <em>systematic monitoring</em> (online user tracking), <em>matching or combining datasets</em> from different sources, <em>large-scale data processing</em>, and applying <em>innovative technology</em> like AI. (The full list of nine criteria is available in the official EDPB guidelines).
      </p>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-primary">National DPA Blacklists</h3>
      <p className="mb-6">
        Additionally, every national Data Protection Authority (DPA) publishes its own list of specific processing types that automatically require a DPIA in their jurisdiction. 
      </p>

      <h3 className="text-xl mt-8 mb-3 font-medium text-text-primary">Agency-Relevant Examples</h3>
      <p className="mb-4">
        For digital agencies, you hit these triggers faster than you might think. A DPIA is mandatory if you are:
      </p>
      <ul className="list-disc pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>Deploying large-scale behavioral tracking:</strong> Using tracking scripts across multiple client websites to monitor browsing habits and optimize targeted advertising (hits <em>Systematic monitoring</em> and <em>Large-scale processing</em>).</li>
        <li><strong>Building detailed profiles:</strong> Combining offline client transactional data with third-party social media behaviors to score prospective leads (hits <em>Evaluation or scoring</em> and <em>Matching datasets</em>).</li>
        <li><strong>Deploying AI/ML tools:</strong> Integrating an AI-driven tool that analyzes personal data to predict customer churn (hits <em>Innovative technology</em> and <em>Evaluation or scoring</em>).</li>
        <li><strong>Migrating large client databases:</strong> Moving massive volumes of sensitive client data to a new cloud warehouse (hits <em>Large-scale processing</em> and potentially <em>Sensitive data</em>).</li>
      </ul>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">3. When You Probably Don't Need One</h2>
      <p className="mb-4">
        Not every project needs a DPIA. If the processing is small-scale, low-risk, and does not involve profiling, systematic monitoring, or special categories of data, you can likely skip it. 
      </p>
      <p className="mb-4">
        You must help your team calibrate this threshold so you don't paralyze your operations with unnecessary paperwork. For example, setting up a basic email newsletter does not trigger a DPIA. If you are simply collecting names and email addresses directly from users who opt-in to receive product updates, and you aren't tracking their every click or sharing the list with data brokers, the risk to their fundamental rights is low. 
      </p>
      <p className="mb-8">
        Similarly, routine administrative tasks, like standard payroll processing for a small team or basic physical access control using keycards (without biometric fingerprinting), generally do not require a DPIA. If you decide a DPIA is not needed after reviewing a project, document that decision briefly so you have proof that you considered the risks.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">4. Step-by-Step Walkthrough: Running a DPIA</h2>
      <p className="mb-4">
        You do not need to hire an external consultant to run a DPIA. You just need a structured process. Let's walk through a concrete, common agency example: <strong>deploying behavioral analytics across 15 client websites to build dynamic advertising profiles.</strong>
      </p>
      
      <p className="mb-2 mt-6 font-semibold text-text-primary">Step 1: Describe the Processing</p>
      <p className="mb-2">First, write down exactly what you are doing with the data—the nature, scope, context, and purpose. </p>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-text-primary">
        <li><strong>What data:</strong> You are injecting JavaScript tags into 15 client sites to collect IP addresses, user-agent strings, mouse movements, page views, and cart abandonments.</li>
        <li><strong>Why (Purpose):</strong> The goal is to build consumer profiles to optimize checkout funnels and serve dynamic, personalized advertisements.</li>
        <li><strong>How (Nature):</strong> The script transmits data to your agency's centralized cloud database.</li>
        <li><strong>Context and Scope:</strong> You are tracking roughly 80,000 unique monthly visitors. These are public consumers who do not have a direct relationship with your agency and do not naturally expect their movements to be tracked across independent retail brands.</li>
      </ul>

      <p className="mb-2 font-semibold text-text-primary">Step 2: Assess Necessity and Proportionality</p>
      <p className="mb-6">
        Next, evaluate if this processing is strictly necessary and proportionate to your goals. Are you using the least intrusive way to achieve the outcome? Here, you must establish a valid lawful basis for the tracking. Because this involves cross-site tracking and behavioral profiling, legitimate interest is very difficult to justify here; in most cases you'll need explicit consent before the script fires. If you need help evaluating if your chosen basis is legally sound, check our guide on <Link href="/gdpr/lawful-bases" className="text-accent-gold hover:underline">lawful bases</Link>. You should also confirm you are minimizing data—for example, ensuring the script is configured to never capture keystrokes inside password or credit card fields.
      </p>

      <p className="mb-2 font-semibold text-text-primary">Step 3: Identify and Assess Risks to Individuals</p>
      <p className="mb-2">Put yourself in the shoes of the website visitors. What could go wrong for them?</p>
      <ul className="list-disc pl-6 mb-2 space-y-1 text-text-primary">
        <li><em>Risk 1:</em> Hackers breach your centralized database, exposing the browsing habits of 80,000 people (Risk: Loss of confidentiality, potential identity fraud).</li>
        <li><em>Risk 2:</em> The script accidentally captures sensitive health data if one of the 15 clients sells medical supplies (Risk: Unauthorized processing of special category data).</li>
      </ul>
      <p className="mb-6">For each risk, score the likelihood of it happening and the severity of the harm to the individual.</p>

      <p className="mb-2 font-semibold text-text-primary">Step 4: Identify Mitigations</p>
      <p className="mb-2">Now, list the specific technical and organizational measures you will apply to drive those risk scores down.</p>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-text-primary">
        <li><em>For the database breach risk:</em> You implement strict access controls, require multi-factor authentication (MFA) for your analysts, encrypt the database at rest, and implement pseudonymization by hashing IP addresses immediately upon collection. You also set an automated 90-day retention limit so old data is purged.</li>
        <li><em>For the sensitive data risk:</em> You logically isolate each client's data so health-related browsing is never mixed with general retail browsing, and you block the script from running on sensitive pages.</li>
      </ul>

      <p className="mb-2 font-semibold text-text-primary">Step 5: Document the Outcome and Sign Off</p>
      <p className="mb-8">
        Compile all of this into a single document. Document your evaluation of the residual risk—the risk level that remains <em>after</em> your mitigations are applied. Finally, have your Data Protection Officer (if you have one) provide their official advice, and have project leadership sign off on the assessment.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">5. The DPA Consultation Requirement</h2>
      <p className="mb-4">
        There is a critical rule in the GDPR that many businesses miss entirely: Article 36, the prior consultation requirement. 
      </p>
      <p className="mb-4">
        If you finish your DPIA, apply every mitigation you can think of, and you determine that the residual risk to individuals remains <strong>high</strong>, you cannot just accept the risk and launch the project. Before any data processing begins, you are legally required to consult your national data protection authority (DPA). 
      </p>
      <p className="mb-8">
        You must submit your DPIA to the DPA and wait for their written advice, which can take up to 8 weeks. If they believe your project violates the GDPR, they have the power to ban the processing altogether. Keep this in mind when designing projects—the goal of your mitigations is to drive residual risk down to a moderate or low level so you can proceed without regulatory intervention.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">6. Connection to ROPA and Ongoing Compliance</h2>
      <p className="mb-4">
        A DPIA is not a one-and-done piece of paperwork that you file away. It is a living document that requires ongoing review. If your agency changes how it processes data—for example, if you decide to plug a new generative AI tool into that behavioral analytics database—the risk profile changes, and you must update the DPIA. 
      </p>
      <p className="mb-8">
        Furthermore, your DPIAs must connect directly to your Record of Processing Activities (ROPA). Your ROPA acts as the master map that simply tells regulators <em>what</em> you process, while your DPIA is the deep-dive analysis that proves <em>why</em> your high-risk activities are legally justified and safe. To easily structure your master inventory, download our <Link href="/gdpr/ropa-template" className="text-accent-gold hover:underline">practical ROPA template</Link>.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Conclusion</h2>
      <p>
        DPIAs are not just enterprise red tape; they are highly practical tools that force your agency to build safe, secure products. By conducting them before you launch high-risk marketing campaigns or deploy new tracking technologies, you protect your end-users and shield your business from massive regulatory liability. Custodia's gap assessment checks whether your high-risk activities have documented DPIAs connected to them, so you can ensure your agency is compliant by taking our <Link href="/assessment" className="text-accent-gold hover:underline">free gap assessment</Link>.
      </p>
    </GdprGuideLayout>
  );
}
