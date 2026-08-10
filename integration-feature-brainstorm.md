# Integration-Powered Feature Brainstorm

**What this is:** every compliance workflow, automation, and surface that could be built on top of Custodia's existing authenticated connections to customer SaaS — beyond DSAR fulfilment.

**Status:** brainstorm / unfiltered. Nothing here is committed. See [Priorities](#priorities) at the end for a recommended first five.

**Date:** 2026-08-07

---

## The thesis

Most of these ideas don't add new modules. They turn existing modules — ROPA, vendor register, breach, TIA, training, compliance score — from **self-declared** into **observed**.

> Every other GDPR tool asks the customer what's true. Custodia would be the one that checks.

That is the whole positioning, and it is only buildable because the connectors already exist.

## The architectural constraint

Today `ProviderConfig` in `apps/api/src/integrations/registry.ts` exposes `searchContacts` / `searchDocuments` / `discoverDataProfile`. That interface models exactly one question: *"find this person."*

Everything in this document needs a second capability surface:

```ts
capabilities: ['directory' | 'files' | 'audit_log' | 'schema' | 'consent' | 'apps']
collectSignals(capability, scope, since): Promise<ComplianceSignal[]>
```

...running on a schedule and via webhooks, writing into a normalised signal store. Without that, every idea below becomes a bespoke code path per provider and the surface never scales past three connectors.

**Current registry state:** HubSpot (contacts/companies read, implemented), Salesforce (stub — needs `instance_url` persisted), Google Workspace (`drive.readonly` + `gmail.readonly`, stubs), Mailchimp (stub).

## Tag legend

| Tag | Meaning |
|---|---|
| `live` | Webhook or near-real-time; fires on an event |
| `sched` | Recurring job — nightly, weekly, quarterly |
| `scan` | Periodic deep content scan; heavier, lower frequency |

Prefer `live` and `sched` over `scan`. Recurring value drives retention; one-time scans are a sales demo that decays.

---

## 1. Google Workspace

Richest connector available. Drive + Admin SDK + Reports API is most of a DLP product.

**1. External-share watchdog for PII files** `live`
Watches the Drive `changes` feed; when a file gains an external or `type=anyone` permission, classifies its content and alerts if it holds personal data.
*Why:* The single most common real-world unauthorised disclosure. Today the DPO learns about it never.
*How:* Drive API v3 `changes.list` (incremental page token) → `permissions.list` → content sample → regex/LLM classify. Write-back: `permissions.delete`.

**2. "Anyone with the link" standing inventory** `sched`
Ranked list of every link-shared file, sorted by PII density, with age and last-access.
*Why:* Art 32 evidence plus a remediation backlog the DPO can actually work through.
*How:* Nightly `files.list` with `q=visibility='anyoneWithLink'`, cached; diff against prior run.

**3. Orphaned data from departed employees** `sched`
Suspended/deleted Directory users still owning Drive files, calendars, or shared drive memberships.
*Why:* Leaver data is unowned, unretained, unreviewed — a classic audit finding.
*How:* Admin SDK Directory `users.list(showDeleted, suspended)` × Drive `files.list("'<user>' in owners")` via domain-wide delegation.

**4. Shadow spreadsheet detector** `scan`
Finds Sheets whose header rows match PII schemas (name / DOB / national ID / salary / IBAN / health) and auto-drafts a ROPA candidate entry per cluster.
*Why:* "HR keeps a spreadsheet" is where undeclared processing actually lives. Makes ROPA self-populating.
*How:* Drive `files.list(mimeType='application/vnd.google-apps.spreadsheet')` → Sheets `values.get(A1:Z1)` → header classifier. **Headers only, no row data** — cheap and privacy-safe.

**5. Article 9 special-category sweep** `scan`
Content patterns for health, religion, union membership, sexual orientation, criminal convictions, biometrics across Drive.
*Why:* Art 9 data needs a separate lawful basis. Most SMEs don't know they hold any.
*How:* Drive `files.export` on text-bearing types + keyword/LLM classification → dedicated Art 9 register.

**6. Gmail auto-forwarding audit** `sched`
Every mailbox forwarding to an external address, plus alerts on new rules.
*Why:* Exfiltration vector and breach precursor — and trivially auditable evidence of email controls.
*How:* `users.settings.getAutoForwarding` + `settings.filters.list` per user; or Reports API `user_accounts` for change events.

**7. Mailbox delegation map** `sched`
Who can read whose mail — surfaces the assistant reading HR mail.
*How:* `users.settings.delegates.list`.

**8. OAuth grant → shadow vendor discovery** `sched`
Every third-party app any employee has granted access to, with scopes, user count, first-seen date. Auto-creates vendor records at "DPA unknown."
*Why:* **Highest-ROI item on this list.** Vendor registers are always incomplete because they're built from memory. This builds one from evidence and plugs into the existing vendor/DPA module.
*How:* Reports API `activities.list(applicationName='token')` + Directory `users.tokens.list`. Enrich against the existing `vendors.json` pipeline.

**9. New-app install alert → auto DPA request** `live`
New OAuth grant with data-read scopes fires an alert and drafts an outbound DPA request to the vendor.
*Why:* Turns vendor management from an annual scramble into a continuous process.
*How:* Reports API push notifications (or 15-min poll) on token events → templated email via DSAR comms infra.

**10. App risk scoring by granted scope** `sched`
`gmail.readonly` across 40 employees scores far higher than `calendar.events.readonly` for one.
*How:* Score = f(scope sensitivity, user count, vendor jurisdiction, DPA status). Feeds the compliance score.

**11. Public Google Groups exposure** `sched`
Groups where membership or archives are world-visible.
*Why:* Group archives are full of personal data; public exposure is a live disclosure.
*How:* Groups Settings API `whoCanViewMembership` / `whoCanViewGroup` / `whoCanPostMessage`.

**12. Vault retention reconciliation** `sched`
Compares actual Vault retention rules against the retention schedule declared in Custodia; alerts on drift.
*Why:* Nearly every customer's written retention policy and configured retention disagree. Proving they match is an audit slam-dunk.
*How:* Vault API `retention.rules.list` vs the schedule table.

**13. Legal-hold vs erasure conflict blocker** `live`
When a DSAR erasure lands, checks for an active Vault hold on that custodian and blocks deletion with a pre-drafted Art 17(3)(e) justification.
*Why:* Prevents deleting data under litigation hold — a genuinely career-ending mistake.
*How:* Vault `matters.holds.list` keyed by custodian email, gated into the DSAR fulfilment step.

**14. Mass-download anomaly → pre-filled incident** `live`
One user downloading 500 files in an hour opens a draft breach record with file list, timestamps, and user attached.
*Why:* Starts the 72-hour clock with evidence already collected instead of a blank form.
*How:* Reports API `drive` activity with per-user baselines.

**15. Alert Center ingestion** `live`
Google's own DLP, suspicious login, government-backed attack, and phishing alerts become Custodia incidents automatically.
*How:* Alert Center API `alerts.list` polled every few minutes → map alert types to the incident taxonomy.

**16. Admin setting drift monitor** `live`
Alerts when domain sharing is loosened, 2SV enforcement dropped, or a new super-admin is created.
*Why:* Art 32 is about *maintaining* measures, not having had them once.
*How:* Reports API `admin` audit activities + allowlist of watched setting names.

**17. Workforce access geography** `sched`
Login events by country → EU personal data accessed from outside the EEA.
*Why:* Remote-worker access is an under-documented transfer; feeds the TIA module.
*How:* Reports API `login` activities with IP geolocation.

**18. Shared drive owner attestation campaigns** `sched`
Quarterly: each shared drive owner receives members + external files and must attest or remediate.
*Why:* Recurring, dated evidence, and offloads work from the DPO to data owners.
*How:* Drive `drives.list` + `permissions.list` → campaign via email/Slack → responses stored as evidence.

**19. Recruitment data retention in mailboxes** `scan`
CVs and ID scans sitting in recruiter mailboxes and Drive folders past retention.
*Why:* Candidate-data retention is one of the most consistently fined categories in DE/FR/ES.
*How:* Gmail `messages.list(has:attachment filename:pdf older_than:1y)` scoped to recruiter OU + attachment classification.

**20. Drive label write-back** `sched`
Applies Drive labels ("Personal data — retention 24m — owner: X") to classified files.
*Why:* Compliance state lives where employees are, not only in the dashboard.
*How:* Drive Labels API `files.modifyLabels`. Requires write scope.

**21. Retention enforcement on Drive** `sched`
Files past their retention class enter a proposed-deletion queue → owner notification → grace period → trash.
*Why:* Retention is the most-promised, least-executed control in GDPR.
*How:* Age + label + folder rules → `files.update(trashed)`. Always human-approved; log everything as evidence.

**22. Google Forms privacy-notice audit** `sched`
Forms collecting personal data with no privacy notice link or consent question.
*How:* Forms API `forms.get` → field type/name inspection.

**23. Calendar external-domain analysis** `sched`
Recurring meetings with external domains that never appear in the vendor register.
*Why:* Cheap heuristic for undisclosed processor relationships.
*How:* Calendar API `events.list`, aggregate attendee domains.

**24. Personal-data heat map by department/OU** `sched`
Which org units hold the most personal data, in what systems, at what exposure level.
*Why:* Lets a DPO target training, DPIAs, and reviews where risk actually sits.

---

## 2. HubSpot & Salesforce (CRM)

**25. Property-level PII data dictionary** `sched`
Enumerates every standard and custom property, classifies each as PII / special category / non-personal, and auto-fills the ROPA "categories of personal data" field.
*Why:* **Second flagship.** Writing that ROPA section by hand takes a consultant a day per system and is stale immediately. This makes it generated and live.
*How:* HubSpot `crm/v3/properties/{objectType}` (name, label, description, type) + value sampling; Salesforce `describeSObject`. Classification by name heuristics + LLM.

**26. Schema drift → ROPA task** `live`
A new custom property called `health_condition` appears → ROPA update task with proposed classification.
*Why:* Recurring, unavoidable, and exactly what no human catches.
*How:* Nightly property diff, or HubSpot webhooks on `propertyChange`.

**27. Consent-vs-send reconciliation** `live`
Contacts who received marketing email despite subscription status = unsubscribed / never opted in.
*Why:* The actual fine pattern in EU marketing enforcement. Catching it live justifies the subscription on its own.
*How:* HubSpot Communication Preferences API (`communication-preferences/v3/status/email/{email}`) × email send events.

**28. Lawful-basis coverage gap** `sched`
Segments the contact database by lawful basis; reports the percentage with none recorded.
*Why:* Converts an abstract obligation into a single number that goes down over time.
*How:* HubSpot `hs_legal_basis` / legitimate-interest properties via Search API aggregation.

**29. Purchased-list detector** `sched`
Bulk imports with no consent evidence, high bounce rates, or contacts with no source event.
*Why:* Bought lists are the most dangerous processing an SME does, and marketing rarely tells the DPO.
*How:* Imports API history (file name, row count, timestamp, importer) + `hs_analytics_source=OFFLINE`.

**30. Stale-contact retention engine** `sched`
No engagement in N months, no open deal, no legal retention reason → batched deletion proposal with owner sign-off.
*How:* Search API on `hs_last_sales_activity_date` / `notes_last_updated` → GDPR-delete endpoint on approval.

**31. Zombie-record detection after erasure** `sched`
Re-checks weekly whether an erased data subject has reappeared via re-import or an integration sync.
*Why:* Erasure that silently reverses is how companies fail a follow-up audit. Nobody checks this today.
*How:* Hashed identifier watchlist re-queried across all connectors post-erasure.

**32. Cross-system suppression integrity** `sched`
Verifies an erased/objecting subject is suppressed in HubSpot *and* Mailchimp *and* the product DB; flags divergence.

**33. Special-category leakage in free text** `scan`
Sales notes and call logs containing health, criminal, or union references.
*Why:* "He mentioned he's on disability leave" in a note is Art 9 data with no lawful basis.
*How:* Engagements API (notes/calls/emails) → LLM classifier on a rolling window.

**34. Form compliance audit** `sched`
Forms without GDPR consent options enabled, pre-ticked boxes, bundled consent, missing privacy link.
*How:* HubSpot Forms API v3 `legalConsentOptions` inspection; flag `legitimate_interest` misuse.

**35. Article 22 automated-decision detection** `sched`
Scoring models, automated lead rejection, workflow branches making consequential decisions without human review.
*Why:* Art 22 triggers DPIA and specific notice obligations most SMEs miss entirely.
*How:* Automation API (workflow definitions) + `hubspotscore` usage → DPIA screening task.

**36. CRM export / bulk-view monitoring** `live`
Alerts on large list exports by a single user.
*Why:* Departing-salesperson data theft is a reportable breach and the DPO always hears late.
*How:* HubSpot audit log API (Enterprise) / Salesforce EventLogFile `ExportReport` events.

**37. Connected-app inventory inside the CRM** `sched`
Every app installed in the HubSpot portal / Salesforce connected app receiving contact data is a sub-processor.

**38. Data minimisation report** `sched`
Properties >95% empty, referenced by no workflow, list, or report.
*Why:* Direct Art 5(1)(c) evidence and a satisfying cleanup a DPO can show the board.

**39. Accuracy obligation report** `sched`
Duplicates, hard-bounced emails, contradictory records — Art 5(1)(d) in practice.

**40. Live ROPA volume metrics** `sched`
Object counts by lifecycle stage keep the ROPA "categories and volumes of data subjects" field current automatically.

**41. CRM user access geography & recertification** `sched`
Which users can see EU contact records, from where, with what permissions — quarterly recertification campaign.

---

## 3. Mailchimp & marketing tools

**42. Portable consent evidence ledger** `sched`
Continuously pulls opt-in IP, timestamp, and form text into an immutable, hash-chained store in Custodia.
*Why:* Consent proof lives in the ESP and vanishes the day you switch ESPs. Making proof survive vendor migration is a real, saleable benefit.
*How:* Mailchimp `/lists/{id}/members` (`ip_opt`, `timestamp_opt`, `marketing_permissions`) → append-only evidence table.

**43. Imported-without-consent segment** `sched`
Subscribers with status `subscribed` but no opt-in timestamp or IP.
*Why:* That segment *is* the legal exposure, quantified — and you can hand marketing the list.

**44. Double opt-in configuration audit** `sched`
Which audiences require confirmation, which don't, and when the setting changed.

**45. Unsubscribe propagation check** `sched`
Unsubscribed in Mailchimp but still `subscribed` in HubSpot → live violation.

**46. Campaign tracking / ePrivacy check** `sched`
Open-tracking pixels and click tracking vs declared cookie/tracking notices.

---

## 4. Slack

**47. Breach chatter early warning** `live`
Detects messages like "sent it to the wrong client", "the export got leaked", "wrong recipient" and DMs the poster: *was personal data involved?* One click opens a draft incident.
*Why:* **Best demo on this list.** Breaches surface in Slack hours-to-days before the DPO hears. Every recovered hour is a chunk of the 72-hour clock. Nothing on the market does this.
*How:* Events API `message.channels` → small classifier → interactive Block Kit prompt → breach module.

**48. Personal data posted in channels** `live`
Detects IBANs, national IDs, passport numbers, health details and nudges the poster in-thread.
*Why:* Preventive, educational, and generates a per-employee training signal.
*How:* Events API + pattern/LLM detection; **ephemeral** `chat.postEphemeral`, never a public callout.

**49. Slack Connect external-org map** `sched`
Every externally shared channel, which org, which internal members, how active.
*Why:* Each one is an undocumented data flow to a third party.
*How:* `conversations.list` filtered on `is_ext_shared` + `conversations.members`.

**50. Retention policy drift** `sched`
Channels with indefinite retention holding personal data.
*How:* Admin conversations APIs (Enterprise Grid) or per-channel message age sampling vs declared schedule.

**51. Public-channel exposure ranking** `sched`
Public channels ranked by PII density and member reach.

**52. File sharing audit** `sched`
Publicly linked files (`files.sharedPublicURL`), files uploaded by ex-employees, CVs and contracts in `#general`.

**53. App/bot install monitoring** `live`
Every new Slack app is a potential processor; auto-create a vendor record and start the DPA chase.
*How:* `admin.apps.approved.list` / `admin.apps.requests.list`, or `app_installed` events.

**54. Guest & ex-employee account review** `sched`
Single- and multi-channel guests, external members, deactivated-in-HR-but-active-in-Slack accounts.
*How:* `users.list` × HRIS roster diff.

**55. High-risk channel policy** `sched`
Channels matching `#hiring`, `#people`, `#legal`, `#incidents` get tighter retention rules and a named owner.

**56. Slack as the compliance action surface** `live`
DSAR assignments, DPIA sign-offs, access-review attestations, training nudges, vendor DPA approvals as interactive Slack messages.
*Why:* Compliance work fails because it lives in a tool nobody opens. This is a **retention lever** more than a compliance feature.
*How:* Block Kit + interactivity endpoint → existing task/notification queue.

---

## 5. Cloud & infrastructure (AWS / GCP / Azure)

**57. Data residency map** `sched`
Every data-holding resource by region: S3, RDS, DynamoDB, EBS snapshots, Lambda, OpenSearch, Redshift.
*Why:* Answers "where is personal data physically stored" with evidence — the exact question every TIA and enterprise security questionnaire opens with.
*How:* Per-region `describe*` / Resource Groups Tagging API / AWS Config aggregator. Non-EEA regions auto-raise a TIA task.

**58. Production schema → data dictionary** `sched`
Reads column names and types from prod databases; generates the categories-of-personal-data inventory per system.
*Why:* The most authoritative possible ROPA input, taken from the source of truth.
*How:* Glue Data Catalog, or read-only `information_schema.columns`. **Names and types only — never values.**

**59. Schema drift alert** `live`
A new `date_of_birth` column ships to prod → ROPA task, DPIA screening question, and a note to the engineer who shipped it.
*Why:* Ties compliance to the release cycle and makes the DPO look prescient.
*How:* Nightly catalog diff, or CloudTrail on DDL / migration-file parsing in the repo.

**60. Public bucket + PII correlation** `live`
Public or over-permissive S3 buckets weighted by whether they actually hold personal data.
*How:* S3 `GetPublicAccessBlock` / `GetBucketPolicyStatus` + IAM Access Analyzer + Macie findings.

**61. Verified Article 32 technical measures** `sched`
Auto-generates the security-measures section of each ROPA entry from observed reality: KMS encryption at rest, TLS policies, MFA enforcement, backup config, access controls.
*Why:* Turns the most hand-waved ROPA field into audit-grade evidence with timestamps. Enormous upgrade to the evidence pack export.
*How:* KMS, RDS `StorageEncrypted`, ELB TLS policies, IAM credential report, AWS Config rules.

**62. Retention reality check** `sched`
S3 lifecycle rules, snapshot schedules, and log-group retention vs declared retention.
*Why:* "We delete after 12 months" is false at almost every company because snapshots keep everything forever.
*How:* `GetBucketLifecycleConfiguration`, `describeDBSnapshots`, CloudWatch Logs `retentionInDays`.

**63. Backup-lag erasure documentation** `sched`
Computes and documents how long erased data persists in backups, producing the standard Art 17 justification with real numbers.
*Why:* Every DSAR erasure response needs this sentence and nobody has the actual figure.

**64. IAM access review** `sched`
Who can reach production personal data, key age, MFA status, unused privileges — as a recurring attestation campaign.
*How:* IAM credential report + Access Advisor last-used data.

**65. CloudTrail anomaly → pre-filled incident** `live`
Public snapshot sharing, mass `GetObject`, sudden role assumption from a new region.

**66. New service/region spin-up alert** `live`
Engineering launched a database in `us-east-1` on Tuesday → transfer assessment and ROPA task on Wednesday.
*How:* AWS Config / CloudTrail `Create*` events, or Cost Explorer new-service detection (works even with narrow permissions).

**67. Infra-derived sub-processor discovery** `sched`
SES, Twilio, Datadog agents, Sentry DSNs, third-party endpoints in security groups → unregistered vendors.

**68. Log retention audit** `sched`
Log groups with never-expire retention containing IPs, emails, or user IDs. Logs are personal data and are almost always missing from the ROPA.

**69. Prod data in non-prod** `scan`
Same PII patterns detected in staging/dev accounts. Universal, universally undeclared, and a favourite auditor question.

**70. Macie/DLP findings → ROPA mapping** `sched`
Route native sensitive-data findings into the correct processing activity rather than a security backlog nobody reads.

---

## 6. HR systems (BambooHR, Personio, HiBob, Workday, Rippling)

**71. Leaver access revocation verification** `live`
Termination date in the HRIS vs still-active accounts in Google, Slack, AWS, HubSpot — with days-since-exit.
*Why:* **The most auditable Art 32 control that exists**, a certain finding at most companies, and it needs every connector already built. Strongest candidate for first build.
*How:* HRIS employment status × each provider's user directory, diffed nightly. Write-back: suspend/deprovision on approval.

**72. Employee record retention clock** `sched`
Ex-employee records past country-specific statutory retention → deletion tasks with the correct legal citation per jurisdiction.

**73. Candidate/ATS purge automation** `sched`
Rejected candidates past 6/12 months, with per-country rules and consent-extension handling.
*Why:* Heavily enforced in DE/FR/ES and completely unmanaged at most SMEs.

**74. HRIS → training auto-enrolment** `live`
New hire appears → enrolled in the LMS with a 30-day deadline; role change → role-specific module; leaver → removed.
*Why:* Closes the loop on a module already built, with zero admin effort. Cheap, immediate value.

**75. Privacy notice acknowledgement tracking** `sched`
Which employees have acknowledged the current notice version, with re-acknowledgement on updates.

**76. Article 9 employee data register** `sched`
Sickness records, disability accommodations, union membership, background-check fields → Art 9 register with lawful basis per field.
*How:* HRIS custom-field metadata (names only).

**77. ROPA ownership auto-reassignment** `live`
When a ROPA owner leaves, reassign to their manager from the org chart instead of leaving it orphaned.

**78. Employee monitoring detection** `sched`
Time tracking, productivity tools, GPS in field apps → works council / Art 88 obligations and DPIA triggers.

**79. Intra-group transfer map** `sched`
EU employees in a global HRIS with non-EU HQ access → intra-group transfer documentation and SCC coverage check.

**80. Headcount-driven obligation triggers** `sched`
Crossing 250 employees changes Art 30 exemptions; certain processing at scale triggers mandatory DPO appointment. Alert *before* the threshold.

---

## 7. Identity & SSO (Okta, Entra ID, Google Admin)

**81. Unified shadow-IT register** `sched`
Every SaaS app any employee touches, merged from SSO catalogs, OAuth grants, and expense data, with DPA status and risk score.
*Why:* This *is* the vendor register, built from evidence. Combine with #8 and #93.

**82. First-seen app alert** `live`
New app + drafted DPA request + risk score, same day.

**83. Privileged access recertification** `sched`
Recurring campaigns for admin roles across all connected systems, with signed evidence.

**84. Dormant app/account cleanup** `sched`
Apps with grants but no logins in 90 days — reduces attack surface and vendor count simultaneously.

**85. MFA / conditional access attestation** `sched`
Continuous evidence for the Art 32 control everyone claims and few can prove.

---

## 8. Support, ticketing & engineering tools

**86. DSAR detection in support inboxes** `live`
A customer writing "please delete my account and everything you know about me" to Intercom or Zendesk is a legal DSAR with a 30-day clock — and nobody logs it. Auto-detects, opens the DSAR, starts the timer.
*Why:* **Arguably the highest-value item in this document.** Missed-deadline DSARs are the #1 source of GDPR complaints to supervisory authorities. This catches the ones that never reach the DPO.
*How:* Zendesk/Intercom webhooks → intent classifier → existing DSAR intake. Post back as an internal ticket note so the agent knows.

**87. PII in tickets and attachments** `live`
Agents pasting card numbers, ID scans, medical details into tickets.

**88. Ticket retention enforcement** `sched`
Support tickets are personal data with a retention obligation everyone forgets.

**89. Privacy-by-design gate in Jira/Linear** `live`
Issues mentioning tracking, new data fields, analytics, or profiling get a DPIA screening questionnaire auto-attached.
*Why:* Art 25 in practice, at design time, without the DPO reading every ticket.
*How:* Webhook on issue create → keyword/LLM screen → comment with screening form link.

**90. GitHub: tracking-SDK drift** `live`
A new analytics or session-replay dependency appears in `package.json` → alerts that the cookie policy and consent categories may now be wrong.
*Why:* Cookie notices go stale silently the moment engineering adds a script. Ties directly to the consent module.
*How:* PR webhook → dependency diff against a known-tracker list.

**91. Real personal data in repos** `scan`
CSV fixtures, seed files, `.env` samples containing production personal data.

**92. Privacy-relevant code change digest** `sched`
Weekly summary of merged changes touching data models, exports, third-party SDKs, or retention logic.

---

## 9. Finance & billing

**93. Spend-based vendor discovery** `sched`
SaaS charges in Stripe / Xero / QuickBooks / Sage not present in the vendor register.
*Why:* Finance always knows about vendors before the DPO does. Cross-check with #8 and #81 for near-complete coverage.
*How:* Transaction descriptors matched against a SaaS-merchant dictionary — the `vendors.json` pipeline already exists to enrich against.

**94. Payment data scope check** `sched`
Whether card data, billing addresses, or tax IDs touch customer systems vs staying with the PSP — the answer defines a whole ROPA entry.

---

## 10. Vertical-specific tools

Onboarding (`apps/web/src/components/onboarding/toolIcons.tsx`) already asks customers to self-declare ~45 tools across distinct verticals. Two consequences:

1. **The declared half of shadow-IT reconciliation already exists.** Ideas #8 / #81 / #93 get cheaper — diff *declared at onboarding* against *observed via Google OAuth grants* and surface "6 tools you never told us about, 3 you declared with no activity." A demoable drift report from one existing connector plus data already collected.
2. **The vertical mix changes which ideas matter.** Health-practice customers process Art 9 data as their core business; ATS customers live or die on candidate retention.

**95. ATS: consent-to-retain renewal** `sched` — Greenhouse / Lever / Workable / Bullhorn
Candidates whose retention consent is expiring get an automated renewal request; non-responders are purged.
*Why:* The lawful, defensible version of "we keep good CVs on file", which is otherwise unlawful retention.
*How:* Candidate `created_at` + rejection status via ATS API → templated renewal → purge on no-response.

**96. ATS: automated screening + scorecard exposure** `sched`
Flags knock-out questions and ranking algorithms as Art 22 automated decision-making; surfaces that interview scorecards and rejection notes are disclosable in a DSAR.
*Why:* Rejected candidates are the most litigious DSAR population, and interviewer free-text is where discriminatory or Art 9 content hides.

**97. Legal practice: matter-close retention clock** `sched` — Clio / MyCase / PracticePanther
Retention runs from *matter close*, not record creation; maps privilege carve-outs to DSAR responses.
*Why:* Law firms are a target vertical with retention rules no generic tool models correctly.

**98. Health: Art 9 default posture** `sched` — Doctolib / Healthie / DrChrono
Auto-applies the Art 9 posture: mandatory DPIA, mandatory DPO, national derogations under Art 9(4), which vary by member state.
*Why:* For these customers Art 9 isn't an edge case, it's every record. Getting it right is the whole sale.

**99. Health: statutory retention overrides erasure** `live`
Erasure requests against patient records are blocked and answered with the correct national minimum-retention citation (DE 10y, FR 20y, etc.).
*Why:* Wrongly honouring an erasure request here is a regulatory breach in the *other* direction.

**100. Ecommerce: order-vs-marketing retention split** `sched` — Shopify / WooCommerce / BigCommerce
Order records are held under tax law (up to 10y in DE); marketing profiles are not. Splits the two so erasure honours one without breaking the other.
*Why:* The single most common ecommerce DSAR mistake — deleting an order that tax law required keeping, or keeping a marketing profile that had no basis.

**101. Ecommerce: storefront app inventory** `sched`
Every installed Shopify/WooCommerce app receiving order and customer data is a processor.
*How:* Shopify Admin API installed-apps listing → auto vendor records → DPA chase.

**102. Ecommerce: abandoned-cart & profiling LIA** `sched`
Detects abandoned-cart flows, retargeting, and recommendation profiling → generates the Legitimate Interest Assessment each one needs.

**103. Payments: fraud scoring as Art 22** `sched` — Stripe Radar / Adyen / Klarna
Automated fraud blocking is an automated decision with legal effect; requires notice, a human-review route, and a DPIA.
*Why:* Universally deployed, universally undocumented.

**104. Sentry / Vercel: PII in error payloads** `live`
Stack traces, request bodies, and breadcrumbs carrying emails, tokens, and user records into a US-hosted error tracker; audits the scrubbing config.
*Why:* Extremely common, completely unmanaged, and an undeclared US transfer of production personal data. Great "you had no idea" demo.
*How:* Sentry API — project data-scrubbing settings, `beforeSend` presence, sampled event field names.

**105. Zoom: recording consent & transcript retention** `sched`
Recordings and AI-generated transcripts are personal data; checks consent-to-record settings and retention on the recording store.

**106. Notion / Dropbox / Figma / Canva: shadow databases and live data in mockups** `scan`
Notion databases used as unofficial CRMs and HR trackers; real customer records pasted into design files.
*Why:* Designers using production data in mockups is near-universal and never appears in any ROPA.

**107. Meta pixel & custom audiences** `sched`
Detects Meta pixel / Conversions API deployment and customer-list audience uploads.
*Why:* The precise practice EU DPAs have repeatedly ruled on, and audience uploads make the customer a joint controller with Meta.

---

## 11. Cross-platform — where the real product is

**108. ROPA drift engine** `sched`
Continuously diffs declared ROPA against observed reality across all connectors; opens a task per divergence: undeclared system, new data category, changed retention, new recipient, new region.
*Why:* **The flagship.** ROPA is a document everyone writes once and abandons. A ROPA that maintains itself and tells you when it's wrong is a fundamentally different product — and only buildable with connectors already in place.

**109. Live data map / subject lineage graph** `sched`
Which systems hold which categories, for which subject types, flowing where — a maintained diagram, not a slide someone drew in 2023.
*Why:* Every audit, DPIA, and enterprise security questionnaire opens with this and nobody has a current one.

**110. Evidence-backed compliance score** `sched`
Replace (or dual-track) self-assessment scoring with observed telemetry: encryption verified, leaver revocation at 94%, 12 externally shared PII files open, 3 vendors without DPAs.
*Why:* Defensible to an auditor instead of a self-graded quiz — and it moves on its own, which drives weekly logins.

**111. Unified breach radar** `live`
Correlates Google Alert Center, CloudTrail anomalies, Slack chatter, support tickets, and mass-export events into a single incident with a running 72-hour countdown and pre-collected evidence.
*Why:* Turns the breach module from a form into a detector.

**112. Erasure orchestration + verification** `live`
Executes erasure across every connected system, re-verifies at 7/30/90 days, produces a signed completion certificate.
*Why:* Most tools stop at "here's where the data is." Doing it and proving it is the harder, more valuable half.

**113. Cross-system retention orchestration** `sched`
One retention schedule enforced everywhere, with per-system dry-run → approve → execute → evidence.

**114. Continuous audit evidence collection** `sched`
Every check result stored immutably with timestamp and hash chain, so the evidence pack is *generated* from a year of observations rather than assembled the week before the audit.

**115. Transfer map + auto-TIA queue** `sched`
Every observed data location — AWS regions, SaaS vendor jurisdictions, sub-processor countries, workforce access geography — with TIAs auto-queued for non-adequate destinations.

**116. AI tool usage detection** `live`
Detects LLM tools across OAuth grants, Slack apps, browser extension policies, expense data, and code dependencies → AI register with GDPR and EU AI Act obligations attached.
*Why:* Employees are pasting customer data into AI tools right now and no DPO has an inventory. Given AI Act timelines this is the most urgent *new* compliance surface, and a natural companion to the existing AI copilot.

**117. Policy rules engine / guardrails** `live`
A rule DSL over all connector signals: *"if a Drive file containing personal data is shared externally, notify the owner, auto-revoke after 7 days unless justified."*
*Why:* Converts a monitoring product into an enforcement product — a step change in defensibility and pricing power.

**118. Monthly synthetic DSAR drill** `sched`
Fires a test DSAR through the full pipeline against a seeded identity, measures time-to-complete and coverage, files the result as evidence.
*Why:* Art 12 requires being *able* to respond. Proving the mechanism works monthly is evidence nobody else generates.

**119. "What changed this week" DPO digest** `sched`
One email/Slack summary: new vendors, new data categories, new external shares, expiring DPAs, overdue DSARs, drift items.
*Why:* Cheap to build and probably the best weekly-active-user driver in this document.

**120. Data subject rights coverage matrix** `sched`
Per system: can you actually export, rectify, erase, restrict, port? Which are manual, which automated, which impossible?
*Why:* Exposes the gap between what the privacy notice promises and what the stack can do.

**121. Anonymised cross-customer benchmarking** `sched`
"Your leaver revocation lag is 11 days; median for 50-200 employee SaaS is 2."
*Why:* Only possible once observed data exists across a customer base — a defensible long-term moat.

---

## 12. Write-access tier (enforcement upsell)

Revoke Drive shares · suspend leaver accounts · delete/trash expired files · apply classification labels · quarantine to a restricted drive · execute CRM deletions and suppressions · set Slack channel retention · remove OAuth grants · open Jira tickets · post Slack approvals · update HubSpot subscription status.

**Non-negotiable pattern for all of them:** dry-run → human approval → execute → logged evidence. Price the tier separately.

---

## 13. Consent module reconciliation — the tightest loop available

**This section supersedes the earlier framing of #46 and #107.** Those described tracker detection as a *new* capability feeding consent. It isn't new — it already exists, twice, and the two halves have never been introduced to each other.

Both scanners are Puppeteer page loads of the same customer domain, both living in `apps/api/src/lib/browserPool.ts`:

| Scanner | Output | Lands in | Module |
|---|---|---|---|
| `scanDomain()` via `cmp.ts` `cookie-scanner` | cookies → `classifyCookie()` | `consentCookies` (`category`, `provider`, `autoClassified`) | Cookie consent |
| `scanDomainForThirdParties()` via `vendors.ts` `vendor-discovery` | intercepted network requests → third-party domains | `vendorDiscoveries` | Vendor intelligence |

The Meta pixel does **not** need a code-dependency scan to be detected. `scanDomainForThirdParties` already observes `connect.facebook.net` and `facebook.com/tr` on every vendor-discovery run — it routes that into vendor discovery and silently drops the consent implication. The join is a new evaluator over two tables that already exist and are already populated. No new integration, no new OAuth scope, no new customer consent.

Two facts that make the join cheap:
- `consentDomains.categories` (`schema.ts:1033`) is a JSONB array defaulting to `['necessary','analytics','marketing','functional']`. "Does the banner have a Marketing category?" is an array-membership test on a column that already exists.
- `classifyCookie` (`cmp.ts:24-30`) knows exactly **11 cookie prefixes**. Everything else becomes `category: 'uncategorized'`, `provider: 'Unknown'`, `confidence: 0.00`. The network-domain scan holds precisely the evidence needed to classify most of the remainder — and, run the other way, to catch trackers that set no cookie at all (server-side CAPI, fingerprinting pixels) and therefore never appear in the cookie table at all.

**122. Tracker → consent category coverage gap** `sched`
For every third-party domain observed on the site, resolve tracker identity → required consent category, then assert `consentDomains.categories` contains it. Flag "Meta pixel detected; banner has no Marketing category."
*Why:* A banner that doesn't name the category a live tracker belongs to cannot have collected valid consent for it. Directly actionable, unambiguous, and impossible to dispute.
*How:* Extend `findMatchedVendor` (`vendors.ts:774`) with a `consentCategory` field, sourced from the same `vendors.json` pipeline. One evaluator joining `vendorDiscoveries` × `consentDomains.categories`.

**123. Prior-consent enforcement test** `sched` — *the flagship*
Load the page **twice in one session**: once with no consent cookie, once with consent granted. Diff the network requests and cookies. Anything firing in pass 1 that belongs to a non-necessary category is a prior-consent failure under ePrivacy Art 5(3).
*Why:* This is the actual enforcement pattern across EU DPAs, and it's the difference between *having* a banner and the banner *working*. A Marketing category that doesn't gate the pixel is documented non-compliance — strictly worse than no banner, because it proves the customer knew the category existed.
*How:* `scanDomainForThirdParties` already intercepts requests; it needs a second pass with the consent cookie pre-seeded and a diff. Maybe 60 lines on top of what's there.
*Caveat — do not ship without this:* under Google Consent Mode v2 and Meta's equivalent, tags legitimately *load* pre-consent and transmit a denied signal (`gcs=G100`) rather than identifiers. "Request fired before consent" is therefore **not** proof of violation on its own. The check must distinguish a request carrying identifiers/cookies from one carrying a denial signal, or it will generate confident false positives at exactly the customers who did the work properly.

**124. Cookie classification backfill from network evidence** `sched`
Use observed tracker domains to classify the `uncategorized` cookie rows, and flag cookies with no matching network origin (and vice versa).
*Why:* Turns an 11-entry hardcoded lookup into a self-improving classifier, and every `uncategorized` cookie on a live banner is an unlawful-processing risk sitting in the customer's own dashboard.

**125. Consent Mode / TCF gap check** `sched`
Meta pixel or Google Ads present while `consentDomains.gcmV2Enabled` is false (`schema.ts:1034`), or IAB vendors present while `tcfEnabled` is false.
*Why:* Both flags already exist on the table and nothing currently validates them against reality.

**Why this is the strongest starting point in the document:** it is the only idea here that needs *zero* new integrations, uses two modules that already ship, runs on infrastructure that already exists, and produces a finding no competitor closes automatically. It is also the cheapest possible pilot for the evaluator layer (specced in `custodia-complete-memory(1).md` §35) — if the signal/evaluator split is wrong, this is where it becomes obvious, for the price of one worker.

---

## Priorities

**Build first: #122 + #123 — consent/tracker reconciliation.** It is the only item here that ships on existing modules, existing infrastructure, and zero new integrations. See §13 for why, and the build spec below.

Then, in order:

| # | Idea | Why it's next |
|---|---|---|
| **71** | Leaver access revocation | Uses every connector, certain finding at every customer, demos in 30 seconds |
| **86** | DSAR detection in support inboxes | Prevents the failure mode that generates actual regulatory complaints |
| **8 + 81** | OAuth/SSO vendor discovery | Makes the existing vendor module self-populating; `vendors.json` already exists to enrich against |
| **25 + 58** | Property/schema → data dictionary | Makes the existing ROPA module self-populating; kills the most expensive manual step in GDPR consulting |
| **47** | Slack breach chatter | Nothing on the market does it; most memorable thing in a sales demo |

All of them tell one story: **Custodia is the only GDPR tool that checks whether what you wrote down is true.** #108 (ROPA drift engine) is where that lands as a headline feature once signal collection exists.

### Hard prerequisite for everything above

The pg-boss job layer cannot currently run any of it. `createQueue().add(jobName, …)` discards `jobName` (`apps/api/src/lib/queue.ts:21-32`), so every worker that branches on `job.name` — including `cookie-scanner` and `vendor-discovery`, the two this build depends on — never matches. There is also no `boss.schedule()` anywhere and no worker service in `render.yaml`. Fixing that is step 1 of the first feature, not a separate project. Full detail in `custodia-complete-memory(1).md` §35.

**Build the signal-collection architecture before the second feature, not after the fifth.**
