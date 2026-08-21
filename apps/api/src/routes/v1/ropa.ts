/**
 * O119. The public REST API for the register.
 *
 * `routes/v1/index.ts` has carried `// Future: fastify.register(ropaRoutes…)` since
 * the vendors endpoint shipped (D40): a customer with an API key could list their
 * vendors and could not read the one object the product is built around.
 *
 * Three things this file is deliberate about.
 *
 * **It is read-and-append, not full CRUD.** GET the register, GET one activity with
 * its children, GET the Article 30 export, POST a draft activity. There is no PATCH
 * and no DELETE, and that is a decision rather than an omission: an Article 30
 * record carries an optimistic lock, a publication gate, a completeness recompute,
 * a version snapshot, an approval state and a subject-category mirror, and a REST
 * PATCH that bypassed any one of them would leave the register in a state the
 * editor cannot represent. Writes that matter go through tRPC, where all six run.
 *
 * **Every response is a projection.** The shapes here are the Article 30 record,
 * not `select *` — the same allowlist reasoning `lib/ropaEvents.ts` gives. A REST
 * body shaped like a database row is a schema promise nobody meant to make, and
 * every column added later leaks into it.
 *
 * **Ownership comes from the key, never from the path.** `apiKeyAuthMiddleware`
 * puts `orgId` on the request; every query filters on it. There is no endpoint here
 * that takes an organisation id.
 */

import { FastifyInstance } from 'fastify';
import { db } from '../../db.js';
import {
  processingActivities,
  processingDataSubjects,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  retentionSchedules,
} from 'db';
import { and, eq, inArray, isNull, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { apiKeyAuthMiddleware } from '../../middleware/apiKeyAuth.js';
import { paginatedQuery } from '../../utils/pagination.js';
import { buildArticle30Record } from '../../lib/ropaArticle30.js';
import { article30Csv, article30Json, article30Xlsx } from '../../lib/ropaExportFormats.js';
import { emitRopaEvent } from '../../lib/ropaEvents.js';
import { retentionAnswer } from '../../lib/retention.js';

const API_VERSION = '2026-01-01';

/** The activity as the API describes it. Hand-written; see the note at the top. */
function activityResource(row: any, schedule?: any) {
  const retention = retentionAnswer({ schedule: schedule ?? null, freeText: row.retentionPeriod });
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    purpose: row.purpose,
    role: row.role,
    controller_name: row.controllerName ?? null,
    lawful_basis: row.lawfulBasis,
    lawful_basis_detail: row.lawfulBasisDetail ?? null,
    status: row.status,
    approval_state: row.approvalState,
    risk_level: row.riskLevel,
    requires_dpia: !!row.requiresDpia,
    completeness_score: row.completenessScore ?? 0,
    retention: {
      period: retention.label,
      source: retention.source,
      trigger: retention.trigger,
      statutory_citation: retention.citation,
      justification: row.retentionJustification ?? null,
    },
    involves_special_categories: !!row.involvesSpecialCategories,
    involves_automated_decision_making: !!row.involvesAutomatedDecisionMaking,
    involves_profiling: !!row.involvesProfiling,
    tags: Array.isArray(row.tags) ? row.tags : [],
    last_reviewed_at: iso(row.lastReviewedAt),
    next_review_at: iso(row.nextReviewAt),
    published_at: iso(row.publishedAt),
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v ?? null);

const errorBody = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        message: { type: 'string' },
        code: { type: 'string' },
        request_id: { type: 'string' },
      },
    },
  },
};

