import { db } from '../db.js';
import * as schema from '../db.js';
import { eq, or, and, lt, gt, desc, asc, inArray } from 'drizzle-orm';

export type PaginationParams = {
  limit?: number;
  after?: string;
  before?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    has_more: boolean;
    next_cursor: string | null;
    previous_cursor: string | null;
  };
};

export function encodeCursor(sortValue: string | Date, id: string): string {
  const s = sortValue instanceof Date ? sortValue.toISOString() : sortValue;
  const payload = JSON.stringify({ s, i: id });
  return Buffer.from(payload).toString('base64url');
}

export function decodeCursor(cursor: string): { sortValue: string; id: string } {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  return { sortValue: payload.s, id: payload.i };
}

export async function paginatedQuery<T>(
  table: any,
  orgId: string | string[],
  params: PaginationParams,
  sortField: string = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc',
  additionalWhere?: any[]
): Promise<PaginatedResponse<T>> {
  const limit = Math.min(params.limit || 25, 100);

  let whereConditions: any[] = [
    Array.isArray(orgId) ? inArray(table.organizationId, orgId) : eq(table.organizationId, orgId)
  ];
  if (additionalWhere) whereConditions.push(...additionalWhere);

  if (params.after) {
    try {
      const cursor = decodeCursor(params.after);
      const cursorDate = new Date(cursor.sortValue);
      const isDate = !isNaN(cursorDate.getTime());
      const val = isDate ? cursorDate : cursor.sortValue;

      if (sortOrder === 'desc') {
        whereConditions.push(
          or(
            lt(table[sortField], val),
            and(
              eq(table[sortField], val),
              lt(table.id, cursor.id)
            )
          )
        );
      } else {
        whereConditions.push(
          or(
            gt(table[sortField], val),
            and(
              eq(table[sortField], val),
              gt(table.id, cursor.id)
            )
          )
        );
      }
    } catch (e) {
      throw new Error('Invalid pagination cursor');
    }
  }

  const results = await db.select()
    .from(table)
    .where(and(...whereConditions))
    .orderBy(sortOrder === 'desc' ? desc(table[sortField]) : asc(table[sortField]))
    .limit(limit + 1) as T[];

  const hasMore = results.length > limit;
  const data = results.slice(0, limit);

  return {
    data,
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore
        ? encodeCursor((data[data.length - 1] as any)[sortField], (data[data.length - 1] as any).id)
        : null,
      previous_cursor: params.after
        ? encodeCursor((data[0] as any)[sortField], (data[0] as any).id)
        : null,
    },
  };
}
