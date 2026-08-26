# Vendor Intelligence Module — Sprint 3 Remediation & Build Report

**Date:** 26 August 2026  
**Scope:** Sprint 3 ("Months 5–8 — The Differentiators" & Audit Completion)  
**Authority:** `audit docs/vendor-intelligence-module-audit-final.md`  
**Verification Status:** `npm run check` **PASSED** (0 type errors, all 7 security/tenancy guards green, 221/221 domain assertions passed).

---

## 1. Executive Summary

Sprint 3 completes the transformation of Custodia's Vendor Intelligence module from a static catalogue into an enterprise-grade, regulator-ready compliance engine. While Sprint 1 made the register usable and Sprint 2 connected the intelligence pipeline, Sprint 3 delivers the statutory differentiators outlined in Part IV of the Vendor Intelligence Audit:

1. **Deep Article 28(3) DPA Clause Analyser (P-9 / D54):** Statutory analysis engine checking all eight mandatory clauses under GDPR Article 28(3)(a)–(h) with tri-state status (`present`, `weak`, `missing`), citation extraction, and quote substring verification that eliminates LLM hallucinations.
2. **Real-Time DPF Risk Engine Wiring (P-5):** Full integration of the EU–U.S. Data Privacy Framework registry into `calculateVendorRisk()`, evaluating `active`, `lapsed`, and `discontinued` statuses in the location factor.
3. **Article 30(1)(d) Recipient Register & Article 28 Dossier Generator:** RFC 4180 CSV export for supervisory authority registers and comprehensive Markdown compliance dossiers documenting contract terms, sub-processors, and transfer safeguards.
4. **Governance & Review Cadence Engine (D31):** Criticality-based review scheduling (`quarterly` for critical, `biannual` for high, `annual` for medium/low), attestation stamping, review status evaluation (`overdue`, `due_soon`, `scheduled`), and background reminder worker.
5. **Delegated Vendor Intake Workflow:** Multi-tenant request submission for department leads, review and approval routing for DPOs, auto-linking into the active register, and automated intelligence dispatch.
6. **Incident Blast Radius Triage & Category Intersection (D16):** Evaluation of security incidents against an organisation's specific `dataCategoriesShared`, computing affected scope and GDPR Article 33/34 notification triggers with documented negative rationales.
7. **Standard Article 28 DPA Generator:** Automated statutory DPA agreement builder covering all statutory obligations when onboarding processors without acceptable standard terms.
8. **Frontend UI & Full i18n Parity:** UI components for intake management, dossier/register downloads, review scheduling, and 100% string parity across English, German, and French.

---

## 2. Detailed Deliverables & Architectural Implementation

### 2.1 Database Schema & Migrations (`packages/db`)
- **Table `vendor_intake_requests`:** Created to manage delegated vendor requests across tenants. Includes fields for business purpose, categories of personal data, criticality, estimated data subjects, approval lifecycle (`pending_review`, `approved`, `rejected`, `more_info_requested`), review notes, and linkage to resulting catalogue/org-vendor rows.
- **Column `review_cadence`:** Added to `organization_vendors` (`quarterly`, `biannual`, `annual`) to govern automated re-attestation intervals.
- **Relations:** Defined `vendorIntakeRequestsRelations` linking to `organizations` and `users` (requester and reviewer).
- **Migration:** Generated clean Drizzle migration `packages/db/drizzle/0056_unusual_silver_sable.sql`. `drizzle-kit generate` reports 0 schema drift.

### 2.2 Deep Article 28(3) DPA Clause Analyser (`apps/api/src/lib/vendorDpaClauseAnalyzer.ts`)
- Implements `analyseDpaText(sourceText, sourceUrl)` evaluating:
  - `documentedInstructions` (Art. 28(3)(a))
  - `confidentiality` (Art. 28(3)(b))
  - `securityMeasures` (Art. 28(3)(c) / Art. 32)
  - `subProcessorRestrictions` (Art. 28(3)(d))
  - `dataSubjectRights` (Art. 28(3)(e))
  - `securityBreachDpia` (Art. 28(3)(f))
  - `deletionOnTermination` (Art. 28(3)(g))
  - `auditRights` (Art. 28(3)(h))
- **Anti-Hallucination Substring Verification (`verifyClauseExcerpt`):** Verifies that any extracted quote is a genuine normalised substring of the source text. Non-matching excerpts from LLM outputs are stripped, and confidence is capped at 40 in `verifyAndSanitizeDpaAnalysis`.

### 2.3 Real-Time DPF Risk Wiring (`apps/api/src/lib/vendorRisk.ts`)
- Added `dpfStatus` ('active' | 'lapsed' | 'discontinued' | 'none') and `dpfLapsedDate` to `VendorRiskInput`.
- Updated location factor scoring:
  - EU/EEA: 0/20 pts
  - US with active DPF certification: 5/20 pts (Adequate)
  - US with lapsed DPF certification: 20/20 pts with warning detail
  - Non-adequate third countries: 20/20 pts

### 2.4 Audit Pack & Article 30 Deliverables (`apps/api/src/lib/vendorAuditPack.ts`)
- **`buildArticle30RecipientCsv(recipients)`:** Generates RFC 4180 compliant CSV exports satisfying statutory GDPR Article 30(1)(d) recipient register requirements.
- **`buildArticle28DossierMarkdown(dossier)`:** Generates regulator-grade compliance dossiers detailing governance attributes, clause coverage tables, sub-processor chains, transfer mechanisms, and field-level evidence provenance.

