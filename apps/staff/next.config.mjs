import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.STAFF_QA_DIST_DIR || '.next',
  transpilePackages: ['@polyaero/shared', '@polyaero/design-tokens'],
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
};

export default nextConfig;
