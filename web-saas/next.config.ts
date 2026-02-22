import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
