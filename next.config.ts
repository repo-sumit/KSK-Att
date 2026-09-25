import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets scripts/check-demo-stripped.mjs build a second variant without touching .next.
  distDir: process.env.KSK_DIST_DIR || '.next',
  images: { formats: ['image/avif', 'image/webp'] },
};

export default nextConfig;
