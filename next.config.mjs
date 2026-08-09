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
        protocol: 'https',
        hostname: '**',
      },
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
};

export default nextConfig;
