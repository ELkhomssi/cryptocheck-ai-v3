import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import { SolanaProvider } from '@/components/SolanaProvider'
import { DisclaimerModal } from '@/components/legal/DisclaimerModal'
import { Analytics } from '@vercel/analytics/react'
import '@/styles/tokens.css'
import './globals.css'
// ── Bloomberg-style monospace + companion sans ──
const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-mono',
  display: 'swap',
})
const ibmSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})
// ── Intelligence Terminal monospace — scoped to the Analysis Console ──
// Exposed as CSS variable `--font-mono-terminal`; consumed via the
// Tailwind utility `font-mono-terminal` (see tailwind.config.js) inside
// components/Dashboard/intelligence-terminal/**. The rest of the
// dashboard continues to use IBM Plex Mono via `font-mono`.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mono-terminal',
  display: 'swap',
})
export const metadata: Metadata = {
  icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
  title: 'CryptoCheck AI — Solana Token Intelligence',
  description: 'Institutional-grade Neural Scan, AI Predictions, Whale Tracking for Solana traders',
  keywords: ['Solana', 'token scanner', 'rug detection', 'DeFi', 'blockchain analytics', 'Helius'],
  authors: [{ name: 'CryptoCheck AI' }],
}

/** Next.js 14+ — themeColor belongs on `viewport`, not `metadata`. */
export const viewport: Viewport = {
  themeColor: '#030308',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmMono.variable} ${ibmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⬡</text></svg>" />
      </head>
      <body className="font-mono antialiased" style={{ backgroundColor: "#050510", minHeight: "100vh" }}>
        <SolanaProvider>
          {children}
          <DisclaimerModal />
        </SolanaProvider>
        <Analytics />
      </body>
    </html>
  )
}
