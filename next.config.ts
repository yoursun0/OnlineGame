import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next only allows localhost by default. 127.0.0.1 is a different origin;
  // blocked HMR websockets leave the App Router unhydrated (開牌 is a dead SSR button).
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
