import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Standalone output for slim Docker production image (see Dockerfile)
  output: 'standalone',
}

export default withNextIntl(nextConfig)
