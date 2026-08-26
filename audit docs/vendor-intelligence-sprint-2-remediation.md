# Vendor Intelligence — Sprint 2 Remediation & Pipeline Integration

**Scope:** Roadmap Items **P-1 through P-11** (Connect the Pipeline & Review Console)  
**Database Migrations:** `0054_ancient_christian_walker.sql`, `0055_wonderful_proudstar.sql`  
**Commit:** `4a7fb6c`  
**Reference:** [`vendor-intelligence-module-audit-final.md`](file:///c:/Users/nisar/Desktop/GDPR/audit%20docs/vendor-intelligence-module-audit-final.md) (Part IV: Weeks 7–16)

---

## 1. What Shipped in Sprint 2

Sprint 2 bridges the four previous disconnected islands into a single automated, evidence-grounded pipeline directly inside `apps/api` and `apps/web`:

1. **Unified Enrichment Service (P-1, P-8):** `apps/api/src/lib/vendorIntelligence.ts` implementing `enrich(name, domain)` for single vendors, queue-backed `enrichBatch(targets)` with cursor checkpoints, and `reverifyVendor(vendorId)` for freshness diffing, capturing Gemini `groundingMetadata`.
2. **Field-Level Provenance (P-2):** Table `vendor_field_provenance` (migration `0054`) tracking field-level confidence, source URL, evidence snippet, and source type (`ai_grounded`, `http_probe`, `registry`, `analyst`, `customer`).
3. **Candidate Staging & Admin Console (P-3):** Tables `vendor_candidates` and `vendor_intelligence_runs` with the Next.js review console at `/vendors/intelligence`, featuring side-by-side diffing, evidence inspection, pagination, and threshold-based bulk approval.
4. **Controlled Certifications Vocabulary (P-4):** `apps/api/src/constants/vendorCertifications.ts` with canonical mappings for SOC 1/2/3, ISO 27001/27701/22301, HIPAA, PCI-DSS, and FedRAMP.
5. **Automated DPF Registry Ingestion (P-5):** Table `dpf_registrations` and `apps/api/src/lib/vendorDpf.ts`, with background sync scheduled weekly (`17 3 * * 1`) to pull the official Trade.gov participant dataset.
6. **Diagnostic Probe Classification (P-6):** `apps/api/src/lib/vendorProbe.ts` distinguishing bot protection (403, Cloudflare, captcha) from genuine 404s and timeouts.
7. **Domain Normalisation & Confidence Weighting (P-7):** `apps/api/src/lib/vendorDomains.ts` and `vendorFieldConfidence.ts` recognizing parent corporate domains (e.g. NetSuite under Oracle) and trust centers as valid confirmations.
8. **Catalogue DPA Clause Storage (P-9):** Column `dpa_clause_analysis` on `vendors` (migration `0055`) storing extracted GDPR Article 28 clause coverage.
9. **Structured Sub-Processor Entities (P-10):** Table `vendor_sub_processor_entities` and `apps/api/src/lib/vendorSubProcessorEntities.ts` for entity-level extraction, parenthesised country parsing, and set diffing.
10. **Evaluation Benchmark Harness (P-11):** `apps/api/src/lib/vendorEval.ts` (`npm run eval:vendors`) evaluating precision, recall, and F1 per field against ground truth.

---

## 2. Sprint 2 Remediation & Fixes Applied

During the Sprint 2 review, three key architectural and testing fixes were implemented:

1. **Decoupled Pure Mapping & Diffing (`vendors.test.ts`):**
   - Extracted `buildCatalogueWrites`, `diffFreshAgainstCatalogue`, `normaliseCandidateDomain`, and `slugify` into `apps/api/src/lib/vendorIntelligenceMappers.ts`.
   - Prevented `vendors.test.ts` from dragging in `db.ts` (which throws when `DATABASE_URL` is unset), bringing `npm run test:vendors` to 185/185 green assertions in pure memory.
2. **Tenant Risk Recalculation on `bulkApprove`:**
   - In `apps/api/src/routers/vendorIntelligence.ts`, wrapped each candidate write in an atomic transaction and invoked `recalculateVendorRiskForAllOrgs(tx, vendorId)`.
   - Prevented denormalized risk scores on tenant registers from going stale when catalogue entries update in bulk.
3. **Admin Console Pagination & Ingestion Resilience:**
   - Added `offset` support to `listCandidates` and progressive "Load more" handling in the web console.
   - Wrapped `fetchDpfEntries()` in structured try/catch with diagnostic error logging.

---

## 3. Verification Matrix

```bash
npm run check
```
- **Typecheck:** 0 errors across `apps/api` and `apps/web`.
- **Tenancy Guard:** 219 procedures checked, 0 unproved client IDs.
- **Relations Guard:** 23 relational queries vs 53 relations blocks.
- **Messages Guard:** 3,661 keys in complete `en`/`de`/`fr` parity.
- **Schema Drift Guard:** Clean (`schema.ts` and migrations 0054/0055 agree).
- **Test Suites:** 11/11 passing (including 185 assertions in `test:vendors`).
