import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https://*.privaro.io http://localhost:4000",
          }
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'privaro',
  project: 'privaro-web',
  silent: true,
});
