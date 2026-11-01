import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Cloudflare Pages has no built-in Next image optimizer. Serve pre-optimized
  // WebP/AVIF assets (and Supabase Storage transforms) instead of runtime resizing.
  images: { unoptimized: true },
  experimental: {
    // Ship only the icons / motion features actually imported.
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Fingerprinted build output: cache forever.
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
