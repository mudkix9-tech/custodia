import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decode } from '@auth/core/jwt';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const localePattern = /^\/(en|de|fr)(\/|$)/;
  
  // Normalize path by stripping locale for auth/logic checks
  let normalizedPath = path.replace(localePattern, '/');
  if (normalizedPath === '') normalizedPath = '/';

  // 1. Check auth and onboarding redirects BEFORE intl routing
  const isPublicRoute = normalizedPath === '/login' || normalizedPath === '/register' || normalizedPath === '/' || normalizedPath.startsWith('/legal');
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
        const onboardingCompleted = (decoded as any).onboardingCompleted;
        const onboardingDismissed = (decoded as any).onboardingDismissed;

        if (onboardingCompleted === false && onboardingDismissed === false && !normalizedPath.startsWith('/onboarding') && normalizedPath !== '/logout') {
          // Keep the same locale prefix if it exists by redirecting to request.url but with /onboarding
          const targetPath = path.match(localePattern) ? `${path.match(localePattern)![0]}onboarding` : '/onboarding';
          return NextResponse.redirect(new URL(targetPath.replace(/\/\/+/g, '/'), request.url));
        }

        if ((onboardingCompleted === true || onboardingDismissed === true) && normalizedPath.startsWith('/onboarding')) {
           const targetPath = path.match(localePattern) ? `${path.match(localePattern)![0]}dashboard` : '/dashboard';
           return NextResponse.redirect(new URL(targetPath.replace(/\/\/+/g, '/'), request.url));
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  // 2. Apply intl routing
  const response = intlMiddleware(request);

  // 3. Apply post-intl response modifications (like cookies)
  if (normalizedPath.startsWith('/assessment')) {
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
  matcher: [
    // Match root
    '/',
    // Match locales
    '/(de|en|fr)/:path*',
    // Match everything else except api and static assets
    '/((?!api|_next/static|_next/image|_vercel|favicon.ico|.*\\..*).*)'
  ],
};
