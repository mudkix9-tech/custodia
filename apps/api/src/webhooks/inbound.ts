import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import { dsarRequests, dsarCommunications } from 'db';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function extractReplyContent(emailBody: string): string {
  if (!emailBody) return '';
  const lines = emailBody.split('\n');
  const newContent = [];
  
  for (const line of lines) {
    if (line.startsWith('On ') && line.includes(' wrote:')) break;
    if (line.startsWith('>')) break;
    if (line.startsWith('---')) break;
    if (line.includes('Original Message')) break;
    newContent.push(line);
  }
  
  return newContent.join('\n').trim();
}

export async function inboundEmailWebhookHandler(fastify: FastifyInstance) {
  fastify.post('/api/webhooks/inbound-email', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = request.body as any;
      
      // Basic validation of the payload (Resend format usually has `to`, `from`, `subject`, `text`, `html`)
      const toAddress = payload.to || '';
      const emailText = payload.text || payload.html || '';
      
      // Extract the token: dsar-[token]@inbound.privaro.io
      const match = toAddress.match(/dsar-([a-zA-Z0-9]+)@inbound\.privaro\.io/);
      if (!match) {
        fastify.log.info('Received inbound email not matching DSAR format');
        return reply.status(200).send({ received: true });
      }

      const token = match[1];
      const inboundAddress = `dsar-${token}@inbound.privaro.io`;

      const [dsar] = await db.select().from(dsarRequests).where(eq(dsarRequests.inboundEmailAddress, inboundAddress));
      
      if (!dsar) {
        fastify.log.warn(`No DSAR found for inbound address: ${inboundAddress}`);
        return reply.status(200).send({ received: true });
      }

      const replyContent = extractReplyContent(emailText);

      // Save attachments logic would go here (e.g. uploading to S3)
      const attachments: any[] = [];
      if (payload.attachments && Array.isArray(payload.attachments)) {
        for (const file of payload.attachments) {
          // Mock saving to S3
          attachments.push({
            filename: file.filename,
            s3Key: `dsar-attachments/${dsar.id}/${file.filename}`,
            mimeType: file.contentType,
            sizeBytes: file.content?.length || 0
          });
        }
      }

      await db.insert(dsarCommunications).values({
        dsarId: dsar.id,
        direction: 'inbound',
        type: 'response',
        channel: 'email',
        subject: payload.subject || 'Re: DSAR Update',
        body: replyContent,
        attachments: attachments,
        sentAt: new Date()
      });

      return reply.status(200).send({ received: true });
    } catch (error) {
      fastify.log.error(error, 'Error processing inbound email webhook');
      // We return 200 so the webhook provider doesn't infinitely retry unless it's a critical infrastructure failure
      return reply.status(200).send({ error: 'Processed with errors' });
    }
  });
}
