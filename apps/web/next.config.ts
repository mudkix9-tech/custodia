import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:locale/blog/what-is-ropa-template',
        destination: '/:locale/gdpr/ropa-template',
        permanent: true,
      },
      {
        source: '/blog/what-is-ropa-template',
        destination: '/gdpr/ropa-template',
        permanent: true,
      },
      {
        source: '/:locale/blog/gdpr-compliance-guide-agencies',
        destination: '/:locale/gdpr/compliance-guide-agencies',
        permanent: true,
      },
      {
        source: '/blog/gdpr-compliance-guide-agencies',
        destination: '/gdpr/compliance-guide-agencies',
        permanent: true,
      },
      {
        source: '/:locale/blog/google-consent-mode-v2',
        destination: '/:locale/gdpr/consent-mode-v2',
        permanent: true,
      },
      {
        source: '/blog/google-consent-mode-v2',
        destination: '/gdpr/consent-mode-v2',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${process.env.API_URL || 'http://localhost:4000'}/api/trpc/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Basic CSP. Note: Sentry will need its own domains whitelisted if added
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.paddle.com https://public.profitwell.com; style-src 'self' 'unsafe-inline' https://cdn.paddle.com; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https://*.custodia.io http://localhost:4000 https://*.paddle.com https://public.profitwell.com; frame-src 'self' https://*.paddle.com",
          }
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: 'custodia',
  project: 'custodia-web',
  silent: true,
});
