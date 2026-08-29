/**
 * Global vendor catalogue seed — a pointer, since Sprint 9.
 *
 * All hardcoded and model-generated literals were purged before Sprint 5; this
 * file held an empty array and a message saying so. The catalogue is now seeded
 * by `apps/api/src/scripts/seed-catalogue.ts`, and it lives there rather than
 * here for Sprint 7's reason: it needs `dpfNameKey`, `dpfBaseNameKey` and
 * `matchDpfStatus` from `apps/api/src/lib`, where `test:vendors` can reach them.
 * The alternative was a second copy of the DPF name fold inside `packages/db`,
 * which is VD-7 exactly — a matching rule duplicated somewhere the fixtures
 * cannot see it.
 *
 * This file stays because the command is in runbooks and in the sourcing
 * programme, and a seed command that silently does nothing is worse than one
 * that has moved.
 */

/** Kept so anything importing this module still resolves. Deliberately empty. */
export const VERIFIED_GLOBAL_VENDORS: any[] = [];

console.log(`
The vendor catalogue seed moved in Sprint 9.

  npm run seed:catalogue --workspace=apps/api -- --dry-run   # see what it would write
  npm run seed:catalogue --workspace=apps/api                # write it

It is in apps/api because it resolves each vendor's legal entity against the
US Data Privacy Framework register, and that matcher lives there with its
fixtures. Seeding writes identity and ownership only; every field a risk score
reads comes from a source or stays absent.

VD-16 — the second command is not optional:

  npm run seed:catalogue      --workspace=apps/api
  npm run recalc:vendor-risk  --workspace=apps/api -- --apply

organization_vendors.risk_score is denormalised and written when a vendor is
linked. Nothing recomputes it when the catalogue row changes underneath, so
without the recalculation none of the seeding reaches a customer's register and
the "high risk vendors" tile stays exactly as it was.
`);

process.exit(0);
