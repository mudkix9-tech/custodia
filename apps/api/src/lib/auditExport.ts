// @ts-nocheck
import * as archiverModule from 'archiver';
const archiver = (archiverModule as any).default || archiverModule;
import { PassThrough } from 'stream';
import { format as csvFormat } from 'fast-csv';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3BucketForOrg, getS3ClientForRegion } from '../lib/s3.js';
import { renderPdf } from '../lib/pdfClient.js';
import { db } from '../db.js';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import {
  organizations, processingActivities, processingDataCategories,
  processingRecipients, processingTransfers, organizationVendors,
  vendors, dsarRequests, breaches,
  dpias, dpiaRisks, dpiaMeasures, privacyPolicies, policyVersions,
  trainingModules, trainingCompletions, users, consentDomains,
  consentCookies, complianceReports, complianceGaps, documents,
  clients,
} from 'db';

import { computeGroupComplianceScores, computeGroupVendorConsistency } from './groupMetrics.js';

export async function generateGroupAuditArchive(parentOrgId: string, childOrgIds: string[], requestedBy: string): Promise<string> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, parentOrgId),
  });
  if (!org) throw new Error('Organization not found');

  const dataRegion = org.dataRegion || 'eu-west-1';
  const s3Client = getS3ClientForRegion(dataRegion);
  const S3_BUCKET = getS3BucketForOrg(dataRegion);

  const archive = archiver('zip', { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  const generatedAt = new Date();
  const logoUrl = (org.branding as any)?.logoUrl;

  // 1. Generate Group Executive Summary using shared groupMetrics
  const complianceScores = await computeGroupComplianceScores(db, parentOrgId, childOrgIds);
  const vendorConsistency = await computeGroupVendorConsistency(db, parentOrgId, childOrgIds);
  
  const groupData = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    complianceScores,
    vendorConsistency
  };
  const groupPdf = await renderPdf('group', groupData);
  archive.append(groupPdf, { name: 'Group Executive Summary.pdf' });

  // 2. Generate per-entity audits and bundle them into child_entities/
  const childOrgsList = childOrgIds.length > 0 ? await db.select().from(organizations).where(inArray(organizations.id, childOrgIds)) : [];
  const childOrgsMap = new Map(childOrgsList.map(o => [o.id, o]));

  for (const childOrgId of childOrgIds) {
    const childOrg = childOrgsMap.get(childOrgId);
    if (!childOrg) continue;
    
    try {
      const childSlug = childOrg.slug || childOrgId;
      await generateAuditFile(childOrgId, archive, `child_entities/${childSlug}/`);
    } catch (e) {
      console.error(`Failed to generate child audit for ${childOrgId}`, e);
    }
  }
  
  archive.finalize();

  const exportKey = `exports/${parentOrgId}/group_${Date.now()}.zip`;
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: S3_BUCKET,
      Key: exportKey,
      Body: passThrough,
      ContentType: 'application/zip',
    }
  });

  await upload.done();

  return await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: exportKey,
  }), { expiresIn: 7 * 24 * 60 * 60 });
}

