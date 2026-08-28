# `vendor-pipeline/` is retired

This standalone workspace was the first attempt at a vendor enrichment pipeline. Its
role was taken over in Sprint 2 by `apps/api/src/lib/vendorIntelligence.ts`, which
runs inside the API, writes into `vendor_candidates` for human review, and is covered
by fixtures. Nothing in the product has ever read anything this package produced.

It is kept for historical reference only. **Do not run it**, and do not import its
data files. Its six npm scripts pointed at `node dist/scripts/*.js`; `dist/` has never
existed, because the package is not a workspace member, its dependencies
(`node-fetch`, `sqlite3`, `diff`) are not installed, and `tsc` has never completed
here. The scripts now say so rather than failing with `Cannot find module`.

## What replaced each piece

| Here | Now |
|---|---|
| `registryPoller.ts` | `dpf-registry-import` job → `dpf_registrations`, matched on domain then folded name |
| `candidateExtractor.ts` | `vendorIntelligence.enrich()` / `enrichBatch()` → `vendor_candidates` |
| `linkSentinel.ts` | `lib/vendorProbe.ts` + `safeFetch`, with classified failures |
| `changeDetector.ts` | the `sub-processor-change-detector` worker |
| `diffRenderer.ts` | `lib/vendorSubProcessorEntities.ts` and the review console |
| `exportVendors.ts` | the admin review console at `/vendors/intelligence` |

## Two hazards, recorded so nobody reintroduces them

- **`registryPoller.ts` destroys correct data.** It claims to poll the US Department
  of Commerce DPF registry; it reads a 13-name hardcoded array, matches by
  bidirectional substring — so "Go" matches "google" — and overwrites
  `isDpfCertified` with the result for every record it does not know about. The
  replacement matches on domain first, then exact folded name, never substring, and
  there is a regression fixture for the "Go matches Google" case.
- **`vendors.json` is mostly fabricated.** 180 of its 200 records are procedurally
  generated (`/Service\d+$/`) with invented domains and DPA URLs beneath them, and
  **all 200 carry `analystVerifiedAt`** stamped at generation time. No analyst
  reviewed anything. Importing this file would flood the catalogue with fabricated
  vendors carrying a false human-verification attestation — which is precisely why
  the catalogue seed was reset to zero in `ad293b2`. The same applies to the copy at
  the repository root.
