import { sql } from 'drizzle-orm';
import { consentRecords, consentDomains, consentDailySummary } from 'db';
import { startOfDay, subDays } from 'date-fns';

const ROLLUP_THRESHOLD_DAYS = 7;

function getCutoffDate() {
  return startOfDay(subDays(new Date(), ROLLUP_THRESHOLD_DAYS));
}

/**
 * Gets opt-in rates over time per category.
 */
export async function getOptInRateOverTime(db: any, domainIds: string[], startDate: Date, endDate: Date) {
  if (domainIds.length === 0) return [];
  
  const cutoff = getCutoffDate();
  const results: any[] = [];

  if (startDate < cutoff) {
    const rollupEndDate = new Date(Math.min(endDate.getTime(), cutoff.getTime() - 1));
    const query = sql`
      SELECT 
        date,
        SUM(CASE WHEN category IS NULL AND category_combination IS NULL THEN total_sessions ELSE 0 END) as total_sessions,
        SUM(CASE WHEN category = 'analytics' THEN accepted_sessions ELSE 0 END) as analytics_accepted,
        SUM(CASE WHEN category = 'marketing' THEN accepted_sessions ELSE 0 END) as marketing_accepted,
        SUM(CASE WHEN category = 'functional' THEN accepted_sessions ELSE 0 END) as functional_accepted
      FROM ${consentDailySummary}
      WHERE domain_id IN (${sql.join(domainIds, sql`, `)})
        AND date >= ${startDate.toISOString()}
        AND date <= ${rollupEndDate.toISOString()}
      GROUP BY date
    `;
    const result = await db.execute(query);
    results.push(...result.rows.map((row: any) => ({
      date: new Date(row.date).toISOString(),
      totalSessions: Number(row.total_sessions),
      analyticsAccepted: Number(row.analytics_accepted),
      marketingAccepted: Number(row.marketing_accepted),
      functionalAccepted: Number(row.functional_accepted),
    })));
  }

  if (endDate >= cutoff) {
    const rawStartDate = new Date(Math.max(startDate.getTime(), cutoff.getTime()));
    const query = sql`
      SELECT 
        date_trunc('day', ${consentRecords.givenAt}) as date,
        COUNT(*) as total_sessions,
        SUM(CASE WHEN ${consentRecords.categoriesAccepted} ? 'analytics' THEN 1 ELSE 0 END) as analytics_accepted,
        SUM(CASE WHEN ${consentRecords.categoriesAccepted} ? 'marketing' THEN 1 ELSE 0 END) as marketing_accepted,
        SUM(CASE WHEN ${consentRecords.categoriesAccepted} ? 'functional' THEN 1 ELSE 0 END) as functional_accepted
      FROM ${consentRecords}
      WHERE ${consentRecords.domainId} IN (${sql.join(domainIds, sql`, `)})
        AND ${consentRecords.givenAt} >= ${rawStartDate.toISOString()}
        AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
      GROUP BY 1
    `;
    const result = await db.execute(query);
    results.push(...result.rows.map((row: any) => ({
      date: new Date(row.date).toISOString(),
      totalSessions: Number(row.total_sessions),
      analyticsAccepted: Number(row.analytics_accepted),
      marketingAccepted: Number(row.marketing_accepted),
      functionalAccepted: Number(row.functional_accepted),
    })));
  }

  results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return results;
}

/**
 * Gets the interaction breakdown: accept_all, reject_all, customized_with_acceptance, customized_all_rejected
 */
