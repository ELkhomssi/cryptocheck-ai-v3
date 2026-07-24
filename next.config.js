/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cryptocheck/signing', '@cryptocheck/ccai-connect', '@cryptocheck/types'],
  experimental: {
    instrumentationHook: true,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'cryptocheckai.com' }],
        destination: 'https://www.cryptocheckai.com/:path*',
        permanent: false,
      },
      { source: '/company', destination: '/', permanent: true },
      { source: '/company/:path*', destination: '/', permanent: true },
      { source: '/dashboard/terminal', destination: '/terminal', permanent: false },
      { source: '/dashboard/terminal/:path*', destination: '/terminal', permanent: false },
      // Phase 10 — portfolio desk is now the canonical /terminal
      { source: '/portfolio', destination: '/terminal', permanent: true },
      { source: '/portfolio/:path*', destination: '/terminal', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
    ]
  },
}

module.exports = nextConfig
