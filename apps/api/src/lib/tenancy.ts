import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Tenant ownership checks.
//
// `requirePermission()` answers "may this user do this kind of thing". It says
// nothing about *whose* data they may do it to, and nothing in the stack adds an
// organisation predicate on its own. So every procedure that keys a query on an id
// supplied by the client has to prove ownership itself, and the ones that forgot
// were readable and writable across tenants.
//
// These helpers exist so that check is one line rather than a join the author has
// to get right each time — most of the affected tables carry no organization_id of
// their own and are only reachable through a parent.
// ---------------------------------------------------------------------------

/** A table to join through on the way to whatever holds `organization_id`. */
export type OwnershipHop = {
  table: any;
  /** Join predicate, e.g. eq(dpiaMeasures.dpiaRiskId, dpiaRisks.id). */
  on: any;
};

export type AssertOwnedOptions = {
  table: any;
  id: string;
  orgId: string;
  /** Shown in the error. Keep it generic — see the note on NOT_FOUND below. */
  label?: string;
  /**
   * Tables to join through when `table` has no organization_id. The organisation
   * predicate is applied to the **last** hop, so order matters: list them from the
   * child outwards.
   */
  via?: OwnershipHop[];
  /** Column holding the row's primary key, when it is not `table.id`. */
  idColumn?: any;
};

/**
 * Throws unless `id` resolves to a row belonging to `orgId`. Returns the row.
 *
 * Always NOT_FOUND, never FORBIDDEN: telling a caller "this exists but is not
 * yours" confirms the id is real, which is the one bit of information a caller
 * probing other tenants' ids does not already have.
 */
export async function assertOwned(db: any, opts: AssertOwnedOptions): Promise<any> {
  const { table, id, orgId, label = 'Record', via = [], idColumn } = opts;

  const owner = via.length > 0 ? via[via.length - 1]!.table : table;
  if (!owner.organizationId) {
    // A wiring mistake, not a user error: the chain does not end anywhere that
    // knows about organisations, so it cannot prove anything.
    throw new Error(
      `assertOwned: no organizationId on the final table for "${label}". Add a hop that reaches one.`
    );
  }

  let query = db.select({ row: table }).from(table);
  for (const hop of via) {
    query = query.innerJoin(hop.table, hop.on);
  }

  const [found] = await query.where(and(
    eq(idColumn ?? table.id, id),
    eq(owner.organizationId, orgId),
  ));

  if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: `${label} not found` });
  return found.row;
}

/**
 * Ownership check for a parent id the client supplied as a filter rather than as
 * the thing being edited — `list({ breachId })` and friends. Same guarantee, reads
 * better at the call site than `assertOwned` with the parent as the table.
 */
export async function assertParentOwned(
  db: any,
  table: any,
  id: string,
  orgId: string,
  label = 'Record'
): Promise<any> {
  return assertOwned(db, { table, id, orgId, label });
}
