import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { notificationQueue, organizations, users, processingActivities, vendors, dsarRequests, breaches, documents } from 'db';
import { eq } from 'drizzle-orm';
import * as archiverModule from 'archiver';
const archiver = (archiverModule as any).default || archiverModule;
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import stream from 'stream';
import { generateAuditFile, generateGroupAuditArchive } from '../lib/auditExport.js';
import { verifyGroupScopeAndLog } from '../trpc.js';

import { getS3ClientForRegion, getS3BucketForOrg } from '../lib/s3.js';

export const dataExportWorker = createWorker('data-export', async (job: any) => {
    const { organizationId, requestedBy, isFullAudit, isGroupAudit } = job.data;

    console.log(`Starting data export for org ${organizationId}`);

    let signedUrl: string = '';
    let notificationTitle = '';
    let notificationBody = '';

    if (isGroupAudit) {
      // Re-verify the child organizations at execution time to ensure validity
      const user = await db.query.users.findFirst({ where: eq(users.id, requestedBy) });
      if (!user) throw new Error('User not found');
      
      const childOrgs = await db.select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, organizationId));
      const childOrgIds = childOrgs.map((o: any) => o.id);

      // Verify scope and log the actual export generation event
      await verifyGroupScopeAndLog(
        requestedBy,
        organizationId,
        childOrgIds,
        (user as any).entityScope,
        'query'
      );

      signedUrl = await generateGroupAuditArchive(organizationId, childOrgIds, requestedBy);
      notificationTitle = 'Your Group Audit export is ready';
      notificationBody = 'Your consolidated cross-entity compliance audit file has been generated and is ready for download.';
    } else if (isFullAudit) {
      signedUrl = (await generateAuditFile(organizationId)) as string;
      notificationTitle = 'Your audit file is ready';
      notificationBody = 'Your complete compliance audit file has been generated and is ready for download.';
    } else {
      // 1. Gather data
      const org = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
      const dataRegion = org?.dataRegion || 'eu-west-1';
      const s3Client = getS3ClientForRegion(dataRegion);
      const s3Bucket = getS3BucketForOrg(dataRegion);
      const orgUsers = await db.query.users.findMany({ where: eq(users.organizationId, organizationId) });
      const activities = await db.query.processingActivities.findMany({ where: eq(processingActivities.organizationId, organizationId) });

      const exportData = {
          organization: org,
          users: orgUsers,
          processingActivities: activities,
      };

      // 2. Generate JSON files and Zip them
      const archive = archiver('zip', { zlib: { level: 9 } });

      // We create a passthrough stream so we can pipe the archiver output to S3 Upload
      const pass = new stream.PassThrough();
      archive.pipe(pass);

      archive.append(JSON.stringify(exportData, null, 2), { name: 'export.json' });

      // Fetch documents
      const orgDocuments = await db.query.documents.findMany({
        where: eq(documents.organizationId, organizationId),
      });

      for (const doc of orgDocuments) {
        if (doc.s3Key) {
          try {
            const response = await s3Client.send(new GetObjectCommand({
              Bucket: s3Bucket,
              Key: doc.s3Key,
            }));
            if (response.Body) {
               archive.append(response.Body as stream.Readable, { name: `documents/${doc.originalName}` });
            }
          } catch(e) {
            console.error(`Failed to fetch document ${doc.id} from S3`, e);
          }
        }
      }

      // Finalize archive
      archive.finalize();

      // 3. S3 Upload
      const exportKey = `exports/${organizationId}/${Date.now()}.zip`;
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: s3Bucket,
          Key: exportKey,
          Body: pass,
        }
      });

      await upload.done();

      signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        Bucket: s3Bucket,
        Key: exportKey,
      }), { expiresIn: 7 * 24 * 60 * 60 }); // 7 days

      notificationTitle = 'Your data export is ready';
      notificationBody = `Your data export is ready. Download it before it expires in 7 days.`;
    }

    // 4. Send email logic (Queue notification)
    console.log(`Sending email to user ${requestedBy} with link: ${signedUrl}`);
    await db.insert(notificationQueue).values({
      organizationId,
      userId: requestedBy,
      type: 'general.data_export_ready',
      title: notificationTitle,
      body: notificationBody,
      actionUrl: signedUrl,
      channel: 'email',
    });

    console.log(`Data export for org ${organizationId} completed.`);
    return { success: true, signedUrl };
});
