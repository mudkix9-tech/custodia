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
});
