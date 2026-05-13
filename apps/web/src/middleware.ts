import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  if (request.nextUrl.pathname.startsWith('/assessment')) {
    const existing = request.cookies.get('pvr_anon_session');
    if (!existing) {
      response.cookies.set('pvr_anon_session', crypto.randomUUID(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }
  }
  
  return response;
}

export const config = {
  matcher: ['/assessment/:path*'],
};
