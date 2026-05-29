import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { organizations } from 'db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email || !email.includes('@')) {
    return NextResponse.json({ sso: false });
  }

  const domain = email.split('@')[1];

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, domain));

  if (org && org.ssoEnabled) {
    return NextResponse.json({ sso: true, name: org.name });
  }

  return NextResponse.json({ sso: false });
}
