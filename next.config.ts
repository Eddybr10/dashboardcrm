import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['mssql', 'tedious'],
  turbopack: {},
};

export default nextConfig;