### 2.5 Governance & Review Cadence Engine (`apps/api/src/lib/vendorGovernance.ts`)
- **`calculateNextReviewDate(fromDate, criticality, explicitCadence)`:** Derives scheduled review dates based on criticality (90 days for critical, 180 days for high, 365 days for annual).
- **`evaluateReviewStatus(nextReviewAt, now)`:** Evaluates whether a review is `overdue`, `due_soon` (≤ 14 days), or `scheduled`.
- **Worker Support (`apps/api/src/workers/vendors.ts`):** Added `vendor-review-reminder` job checking upcoming or overdue vendor reviews and queueing notifications to compliance officers.

### 2.6 Incident Intelligence & Blast Radius Triage (`apps/api/src/lib/vendorIncidentIntelligence.ts`)
- Implements `evaluateIncidentImpact` and `evaluateIncidentBlastRadius`.
- Computes intersection between incident affected categories and organisation shared categories.
- Detects Special Category exposure under GDPR Article 9 (health data, biometrics, etc.) and triggers Article 33/34 72-hour notification recommendations.
- Produces documented negative rationales for assessed incidents that do not affect the organisation.

### 2.7 Standard Statutory Article 28 DPA Generator (`apps/api/src/lib/vendorDpaTemplate.ts`)
- Implements `generateStandardArticle28Dpa(params)`.
- Generates legally binding, standard GDPR Article 28(3) contractual addenda complete with Controller/Processor definitions, processing purposes, data categories, and Schedules for security measures and sub-processors.

### 2.8 tRPC Routers & Tenancy Scoping
- **`vendorIntakeRouter` (`apps/api/src/routers/vendorIntake.ts`):** Mounted in `apps/api/src/router.ts`. Implements `list`, `getById`, `submit`, `approve`, `reject`, and `requestMoreInfo`. Every procedure is strictly tenant-scoped to `ctx.user!.orgId` using `assertOwned()`.
- **`vendorsRouter` extensions (`apps/api/src/routers/vendors.ts`):**
  - `exportArticle30Register`: Generates Article 30 CSV register.
  - `exportArticle28Dossier`: Generates Markdown Article 28 Compliance Dossier.
  - `generateDpaAgreement`: Generates standard Article 28 DPA agreement.
  - `scheduleReview`: Updates review cadence and calculates `nextReviewAt`.
  - `applyCatalogueDpaAnalysis`: Applies pre-analysed catalogue clauses to the organization vendor record.

### 2.9 Frontend Web UI (`apps/web`)
- **`VendorIntakeModal.tsx`:** Form modal allowing employees or managers to request new vendors with categories and justifications.
- **`VendorIntakeTab.tsx`:** Management tab in the Vendors dashboard for filtering, reviewing, approving, and rejecting intake requests.
- **Vendors Register Page (`page.tsx`):** Added Article 30 CSV export action and Intake Requests tab navigation.
- **Vendor Detail Page (`[id]/page.tsx`):** Added download actions for Article 28 Compliance Dossier and Standard DPA Agreement, and button to apply catalogue DPA analysis.

### 2.10 Internationalisation (i18n)
- Added 100% key parity across `apps/web/src/messages/en/vendors.json`, `de/vendors.json`, and `fr/vendors.json` for:
  - `intake.*` (30+ keys for intake forms, status badges, actions, and labels)
  - `review_cadence.*` (cadence intervals and attestation labels)
  - `deep_clause_analysis.*` (clause compliance scores and badges)
  - `export_article_30`, `export_article_28`, `generate_dpa`

---

## 3. Verification & Quality Gates

The entire Custodia verification pipeline was executed and passed with 0 errors:

```
> npm run check

> api@1.0.0 typecheck: tsc --noEmit (0 errors)
> web@0.1.0 typecheck: tsc --noEmit (0 errors)
> api@1.0.0 check:tenancy (227 procedures checked, all verified)
> api@1.0.0 check:relations (23 relational queries against 54 relations blocks verified)
> api@1.0.0 check:nocheck (0 @ts-nocheck found)
> web@0.1.0 check:nocheck (0 @ts-nocheck found)
> web@0.1.0 check:params (114 routes await params)
> web@0.1.0 check:sitemap (33 sitemap routes verified against 104 real routes)
> web@0.1.0 check:messages (3,722 keys across 20 namespaces in 3 locales agree)
> web@0.1.0 check:ropa-i18n (42 ROPA files against 1,568 message keys)
> web@0.1.0 check:vendor-i18n (22 Vendor Intelligence files against 768 message keys)
> api@1.0.0 test:fixtures (PASS)
> api@1.0.0 test:consent-cookies (PASS)
> api@1.0.0 test:transfers (PASS)
> api@1.0.0 test:ropa-completeness (PASS)
> api@1.0.0 test:ropa-vocab (PASS)
> api@1.0.0 test:ropa-lifecycle (PASS)
> api@1.0.0 test:assessments (PASS)
> api@1.0.0 test:ropa-exports (PASS)
> api@1.0.0 test:retention (PASS)
> api@1.0.0 test:ropa-intelligence (PASS)
> api@1.0.0 test:vendors (221/221 assertions passed)
```

---

## 4. Deployment Instructions

1. **Database Migration:**
   - Apply `packages/db/drizzle/0056_unusual_silver_sable.sql` on the target database:
     ```bash
     npm run migrate --workspace=packages/db
     ```
2. **Workers Scheduling:**
   - Ensure `vendor-review-reminder` is registered in `apps/api/src/workers/index.ts` (already scheduled for daily execution at `0 6 * * *`).
