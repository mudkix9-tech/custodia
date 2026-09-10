import { createWorker } from '../lib/queue.js';
import { embedOrganizationData, deleteOrganizationEmbedding } from '../lib/orgEmbeddings.js';

export const orgEmbeddingsWorker = createWorker('org-embeddings', async (job: any) => {
  const { orgId, entityType, entityId, action } = job.data;
  console.log(`Processing org-embeddings job: orgId=${orgId}, entityType=${entityType}, entityId=${entityId}, action=${action}`);

  try {
    if (action === 'delete') {
      await deleteOrganizationEmbedding(orgId, entityType, entityId);
      console.log(`Successfully deleted embedding for orgId=${orgId}, entityType=${entityType}, entityId=${entityId}`);
    } else {
      await embedOrganizationData(orgId, entityType, entityId);
      console.log(`Successfully upserted embedding for orgId=${orgId}, entityType=${entityType}, entityId=${entityId}`);
    }
  } catch (err) {
    console.error(`Failed to process org-embeddings job for orgId=${orgId}, entityType=${entityType}, entityId=${entityId}:`, err);
    throw err;
  }
  // Enqueued as a side effect of saving a record, and the Copilot's answers are
  // only as current as this queue, so it polls far faster than the thirty-second
  // default set in queue.ts. See the note in workers/webhooks.ts for why this is
  // five seconds rather than the two it used to inherit.
}, { newJobCheckIntervalSeconds: 5 });
