import React from 'react';
import { Link } from '@/i18n/routing';

export function GdprGuidePost() {
  return (
    <>
      <p className="lead text-lg text-text-muted mb-8">
        If you run a marketing, creative, or digital agency in the EU, you already know what the GDPR is. You've seen the cookie banners, you've signed the contracts, and you know the fines can be steep.
      </p>
      <p className="mb-4">
        But here is the uncomfortable truth: knowing what the GDPR is does not mean your agency is compliant.
      </p>
      <p className="mb-4">
        For a 10-to-50-person agency running client campaigns across a sprawling stack of SaaS tools, compliance isn't about memorizing legal definitions. It's about operationalizing data privacy so that a single misconfigured HubSpot instance doesn't create a massive liability across your entire client portfolio. 
      </p>
      <p className="mb-8">
        You don't need a €20,000 consultancy retainer, and you likely don't need a full-time Data Protection Officer (DPO). But you do need a system. This guide breaks down exactly where agencies are uniquely exposed, what you are getting wrong, and what a practical, realistic compliance setup actually looks like.
      </p>

      <hr className="border-white/10 my-10" />

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Why Agencies Are Uniquely Exposed</h2>
      <p className="mb-4">
        Most businesses have a straightforward relationship with data: they collect it from their customers, and they process it. Agencies have a structural complication that makes compliance inherently riskier: <strong>you are both a Data Controller and a Data Processor.</strong>
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>As a Controller:</strong> You dictate how and why data is collected regarding your own employees, your agency's prospects, and your newsletter subscribers.</li>
        <li><strong>As a Processor:</strong> You handle, store, and manipulate data on behalf of your clients. When you migrate a client's CRM, run their Meta Ads, or manage their email marketing lists, you are acting as a processor.</li>
      </ul>
      <p className="mb-4">
        Most agencies fail to properly distinguish between these two roles. Why does this matter? Because your legal obligations change entirely depending on which hat you are wearing. 
      </p>
      <p className="mb-8">
        If a data breach occurs in a system you manage for a client, you aren't just facing regulatory scrutiny—you are facing breach of contract with your client. When you sign a Master Services Agreement (MSA) or a Data Processing Agreement (DPA) with a client, you are promising them that your security and privacy practices are airtight. If they aren't, the liability falls squarely on your agency.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">The Vendor Stack Problem</h2>
      <p className="mb-4">
        Take a look at your agency's credit card statement. You likely use between 15 and 30 SaaS tools to run your business and execute client campaigns. Google Analytics 4 (GA4), Meta Pixel, Mailchimp, HubSpot, Slack, AWS, Google Workspace, Asana, Monday.com—the list is endless.
      </p>
      <p className="mb-4">
        Under the GDPR, almost every single one of these tools has data processing implications. Each tool is a "sub-processor." 
      </p>
      <p className="mb-4">Here is where agencies get into trouble:</p>
      <ol className="list-decimal pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>Missing DPAs:</strong> Have you actually signed a Data Processing Agreement with every tool in your stack? If you are pumping client data into a new AI copywriting tool or a niche CRM without a DPA in place, you are violating your client's trust and the law.</li>
        <li><strong>Shadow IT:</strong> Your account directors might sign up for a free trial of a new project management tool and upload a client's customer list. Suddenly, you have an unvetted sub-processor holding regulated data.</li>
        <li><strong>Cross-Border Transfers:</strong> Tools like Mailchimp frequently update their infrastructure. When Mailchimp was acquired by Intuit, their data processing terms shifted. Are your sub-processors keeping data within the EU, or are they transferring it to the US? </li>
      </ol>
      <p className="mb-8">
        Almost no agency tracks this properly. You cannot protect data if you don't know where it lives. You need a centralized vendor registry. Every tool must be logged, vetted, and tied to a signed DPA. This is what Custodia's vendor intelligence module does: it tracks your stack, flags missing DPAs, and monitors sub-processor changes automatically.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Article 30: A ROPA Isn't Optional</h2>
      <p className="mb-4">
        There is a dangerous myth in the agency world that a Record of Processing Activities (ROPA) is only required for massive enterprise corporations with over 250 employees. 
      </p>
      <p className="mb-4"><strong>This is false.</strong></p>
      <p className="mb-4">
        Article 30 of the GDPR includes a specific caveat: if your processing of personal data is not occasional, or if it includes sensitive data, you must maintain a ROPA regardless of your company size. Because agencies process data daily on behalf of clients, a ROPA is a strict legal requirement.
      </p>
      <p className="mb-4">Think of a ROPA as the master blueprint of your data architecture. It forces you to document:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li>What data you collect</li>
        <li>Why you collect it (your Lawful Basis)</li>
        <li>Where it is stored</li>
        <li>Who has access to it</li>
        <li>When it will be deleted</li>
      </ul>
      <p className="mb-4">
        If a regulator ever knocks on your door, or if a sophisticated enterprise client audits your agency before signing a contract, your ROPA is the very first document they will ask for. Without it, you cannot prove compliance.
      </p>
      <p className="mb-4">
        Creating a ROPA sounds terrifying, but it doesn't have to be a 100-page legal document. It can start as a structured spreadsheet mapping your processes. 
      </p>
      <p className="mb-8">
        To see exactly how to build one without the legal jargon, check out our deep-dive guide: <Link href="/blog/what-is-ropa-template" className="text-accent-gold hover:underline">What is a ROPA? A Practical Template for Marketing Teams</Link>.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Cookie Consent is Now Enforcement-Ready</h2>
      <p className="mb-4">
        For years, the industry treated cookie banners as an annoying design element rather than a strict legal requirement. Agencies would install a generic plugin, hide the "Reject All" button, and move on.
      </p>
      <p className="mb-4">That era is over. Enforcement is here, and it is aggressive.</p>
      <p className="mb-4">
        Data Protection Authorities (DPAs) across Europe are actively scanning websites and issuing fines for non-compliant cookie setups. Furthermore, the ad-tech ecosystem has fundamentally changed. With the rollout of <strong>Google Consent Mode v2</strong> and the <strong>IAB Transparency and Consent Framework (TCF)</strong>, proper consent signaling is no longer just a legal issue—it's a performance issue.
      </p>
      <p className="mb-4">
        If your agency is running a client's website or managing their performance marketing, a misconfigured cookie banner creates massive liability for your client (which they will blame you for) and severely degrades their ad tracking.
      </p>
      <p className="mb-4">A compliant setup requires:</p>
      <ol className="list-decimal pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>Prior Consent:</strong> No trackers (including GA4 or Meta Pixel) can fire before the user explicitly clicks "Accept."</li>
        <li><strong>Equal Prominence:</strong> The "Reject" button must be just as visible and easy to click as the "Accept" button.</li>
        <li><strong>Granular Control:</strong> Users must be able to consent to analytics cookies while rejecting marketing cookies.</li>
        <li><strong>Proper Signaling:</strong> Your banner must integrate with Google Consent Mode v2 to ensure consent states are accurately passed to Google's tags.</li>
      </ol>
      <p className="mb-8">
        If you are unsure how to navigate the technical requirements of the new Google mandate, read our comprehensive breakdown: <Link href="/blog/google-consent-mode-v2" className="text-accent-gold hover:underline">Why Google Consent Mode v2 Matters for Your Clients</Link>.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">DSAR Handling: The 30-Day Ticking Clock</h2>
      <p className="mb-4">
        Under the GDPR, any individual has the right to ask you what data you hold on them, demand a copy of it, or request that you delete it entirely. This is known as a Data Subject Access Request (DSAR).
      </p>
      <p className="mb-4">
        When a DSAR hits your agency's inbox (often via a generic <code className="bg-white/10 px-1 py-0.5 rounded text-sm">hello@youragency.com</code> email), what happens? 
      </p>
      <p className="mb-4">
        In most 10-50 person agencies, the answer is panic. The email gets forwarded around, someone tries to manually search HubSpot and Slack for the person's name, and the process stalls. 
      </p>
      <p className="mb-4">Here are the strict rules you must follow:</p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li><strong>The Deadline:</strong> You have exactly <strong>one calendar month from receipt</strong> to respond to and fulfill the request. </li>
        <li><strong>Verification:</strong> You must verify the identity of the person requesting the data before handing it over.</li>
        <li><strong>Controller vs Processor Dynamics:</strong> If the request is from someone on <em>your</em> newsletter list (you are the Controller), you must fulfill it. If the request is regarding a <em>client's</em> database that you manage (you are the Processor), you cannot fulfill it directly. You must immediately notify your client so they can manage the response, as dictated by your DPA.</li>
      </ul>
      <p className="mb-8">
        A practical agency setup requires a standardized playbook. You need a dedicated email alias (e.g., <code className="bg-white/10 px-1 py-0.5 rounded text-sm">privacy@youragency.com</code>), a verification template, and a clear escalation path so your team knows exactly who handles the request the moment it arrives.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">Breach Notification: The 72-Hour Rule</h2>
      <p className="mb-4">
        Under the GDPR, a breach is any security incident leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data.
      </p>
      <p className="mb-4">
        If an account manager accidentally emails an unencrypted spreadsheet of a client's 5,000 customers to the wrong vendor, <strong>that is a data breach.</strong> If an employee loses an unencrypted company laptop containing local backups of client data, <strong>that is a data breach.</strong>
      </p>
      <p className="mb-4">When a breach occurs, the clock starts ticking immediately. </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-text-primary">
        <li>If you are the <strong>Controller</strong>, you have <strong>72 hours</strong> from the moment you become aware of the breach to notify your supervisory authority, unless the breach is unlikely to result in a risk to individuals.</li>
        <li>If you are the <strong>Processor</strong>, you must notify your client (the Controller) <em>without undue delay</em>. Often, the DPA you signed with the client specifies a much tighter window, such as 24 hours.</li>
      </ul>
      <p className="mb-8">
        Failing to report a breach within the 72-hour window is a severe violation that significantly multiplies regulatory fines. Your agency must have an incident response plan written down <em>before</em> a breach happens. When the clock is ticking, you don't have time to figure out who your supervisory authority is or what your client contracts require.
      </p>

      <h2 className="text-2xl mt-12 mb-4 font-medium text-text-heading">What a Realistic Compliance Setup Looks Like</h2>
      <p className="mb-4">
        If you are a 30-person agency, you do not need to hire a €120,000/year DPO. But you can no longer rely on a copy-pasted privacy policy and a generic cookie banner.
      </p>
      <p className="mb-4">
        A realistic, practical compliance setup for a modern digital agency involves a system of record that centralizes your privacy operations. It means having:
      </p>
      <ol className="list-decimal pl-6 mb-8 space-y-2 text-text-primary">
        <li><strong>A Living ROPA:</strong> A dynamic record of your data flows that doesn't rot in a Google Drive folder.</li>
        <li><strong>Vendor Intelligence:</strong> A centralized ledger of all your SaaS tools, tracking DPAs, sub-processors, and data transfer mechanisms.</li>
        <li><strong>Consent Management:</strong> A standardized, technically compliant approach to cookie banners (integrated with Consent Mode v2) deployed across all client sites.</li>
        <li><strong>Process Playbooks:</strong> Written, accessible SOPs for handling DSARs and Data Breaches within the legal deadlines.</li>
        <li><strong>An Audit Trail:</strong> The ability to instantly generate a compliance report when pitching a lucrative enterprise client who demands to see your privacy posture.</li>
      </ol>
      <p className="mb-8">
        Compliance is no longer just a legal checkbox; it is a competitive advantage. When you can definitively prove to a prospective client that your agency understands data privacy better than your competitors, you win the pitch.
      </p>
    </>
  );
}