export async function getInteractionBreakdown(db: any, domainIds: string[], startDate: Date, endDate: Date) {
  if (domainIds.length === 0) return { acceptAll: 0, rejectAll: 0, customizedWithAcceptance: 0, customizedAllRejected: 0 };
  
  const cutoff = getCutoffDate();
  let acceptAll = 0, rejectAll = 0, customizedWithAcceptance = 0, customizedAllRejected = 0;

  if (startDate < cutoff) {
    const rollupEndDate = new Date(Math.min(endDate.getTime(), cutoff.getTime() - 1));
    const query = sql`
      SELECT 
        SUM(accept_all_count) as accept_all,
        SUM(reject_all_count) as reject_all,
        SUM(customized_with_acceptance_count) as customized_with_acceptance,
        SUM(customized_all_rejected_count) as customized_all_rejected
      FROM ${consentDailySummary}
      WHERE domain_id IN (${sql.join(domainIds, sql`, `)})
        AND date >= ${startDate.toISOString()}
        AND date <= ${rollupEndDate.toISOString()}
        AND category IS NULL AND category_combination IS NULL
    `;
    const result = await db.execute(query);
    if (result.rows.length > 0) {
      acceptAll += Number(result.rows[0].accept_all || 0);
      rejectAll += Number(result.rows[0].reject_all || 0);
      customizedWithAcceptance += Number(result.rows[0].customized_with_acceptance || 0);
      customizedAllRejected += Number(result.rows[0].customized_all_rejected || 0);
    }
  }

  if (endDate >= cutoff) {
    const rawStartDate = new Date(Math.max(startDate.getTime(), cutoff.getTime()));
    const query = sql`
      SELECT 
        ${consentRecords.interactionType} as interaction_type,
        CASE 
          WHEN ${consentRecords.interactionType} = 'customized' AND jsonb_array_length(${consentRecords.categoriesAccepted}) > 1 THEN 'customized_with_acceptance'
          WHEN ${consentRecords.interactionType} = 'customized' THEN 'customized_all_rejected'
          ELSE ${consentRecords.interactionType}
        END as detailed_interaction,
        COUNT(*) as count
      FROM ${consentRecords}
      WHERE ${consentRecords.domainId} IN (${sql.join(domainIds, sql`, `)})
        AND ${consentRecords.givenAt} >= ${rawStartDate.toISOString()}
        AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
      GROUP BY 1, 2
    `;
    const result = await db.execute(query);
    for (const row of result.rows) {
      const count = Number(row.count);
      if (row.detailed_interaction === 'accept_all') acceptAll += count;
      else if (row.detailed_interaction === 'reject_all') rejectAll += count;
      else if (row.detailed_interaction === 'customized_with_acceptance') customizedWithAcceptance += count;
      else if (row.detailed_interaction === 'customized_all_rejected') customizedAllRejected += count;
    }
  }

  return { acceptAll, rejectAll, customizedWithAcceptance, customizedAllRejected };
}

/**
 * Breaks down metrics by domain.
 */
export async function getDomainBreakdown(db: any, domainIds: string[], startDate: Date, endDate: Date) {
  if (domainIds.length === 0) return [];
  
  const cutoff = getCutoffDate();
  const domainMap = new Map<string, { totalSessions: number, acceptAllCount: number }>();

  if (startDate < cutoff) {
    const rollupEndDate = new Date(Math.min(endDate.getTime(), cutoff.getTime() - 1));
    const query = sql`
      SELECT
        d.domain as domain_name,
        SUM(CASE WHEN category IS NULL AND category_combination IS NULL THEN total_sessions ELSE 0 END) as total_sessions,
        SUM(accept_all_count) as accept_all_count
      FROM ${consentDailySummary} r
      JOIN ${consentDomains} d ON r.domain_id = d.id
      WHERE r.domain_id IN (${sql.join(domainIds, sql`, `)})
        AND r.date >= ${startDate.toISOString()}
        AND r.date <= ${rollupEndDate.toISOString()}
        AND category IS NULL AND category_combination IS NULL
      GROUP BY d.domain
    `;
    const result = await db.execute(query);
    for (const row of result.rows) {
      domainMap.set(row.domain_name, {
        totalSessions: Number(row.total_sessions || 0),
        acceptAllCount: Number(row.accept_all_count || 0),
      });
    }
  }

  if (endDate >= cutoff) {
    const rawStartDate = new Date(Math.max(startDate.getTime(), cutoff.getTime()));
    const query = sql`
      SELECT
        d.domain as domain_name,
        COUNT(r.id) as total_sessions,
        SUM(CASE WHEN r.interaction_type = 'accept_all' THEN 1 ELSE 0 END) as accept_all_count
      FROM ${consentRecords} r
      JOIN ${consentDomains} d ON r.domain_id = d.id
      WHERE r.domain_id IN (${sql.join(domainIds, sql`, `)})
        AND r.given_at >= ${rawStartDate.toISOString()}
        AND r.given_at <= ${endDate.toISOString()}
      GROUP BY 1
    `;
    const result = await db.execute(query);
    for (const row of result.rows) {
      const existing = domainMap.get(row.domain_name) || { totalSessions: 0, acceptAllCount: 0 };
      domainMap.set(row.domain_name, {
        totalSessions: existing.totalSessions + Number(row.total_sessions || 0),
        acceptAllCount: existing.acceptAllCount + Number(row.accept_all_count || 0),
      });
    }
  }

  return Array.from(domainMap.entries()).map(([domainName, stats]) => ({
    domainName,
    ...stats
  }));
}

