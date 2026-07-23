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
      className={`${inter.variable} ${ibmPlexMono.variable} ${inter.className} tit-root antialiased`}
      style={
        {
          // Ensure mono variable resolves for all descendants (numbers/prices/%)
          ['--font-mono' as string]: `${ibmPlexMono.style.fontFamily}, 'IBM Plex Mono', ui-monospace, monospace`,
          fontFamily: 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          background: '#F5F6F8',
          color: '#161A22',
          minHeight: '100vh',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
