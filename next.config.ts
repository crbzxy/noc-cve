import type { NextConfig } from 'next'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const rootDir = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: rootDir,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
}

export default nextConfig
