import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@novadash/shared'],
  output: 'standalone',
};

export default nextConfig;