/**
 * Calculates which categories get rejected most.
 */
export async function getCategoryRejection(db: any, domainIds: string[], startDate: Date, endDate: Date) {
  if (domainIds.length === 0) return { analyticsRejected: 0, marketingRejected: 0, functionalRejected: 0 };
  
  const cutoff = getCutoffDate();
  let analyticsRejected = 0, marketingRejected = 0, functionalRejected = 0;

  if (startDate < cutoff) {
    const rollupEndDate = new Date(Math.min(endDate.getTime(), cutoff.getTime() - 1));
    const query = sql`
      SELECT 
        SUM(CASE WHEN category = 'analytics' THEN rejected_sessions ELSE 0 END) as analytics_rejected,
        SUM(CASE WHEN category = 'marketing' THEN rejected_sessions ELSE 0 END) as marketing_rejected,
        SUM(CASE WHEN category = 'functional' THEN rejected_sessions ELSE 0 END) as functional_rejected
      FROM ${consentDailySummary}
      WHERE domain_id IN (${sql.join(domainIds, sql`, `)})
        AND date >= ${startDate.toISOString()}
        AND date <= ${rollupEndDate.toISOString()}
        AND category IS NOT NULL
    `;
    const result = await db.execute(query);
    if (result.rows.length > 0) {
      analyticsRejected += Number(result.rows[0].analytics_rejected || 0);
      marketingRejected += Number(result.rows[0].marketing_rejected || 0);
      functionalRejected += Number(result.rows[0].functional_rejected || 0);
    }
  }

  if (endDate >= cutoff) {
    const rawStartDate = new Date(Math.max(startDate.getTime(), cutoff.getTime()));
    const query = sql`
      SELECT 
        SUM(CASE WHEN ${consentRecords.categoriesRejected} ? 'analytics' THEN 1 ELSE 0 END) as analytics_rejected,
        SUM(CASE WHEN ${consentRecords.categoriesRejected} ? 'marketing' THEN 1 ELSE 0 END) as marketing_rejected,
        SUM(CASE WHEN ${consentRecords.categoriesRejected} ? 'functional' THEN 1 ELSE 0 END) as functional_rejected
      FROM ${consentRecords}
      WHERE ${consentRecords.domainId} IN (${sql.join(domainIds, sql`, `)})
        AND ${consentRecords.givenAt} >= ${rawStartDate.toISOString()}
        AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
    `;
    const result = await db.execute(query);
    if (result.rows.length > 0) {
      analyticsRejected += Number(result.rows[0].analytics_rejected || 0);
      marketingRejected += Number(result.rows[0].marketing_rejected || 0);
      functionalRejected += Number(result.rows[0].functional_rejected || 0);
    }
  }

  return { analyticsRejected, marketingRejected, functionalRejected };
}

/**
 * Calculates withdrawal metrics (volume, relative proxy, and time-to-withdrawal within window).
 * This does not use rollup since withdrawals are low volume and need precise self-join matching.
 */
