import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api/src/router';

export const trpc = createTRPCReact<AppRouter>();

/**
 * Return types of every procedure, e.g. `RouterOutputs['team']['list'][number]`.
 *
 * Worth preferring over a hand-written shape: until ctx.db was typed these
 * outputs were all `any`, so components declared their own copies of row types
 * that nothing checked against the server. Those copies drift — the team page's
 * narrowed `role` union no longer matched the varchar column it came from.
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
