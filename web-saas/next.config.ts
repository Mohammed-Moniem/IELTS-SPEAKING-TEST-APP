import type { NextConfig } from 'next';
import path from 'node:path';

const isDevelopment = process.env.NODE_ENV !== 'production';

const connectSrcDirectives = [
  "'self'",
  'https://*.googleapis.com',
  'https://*.firebaseio.com',
  'https://*.firebase.google.com',
  'wss://*.firebaseio.com',
  'https://*.google-analytics.com',
  ...(
    isDevelopment
      ? ['http://127.0.0.1:4000', 'http://localhost:4000', 'ws://127.0.0.1:4000', 'ws://localhost:4000', 'ws:', 'wss:']
      : []
  )
].join(' ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), fullscreen=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://*.firebaseio.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      `connect-src ${connectSrcDirectives}`,
      "frame-src 'self' https://*.stripe.com",
      "worker-src 'self' blob:"
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ];
  },
  async rewrites() {
    const apiBase = process.env.API_INTERNAL_BASE_URL;
    if (!apiBase) {
      return [];
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
