import DOMPurify from 'dompurify';
import React from 'react';
import { db } from 'api/src/db';
import { organizations, privacyPolicies, policyVersions } from 'db';
import { eq, and, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Shield } from 'lucide-react';

export default async function PublicPrivacyPolicy({ params }: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = await params;

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, org_slug));
  
  if (!org) {
    notFound();
  }

  // Find the primary website visitor policy for this org
  const [policy] = await db.select().from(privacyPolicies)
    .where(
      and(
        eq(privacyPolicies.organizationId, org.id),
        eq(privacyPolicies.type, 'website_visitors')
      )
    );

  if (!policy || !policy.currentVersionId) {
    return (
      <div className="min-h-screen bg-bone-50 flex flex-col items-center justify-center p-8 text-center">
        <Shield className="w-16 h-16 text-ink-300 mb-6" />
        <h1 className="text-2xl font-serif text-ink-900 mb-2">Policy Not Found</h1>
        <p className="text-ink-600 max-w-md mx-auto">
          The privacy policy for {org.name} has not been published yet. Please check back later.
        </p>
      </div>
    );
  }

  // Get the published version
  const [version] = await db.select().from(policyVersions).where(eq(policyVersions.id, policy.currentVersionId));

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-ink-900 mb-4">{policy.name}</h1>
          <p className="text-ink-500 font-medium">
            Published by {org.name} • Last updated {new Date(policy.publishedAt!).toLocaleDateString()}
          </p>
        </div>

        <div 
          className="prose prose-ink prose-a:text-sage-600 hover:prose-a:text-sage-700 max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(version.contentHtml || '') }}
        />
        
        <div className="mt-16 pt-8 border-t border-ink-900/10 text-center text-sm text-ink-400">
          Powered by <a href="https://custodia.io" className="font-medium text-ink-500 hover:text-ink-900">Custodia</a> Privacy Infrastructure
        </div>
      </div>
    </div>
  );
}
