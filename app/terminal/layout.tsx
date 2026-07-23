import { Inter, IBM_Plex_Mono } from 'next/font/google'
import '@/lib/trading-terminal/design-tokens.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-terminal',
  display: 'swap',
})

export default function TerminalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${ibmPlexMono.variable} ${inter.className} antialiased`}
      style={{
        fontFamily: 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        background: '#F5F6F8',
        color: '#161A22',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}
