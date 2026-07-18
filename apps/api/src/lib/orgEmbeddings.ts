import { db } from '../db.js';
import { 
  processingActivities, 
  processingDataCategories,
  processingRecipients,
  organizationVendors, 
  vendors, 
  privacyPolicies, 
  policyVersions, 
  breaches, 
  dsarRequests, 
  complianceGaps, 
  dpias,
  dpiaRisks,
  dpiaMeasures,
  organizationEmbeddings
} from 'db';
import { eq, and } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'privaro',
  location: process.env.GCP_LOCATION || 'us-central1',
});

async function generateEmbedding(text: string) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });

  const firstEmbedding = response.embeddings?.[0];
  if (!firstEmbedding || !firstEmbedding.values) {
    throw new Error('No embeddings returned from Gemini/Vertex AI');
  }

  const values = firstEmbedding.values;
  if (values.length !== 3072) {
    throw new Error(`Expected 3072 dimensions, got ${values.length}`);
  }

  return values;
}

export async function serializeEntityForEmbedding(entityType: string, entityId: string): Promise<string> {
  switch (entityType) {
    case 'processing_activity': {
      const activity = await db.query.processingActivities.findFirst({
        where: eq(processingActivities.id, entityId),
      });
      if (!activity) throw new Error(`Processing activity with ID ${entityId} not found`);

      const dataCats = await db.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, entityId));
      const recipients = await db.select({
        vendorName: vendors.name
      })
      .from(processingRecipients)
      .leftJoin(vendors, eq(processingRecipients.vendorId, vendors.id))
      .where(eq(processingRecipients.processingActivityId, entityId));

      const categories = dataCats.map((dc: any) => dc.category).join(', ') || 'none specified';
      const recipientsList = recipients.map((r: any) => r.vendorName || 'Unknown Vendor').join(', ') || 'none specified';
      const subjects = (activity.dataSubjectCategories as any)?.join(', ') || 'none specified';

      return `The organization conducts a processing activity named '${activity.name}'. Its purpose is ${activity.purpose || 'not specified'}, operating under the lawful basis of '${activity.lawfulBasis}'. It processes data subject categories: ${subjects} and data categories: ${categories}. The data retention period is ${activity.retentionPeriod || 'not specified'}. Security measures in place include: ${activity.securityMeasures || 'standard technical measures'}. Recipients of this data are: ${recipientsList}.`;
    }
    case 'vendor': {
      const records = await db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .leftJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(eq(organizationVendors.id, entityId));

      const record = records[0];
      if (!record) throw new Error(`Organization vendor with ID ${entityId} not found`);

      const { orgVendor, vendor } = record;
      const shared = (orgVendor.dataCategoriesShared as any)?.join(', ') || 'none specified';
      const dpaStatus = orgVendor.dpaStatus || 'not started';
      const risk = orgVendor.riskScore !== null ? `${orgVendor.riskScore} (risk level: ${orgVendor.riskLevel || 'medium'})` : 'not calculated';
      const country = vendor?.headquartersCountry || 'unknown country';

      return `The organization has linked a third-party vendor named '${vendor?.name || 'unknown'}' for the purpose of ${orgVendor.purpose || 'not specified'}. The Data Processing Agreement (DPA) status is '${dpaStatus}'. The categories of data shared with this vendor are ${shared}. The vendor operates out of ${country} and has a calculated compliance risk score of ${risk}.`;
    }
    case 'policy': {
      const policy = await db.query.privacyPolicies.findFirst({
        where: eq(privacyPolicies.id, entityId),
      });
      if (!policy) throw new Error(`Privacy policy with ID ${entityId} not found`);

      let textContent = '(No content published yet)';
      if (policy.currentVersionId) {
        const version = await db.query.policyVersions.findFirst({
          where: eq(policyVersions.id, policy.currentVersionId),
        });
        if (version) {
          textContent = version.contentMarkdown;
        }
      }

      return `The organization's active privacy policy '${policy.name}' in language '${policy.language || 'en'}' contains the following text:\n\n${textContent}`;
    }
    case 'breach': {
      const record = await db.query.breaches.findFirst({
        where: eq(breaches.id, entityId),
      });
      if (!record) throw new Error(`Breach with ID ${entityId} not found`);

      const categories = (record.dataCategoriesAffected as any)?.join(', ') || 'none specified';
      const subjects = (record.dataSubjectsAffected as any)?.join(', ') || 'none specified';

      return `A personal data breach reference '${record.referenceNumber}' titled '${record.title}' was discovered on ${record.discoveredAt.toISOString()}. The breach cause is '${record.breachCause || 'unknown'}' and the description is: ${record.description}. Affected categories include data subjects ${subjects} and data categories ${categories}. The severity risk to individuals is '${record.riskToIndividuals || 'not assessed'}' and the authority notification status is '${record.notifyAuthority ? 'notified' : 'not required'}'.`;
    }
    case 'dsar': {
      const request = await db.query.dsarRequests.findFirst({
        where: eq(dsarRequests.id, entityId),
      });
      if (!request) throw new Error(`DSAR request with ID ${entityId} not found`);

      return `A Data Subject Access Request (DSAR) reference '${request.referenceNumber}' from subject '${request.subjectName}' (email: '${request.subjectEmail}') was received on ${request.receivedAt.toISOString()}. The request type is '${request.requestType}' with details: ${request.originalMessage || 'no description provided'}. Its current status is '${request.status}' with a compliance deadline of ${request.deadlineAt.toISOString()}.`;
    }
    case 'gap': {
      const gap = await db.query.complianceGaps.findFirst({
        where: eq(complianceGaps.id, entityId),
      });
      if (!gap) throw new Error(`Compliance gap with ID ${entityId} not found`);

      const articles = (gap.gdprArticles as any)?.join(', ') || 'none';

      return `A compliance gap titled '${gap.title}' (type: '${gap.gapType}') was scanned on entity '${gap.entityType}' (ID: '${gap.entityId}'). Description: ${gap.description || 'no description provided'}. The severity is '${gap.severity}' and its status is '${gap.status}'. This gap relates to GDPR articles ${articles}.`;
    }
    case 'dpia': {
      const dpia = await db.query.dpias.findFirst({
        where: eq(dpias.id, entityId),
      });
      if (!dpia) throw new Error(`DPIA with ID ${entityId} not found`);

      const risks = await db.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, entityId));
      const measures = await db.select({
        id: dpiaMeasures.id,
        description: dpiaMeasures.description,
        status: dpiaMeasures.status
      })
      .from(dpiaMeasures)
      .innerJoin(dpiaRisks, eq(dpiaMeasures.dpiaRiskId, dpiaRisks.id))
      .where(eq(dpiaRisks.dpiaId, entityId));

      const risksText = risks.map((r: any) => `- Risk: ${r.description} (Level: ${r.riskLevel || 'medium'})`).join('\n') || 'None identified';
      const measuresText = measures.map((m: any) => `- Mitigation: ${m.description} (Status: ${m.status || 'open'})`).join('\n') || 'None identified';

      return `A Data Protection Impact Assessment (DPIA) titled '${dpia.title}' is in status '${dpia.status}'. The assessment covers: ${dpia.description || 'not specified'}. The overall risk level is '${dpia.overallRiskLevel || 'not assessed'}' and residual risk level is '${dpia.residualRiskLevel || 'not assessed'}'. Key risks identified:\n${risksText}\nProposed mitigations:\n${measuresText}`;
    }
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }
}

export async function embedOrganizationData(orgId: string, entityType: string, entityId: string) {
  const content = await serializeEntityForEmbedding(entityType, entityId);
  const embedding = await generateEmbedding(content);

  await db.insert(organizationEmbeddings)
    .values({
      organizationId: orgId,
      entityType,
      entityId,
      content,
      embedding,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [
        organizationEmbeddings.organizationId,
        organizationEmbeddings.entityType,
        organizationEmbeddings.entityId
      ],
      set: {
        content,
        embedding,
        updatedAt: new Date()
      }
    });
}

export async function deleteOrganizationEmbedding(orgId: string, entityType: string, entityId: string) {
  await db.delete(organizationEmbeddings)
    .where(
      and(
        eq(organizationEmbeddings.organizationId, orgId),
        eq(organizationEmbeddings.entityType, entityType),
        eq(organizationEmbeddings.entityId, entityId)
      )
    );
}
