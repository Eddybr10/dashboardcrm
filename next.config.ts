import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['mssql', 'tedious'],
  turbopack: {},
  allowedDevOrigins: ['192.168.0.19', 'localhost:3000'],
};

export default nextConfig;