export default async function ropaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', apiKeyAuthMiddleware);

  // -------------------------------------------------------------------------
  // GET / — the register
  // -------------------------------------------------------------------------
  fastify.get('/', {
    schema: {
      summary: 'List processing activities',
      description: 'Returns a paginated list of the Article 30 records in your register. Deleted activities are never returned; archived ones are excluded unless include_archived is set.',
      tags: ['Processing activities'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          after: { type: 'string', description: 'Cursor from a previous response' },
          status: { type: 'string', enum: ['draft', 'active', 'under_review', 'archived'] },
          include_archived: { type: 'boolean', default: false },
        },
      },
      response: { 400: errorBody, 401: errorBody, 429: errorBody },
    },
  }, async (request, reply) => {
    const { limit = 25, after, status, include_archived } = request.query as any;
    const orgId = (request as any).orgId;

    try {
      const extra: any[] = [isNull(processingActivities.deletedAt)];
      if (status) extra.push(eq(processingActivities.status, status));
      // Archived rows are excluded by default rather than filtered client-side, so
      // "the register" over the API means the same set it means in the product.
      else if (!include_archived) extra.push(eq(processingActivities.status, 'active'));

      const page = await paginatedQuery(processingActivities, orgId, { limit, after }, 'updatedAt', 'desc', extra);
      reply.header('X-API-Version', API_VERSION);
      return { ...page, data: page.data.map((row: any) => activityResource(row)) };
    } catch (err: any) {
      return reply.status(400).send({
        error: { type: 'validation_error', message: err.message, code: 'INVALID_CURSOR', request_id: request.id || randomUUID() },
      });
    }
  });

  // -------------------------------------------------------------------------
  // GET /:id — one record, with its four child collections
  // -------------------------------------------------------------------------
  fastify.get('/:id', {
    schema: {
      summary: 'Retrieve a processing activity',
      description: 'Returns one Article 30 record with its data subjects, data categories, recipients and third-country transfers.',
      tags: ['Processing activities'],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      response: { 401: errorBody, 404: errorBody },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgId = (request as any).orgId;

    const [row] = await db.select({ activity: processingActivities, schedule: retentionSchedules })
      .from(processingActivities)
      .leftJoin(retentionSchedules, eq(processingActivities.retentionScheduleId, retentionSchedules.id))
      .where(and(
        eq(processingActivities.id, id),
        eq(processingActivities.organizationId, orgId),
        isNull(processingActivities.deletedAt),
      ));

    // NOT_FOUND rather than FORBIDDEN, for the reason lib/tenancy.ts states: "this
    // exists but is not yours" confirms the id is real, which is the one thing a
    // caller probing other tenants' ids does not already know.
    if (!row) {
      return reply.status(404).send({
        error: { type: 'not_found', message: 'No such processing activity', code: 'NOT_FOUND', request_id: request.id || randomUUID() },
      });
    }

    const [subjects, categories, recipients, transfers] = await Promise.all([
      db.select().from(processingDataSubjects).where(eq(processingDataSubjects.processingActivityId, id)),
      db.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, id)),
      db.select().from(processingRecipients).where(eq(processingRecipients.processingActivityId, id)),
      db.select().from(processingTransfers).where(eq(processingTransfers.processingActivityId, id)),
    ]);

    reply.header('X-API-Version', API_VERSION);
    return {
      ...activityResource(row.activity, row.schedule),
      data_subjects: subjects.map((s: any) => ({
        id: s.id,
        category: s.category,
        is_child: !!s.isChild,
        is_vulnerable: !!s.isVulnerable,
        volume_band: s.volumeBand ?? null,
      })),
      data_categories: categories.map((c: any) => ({
        id: c.id,
        category: c.category,
        category_group: c.categoryGroup,
        source: c.source ?? null,
        is_special_category: !!c.isSpecialCategory,
        article_9_condition: c.article9Condition ?? null,
        is_criminal_data: !!c.isCriminalData,
        retention_period: c.retentionPeriod ?? null,
      })),
      recipients: recipients.map((r: any) => ({
        id: r.id,
        name: r.name,
        role: r.role ?? null,
        recipient_category: r.recipientCategory ?? null,
        purpose: r.purpose ?? null,
      })),
      transfers: transfers.map((t: any) => ({
        id: t.id,
        destination_country: t.destinationCountry,
        destination_entity: t.destinationEntity ?? null,
        transfer_mechanism: t.transferMechanism,
        scc_year: t.sccYear ?? null,
        scc_module: t.sccModule ?? null,
        tia_required: !!t.tiaRequired,
        tia_completed: !!t.tiaCompleted,
      })),
    };
  });

  // -------------------------------------------------------------------------
  // POST / — create a draft
  // -------------------------------------------------------------------------
  fastify.post('/', {
    schema: {
      summary: 'Create a processing activity',
      description: 'Creates a draft Article 30 record. Activities always arrive as drafts: publication runs through the completeness gate, which needs the child records this endpoint does not create.',
      tags: ['Processing activities'],
      body: {
        type: 'object',
        required: ['name', 'purpose', 'lawful_basis'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          purpose: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          lawful_basis: { type: 'string', maxLength: 50 },
          role: { type: 'string', enum: ['controller', 'processor', 'joint_controller'], default: 'controller' },
          controller_name: { type: 'string', maxLength: 255 },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
        },
      },
      // 201 is declared as well as the error codes: Fastify derives the reply's
      // status union from this map, so omitting the success case makes
      // `reply.status(201)` a type error rather than a documentation gap.
      response: { 201: { type: 'object', additionalProperties: true }, 400: errorBody, 401: errorBody, 403: errorBody },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const orgId = (request as any).orgId;

    const [created] = await db.insert(processingActivities).values({
      organizationId: orgId,
      name: body.name,
      purpose: body.purpose,
      description: body.description ?? null,
      lawfulBasis: body.lawful_basis,
      role: body.role ?? 'controller',
      controllerName: body.controller_name ?? null,
      riskLevel: body.risk_level ?? 'low',
      // Never 'active'. B23 makes 'active' mean "this record answers Art. 30", and
      // a record with no data subjects, categories or recipients cannot answer it.
      status: 'draft',
      source: 'api',
    }).returning();

    if (created) await emitRopaEvent(orgId, 'ropa.created', created);

    reply.header('X-API-Version', API_VERSION);
    return reply.status(201).send(activityResource(created));
  });

  // -------------------------------------------------------------------------
  // GET /export — the canonical Article 30 document
  // -------------------------------------------------------------------------
  fastify.get('/export', {
    schema: {
      summary: 'Export the Article 30 record',
      description: 'Returns the canonical Article 30 register as JSON, CSV or XLSX. Built from the same dataset as the PDF and the regulator packs — there is one Article 30 document in this product and this is it.',
      tags: ['Processing activities'],
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'csv', 'xlsx'], default: 'json' },
          include_archived: { type: 'boolean', default: false },
        },
      },
      response: { 401: errorBody },
    },
  }, async (request, reply) => {
    const { format = 'json', include_archived } = request.query as any;
    const orgId = (request as any).orgId;

    // Straight to the builder rather than through `buildRegisterFilters`: an export
    // does not paginate, and that helper adds `next_review_at IS NOT NULL` when the
    // sort is by review date, which would silently drop every activity with no
    // review date from an Article 30 record. `exportFilters()` is the tRPC side of
    // the same rule.
    const where = include_archived ? [] : [eq(processingActivities.status, 'active')];

    const record = await buildArticle30Record(db, orgId, {
      where,
      filterSummary: include_archived ? null : 'Published activities only.',
    });

    reply.header('X-API-Version', API_VERSION);

    if (format === 'csv') {
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="article-30-register.csv"');
      return reply.send(article30Csv(record));
    }
    if (format === 'xlsx') {
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', 'attachment; filename="article-30-register.xlsx"');
      return reply.send(article30Xlsx(record));
    }
    return article30Json(record);
  });

  fastify.setErrorHandler((error, request, reply) => {
    const err = error as any;
    reply.status(err.statusCode || 500).send({
      error: {
        type: err.name || 'internal_error',
        message: err.message,
        code: err.code || 'UNKNOWN',
        request_id: request.id || randomUUID(),
      },
    });
  });
}
