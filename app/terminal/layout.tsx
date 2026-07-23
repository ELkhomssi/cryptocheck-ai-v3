import { Inter, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@/lib/trading-terminal/design-tokens.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmPlex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-ibm-plex',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono-terminal',
  display: 'swap',
})

export default function TerminalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${ibmPlex.variable} ${jetbrainsMono.variable} ${ibmPlex.className} antialiased`}
      style={{
        fontFamily: 'var(--font-ibm-plex), var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif',
        background: '#FFFFFF',
        color: '#111111',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}
