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
      { source: '/dashboard/terminal', destination: '/terminalOS', permanent: false },
      { source: '/dashboard/terminal/:path*', destination: '/terminalOS', permanent: false },
      // Canonical terminal is Terminal OS (/terminalOS); legacy /terminal redirects there
      { source: '/terminal', destination: '/terminalOS', permanent: false },
      { source: '/portfolio', destination: '/terminalOS', permanent: true },
      { source: '/portfolio/:path*', destination: '/terminalOS', permanent: true },
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