export async function getWithdrawalMetrics(db: any, domainIds: string[], startDate: Date, endDate: Date) {
  if (domainIds.length === 0) return { withdrawalTrend: [], withdrawalVolume: 0, relativeVolumePercent: 0, avgTimeToWithdrawalHours: null };

  const trendQuery = sql`
    SELECT 
      date_trunc('day', ${consentRecords.givenAt}) as date,
      COUNT(*) as withdrawals
    FROM ${consentRecords}
    WHERE ${consentRecords.domainId} IN (${sql.join(domainIds, sql`, `)})
      AND ${consentRecords.eventType} = 'withdrawal'
      AND ${consentRecords.givenAt} >= ${startDate.toISOString()}
      AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
    GROUP BY 1
    ORDER BY 1
  `;
  const trendResult = await db.execute(trendQuery);
  const withdrawalTrend = trendResult.rows.map((row: any) => ({
    date: new Date(row.date).toISOString(),
    withdrawals: Number(row.withdrawals)
  }));

  const volumeQuery = sql`
    SELECT
      SUM(CASE WHEN ${consentRecords.eventType} = 'withdrawal' THEN 1 ELSE 0 END) as withdrawals,
      SUM(CASE WHEN ${consentRecords.eventType} = 'initial' AND jsonb_array_length(${consentRecords.categoriesAccepted}) > 1 THEN 1 ELSE 0 END) as initial_acceptances
    FROM ${consentRecords}
    WHERE ${consentRecords.domainId} IN (${sql.join(domainIds, sql`, `)})
      AND ${consentRecords.givenAt} >= ${startDate.toISOString()}
      AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
  `;
  const volumeResult = await db.execute(volumeQuery);
  const withdrawals = Number(volumeResult.rows[0].withdrawals || 0);
  const initialAcceptances = Number(volumeResult.rows[0].initial_acceptances || 0);
  const relativeVolumePercent = initialAcceptances > 0 ? Math.round((withdrawals / initialAcceptances) * 100) : 0;

  const timeQuery = sql`
    SELECT AVG(EXTRACT(EPOCH FROM (w.given_at - i.given_at)) / 3600) as avg_hours
    FROM ${consentRecords} w
    JOIN ${consentRecords} i ON w.consent_id = i.consent_id
    WHERE w.domain_id IN (${sql.join(domainIds, sql`, `)})
      AND w.event_type = 'withdrawal'
      AND i.event_type = 'initial'
      AND w.given_at >= ${startDate.toISOString()}
      AND w.given_at <= ${endDate.toISOString()}
      AND i.given_at >= ${startDate.toISOString()}
      AND i.given_at <= ${endDate.toISOString()}
  `;
  const timeResult = await db.execute(timeQuery);
  const avgTimeToWithdrawalHours = timeResult.rows[0].avg_hours ? Number(timeResult.rows[0].avg_hours) : null;

  return {
    withdrawalTrend,
    withdrawalVolume: withdrawals,
    relativeVolumePercent,
    avgTimeToWithdrawalHours
  };
}

export async function getGranularCategoryDistribution(db: any, domainIds: string[], startDate: Date, endDate: Date) {
  if (domainIds.length === 0) return [];
  
  const cutoff = getCutoffDate();
  const combinationMap = new Map<string, number>();

  if (startDate < cutoff) {
    const rollupEndDate = new Date(Math.min(endDate.getTime(), cutoff.getTime() - 1));
    const query = sql`
      SELECT 
        category_combination,
        SUM(category_combination_count) as session_count
      FROM ${consentDailySummary}
      WHERE domain_id IN (${sql.join(domainIds, sql`, `)})
        AND date >= ${startDate.toISOString()}
        AND date <= ${rollupEndDate.toISOString()}
        AND category_combination IS NOT NULL
      GROUP BY category_combination
    `;
    const result = await db.execute(query);
    for (const row of result.rows) {
      combinationMap.set(row.category_combination, Number(row.session_count || 0));
    }
  }

  if (endDate >= cutoff) {
    const rawStartDate = new Date(Math.max(startDate.getTime(), cutoff.getTime()));
    const query = sql`
      SELECT
        canonicalize_category_array(${consentRecords.categoriesAccepted}) AS category_combination,
        count(*)::int AS session_count
      FROM ${consentRecords}
      WHERE ${consentRecords.interactionType} = 'customized'
        AND ${consentRecords.domainId} IN (${sql.join(domainIds, sql`, `)})
        AND ${consentRecords.givenAt} >= ${rawStartDate.toISOString()}
        AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
      GROUP BY category_combination
    `;
    const result = await db.execute(query);
    for (const row of result.rows) {
      const existing = combinationMap.get(row.category_combination) || 0;
      combinationMap.set(row.category_combination, existing + Number(row.session_count || 0));
    }
  }

  const results = Array.from(combinationMap.entries()).map(([combination, count]) => ({
    combination,
    count,
  }));
  
  results.sort((a, b) => b.count - a.count);
  return results;
}
