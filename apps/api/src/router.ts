import { router, publicProcedure } from './trpc.js';
import { vendorsRouter } from './routers/vendors.js';
import { assessmentsRouter } from './routers/assessments.js';
import { ropaRouter } from './routers/ropa.js';
import { dpiaRouter } from './routers/dpia.js';
import { exportRouter } from './routers/export.js';
import { teamRouter } from './routers/team.js';
import { dsarRouter } from './routers/dsar.js';
import { policiesRouter } from './routers/policies.js';
import { consentRouter } from './routers/consent.js';
import { breachesRouter } from './routers/breaches.js';
import { auditRouter } from './routers/audit.js';
import { portalRouter } from './routers/portal.js';
import { aiRouter } from './routers/ai.js';
import { tiaRouter } from './routers/tia.js';
import { clientsRouter } from './routers/clients.js';
import { trainingRouter } from './routers/training.js';
import { settingsRouter } from './routers/settings.js';
import { notificationsRouter } from './routers/notifications.js';
import { regulatoryRouter } from './routers/regulatory.js';
import { integrationsRouter } from './routers/integrations.js';
import { securityRouter } from './routers/security.js';
import { dataRouter } from './routers/data.js';

import { apiKeysRouter } from "./routers/apiKeys.js";
import { webhooksRouter } from "./routers/webhooks.js";
import { onboardingRouter } from './routers/onboarding.js';
import { groupRouter } from './routers/group.js';
import { customRolesRouter } from './routers/customRoles.js';
import { analyticsRouter } from './routers/analytics.js';

export const appRouter = router({
  customRoles: customRolesRouter,
  onboarding: onboardingRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  vendors: vendorsRouter,
  assessments: assessmentsRouter,
  ropa: ropaRouter,
  dpia: dpiaRouter,
  export: exportRouter,
  team: teamRouter,
  dsar: dsarRouter,
  policies: policiesRouter,
  consent: consentRouter,
  breaches: breachesRouter,
  audit: auditRouter,
  portal: portalRouter,
  ai: aiRouter,
  tia: tiaRouter,
  clients: clientsRouter,
  training: trainingRouter,
  settings: settingsRouter,
  notifications: notificationsRouter,
  regulatory: regulatoryRouter,
  integrations: integrationsRouter,
  security: securityRouter,
  data: dataRouter,
  group: groupRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
