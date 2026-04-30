import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Allow placeholder images during development
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  // Recommended for Vercel Edge
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
}

export default nextConfig
