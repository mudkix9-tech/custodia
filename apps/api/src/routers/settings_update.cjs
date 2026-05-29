const fs = require('fs');

let content = fs.readFileSync('apps/api/src/routers/settings.ts', 'utf8');

const residencyRouterCode = `
  getResidencyData: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.user!.orgId),
      columns: {
        dataRegion: true,
        dedicatedDatabaseStatus: true,
        dedicatedDatabaseProvisionedAt: true,
      }
    });
    return org;
  }),

  updateResidency: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      region: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });

      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      if (org.subscriptionTier !== 'enterprise') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Enterprise plan required' });
      }

      await db.update(organizations)
        .set({
          dataRegion: input.region,
          dedicatedDatabaseStatus: 'provisioning'
        })
        .where(eq(organizations.id, ctx.user!.orgId));

      // Trigger provisioning worker
      const { residencyProvisioningQueue } = await import('../workers/residencyProvisioner.js');
      await residencyProvisioningQueue.add('provision', {
        orgId: org.id,
        region: input.region,
        orgSlug: org.slug
      });

      return { success: true };
    }),`;

// insert into router
const targetStr = "export const settingsRouter = router({";
content = content.replace(targetStr, targetStr + residencyRouterCode);

fs.writeFileSync('apps/api/src/routers/settings.ts', content);
console.log('Settings router updated.');
