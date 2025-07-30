/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ragboard/types', '@ragboard/ui', '@ragboard/canvas'],
  experimental: {
    externalDir: true,
  },
  images: {
    domains: ['localhost'],
  },
}