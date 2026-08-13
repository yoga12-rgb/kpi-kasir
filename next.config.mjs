/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    imageSizes: [16, 32, 48, 64, 72, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '55421',
        pathname: '/storage/v1/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '55421',
        pathname: '/storage/v1/**',
      },
    ],
  },
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https: http://localhost:55421 http://127.0.0.1:55421",
      `connect-src 'self' ${supabaseOrigin} https://*.supabase.co ws://localhost:54321 ws://127.0.0.1:54321 wss://*.supabase.co`,
      "frame-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ];
  },
};

export default nextConfig;
