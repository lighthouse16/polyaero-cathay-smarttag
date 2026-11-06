/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@polyaero/shared', '@polyaero/design-tokens'],
  reactStrictMode: true,
};

export default nextConfig;
