import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@/lib/trading-terminal/design-tokens.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-terminal',
  display: 'swap',
})

export default function TerminalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} ${inter.className} antialiased`}
      style={{
        fontFamily: 'var(--font-geist-sans), var(--font-inter), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}
