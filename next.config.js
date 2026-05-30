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
      // Exact / prefix paths (substring "company" anywhere else is handled in middleware.ts)
      { source: '/company', destination: '/', permanent: true },
      { source: '/company/:path*', destination: '/', permanent: true },
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