export async function generateAuditFile(
  orgId: string, 
  providedArchive?: any,
  basePath: string = ''
): Promise<string | void> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) throw new Error('Organization not found');

  const dataRegion = org.dataRegion || 'eu-west-1';
  const s3Client = getS3ClientForRegion(dataRegion);
  const S3_BUCKET = getS3BucketForOrg(dataRegion);

  const archive = providedArchive || archiver('zip', { zlib: { level: 9 } });
  let passThrough: PassThrough | null = null;
  if (!providedArchive) {
    passThrough = new PassThrough();
    archive.pipe(passThrough);
  }

  // Monkey-patch append to prepend basePath
  const originalAppend = archive.append.bind(archive);
  archive.append = (source: any, data: any) => {
    if (basePath && data && data.name) {
      data.name = basePath + data.name;
    }
    return originalAppend(source, data);
  };

  const generatedAt = new Date();
  const logoUrl = (org.branding as any)?.logoUrl;

  // ── ROPA ──────────────────────────────────────────────────
  const activities = await db.query.processingActivities.findMany({
    where: and(eq(processingActivities.organizationId, orgId), isNull(processingActivities.deletedAt)),
    with: {
      dataCategories: true,
      recipients: { with: { vendor: true } },
    },
  });

  // Fetch transfers separately
  let allTransfers: any[] = [];
  if (activities.length > 0) {
    const actIds = activities.map(a => a.id);
    allTransfers = await db.select().from(processingTransfers).where(inArray(processingTransfers.processingActivityId, actIds));
  }

  const activitiesWithTransfers = activities.map((a: any) => ({
    ...a,
    transfers: allTransfers.filter((t: any) => t.processingActivityId === a.id),
  }));

  const controllerActivities = activitiesWithTransfers.filter(a => !a.clientId);

  const clientIds = [...new Set(activitiesWithTransfers.filter(a => a.clientId).map(a => a.clientId!))];
  let clientRecords: any[] = [];
  if (clientIds.length > 0) {
    clientRecords = await db.select().from(clients).where(inArray(clients.id, clientIds as string[]));
  }
  const clientMap = new Map(clientRecords.map(c => [c.id, c.name]));
  const processorActivities = activitiesWithTransfers
    .filter(a => a.clientId)
    .map(a => ({ ...a, clientName: clientMap.get(a.clientId!) || 'Unknown Client' }));

  const ropaData = {
    orgName: org.name,
    orgLegalName: org.legalName || org.name,
    orgCountry: org.countryCode || '',
    orgAddress: org.address,
    dpoName: org.dpoName,
    dpoEmail: org.dpoEmail,
    logoUrl,
    generatedAt,
    controllerActivities,
    processorActivities,
    locale: (org as any).defaultLanguage || 'en',
  };
  const ropaPdf = await renderPdf('ropa-register', ropaData);
  archive.append(ropaPdf, { name: 'ropa/article-30-report.pdf' });

  const ropaCsv = await generateCsv(activities.map((a: any) => ({
    name: a.name,
    purpose: a.purpose,
    lawful_basis: a.lawfulBasis,
    data_subjects: (a.dataSubjectCategories as string[] || []).join('; '),
    data_categories: (a.dataCategories || []).map((c: any) => c.category).join('; '),
    recipients: (a.recipients || []).map((r: any) => r.name).join('; '),
    retention: a.retentionPeriod,
    security_measures: (a.securityMeasures as string[] || []).join('; '),
    status: a.status,
    risk_level: a.riskLevel,
  })));
  archive.append(ropaCsv, { name: 'ropa/processing-activities.csv' });

  // ── VENDORS ───────────────────────────────────────────────
  const orgVendors = await db.query.organizationVendors.findMany({
    where: eq(organizationVendors.organizationId, orgId),
    with: { vendor: true },
  });

  const vendorData = orgVendors.map((ov: any) => ({
    name: ov.vendor.name,
    category: ov.vendor.category,
    headquartersCountry: ov.vendor.headquartersCountry,
    dataProcessingLocations: (ov.vendor.dataProcessingLocations as string[]) || [],
    dpaStatus: ov.dpaStatus || 'not_started',
    dpaSignedAt: ov.dpaSignedAt,
    dpaExpiresAt: ov.dpaExpiresAt,
    riskLevel: ov.riskLevel,
    riskScore: ov.riskScore,
    securityCertifications: (ov.vendor.securityCertifications as string[]) || [],
    transferMechanism: null,
    lastReviewedAt: ov.lastReviewedAt,
  }));

  const vendorReport = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    vendors: vendorData,
    summary: {
      total: vendorData.length,
      dpasSigned: vendorData.filter(v => v.dpaStatus === 'signed').length,
      dpasExpired: vendorData.filter(v => v.dpaStatus === 'expired').length,
      dpasMissing: vendorData.filter(v => v.dpaStatus === 'not_started').length,
      highRisk: vendorData.filter(v => v.riskLevel === 'high' || v.riskLevel === 'critical').length,
    },
  };
  const vendorPdf = await renderPdf('vendors', vendorReport);
  archive.append(vendorPdf, { name: 'vendors/vendor-register.pdf' });

  const vendorCsv = await generateCsv(vendorData.map(v => ({
    name: v.name,
    category: v.category,
    headquarters: v.headquartersCountry,
    dpa_status: v.dpaStatus,
    dpa_signed: v.dpaSignedAt?.toISOString() || '',
    dpa_expires: v.dpaExpiresAt?.toISOString() || '',
    risk_level: v.riskLevel,
    risk_score: v.riskScore,
    certifications: v.securityCertifications.join('; '),
  })));
  archive.append(vendorCsv, { name: 'vendors/vendor-register.csv' });

  // DPA documents from S3
  const limit = (concurrency: number) => {
    let active = 0;
    const queue: (() => void)[] = [];
    const next = () => {
      active--;
      if (queue.length > 0) queue.shift()!();
    };
    return <T>(fn: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
      const run = async () => {
        active++;
        try { resolve(await fn()); } catch (err) { reject(err); } finally { next(); }
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
  };

  const pLimit = limit(5);

  const docIds = orgVendors.map((ov: any) => ov.dpaDocumentId).filter(Boolean);
  const docsList = docIds.length > 0 ? await db.select().from(documents).where(inArray(documents.id, docIds)) : [];
  const docsMap = new Map(docsList.map(d => [d.id, d]));

  await Promise.all(orgVendors.map((ov: any) => pLimit(async () => {
    if (ov.dpaDocumentId) {
      try {
        const doc = docsMap.get(ov.dpaDocumentId);
        if (doc && doc.s3Key) {
          const s3Obj = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }));
          if (s3Obj.Body) {
            const vendorName = ov.vendor?.name || 'UnknownVendor';
            archive.append(s3Obj.Body as any, { name: `vendors/dpas/${vendorName.replace(/[^a-zA-Z0-9]/g, '_')}-dpa.pdf` });
          }
        }
      } catch (e) { /* skip missing documents */ }
    }
  })));

  // ── POLICIES ──────────────────────────────────────────────
  const policies = await db.query.privacyPolicies.findMany({
    where: and(eq(privacyPolicies.organizationId, orgId), isNull(privacyPolicies.deletedAt)),
  });

  const policyIds = policies.map(p => p.id);
  const allPolicyVersions = policyIds.length > 0
    ? await db.query.policyVersions.findMany({ where: inArray(policyVersions.policyId, policyIds), orderBy: desc(policyVersions.versionNumber) })
    : [];
  
  const versionsByPolicy = new Map<string, typeof allPolicyVersions>();
  for (const v of allPolicyVersions) {
    if (!versionsByPolicy.has(v.policyId)) versionsByPolicy.set(v.policyId, []);
    versionsByPolicy.get(v.policyId)!.push(v);
  }

  for (const policy of policies) {
    const versions = versionsByPolicy.get(policy.id) || [];
    for (const version of versions) {
      const safeName = policy.name.replace(/[^a-zA-Z0-9]/g, '_');
      archive.append(version.contentHtml || '', { name: `policies/${safeName}-v${version.versionNumber}.html` });
    }
  }

  // ── DPIAs ─────────────────────────────────────────────────
  const orgDpias = await db.query.dpias.findMany({
    where: eq(dpias.organizationId, orgId),
  });

  const dpiaIds = orgDpias.map(d => d.id);
  const allRisks = dpiaIds.length > 0 
    ? await db.query.dpiaRisks.findMany({ where: inArray(dpiaRisks.dpiaId, dpiaIds) })
    : [];
  const riskIds = allRisks.map(r => r.id);
  const allMeasures = riskIds.length > 0
    ? await db.query.dpiaMeasures.findMany({ where: inArray(dpiaMeasures.dpiaRiskId, riskIds) })
    : [];

  const measuresByRiskId = new Map<string, typeof allMeasures>();
  for (const m of allMeasures) {
    if (!measuresByRiskId.has(m.dpiaRiskId)) measuresByRiskId.set(m.dpiaRiskId, []);
    measuresByRiskId.get(m.dpiaRiskId)!.push(m);
  }

  const risksByDpiaId = new Map<string, any[]>();
  for (const r of allRisks) {
    if (!risksByDpiaId.has(r.dpiaId)) risksByDpiaId.set(r.dpiaId, []);
    risksByDpiaId.get(r.dpiaId)!.push({ ...r, measures: measuresByRiskId.get(r.id) || [] });
  }

  for (const dpia of orgDpias) {
    const risksWithMeasures = risksByDpiaId.get(dpia.id) || [];

    const linkedActivityIds = (dpia.processingActivityIds as string[]) || [];
    const linkedNames = activities
      .filter((a: any) => linkedActivityIds.includes(a.id))
      .map((a: any) => a.name);

    const dpiaData = {
      orgName: org.name,
      logoUrl,
      generatedAt,
      dpia: {
        title: dpia.title,
        description: dpia.description,
        status: dpia.status || 'draft',
        processingDescription: dpia.processingDescription,
        necessityAssessment: dpia.necessityAssessment,
        proportionalityAssessment: dpia.proportionalityAssessment,
        overallRiskLevel: dpia.overallRiskLevel,
        residualRiskLevel: dpia.residualRiskLevel,
        approvedBy: null, // would need user lookup
        approvedAt: dpia.approvedAt,
        risks: risksWithMeasures.map((r: any) => ({
            description: r.description,
            likelihood: r.likelihood,
            severity: r.severity,
            initialRiskScore: r.initialRiskScore,
            residualRiskScore: r.residualRiskScore,
            measures: r.measures.map((m: any) => ({
                description: m.description,
                status: m.status,
                implementedAt: m.implementedAt
            }))
        })),
        linkedActivities: linkedNames,
      },
    };
    const dpiaPdf = await renderPdf('dpia', dpiaData);
    const safeName = dpia.title.replace(/[^a-zA-Z0-9]/g, '_');
    archive.append(dpiaPdf, { name: `dpias/${safeName}.pdf` });
  }

  const dpiaCsv = await generateCsv(orgDpias.map(d => ({
    title: d.title,
    status: d.status,
    overall_risk: d.overallRiskLevel,
    residual_risk: d.residualRiskLevel,
    approved_at: d.approvedAt?.toISOString() || '',
  })));
  archive.append(dpiaCsv, { name: 'dpias/dpia-summary.csv' });

  // ── DSARs ─────────────────────────────────────────────────
  const dsars = await db.query.dsarRequests.findMany({
    where: eq(dsarRequests.organizationId, orgId),
    orderBy: desc(dsarRequests.receivedAt),
  });

  const dsarData = dsars.map((r: any) => {
    const daysToComplete = r.completedAt
      ? Math.ceil((r.completedAt.getTime() - r.receivedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const effectiveDeadline = r.extendedDeadlineAt || r.deadlineAt;
    const withinDeadline = r.completedAt
      ? r.completedAt <= effectiveDeadline
      : null;
    return {
      referenceNumber: r.referenceNumber,
      requestType: r.requestType,
      subjectName: r.subjectName,
      receivedAt: r.receivedAt,
      deadlineAt: r.deadlineAt,
      completedAt: r.completedAt,
      status: r.status || 'new',
      extended: r.extended || false,
      daysToComplete,
      withinDeadline,
    };
  });

  const completedDsars = dsarData.filter(d => d.completedAt);
  const dsarReport = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    requests: dsarData,
    summary: {
      total: dsarData.length,
      completed: completedDsars.length,
      active: dsarData.filter(d => !d.completedAt && d.status !== 'refused').length,
      overdue: dsarData.filter(d => !d.completedAt && d.status === 'overdue').length,
      averageDays: completedDsars.length > 0
        ? Math.round(completedDsars.reduce((s, d) => s + (d.daysToComplete || 0), 0) / completedDsars.length)
        : 0,
      slaAdherence: completedDsars.length > 0
        ? Math.round((completedDsars.filter(d => d.withinDeadline).length / completedDsars.length) * 100)
        : 100,
    },
  };
  const dsarPdf = await renderPdf('dsar', dsarReport);
  archive.append(dsarPdf, { name: 'dsars/dsar-register.pdf' });

  const dsarCsv = await generateCsv(dsarData.map(d => ({
    reference: d.referenceNumber,
    type: d.requestType,
    subject: d.subjectName,
    received: d.receivedAt.toISOString(),
    deadline: d.deadlineAt.toISOString(),
    completed: d.completedAt?.toISOString() || '',
    status: d.status,
    days_to_complete: d.daysToComplete ?? '',
    within_sla: d.withinDeadline === null ? '' : d.withinDeadline ? 'Yes' : 'No',
  })));
  archive.append(dsarCsv, { name: 'dsars/dsar-register.csv' });

  // ── BREACHES ──────────────────────────────────────────────
  const orgBreaches = await db.query.breaches.findMany({
    where: eq(breaches.organizationId, orgId),
    orderBy: desc(breaches.discoveredAt),
  });

  const breachData = orgBreaches.map((b: any) => ({
    referenceNumber: b.referenceNumber,
    title: b.title,
    discoveredAt: b.discoveredAt || new Date(),
    breachType: b.breachType,
    riskToIndividuals: b.riskToIndividuals,
    estimatedRecordsAffected: b.estimatedRecordsAffected,
    notifyAuthority: b.notifyAuthority,
    authorityNotifiedAt: b.authorityNotifiedAt,
    notifyIndividuals: b.notifyIndividuals,
    status: b.status || 'detected',
    rootCause: b.rootCause,
    vendorOriginated: b.vendorOriginated || false,
  }));

  const notifiableBreaches = breachData.filter(b => b.notifyAuthority);
  const breachReport = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    breaches: breachData,
    summary: {
      total: breachData.length,
      notifiable: notifiableBreaches.length,
      notifiedOnTime: notifiableBreaches.filter(b =>
        b.authorityNotifiedAt && b.discoveredAt &&
        (b.authorityNotifiedAt.getTime() - b.discoveredAt.getTime()) <= 72 * 60 * 60 * 1000
      ).length,
      vendorOriginated: breachData.filter(b => b.vendorOriginated).length,
      averageResolutionDays: 0, // calculate if needed
    },
  };
  const breachPdf = await renderPdf('breaches', breachReport);
  archive.append(breachPdf, { name: 'breaches/breach-register.pdf' });

  const breachCsv = await generateCsv(breachData.map(b => ({
    reference: b.referenceNumber,
    title: b.title,
    discovered: b.discoveredAt.toISOString(),
    type: b.breachType,
    risk: b.riskToIndividuals || '',
    records_affected: b.estimatedRecordsAffected ?? '',
    authority_notified: b.authorityNotifiedAt?.toISOString() || '',
    status: b.status,
    vendor_originated: b.vendorOriginated ? 'Yes' : 'No',
  })));
  archive.append(breachCsv, { name: 'breaches/breach-register.csv' });

  // ── TRAINING ──────────────────────────────────────────────
  const modules = await db.query.trainingModules.findMany({
    where: and(
      eq(trainingModules.organizationId, orgId),
      isNull(trainingModules.deletedAt),
    ),
  });

  const globalModules = await db.query.trainingModules.findMany({
    where: and(eq(trainingModules.isGlobal, true), isNull(trainingModules.deletedAt)),
  });

  const allModules = [...modules, ...globalModules];

  const completions = await db.query.trainingCompletions.findMany({
    where: eq(trainingCompletions.organizationId, orgId),
  });

  const orgUsers = await db.query.users.findMany({
    where: and(eq(users.organizationId, orgId), isNull(users.deletedAt)),
  });

  const userMap = new Map(orgUsers.map((u: any) => [u.id, { name: u.name, email: u.email }]));
  const moduleMap = new Map(allModules.map((m: any) => [m.id, m]));

  const trainingData = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    modules: allModules.map((m: any) => {
      const moduleCompletions = completions.filter(c => c.moduleId === m.id);
      const assigned = orgUsers.length; // all users are assigned to mandatory modules
      const completed = moduleCompletions.filter(c => c.status === 'passed').length;
      return {
        title: m.title,
        isMandatory: m.isMandatory || false,
        completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
        totalAssigned: assigned,
        totalCompleted: completed,
      };
    }),
    completions: completions.map((c: any) => {
      const user = userMap.get(c.userId);
      const mod = moduleMap.get(c.moduleId);
      return {
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        moduleTitle: mod?.title || 'Unknown',
        status: c.status || 'not_started',
        quizScore: c.quizScore,
        completedAt: c.completedAt,
        expiresAt: c.expiresAt,
        certificateId: c.certificateId,
      };
    }),
    summary: {
      overallCompletionRate: completions.length > 0
        ? Math.round((completions.filter(c => c.status === 'passed').length / completions.length) * 100)
        : 100,
      totalModules: allModules.length,
      totalCompletions: completions.filter(c => c.status === 'passed').length,
      overdueCount: completions.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date() && c.status !== 'passed').length,
    },
  };
  const trainingPdf = await renderPdf('training-report', trainingData);
  archive.append(trainingPdf, { name: 'training/training-report.pdf' });

  const trainingCsv = await generateCsv(completions.map((c: any) => {
    const user = userMap.get(c.userId);
    const mod = moduleMap.get(c.moduleId);
    return {
      employee: user?.name || '',
      email: user?.email || '',
      module: mod?.title || '',
      status: c.status,
      score: c.quizScore ?? '',
      completed: c.completedAt?.toISOString() || '',
      expires: c.expiresAt?.toISOString() || '',
      certificate_id: c.certificateId || '',
    };
  }));
  archive.append(trainingCsv, { name: 'training/completion-records.csv' });

  // ── CONSENT ───────────────────────────────────────────────
  const domains = await db.query.consentDomains.findMany({
    where: eq(consentDomains.organizationId, orgId),
  });

  const domainsWithCookies = await Promise.all(domains.map(async (d: any) => {
    const cookies = await db.query.consentCookies.findMany({
      where: eq(consentCookies.domainId, d.id),
    });
    return {
      domain: d.domain,
      totalPageviews30d: d.totalPageviews30d || 0,
      consentRate30d: parseFloat(String(d.consentRate30d || 0)),
      lastScanAt: d.lastScanAt,
      cookieCount: cookies.length,
      gcmEnabled: d.gcmV2Enabled || false,
      tcfEnabled: d.tcfEnabled || false,
    };
  }));

  const consentData = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    domains: domainsWithCookies,
    summary: {
      totalDomains: domainsWithCookies.length,
      averageConsentRate: domainsWithCookies.length > 0
        ? Math.round(domainsWithCookies.reduce((s, d) => s + d.consentRate30d, 0) / domainsWithCookies.length)
        : 0,
      totalPageviews: domainsWithCookies.reduce((s, d) => s + d.totalPageviews30d, 0),
      totalCookiesTracked: domainsWithCookies.reduce((s, d) => s + d.cookieCount, 0),
    },
  };
  const consentPdf = await renderPdf('consent', consentData);
  archive.append(consentPdf, { name: 'consent/consent-analytics.pdf' });

  const consentCsv = await generateCsv(domainsWithCookies.map(d => ({
    domain: d.domain,
    pageviews_30d: d.totalPageviews30d,
    consent_rate: `${d.consentRate30d}%`,
    cookies: d.cookieCount,
    gcm_v2: d.gcmEnabled ? 'Yes' : 'No',
    tcf: d.tcfEnabled ? 'Yes' : 'No',
    last_scan: d.lastScanAt?.toISOString() || '',
  })));
  archive.append(consentCsv, { name: 'consent/consent-summary.csv' });

  // ── COMPLIANCE ────────────────────────────────────────────
  const latestReport = await db.query.complianceReports.findFirst({
    where: eq(complianceReports.organizationId, orgId),
    orderBy: desc(complianceReports.snapshotDate),
  });

  const scoreHistory = await db.query.complianceReports.findMany({
    where: eq(complianceReports.organizationId, orgId),
    orderBy: desc(complianceReports.snapshotDate),
    limit: 12,
  });

  const activeGaps = await db.query.complianceGaps.findMany({
    where: and(
      eq(complianceGaps.organizationId, orgId),
      eq(complianceGaps.status, 'open'),
    ),
  });

  const complianceData = {
    orgName: org.name,
    logoUrl,
    generatedAt,
    currentScore: latestReport?.scoreTotal || 0,
    categoryScores: (latestReport?.categoryScores as Record<string, number>) || {},
    scoreHistory: scoreHistory.reverse().map(s => ({ date: s.snapshotDate, score: s.scoreTotal })),
    activeGaps: activeGaps.map(g => ({
      title: g.title,
      gapType: g.gapType,
      severity: g.severity,
      entityType: g.entityType,
      firstDetectedAt: g.firstDetectedAt || new Date(),
      detectionCount: g.detectionCount || 1,
    })),
    resolvedGaps30d: 0, // could query
    summary: {
      totalActiveGaps: activeGaps.length,
      criticalGaps: activeGaps.filter(g => g.severity === 'critical').length,
      highGaps: activeGaps.filter(g => g.severity === 'high').length,
      mediumGaps: activeGaps.filter(g => g.severity === 'medium').length,
    },
  };
  const compliancePdf = await renderPdf('compliance', complianceData);
  archive.append(compliancePdf, { name: 'compliance/compliance-report.pdf' });

  const scoreCsv = await generateCsv(scoreHistory.map(s => ({
    date: s.snapshotDate.toISOString().split('T')[0],
    score: s.scoreTotal,
    ...((s.categoryScores as Record<string, number>) || {}),
  })));
  archive.append(scoreCsv, { name: 'compliance/score-history.csv' });

  const gapCsv = await generateCsv(activeGaps.map(g => ({
    title: g.title,
    type: g.gapType,
    severity: g.severity,
    module: g.entityType,
    first_detected: g.firstDetectedAt?.toISOString() || '',
    consecutive_detections: g.detectionCount,
    status: g.status,
  })));
  archive.append(gapCsv, { name: 'compliance/gap-history.csv' });

  // ── Finalize and upload ───────────────────────────────────
  if (!providedArchive) {
    archive.finalize();

    const exportKey = `audit-files/${orgId}/${Date.now()}-audit-file.zip`;
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET,
        Key: exportKey,
        Body: passThrough,
        ContentType: 'application/zip',
      },
    });

    await upload.done();

    const downloadUrl = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: exportKey,
    }), { expiresIn: 7 * 24 * 60 * 60 }); // 7 days

    // Restore original append if we monkey-patched it (good practice)
    archive.append = originalAppend;

    return downloadUrl;
  } else {
    // Restore original append
    archive.append = originalAppend;
    return;
  }
}

// ── CSV Helper ──────────────────────────────────────────────
async function generateCsv(rows: Record<string, any>[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (rows.length === 0) return resolve("");
    const chunks: string[] = [];
    const stream = csvFormat({ headers: true });
    stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    stream.on('end', () => resolve(chunks.join('')));
    stream.on('error', reject);
    rows.forEach(row => stream.write(row));
    stream.end();
  });
}
