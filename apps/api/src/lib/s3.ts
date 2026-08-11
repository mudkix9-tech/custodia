import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Clients = new Map<string, S3Client>();

export function getS3BucketForOrg(dataRegion: string): string {
  const bucketMap: Record<string, string> = {
    'eu-west-1': 'custodia-documents-eu-west-1',
    'eu-central-1': 'custodia-documents-eu-central-1',
    'eu-west-3': 'custodia-documents-eu-west-3',
    'eu-north-1': 'custodia-documents-eu-north-1',
  };
  return bucketMap[dataRegion] ?? 'custodia-documents-eu-central-1';
}

export function getS3ClientForRegion(region: string): S3Client {
  if (!s3Clients.has(region)) {
    s3Clients.set(region, new S3Client({ region, forcePathStyle: true })); // use forcePathStyle for dev/testing often
  }
  return s3Clients.get(region)!;
}

export async function generateUploadUrl(key: string, contentType: string, dataRegion: string = 'eu-central-1'): Promise<string> {
  const region = dataRegion || 'eu-central-1';
  const client = getS3ClientForRegion(region);
  const bucket = getS3BucketForOrg(region);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
}

export async function generateDownloadUrl(key: string, dataRegion: string = 'eu-central-1', expiresIn: number = 3600, filename?: string): Promise<string> {
  const region = dataRegion || 'eu-central-1';
  const client = getS3ClientForRegion(region);
  const bucket = getS3BucketForOrg(region);

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {})
  });

  return getSignedUrl(client, command, { expiresIn });
}
