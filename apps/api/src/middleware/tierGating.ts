import { FastifyReply } from 'fastify';

export const requireEnterpriseFeature = (feature: string) => {
  return async (request: any, reply: FastifyReply) => {
    if (request.orgTier !== 'enterprise') {
      return reply.status(403).send({ error: `The ${feature} feature requires an Enterprise subscription.` });
    }
  };
};
