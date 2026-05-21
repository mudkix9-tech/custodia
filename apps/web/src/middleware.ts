import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decode } from '@auth/core/jwt';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;
  
  // Handling anonymous assessments
  if (path.startsWith('/assessment')) {
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
    return response;
  }
  
  // Determine if it's an app route
  const isPublicRoute = path === '/login' || path === '/register' || path === '/' || path.startsWith('/legal');

  // Check auth
  const cookieName = process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const tokenStr = request.cookies.get(cookieName)?.value;

  if (tokenStr && !isPublicRoute) {
    try {
      const decoded = await decode({
        token: tokenStr,
        secret: process.env.AUTH_SECRET || 'secret',
        salt: cookieName,
      });

      if (decoded && decoded.org) {
        // We'll trust the token's onboarding fields. But wait, token doesn't have onboarding fields in auth.ts...
        // For a true implementation, we need to add onboarding flags to the JWT or fetch them here.
        // Middleware edge runtime doesn't have pg access directly, so adding it to JWT in auth.ts is best.

        const onboardingCompleted = (decoded as any).onboardingCompleted;
        const onboardingDismissed = (decoded as any).onboardingDismissed;

        if (onboardingCompleted === false && onboardingDismissed === false && !path.startsWith('/onboarding') && path !== '/logout') {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }

        if ((onboardingCompleted === true || onboardingDismissed === true) && path.startsWith('/onboarding')) {
           return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
