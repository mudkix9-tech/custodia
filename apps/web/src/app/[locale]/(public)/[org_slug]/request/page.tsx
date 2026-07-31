import { notFound } from 'next/navigation';
import { organizations } from 'db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DsarIntakeForm } from '@/components/dsar/DsarIntakeForm';

const queryClient = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gdpr_db');
const db = drizzle(queryClient);

export default async function BrandedDsarRequestPage({ params }: { params: { org_slug: string } }) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, params.org_slug));
  
  if (!org) {
    notFound();
  }

  // Assuming org.branding is a JSON object with primaryColor, logoUrl, etc.
  const branding = org.branding as any || {};

  return (
    <div className="min-h-screen bg-bone-50 py-12 px-4 sm:px-6 lg:px-8 font-sans" style={{ '--org-primary': branding.primaryColor || '#2c3e38' } as any}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={org.name} className="h-12 mx-auto mb-6" />
          ) : (
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-ink-900/10 flex items-center justify-center mx-auto mb-6 text-xl font-serif text-[var(--org-primary)]">
              {org.name.charAt(0)}
            </div>
          )}
          <h1 className="text-3xl font-serif text-ink-900 mb-2">Data Subject Access Request</h1>
          <p className="text-ink-600">Submit a request regarding your personal data processed by {org.name}.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-ink-900/10 overflow-hidden">
          <DsarIntakeForm orgSlug={params.org_slug} orgName={org.name} />
        </div>
        
        <div className="mt-8 text-center text-[13px] text-ink-400">
          Powered by <a href="https://custodia.io" className="font-medium hover:text-ink-600 transition-colors">Custodia OS</a>
        </div>
      </div>
    </div>
  );
}
